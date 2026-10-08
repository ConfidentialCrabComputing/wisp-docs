---
sidebar_label: Troubleshooting
description: Health states, exit codes, why a Run failed, attestation, the audit and logs.
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
# ✓ keyring
# ✗ service: wisp.service is inactive — systemctl --user restart wisp.service
# ✗ runtime: … — systemctl --user restart wisp.service
# ✓ sandbox: bubblewrap
# ✓ path: /home/you/.wisp/bin
```

One line per check: the config, the OS keyring, the service, the Runtime, the login, the
proxy, the `bash_run` sandbox (Linux only) and `PATH`. Every `✗` ends with the command that
fixes it. It exits `0` when every check passes and `1` otherwise. `wisp doctor` needs no
running Runtime, and any command that finds none (exit code `4`) points at it.

### The five states

| State | Meaning | What to do |
| --- | --- | --- |
| `booting` | starting: checking the login, the proxy and the attestation | wait; if it never leaves this state, read the [log](#logs) |
| `ready` | Runs will run | nothing |
| `login_required` | not signed in, or the login was lost | `wisp login` (or `wisp login --manual` on a server) |
| `proxy_failed` | signed in, but the Wisp proxy did not answer | check that this machine can reach the internet; Runs fail with `network` or `server_error` |
| `attestation_failed` | the model's environment could not be verified, so Wisp will not send it anything | nothing to fix locally; see [attestation](#attestation) |

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

`wisp serve` has one more: **78**, a configuration problem. It exits before serving
anything and says which of these it is:

- no `agentToken`, or one shorter than 32 characters;
- `runtime.json` is not valid JSON, is not an object, or has a key that is not a known
  setting (usually a typo; see the [Reference](./reference.md#configuration));
- `runtime.json` belongs to another user;
- `wispHome` is set inside a `runtime.json` that was itself found through `WISP_HOME`;
- the port is already taken;
- the OS keyring cannot store the encryption keys (on Linux: no keyring running, or it is
  locked). `wisp doctor` names the command that unlocks it;
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
| `attestation_blocked` | the model's environment is not verified right now | retry later; see [attestation](#attestation) |
| `stream_stalled` | the model sent nothing for `llmStallTimeoutMs` (5 minutes) | retry |
| `context_overflow` | the conversation did not fit the model's context, even after compacting | start a new Session, or send less |
| `step_ceiling` | the Run hit `graphRecursionLimit` or `toolCallLimit` | split the task, or raise the limit |
| `confirmation_pending` | the Session is waiting for a tool approval in Wisp Desktop | answer it in the app, then send again |
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

Before Wisp sends anything to the model, it verifies that the model runs in a genuine
trusted execution environment, and it keeps checking.

- **The verification service could not be reached:** Wisp keeps using the last good result
  for a grace period and retries.
- **The verification failed:** Wisp stops sending to the model at once, and stays stopped
  until a verification succeeds again.

While it is stopped, Runs fail with `attestation_blocked`. Everything else keeps working:
Sessions, history, connectors and the audit. There is no local override, so when the
model's environment cannot be verified, Wisp's model is unavailable. Build your retry policy
around that.

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
