"""Synthetic-only coverage: never connects to a desktop or accessibility bus."""
import importlib.util
import io
import json
from pathlib import Path
import sys
import unittest

spec = importlib.util.spec_from_file_location('ocean_atspi', Path(__file__).parents[2] / 'native/helper.py')
helper = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = helper
spec.loader.exec_module(helper)


class Node:
    def __init__(self, path, name='', role='button', parent=None, protected=False, actions=None):
        self.path, self.name, self.role, self.parent = path, name, role, parent
        self.protected = protected
        self.actions = actions or []
        self.children = []
        self.dead = False
        self.enabled = True
        self.pid = parent.pid if parent else 22
        self.owner = parent.owner if parent else self
        self.bus = parent.bus if parent else ':1.22'
        if parent:
            parent.children.append(self)


class Fake:
    def __init__(self):
        self.root = Node('/app', 'Editor', 'application')
        self.window = Node('/win', 'Test', 'frame', self.root)
        self.button = Node('/button', 'Save', parent=self.window, actions=['click'])
        self.secret = Node('/secret', 'SUPER-SECRET', 'password', self.window, True)
        Node('/secret/child', 'NESTED-SECRET', parent=self.secret)
        self.calls = []
        self.available = True
        self.lock_state = False
        self.ident = (22, 'start', '/usr/bin/fake', 1, 2)

    def ready(self): return self.available
    def locked(self): return self.lock_state
    def refresh(self, node): pass
    def apps(self): return [self.root]
    def key(self, node): return node.bus, node.path
    def pid(self, node): return node.pid
    def name(self, node): return node.name
    def role(self, node): return node.role
    def protected(self, node): return node.protected
    def stale(self, node): return node.dead
    def enabled(self, node): return node.enabled
    def application(self, node): return node.owner
    def parent(self, node): return node.parent
    def children(self, node, maximum): return node.children[:maximum], len(node.children) > maximum
    def bounds(self, node): return dict(x=0, y=0, width=500, height=300)
    def showing(self, node): return True
    def actions(self, node): return list(node.actions)
    def perform(self, node, index):
        self.calls.append((node.path, index))
        return True


class HelperTest(unittest.TestCase):
    def setUp(self):
        self.backend = Fake()
        self.session = helper.Session(self.backend, lambda pid: self.backend.ident)
        self.selected = self.session.dispatch('getApp', {'selector': '22'})
        self.handle = self.selected['appHandle']

    def observe(self, **extra):
        return self.session.dispatch('getState', {'appHandle': self.handle, **extra})

    def target(self, snapshot):
        selected = self.session.apps[self.handle]
        eid = next(key for key, value in selected.elements.items() if value[0] is self.backend.button)
        params = dict(appHandle=self.handle, snapshotId=snapshot['snapshotId'], elementId=eid)
        if snapshot['windowId'] is not None:
            params['windowId'] = snapshot['windowId']
        return params

    def failure(self, code, fn):
        with self.assertRaises(helper.Failure) as ctx:
            fn()
        self.assertEqual(ctx.exception.code, code)

    def test_discovery_does_not_read_children(self):
        def no_tree(*_): raise AssertionError('read before consent')
        self.backend.children = no_tree
        self.assertEqual(self.session.dispatch('listApps', {})[0]['pid'], 22)
        selected = self.session.dispatch('getApp', {'selector': '22'})
        self.assertFalse(selected['authorization']['persistable'])
        self.assertEqual(len(selected['authorization']['id']), 64)

    def test_exact_pid_does_not_read_other_app_names(self):
        other = Node('/other', 'PRIVATE')
        other.pid = 99
        self.backend.apps = lambda: [other, self.backend.root]
        def name(node):
            if node is other:
                raise AssertionError('Unselected app name read')
            return node.name
        self.backend.name = name
        self.assertEqual(self.session.dispatch('getApp', {'selector': '22'})['name'], 'Editor')

    def test_exact_pid_only(self):
        self.failure('APP_UNAVAILABLE', lambda: self.session.dispatch('getApp', {'selector': 'Editor'}))

    def test_tree_and_password_subtree_redacted(self):
        result = self.observe()
        self.assertIn('Save', result['tree'])
        self.assertIn('[protected content]', result['tree'])
        self.assertNotIn('SECRET', result['tree'])
        self.assertNotIn('/secret', str(self.session.apps[self.handle].elements))

    def test_action_dispatch_once_then_snapshot_invalid(self):
        params = self.target(self.observe())
        self.assertEqual(self.session.dispatch('listActions', params), ['click'])
        self.assertEqual(self.session.dispatch('invoke', params), {'dispatched': True})
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))
        self.assertEqual(self.backend.calls, [('/button', 0)])

    def test_cross_process_and_cross_handle_denied(self):
        params = self.target(self.observe())
        other = helper.Session(self.backend, lambda pid: self.backend.ident)
        self.failure('APP_UNAVAILABLE', lambda: other.dispatch('invoke', params))
        params['appHandle'] = self.session.dispatch('getApp', {'selector': '22'})['appHandle']
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))
        self.assertFalse(self.backend.calls)

    def test_process_reuse_invalidates_handle(self):
        params = self.target(self.observe())
        self.backend.ident = (22, 'new-start', '/usr/bin/fake', 1, 2)
        self.failure('APP_UNAVAILABLE', lambda: self.session.dispatch('invoke', params))

    def test_reparent_and_stale_references_denied(self):
        params = self.target(self.observe())
        self.backend.button.parent = self.backend.secret
        self.failure('PROTECTED_CONTENT', lambda: self.session.dispatch('invoke', params))
        self.backend.button.parent = self.backend.window
        self.backend.button.dead = True
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))

    def test_cross_application_reparent_denied(self):
        params = self.target(self.observe())
        other = Node('/other', 'Other', 'application')
        other.bus = ':1.99'
        self.backend.button.owner = other
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))

    def test_changed_label_action_or_window_denied(self):
        params = self.target(self.observe())
        self.backend.button.name = 'Delete'
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))
        params = self.target(self.observe())
        self.backend.button.actions = ['delete']
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))
        params = self.target(self.observe())
        params['windowId'] = 'unrelated'
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))

    def test_element_moved_to_another_window_denied(self):
        wid = self.session.dispatch('listWindows', {'appHandle':self.handle})[0]['windowId']
        params = self.target(self.observe(windowId=wid))
        other_window = Node('/win2', 'Other', 'frame', self.backend.root)
        self.backend.button.parent = other_window
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))
        self.assertFalse(self.backend.calls)

    def test_wide_tree_keeps_pending_bounded(self):
        for i in range(50):
            parent = Node(f'/wide{i}', 'Wide', 'group', self.backend.window)
            for j in range(50):
                Node(f'/wide{i}/{j}', 'Leaf', parent=parent)
        observed = []
        original = self.backend.children
        def bounded(node, maximum):
            observed.append(maximum)
            return original(node, maximum)
        self.backend.children = bounded
        result = self.observe(maxElements=100)
        self.assertTrue(result['truncated'])
        self.assertLessEqual(len(result['tree'].splitlines()), 100)
        self.assertTrue(all(value <= 128 for value in observed))

    def test_explicit_actions_only_and_no_arguments(self):
        params = self.target(self.observe())
        self.failure('UNSUPPORTED', lambda: self.session.dispatch('performAction', {**params, 'action':'delete'}))
        self.failure('UNSUPPORTED', lambda: self.session.dispatch('performAction', {**params, 'action':'click', 'argument':'x'}))
        self.backend.button.enabled = False
        self.failure('UNSUPPORTED', lambda: self.session.dispatch('invoke', params))
        self.assertFalse(self.backend.calls)

    def test_uncertain_action_consumes_snapshot(self):
        params = self.target(self.observe())
        def uncertain(*_): raise RuntimeError('remote app content')
        self.backend.perform = uncertain
        with self.assertRaises(RuntimeError): self.session.dispatch('invoke', params)
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))

    def test_limits_depth_node_and_escaped_labels(self):
        self.backend.button.name = 'Save\n[forged] row'
        result = self.observe(maxDepth=1)
        self.assertTrue(result['truncated'])
        self.assertNotIn('Save', result['tree'])
        result = self.observe(maxElements=2)
        self.assertEqual(len(result['tree'].splitlines()), 2)
        self.assertTrue(result['truncated'])
        result = self.observe()
        self.assertNotIn('\n[forged]', result['tree'])
        self.failure('INVALID_REQUEST', lambda: self.observe(maxElements=True))

    def test_unsupported_controls_no_actions(self):
        for method in ['click','typeText','screenshot','paste','activate','launchApp','requestPermission','openPermissionSettings']:
            self.failure('UNSUPPORTED', lambda: self.session.dispatch(method, {'appHandle':self.handle}))
        self.assertFalse(self.backend.calls)

    def test_permission_truth_not_assumed(self):
        self.backend.available = False
        caps = self.session.dispatch('getCapabilities', {})
        self.assertFalse(caps['permissions']['accessibility'])
        self.assertFalse(caps['permissions']['screenRecording'])
        self.assertEqual(self.session.dispatch('permissionStatus', {})['platform'], 'linux')

    def test_jsonl_limits_cancel_and_sanitized_errors(self):
        req = {'id':'a','method':'getState','params':{'appHandle':self.handle}}
        self.backend.children = lambda *_: (_ for _ in ()).throw(RuntimeError('PRIVATE'))
        out = io.BytesIO()
        helper.serve(self.session, io.BytesIO(json.dumps(req).encode()+b'\n'), out, 4096, 4096)
        self.assertNotIn(b'PRIVATE',out.getvalue())
        self.assertEqual(json.loads(out.getvalue())['error']['code'], 'ATSPI_FAILURE')
        for data in (b'x'*4097, b'{"type":"cancel","id":"a"}\n',b'{"id":"unfinished"}'):
            out = io.BytesIO()
            helper.serve(self.session, io.BytesIO(data), out, 4096, 4096)
            self.assertEqual(out.getvalue(), b'')

    def test_large_labels_not_retained_and_tail_changes_rejected(self):
        self.backend.button.name = 'x' * 2_000_000
        self.backend.button.role = 'r' * 1_000_000
        params = self.target(self.observe())
        record = self.session.apps[self.handle].elements[params['elementId']]
        self.assertEqual(len(record[2]), 32)
        self.assertEqual(len(record[3]), 32)
        self.backend.button.name += 'z'
        self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))

    def test_ancestor_refresh_detects_password_reparent(self):
        params = self.target(self.observe())
        refreshed = []
        def refresh(node):
            refreshed.append(node.path)
            if node is self.backend.window:
                node.protected = True
        self.backend.refresh = refresh
        self.failure('PROTECTED_CONTENT', lambda: self.session.dispatch('invoke', params))
        self.assertIn('/win', refreshed)
        self.assertFalse(self.backend.calls)

    def test_locked_unknown_block_discovery_observation_and_action(self):
        for locked, code in ((True, 'SESSION_LOCKED'), (None, 'SESSION_UNAVAILABLE')):
            self.backend.lock_state = False
            params = self.target(self.observe())
            self.backend.lock_state = locked
            self.assertEqual(self.session.dispatch('getCapabilities', {})['sessionLocked'], locked)
            self.assertTrue(self.session.dispatch('permissionStatus', {})['accessibility'])
            for method, arguments in [('listApps', {}), ('findApps', {'query':'Editor'}),
                                      ('getApp', {'selector':'22'}), ('getState', {'appHandle':self.handle}),
                                      ('listWindows', {'appHandle':self.handle}), ('invoke', params)]:
                self.failure(code, lambda: self.session.dispatch(method, arguments))
            self.assertFalse(self.backend.calls)
            self.backend.lock_state = False
            self.failure('STALE_REFERENCE', lambda: self.session.dispatch('invoke', params))

    def test_lock_during_observation_discards_result(self):
        original = self.backend.children
        def children(node, maximum):
            result = original(node, maximum)
            self.backend.lock_state = True
            return result
        self.backend.children = children
        self.failure('SESSION_LOCKED', self.observe)
        self.assertIsNone(self.session.apps[self.handle].snapshot)

    def test_logind_facts_require_same_active_local_graphical_user(self):
        good = dict(User=(1000, '/user/1000'), Type='wayland', Active=True, Remote=False, LockedHint=False)
        self.assertIs(helper.session_locked(good, 1000), False)
        for key in good:
            missing = dict(good)
            del missing[key]
            self.assertIsNone(helper.session_locked(missing, 1000))
        for key, value in [('Active', False), ('Remote', True), ('LockedHint', True)]:
            self.assertIs(helper.session_locked({**good, key:value}, 1000), True)
        for key, value in [('Active', 1), ('Remote', 0), ('LockedHint', 'false'), ('Type', 'tty'),
                           ('User', (1001, '/user/1001'))]:
            self.assertIsNone(helper.session_locked({**good, key:value}, 1000))
        self.assertIsNone(helper.session_locked(None, 1000))

    def test_response_limit(self):
        self.backend.root.name = 'x'*500
        out = io.BytesIO()
        req = {'id':'a','method':'listApps','params':{}}
        helper.serve(self.session, io.BytesIO(json.dumps(req).encode()+b'\n'), out, 4096, 256)
        self.assertLessEqual(len(out.getvalue()), 256)
        self.assertEqual(json.loads(out.getvalue())['error']['code'], 'RESOURCE_LIMIT')


class FakeLogind:
    def __init__(self):
        self.rows = [('c1', 1000, 'user', 'seat0', '/session/c1')]
        self.props = {'/session/c1': dict(Id='c1', User=(1000, '/user/1000'), Type='wayland',
                                        Active=True, Remote=False, LockedHint=False,
                                        Seat=('seat0', '/seat/seat0'), TimestampMonotonic=100)}
        self.pid_calls = []
        self.list_calls = 0

    def by_pid(self, pid):
        self.pid_calls.append(pid)
        return dict(self.props['/session/c1'])

    def sessions(self):
        self.list_calls += 1
        return list(self.rows)

    def properties(self, path):
        return dict(self.props[path])


class ExplicitSessionTest(unittest.TestCase):
    def setUp(self):
        self.logind = FakeLogind()
        self.guard = helper.SessionGuard('c1', self.logind, uid=1000, pid=99)

    def test_default_uses_pid_without_list_or_fallback(self):
        default = helper.SessionGuard(None, self.logind, uid=1000, pid=99)
        self.assertIs(default.locked(), False)
        self.assertEqual(self.logind.pid_calls, [99])
        self.assertEqual(self.logind.list_calls, 0)
        self.logind.by_pid = lambda _: (_ for _ in ()).throw(RuntimeError())
        self.assertIsNone(default.locked())
        self.assertEqual(self.logind.list_calls, 0)

    def test_explicit_uses_list_not_pid_and_rechecks_each_call(self):
        self.assertIs(self.guard.locked(), False)
        self.logind.props['/session/c1']['LockedHint'] = True
        self.assertIs(self.guard.locked(), True)
        self.logind.props['/session/c1']['LockedHint'] = False
        self.assertIs(self.guard.locked(), False)
        self.assertEqual(self.logind.pid_calls, [])
        self.assertEqual(self.logind.list_calls, 3)

    def add_session(self, identity='c2', kind='wayland', uid=1000, **properties):
        path = '/session/' + identity
        self.logind.rows.append((identity, uid, 'user', 'seat0', path))
        self.logind.props[path] = {**self.logind.props['/session/c1'],
                                  'Id':identity, 'Type':kind, 'User':(uid, '/user/' + str(uid)),
                                  'TimestampMonotonic':200, **properties}

    def test_other_graphical_session_counts_even_inactive_or_remote(self):
        for facts in ({}, {'Active':False}, {'Remote':True}):
            self.setUp()
            self.add_session(**facts)
            self.assertIsNone(self.guard.locked())
        self.setUp()
        self.add_session(kind='x11', Active=False, Remote=True)
        self.assertIsNone(self.guard.locked())

    def test_tty_or_other_user_does_not_count(self):
        self.add_session(kind='tty')
        self.add_session('c3', uid=2000)
        self.assertIs(self.guard.locked(), False)

    def test_chosen_session_wrong_uid_or_not_graphical_denied(self):
        self.logind.props['/session/c1']['User'] = (2000, '/user/2000')
        self.assertIsNone(self.guard.locked())
        self.setUp()
        self.logind.rows[0] = ('c1', 2000, 'other', 'seat0', '/session/c1')
        self.assertIsNone(self.guard.locked())
        self.setUp()
        self.logind.props['/session/c1']['Type'] = 'tty'
        self.assertIsNone(self.guard.locked())

    def test_missing_or_unknown_properties_deny(self):
        for field in ('Id', 'User', 'Type', 'Active', 'Remote', 'LockedHint', 'Seat', 'TimestampMonotonic'):
            self.setUp()
            del self.logind.props['/session/c1'][field]
            self.assertIsNone(self.guard.locked(), field)
        self.setUp()
        self.add_session(kind='unknown')
        self.assertIsNone(self.guard.locked())
        self.setUp()
        self.logind.properties = lambda _: (_ for _ in ()).throw(RuntimeError())
        self.assertIsNone(self.guard.locked())

    def test_seat_required_and_timestamp_strict(self):
        for seat in (('', '/'), None, 'seat0', ('seat0', 'bad')):
            self.setUp()
            self.logind.props['/session/c1']['Seat'] = seat
            self.assertIsNone(self.guard.locked())
        for timestamp in (None, True, 0, -1, '100'):
            self.setUp()
            self.logind.props['/session/c1']['TimestampMonotonic'] = timestamp
            self.assertIsNone(self.guard.locked())

    def test_removed_session_poisoned_after_pin_even_when_reappears(self):
        self.assertIs(self.guard.locked(), False)
        row = self.logind.rows.pop()
        self.assertIsNone(self.guard.locked())
        self.logind.rows.append(row)
        self.assertIsNone(self.guard.locked())

    def test_reused_session_or_changed_seat_poisoned_lifetime(self):
        for field, value in [('Id','other'), ('TimestampMonotonic',200), ('Seat',('seat1','/seat/seat1'))]:
            self.setUp()
            self.assertIs(self.guard.locked(), False)
            old = self.logind.props['/session/c1'][field]
            self.logind.props['/session/c1'][field] = value
            self.assertIsNone(self.guard.locked())
            self.logind.props['/session/c1'][field] = old
            self.assertIsNone(self.guard.locked())

    def test_unreadable_current_user_session_denies(self):
        self.add_session(kind='tty')
        del self.logind.props['/session/c2']
        self.assertIsNone(self.guard.locked())

    def test_malformed_list_rows_and_duplicates_deny(self):
        for row in (None, ('short',), ('c2', '1000', 'user', 'seat0', '/session/c2'),
                    ('c2', 1000, 'user', 'seat0', 'relative')):
            self.setUp()
            self.logind.rows.append(row)
            self.assertIsNone(self.guard.locked())
        self.setUp()
        self.logind.rows.append(self.logind.rows[0])
        self.assertIsNone(self.guard.locked())

    def test_ambiguity_after_pin_poisoned_even_if_replacement_hidden(self):
        self.assertIs(self.guard.locked(), False)
        self.add_session()
        self.logind.props['/session/c1']['TimestampMonotonic'] = 300
        self.assertIsNone(self.guard.locked())
        self.logind.rows.pop()
        self.logind.props['/session/c1']['TimestampMonotonic'] = 100
        self.assertIsNone(self.guard.locked())

    def test_confirmed_non_graphical_user_manager_excluded(self):
        self.add_session('manager', kind='unspecified', Class='manager', Seat=('', '/'))
        row = self.logind.rows[-1]
        self.logind.rows[-1] = (*row[:3], '', row[4])
        self.assertIs(self.guard.locked(), False)

    def test_conflicting_manager_seat_is_rejected(self):
        self.add_session('manager', kind='unspecified', Class='manager', Seat=('', '/'))
        self.assertIsNone(self.guard.locked())

    def test_unspecified_or_bad_manager_facts_do_not_count_as_safe(self):
        for facts in ({}, {'Class':'user'}, {'Class':'unknown'}, {'Class':'manager', 'Remote':True},
                      {'Class':'manager', 'Seat':('seat0','/seat/seat0')}):
            self.setUp()
            self.add_session('manager', kind='unspecified', **facts)
            self.assertIsNone(self.guard.locked())

    def test_valid_id_syntax_bounded(self):
        for value in ('', 'x' * 65, '../c1', 'c1\n', 'c1 c2'):
            with self.assertRaises(ValueError):
                helper.SessionGuard(value, self.logind, uid=1000, pid=99)


if __name__ == '__main__': unittest.main()
