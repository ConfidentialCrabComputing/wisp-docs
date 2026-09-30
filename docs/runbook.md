---
sidebar_position: 7
description: Health states, exit codes, why a Run failed, and what the attestation gate promises.
---

# States and the runbook

## Is it up?

```sh
wisp status
# ready (wisp 0.1.0, serve)
```

That is `GET /v1/health`, which always answers `200` — the probe's question is "is the
process up", and the state is the body: `status`, `version`, `kind`, and `update` when a
newer release exists. It is the one route exempt from the bearer token, so an init system can
read it before anything holds one.

`GET /v1/ready` is the boolean an orchestrator gates on: `ready`, alongside `proxyResolved`,
`proxyFailed` and `attestationFailed`.

### The five states

| `status` | what it means | what to do |
| --- | --- | --- |
| `booting` | up, still resolving the login, the proxy and the first attestation | wait; if it never leaves, read the journal |
| `ready` | Runs will run | — |
| `login_required` | no Account Login, or it was lost — the process is up but cut off from the proxy | `wisp login --manual`, on any machine with a browser |
| `proxy_failed` | there is a login, the proxy did not answer (or its catalog fetch failed) | check egress from this host to the proxy; Runs fail `network` or `server_error` |
| `attestation_failed` | attestation produced a verdict that is not usable, so the LLM channel is shut | nothing local fixes a bad verdict — see below |

`login_required` is never merely "unready": it is the one state that needs a person.

## Exit codes

Every client command — `wisp run`, `wisp sessions`, `wisp permissions`, and the rest:

| code | meaning |
| --- | --- |
| `0` | completed |
| `1` | the Run failed or was cancelled, or a command was answered with a no |
| `2` | the command line could not be acted on |
| `4` | no Runtime answered where the lock file or the flags said one would |
| `5` | the token was refused |
| `130` | Ctrl-C at a prompt — a login's redirect URL, or a secret read from the terminal |

`wisp serve` has one of its own: **78** (`EX_CONFIG`). It exits before serving anything and
says which of these it was:

- `agentToken` missing, or under 32 characters;
- `runtime.json` is not valid JSON, is not an object, or holds a key the schema does not
  know — a typo that silently fell back to a default is exactly what this exists for;
- `runtime.json` is owned by another user;
- `wispHome` appears in a file that was itself found through `WISP_HOME`;
- the data directory is **already served** by another Runtime. The message names that
  Runtime's kind and pid: stop it, or give this one its own `WISP_HOME`. One data directory
  is one Runtime, and the desktop's sidecar is a Runtime like any other.

None of it is retryable, which is why the service unit carries
`RestartPreventExitStatus=78`.

## Why a Run failed

A failed Run carries `failure.reason` from a closed set, and a message that never quotes the
conversation.

| `reason` | what happened | operator's move |
| --- | --- | --- |
| `attestation_blocked` | the attestation gate is shut | a Blackout; retry policy is the only answer |
| `stream_stalled` | the model produced nothing for `llmStallTimeoutMs` (five minutes) | retry; the Run was cut rather than left hanging |
| `context_overflow` | the turn did not fit its context window even after compaction | a prompt or a Project problem, not a host one |
| `step_ceiling` | the graph hit `graphRecursionLimit` or `toolCallLimit` | same |
| `confirmation_pending` | the Session still waits on a tool confirmation asked in the desktop, so the Run was refused before it started | answer it there, then send again |
| `shutdown` | the Runtime stopped under it | retry with the same key once health is `ready` |
| `quota_exhausted` | the account's plan is used up | account, not host |
| `not_entitled` | the account may not use what was asked for | account, not host |
| `billing_unavailable` | entitlement could not be checked | transient; retry |
| `rate_limit` | throttled, and the retries ran out | back off, then retry |
| `server_error` | the model side kept failing | retry |
| `network` | the model call kept failing to connect | check egress, then retry |
| `internal` | anything else | the message is content-free on purpose; the cause is in diagnostics |

Under `policy` there is no `confirmation_timeout`, because no Run ever waits on a person.

## The attestation gate, and the honest SLA

The Runtime is the proxy's data plane, and the gate is enforced per request. A Transport
Failure — the collateral could not be fetched — is graced and retried
(`reAttestTransientGrace`). A Cryptographic Verdict — a quote that does not verify — blocks
immediately and is Sticky: the channel stays shut until an attestation succeeds again.

Which means, plainly: **a Runtime's availability is bounded by the proxy's attested
availability, and there is no local override.** Your retry policy is where availability is
bought. During a Blackout, Runs fail `attestation_blocked` and everything that is not the
model — Sessions, history, connectors, audit — keeps working.

```sh
curl -sS "$URL/v1/attestation" -H "Authorization: Bearer $TOKEN"        # the current verdict and mode
curl -sS -X POST "$URL/v1/attestation/refresh" -H "Authorization: Bearer $TOKEN"
```

## The audit

```sh
wisp audit <session>
# 2026-09-18T11:04:22Z  mcp__chatstore__read_thread  ok     380ms  allow
# 2026-09-18T11:04:23Z  mcp__chatstore__post_message error    1ms  ask
```

Newest first: when, which tool, whether it succeeded, how long it took, and the Decision the
Rules produced — `ask` above, because under `policy` an `ask` is a deny. `GET /v1/audit` is
the Runtime-wide listing behind it, narrowed with `sessionId`, paged with `limit` and
`cursor`. No row carries what a tool sent or received.

## Logs

`journalctl --user -u wisp -f` when the installer wrote the service unit. Logs carry no
conversation content, so they are safe to read and to forward. Structured JSON logs and a
metrics endpoint are phase 2.
