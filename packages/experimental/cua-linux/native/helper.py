#!/usr/bin/python3
"""Agent-owned AT-SPI helper. Host consent precedes every application operation.

No global input, screen capture, clipboard, application launch or shell execution.
The private JSONL pipe is the authority boundary; never expose it as a server.
"""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import secrets
import sys
from dataclasses import dataclass, field

METHODS = ['getCapabilities', 'listApps', 'findApps', 'getApp', 'listWindows',
           'getState', 'listActions', 'performAction', 'invoke']
MAX_APPS = 256
MAX_ELEMENTS = 5000
MAX_DEPTH = 50
MAX_HANDLES = 64
MAX_NAME = 512


class Failure(Exception):
    def __init__(self, code, message):
        self.code, self.message = code, message
        super().__init__(message)


def require(condition, code='INVALID_REQUEST', message='Invalid native request'):
    if not condition:
        raise Failure(code, message)


def token():
    return secrets.token_hex(16)


def text(value, limit=MAX_NAME):
    # Escape line/control characters so application names cannot forge tree rows.
    require(isinstance(value, str), 'ATSPI_UNAVAILABLE', 'Accessibility returned invalid text')
    return json.dumps(value[:limit], ensure_ascii=True)


def label_digest(value):
    """Keep bounded metadata while detecting changes beyond displayed truncation."""
    require(isinstance(value, str), 'ATSPI_UNAVAILABLE', 'Accessibility returned invalid text')
    digest = hashlib.sha256()
    for offset in range(0, len(value), 4096):
        digest.update(value[offset:offset + 4096].encode('utf-8', errors='surrogatepass'))
    return digest.digest()


def process_identity(pid):
    """Bind a selected, same-user process instance; PID reuse/exec invalidates it."""
    require(type(pid) is int and pid > 0, 'APP_UNAVAILABLE', 'Invalid process identity')
    try:
        root = Path('/proc') / str(pid)
        require(root.stat().st_uid == os.getuid(), 'APP_UNAVAILABLE', 'Application belongs to another user')
        raw = (root / 'stat').read_text()
        start = raw[raw.rfind(')') + 2:].split()[19]
        executable = root / 'exe'
        stat = executable.stat()
        path = os.readlink(executable)
        return (pid, start, path, stat.st_dev, stat.st_ino)
    except Failure:
        raise
    except (OSError, ValueError, IndexError):
        raise Failure('APP_UNAVAILABLE', 'Application process is unavailable') from None


def session_locked(properties, uid):
    """Validate all required logind facts before considering a session usable."""
    if not isinstance(properties, dict):
        return None
    user = properties.get('User')
    if (not isinstance(user, (tuple, list)) or len(user) != 2 or
            type(user[0]) is not int or user[0] != uid or
            properties.get('Type') not in ('wayland', 'x11') or
            any(type(properties.get(key)) is not bool for key in ('Active', 'Remote', 'LockedHint'))):
        return None
    return properties['LockedHint'] or not properties['Active'] or properties['Remote']


class Logind:
    """Read-only system-bus queries, with bounded calls and no session mutation."""
    @staticmethod
    def call(path, interface, method, parameters, reply_type):
        from gi.repository import Gio, GLib
        connection = Gio.bus_get_sync(Gio.BusType.SYSTEM, None)
        return connection.call_sync(
            'org.freedesktop.login1', path, interface, method, parameters,
            GLib.VariantType.new(reply_type), Gio.DBusCallFlags.NONE, 1500, None).unpack()[0]

    def properties(self, path):
        from gi.repository import GLib
        return self.call(path, 'org.freedesktop.DBus.Properties', 'GetAll',
                         GLib.Variant('(s)', ('org.freedesktop.login1.Session',)), '(a{sv})')

    def by_pid(self, pid):
        from gi.repository import GLib
        path = self.call('/org/freedesktop/login1', 'org.freedesktop.login1.Manager',
                         'GetSessionByPID', GLib.Variant('(u)', (pid,)), '(o)')
        return self.properties(path)

    def sessions(self):
        return self.call('/org/freedesktop/login1', 'org.freedesktop.login1.Manager',
                         'ListSessions', None, '(a(susso))')


class SessionGuard:
    """Explicit binding is opt-in and never an automatic GetSessionByPID fallback.

    AT-SPI is user-wide. Requiring a sole graphical session mitigates accidental
    cross-session access, but does not turn logind hints into OS-enforced isolation.
    """
    def __init__(self, session_id=None, logind=None, uid=None, pid=None):
        if session_id is not None and (not isinstance(session_id, str) or
                re.fullmatch(r'[A-Za-z0-9_-]{1,64}', session_id) is None):
            raise ValueError('session-id must be 1-64 ASCII letters, digits, underscores or hyphens')
        self.session_id = session_id
        self.logind = logind if logind is not None else Logind()
        self.uid = os.getuid() if uid is None else uid
        self.pid = os.getpid() if pid is None else pid
        self.pinned = None
        self.invalidated = False

    def unknown(self):
        # Once selected, disappearance or unverifiable identity must never silently
        # bind existing application handles to a replacement login session.
        if self.pinned is not None:
            self.invalidated = True
        return None

    def locked(self):
        if self.invalidated:
            return None
        try:
            if self.session_id is None:
                return session_locked(self.logind.by_pid(self.pid), self.uid)
            rows = self.logind.sessions()
            if not isinstance(rows, (tuple, list)) or len(rows) > 256:
                return self.unknown()
            graphical, identifiers = [], set()
            for row in rows:
                if (not isinstance(row, (tuple, list)) or len(row) != 5 or
                        not isinstance(row[0], str) or not row[0] or type(row[1]) is not int or
                        not isinstance(row[3], str) or not isinstance(row[4], str) or not row[4].startswith('/')):
                    return self.unknown()
                if row[0] in identifiers:
                    return self.unknown()
                identifiers.add(row[0])
                if row[1] != self.uid:
                    continue
                props = self.logind.properties(row[4])
                if not isinstance(props, dict):
                    return self.unknown()
                user = props.get('User')
                if (props.get('Id') != row[0] or not isinstance(user, (list, tuple)) or
                        len(user) != 2 or type(user[0]) is not int or user[0] != self.uid or
                        props.get('Type') not in ('unspecified', 'tty', 'x11', 'wayland', 'mir', 'web')):
                    return self.unknown()
                # systemd also lists the per-user service manager as a session.
                # Only its positively identified non-graphical form is excluded;
                # an unspecified/unknown login must not establish uniqueness.
                if props['Type'] == 'unspecified':
                    seat = props.get('Seat')
                    if (props.get('Class') == 'manager' and props.get('Remote') is False and row[3] == '' and
                            isinstance(seat, (tuple, list)) and len(seat) == 2 and
                            seat[0] == '' and seat[1] == '/'):
                        continue
                    return self.unknown()
                if props['Type'] in ('mir', 'web'):
                    return self.unknown()
                if props['Type'] not in ('x11', 'wayland'):
                    continue
                locked = session_locked(props, self.uid)
                if locked is None:
                    return self.unknown()
                graphical.append((row, props, locked))
            if len(graphical) != 1 or graphical[0][0][0] != self.session_id:
                return self.unknown()
            row, props, locked = graphical[0]
            seat, timestamp = props.get('Seat'), props.get('TimestampMonotonic')
            if (not isinstance(seat, (list, tuple)) or len(seat) != 2 or
                    not isinstance(seat[0], str) or not seat[0] or row[3] != seat[0] or
                    not isinstance(seat[1], str) or not seat[1].startswith('/') or
                    type(timestamp) is not int or timestamp <= 0):
                return self.unknown()
            identity = (props['Id'], timestamp, tuple(seat))
            if self.pinned is not None and identity != self.pinned:
                return self.unknown()
            if locked is False and self.pinned is None:
                self.pinned = identity
            return locked
        except Exception:
            return self.unknown()


class AtspiBackend:
    """Lazy GI access. Import/diagnostics do not inspect application contents."""
    def __init__(self, session_id=None):
        self.api = None
        self.session_guard = SessionGuard(session_id)

    def ready(self):
        try:
            if self.api is None:
                import gi
                gi.require_version('Atspi', '2.0')
                from gi.repository import Atspi
                Atspi.set_timeout(1500, 3000)
                require(Atspi.init() == 0, 'ATSPI_UNAVAILABLE', 'AT-SPI initialization failed')
                self.api = Atspi
            return self.api.get_desktop(0) is not None
        except Exception:
            return False

    def locked(self):
        """A logind hint, not an OS-enforced guard. Missing facts fail closed."""
        return self.session_guard.locked()

    @staticmethod
    def refresh(node):
        node.clear_cache()

    def apps(self):
        require(self.ready(), 'ATSPI_UNAVAILABLE', 'AT-SPI is unavailable in this graphical session')
        desktop = self.api.get_desktop(0)
        count = desktop.get_child_count()
        require(0 <= count <= MAX_APPS, 'RESOURCE_LIMIT', 'Too many accessible applications')
        return [desktop.get_child_at_index(i) for i in range(count)]

    @staticmethod
    def key(node):
        require(node is not None and node.app is not None, 'STALE_REFERENCE', 'Accessibility object disappeared')
        return (node.app.bus_name, node.path)

    @staticmethod
    def pid(node):
        return node.get_process_id()

    @staticmethod
    def name(node):
        return node.get_name() or ''

    @staticmethod
    def role(node):
        return node.get_role_name() or 'unknown'

    def protected(self, node):
        return (node.get_role() == self.api.Role.PASSWORD_TEXT or
                any(key in ('type', 'text-input-type', 'input-type') and value == 'password'
                    for key, value in node.get_attributes().items()))

    def stale(self, node):
        node.clear_cache()
        states = node.get_state_set()
        return states.contains(self.api.StateType.DEFUNCT) or states.contains(self.api.StateType.STALE)

    def enabled(self, node):
        states = node.get_state_set()
        return states.contains(self.api.StateType.ENABLED) and states.contains(self.api.StateType.SENSITIVE)

    @staticmethod
    def application(node):
        return node.get_application()

    @staticmethod
    def parent(node):
        return node.get_parent()

    @staticmethod
    def children(node, maximum):
        count = node.get_child_count()
        require(count >= 0, 'STALE_REFERENCE', 'Invalid accessibility children')
        return [node.get_child_at_index(i) for i in range(min(count, maximum))], count > maximum

    def bounds(self, node):
        component = node.get_component_iface()
        require(component is not None, 'UNSUPPORTED', 'Window has no accessible geometry')
        rect = component.get_extents(self.api.CoordType.SCREEN)
        return dict(x=rect.x, y=rect.y, width=max(0, rect.width), height=max(0, rect.height))

    def showing(self, node):
        return node.get_state_set().contains(self.api.StateType.SHOWING)

    @staticmethod
    def actions(node):
        if not node.is_action():
            return []
        action = node.get_action_iface()
        count = action.get_n_actions()
        require(0 <= count <= 64, 'RESOURCE_LIMIT', 'Too many accessibility actions')
        result = [action.get_action_name(i) for i in range(count)]
        require(all(isinstance(name, str) and 0 < len(name) <= 128 for name in result),
                'UNSUPPORTED', 'Invalid accessibility action names')
        require(len(set(result)) == len(result), 'UNSUPPORTED', 'Ambiguous accessibility action names')
        return result

    @staticmethod
    def perform(node, index):
        return bool(node.get_action_iface().do_action(index))


@dataclass
class Selection:
    node: object
    key: tuple
    identity: tuple
    name: str
    windows: dict = field(default_factory=dict)
    snapshot: str | None = None
    elements: dict = field(default_factory=dict)
    snapshot_window: str | None = None


class Session:
    def __init__(self, backend=None, identity=process_identity, max_response_bytes=1024 * 1024):
        self.backend = backend if backend is not None else AtspiBackend()
        self.identity = identity
        self.max_response_bytes = max_response_bytes
        self.apps = {}

    def permission_status(self):
        locked = self.backend.locked()
        return dict(platform='linux', accessibility=self.backend.ready(), captureAvailable=False, sessionLocked=locked,
                    helper=dict(name='Ocean AT-SPI helper', path='/usr/bin/python'))

    def capabilities(self):
        locked = self.backend.locked()
        return dict(platform='linux', permissions=dict(accessibility=self.backend.ready(), screenRecording=False),
                    appLevelAccessibility=True, systemPointer=False, keyboard=[], sessionLocked=locked,
                    methods=METHODS, coordinateSpace='screenshot-pixels', browser=False)

    def require_session(self):
        locked = self.backend.locked()
        if locked is not False:
            for selected in self.apps.values():
                selected.snapshot, selected.elements = None, {}
            raise Failure('SESSION_LOCKED' if locked is True else 'SESSION_UNAVAILABLE',
                          'An unlocked active local graphical session could not be verified')

    def app(self, handle):
        self.require_session()
        require(isinstance(handle, str) and handle in self.apps, 'APP_UNAVAILABLE', 'Unknown application handle')
        selected = self.apps[handle]
        require(self.identity(selected.identity[0]) == selected.identity and
                self.backend.key(selected.node) == selected.key and not self.backend.stale(selected.node),
                'APP_UNAVAILABLE', 'Application instance changed; select it again')
        return selected

    def member(self, selected, node):
        require(node is not None and not self.backend.stale(node), 'STALE_REFERENCE', 'Accessibility object is stale')
        require(self.backend.key(self.backend.application(node)) == selected.key and
                self.backend.pid(node) == selected.identity[0], 'STALE_REFERENCE', 'Object belongs to another application')
        # An AT-SPI child may be reparented under a protected field after snapshot.
        current, seen = node, set()
        for _ in range(MAX_DEPTH + 2):
            self.backend.refresh(current)
            key = self.backend.key(current)
            require(key not in seen, 'STALE_REFERENCE', 'Accessibility ancestry contains a cycle')
            seen.add(key)
            require(not self.backend.protected(current), 'PROTECTED_CONTENT', 'Protected accessibility content is excluded')
            if key == selected.key:
                return
            current = self.backend.parent(current)
            require(current is not None, 'STALE_REFERENCE', 'Object detached from application')
        raise Failure('RESOURCE_LIMIT', 'Accessibility ancestry is too deep')

    def discover(self, selected_pid=None):
        self.require_session()
        result = []
        for node in self.backend.apps():
            if node is None:
                continue
            try:
                pid = self.backend.pid(node)
                if selected_pid is not None and str(pid) != selected_pid:
                    continue
                self.identity(pid)
                if self.backend.stale(node):
                    continue
                result.append((node, pid, self.backend.name(node)[:MAX_NAME]))
            except Failure:
                continue
        self.require_session()
        return result

    def select(self, selector):
        require(isinstance(selector, str) and 0 < len(selector) <= MAX_NAME)
        found = [(node, pid, name) for node, pid, name in self.discover(selector) if selector == str(pid)]
        require(len(found) == 1, 'APP_UNAVAILABLE', 'Select one running application using its exact PID from listApps')
        require(len(self.apps) < MAX_HANDLES, 'RESOURCE_LIMIT', 'Application handle limit reached; reconnect helper')
        node, pid, name = found[0]
        identity = self.identity(pid)
        key = self.backend.key(node)
        handle = token()
        self.apps[handle] = Selection(node, key, identity, name)
        digest = hashlib.sha256(json.dumps([identity, key]).encode()).hexdigest()
        return dict(appHandle=handle, name=name, running=True,
                    authorization=dict(id=digest, name=name, executablePath=identity[2], persistable=False))

    def windows(self, selected):
        nodes, truncated = self.backend.children(selected.node, 128)
        require(not truncated, 'RESOURCE_LIMIT', 'Too many accessible windows')
        old = {self.backend.key(node): wid for wid, node in selected.windows.items()}
        current, result = {}, []
        for node in nodes:
            if node is None or self.backend.protected(node):
                continue
            self.member(selected, node)
            wid = old.get(self.backend.key(node), token())
            try:
                bounds = self.backend.bounds(node)
            except Failure as error:
                if error.code == 'UNSUPPORTED':
                    continue
                raise
            current[wid] = node
            result.append(dict(windowId=wid, appName=selected.name, title=self.backend.name(node)[:MAX_NAME],
                               bounds=bounds, isOnScreen=self.backend.showing(node), onCurrentSpace=None))
        self.require_session()
        selected.windows = current
        return result

    def observe(self, handle, params):
        selected = self.app(handle)
        # Invalidate the previous snapshot even when the new observation fails.
        selected.snapshot, selected.elements = None, {}
        maximum = params.get('maxElements', 1000)
        depth_limit = params.get('maxDepth', 30)
        require(type(maximum) is int and 1 <= maximum <= MAX_ELEMENTS)
        require(type(depth_limit) is int and 1 <= depth_limit <= MAX_DEPTH)
        windows = self.windows(selected)
        wid = params.get('windowId')
        require(wid is None or wid in selected.windows, 'STALE_REFERENCE', 'Unknown window')
        root = selected.node if wid is None else selected.windows[wid]
        pending, visited, lines, elements = [(root, 0)], set(), [], {}
        truncated = False
        budget = max(1024, self.max_response_bytes // 2)
        size = 0
        while pending:
            if len(visited) >= maximum:
                truncated = True
                break
            node, depth = pending.pop()
            if node is None:
                continue
            key = self.backend.key(node)
            if key in visited:
                continue
            visited.add(key)
            if self.backend.protected(node):
                line = '  ' * depth + '[protected content]'
            else:
                self.member(selected, node)
                role, name = self.backend.role(node), self.backend.name(node)
                eid = token()
                line = '  ' * depth + f'[{eid}] {text(role, 128)} {text(name)}'
                actions = self.backend.actions(node)
                elements[eid] = (node, key, label_digest(role), label_digest(name), actions)
                self.backend.refresh(node)
                if depth < depth_limit:
                    children, limited = self.backend.children(node, max(0, maximum - len(visited) - len(pending)))
                    truncated |= limited
                    pending.extend((child, depth + 1) for child in reversed(children))
                elif self.backend.children(node, 0)[1]:
                    truncated = True
            size += len(line.encode('utf-8')) + 1
            if size > budget:
                truncated = True
                break
            lines.append(line)
        self.require_session()
        snapshot = token()
        selected.snapshot, selected.elements, selected.snapshot_window = snapshot, elements, wid
        return dict(appHandle=handle, windowId=wid, snapshotId=snapshot, tree='\n'.join(lines),
                    windows=windows, truncated=truncated)

    def element(self, params):
        selected = self.app(params.get('appHandle'))
        require(isinstance(params.get('snapshotId'), str) and params['snapshotId'] == selected.snapshot,
                'STALE_REFERENCE', 'Read a fresh accessibility snapshot')
        require(params.get('windowId') == selected.snapshot_window,
                'STALE_REFERENCE', 'Snapshot belongs to another window')
        eid = params.get('elementId')
        require(isinstance(eid, str) and eid in selected.elements, 'STALE_REFERENCE', 'Unknown element reference')
        node, key, role, name, actions = selected.elements[eid]
        self.member(selected, node)
        if selected.snapshot_window is not None:
            window = selected.windows.get(selected.snapshot_window)
            require(window is not None, 'STALE_REFERENCE', 'Window disappeared')
            current = node
            for _ in range(MAX_DEPTH + 2):
                require(current is not None, 'STALE_REFERENCE', 'Element moved outside the selected window')
                self.backend.refresh(current)
                require(not self.backend.protected(current), 'PROTECTED_CONTENT', 'Protected accessibility content is excluded')
                if self.backend.key(current) == self.backend.key(window):
                    break
                current = self.backend.parent(current)
            else:
                raise Failure('STALE_REFERENCE', 'Element is outside the selected window')
        require(self.backend.key(node) == key and label_digest(self.backend.role(node)) == role and
                label_digest(self.backend.name(node)) == name and self.backend.actions(node) == actions,
                'STALE_REFERENCE', 'Element changed; read fresh state')
        return selected, node, actions

    def dispatch(self, method, params):
        require(isinstance(method, str) and isinstance(params, dict))
        if method == 'getCapabilities':
            return self.capabilities()
        if method == 'permissionStatus':
            return self.permission_status()
        if method == 'applicationIcons':
            return {}
        if method in ('requestPermission', 'openPermissionSettings'):
            raise Failure('UNSUPPORTED', 'Enable accessibility in the application yourself; no system settings are changed')
        if method == 'listApps':
            return [dict(id=str(pid), name=name, pid=pid, isRunning=True) for _, pid, name in self.discover()]
        if method == 'findApps':
            query = params.get('query')
            require(isinstance(query, str) and 0 < len(query.strip()) <= MAX_NAME)
            limit = params.get('maxAppMatches', 50)
            require(type(limit) is int and 1 <= limit <= MAX_APPS)
            return [dict(id=str(pid), displayName=name, path=self.identity(pid)[2], pid=pid, isRunning=True)
                    for _, pid, name in self.discover() if query.casefold() in name.casefold()][:limit]
        if method == 'getApp':
            return self.select(params.get('selector'))
        if method == 'listWindows':
            return self.windows(self.app(params.get('appHandle')))
        if method == 'getState':
            return self.observe(params.get('appHandle'), params)
        if method in ('listActions', 'performAction', 'invoke'):
            selected, node, actions = self.element(params)
            if method == 'listActions':
                return actions
            require(self.backend.enabled(node), 'UNSUPPORTED', 'Element is disabled')
            require(params.get('argument') is None, 'UNSUPPORTED', 'AT-SPI actions do not accept arguments')
            if method == 'invoke':
                choices = [name for name in actions if name in ('click', 'activate', 'press')]
                require(len(choices) == 1, 'UNSUPPORTED', 'Choose an explicit advertised action')
                action = choices[0]
            else:
                action = params.get('action')
                require(isinstance(action, str) and action in actions, 'UNSUPPORTED', 'Action was not advertised')
            self.require_session()
            # No retry, and a completed/uncertain mutation always consumes its snapshot.
            selected.snapshot, selected.elements = None, {}
            return dict(dispatched=self.backend.perform(node, actions.index(action)))
        raise Failure('UNSUPPORTED', 'Operation is not supported by the Linux AT-SPI provider')


def serve(session, source, target, max_request_bytes, max_response_bytes):
    """Bound each request before JSON parsing. Cancellation closes the transport."""
    while True:
        line = source.readline(max_request_bytes + 1)
        if not line:
            return
        if len(line) > max_request_bytes or not line.endswith(b'\n'):
            return  # Oversize/framing violation invalidates all connection-owned handles.
        request_id = None
        try:
            request = json.loads(line)
            require(isinstance(request, dict))
            if request.get('type') == 'cancel':
                return
            require(set(request) == {'id', 'method', 'params'})
            request_id = request['id']
            require(isinstance(request_id, str) and 0 < len(request_id) <= 128)
            result = session.dispatch(request['method'], request['params'])
            response = dict(id=request_id, result=result)
        except Failure as error:
            response = dict(id=request_id or 'invalid', error=dict(code=error.code, message=error.message))
        except Exception:
            # Remote errors may contain application data; never echo their text.
            response = dict(id=request_id or 'invalid', error=dict(code='ATSPI_FAILURE',
                            message='Accessibility request failed; inspect fresh state before retrying'))
        encoded = json.dumps(response, ensure_ascii=True, separators=(',', ':')).encode() + b'\n'
        if len(encoded) > max_response_bytes:
            encoded = json.dumps(dict(id=request_id or 'invalid', error=dict(code='RESOURCE_LIMIT',
                                 message='Native response exceeds byte limit'))).encode() + b'\n'
            if len(encoded) > max_response_bytes:
                return
        target.write(encoded)
        target.flush()


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--session-id', help='Explicit local logind session, no automatic fallback')
    parser.add_argument('--max-request-bytes', type=int, default=1024 * 1024)
    parser.add_argument('--max-response-bytes', type=int, default=1024 * 1024)
    args = parser.parse_args()
    if not 256 <= args.max_request_bytes <= 16 * 1024 * 1024 or not 256 <= args.max_response_bytes <= 16 * 1024 * 1024:
        parser.error('byte limits must be between 256 and 16777216')
    try:
        backend = AtspiBackend(args.session_id)
    except ValueError as error:
        parser.error(str(error))
    serve(Session(backend=backend, max_response_bytes=args.max_response_bytes), sys.stdin.buffer, sys.stdout.buffer,
          args.max_request_bytes, args.max_response_bytes)
