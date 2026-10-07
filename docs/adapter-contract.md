---
description: How your code turns events into Runs over /v1, what it gets back, and what is not available yet.
---

# The adapter contract

An **adapter** is your code that connects Wisp to the outside world: a chat bot, a webhook
handler, a scheduler. Wisp has no triggers, schedules or messaging channels of its own. It
runs when it is called, one Run at a time, and returns the result.

That keeps an adapter small. It translates three things:

```
a conversation  → a Session   (looked up by your own key)
a message       → a Run
the Run's answer → whatever you send back
```

**Your side** keeps the bot token, polling or webhooks, deduplication, timers, retries, and
sending messages. **Wisp's side** keeps the Session and its history, connectors, Rules, the
audit, and one answer per Run.

## Connecting

The Runtime listens on `127.0.0.1` only. Every request carries
`Authorization: Bearer <token>`.

An adapter on the same machine reads the address and token from
`$WISP_HOME/runtime.lock`, exactly as the CLI does. It is a JSON file, readable only by its
owner, with `url`, `token`, `pid`, `version` and `kind`:

```sh
URL=$(jq -r .url ~/.wisp/runtime.lock)
TOKEN=$(jq -r .token ~/.wisp/runtime.lock)
```

The full API, with request and response schemas, is served at `GET /v1/openapi.json`. The
CLI is tested against it, so it is a good source for generating a client.

## One conversation is one Session

```http
POST /v1/sessions
Authorization: Bearer <token>
Content-Type: application/json

{ "projectRoot": "/srv/agents/incidents",
  "origin": "cli",
  "externalKey": "incident:4711",
  "title": "incident 4711" }
```

- **`externalKey`** is your own id for the conversation. The first call creates the Session
  and answers `201`; every later call with the same key returns the same Session with
  `200`. You do not need a table that maps your chats to Sessions. A key always points to
  the same Session; to start a conversation over, use a new key. At most 256 characters, so
  hash anything longer.
- **`projectRoot`** is the folder the agent works in for the whole life of the Session.
  See [Deploying an agent](./deploy-an-agent.md).
- **`origin`** is `desktop` (the default) or `cli`. Send `cli`: it keeps your Sessions out
  of Wisp Desktop's sidebar. It only affects listing, via `GET /v1/sessions?origin=`.

## A message is a Run

```http
POST /v1/sessions/{id}/runs
Content-Type: application/json

{ "input": "grafana: latency p99 back under 400ms for 10 minutes",
  "idempotencyKey": "incident-4711:evt-8824" }
```

The connection stays open until the Run ends. The body takes exactly one of `input` or
`skill`:

| Field | Meaning |
| --- | --- |
| `input` | a string, or an array of content blocks (`text`, `image_url`, `file`, `pdf_text`) |
| `skill`, `arguments` | run one of the Project's [Skills](./deploy-an-agent.md#what-the-folder-holds) |
| `modelPreference` | optional; a model id from `GET /v1/models`, or `tier:<name>` |
| `confirmationMode` | optional; `policy` (the default) or `interactive`, which the operator must allow in `confirmationModes` — see [approvals](#approvals) |
| `idempotencyKey` | optional; makes a retry safe, see [Runs and restarts](./runs-and-restarts.md#the-key) |

The answer is one JSON object:

```json
{ "runId": "…",
  "status": "completed",
  "output": { "text": "Latency has recovered…\n\nDraft for #ops: …" },
  "toolCalls": [ { "name": "mcp__telegram__get_messages", "args": {}, "ok": true, "durationMs": 380 },
                 { "name": "mcp__telegram__send_message", "args": {}, "ok": false, "durationMs": 1 } ],
  "usage": { "inputTokens": 8122, "outputTokens": 311, "totalTokens": 8433 },
  "artifacts": ["notes/4711.md"] }
```

- `status` is `completed`, `failed` or `cancelled`. A failed Run has a `failure` with a
  `reason` ([the list](./runbook.md#why-a-run-failed)) and a message that never quotes the
  conversation.
- `toolCalls[].args` is the redacted form from the audit, not the raw arguments.
- `artifacts` are files the Run wrote, relative to the Project folder.

### A refused tool is not a failed Run

Nobody approves tool calls during a `/v1` Run, so a tool without a Rule that allows it is
refused (see [Permissions](./permissions.md)). The agent is told and continues, usually by
drafting what it was not allowed to send. The refused call appears in `toolCalls` with
`ok: false`, and the Run still completes.

Design your adapter around this: **Wisp drafts, your adapter sends.**

## Approvals

With `confirmationMode: interactive`, a tool the Rules hold for a person does not fail:
the Run parks, and the waiting request answers at once:

```json
{ "runId": "…",
  "status": "parked",
  "confirmations": [ { "id": "…", "toolName": "mcp__telegram__send_message",
                       "toolCallId": "…", "args": { "…": "…" } } ] }
```

`args` is what the desktop's approval card shows, the recipient named by Wisp where a
connector names one. Answer each Prompt with
`POST /v1/runs/{runId}/confirmations/{id}` and `{ "decision": "approve" }` (or `deny`,
`allow_project`, `allow_global`). That request waits for the Run's next park or its end and
answers like the first one did; while another Prompt of the same step is still pending, it
answers at once with the Prompts left. A Prompt nobody answers within `confirmTimeoutMs` is
denied and the Run goes on. A Prompt already settled, or one that is not this Run's, is
`404`; read the Run with `GET /v1/runs/{id}`, which lists a parked Run's `confirmations`.

The operator decides whether any of this is possible: a Run naming a mode outside
`confirmationModes` is refused `403`, and the default allows `policy` alone.

## Follow-ups and cancelling

A Session runs one Run at a time. A message that arrives while a Run is going waits in a
queue, and its connection stays open while it waits. You do not have to serialise anything
yourself.

`409 Conflict` has exactly two causes:

- the Session's queue is full (`maxQueuedRunsPerSession`, 10 by default): back off, or drop
  the message;
- the same `idempotencyKey` came with a different request. The error names the key.

`POST /v1/sessions/{id}/cancel` stops the current Run and everything queued behind it. It
answers `202` when something was stopped and `204` when nothing was running. You cannot
cancel a single queued message.

## Health

`GET /v1/health` with the token returns the Runtime's state (`ready`, `login_required` and
so on; see [Troubleshooting](./runbook.md#the-five-states)). Without a token it still
answers `200` with an empty body, which is enough for a liveness probe. `GET /v1/ready`
answers whether the Runtime will accept a Run right now.

## Not available yet

What is there today: turning a message into a Session and a Run, reading a Run back by id
(`GET /v1/runs/{id}`, across restarts too) and following its Events while it works
(`GET /v1/runs/{id}/events`; see the [reference](./reference.md)), and a person approving
a tool mid-Run through the `interactive` mode. What is not there yet: the Prompts on the
Event stream — a parked Run's are read from the waiting request or `GET /v1/runs/{id}`.

- **No author marking on input.** Everything in `input` is treated as the account owner's
  own words. If you relay a message from someone else, the agent reads it as yours. Either
  relay it knowing that, or keep it out of the input.
- **No webhooks, no scoped tokens, no listening beyond loopback.** One token can do
  everything, on the machine the Runtime runs on. To reach it from elsewhere, tunnel to its
  loopback port.

## Who wrote what

Wisp strips control characters, invisible characters and its own framing tags from every
connector result, so a tool's output cannot pretend to be part of the conversation's
structure. What Wisp cannot know is **who wrote** a piece of text; only the connector knows
that. The Telegram connector marks every message with `fromMe`. If you write MCP servers,
mark authorship the same way, as a field next to the text, so the agent can tell an
instruction from a quote of one.

## A scheduler is an adapter too

A scheduled job should create a fresh Session each time it fires; a cron job is not a
conversation. Name each Run after the moment it was scheduled for:

```sh
# every 15 minutes. \% escapes the % that crontab would otherwise eat.
*/15 * * * * cd /srv/agents/queue && ~/.wisp/bin/wisp run "check the queue and report anything stuck" --key "queue-check:$(date -u +\%Y-\%m-\%dT\%H:\%M)"
```

That line is the whole scheduler. `wisp run` without a Session starts one in the current
folder, waits, prints the answer and exits `0` or `1`. Because `--key` is the job name plus
the scheduled minute, a job that fires twice for the same minute joins the first Run
instead of starting a second.

Scheduled Runs are often the longest a machine does. Make sure a restart's drain window
covers them; see [Runs and restarts](./runs-and-restarts.md#the-drain-window).

Next: [the incident bot](./incident-bot.md), the whole contract as something you can run.
