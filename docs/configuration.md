---
description: Where the Runtime's settings live, how the file and the environment combine, and the changes people make most.
---

# Configuration

The Runtime reads its settings once, when it starts. After a change, restart it: `wisp
stop` and `wisp serve`, or [restart the service](./install.md#run-it-as-a-service). This
page explains how settings work and walks through common changes. Every key, with its
default, is in [the Reference](./reference.md#configuration).

## The file

Settings live in `$WISP_HOME/runtime.json`, `~/.wisp/runtime.json` by default. It is one
JSON object:

```json
{ "agentToken": "…", "port": 3008 }
```

The installer writes it with a fresh `agentToken` only, readable by you alone. Everything
else takes its default until you add it.

`wisp serve` refuses to start, with exit code **78**, when the file:

- is not valid JSON, or not a JSON object;
- has a key the Runtime does not know, so a typo never falls back to the default silently;
- belongs to another user;
- holds a secret, such as `agentToken`, and others can read it. Fix it with
  `chmod 600 ~/.wisp/runtime.json`.

`wisp doctor` names the problem and the command that fixes it. See
[Troubleshooting](./runbook.md#wisp-doctor).

`wisp serve --config <path>` reads another file instead. `wisp serve --home <dir>` keeps
the data in `<dir>` and reads `<dir>/runtime.json`, as `WISP_HOME=<dir>` does; set
`WISP_HOME` for the other `wisp` commands too, so they find that Runtime. `wispHome` (the
data directory) can be set in a file only through `--config`, never in a `runtime.json`
found through `WISP_HOME`.

## The environment

Each key has an environment variable, listed next to it in
[the Reference](./reference.md#configuration): `PORT` for `port`, `TEE_LLM_MODEL` for
`teeLlmModel`, and so on. The order is:

1. the environment variable, when it is set;
2. else the key in `runtime.json`;
3. else the default.

The installed `wisp` reads no `.env` file. Only a Runtime run from source reads one.

Lists, such as `ALLOWED_HOSTS` and `CONFIRMATION_MODES`, are comma-separated in the
environment and JSON arrays in the file.

## Common changes

### Open the Runtime to another machine

The Runtime listens on `127.0.0.1`. To reach it from elsewhere, put a reverse proxy with TLS
in front of it and list the name callers use in `allowedHosts`:

```json
{ "agentToken": "…", "allowedHosts": ["wisp.example.com"] }
```

Never send the token over a network in clear. [Remote access](./remote-access.md) has the
whole setup, a token per device, and the encryption key a Linux server needs.

To use the Runtime from Wisp Desktop on another machine, you need none of this: the app
reaches it over SSH and the Runtime stays on loopback. See
[Connect to a server](./desktop/connect-to-a-server.md).

### Stop callers from asking for approvals

By default a `/v1` Run may wait for a person's approval: the
[Telegram bot](./telegram-bot.md), the [Slack app](./slack-app.md) and
`wisp run --interactive` need that. To refuse every such Run instead, leave `interactive` out:

```json
{ "agentToken": "…", "confirmationModes": ["policy"] }
```

`policy` is always allowed, whether listed or not. A Run that asks for a mode left out is
refused with `403`, and the bot and the app then take no chat messages. See
[approvals](./adapter-contract.md#approvals).

### Change the default model

A Run that names no model uses `teeLlmModel`. Its default, `auto:auto:best`, lets the proxy
choose. To use one model, or one tier, for every Run that does not ask otherwise:

```sh
wisp models                     # the ids and tiers you can name
```

```json
{ "agentToken": "…", "teeLlmModel": "tier:<name>" }
```

A single Run can still choose its own with `wisp run --model`. See
[Choosing a model](./cli.md#choosing-a-model).

### Change the port

```json
{ "agentToken": "…", "port": 3010 }
```

`wisp` on the same machine finds the new port by itself, through `~/.wisp/runtime.lock`.
Another machine needs the new address.

## Variables outside runtime.json

A few settings belong to other processes, or are read only from the environment.

| variable | read by | what it does |
| --- | --- | --- |
| `TELEGRAM_ALLOWED_IDS` | `wisp telegram` | users and chats let in without pairing, comma-separated — see [Letting people in](./telegram-bot.md#letting-people-in) |
| `SLACK_ALLOWED_IDS` | `wisp slack` | users and channels let in without pairing, comma-separated — see [Letting people in](./slack-app.md#letting-people-in) |
| `TELEGRAM_BOT_TOKEN` | `wisp telegram` | the bot's token, instead of the one `wisp telegram setup` stored |
| `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` | `wisp slack` | the app's two tokens, instead of the ones `wisp slack setup` stored |
| `TELEGRAM_API_URL` | `wisp telegram` | the Bot API's address instead of `https://api.telegram.org`, for a Bot API server of your own |
| `SLACK_API_URL` | `wisp slack` | the Web API's address instead of `https://slack.com/api` |
| `WISP_URL`, `WISP_TOKEN` | every `wisp` command | the Runtime to reach and its token — see [Reaching a Runtime](./cli.md#reaching-a-runtime) |
| `WISP_MASTER_KEY_FILE` | `wisp serve` | the file holding the root key, on a server — see [the encryption key](./remote-access.md#the-encryption-key-on-a-server) |

`TELEGRAM_API_URL` and `SLACK_API_URL` must be `https`, or plain `http` to a loopback
address: the bot's tokens travel in every call. An id in an allow list that is not a valid
id stops the bot or the app before it starts.

`WISP_KEY_BACKEND=file` is for tests: it stores the Runtime's keys unencrypted beside the
data they protect. On a server, use `WISP_MASTER_KEY_FILE` instead.
