---
description: How your code turns events into Runs over /v1, what it gets back, and what is not available yet.
---

# The adapter contract

An **adapter** is your code that connects Wisp to the outside world: a chat bot, a webhook
handler, a scheduler. Wisp ships a few of its own — [schedules](./reference.md#schedules), a
[Telegram bot](./telegram-bot.md) and a [Slack app](./slack-app.md) —
and they use this same contract. Anything else is yours to write: Wisp runs when it is
called, one Run at a time, and returns the result.

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

The Runtime listens on `127.0.0.1` unless you [open it to another
machine](./remote-access.md#reaching-it-from-another-machine). Every request carries
`Authorization: Bearer <token>`: the one token, a named `full` token, or a `run` token made
for an adapter (see [Tokens for an adapter](#tokens-for-an-adapter)).

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
- **`origin`** is `desktop` (the default), `cli`, `telegram`, `slack` or `schedule`. Send
  `cli`: it keeps your Sessions out of Wisp Desktop's sidebar. It only affects listing, via
  `GET /v1/sessions?origin=`.

A Session without `projectRoot` works on a Desk, a folder of its own; see
[Sessions and Projects](./sessions-and-projects.md).

### Naming the Project again

The Runtime keeps Sessions in memory and finds a Desk Session again on its own, but it does
not remember which folder a Project Session's Project is in. Once it has dropped such a
Session from memory, after a restart for instance, the Session's routes answer `404` unless
the request names the folder again in the query:

```http
POST /v1/sessions/{id}/runs?projectRoot=/srv/agents/incidents
```

`GET /v1/sessions/{id}/history`, `PATCH /v1/sessions/{id}`, `POST /v1/sessions/{id}/runs`,
`POST /v1/sessions/{id}/cancel` and `POST /v1/runs/{runId}/retry` need it then. `GET
/v1/sessions/{id}` takes it too, but without it still answers, from the stored rows, with
`projectRoot: null`. A wrong folder is the same `404`, never another Session. On `PATCH`, the
query's `projectRoot` finds the Session and the body's is the Project being added. The CLI
always sends the folder it runs in.
Calling `POST /v1/sessions` again with the same `externalKey` and `projectRoot` loads the
Session as well. An adapter that always sends the same `projectRoot` never meets the `404`.

## A message is a Run

```http
POST /v1/sessions/{id}/runs
Content-Type: application/json

{ "input": "grafana: latency p99 back under 400ms for 10 minutes",
  "idempotencyKey": "incident-4711:evt-8824" }
```

The connection stays open until the Run ends — or send `"wait": false` and get
`202 { runId, status }` at once, then read the Run with `GET /v1/runs/{runId}` or follow
its Events (see [Not waiting](#not-waiting)). The body takes exactly one of `input` or
`skill`:

| Field | Meaning |
| --- | --- |
| `input` | a string, or an array of content blocks (`text`, `image_url`, `file`, `pdf_text`, `document`, `audio`). Every block takes an optional `author`: `owner` (the default) or `third_party` — see [Who wrote what](#who-wrote-what). A `document` block (`filename`, `mediaType`, base64 `data`) is a file's bytes: the Runtime reads a PDF or a text file as its text, so the adapter needs no parser. An `audio` block (`mediaType`, base64 `data`) is OGG/Opus, MP3 or WAV; the Runtime transcribes it on its own machine before the turn, detecting the language among 25 European ones (the list is in the block's schema) |
| `skill`, `arguments` | run one of the Project's [Skills](./skills.md) |
| `modelPreference` | optional; a model id from `GET /v1/models`, or `tier:<name>` |
| `confirmationMode` | optional; `policy` (the default) or `interactive`, which the operator must allow in `confirmationModes` — see [approvals](#approvals) |
| `idempotencyKey` | optional; makes a retry safe, see [Runs and restarts](./runs-and-restarts.md#the-key) |
| `wait` | optional; `true` (the default) holds the connection, `false` answers `202` at once |
| `outputSchema` | optional; a JSON Schema the answer must satisfy — see [a structured answer](#a-structured-answer) |
| `deliver` | optional; `{ "channel": "telegram" \| "slack", "externalKey": "…" }`, the chat the outcome goes to — see [delivering an outcome](#delivering-an-outcome) |

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
- `artifacts` are files the Run wrote with `fs_write` or `fs_edit`, relative to the
  Session's folder (its Project, or its Desk when it has none), with forward slashes. Files a
  `bash_run` command writes are not listed. `GET
  /v1/runs/{runId}/artifacts/{index}` answers the `index`-th one's bytes, to send on as a file.

### A structured answer

Send a JSON Schema as `outputSchema` and the outcome carries the agent's answer as
`output.structured`, already validated against it, beside `output.text` with the last thing
the agent said in words:

```json
{ "input": "triage incident 4711",
  "outputSchema": {
    "type": "object",
    "properties": {
      "severity": { "enum": ["low", "high", "critical"] },
      "summary": { "type": "string" } },
    "required": ["severity", "summary"],
    "additionalProperties": false } }
```

```json
{ "runId": "…",
  "status": "completed",
  "output": { "text": "Done.", "structured": { "severity": "high", "summary": "…" } },
  … }
```

The agent ends the Run by handing over a value; one that does not satisfy the schema is
returned to it with the reasons, and it tries again; stopping without one, it is reminded.
After five such attempts the Run fails with `failure.reason` `output_schema_unsatisfied`. A Run
that runs out of steps first still fails `step_ceiling`. The value is in the waited-on answer,
in the terminal Event and on `GET /v1/runs/{runId}`. It works with `input` or `skill`, in
either Confirmation Mode, waited on or not.

The schema's root must be `"type": "object"`. For a list or a single value, wrap it in one
property:

```json
{ "type": "object",
  "properties": { "items": { "type": "array", "items": { "type": "string" } } },
  "required": ["items"] }
```

A schema the Runtime cannot take is refused `400` before the Run starts: one that does not
compile, a remote `$ref` (nothing is ever fetched), a `format` the validator does not know
(it would check nothing), `pattern` or `patternProperties` (a regular expression runs
inside the Runtime, and a slow one would stall it), a schema above 64 KiB, or a root other
than an object.

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

An approval may carry `text`, which replaces the draft the Prompt offered before the tool
runs: `{ "decision": "approve", "text": "…" }`. It counts on the tools whose card has a text
to edit — Gmail's `send_email` (the body) and the Telegram connector's `send_message`,
`reply_to_message`, `edit_message` and `save_draft` (the text) and `send_file` (the
caption) — and is ignored elsewhere. A text the tool's own input rules refuse fails that
call.

The same Prompts go out on the Run's Event stream as `confirmation.required`, and each
settles there as `confirmation.resolved` with how: `api`, `timeout` or `cancel`. So the
answer can come from whoever follows the stream, while the first request still waits; the
first answer settles a Prompt, and that waiting request then returns. An answer with
`"wait": false` returns `202` at once. A Prompt of a subagent arrives and is answered
exactly like one of the main agent.

The operator decides whether any of this is possible: a Run naming a mode outside
`confirmationModes` is refused `403`, and the default allows `policy` alone.

## Follow-ups and cancelling

A Session runs one Run at a time. A message that arrives while a Run is going waits in a
queue, and its connection stays open while it waits. You do not have to serialise anything
yourself.

`409 Conflict` on a new Run means one of these:

- the Session's queue is full (`maxQueuedRunsPerSession`, 10 by default): back off, or drop
  the message;
- the same `idempotencyKey` came with a different request. The error names the key;
- the key's message is already in the Session but its Run's record is gone, or the record
  lost its outcome: the message may have acted, so it is never run again.

`POST /v1/sessions/{id}/cancel` stops the current Run and everything queued behind it. It
answers `202` when something was stopped and `204` when nothing was running. You cannot
cancel a single queued message. A Run parked on a Prompt is cancelled too: its Prompts are
denied, and the waiting request answers `cancelled`.

`DELETE /v1/sessions/{id}` is `409` while the Session has a Run going: cancel first, then
delete.

## Not waiting

A caller that cannot hold a connection — a serverless function, a queue worker, a CI step
behind a proxy — sends `"wait": false`. Then:

- `GET /v1/runs/{runId}` gives the Run's `status` and, once it ended, the same outcome a
  waited-on Run answers with. It reads the Run's record, so it works after a restart too.
- `GET /v1/runs/{runId}/events` streams the answer as it is written, each tool call, the
  Prompts and the outcome; `Last-Event-ID` resumes after a dropped connection. See
  [the Event stream](./reference.md#the-event-stream).
- `GET /v1/runs?status=parked` finds Runs waiting on a person, across Sessions, when you kept
  no ids of your own.

A repeat with the same `idempotencyKey` answers `202` with the same `runId` and its status
now, and starts nothing. Nothing is pushed to you: there are no webhooks — poll the Run or
follow its Events.

## Delivering an outcome

A Run can name the chat its outcome belongs in with `deliver`: a Channel, `telegram` or
`slack`, and the chat's key, the same key [`wisp schedules create
--deliver`](./reference.md#wisp-schedules-create) takes:

```json
{ "input": "…", "deliver": { "channel": "telegram", "externalKey": "telegram:123456789" } }
```

The Runtime sends nothing itself. The Channel's adapter, such as the [Telegram
bot](./telegram-bot.md), polls the Runs addressed to it and posts each one:

```http
GET /v1/runs?channel=telegram&settledAfter=<cursor>
```

- It lists only Runs that have ended, oldest first by the order they ended in, from every
  entrance, schedules included. A Run whose answer begins or ends with a line `[SILENT]` is
  left out.
- Each Run carries `settleCursor`. Keep the last one you posted and send it as
  `settledAfter` next time; leave `settledAfter` out the first time. `limit` pages it as in
  the plain listing, and `nextCursor` is the next page's `settledAfter`.
- `channel` takes only `limit` and `settledAfter`: adding `cursor`, `sessionId`, `status`
  or `origin`, or sending `settledAfter` without `channel`, is `400`.
- A `run` token reads only its own Channel's deliveries (another Channel is `403`), and
  never a Run another `run` token started.

A Run's `deliver` shows on `GET /v1/runs/{runId}`, and a Run a schedule fired carries the
job's name as `schedule`.

## From TypeScript

There is no SDK package to install: generate the types from the API of the Runtime you run,
and call it through [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/). The document
is the one `GET /v1/openapi.json` serves; every release also carries it as `v1.json` beside
its archives.

```sh
curl -fsS -H "Authorization: Bearer $TOKEN" "$URL/v1/openapi.json" -o v1.json && npx openapi-typescript v1.json -o v1.d.ts
```

A Run started without waiting, its answer followed as it is written:

```ts
// A typed call to the Wisp Runtime through `openapi-fetch`, with the types
// `openapi-typescript` generates from the release's v1.json into `./v1.d.ts`.
import createClient from "openapi-fetch";
import type { paths } from "./v1.js";
import { runEvents } from "./events-reader.js";

const baseUrl = process.env.WISP_URL ?? "http://127.0.0.1:3008";
const token = process.env.WISP_TOKEN ?? "";
const client = createClient<paths>({ baseUrl, headers: { authorization: `Bearer ${token}` } });

const session = await client.POST("/v1/sessions", { body: { origin: "cli", title: "Nightly report" } });
if (!session.data) throw new Error(`session: HTTP ${session.response.status}`);

const run = await client.POST("/v1/sessions/{id}/runs", {
  params: { path: { id: session.data.id } },
  body: { input: "Summarise yesterday's incidents", wait: false },
});
if (!run.data) throw new Error(`run: HTTP ${run.response.status}`);

for await (const event of runEvents(baseUrl, token, run.data.runId)) {
  if (event.kind === "text.delta") process.stdout.write(event.text);
  if (event.kind === "run.completed") console.log(`\n${event.outcome.usage.totalTokens} tokens`);
}
```

The Event stream is the one part a generator does not handle. This reader, saved as
`events-reader.ts` beside `v1.d.ts`, follows a Run's Events until the terminal one, skips a
kind it does not know, and resumes with `Last-Event-ID` a dropped connection or one a proxy
answers 5xx or 429, as a Run waiting on a Prompt is not over; an optional
`signal` stops it, so a process shutting down is never held by a Run it follows. It runs
server-side, on Node 18 or later: a browser's `EventSource` cannot send the token.

```ts
// Reads a Run's Events from the Wisp Runtime. Server-side: the stream needs the
// Bearer token, which a browser's EventSource cannot send. `./v1.js` holds the
// types `openapi-typescript` generates from the release's v1.json.
import { setTimeout as sleep } from "node:timers/promises";
import type { paths } from "./v1.js";

export type RunEvent =
  paths["/v1/runs/{runId}/events"]["get"]["responses"]["2XX"]["content"]["text/event-stream"];

// Every kind this reader knows, and whether it ends the stream. Any other kind is skipped.
const KINDS: Record<RunEvent["kind"], boolean> = {
  "run.queued": false, "run.started": false, "run.parked": false, "run.resumed": false,
  "text.delta": false, "audio.transcribed": false, "tool_call.started": false, "tool_call": false, "gap": false,
  "confirmation.required": false, "confirmation.resolved": false,
  "run.completed": true, "run.failed": true, "run.cancelled": true,
};

function decode(data: string): RunEvent | undefined {
  try {
    const event: unknown = JSON.parse(data);
    const known = typeof event === "object" && event !== null && "seq" in event &&
      typeof event.seq === "number" && "kind" in event && typeof event.kind === "string" &&
      Object.hasOwn(KINDS, event.kind);
    return known ? (event as RunEvent) : undefined; // the Runtime vouches for the rest
  } catch {
    return undefined;
  }
}

// Follows a Run's Events until its terminal one. A connection that drops, or
// ends having brought an Event, is resumed after the last seq with Last-Event-ID;
// one refused, as while the Runtime restarts, or answered 5xx or 429, is tried again each second.
// `signal` stops it: following a Run never holds a caller that is shutting down.
export async function* runEvents(
  baseUrl: string, token: string, runId: string, signal?: AbortSignal,
): AsyncGenerator<RunEvent> {
  let lastSeq: number | undefined;
  for (let progressed = true; progressed; ) {
    progressed = false;
    let res: Response;
    try {
      res = await fetch(`${baseUrl}/v1/runs/${encodeURIComponent(runId)}/events`, {
        headers: {
          authorization: `Bearer ${token}`,
          ...(lastSeq === undefined ? {} : { "last-event-id": String(lastSeq) }),
        },
        signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      progressed = true; // the Runtime is down: tried again a second later, for as long as it is
      await sleep(1000, undefined, { signal });
      continue;
    }
    // A proxy's 5xx or a 429 is not the Run's end: it may wait on a Prompt. Only a 4xx is.
    if (res.status >= 500 || res.status === 429) {
      await res.body?.cancel();
      progressed = true;
      await sleep(1000, undefined, { signal });
      continue;
    }
    if (!res.ok || !res.body) throw new Error(`events: HTTP ${res.status}`);
    let buffered = "";
    try {
      for await (const chunk of res.body.pipeThrough(new TextDecoderStream())) {
        buffered += chunk;
        for (let end = buffered.indexOf("\n\n"); end !== -1; end = buffered.indexOf("\n\n")) {
          const data = buffered.slice(0, end).split("\n").find((l) => l.startsWith("data: "))?.slice(6);
          buffered = buffered.slice(end + 2);
          const event = data === undefined ? undefined : decode(data);
          if (event === undefined) continue; // a `: ping`, an unknown kind or a broken frame
          lastSeq = event.seq;
          progressed = true;
          yield event;
          if (KINDS[event.kind]) return;
        }
      }
    } catch (err) {
      if (signal?.aborted) throw err;
      progressed = true; // the connection dropped: resume, a second later
      await sleep(1000, undefined, { signal });
    }
  }
  throw new Error("events: the stream ended before the Run did");
}
```

Both are checked against each release's document before it ships. A Runtime that adds an
Event kind fails to typecheck against this reader until the kind joins its table, so the
compiler tells you what is new.

## Health

`GET /v1/health` with the token returns the Runtime's state (`ready`, `login_required` and
so on; see [Troubleshooting](./runbook.md#the-five-states)), its `version` and `kind`,
`apiVersion`, and `update` when a newer release exists. Without a token it still answers
`200` with an empty object, which is enough for a liveness probe. `GET /v1/ready` answers
whether the Runtime will accept a Run right now.

`apiVersion` is the revision of `/v1` the Runtime speaks, now `1`. It goes up only when a
route or field is removed or renamed or changes meaning; a new route or optional field
leaves it as it is. Compare it with the one your adapter was written for.

While a newer release exists, every answer to a request that carries a token also carries
an `X-Wisp-Update` header naming its version.

## Errors

An error answers a JSON body `{ "error": "…" }`, a sentence for a person. Some carry a
`code` beside it for a program to match, such as
`confirmation_mode_interactive_not_allowed`; match the status and the `code`, never the
sentence.

## Tokens for an adapter

Give each adapter its own `run` token instead of the one token, so a leak costs only that
adapter and `wisp tokens revoke` shuts it out alone:

```sh
wisp tokens create --name my-bot --capability run
```

A `run` token reaches only what an adapter needs:

- it opens Sessions on the Desk only (a `projectRoot` is `403`) and starts Runs in those;
- it reads Runs, their Events and artifacts, and cancels a Session's Runs;
- it answers only the Prompts of Runs it started, with `approve` or `deny`;
- it reads and starts the speech model's install;
- with `--channel telegram` or `--channel slack` it may name a `deliver` target, of that
  Channel only. Without `--channel`, a Run that names `deliver` is `403`.

Everything else (Rules, connectors, schedules, tokens) is `403`.

## Not available yet

There are no webhooks: the Runtime never calls your adapter. Poll `GET /v1/runs/{runId}` or
follow its Events instead.

## Who wrote what

Wisp strips control characters, invisible characters and its own framing tags from every
connector result, so a tool's output cannot pretend to be part of the conversation's
structure. What Wisp cannot know is **who wrote** a piece of text; only the connector or the
adapter knows that.

- **In `input`**, mark a message you relay from someone other than the account owner with
  `"author": "third_party"`. The agent then reads it as data, never as an instruction. A
  block without `author` is the owner's own words.
- **In a connector**, the Telegram connector marks every message with `fromMe`. If you write
  MCP servers, mark authorship the same way, as a field next to the text, so the agent can
  tell an instruction from a quote of one.

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
