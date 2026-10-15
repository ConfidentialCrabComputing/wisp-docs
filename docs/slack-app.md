---
sidebar_label: Slack app
description: Talk to the agent from Slack — create the app from a manifest, pair its owner, and let your team in.
---

# A Slack app

`wisp slack` answers you and your team in Slack. It is the same binary, run as its own process
beside the Runtime: it reaches the Runtime only over `/v1`, with a `run` token, and reaches
Slack over Socket Mode, so it needs no public port and no TLS of its own.

## 1. Create the app

At [api.slack.com/apps](https://api.slack.com/apps), choose **Create New App → From a
manifest**, pick the workspace, and paste:

```yaml
display_information:
  name: Wisp
features:
  bot_user:
    display_name: Wisp
    always_online: true
  app_home:
    messages_tab_enabled: true
    messages_tab_read_only_enabled: false
oauth_config:
  scopes:
    bot: [chat:write, im:write, im:history, channels:history, groups:history, mpim:history, files:read, files:write, channels:read, groups:read, users:read]
settings:
  event_subscriptions:
    bot_events: [message.im, message.channels, message.groups, message.mpim]
  interactivity:
    is_enabled: true
  socket_mode_enabled: true
```

## 2. Copy its two tokens

1. **Install to Workspace**, then copy the **Bot User OAuth Token** (`xoxb-…`) from *OAuth &
   Permissions*.
2. Under *Basic Information → App-Level Tokens*, generate a token with the `connections:write`
   scope and copy it (`xapp-…`).

## 3. Allow `interactive` Runs

Add `interactive` to `confirmationModes` in `runtime.json` and restart the Runtime:

```json
{ "agentToken": "…", "confirmationModes": ["policy", "interactive"] }
```

:::warning
Without `interactive` in `confirmationModes` the app answers every message with "Could not
reach the agent", and its log shows `HTTP 403`.
:::

## 4. Give it a token and run it

```sh
wisp tokens create --name slack --capability run --channel slack
export SLACK_BOT_TOKEN=xoxb-… SLACK_APP_TOKEN=xapp-…
export WISP_URL=http://127.0.0.1:3008 WISP_TOKEN=<the run token>
wisp slack
# No owner yet. Send @wisp a direct message: !pair …
```

Both Slack tokens are read from the environment only, never from a flag. To run the app on
another machine than the Runtime, see [Remote access](./remote-access.md).

:::warning
The `run` token must be made with `--channel slack`. Without `--channel` the Runtime refuses
the app's Runs with `403`.
:::

## 5. Become its owner

Send the app the `!pair …` line in a direct message: you are its owner. The code works once.

## Commands

Slack takes a message that starts with `/` for one of its own commands, so the app's commands
start with `!`. In a thread you can also mention the app and write the command with a `/`, as in
`@Wisp /new`. In a channel, a command works only inside a thread.

| Command | What it does |
| --- | --- |
| `!new` | Your next message starts a fresh Session. |
| `!sessions` | Lists the last ten Sessions. |
| `!resume <n>` | Goes back to Session number `n` from that list. |
| `!cancel` | Stops the running request. |

## Where the app answers

- **A direct message** with the app is one Session, keyed `slack:<bot user id>:<DM id>`.
- **A channel**: first invite the app (`/invite @Wisp`). Slack sends the app nothing from a
  channel it is not in. The app answers only when mentioned (`@Wisp …`). It replies in a thread under
  that message, and the thread is its own Session, keyed `slack:<bot user id>:<channel id>:<thread ts>`. Anyone
  let in can carry on in that thread without mentioning the app again. Each new mention starts
  another thread and another Session.
- **A channel the owner has not approved**: the first mention there gets a pairing code, and you
  get a card to approve the channel. Approving a channel lets no one in; its members are let in
  each on their own.
- **A thread started by someone not let in**: when a participant asks the app about it, the
  thread's first message reaches the agent marked as a third party's, as data rather than an
  instruction.

`wisp sessions list --origin slack` lists the app's Sessions.

## Files

Images (PNG, JPEG, GIF, WebP) and files up to 20 MB each, 100 MB in all per message, that you share with the app reach the
agent with your message; a PDF or a text file is read as its text. Files the agent writes are
uploaded into the thread after its answer. The app needs the `files:read` and `files:write`
scopes for this: an app installed without them must be reinstalled from the manifest above.

## Approving tools

When the agent wants to use a tool whose decision is `ask`, the app posts a card with
**Allow** and **Deny**. A typed "yes" approves the one card posted just before it; any other
message denies the cards still waiting. A card nobody answers is denied after
`confirmTimeoutMs` (two hours by default).

## Letting people in

Anyone else who messages the app directly gets a pairing code, and you get a card with
**Allow** and **Deny**. Allow lets them in; Deny, or no answer, leaves them out. Anyone who is
not let in and mentions the app in a channel is ignored; they can message the app directly.
The same from the host, on the app's state file, with Slack ids:

```sh
wisp slack pairing list
wisp slack pairing approve K7MZ4QXA
wisp slack pairing revoke U012ABCDEF
```

Codes expire and are rate-limited as the Telegram bot's are: see
[Letting people in](./telegram-bot.md#letting-people-in).

To let people or channels in without pairing, list their ids in `SLACK_ALLOWED_IDS`, separated by
commas (`SLACK_ALLOWED_IDS=U012ABCDEF,C034GHIJKL`).

## Its state

The app keeps its state in `$WISP_HOME/slack.json` (`--state` puts it elsewhere): the owner, the
users let in, the codes that wait, each Session key's Sessions, the requests it is following and
how far it has posted delivered outcomes.
A request it was following when it stopped is answered once it is back. A message sent while
the app is down is answered only if Slack still retries delivering it.

## Schedules

A schedule delivers to Slack with `deliver: { channel: "slack", externalKey: … }`, the key
naming a direct message (`slack:<DM id>`), a channel (`slack:<channel id>`) or a thread in it
(`slack:<channel id>:<thread ts>`), followed by `@<bot user id>` so that only this app posts it;
without it, every app running on the Runtime does. Every request the app starts carries its
direct message's or thread's key with its own bot user, so a job created there delivers back there. An outcome that settles while the
app is down is posted once it is back.
