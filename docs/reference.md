---
description: Every /v1 route, every command and every setting, in one place.
---

# Reference

The lists on this page are complete: a test in the Runtime's repository fails when something
ships that this site does not name. The other pages explain how to use each item; this page
only lists them.

## Routes

Every route is under `/v1` and needs `Authorization: Bearer <token>`. Two exceptions:
`/v1/health` without a token answers `200` with an empty object, and the OAuth callback is
reached by a browser. The full API, with request and response schemas, is at
`/v1/openapi.json`; this table is an index of it.

- An error answers `{ "error": "…", "code": "…" }`, with `code` only where a program has
  something to match, such as `confirmation_mode_<mode>_not_allowed`. A token the Runtime
  does not know is `401`; a named token that may not reach the route is `403`. See
  [errors](adapter-contract.md#errors).
- While a newer release exists, an answer to a request with a token carries `X-Wisp-Update`
  with its version.
- The Session routes that load a Session (`PATCH`, runs, cancel, and a Run's retry)
  take `?projectRoot=<folder>`: a Project Session the Runtime dropped from memory is `404`
  without it. See [naming the Project again](adapter-contract.md#naming-the-project-again).

### The Runtime

| method | route | what it does |
| --- | --- | --- |
| `GET` | `/v1/openapi.json` | this contract, as OpenAPI |
| `GET` | `/v1/health` | what the Runtime says about itself: `status` (see [the five states](runbook.md#the-five-states)), `version`, `kind`, `apiVersion` (the `/v1` revision, now `2`), `minClientApi` (the oldest revision a client may be built for, now `1`; see [versions](adapter-contract.md#health)) and `update` when a newer release exists |
| `GET` | `/v1/ready` | whether the Runtime will take a Run |
| `GET` | `/v1/attestation` | the proxy's last attestation; `?includeQuote=1` adds the raw quote as `quote` |
| `POST` | `/v1/attestation/refresh` | attest the proxy again |
| `GET` | `/v1/update` | the update state — see [updating the Runtime](#updating-the-runtime) |
| `POST` | `/v1/update` | install the newer release and restart onto it — see [updating the Runtime](#updating-the-runtime) |

#### Updating the Runtime

`POST /v1/update` starts `wisp update` on the Runtime's host, in a process of its own, and
`GET /v1/update` reads how it is going, across the restart it causes too. See
[Update](install.md#update).

- Both take the one token, a `full` token or a `run` token, so a Channel adapter can offer the
  update to its owner. A `run` token can do no more than install the newest signed release.
- `POST` answers `202` with the state `installing` when it starts an update. While an update
  is running, it starts no second one and answers `202 installing` too. With nothing newer it
  starts nothing and answers `200` with the state. An update that finds nothing to install
  after all, because the release the daily check named is no longer newer, ends `idle` with
  no `version` and a new `finishedAt`, and `available` stays absent until the next daily
  check.
- `POST` starts no update when `bin/wisp` in the data directory runs another installation, a
  symlink into one: that `wisp update` would record its outcome there. It records `failed`
  with the reason; run the installer with `WISP_HOME` set to the data directory.
- `POST` is `409` on a build from source. Neither route exists on Wisp Desktop's own
  Runtime (`404`), which the app's updater replaces.
- The state is `available` (the newer version the Runtime's check found, absent when none),
  `state`, `version` (the one being or last installed), `error` (why, when `failed`) and
  `finishedAt` (when the last update ended).
- `state` is `idle`, `installing`, `installed` (on disk, waiting for a hand-started
  `wisp serve` to be restarted) or `failed`. An update cut short, its process killed or the
  machine restarted under it, reads `failed`.
- Runs in flight get the [drain window](runs-and-restarts.md#the-drain-window) when the
  Runtime restarts; count them first with
  `GET /v1/runs?status=queued,running,parked&origin=all&limit=200`, where a `nextCursor` means
  more than that.
- A service that comes up on the new version after `wisp update`'s 30-second wait gave up
  is read as updated: the Runtime on that version answers `idle` with that `version`. Until
  the old Runtime has stopped, it answers `installing`.

### Sessions and Runs

| method | route | what it does |
| --- | --- | --- |
| `POST` | `/v1/sessions` | open a Session; with `selection`, its [Model Selection](#the-model) |
| `GET` | `/v1/sessions` | list Sessions |
| `GET` | `/v1/sessions/{id}` | one Session, with its own `selection` (`null` when it has none) and `effectiveSelection`, what its next Run resolves to |
| `PATCH` | `/v1/sessions/{id}` | rename a Session, set or clear (`null`) its `selection`, or give a Desk Session a Project with `projectRoot`: once only, never moved again (`409` when it already has one) |
| `DELETE` | `/v1/sessions/{id}` | delete a Session; `409` while it has a Run going |
| `GET` | `/v1/sessions/{id}/history` | a Session's messages |
| `POST` | `/v1/sessions/{id}/runs` | run a turn and wait for its outcome — see [running a turn](#running-a-turn) |
| `GET` | `/v1/runs` | the Runs of every Session, newest first, paged — see [listing Runs](#listing-runs) |
| `GET` | `/v1/runs/{runId}` | one Run, read from its record, across restarts too — see [listing Runs](#listing-runs) |
| `GET` | `/v1/runs/{runId}/events` | the Run's Events over SSE, each frame's `data` one JSON Event and its `id` the Event's `seq`, ending with exactly one terminal Event, after which the stream closes; `Last-Event-ID` resumes. See [the Event stream](#the-event-stream) |
| `GET` | `/v1/runs/{runId}/artifacts/{index}` | the bytes of the `index`-th path of the Run's `artifacts`, with its media type and filename (`Content-Disposition`); only what that list names, never another file in the folder. `404` when the Run is unknown or has not ended, the index is past the list, or the file is gone since or is now a link out of the folder. A `run` token reads any Run's artifacts |
| `POST` | `/v1/runs/{runId}/retry` | run a failed or cancelled Run's message again — see [retrying a Run](#retrying-a-run) |
| `POST` | `/v1/runs/{runId}/confirmations/{promptId}` | answer a parked Run's Prompt — see [answering a Prompt](#answering-a-prompt) |
| `POST` | `/v1/sessions/{id}/cancel` | stop the Session's Runs |

#### Running a turn

`POST /v1/sessions/{id}/runs` runs a turn and waits for its outcome. See
[the adapter contract](adapter-contract.md).

- With `wait: false`, it answers `202 { runId, status }` at once and lets the Run go on.
- With `outputSchema` (a JSON Schema, root `type: object`), the outcome carries the validated
  answer as `output.structured` — see [a structured answer](adapter-contract.md#a-structured-answer).
  A schema the Runtime cannot take is `400`.
- With `maxTurns` (a positive whole number), the Run fails `step_ceiling` once the model has
  been called that many times. Without it a Run has no such limit.
- With `deliver` (`{ channel, externalKey }`), the outcome is addressed to a chat of the
  Telegram or Slack Channel, for its adapter to post — see
  [delivering an outcome](adapter-contract.md#delivering-an-outcome). A `run` token may name
  only its own Channel, else `403`.
- With `confirmationMode: interactive`, the wait ends at the Run's first park too, with
  `{ runId, status: "parked", confirmations }`. It is `403` with
  `code: confirmation_mode_<mode>_not_allowed` when `confirmationModes` leaves the mode out.
- A repeat of the `idempotencyKey` of a parked Run answers at once with the pending Prompts:
  `200 parked`, or `202 { runId, status: "parked" }` with `wait: false`.
- With `modelPreference`, this Run alone asks for that model — see [the model](#the-model).
- When the Session's selection pins a model that cannot read images and the input, or the
  Session's history, holds an image the user sent, it is `422` with
  `code: model_cannot_read_images`, the `model`, and `imageIn` (`message` or `history`). No Run
  starts and no message is kept.

#### The model

A Model Selection is a mode, `{ "mode": "advanced" | "balanced", "thinking": … }`, or a pin to
one model the catalog lists, `{ "mode": "model", "model": "<id>", "thinking": … }`. A Run takes
the first of:

1. the request's own `modelPreference`;
2. the Session's `selection`;
3. the Runtime Default, `/v1/settings/model`;
4. the configured [`teeLlmModel`](#configuration).

- Every write of a selection (a Session's, a job's, the Runtime Default) is checked against the
  catalog: a pin the catalog does not list, or `thinking` on a model that does not reason, is
  `400`. While the catalog cannot be reached, a pin is `503`; the modes are always accepted.
- A pin the catalog stops listing is served by Advanced, with the pin's `thinking`. The stored
  selection still names the pin, so it is served again once the model returns.
- A Run never waits for the catalog: it reads the copy the Runtime fetched at boot and
  refreshes in the background.
- A subagent and a forked Skill run on their parent Run's model.
- A [retry](#retrying-a-run) takes the selection current when it is sent, unless the Run named
  its own `modelPreference`: then it asks for that model again.

| method | route | what it does |
| --- | --- | --- |
| `GET` | `/v1/models` | the models a Run can prefer, as the proxy's catalog lists them |
| `GET` | `/v1/settings/model` | the Runtime Default, `{ selection }`; `null` when the configured model applies |
| `PUT` | `/v1/settings/model` | set it with `{ selection }`, at once; `null` clears it. The one token or a `full` token; a `run` token may only read it |

#### Listing Runs

`GET /v1/runs` lists the Runs of every Session, newest first, as Run resources.

- It is paged by `limit` (up to 200, default 50) and `cursor` (the `nextCursor` of the
  previous page, `null` on the last).
- `sessionId` narrows to one Session, and `status` to a comma-separated set (`running,parked`).
- `origin` picks the entrance: `v1` when absent, `api` for the desktop's, `all` for both.
- Runs from before a restart list with the status they ended with.
- An unknown `cursor` (its Run no longer recorded) is `400`.

`GET /v1/runs?channel=telegram|slack&settledAfter=<settleCursor>` is the delivery listing
instead: the ended Runs whose `deliver` names that Channel, oldest first in the order they
ended, past `settledAfter`, from every entrance. See
[delivering an outcome](adapter-contract.md#delivering-an-outcome).

- It takes only `limit` and `settledAfter`. Any other filter beside `channel`, or
  `settledAfter` without `channel`, is `400`.
- A Run whose answer begins or ends with a line `[SILENT]` is left out.
- A `run` token reads only its own Channel's (`403` otherwise), and none another `run`
  token started.

`GET /v1/runs/{runId}` reads one Run from its record, across restarts too:

- `status`, `sessionId`, `origin`, `confirmationMode`, `toolsRan`, `retryOf`,
  `hasOutputSchema` (whether it was sent an `outputSchema`), `deliver` (where its outcome
  goes, when anywhere), `schedule` (the job's name, on a Run a schedule fired),
  `settleCursor` (once it ended, its place in the delivery listing; opaque), `createdAt`,
  `startedAt`, `settledAt`, and, once it ended, the outcome a waited-on Run answers with;
- while a `/v1` Run is parked, its pending Prompts as `confirmations`;
- `404` for an unknown id.

#### Retrying a Run

`POST /v1/runs/{runId}/retry` runs a failed or cancelled Run's message again and waits for
its outcome.

- With `{ "wait": false }`, it answers `202 { runId, status }` for the new Run at once.
- It is `409` when the Run is not failed or cancelled, failed on `context_overflow`, is not its
  message's latest Run, or something was sent after it.
- A second retry of the same Run answers with the Run the first one started.
- The retry inherits the Run's `confirmationMode`, and is `403` when `confirmationModes` no
  longer has it.

#### Answering a Prompt

`POST /v1/runs/{runId}/confirmations/{promptId}` answers a parked Run's Prompt with
`{ decision }`: `approve`, `deny`, `allow_project` or `allow_global` (the last two also write
the Rule).

- An optional `text` replaces the draft before the tool runs, on the tools whose card offers
  one to edit — see [approvals](adapter-contract.md#approvals).
- A Prompt marked `askedEveryTime: true` cannot be lifted by a Rule: `allow_project` and
  `allow_global` approve it and write none.
- A `run` token answers only `approve` or `deny`, and only on a Run it started; else `403`.
- It waits for the Run's next park or its end, answered as the Run request is. With
  `wait: false` it answers `202 { runId, status }` at once and the Run goes on.
- While another Prompt of the same step is pending, it answers at once with `status: parked`
  and the Prompts left.
- It is `404`, the same for each, when the Prompt is unknown, already settled, of another Run,
  of a desktop Run, or of a Run that has ended.

### The Event stream

Every Event carries `seq` and `kind`. In the order a Run makes them:

| kind | fields | when |
| --- | --- | --- |
| `run.queued` | | the Run waits behind another of its Session |
| `run.started` | | the Run's turn begins |
| `audio.transcribed` | `index`, `text`, `author` | an `audio` block of the input was heard: its place in `input`, its transcript and whose words they are, before the agent reads them |
| `text.delta` | `text` | a piece of the main agent's answer as it is written; a subagent's text is not streamed |
| `tool_call.started` | `name`, `toolCallId` | a call passed the Rules and runs now, a subagent's too; no arguments. A refused call has none |
| `tool_call` | the outcome's `toolCalls` entry, plus `toolCallId` | a call ended; `ruledBy: "judge"` when [Auto Mode](permissions.md#auto-mode) let it run |
| `run.parked` | | an `interactive` Run waits on its first pending Prompt |
| `confirmation.required` | `id`, `toolName`, `toolCallId`, `agentId`, `args`, `askedEveryTime` | a Prompt, as `confirmations` lists it; `agentId` names the subagent that asks; `escalatedBy: "judge"` when Auto Mode sent it on to a person |
| `confirmation.resolved` | `id`, `decision`, `via` | a Prompt settled: `via` is `api` when answered, `timeout` when nobody answered in time (a deny), `cancel` when the Run was cancelled (a deny) |
| `run.resumed` | | the last pending Prompt settled and the Run goes on |
| `run.completed`, `run.failed`, `run.cancelled` | `outcome` | the one terminal Event, carrying what `GET /v1/runs/{runId}` answers |
| `gap` | `status`, `text` | see resuming below |

- **Resuming.** Send the last `seq` you saw as `Last-Event-ID` and the stream replays every
  Event after it. Each Run keeps its last 1000 Events in memory; when the one you need is gone,
  you get a `gap` first — the Run's `status` now and the `text` of the `text.delta`s it
  stands for — then a `confirmation.required` for each pending Prompt, then the Events the
  Runtime still holds. The answer so far is the `gap`'s `text` plus the `text.delta`s after
  it. Key Prompts by `id`: one may reach you twice.
- **Late and old Runs.** A Run that has ended, or one from before a restart, sends its
  terminal Event alone. A desktop Run still going sends one Event for where it stands, then
  its terminal one.
- **Waited-on Runs stream too**, so a script can hold the Run while a dashboard follows it.
- A `: ping` comment comes every 15 seconds. Read the stream with `fetch` — a browser's
  `EventSource` cannot send the token.
- **Compatibility.** Skip an Event of a kind you do not know and ignore fields you do not
  know: new kinds and fields may be added, never changed or removed.

### Rules, Skills and the audit

| method | route | what it does |
| --- | --- | --- |
| `GET` | `/v1/permissions` | the Rules and what they decide; `?projectId=` or `?projectRoot=` for a Project's |
| `POST` | `/v1/permissions/rule` | write a Rule for a tool: `{ tool, decision, projectId? }`, where `decision` is `ask`, `allow`, `deny`, `always_ask`, or `null` to drop the Rule; without `projectId` it is global |
| `POST` | `/v1/permissions/bypass` | turn a Project's bypass on or off: `{ projectId, enabled }` |
| `POST` | `/v1/permissions/connector` | write a Rule for every tool of a Connector: `{ connector, decision, projectId? }`; `null` drops them |
| `GET` | `/v1/settings/auto-mode` | whether [Auto Mode](permissions.md#auto-mode) is on: `{ enabled, available }`; `available` is `false` on a Runtime with no proxy, where every `ask` goes to a person. A `run` token reads it only with a `channel` |
| `PUT` | `/v1/settings/auto-mode` | turn it on or off with `{ "enabled": true \| false }`, at once; answers as `GET`. The one token, a `full` token, or a `run` token with a `channel`, whose adapter lets only its owner change it |
| `GET` | `/v1/skills` | the Skills the Runtime can run |
| `GET` | `/v1/audit` | the audit, newest first; filter with `sessionId` and `tool`, page with `limit` and `cursor` (the answer's `nextCursor`) |
| `GET` | `/v1/sessions/{id}/audit` | one Session's audit, paged with `limit` and `offset` |
| `GET` | `/v1/sandbox` | the `bash_run` sandbox switches: `enabled` and `allowNetwork` |
| `PUT` | `/v1/sandbox` | change one or both switches; an omitted one keeps its value |
| `POST` | `/v1/tokens` | make a named token with a `name`, a `capability` (`full` or `run`) and, for a `run` token, an optional `channel` (`telegram` or `slack`), the only Channel its Runs may `deliver` to; the answer, with the token and the Runtime's public `url` when it has one, is the only time the token is shown; `409` when the name is taken. The one token only |
| `GET` | `/v1/tokens` | the named tokens: name, capability, Channel and creation time, never a token. The one token only |
| `GET` | `/v1/timezone` | the user's time zone (IANA, such as `Europe/Berlin`): the clock the agent is told, and the zone of a cron job made without one |
| `PUT` | `/v1/timezone` | set it with `{ "timezone": "…" }`; Wisp Desktop writes its own on every connect |
| `GET` | `/v1/instructions` | the user's own [instructions](instructions.md), the text of `$WISP_HOME/AGENTS.md`, as `{ instructions }`; `""` when there is no file |
| `PUT` | `/v1/instructions` | write them with `{ "instructions": "…" }`, at most 32 KiB, from the next message on; `""` removes the file. Answers as `GET` |
| `DELETE` | `/v1/tokens/{name}` | revoke a named token; it is refused (`401`) from its next request on. The one token only |

### Schedules

A job runs a message on a clock. Its `schedule` is one of:

- a five-field cron expression: `{ "cron": "0 9 * * 1-5", "timezone": "Europe/Berlin" }`.
  Without `timezone`, it runs in the zone of [`/v1/timezone`](#rules-skills-and-the-audit), or
  the host's when none is set;
- an interval counted from when the job is made or changed: `{ "every": "2h" }`, in `m`, `h`
  or `d`. An interval of days may name a time of day, `{ "every": "2d", "time": "09:00" }`,
  up to `366d`, in its `timezone` or the zone a cron job would get;
- one instant: `{ "at": "2026-11-01T09:00:00Z" }`.

Beside `name`, `input` and `schedule`, a job may name a `skill` (each fire sends
`/<skill> <input>`), a `projectRoot` (an absolute path to a folder), an `outputSchema`, a
`deliver` target and a `selection`, the [Model Selection](#the-model) each fire runs on (the
Runtime Default without one).

- A spec that never fires, an instant gone by, a folder that is not one and a schema a Run
  cannot take are `400`.
- Each fire is a fresh Session with origin `schedule`, under `policy`; its outcome becomes the
  job's `lastOutcome`. The fire writes the job's `selection` onto that Session, so a later
  change to the job leaves it alone.
- The routes take the one token or a `full` token; a `run` token is `403` on all of them.

| method | route | what it does |
| --- | --- | --- |
| `POST` | `/v1/schedules` | make a job; answers it with its `id` and `nextAt` |
| `GET` | `/v1/schedules` | the jobs, each with `paused`, `nextAt`, `lastOutcome` (`runId`, `status`, `at`, and `skipped` when the scheduler passed over instants; a skip with no fire has no `runId` or `status`) and `lastFire`, its newest settled fire as `/v1/fires` lists one, `null` before the first, and `running`, its fire still going (`runId`, `sessionId`, `instant`), `null` when none is |
| `GET` | `/v1/schedules/{id}` | one job |
| `PATCH` | `/v1/schedules/{id}` | change the fields named; `null` clears `skill`, `projectRoot`, `outputSchema`, `deliver` or `selection`; `nextAt` moves only with `schedule` |
| `DELETE` | `/v1/schedules/{id}` | delete a job; a fire under way runs on |
| `POST` | `/v1/schedules/{id}/pause` | stop a job firing until it is resumed |
| `POST` | `/v1/schedules/{id}/resume` | let it fire again; a recurring job counts `nextAt` from now, a one-off keeps its instant |
| `POST` | `/v1/schedules/{id}/run` | fire it now, off the clock; `202` with the Run's `runId`, read on `/v1/runs/{runId}`; `409` when its folder is gone |
| `GET` | `/v1/fires` | the settled fires, each with its `sequence`, job, instant, `outcome` (`completed`, `failed`, `cancelled`, `silent` or `skipped`), `reason` (a failed Run's failure reason; `folder_not_found` for a fire that could not start; `missed` or `previous_running` for a skip), `tool` (the first tool it called that no Rule allowed, whatever the outcome) and first line of the answer, paged by `limit` and `nextCursor`. The first page also lists the fires still going as `running`. With `channel` (Wisp Desktop reads `desktop`), those of jobs addressed to that Channel, oldest first, past `settledAfter=<sequence>`; without, every job's newest first, before `before=<sequence>`, or one job's with `scheduleId`. `lastSequence` is the newest sequence handed out |
| `GET` | `/v1/delivery-targets` | each place a job or a kept Run delivers, once: its `channel` and `externalKey`, the newest `label` a Run addressed there sent, and `group`, whether everyone in that chat reads it |

### Speech

The speech model an `audio` block needs is 643 MB, pinned by revision and sha256, and installed only when asked: until it is, an `audio` block fails the Run as `speech_not_installed` and no Run downloads it. Both routes take the one token, a `full` token or a `run` token, so a Channel adapter can offer the install to its owner.

| method | route | what it does |
| --- | --- | --- |
| `GET` | `/v1/speech` | the model's readiness: `absent`, `downloading` with `progress` (`receivedBytes`, `totalBytes` across its four files), `ready`, or `failed` with `lastError` |
| `POST` | `/v1/speech/download` | start the install; `202` with the readiness. A POST while a download runs joins it, and one already installed downloads nothing |

### The account

| method | route | what it does |
| --- | --- | --- |
| `POST` | `/v1/auth/login` | begin the Account Login |
| `POST` | `/v1/auth/login/complete` | finish a manual Account Login with the redirect URL |
| `GET` | `/v1/auth/status` | whether the Runtime is signed in |
| `POST` | `/v1/auth/cancel` | abandon a login in flight |
| `POST` | `/v1/auth/logout` | sign out |
| `GET` | `/v1/billing/me` | the plan, how full its usage windows are, and the prepaid balance; no balance when the billing service has no pay-as-you-go |
| `POST` | `/v1/billing/topups` | open a top-up of the balance for `amountCents`; the answer carries the `checkoutUrl` to pay it on and when it `expiresAt` |
| `GET` | `/v1/billing/topups/{id}` | one top-up as it stands — poll it after the checkout until it is `paid`, `failed` or `expired` |
| `PUT` | `/v1/billing/payg-settings` | change the balance settings named (`autoReload`, `spendAfterLimit`); the answer is the balance |

A billing refusal carries a `code` beside the `error`; `503` with `billing_unavailable` means
billing did not answer and is worth another try.

### Connectors

| method | route | what it does |
| --- | --- | --- |
| `GET` | `/v1/connectors` | the Connectors |
| `POST` | `/v1/connectors` | add a Connector |
| `GET` | `/v1/connectors/{name}` | one Connector |
| `PATCH` | `/v1/connectors/{name}` | change a Connector |
| `DELETE` | `/v1/connectors/{name}` | remove a Connector |
| `GET` | `/v1/connectors/{name}/tools` | a Connector's tools |
| `POST` | `/v1/connectors/{name}/connect` | connect a Connector |
| `POST` | `/v1/connectors/{name}/disconnect` | disconnect a Connector |
| `GET` | `/v1/connectors/enabled` | which Connectors the Project of `?sessionId=` may use; a Session with no Project is `400` |
| `PUT` | `/v1/connectors/enabled` | choose which Connectors that Project may use, for all its Sessions |
| `GET` | `/v1/connectors/templates` | the Connectors on offer |
| `POST` | `/v1/connectors/oauth/start` | begin a Connector's OAuth |
| `GET` | `/v1/connectors/oauth/callback` | where the provider sends the browser back; takes no token |
| `POST` | `/v1/connectors/oauth/cancel` | abandon a Connector's OAuth |
| `DELETE` | `/v1/connectors/oauth/{name}` | forget a Connector's OAuth tokens |
| `GET` | `/v1/connectors/{name}/drive-settings` | the Google Drive shared-drive allowlist |
| `PUT` | `/v1/connectors/{name}/drive-settings` | replace the Google Drive shared-drive allowlist |
| `GET` | `/v1/connectors/{name}/shared-drives` | the Google account's shared drives |

### Telegram

Telegram signs in with a code and, where the account has one, a cloud password, so it has a
flow of its own. `wisp connectors telegram keys` and `wisp connectors auth telegram` walk it.

| method | route | what it does |
| --- | --- | --- |
| `POST` | `/v1/connectors/telegram/keys` | save the Telegram API keys |
| `POST` | `/v1/connectors/telegram/auth` | ask Telegram for a sign-in code |
| `POST` | `/v1/connectors/telegram/auth/code` | submit the code Telegram sent |
| `POST` | `/v1/connectors/telegram/auth/password` | submit the account's cloud password |
| `POST` | `/v1/connectors/telegram/auth/resend` | ask Telegram for another code |
| `POST` | `/v1/connectors/telegram/auth/cancel` | abandon the pending sign-in |
| `POST` | `/v1/connectors/telegram/probe` | ask Telegram whether the sign-in is still alive |

## Commands

One program. `wisp serve` runs the Runtime. Every other command
talks to a running one, which it finds through `$WISP_HOME/runtime.lock`, or through
`--url` and `--token` (or `WISP_URL` and `WISP_TOKEN`) given together. On a command that
lists or shows something, `--json` makes it print one JSON document on stdout and nothing
else there; a command that only acts, such as `wisp cancel` or `wisp stop`, prints its line
either way. `wisp --help` lists the
commands, and `wisp <command> --help` or `wisp help <command>` shows one. Exit codes are in
[Troubleshooting](runbook.md#exit-codes).

| command | what it does |
| --- | --- |
| `wisp serve [--home dir] [--config file]` | run the Runtime in the foreground |
| `wisp status` | the Runtime's health state, version and kind, a newer release and how the last update ended, the signed-in account, and a warning when `bash_run` is not allowed |
| `wisp doctor` | check the config, the key file or keyring, service, Runtime, login, proxy, the sandbox (on Linux: bubblewrap, once the sandbox is on) and `PATH`; every problem comes with the command that fixes it; exits `1` if any check fails |
| `wisp stop` | stop the Runtime this data directory holds, draining its Runs; it returns once the signal is sent. Refused while `--url`, `--token`, `WISP_URL` or `WISP_TOKEN` is set: unset them first |
| `wisp run [<session>] "<prompt>" [--skill name] [--model pref [--thinking]] [--key k] [--detach] [--interactive] [--output-schema file] [--max-turns n]` | one Run, waited on — see [`wisp run`](#wisp-run) |
| `wisp confirm <run> <prompt> approve\|deny\|allow-project\|allow-global [--detach]` | answer a parked Run's Prompt and wait as `wisp run` waits, with its exit codes; `--detach` returns at once and exits `0`. When the Prompt is already settled or unknown it says so and prints the Run's state |
| `wisp retry <run> [--detach]` | run a failed or cancelled Run's message again and wait, with `wisp run`'s exit codes; `--detach` prints the new Run's id and returns |
| `wisp runs list [<session>] [--status s,s] [--json]` | the `/v1` Runs, newest first, one line each: when, id, status, Session; with a session only its Runs, with `--status` only those statuses (`running,parked`); `--json` for the Runs whole |
| `wisp runs show <id> [--json]` | one Run: its status and, once it ended, its answer; `--json` for the whole Run |
| `wisp runs events <id> [--json]` | follow a Run's Events, one line each, and print its answer at the end; `--json` for each Event as sent, one per line. Exits when the Run ends, with `wisp run`'s exit code |
| `wisp sessions create [--project path] [--title t]` | open a Session |
| `wisp sessions list [--all \| --origin o]` | this folder's Sessions; `--all` for every one, `--origin` for one origin's (`cli`, `desktop`, `telegram`, `slack`, `schedule`) |
| `wisp sessions show <id>` | one Session and its messages |
| `wisp sessions delete <id>` | delete a Session |
| `wisp cancel <session>` | stop a Session's Runs |
| `wisp permissions get [--project path] [--connector name]` | the Rules; `--connector` shows only that connector's tools |
| `wisp permissions set <tool> ask\|allow\|deny\|always_ask\|default [--project path]` | write a Rule for a tool; `default` drops it; `always_ask` is [Always ask me](permissions.md#always-ask-me) |
| `wisp permissions allow-connector <name> [--project path]` | allow every tool of a Connector |
| `wisp permissions bypass on\|off --project path` | a Project's bypass |
| `wisp auto-mode status` | whether [Auto Mode](permissions.md#auto-mode) is on, and whether this Runtime can judge |
| `wisp auto-mode on`, `wisp auto-mode off` | let the Judge run harmless calls without asking, or ask a person every time |
| `wisp connectors list` | the Connectors |
| `wisp connectors add <name> (--http url \| --sse url \| --stdio cmd) [--header k=v]… [--header-stdin k] [--project path] [--allow]` | add one; `--header-stdin` reads a secret from the terminal, `--project` also enables it there, `--allow` also allows its tools |
| `wisp connectors auth <name> [--project path] [--allow]` | sign a Connector in; `--project` and `--allow` as for `add` |
| `wisp connectors telegram keys --api-id <n> --api-hash-stdin` | save the Telegram API keys |
| `wisp connectors remove <name>` | remove one |
| `wisp connectors enable <name> --project path` | let a Project's Sessions use it |
| `wisp skills list [--project path]` | the Skills |
| `wisp models` | the models `--model` can prefer: each one's id, tiers, context window and capabilities |
| `wisp model` | the Runtime Default: the model a chat or job with none of its own runs on; `none` when the configured model applies |
| `wisp model set advanced\|balanced\|<model id> [--thinking]` | set the Runtime Default, at once; a model id must be one `wisp models` lists |
| `wisp model reset` | clear the Runtime Default, so the configured model applies again |
| `wisp speech [install]` | whether the speech model voice messages need is installed; `install` downloads it (643 MB), printing progress, and exits `0` once it is ready, at once when it already is, or `1` with the error |
| `wisp sandbox` | whether the `bash_run` [sandbox](./sandbox.md) and its network are on |
| `wisp sandbox on`, `wisp sandbox off` | turn the sandbox on or off. `off` warns that a command then runs as the Runtime's own user and can read the key source |
| `wisp sandbox network on\|off` | let sandboxed commands reach the network, or not |
| `wisp tokens create --name <n> --capability full\|run [--channel telegram\|slack] [--public-url <u>]` | make a named token and print it with its connection string, once — see [`wisp tokens create`](#wisp-tokens-create) |
| `wisp tokens list` | the named tokens: name, capability, Channel and creation time, never a token |
| `wisp tokens revoke <n>` | refuse that token from now on and pause the jobs its bot made in a chat; the one token and the other named tokens keep working |
| `wisp schedules create --name <n> (--cron "<expr>" [--tz zone] \| --every 30m\|2h\|1d \| --at <instant>) [--project path] [--skill name] [--output-schema file] [--deliver key] [--model m [--thinking]] "<input>"` | make a job and print its id — see [`wisp schedules create`](#wisp-schedules-create) |
| `wisp schedules list [--json]` | the jobs, one line each: id, name, `next <instant>` (or `paused`, or `done` for a one-off that fired), and the last outcome with its Run's id (or `never fired`) |
| `wisp schedules pause <id>`, `wisp schedules resume <id>` | stop a job firing, or let it fire again |
| `wisp schedules run <id>` | fire a job now and print the Run's id, for `wisp runs show` |
| `wisp schedules remove <id>` | delete a job |
| `wisp audit <session> [--json]` | a Session's audit |
| `wisp telegram setup [--url u --token t] [--state file]` | set the bot up and print the owner link — see [`wisp telegram setup`](#wisp-telegram-setup) |
| `wisp telegram install [--all-messages]`, `wisp telegram uninstall` | run the bot as a user service, restarted on failure, after `setup`; or stop and remove it |
| `wisp telegram [--all-messages] [--url u --token t] [--state file]` | run the [Telegram bot](telegram-bot.md) in this terminal from what `setup` stored, or from `TELEGRAM_BOT_TOKEN`, `WISP_URL` and `WISP_TOKEN`; in a group it answers only a mention, a reply or a command, every message with `--all-messages` |
| `wisp telegram pairing list\|approve <code>\|revoke <user id>` | who waits and who is let in; let in a stranger by their code; shut a user out |
| `wisp slack setup [--url u --token t] [--state file]` | set the app up and print the owner's `!pair` line — see [`wisp slack setup`](#wisp-slack-setup) |
| `wisp slack install`, `wisp slack uninstall` | run the app as a user service, restarted on failure, after `setup`; or stop and remove it |
| `wisp slack [--url u --token t] [--state file]` | run the [Slack app](slack-app.md) over Socket Mode in this terminal from what `setup` stored, or from `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `WISP_URL` and `WISP_TOKEN` |
| `wisp slack pairing list\|approve <code>\|revoke <user id>` | as for Telegram |
| `wisp login [--manual]` | the Account Login; without a browser on the Runtime's host, or over SSH, it asks for the redirect URL as `--manual` does. It gives up after 5 minutes |
| `wisp logout` | sign out |
| `wisp billing status [--json]` | the plan, how full its usage windows are, the balance and auto-reload |
| `wisp billing topup <usd>` | print a checkout link for that many dollars and wait for the payment; Ctrl-C stops the wait, not the payment. Exits `0` once it is paid |
| `wisp billing auto-reload --threshold <usd> --target <usd> [--monthly-limit <usd>]` | top the balance up to the target when it falls below the threshold, at most `--monthly-limit` in any 30 days (tax is charged on top and not counted). Needs a card saved during a `topup` |
| `wisp billing auto-reload --off` | stop topping the balance up |
| `wisp update [--when-idle]` | install the newest release beside the running one and restart the service, and the Telegram bot's and the Slack app's services, onto it; without a running service, it takes effect on the next `wisp serve`. With `--when-idle`, the restart waits until no Run is executing, waiting for an approval, or queued, as `autoUpdate`'s does. See [Update](install.md#update) for the other ways |
| `wisp uninstall` | remove what the installer put down (service, the Telegram bot's and the Slack app's services, `bin/wisp`, `versions`, the `PATH` line, and `runtime.json` while it holds only the installer's `agentToken`); at a terminal it asks whether to delete the data too |
| `wisp --version` | the build's version; touches nothing else |
| `wisp --help`, `wisp <command> --help`, `wisp help <command>` | the commands by group, or one command's usage |

### `wisp run`

One Run, waited on.

- Without a session, it opens one for the current folder, and prints `session <id>` on stderr
  first.
- `--detach` prints the Run's id and returns without waiting; with `--json`,
  `{ sessionId, runId, status }`.
- `--json` prints the outcome with `sessionId`, and no `session <id>` line on stderr.
- `--interactive` runs it in the `interactive` mode: on a park it prints each pending Prompt
  as `<prompt> <tool> <arguments>` and exits `3`; `--json` prints the parked answer.
- `--output-schema` sends the file's JSON Schema as `outputSchema` and prints only
  `output.structured`, as JSON. A file that cannot be read or is not JSON is a usage error.
- `--max-turns <n>` sends `maxTurns`: the Run fails `step_ceiling` after `n` model calls. A
  value that is not a positive whole number is a usage error.
- `--model` picks the model for this Run only: `advanced`, `balanced`, a model id, or a raw
  preference such as `tier:balanced`. `--thinking` asks for its thinking form; it needs
  `--model`, and a raw preference (one with a `:`) refuses it.

### `wisp tokens create`

Makes a named token and prints it with its connection string, once. Only the one token can
run it.

- `--channel` names the one Channel a `run` token's Runs may deliver to, which the
  [Telegram bot](telegram-bot.md) and the [Slack app](slack-app.md) need.
- `--public-url` is the address the device will reach the Runtime at, put into the
  connection string. See [a token per device](remote-access.md#a-token-per-device).

### `wisp schedules create`

Makes a job and prints its id. It takes exactly one time spec: `--cron`, `--every` or `--at`.

`--deliver` is the chat's key, its Channel the prefix:

- `telegram:<chatId>`, or `telegram:<chatId>:<topicId>` for a forum topic;
- `slack:<DM id>`, `slack:<channel id>` or `slack:<channel id>:<thread ts>`;

each optionally followed by `@<bot id>` (Telegram's numeric bot id, Slack's bot user id), so that only
that bot posts it.

`--model` is the model each fire runs on: `advanced`, `balanced` or a model id `wisp models`
lists, with `--thinking` for its thinking form. Without it, a fire follows the Runtime Default.

### `wisp telegram setup`

- Asks for the bot's token from @BotFather.
- Mints a `run` token for the Telegram Channel, with the one token given, or from
  `runtime.lock`. On another host, you paste a connection string instead.
- Stores both in the state file, offers to start the bot as a service, and prints the owner
  link.

See [the Telegram bot](telegram-bot.md).

### `wisp slack setup`

- Asks for the app's Bot User OAuth Token (`xoxb-…`) and its app-level token (`xapp-…`), and
  checks both with Slack.
- Mints a `run` token for the Slack Channel, with the one token given, or from
  `runtime.lock`. On another host, you paste a connection string instead.
- Stores them in the state file, offers to start the app as a service, and prints the
  owner's `!pair` line.

See [the Slack app](slack-app.md).

## Installer

`curl -fsSL https://usewisp.io/runtime/install.sh | sh`. Variables go on the `sh` side of the
pipe. See [Install, update, uninstall](install.md).

| variable | default | what it sets |
| --- | --- | --- |
| `WISP_HOME` | `~/.wisp` | where to install and keep data |
| `WISP_SERVICE` | ask at a terminal on first install | `1` installs the service, `0` skips it |
| `WISP_VERSION` | `latest` | the release to install |
| `WISP_REQUIRE_SIGNATURE` | required on Linux | `1` refuses an install whose signature cannot be verified |
| `NO_COLOR` | — | plain output |

## Configuration

`$WISP_HOME/runtime.json` (`~/.wisp/runtime.json` by default) holds these keys, and the
environment variable next to each overrides the file. The installer creates the file with
`agentToken` only. A key the Runtime does not know, invalid JSON, a file owned by another
user, or a file holding `agentToken` that others can read (`chmod 600` it) stops `wisp serve`
with exit **78**. The Runtime knows a few more keys than this list names: they tune its
internals, or are set by Wisp Desktop or the build, and are not for operators. The installed
`wisp` reads no `.env` file.

| key | environment | default | what it sets |
| --- | --- | --- | --- |
| `agentToken` | `WISP_AGENT_TOKEN` | — required | the bearer token; at least 32 characters |
| `port` | `PORT` | `3008` | the port the Runtime listens on |
| `host` | `HOST` | `127.0.0.1` | the address it listens on; anything but loopback needs `allowedHosts`. Wisp Desktop ignores it |
| `allowedHosts` | `ALLOWED_HOSTS` (comma-separated) | `[]` | host names, without a port, a request's `Host` may carry besides loopback; the name your [reverse proxy](remote-access.md#reaching-it-from-another-machine) is reached by |
| `wispHome` | `WISP_HOME` | `~/.wisp` | the data directory; only from `--config` or the environment, never from a `runtime.json` found through it |
| `teeLlmModel` | `TEE_LLM_MODEL` | `auto:auto:best` | the model a Run uses when it does not name one |
| `maxConcurrentRuns` | `MAX_CONCURRENT_RUNS` | `3` | Runs executing at once across all Sessions |
| `maxQueuedRunsPerSession` | `MAX_QUEUED_RUNS_PER_SESSION` | `10` | Runs that may wait behind a Session's live one before the next is refused with `409` |
| `idempotencyTtlMs` | `IDEMPOTENCY_TTL_MS` | `86400000` (24 h) | how long a key names the Run it started — see [the key](runs-and-restarts.md#the-key) |
| `runRecordRetentionMs` | `RUN_RECORD_RETENTION_MS` | `604800000` (7 days) | how long an ended Run's record is kept; a daily sweep deletes it after this, never sooner than `idempotencyTtlMs` after it began |
| `shutdownDrainTimeoutMs` | `SHUTDOWN_DRAIN_TIMEOUT_MS` | `5000` | how long a stop lets running Runs finish before it aborts them |
| `confirmTimeoutMs` | `CONFIRM_TIMEOUT_MS` | `7200000` (2 h) | how long an unanswered confirmation waits before it is denied |
| `subagentTimeoutMs` | `SUBAGENT_TIMEOUT_MS` | none | how long a subagent or a `fork` Skill may run, in ms; time waiting on a confirmation does not count. Unset, there is no limit |
| `confirmationModes` | `CONFIRMATION_MODES` (comma-separated) | `["policy", "interactive"]` | the confirmation modes a `/v1` Run may name; `policy` is always one. `["policy"]` stops callers from answering Prompts, the Telegram bot and the Slack app included; a Run naming a mode left out is refused `403` |
| `llmStallTimeoutMs` | `LLM_STALL_TIMEOUT_MS` | `300000` | silence from the model after which a Run fails `stream_stalled` |
| `llmRequestTimeoutMs` | `LLM_REQUEST_TIMEOUT_MS` | `120000` | how long a model request may take to start answering |
| `contextWindowTokens` | `CONTEXT_WINDOW_TOKENS` | `262144` | the context window assumed when the model's own is not known |
| `bashTimeout` | `BASH_TIMEOUT` | `30000` | how long one `bash_run` may take, in ms |
| `bashMaxOutput` | `BASH_MAX_OUTPUT` | `100000` | characters of a command's output the model sees |
| `fetchMaxLength` | `FETCH_MAX_LENGTH` | `50000` | characters of a fetched page the model sees |
| `fsMaxFileSize` | `FS_MAX_FILE_SIZE` | `31457280` (30 MiB) | the largest file the file tools read |
| `maxImageSizeBytes` | `MAX_IMAGE_SIZE_BYTES` | `10485760` (10 MiB) | the largest image a message may carry |
| `skillPaths` | `SKILL_PATHS` | none | extra folders of Skills, separated like `PATH` |
| `autoUpdate` | `WISP_AUTO_UPDATE` (`true` or `false`) | `false` | install a newer release by itself once no Run is in flight or queued; a version whose update failed, however started, is tried again a day after the failure, until it has failed three times in a row, and then only a newer one is. Wisp Desktop's Runtime ignores it — see [automatically](install.md#automatically) |
| `logFormat` | `LOG_FORMAT` | `text` | how stderr lines are written: `text`, or `json` for one object per line with `ts`, `level`, `component`, `msg`, and `runId`/`sessionId` during a Run. A config error is written in this format too, read from the environment or from the file's own `logFormat` |
| `logLevel` | `LOG_LEVEL` | `info` | `debug` also puts a failed call's own error text on stderr, secrets removed; it may quote a request, so ship it to a third party knowingly. At `info` that text stays in the local diagnostics table |

Durations are in milliseconds.
