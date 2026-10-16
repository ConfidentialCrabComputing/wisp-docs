---
description: What happens to a Run when the connection drops or the Runtime restarts, and how idempotency keys make retries safe.
---

# Runs and restarts

## A Run happens at most once

Wisp never retries a Run on its own. It does keep a record of every Run on disk, with its
status and, once it ended, its outcome. If the connection that started a Run drops, the
Run goes on, and `GET /v1/runs/{runId}` (or `wisp runs show`) reads its answer afterwards —
after a restart too. A Run the Runtime stopped in the middle reads `failed` with
`failure.reason: shutdown`, a Run parked on a Prompt among them. Records are kept for
`runRecordRetentionMs` (7 days).

So retrying is always the caller's decision: `POST /v1/runs/{runId}/retry` (or
`wisp retry`) runs a failed or cancelled Run's message again. The idempotency key is what
makes sending the same request twice safe.

## The key

Set `idempotencyKey` in the Run's body, or `--key` on `wisp run`. At most 256 characters.
The Runtime remembers each key together with what was asked (the Session, the input or
Skill, and the model preference). Then:

- **a repeat while the Run is still going** joins it: two requests, one Run, the same
  answer;
- **a repeat while the Run is parked** on a Prompt answers at once with the pending
  Prompts, so a lost park response does not leave you waiting on Prompts only you answer;
- **a repeat after it ended** gets the stored answer, and the Session's history does not
  get a second turn;
- **the same key with a different request** is refused with `409`, and nothing runs.

A key lives in the Run's record for `idempotencyTtlMs` (24 hours), **restarts included**: a
repeat after a restart finds its Run and starts nothing new — except a Run a shutdown ended
while it still waited in its queue: nothing of it ran, so the repeat runs it. With `"wait": false` a repeat
answers `202` with the same `runId` and the Run's status now.

How to retry after a dropped connection: wait until `wisp status` (or `GET /v1/health`)
says `ready`, then send the identical request with the identical key.

## What stopping does

`wisp stop`, `SIGTERM`, Ctrl-C and a service stop all start a **drain**:

1. Runs waiting in a queue end at once as `failed`, with `failure.reason: shutdown`.
2. Runs already going get the whole drain window to finish. One that finishes in time
   completes normally.
3. A Run still going when the window ends is stopped, also `failed` with `shutdown`.
4. Connectors disconnect and the stores close.

`wisp stop` finds the Runtime's process id in `$WISP_HOME/runtime.lock` and signals it,
then returns without waiting for the drain. It works only through the lock, so it refuses
while `WISP_URL` or `WISP_TOKEN` is set. On
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

## Scheduled Runs and restarts

A schedule fires each instant at most once. The Runtime writes the job's next instant to
disk before it starts the fire, and gives the fire's Run the key `<scheduleId>:<instant>`,
so neither a crash nor a restart fires an instant twice. A drain fires nothing: the
scheduler stops when the drain starts.

A fire already going when you stop the Runtime is a Run like any other: it gets the drain
window and is failed with `shutdown` if it outlives it. Fires are not retried. So before a
planned restart such as `wisp update`, set `shutdownDrainTimeoutMs` to at least your
longest scheduled job, say `600000` for a ten-minute nightly report, and run the installer
again with `WISP_SERVICE=1` so the service waits that long too.

While the Runtime is down, nothing fires. When it is back:

- a recurring job fires its latest missed instant once, if that instant is late by no more
  than half the job's period, kept between 2 minutes and 2 hours. A 09:00 daily job is back
  in time until 11:00;
- later than that, it skips to its next instant;
- missed instants never pile up: a week down is one fire at most;
- a one-off job fires once, however late.

The job's `lastOutcome` records how many instants were skipped as `skipped`, with or without
a fire.

## Concurrency

- **One Run per Session at a time.** Others wait in the Session's queue, up to
  `maxQueuedRunsPerSession` (10). Beyond that, a new Run is refused with `409`.
- **`maxConcurrentRuns` (3) across the whole Runtime.** Beyond it, a Run waits for a free
  slot, its connection held open, just as it waits in a Session's queue.
- **Cancelling is per Session.** `wisp cancel <session>` or `POST /v1/sessions/{id}/cancel`
  stops the current Run and everything queued behind it, each `cancelled`.

A Session that sits idle for days costs nothing and survives restarts.
