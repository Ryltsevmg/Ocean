"""Notification subscriptions retain runtime termination across registration and reads."""
from __future__ import annotations

import sys
from concurrent.futures import ThreadPoolExecutor

import pytest

from deepseek_harness import HarnessClient
from deepseek_harness.errors import TransportClosedError


def _exiting_client() -> HarnessClient:
    return HarnessClient(_launch_args=(
        sys.executable, "-u", "-c",
        'import sys; sys.stdin.readline(); print(\'{"jsonrpc":"2.0","method":"tick","params":{"value":1}}\')',
    ))


def _await_eof(client: HarnessClient) -> None:
    client.notify("exit")
    reader = client._reader_thread
    assert reader is not None
    reader.join(timeout=5)
    assert not reader.is_alive()


def test_subscriptions_created_after_eof_keep_rejecting() -> None:
    client = _exiting_client()
    try:
        client.start()
        _await_eof(client)
        subscription = client.subscribe_notifications()
        for _ in range(2):
            with pytest.raises(TransportClosedError, match="stdout closed"):
                subscription.next(timeout_seconds=0.1)
        assert not client._notification_subscribers
    finally:
        client.close()


def test_eof_preserves_delivered_notifications_before_the_terminal_error() -> None:
    client = _exiting_client()
    subscription = client.subscribe_notifications()
    try:
        client.start()
        _await_eof(client)
        assert subscription.next(timeout_seconds=0.1).payload == {"value": 1}
        for _ in range(2):
            with pytest.raises(TransportClosedError):
                subscription.drain(lambda _notification: pytest.fail("unexpected notification"))
    finally:
        client.close()


def test_close_before_start_releases_existing_and_late_waiters() -> None:
    client = _exiting_client()
    subscription = client.subscribe_notifications()
    with ThreadPoolExecutor(max_workers=1) as executor:
        pending = executor.submit(subscription.next, timeout_seconds=1)
        client.close()
        with pytest.raises(TransportClosedError):
            pending.result(timeout=2)
    for handle in (subscription, client.subscribe_notifications()):
        for _ in range(2):
            with pytest.raises(TransportClosedError):
                handle.next(timeout_seconds=0.1)
    assert not client._notification_subscribers


def test_explicit_restart_keeps_old_subscriptions_terminal() -> None:
    client = _exiting_client()
    previous = client.subscribe_notifications()
    client.close()
    try:
        client.start()
        subscription = client.subscribe_notifications()
        _await_eof(client)
        assert subscription.next(timeout_seconds=0.1).method == "tick"
        with pytest.raises(TransportClosedError):
            previous.next(timeout_seconds=0.1)
    finally:
        client.close()
