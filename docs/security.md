---
description: What Wisp protects against, what it does not, and where secrets live.
---

# Security

## The boundary is your OS user

Wisp trusts every process running as the same operating-system user as the Runtime. That is
the same line Chrome, Docker Desktop and password managers draw: if something hostile
already runs as you, the Runtime's token is not what stands between it and your data.

The token, the loopback listener, and the `Host` and CORS checks protect against
everything that is **not** your user:

- a web page in your browser calling `http://127.0.0.1:3008/v1/…`;
- other accounts on the same machine;
- anything on the network. By default the Runtime listens on `127.0.0.1` only. A `host`
  other than loopback works only together with `allowedHosts`, and the token must then reach
  it over TLS: see [Reaching it from another machine](./remote-access.md#reaching-it-from-another-machine).

Protecting against your own user (checking which program is calling, guarding the Project
folder or the binary) is outside what Wisp does.

## The token and the lock file

The token is in `runtime.json`, which the installer creates readable only by you. The
running Runtime writes its address and token to `runtime.lock`, also readable only by you,
so that the CLI and adapters can find it. That gives nothing new to your own processes,
which could already read the Runtime's environment, and nothing to other users.

On Windows there are no Unix file modes; both files sit under your user profile, which only
you can read.

There are three kinds of token:

| Token | What it can do |
| --- | --- |
| the one token (`agentToken`) | everything Wisp Desktop's chat can do — run prompts, change Rules, manage connectors, read the audit — and create, list and revoke the named tokens |
| a named `full` token | the same, except the named tokens themselves |
| a named `run` token | only what a Channel adapter needs: open Sessions on the Desk, start Runs in them, read every Session and Run, cancel any Session's Run, answer the Prompts of Runs it started (approve or deny only), deliver to its own Channel, and install the speech model |

No token can stop the Runtime: there is no stop endpoint.

Treat a leaked token like a leaked password. A named one: `wisp tokens revoke <name>`, and
the others keep working. The one token: change `agentToken` in `runtime.json` and restart.
See [A token per device](./remote-access.md#a-token-per-device).

## Nobody approves anything mid-Run, unless you allow it

A Run started from the CLI or `/v1` runs under the `policy` confirmation mode unless it asks
for another: any tool whose decision is `ask` is refused, and the agent continues without
it. Only tools a Rule explicitly allows can act. A caller may ask for the `interactive` mode
instead, which `confirmationModes` allows by default: the Run then parks on an `ask`, and
whoever holds the token and the Run's id can approve it. Set `confirmationModes` to
`["policy"]` to refuse that, which also stops the chat bots.

The consequence: if a web page, a connector result or a document tries to get the agent to
"send this", **the default result is a refusal**, not an approval card that nobody sees.
That puts all the weight on your Rules. See [Permissions](./permissions.md), including the
warnings about [`bash_run`](./permissions.md#bash_run).

Keep the `bash_run` [sandbox](./sandbox.md) on. Without it (`wisp sandbox off`) a `bash_run`
command runs as the Runtime's own user and can read the key source.

## What reaches the model

Every connector result goes through one filter that removes control characters, invisible
and bidirectional characters, and Wisp's own framing tags, so a tool's output cannot pretend
to be part of the conversation's structure. What the filter cannot tell is who wrote a line;
see [Who wrote what](./adapter-contract.md#who-wrote-what).

An approval request names the tool and its arguments. The arguments are what the model
wrote, a drafted message among them, so read them before you approve.

The model is reached through the Wisp proxy, which runs inside a trusted execution
environment, and the Runtime sends the proxy nothing unless that environment is verified:
no prompt, no web search, no Gmail, Calendar or Drive call. Traffic that does not go through
the proxy is not gated: your own connectors, the Telegram connector, sign-in and the update
check. See [Attestation](./runbook.md#attestation).

## Secrets

- **On disk:** the stores are encrypted with ChaCha20-Poly1305. The key is kept in the OS
  keychain, or, on a server, sealed in the data directory under a
  [key file](./remote-access.md#the-encryption-key-on-a-server) kept outside it. Connector
  secrets live in that encrypted store, never in a Project folder.
- **The audit** keeps each tool call's arguments and result, cut short and with values
  under secret-looking names such as `token` or `password` replaced by `[REDACTED]`. A text
  a tool sent is in it.
- **On the way in:** `--header-stdin` and `--api-hash-stdin` read a secret from the
  terminal, because a command line can be seen by other users on the machine.
- **`runtime.json`:** a file owned by another user is refused (exit 78), and so is a file
  holding a secret that others can read: `chmod 600` it.
- **`telegram.json`** holds the bot's token and its `run` token once `wisp telegram setup`
  has run, and is written readable only by you.

## Not available yet

The Runtime does not terminate TLS itself. To reach it from another machine, put a reverse
proxy with TLS in front of it, or tunnel to its loopback port (for example with `ssh -L`).
