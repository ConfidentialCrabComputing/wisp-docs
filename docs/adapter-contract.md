---
sidebar_position: 3
description: What an adapter turns into a Run, what /v1 gives it today, and what it does not.
---

# The adapter contract

The Runtime runs when it is called and stops when it is done. It owns no triggers, no
schedule and no messaging channel — you do, and you hand it one Run at a time. That line is
the whole design, and it is what keeps an adapter small. An adapter is a **stateless
translator**:

```
origin  → externalKey → Session
message → Run
outcome → send
```

Everything on the left of those arrows stays yours: the bot token, the polling or the
webhook, dedup, timers, retries, and the sending itself. Everything on the right is the
Runtime's: the Session and its memory, the Connectors, the Rules, the audit, and one
outcome per Run.

## The Session is named by your key

```http
POST /v1/sessions
Authorization: Bearer <token>

{ "projectRoot": "/srv/agents/incidents",
  "origin": "cli",
  "externalKey": "incident:4711",
  "title": "incident 4711" }
```

`201` the first time, `200` every time after — the same Session, looked up by the key. One
key names one Session and is never re-pointed, so a thread that has to start over gets a new
key rather than a new Session under the old one. That lookup is all the state an adapter
needs to not have: no table of your own mapping chats to Sessions.

The key is at most 256 characters, so hash anything unbounded — the CLI keys a folder as
`wisp-cli:<sha256 of the path>` for exactly that reason.

`origin` is `desktop` or `cli` and defaults to `desktop`. Send `cli`: it is what keeps your
Sessions out of the desktop's sidebar, and it is the honest one of the two until adapters
get a value of their own. It partitions the listing and nothing else — `GET /v1/sessions`
takes `?origin=` and every other operation takes an id and asks no origin.

`projectRoot` is the folder the agent works in, and it is the Session's Project for the
Session's life; a Run inherits it. See [Deploying an agent](./deploy-an-agent.md).

## A message is a Run

```http
POST /v1/sessions/{id}/runs

{ "input": "grafana: latency p99 back under 400ms for 10 minutes",
  "idempotencyKey": "incident-4711:evt-8824" }
```

The connection is held until the Run ends. The body takes exactly one of `input` and
`skill`:

- `input` — a string, or an array of content blocks (`text`, `image_url`, `file`,
  `pdf_text`);
- `skill` with optional `arguments` — one of the Project's named procedures, invoked the way
  the desktop types a slash line;
- `modelPreference` — optional;
- `confirmationMode` — `policy`, the only value phase 1 accepts;
- `idempotencyKey` — optional, and what makes a retry safe. See
  [Runs and restarts](./runs-and-restarts.md).

The answer is one JSON outcome:

```json
{ "runId": "…",
  "status": "completed",
  "output": { "text": "Latency has recovered…\n\nDraft for #ops: …" },
  "toolCalls": [ { "name": "mcp__chatstore__read_thread", "args": {}, "ok": true, "durationMs": 380 },
                 { "name": "mcp__chatstore__post_message", "args": {}, "ok": false, "durationMs": 1 } ],
  "usage": { "inputTokens": 8122, "outputTokens": 311, "totalTokens": 8433 },
  "artifacts": ["notes/4711.md"] }
```

`status` is `completed`, `failed` or `cancelled`, and a failed Run carries
`failure` with a `reason` from [the runbook](./runbook.md) and a message that never quotes
the conversation. `args` on a tool call is the audit's redacted shape, never the raw
arguments. `artifacts` are paths relative to the Project.

A tool the Rules did not allow is **not** a failure of the Run. Under `policy` an `ask`
resolves to a deny, the agent is told, and it continues — usually by drafting what it could
not send. The refused call is there in `toolCalls` with `ok: false`, and the Run completes.
That is the behaviour to design an adapter around: the Runtime drafts, you send.

## Follow-ups, cancel, and the two conflicts

A Session runs one Run at a time. A message that arrives while a Run is live **queues**
behind it, and its connection is held through the wait as through the Run itself — an
adapter does not have to serialise anything on its own side. `409` has exactly two causes:

- the Session's queue is full (`maxQueuedRunsPerSession`, ten by default) — back off, or drop
  the message the way your channel would;
- the same `idempotencyKey` arrived with a different request; the message names the key.

`POST /v1/sessions/{id}/cancel` ends the live Run and every Run queued behind it — `202`
when something was stopped, `204` when there was nothing to stop. There is no cancel of one
queued message.

## Reaching the Runtime

Every call carries `Authorization: Bearer <token>`, and the Runtime listens on loopback
only. `GET /v1/health` is the one exempt route, so an init system can probe before anything
holds a token.

An adapter on the same host reads the address and the token where the CLI reads them, out of
`$WISP_HOME/runtime.lock` — a `0600` file holding `url`, `token`, `pid`, `version` and
`kind` — rather than being configured with them a second time.

`GET /v1/openapi.json` is the document the CLI itself is tested against; generate your
client from it.

## What phase 1 does not give you

The rule of thumb: **the input and the Session are finished; a Run's progress, and anyone
answering it, are not.** If what you are missing is about what a Run says while it runs,
about a person approving something, or about reading a Run back after the connection is
gone, it is phase 2. If it is about how a message becomes a Session or a Run, it is here
today.

- **No progress stream.** One outcome per Run, and the held connection is the transport.
  Events — SSE with replay — arrive in phase 2. Render "working…" from your own side.
- **No `GET /v1/runs/{id}`.** The outcome is the response to the request that started the
  Run. If that connection drops, what is left is the Session's history
  (`GET /v1/sessions/{id}/history`) and your idempotency key.
- **No confirmation that reaches a person.** `policy` is the only Confirmation Mode:
  nothing runs that a Rule did not explicitly allow, and no caller can approve anything for
  the duration of a Run. `interactive` and `webhook` are phase 2, and they override
  downward only — a caller cannot talk a `policy` Runtime into either.
- **No `author` mark on a content block.** In phase 1 a Run's `input` is the account
  owner's own words, as it is for a script and for the CLI. A block gains an `author`
  (`owner` or `third_party`) later, and the kernel then puts third-party text through the
  same sanitiser and the same framing it applies to a connector's results. Until that
  exists, do not invent markup for it: a stranger's message you relay is read as the
  owner's, so either relay it knowing that or keep it out of the input.
- **No webhooks, no Service Tokens, no listener off loopback.** One token does everything,
  on the machine the Runtime runs on.

## Provenance

The kernel strips control, zero-width and bidirectional characters, and its own framing
tags, from every connector result, so nothing a tool returns can impersonate the transcript's
structure. What it cannot decide is **who wrote a line** — only a connector knows that. The
Telegram Connector marks it with `fromMe` on every message it returns; ask the MCP servers
you own to mark authorship the same way, as a field beside the text rather than a sentence
inside it. It is what lets the agent tell an instruction from a quotation of one.

## A scheduler is an adapter too

A scheduler creates a **fresh Session per fire** — a cron job is not a conversation — and
names each Run after the instant it fired for:

```sh
# every 15 minutes. \% escapes the % that crontab would otherwise eat.
*/15 * * * * cd /srv/agents/queue && ~/.wisp/bin/wisp run "check the queue and report anything stuck" --key "queue-check:$(date -u +\%Y-\%m-\%dT\%H:\%M)"
```

That line is the whole scheduler. `wisp run` with no Session creates one on the current
folder, waits, prints the answer and exits `0` or `1`. `--key` is the job id plus the
scheduled instant, so a re-fire of the same instant meets the Run it already started instead
of starting a second one. Every at-most-once mechanism stays in the scheduler; the Runtime
has none of its own.

One thing to set: a scheduled Run is usually the longest one a host does, and a restart
during it is a failed Run unless the drain window covers it — see
[Runs and restarts](./runs-and-restarts.md).

Next: [the incident bot](./incident-bot.md), the whole contract as something you can run.
