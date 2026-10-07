---
description: What Wisp protects against, what it does not, and where secrets live.
---

# Security

## The boundary is your OS user

Wisp trusts every process running as the same operating-system user as the Runtime. That is
the same line Chrome, Docker Desktop and password managers draw: if something hostile
already runs as you, the Runtime's token is not what stands between it and your data.

The token, the loopback-only listener, and the `Host` and CORS checks protect against
everything that is **not** your user:

- a web page in your browser calling `http://127.0.0.1:3008/v1/…`;
- other accounts on the same machine;
- anything on the network. The Runtime only listens on `127.0.0.1`, and any other `host`
  setting is refused.

Protecting against your own user (checking which program is calling, guarding the Project
folder or the binary) is outside what Wisp does.

## The token and the lock file

The token is in `runtime.json`, which the installer creates readable only by you. The
running Runtime writes its address and token to `runtime.lock`, also readable only by you,
so that the CLI and adapters can find it. That gives nothing new to your own processes,
which could already read the Runtime's environment, and nothing to other users.

On Windows there are no Unix file modes; both files sit under your user profile, which only
you can read.

A token can do what Wisp Desktop's chat can do: run prompts, change Rules, manage
connectors, read the audit. It cannot stop the Runtime, because there is no stop endpoint.
Treat a leaked token like a leaked password: change `agentToken` in `runtime.json` and
restart.

## Nobody approves anything mid-Run, unless you allow it

A Run started from the CLI or `/v1` runs under the `policy` confirmation mode by default:
any tool whose decision is `ask` is refused, and the agent continues without it. Only tools
a Rule explicitly allows can act. An operator who adds `interactive` to `confirmationModes`
lets a caller ask for that mode instead: the Run then parks on an `ask`, and whoever holds
the token and the Run's id can approve it.

The consequence: if a web page, a connector result or a document tries to get the agent to
"send this", **the default result is a refusal**, not an approval card that nobody sees.
That puts all the weight on your Rules. See [Permissions](./permissions.md), including the
warnings about [`bash_run`](./permissions.md#bash_run).

## What reaches the model

Every connector result goes through one filter that removes control characters, invisible
and bidirectional characters, and Wisp's own framing tags, so a tool's output cannot pretend
to be part of the conversation's structure. What the filter cannot tell is who wrote a line;
see [Who wrote what](./adapter-contract.md#who-wrote-what).

Approval requests carry ids and fields Wisp names itself, never text the model chose.

The model runs inside a trusted execution environment, and Wisp sends it nothing unless that
environment is verified. See [Attestation](./runbook.md#attestation).

## Secrets

- **On disk:** the stores are encrypted with SQLCipher, and the key is kept in the OS
  keychain. Connector secrets live in that encrypted store, never in a Project folder.
- **On the way in:** `--header-stdin` and `--api-hash-stdin` read a secret from the
  terminal, because a command line can be seen by other users on the machine.
- **`runtime.json`:** a file owned by another user is refused (exit 78). A file of yours
  that others can read gets a warning to `chmod 600` it.

## Not available yet

Named tokens with narrower permissions, listening beyond loopback, and TLS are planned. Until
then, if something on another machine has to reach a Runtime, tunnel to its loopback port
(for example with `ssh -L`) instead of exposing it.
