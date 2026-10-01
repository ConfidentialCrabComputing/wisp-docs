---
description: What happens to a Run when the connection drops or the Runtime restarts, and how idempotency keys make retries safe.
---

# Runs and restarts

## A Run happens at most once

Wisp never retries a Run on its own, and it does not save Runs to disk. A Run's answer is
the response to the request that started it. If that connection drops, or the Runtime
stops, the answer is gone. The Session's history is on disk and survives, even when the
turn itself finished.

So retrying is always the caller's decision. The idempotency key is what makes a retry
safe.

## The key

Set `idempotencyKey` in the Run's body, or `--key` on `wisp run`. At most 256 characters.
The Runtime remembers each key together with what was asked (the Session, the input or
Skill, and the model preference). Then:

- **a repeat while the Run is still going** joins it: two requests, one Run, the same
  answer;
- **a repeat after it ended** gets the stored answer, and the Session's history does not
  get a second turn;
- **the same key with a different request** is refused with `409`, and nothing runs.

Keys are kept in memory for `idempotencyTtlMs` (24 hours), and the oldest are dropped first
when there are many. **A restart forgets every key**, so a repeat after a restart starts a
new Run.

How to retry after a dropped connection: wait until `wisp status` (or `GET /v1/health`)
says `ready`, then send the identical request with the identical key.

## What stopping does

`wisp stop`, `SIGTERM`, Ctrl-C and a service stop all start a **drain**:

1. Runs waiting in a queue end at once as `failed`, with `failure.reason: shutdown`.
2. Runs already going get the whole drain window to finish. One that finishes in time
   completes normally.
3. A Run still going when the window ends is stopped, also `failed` with `shutdown`.
4. Connectors disconnect and the stores close.

`wisp stop` finds the Runtime's process id in `$WISP_HOME/runtime.lock` and signals it. On
purpose there is no "stop" endpoint in `/v1`: a token should not be enough to take the
Runtime down. `wisp stop` refuses to stop Wisp Desktop's Runtime; quit the app instead.

## The drain window

`shutdownDrainTimeoutMs` sets the window, 5 seconds by default. That is enough for a chat
reply, not for a long scheduled job. Set it to the longest Run this machine does, or a
planned restart will fail that Run with `shutdown`.

The service manager must wait longer than the window, or it kills the Runtime in the middle
of draining. The installer handles this: it reads the window from your configuration and
sets the service's stop timeout to the window plus 5 seconds (`TimeoutStopSec` for systemd,
`ExitTimeOut` for launchd).

If you change the window later, run the installer again with `WISP_SERVICE=1` so it
rewrites the service with the new value. On Linux you can instead edit `TimeoutStopSec` in
`~/.config/systemd/user/wisp.service` and run `systemctl --user daemon-reload`.

## Concurrency

- **One Run per Session at a time.** Others wait in the Session's queue, up to
  `maxQueuedRunsPerSession` (10). Beyond that, a new Run is refused with `409`.
- **`maxConcurrentRuns` (3) across the whole Runtime.** Beyond it, a Run waits for a free
  slot, its connection held open, just as it waits in a Session's queue.
- **Cancelling is per Session.** `wisp cancel <session>` or `POST /v1/sessions/{id}/cancel`
  stops the current Run and everything queued behind it, each `cancelled`.

A Session that sits idle for days costs nothing and survives restarts.
