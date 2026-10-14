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
# ✓ key: /home/you/.config/wisp/master.key
# ✗ service: wisp.service is inactive — systemctl --user restart wisp.service
# ✗ runtime: … — systemctl --user restart wisp.service
# ✓ sandbox: bubblewrap
# ✓ path: /home/you/.wisp/bin
```

One line per check: the config, the encryption key, the service, the Runtime, the login, the
proxy, the `bash_run` sandbox (Linux only) and `PATH`. The key line follows how the data
directory was made: `keyring` for one whose keys are in the OS keyring, `key` for one made
with a [key file](#the-encryption-key-on-a-server). `key` checks the file `wisp serve` would
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
- `host` is not a loopback address and `allowedHosts` is empty (see
  [reaching it from another machine](#reaching-it-from-another-machine));
- the OS keyring cannot store the encryption keys (on Linux: no keyring running, or it is
  locked). `wisp doctor` names the command that unlocks it;
- the [key file](#the-encryption-key-on-a-server) is inside the data directory, belongs to
  another user, is readable by others, or does not hold 32 bytes of base64;
- the key does not open the data directory's stored keys (a different key from the one it
  was made with), or the directory has data but its stored keys are missing;
- **another Runtime already uses this data directory.** The message says which one and its
  process id. Usually it is Wisp Desktop, or a `wisp serve` you forgot. Stop it, or give
  this one its own `WISP_HOME`.

Restarting does not fix any of these, which is why the systemd service does not restart
after a 78.

## Reaching it from another machine

The Runtime speaks plain HTTP, and one token authorises everything it does, `bash` included.
**That token must never cross a network in clear.** Put a reverse proxy that terminates TLS
in front of the Runtime, and give callers its `https://` address.

The proxy forwards the name the caller used (`wisp.example.com`) as the `Host` header. The
Runtime refuses any `Host` that is not loopback or listed in `allowedHosts`, which keeps a
web page from reaching it through DNS rebinding, so list that name. With the proxy on the
same machine, the Runtime stays on loopback:

```json
{ "agentToken": "…", "allowedHosts": ["wisp.example.com"] }
```

A [Caddy](https://caddyserver.com) site in front of it, which gets and renews the
certificate itself and streams the Event stream without buffering:

```text
wisp.example.com {
    reverse_proxy 127.0.0.1:3008
}
```

Then, from anywhere: `wisp status --url https://wisp.example.com --token …`.

With the proxy on another machine, also set `host` to the address the proxy connects to,
a private network address rather than `0.0.0.0`, and list that address in `allowedHosts`
as well: `wisp` on the Runtime's own machine finds it there. A non-loopback `host` with an empty
`allowedHosts` stops `wisp serve` with exit **78**. Opening the listener does not open the
Runtime to browsers: its CORS allowlist still names only local origins.

Wisp Desktop ignores `host`. It always listens on loopback and logs that it ignored the
setting.

## A token per device

Rather than copy the one token to every machine you work from, give each its own named
token, so that losing one laptop costs you that laptop's token alone. Run the command on the
Runtime's host, over SSH from the device the token is for, so the token is printed where it
will be used and never travels on its own:

```sh
ssh you@server wisp tokens create --name laptop --capability full
# prints the token and a connection string, once — neither is shown again
# Q2xhdWRlIHdyb3RlIHRoaXMgZXhhbXBsZSB0b2tlbg
# wisp+https://wisp.example.com#Q2xhdWRlIHdyb3RlIHRoaXMgZXhhbXBsZSB0b2tlbg
wisp tokens list
# laptop  full  2026-10-13T09:12:44.120Z
wisp tokens revoke laptop
# revoked laptop
```

A `full` token reaches everything the one token does except the tokens themselves: only the
one token creates, lists and revokes them (a named token gets `403`), so no token can mint one
that outlives its own revocation. A `run` token is for a Channel adapter. A revoked token is
refused with `401` from its next request on; the one token and every other named token keep
working. The Runtime keeps only a hash of each token in `global.db`.

The connection string, `wisp+<url>#<token>`, is the one line a device takes, Wisp Desktop's
field among them; the bare token is for a script or an adapter's config. The token sits in the
fragment, so a string pasted into a browser by mistake sends it to no server. The URL is:

- `--url` when you give it (with `--token`, the one token): the address this device reached;
- else `https://` and the host, when `allowedHosts` names exactly one;
- else the address `wisp` reaches the Runtime at on its host, `http://127.0.0.1:3008` by
  default. Reach it from the device through an SSH tunnel on the same port, so the string
  works unchanged: `ssh -N -L 3008:127.0.0.1:3008 you@server`.

## A Telegram bot

`wisp telegram` answers you in Telegram. It is the same binary, run as its own process beside
the Runtime: it reaches the Runtime only over `/v1`, with a `run` token, and reaches Telegram
by long polling, so it needs no public port and no TLS of its own.

1. Make a bot with [@BotFather](https://t.me/BotFather) and copy the token it gives you.
2. Allow `interactive` Runs: add it to `confirmationModes` in `runtime.json`
   (`"confirmationModes": ["policy", "interactive"]`) and restart the Runtime. Without it the
   bot answers every message with "Could not reach the agent", and its log shows `HTTP 403`.
3. Give the bot its own token, on the Runtime's host:

```sh
wisp tokens create --name telegram --capability run
export TELEGRAM_BOT_TOKEN=123456:ABC-your-bot-token
export WISP_URL=http://127.0.0.1:3008 WISP_TOKEN=<the run token>
wisp telegram
# No owner yet. Open https://t.me/your_bot?start=… and press Start, or send /pair … to the bot.
```

The bot token is read from `TELEGRAM_BOT_TOKEN` only, never from a flag, which a process listing
would show; for the same reason prefer `WISP_TOKEN` to `--token`, which `wisp telegram` also takes
with `--url`.

Open the link on your phone and press Start: you are the bot's owner. The code works once.
Each private chat is one Session, keyed `telegram:<chat id>`, so the agent remembers the
conversation; `wisp sessions list --origin telegram` lists them.

The bot answers only the people let in, and each of them drives the agent as you do, with the
same Connectors and memory. Anyone else who writes, a bare `/start` included, gets a pairing
code, and you get a card "Let @alice in?" with Allow and Deny. Allow lets them in and tells them
so; Deny, or no answer, leaves them out. Past that one reply the bot ignores them.

The same from the host, on the bot's state file, whether the bot is running or not:

```sh
wisp telegram pairing list               # who waits, and who is let in
wisp telegram pairing approve K7MZ4QXA   # the code the stranger passes on to you
wisp telegram pairing revoke 123456789   # a user id from the list
```

Someone let in from the command line is not told; their next message is simply answered. A
revoked user's next message starts no Run. The limits are Hermes's: a code expires in an hour;
a person gets one code per ten minutes; at most three wait at once, and a fourth is told to try
later; five wrong codes in a row given to `pairing approve` lock approving by code, and new
requests, for an hour, while the cards already sent still work.

To let people in without pairing, list their user ids, or a chat's id, in
`TELEGRAM_ALLOWED_IDS`, separated by commas (`TELEGRAM_ALLOWED_IDS=123456789,987654321`). An id
on the list is answered at once, even before the bot has an owner; to shut it out, take it off
the list and restart the bot.

The bot keeps its state in `$WISP_HOME/telegram.json` (`--state` puts it elsewhere): the owner,
the owner code until it is used, the users let in, the codes that wait, and its place in
Telegram's queue of messages, so a message sent while the bot was down (Telegram keeps them for
24 hours) is answered once it is back. Removing the file pairs a new owner and shuts out
everyone let in by pairing. Cards that approve a send are not in the bot yet: a Run that asks
before a send waits until the confirmation times out (`confirmTimeoutMs`, two hours by default)
and is then denied; the bot answers nothing else meanwhile. `/cancel` in the chat is not there
yet either: `wisp cancel <session>` on the host stops it.

## The encryption key on a server

A server's OS keyring does not survive a reboot, so on a server the Runtime takes its root
key from you instead: 32 random bytes as one base64 line.

```bash
mkdir -p ~/.config/wisp
(umask 077; openssl rand -base64 32 > ~/.config/wisp/master.key)
```

Pass it with `WISP_MASTER_KEY_FILE=/home/you/.config/wisp/master.key`, an absolute path:
a systemd `Environment=` line does not expand `~`. The file must belong to the
user running `wisp serve`, be readable by nobody else (`chmod 600`), and live outside the
data directory. Everything the Runtime would otherwise keep in the keyring, the login
among it, is stored encrypted under this key in `WISP_HOME/keys/`.

`WISP_MASTER_KEY` takes the same line directly. Prefer the file: an environment variable
can be read from `/proc/<pid>/environ` and shows up in a service manager's output
(`systemctl show`, a unit file).

**Back the key file up.** Without it the data directory cannot be opened: the Runtime
refuses to start (exit 78) rather than make new keys over your data. It makes them only in
an empty data directory.

## Why a Run failed

A failed Run has `failure.reason`, one of the values below, and a message that never quotes
the conversation. `wisp run` prints both on stderr.

| Reason | What happened | What to do |
| --- | --- | --- |
| `attestation_blocked` | the model's environment is not verified right now | retry later; see [attestation](#attestation) |
| `stream_stalled` | the model sent nothing for `llmStallTimeoutMs` (5 minutes) | retry |
| `context_overflow` | the conversation did not fit the model's context, even after compacting | start a new Session, or send less |
| `step_ceiling` | the Run hit `graphRecursionLimit` or `toolCallLimit` | split the task, or raise the limit |
| `output_schema_unsatisfied` | the agent did not hand over a value satisfying `outputSchema` in five attempts | simplify the schema, or say in `input` what each field holds |
| `unsupported_document` | a `document` block is neither a PDF nor a text type, or does not read as its type says (an encrypted, scanned or corrupt PDF; binary bytes under a text type) | send the text itself, or a PDF with a text layer |
| `transcription_failed` | an `audio` block is not OGG/Opus, MP3 or WAV (M4A is not accepted), does not decode as its type says, holds no speech, or the speech model could not be run | send the voice message as OGG/Opus, MP3 or WAV, or type it |
| `speech_not_installed` | an `audio` block arrived while the speech model is not installed, or still downloading | run `wisp speech install` (or `POST /v1/speech/download`), then send the voice message again |
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
# Runs that failed because the model's environment was not verified, or the plan ran out
journalctl --user -u wisp -o cat | jq -c 'select(.msg == "run.finished" and (.reason == "attestation_blocked" or .reason == "quota_exhausted"))'
```

In `text` format the same lines read `run.finished state=failed reason=quota_exhausted durationMs=5310`.
