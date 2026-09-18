---
sidebar_position: 6
description: A Run is at-most-once; the idempotency key is what makes it effectively-once.
---

# Runs, restarts and the key

## A Run is at-most-once

The Runtime never repeats a Run of its own accord, and it never persists one. The outcome is
the response to the request that started the Run; a Run belongs to the Runtime that started
it, and a Runtime that stops takes every Run it had in flight with it. The Session's history
stays — it is on disk — but the answer to a lost connection is gone, even where the turn
itself finished and was written.

So repeating is the caller's decision, always. The idempotency key is what makes repeating
safe.

## The key

`idempotencyKey` on the Run body, `--key` on `wisp run`, at most 256 characters. Beside each
key the Runtime keeps a fingerprint of the request — the Session, the input (or the expanded
skill line) and the model preference — and then:

- a repeat **while the Run is live** joins it and waits on the same outcome: two requests,
  one Run, one `runId`;
- a repeat **after it ended** gets the stored outcome, with no second turn in the Session's
  history;
- the same key with a **different** request is `409` and starts nothing.

Keys live for `idempotencyTtlMs` — 24 hours — in a bounded in-memory map whose oldest
entries are evicted first. **After a restart that map is empty**, and a repeat starts a new
Run. That is the contract rather than an oversight: at-most-once from the Runtime's side,
effectively-once when the Integrator names its Runs. Durable Run records and keys arrive in
phase 2.

The shape of a retry: on a dropped connection, wait until `GET /v1/health` says `ready`
(`wisp status`), then resend the identical request with the identical key.

## What a stop does

A stop request — `SIGTERM` on Linux and macOS; on Windows the service stop, which WinSW
delivers as Ctrl+C and Node raises as `SIGINT` — starts a drain:

1. every **queued** Run settles at once, `failed` with `failure.reason: shutdown`, so
   nothing is left waiting on a connection the Runtime has already walked away from;
2. every **active** Run gets the whole window, and one that finishes inside it completes
   normally with its transcript on disk;
3. an active Run that outlives the window is aborted, also `failed` with `shutdown`;
4. connectors disconnect and the stores close.

`wisp stop` is what sends it. It reads the pid from `$WISP_HOME/runtime.lock` and signals
it rather than calling `/v1`: a stop endpoint would let any token holder take the Runtime
down, which is more than the desktop's own chat can do. It refuses when the lock names the
desktop's sidecar — quit the desktop instead.

## The window, and the service

`shutdownDrainTimeoutMs` (`SHUTDOWN_DRAIN_TIMEOUT_MS`), five seconds by default. Five
seconds is a chat turn, not a scheduled Run: set it to the longest Run this host actually
does, or a planned restart will fail that Run with `shutdown`.

The service's stop timeout has to be **longer** than the window, or the init system kills
the process mid-drain and the partial output the drain was saving is lost anyway. The
installer's user unit does that for you — it reads the window from where the Runtime will
read it and writes the timeout as the window plus five seconds:

```ini
[Service]
ExecStart=/home/you/.wisp/bin/wisp serve
Environment=WISP_HOME=/home/you/.wisp
Restart=on-failure
RestartPreventExitStatus=78
TimeoutStopSec=10000ms
```

`RestartPreventExitStatus=78` is there because 78 is a misconfiguration, never a crash:
restarting loops over the same refusal and buries the one line in the journal that says what
to fix. See [the runbook](./runbook.md).

To change the window later, set `shutdownDrainTimeoutMs` in `runtime.json` and re-run the
installer with `WISP_SERVICE=1` — it rewrites the unit from the same value — or edit
`TimeoutStopSec` yourself and `systemctl --user daemon-reload`.

## Concurrency

- One active Run per Session. The rest queue, bounded by `maxQueuedRunsPerSession` (ten),
  and only above that bound is the answer `409`.
- `maxConcurrentRuns` (three) across the whole Runtime; beyond it a Run waits for a slot
  with its caller's connection held, exactly as it waits in a Session's queue.
- `wisp cancel <session>`, or `POST /v1/sessions/{id}/cancel`, ends the live Run and
  everything queued behind it, each `cancelled`. Cancel is per Session; there is no cancel
  of one queued message.

A Session idle for days costs nothing and survives restarts; its thread is rebuilt from the
transcript on the next Run, and `checkpointerMaxIdleThreads` caps how many stay warm.
