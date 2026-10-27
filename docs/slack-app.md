---
sidebar_label: Slack app
description: Talk to the agent from Slack — create the app from a manifest, pair its owner, and let your team in.
---

# A Slack app

`wisp slack` answers you and your team in Slack. It is the same `wisp` binary, run as its own
process beside the Runtime, and it reaches Slack over Socket Mode, so it needs no public port
and no TLS of its own.

Before you start, [install](./quickstart.md) the Runtime and sign in, and keep it running:
`setup` finds it on this host by the lock file a running Runtime keeps. You also need the
right to create and install apps in the Slack workspace, or an admin who approves yours.

## 1. Create the app

At [api.slack.com/apps](https://api.slack.com/apps), choose **Create New App → From a
manifest**, pick the workspace, switch the editor from the **JSON** tab to **YAML**, and
paste:

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

Choose **Next**, then **Create**. To have threads show the app's status while the agent works,
also turn on **Agents & AI Apps** in the app's sidebar now, before you install it; see
[While the agent works](#while-the-agent-works). You can do it later, but then you reinstall
the app.

## 2. Copy its two tokens

1. Open *Install App* in the app's sidebar, choose **Install to** *your workspace* and then
   **Allow**. Back on the same page, copy the **Bot User OAuth Token** (`xoxb-…`); *OAuth &
   Permissions* shows it too. If your workspace needs an admin to approve apps, the button
   reads **Request to Install** instead, and the token appears once an admin approves.
2. Open *Basic Information*, scroll to *App-Level Tokens* and choose **Generate Token and
   Scopes**. Give it any name, add the `connections:write` scope, choose **Generate** and copy
   the token (`xapp-…`).

## 3. Set the app up

On the Runtime's host:

```sh
wisp slack setup
# paste the app's Bot User OAuth Token (xoxb-…), then press Enter
# paste the app-level token with connections:write (xapp-…), then press Enter
# @wisp is set up.
# Start the app now as a service, restarted on failure? [Y/n]
# installed the user service …; follow it with: journalctl --user -u wisp-slack -f
# No owner yet. Send @wisp a direct message: !pair …
```

`setup` checks both tokens with Slack, makes the app its own `run` token for the Slack Channel
(as `wisp tokens create --name slack --capability run --channel slack` would), and stores all
of it in the app's [state file](#its-state), readable only by you. If it asks for a connection
string instead, it found no running Runtime on this host: press Ctrl-C, start the Runtime
(`wisp status` tells), and run `setup` again. Without Agents & AI Apps, `setup` also says that
answers show no status. Run it again to change the tokens; a different app starts with no
owner and no one let in.

Then it offers to start the app as a user service beside the Runtime's, restarted if it fails:
a systemd unit `wisp-slack.service` on Linux (`journalctl --user -u wisp-slack -f`), a launchd
agent `io.usewisp.slack` on a Mac (log in `~/.wisp/logs/slack.log`). Once the service is there,
a second `setup` restarts it without asking, so it picks up the new tokens. A token Slack
refuses stops the service rather than restarting it over and over: run `setup` again with a
good one. `wisp update` restarts it onto the new release, and `wisp slack uninstall` or
`wisp uninstall` removes it.

`setup` does not offer the service with `--state <file>`, or on a `wisp` that install.sh did
not install, and not when you answer `n`. Start the app by hand then: `wisp slack install`
registers the same service, and `wisp slack` runs the app in this terminal.

## 4. Become its owner

In Slack, open the app's direct message: find **Wisp** under *Apps* in the sidebar, or search
for it, and open its **Messages** tab. Send it the `!pair …` line `setup` printed. The app
answers "You are this app's owner now": you get the cards that let people in and approve tools.
The code works once, and only in a direct message. Until then, a message to the app answers
with a pairing code and a reminder to send that line.

:::note[If the app says it takes no chat messages]
Someone set [`confirmationModes`](./configuration.md) in `~/.wisp/runtime.json` to a list
without `interactive`, which the app's Runs need. Add it back, or remove the key to take the
default, and restart the Runtime.
:::

## The app on another machine

On a host with no Runtime, `setup` asks instead for a connection string. Make one on the
Runtime's host with `wisp tokens create --name slack --capability run --channel slack` (any
name not taken yet) and paste the `wisp+…` line it prints. A `wisp+ssh://…` line is for Wisp
Desktop only: `setup` refuses it and prints the SSH tunnel to open and the
`wisp+http://127.0.0.1…` line to paste instead (see
[A token per device](./remote-access.md#a-token-per-device)). You can also skip `setup` and pass everything in the environment,
which wins over what `setup` stored:

```sh
export SLACK_BOT_TOKEN=xoxb-… SLACK_APP_TOKEN=xapp-…
export WISP_URL=http://127.0.0.1:3008 WISP_TOKEN=<the run token>
wisp slack
```

The Slack tokens are never read from a flag. See [Remote access](./remote-access.md) for
reaching the Runtime from another machine.

:::warning
The app's `run` token must be made with `--channel slack`. Without `--channel` the Runtime
refuses the app's Runs with `403`.
:::

## Commands

Slack takes a message that starts with `/` for one of its own commands, so the app's commands
start with `!`. In a thread you can also mention the app and write the command with a `/`, as in
`@Wisp /new`. In a channel, a command works only inside a thread, except `!update` and `!auto`, which
also work at a channel's top level when they mention the app (`@Wisp !update`).

| Command | What it does |
| --- | --- |
| `!new` | Your next message starts a fresh Session. |
| `!sessions` | Lists the last ten Sessions. |
| `!resume <n>` | Goes back to Session number `n` from that list. |
| `!cancel` | Stops the running request. |
| `!update` | Installs the newer Wisp release. The owner's only. |
| `!auto [on\|off]` | Shows whether [Auto Mode](./permissions.md#auto-mode) is on; `on` or `off` turns it on or off for the whole Runtime. Turning it on or off is the owner's only. |
| `!model [<choice>]` | Shows the chat's model, or changes it: `advanced`, `balanced`, `default` or a model id. `!model thinking on\|off` turns thinking on or off where the model can take it. |

`!model` answers with the chat's model, the modes and the catalog's models, each with what it
cannot do, with buttons for the modes and a menu of the models. In a channel thread, the owner
and the person who started the thread may change its model. `!new` keeps the chat's model. An
image sent to a model that cannot read images is refused in one line.

### Updating Wisp from Slack

When the Runtime has a newer release, the app tells its owner once, in a direct message:
"Wisp 0.2.0 is available. Send !update to install it." Channels and the people you let in
never get this message.

Only the owner may send `!update`; anyone else is told "Only the owner can update." With Runs
in flight, the app says how many and starts nothing; send `!update now` to update anyway,
and the restart gives them the drain window. Otherwise it answers "Updating, back in a moment.", and after the
restart says how it ended in the same thread. A Runtime slow to come back on the new release
is still reported as updated. A failure's reason is given only in your direct message with
the app. When there is nothing newer, or the update found nothing to install after all, the
app says "Wisp is on the newest release." See [Update](./install.md#from-telegram-or-slack).

## Where the app answers

- **A direct message** with the app is one Session.
- **A channel**, public or private: first invite the app (`/invite @Wisp` in the channel).
  Slack sends the app nothing from a channel it is not in. The app answers only when mentioned
  (`@Wisp …`). It replies in a thread under that message, and the thread is its own Session.
  Anyone let in can carry on in that thread without mentioning the app again. Each new mention
  starts another thread and another Session.
- **A channel the owner has not approved**: the first mention there gets a pairing code, and you
  get a card to approve the channel. Once you approve it, by the card or `wisp slack pairing
  approve`, the app says so in the thread the code was given in. The mention that asked is not
  answered: mention the app again. Approving a channel lets no one in; its members are let in
  each on their own.
- **A mention in a thread the app is not in yet** passes the thread before it to the agent: its
  first message and the newest ones up to the mention, 30 at most. Each is signed with its
  writer's name and marked as a third party's, as data rather than an instruction, whoever wrote
  it. A message the app posted there, such as a scheduled job's report, reaches the agent as its
  own earlier message. Files shared in the thread are not passed. From then on every message in
  the thread reaches the agent, signed with its writer.

`wisp sessions list --origin slack` lists the app's Sessions.

## While the agent works

The app posts a "Thinking…" line that names the tool the agent is running, and deletes it once
the answer is posted. In a thread, the same line also shows as the app's status under the
thread, the way Telegram shows "typing…". A thread waiting for you to press **Allow** or
**Deny** shows no status. A direct message the app answers outside a thread shows none. A
message sent while the agent is still busy in the same Session waits its turn, and the app
says "Queued".

A request that fails gets "The run failed: `<reason>`." in place of an answer, for example
`quota_exhausted`. [Troubleshooting](./runbook.md#why-a-run-failed) says what each reason means and
what to do.

The status needs the app's **Agents & AI Apps** feature: turn it on in the app's settings at
[api.slack.com/apps](https://api.slack.com/apps). This adds the `assistant:write` scope.
Then reinstall the app. Without the feature, answers come as before, with the "Thinking…" line
but no status. `setup` says so, and the app logs "status refused" once per start.

The answer itself is posted whole once the agent is done. It does not appear as the agent
writes it: Slack's streamed messages have no switch to turn off link previews, and the app
posts with link previews off. Otherwise a link that a prompt injection put in an answer would
be fetched by Slack before anyone clicks it.

## Files

Images (PNG, JPEG, GIF, WebP) and files up to 20 MB each, 100 MB in all per message, that you
share with the app reach the agent with your message; a PDF, a Word, Excel or PowerPoint file
or a text file is read as its text. Any other file, a voice message or an audio clip included, fails the
request with `unsupported_document`: the Slack app does not transcribe speech. Files the agent
sends you are uploaded into the thread after its answer. See
[Voice and files](./voice-and-files.md) for the formats and limits.

The app needs the `files:read` and `files:write` scopes for this: an app installed without them
must be reinstalled from the manifest above, and until then its log says "Slack sent its
sign-in page; the app needs the files:read scope".

## Approving tools

When the agent wants to use a tool whose decision is `ask`, the app posts a card with
**Allow** and **Deny**. Only the person whose message started the request, or the owner, may
answer it. A typed "yes" (or `:+1:`, "да", "ok") approves the card posted before it, but only
when exactly one card is waiting there; with more, it approves nothing and the app asks you to
press **Allow** on the card. "No" (or "нет", `:-1:`), or any other message, denies the cards still waiting. A card nobody
answers is denied after `confirmTimeoutMs` (two hours by default).

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
commas (`SLACK_ALLOWED_IDS=U012ABCDEF,C034GHIJKL`). A person's id is under **Copy member ID** in
their profile's **⋮** menu; a channel's is at the bottom of its details. The variable is read from
the environment `wisp slack` starts in: the service `setup` registers does not see your shell's,
so set it when you run `wisp slack` in a terminal or under a service of your own.

## Its state

The app keeps its state in `$WISP_HOME/slack.json` (`--state` puts it elsewhere), readable only by
you: the two Slack tokens and the Runtime's URL and `run` token `setup` stored, the owner, the
users let in, the codes that wait, each Session key's Sessions, the requests it is following and
how far it has posted delivered outcomes.
A request it was following when it stopped is answered once it is back. A message sent while
the app is down is answered only if Slack still retries delivering it.

## Schedules

A schedule delivers to Slack with `--deliver slack:<DM id>@<bot user id>`, a channel
(`slack:<channel id>@<bot user id>`) or a thread in it (`slack:<channel id>:<thread ts>@<bot user id>`).
The `@<bot user id>` makes only this app post it; without it, every app running on the Runtime
does. Once the owner has written to the app, it prints the owner's key when it starts, in its
terminal or the service's log (`Outcomes reach the owner with --deliver …`). A job the agent
creates when you ask it in a direct message or a thread posts back there. An outcome that
settles while the app is down is posted once it is back. See [Schedules](./schedules.md).
