---
sidebar_label: Troubleshooting
description: Health states, exit codes, why a Run failed, attestation, the audit, logs, and answers to common problems.
---

# Troubleshooting

## Is it up?

```sh
wisp status
# ready (wisp 0.1.0, serve)
# account  you@example.com
```

The answer is the state, the version, and which Runtime answered: `serve` for `wisp serve`
or the service, `desktop` for Wisp Desktop's. Below it are the signed-in account and, while
`bash_run` is not allowed, a line saying so. It comes from `GET /v1/health`, which also
reports `update` when a newer release exists. `GET /v1/health` without a token answers `200`
with an empty body, so a liveness probe needs no token, but only a request with the token
sees the state.

`GET /v1/ready` is a yes/no for whether a Run would be accepted now, along with
`proxyResolved`, `proxyFailed` and `attestationFailed`.

### `wisp doctor`

When `wisp status` gets no answer, or you do not know where to start:

```sh
wisp doctor
# ✓ config: /home/you/.wisp/runtime.json
# ✓ key: /home/you/.config/wisp/master.key
# ✗ service: wisp.service is inactive — systemctl --user restart wisp.service
# ✗ runtime: … — systemctl --user restart wisp.service
# ✓ path: /home/you/.wisp/bin
```

One line per check: the config, the encryption key, the service, the Runtime, the login, the
proxy, the `bash_run` sandbox (Linux only: `off`, or whether bubblewrap works while it is on;
absent while no Runtime answers) and `PATH`. The key line follows how the data
directory was made: `keyring` for one whose keys are in the OS keyring, `key` for one made
with a [key file](./remote-access.md#the-encryption-key-on-a-server). `key` checks the file `wisp serve` would
open, named by `WISP_MASTER_KEY_FILE` in your shell or else by the systemd service, and fails
with the reason `wisp serve` would refuse it; the key itself is never printed. Every `✗`
names what fixes it. It exits `0` when every check passes and `1` otherwise. `wisp doctor` needs no
running Runtime, and any command that finds none (exit code `4`) points at it.

### The five states

| State | Meaning | What to do |
| --- | --- | --- |
| `booting` | starting: checking the login, the proxy and the attestation | wait; if it never leaves this state, read the [log](#logs) |
| `ready` | Runs will run | nothing |
| `login_required` | not signed in, or the login was lost | `wisp login` (or `wisp login --manual` on a server) |
| `proxy_failed` | signed in, but the Wisp proxy did not answer | check that this machine can reach the internet; Runs fail with `network` or `server_error` |
| `attestation_failed` | the Wisp proxy's trusted environment could not be verified, so Wisp will not send it anything | nothing to fix locally; see [attestation](#attestation) |

`login_required` is the only state that needs a person.

## Exit codes

Every `wisp` command except `wisp serve`:

| Code | Meaning |
| --- | --- |
| `0` | done: the Run completed, or the command succeeded |
| `1` | the Run failed or was cancelled, or the request was refused |
| `2` | the command line was wrong; the message shows the right usage |
| `3` | an `interactive` Run parked on a Prompt; answer it with `wisp confirm` |
| `4` | no Runtime is running, or none answered where `runtime.lock`, `--url` or `WISP_URL` said |
| `5` | the Runtime refused the token |
| `130` | Ctrl-C while the command was waiting for you to paste something |

`wisp serve` exits `2` for a flag it does not know, and has one more code: **78**, a
configuration problem. It exits before serving anything and says which of these it is:

- no `agentToken`, or one shorter than 32 characters;
- `runtime.json` is not valid JSON, is not an object, or has a key that is not a known
  setting (usually a typo; see the [Reference](./reference.md#configuration));
- `runtime.json` belongs to another user, or holds `agentToken` and others can read it
  (`chmod 600` it);
- `wispHome` is set inside a `runtime.json` that was itself found through `WISP_HOME`;
- the port is already taken;
- `host` is not a loopback address and `allowedHosts` is empty (see
  [reaching it from another machine](./remote-access.md#reaching-it-from-another-machine));
- the OS keyring cannot store the encryption keys (on a Mac, a locked keychain). `wisp
  doctor` names the command that unlocks it;
- on Linux, `WISP_MASTER_KEY_FILE` is not set: `wisp serve` there keeps its key in a
  [key file](./remote-access.md#the-encryption-key-on-a-server), never in a keyring. The installer's service
  sets it for you;
- the [key file](./remote-access.md#the-encryption-key-on-a-server) is inside the data directory, belongs to
  another user, is readable by others, or does not hold 32 bytes of base64;
- the key does not open the data directory's stored keys (a different key from the one it
  was made with), or the directory has data but its stored keys are missing;
- the data directory was made with a key file and `WISP_MASTER_KEY_FILE` is not set, or it
  keeps its keys in the OS keyring and `WISP_MASTER_KEY_FILE` is set. A directory stays
  with the way it was made: unset or set the variable, or give this Runtime its own
  `WISP_HOME`;
- **another Runtime already uses this data directory.** The message says which one and its
  process id. Usually it is Wisp Desktop, or a `wisp serve` you forgot. Stop it, or give
  this one its own `WISP_HOME`.

Restarting does not fix any of these, which is why the systemd service does not restart
after a 78.

## Why a Run failed

A failed Run has `failure.reason`, one of the values below, and a message that never quotes
the conversation. `wisp run` prints both on stderr.

| Reason | What happened | What to do |
| --- | --- | --- |
| `attestation_blocked` | the Wisp proxy's environment is not verified right now | retry later; see [attestation](#attestation) |
| `stream_stalled` | the model sent nothing for `llmStallTimeoutMs` (5 minutes) | retry |
| `context_overflow` | the conversation did not fit the model's context, even after compacting | start a new Session, or send less |
| `step_ceiling` | the Run hit `graphRecursionLimit` or `toolCallLimit` | split the task, or raise the limit |
| `output_schema_unsatisfied` | the agent did not hand over a value satisfying `outputSchema` in five attempts | simplify the schema, or say in `input` what each field holds |
| `unsupported_document` | a `document` block is neither a PDF nor a text type, or does not read as its type says (binary bytes under a text type). A PDF whose text cannot be extracted (a scan, a password, a damaged file) does not fail the Run: the agent is told it could not read it | send the text itself, or a PDF with a text layer |
| `transcription_failed` | an `audio` block is not OGG/Opus, MP3 or WAV (M4A is not accepted), does not decode as its type says, holds no speech, or the speech model could not be run | send the voice message as OGG/Opus, MP3 or WAV, or type it |
| `speech_not_installed` | an `audio` block arrived while the speech model is not installed, or still downloading | run `wisp speech install` (or `POST /v1/speech/download`), then send the voice message again |
| `shutdown` | the Runtime stopped during the Run | retry with the same key once it is `ready` |
| `quota_exhausted` | the account's plan is used up | check your account |
| `not_entitled` | the account's plan does not include what was asked for | check your account |
| `billing_unavailable` | the plan could not be checked | retry |
| `rate_limit` | throttled, and the retries ran out | wait, then retry |
| `server_error` | the model side kept failing | retry |
| `network` | could not connect to the model | check the internet connection, then retry |
| `internal` | anything else | the message is deliberately generic; report it |

A tool refused by [Permissions](./permissions.md) is not a failure: the Run completes with
that call marked `ok: false`.

## A tool was refused

Check `wisp audit <session>`. A row with `error` and `ask` is a call refused because no Rule
allowed it. Run `wisp permissions get --project <folder>` to see the decisions, then allow
what the agent needs. See [Permissions](./permissions.md).

If the agent says a connector is not enabled, run the `wisp connectors enable` command it
gives you.

## Attestation

Before Wisp sends anything to the Wisp proxy, through which every model call goes, it
verifies that the proxy runs in a genuine trusted execution environment, and it keeps
checking.

- **The verification service could not be reached:** Wisp keeps using the last good result
  for a grace period and retries.
- **The verification failed:** Wisp stops sending to the model at once, and stays stopped
  until a verification succeeds again.

While it is stopped, Runs fail with `attestation_blocked`, and everything that goes through
the proxy stops with them: the connectors it hosts (Gmail, Calendar, Drive, web search and
fetch) and `wisp models`. Sessions, history, your own connectors and the audit keep working.
No setting turns the check off, so when the proxy cannot be verified, Wisp's model is
unavailable. Build your retry policy around that.

```sh
curl -sS "$URL/v1/attestation" -H "Authorization: Bearer $TOKEN"              # the current result
curl -sS -X POST "$URL/v1/attestation/refresh" -H "Authorization: Bearer $TOKEN" # check again now
```

## Logs

| Running as | Log |
| --- | --- |
| systemd service | `journalctl --user -u wisp -f` |
| launchd service | `~/.wisp/logs/serve.log` |
| `wisp serve` | the terminal it runs in |

Logs never contain conversation content, so they are safe to read and to share.

### Counting Runs and tool calls

There is no metrics endpoint. Two lines carry the counts instead; with
[`logFormat: json`](./reference.md) each is one object with `ts`, `level`, `component`,
`msg`, `runId` and `sessionId`, plus the fields below.

| `msg` | Written | Fields |
| --- | --- | --- |
| `run.finished` | once when a Run ends | `state`: `completed`, `failed` or `cancelled`; `reason`: the [failure reason](#why-a-run-failed), only when `failed`; `durationMs`: from the Run's acceptance to its end, queueing included |
| `tool.call` | once per tool call, a subagent's included | `tool`: the tool's name, `mcp__<connector>__<tool>` for a connector's; `outcome`: `ok`, `error`, or `denied` when [Permissions](./permissions.md) refused it; `durationMs` |

Every value is from these closed sets or a tool name. The `final_output` call of a Run with
an `outputSchema` writes no `tool.call`, as it is not listed in `toolCalls` either.

```sh
# Runs that failed because the proxy was not verified, or the plan ran out
journalctl --user -u wisp -o cat | jq -c 'select(.msg == "run.finished" and (.reason == "attestation_blocked" or .reason == "quota_exhausted"))'
```

In `text` format the same lines read `run.finished state=failed reason=quota_exhausted durationMs=5310`.

## FAQ

**The Telegram bot or the Slack app answers "This Wisp takes no chat messages".**
`confirmationModes` leaves out `interactive`. Add it back, or remove the key to take the
default, and restart the Runtime. See [Configuration](./configuration.md#stop-callers-from-asking-for-approvals).

**The Telegram bot or the Slack app answers "Could not reach the agent".**
Its log says why. Usually `HTTP 403`: its `run` token was made without `--channel`. See
[the Telegram bot](./telegram-bot.md) and [the Slack app](./slack-app.md).

**`wisp stop` says it takes no `--url`/`--token`.**
`WISP_URL` or `WISP_TOKEN` is set in your shell. `wisp stop` works only through
`runtime.lock`: unset them, then run it again.

**`wisp serve` on Linux exits with 78.**
It names the reason; the list is under [Exit codes](#exit-codes). Most often
`WISP_MASTER_KEY_FILE` is not set, or the key file is readable by others. See
[the encryption key on a server](./remote-access.md#the-encryption-key-on-a-server).

**The agent cannot search the web from `wisp run`.**
The web search and fetch tools default to `ask`, and a CLI Run has nobody to ask, so they
are refused. `wisp permissions get --project .` lists their names; allow them with
`wisp permissions set <tool> allow --project .`. See
[Permissions](./permissions.md#where-a-decision-comes-from).

**The agent sees a connector's tools, but every call is refused.**
The connector is enabled but its tools are not allowed:
`wisp permissions allow-connector <name> --project .`. See [Connectors](./connectors.md).

**A voice message is not transcribed.**
The Run failed with `speech_not_installed`: the speech model is installed only on request.
Run `wisp speech install`, then send the message again. See [Speech](./reference.md#speech).

**Another machine cannot reach the Runtime.**
It listens on loopback only. Put a TLS reverse proxy in front of it and list its name in
`allowedHosts`: see [Reaching it from another machine](./remote-access.md#reaching-it-from-another-machine).

**A laptop with a token was lost.**
Revoke that device's token with `wisp tokens revoke <name>`; the others keep working. See
[A token per device](./remote-access.md#a-token-per-device).
