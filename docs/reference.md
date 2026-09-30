---
sidebar_position: 9
description: Every /v1 route, every command and every setting, in one place.
---

# Reference

The lists on this page are complete: a test in the Runtime's repository fails when something
ships that this site does not name. What each thing means in practice is on the pages it links
to; here it is only named.

## Routes

Every route answers under `/v1` and takes `Authorization: Bearer <token>`, except
`/v1/health` without a token, which says only that the Runtime is up, and the OAuth callback,
which a browser reaches. The Runtime serves the full contract, request and answer schemas
included, at `/v1/openapi.json`; this table is its index.

### The Runtime

| method | route | what it does |
| --- | --- | --- |
| `GET` | `/v1/openapi.json` | this contract, as OpenAPI |
| `GET` | `/v1/health` | what the Runtime says about itself — see [the five states](runbook.md#the-five-states) |
| `GET` | `/v1/ready` | whether the Runtime will take a Run |
| `GET` | `/v1/attestation` | the proxy's last attestation |
| `POST` | `/v1/attestation/refresh` | attest the proxy again |

### Sessions and Runs

| method | route | what it does |
| --- | --- | --- |
| `POST` | `/v1/sessions` | open a Session |
| `GET` | `/v1/sessions` | list Sessions |
| `GET` | `/v1/sessions/{id}` | one Session |
| `PATCH` | `/v1/sessions/{id}` | rename a Session or move it |
| `DELETE` | `/v1/sessions/{id}` | delete a Session |
| `GET` | `/v1/sessions/{id}/history` | a Session's messages |
| `POST` | `/v1/sessions/{id}/runs` | run a turn and wait for its outcome — see [the adapter contract](adapter-contract.md) |
| `POST` | `/v1/sessions/{id}/cancel` | stop the Session's Runs |

### Rules, Skills and the audit

| method | route | what it does |
| --- | --- | --- |
| `GET` | `/v1/permissions` | the Rules and what they decide |
| `POST` | `/v1/permissions/rule` | write a Rule for a tool |
| `POST` | `/v1/permissions/bypass` | turn a Project's bypass on or off |
| `POST` | `/v1/permissions/connector` | write a Rule for every tool of a Connector |
| `GET` | `/v1/skills` | the Skills the Runtime can run |
| `GET` | `/v1/audit` | the audit, newest first |
| `GET` | `/v1/sessions/{id}/audit` | one Session's audit |

### The account

| method | route | what it does |
| --- | --- | --- |
| `POST` | `/v1/auth/login` | begin the Account Login |
| `POST` | `/v1/auth/login/complete` | finish a manual Account Login with the redirect URL |
| `GET` | `/v1/auth/status` | whether the Runtime is signed in |
| `POST` | `/v1/auth/cancel` | abandon a login in flight |
| `POST` | `/v1/auth/logout` | sign out |

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
| `GET` | `/v1/connectors/enabled` | which Connectors a Session may use |
| `PUT` | `/v1/connectors/enabled` | choose which Connectors a Session may use |
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

One binary. `wisp serve` — or `wisp` with no argument — runs the Runtime; every other command
is a client of a running one. A client finds it through `$WISP_HOME/runtime.lock`, or through
`--url` and `--token` given together. `--json` makes a command print one JSON document on
stdout and nothing else there. Exit codes are in [the runbook](runbook.md#exit-codes).

| command | what it does |
| --- | --- |
| `wisp serve [--home dir] [--config file]` | run the Runtime in the foreground |
| `wisp status` | the Runtime's health state |
| `wisp stop` | stop the Runtime this data directory holds, draining its Runs |
| `wisp run [<session>] "<prompt>" [--skill name] [--model pref] [--key k]` | one Run, waited on; without a session it opens one for the current folder |
| `wisp sessions create [--project path] [--title t]` | open a Session |
| `wisp sessions list [--all]` | list Sessions |
| `wisp sessions show <id>` | one Session and its messages |
| `wisp sessions delete <id>` | delete a Session |
| `wisp cancel <session>` | stop a Session's Runs |
| `wisp permissions get [--project path]` | the Rules |
| `wisp permissions set <tool> ask\|allow\|deny [--project path]` | write a Rule for a tool |
| `wisp permissions allow-connector <name> [--project path]` | allow every tool of a Connector |
| `wisp permissions bypass on\|off [--project path]` | a Project's bypass |
| `wisp connectors list` | the Connectors |
| `wisp connectors add <name> (--http url \| --sse url \| --stdio cmd) [--header k=v]… [--header-stdin k]` | add one; `--header-stdin` reads a secret from the terminal |
| `wisp connectors auth <name>` | sign a Connector in |
| `wisp connectors telegram keys --api-id <n> --api-hash-stdin` | save the Telegram API keys |
| `wisp connectors remove <name>` | remove one |
| `wisp connectors enable <name> --project path` | let a Project's Sessions use it |
| `wisp skills list [--project path]` | the Skills |
| `wisp audit <session> [--json]` | a Session's audit |
| `wisp login [--manual]` | the Account Login; `--manual` for a host with no browser |
| `wisp logout` | sign out |
| `wisp update` | install the newest release beside the running one; it takes effect on the next `wisp serve` |
| `wisp --version` | the build's version; touches nothing else |

## Configuration

`$WISP_HOME/runtime.json` — `~/.wisp/runtime.json` unless `WISP_HOME` says otherwise — holds
these keys, and the environment variable beside each overrides the file. The file is optional,
but a key it holds that is not in this list, invalid JSON, or a file owned by another user
stops `wisp serve` with exit **78**. A file holding `agentToken` must be `0600`.

| key | environment | default | what it sets |
| --- | --- | --- | --- |
| `agentToken` | `WISP_AGENT_TOKEN` | — required | the bearer token; at least 32 characters |
| `port` | `PORT` | `3008` | the port the Runtime listens on |
| `host` | `HOST` | `127.0.0.1` | the address it listens on; loopback only, anything else is refused |
| `wispHome` | `WISP_HOME` | `~/.wisp` | the data directory; only from `--config` or the environment, never from a `runtime.json` found through it |
| `teeLlmModel` | `TEE_LLM_MODEL` | `auto:auto:best` | the model a Run uses when it does not name one |
| `maxConcurrentRuns` | `MAX_CONCURRENT_RUNS` | `3` | Runs executing at once across all Sessions |
| `maxQueuedRunsPerSession` | `MAX_QUEUED_RUNS_PER_SESSION` | `10` | Runs that may wait behind a Session's live one before the next is refused with `409` |
| `idempotencyTtlMs` | `IDEMPOTENCY_TTL_MS` | `86400000` (24 h) | how long a key names the Run it started — see [the key](runs-and-restarts.md#the-key) |
| `shutdownDrainTimeoutMs` | `SHUTDOWN_DRAIN_TIMEOUT_MS` | `5000` | how long a stop lets running Runs finish before it aborts them |
| `confirmTimeoutMs` | `CONFIRM_TIMEOUT_MS` | `7200000` (2 h) | how long an unanswered confirmation waits before it is denied |
| `llmStallTimeoutMs` | `LLM_STALL_TIMEOUT_MS` | `300000` | silence from the model after which a Run fails `stream_stalled` |
| `llmRequestTimeoutMs` | `LLM_REQUEST_TIMEOUT_MS` | `120000` | how long a model request may take to start answering |
| `contextWindowTokens` | `CONTEXT_WINDOW_TOKENS` | `262144` | the context window assumed when the model's own is not known |
| `graphRecursionLimit` | `GRAPH_RECURSION_LIMIT` | `500` | steps a turn may take before it fails `step_ceiling` |
| `toolCallLimit` | `TOOL_CALL_LIMIT` | `300` | tool calls a turn may make before it fails `step_ceiling` |
| `bashTimeout` | `BASH_TIMEOUT` | `30000` | how long one `bash_run` may take, in ms |
| `bashMaxOutput` | `BASH_MAX_OUTPUT` | `100000` | characters of a command's output the model sees |
| `fetchMaxLength` | `FETCH_MAX_LENGTH` | `50000` | characters of a fetched page the model sees |
| `fsMaxFileSize` | `FS_MAX_FILE_SIZE` | `10485760` (10 MiB) | the largest file the file tools read |
| `maxImageSizeBytes` | `MAX_IMAGE_SIZE_BYTES` | `10485760` (10 MiB) | the largest image a message may carry |
| `skillPaths` | `SKILL_PATHS` | none | extra folders of Skills, separated like `PATH` |

Durations are in milliseconds.
