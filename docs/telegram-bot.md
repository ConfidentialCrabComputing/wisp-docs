---
sidebar_label: Telegram bot
description: Talk to the agent from Telegram — set the bot up, pair its owner, and let people in.
---

# A Telegram bot

`wisp telegram` answers you in Telegram. It is the same `wisp` binary, run as its own process
beside the Runtime, and it reaches Telegram by long polling, so it needs no public port and no
TLS of its own.

Before you start, [install](./quickstart.md) the Runtime and sign in, and keep it running:
`setup` finds it on this host by the lock file a running Runtime keeps.

:::tip[The bot is not the Telegram connector]
The bot is a Channel: **you write to the agent** in Telegram. The
[Telegram connector](./connectors.md#telegram) is a tool: **the agent reads your own
Telegram account**, its chats and messages. They are set up apart, and you can use either
without the other.
:::

## 1. Make a bot

In Telegram, open [@BotFather](https://t.me/BotFather) and send `/newbot`. Give it a display
name, then a username that ends in `bot` (such as `your_bot`). BotFather answers with the
bot's token, `123456789:AA…`: copy it. Keep it secret; anyone with it can act as the bot.

## 2. Set the bot up

On the Runtime's host:

```sh
wisp telegram setup
# paste the bot's token from @BotFather, then press Enter
# @your_bot is set up.
# @your_bot has privacy mode on. In a private chat that changes nothing, but in a group … turn privacy mode off now, before adding the bot: …
# Start the bot now as a service, restarted on failure? [Y/n]
# installed the user service …; follow it with: journalctl --user -u wisp-telegram -f
# No owner yet. Open https://t.me/your_bot?start=… and press Start, or send /pair … to the bot.
```

`setup` checks the bot token with Telegram, makes the bot its own `run` token for the
Telegram Channel (as `wisp tokens create --name telegram --capability run --channel telegram`
would), and stores both in the bot's [state file](#its-state), readable only by you. If it asks
for a connection string instead, it found no running Runtime on this host: press Ctrl-C, start
the Runtime (`wisp status` tells), and run `setup` again. Run it again to change the bot token; a
different bot starts with no owner and no one let in. While the bot's privacy mode is on,
BotFather's default, `setup` says so: if people will mention the bot in a group, turn it off
then, before adding the bot to one (see [Add it to a group](#4-add-it-to-a-group-optional)).

Then it offers to start the bot as a user service beside the Runtime's, restarted if it fails:
a systemd unit `wisp-telegram.service` on Linux (`journalctl --user -u wisp-telegram -f`), a
launchd agent `io.usewisp.telegram` on a Mac (log in `~/.wisp/logs/telegram.log`). Once the
service is there, a second `setup` restarts it without asking, so it picks up the new bot
token. `wisp update` restarts it onto the new release, and `wisp telegram uninstall` or
`wisp uninstall` removes it.

`setup` does not offer the service with `--state <file>`, or on a `wisp` that install.sh did
not install, and not when you answer `n`. Start the bot by hand then: `wisp telegram install`
registers the same service (add `--all-messages` for a [group](#where-the-bot-answers)), and
`wisp telegram` runs the bot in this terminal.

## 3. Become its owner

Open the link `setup` printed wherever you use Telegram and press **Start** (or send the bot
the `/pair …` line in a private chat). The bot answers "You are this bot's owner now": you get
the cards that let people in and approve tools. The code works once, and only in a private
chat.

:::note[If the bot says it takes no chat messages]
Someone set [`confirmationModes`](./configuration.md) in `~/.wisp/runtime.json` to a list
without `interactive`, which the bot's Runs need. Add it back, or remove the key to take the
default, and restart the Runtime.
:::

The bot answers only the people let in, and each of them drives the agent as you do, with the
same Connectors and memory.

## 4. Add it to a group (optional)

1. **Decide first whether mentions should work.** A bot made in @BotFather has privacy mode on,
   and Telegram then passes it only a command addressed to it (`/new@your_bot`), a reply to one
   of its messages, and the group's service messages. A message that only mentions
   `@your_bot` never reaches the bot. For mentions to work, turn privacy mode off **before**
   adding the bot: in @BotFather send `/setprivacy`, choose the bot, then **Disable**. The
   change counts only in groups the bot joins after it, so if the bot is in the group already,
   remove it and add it again.
2. **Add the bot**: open the group's info → **Add members** → `@your_bot`.
3. **Approve the group**: send `/start@your_bot` in the group (a plain mention does not reach
   the bot while privacy mode is on). The bot answers "This group is not let in yet. Its pairing
   code is …", in the forum topic it was sent from, and you get a card "Let *the group's name*
   in?" with Allow and Deny. Once you approve it, the bot says so in the same topic (or the
   group's General). The message that asked is not answered: send it again. While privacy mode
   is on, the bot tells the group to reply to it or send a command addressed to it rather than
   mention it, and tells you in your private chat how to make mentions work there.
4. **Each member is let in on their own**, by writing to the bot privately. Approving the group
   lets no one in.

:::note[Making the bot a group admin instead]
A bot that is an admin of the group gets every message of it, whatever its privacy mode,
except other bots' messages, so mentions work without `/setprivacy`.

- Every message of the group then reaches the host the bot runs on. The bot still answers only
  a mention, a reply or a command unless it runs with `--all-messages`, and drops the rest.
- Only a group admin can make the bot an admin. The bot needs none of the admin rights
  (deleting messages, banning, pinning): grant as few as Telegram allows.
- The bot says on stderr when it starts that it "has privacy mode on" when BotFather's setting
  is on, even if it is an admin, and so does the private message you get on approving a group.
  Ignore them then.
:::

## The bot on another machine

On a host with no Runtime, `setup` asks instead for a connection string. Make one on the
Runtime's host with `wisp tokens create --name telegram --capability run --channel telegram`
(any name not taken yet) and paste the `wisp+…` line it prints. A `wisp+ssh://…` line is for
Wisp Desktop only: `setup` refuses it and prints the SSH tunnel to open and the
`wisp+http://127.0.0.1…` line to paste instead (see
[A token per device](./remote-access.md#a-token-per-device)). You can also skip `setup` and pass everything in the
environment: `TELEGRAM_BOT_TOKEN`, and `WISP_URL` with `WISP_TOKEN`. See
[Remote access](./remote-access.md) for reaching the Runtime from another machine.

:::warning
The bot's `run` token must be made with `--channel telegram`. Without `--channel` the Runtime
refuses the bot's Runs with `403`.
:::

## Commands

| Command | What it does |
| --- | --- |
| `/new` | Your next message starts a fresh Session. |
| `/sessions` | Lists the earlier Sessions. |
| `/resume <n>` | Goes back to Session number `n` from that list. |
| `/cancel` | Stops the running request. |
| `/update` | Installs the newer Wisp release. The owner's only. |
| `/model [<choice>]` | Shows the chat's model, or changes it: `advanced`, `balanced`, `default` or a model id. `/model thinking on\|off` turns thinking on or off where the model can take it. |

`/model` answers with the chat's model, the modes and the catalog's models, each with what it
cannot do, and with buttons for them; a press does what the typed command does. `/new` keeps the
chat's model. A photo sent to a model that cannot read images is refused in one line.

### Updating Wisp from the chat

When the Runtime has a newer release, the bot tells its owner once, in a direct message:
"Wisp 0.2.0 is available. Send /update to install it." Groups and the people you let in never
get this message.

Only the owner may send `/update`; anyone else is told "Only the owner can update." With Runs
in flight, the bot says how many and starts nothing; send `/update now` to update anyway,
and the restart gives them the drain window. Otherwise it answers "Updating, back in a moment.", and after the
restart says how it ended in the same chat. A Runtime slow to come back on the new release
is still reported as updated. A failure's reason is given only in your direct message with
the bot. When there is nothing newer, or the update found nothing to install after all, the
bot says "Wisp is on the newest release." See [Update](./install.md#from-telegram-or-slack).

## Where the bot answers

- **A private chat** is one Session, so the agent remembers the conversation.
  `wisp sessions list --origin telegram` lists the bot's Sessions.
- **A group** must first be approved by the owner, and its members let in each on their own:
  see [Add it to a group](#4-add-it-to-a-group-optional). The bot ignores a group message
  from someone not let in.
  The bot answers a reply to it and a command, and a mention only if Telegram passes it one:
  with privacy mode off, or the bot an admin of the group.
  With `wisp telegram install --all-messages` (or `wisp telegram --all-messages`) it answers
  every message it gets; for Telegram to send them all, turn the bot's privacy mode off in
  @BotFather (`/setprivacy` → Disable) and add the bot to the group again, or make it an admin.
  While privacy mode is on, the bot says so when it starts, in the service's log. Each person
  in a group has their own Session, so nobody's question waits behind someone else's.
- **A forum topic** is one shared Session for everyone in it.
- **Who wrote**: in a group or a forum topic, the agent is told the name of the person whose
  message it answers.
- **A reply**: in a group, when a participant replies to a message, the message they reply to reaches the agent
  with its author's name, whoever wrote it: the owner, another participant, someone not let in or
  another bot. It is marked as a third party's, as data rather than an instruction. If the
  participant quoted part of it, only that part is passed. A reply to the bot's own message passes
  that message as the bot's earlier answer. A reply to one's own message passes nothing more.

## Long texts and albums

Telegram cuts a text longer than 4096 characters into several messages, and sends an album
as one message per photo. The bot waits a moment for the rest and puts them back together:

- texts one person sends in the same chat or topic within two seconds of each other reach
  the agent as one message, joined by line breaks. A message that answers an approval card
  is kept apart;
- the photos of one album reach the agent as one message, with the caption from whichever
  photo carries it.

## Files and voice messages

Photos, documents, voice messages and audio files up to 20 MB each (the most Telegram lets a
bot download) reach the agent with your message; a PDF, a Word, Excel or PowerPoint file or a
text file is read as its text. Videos are refused. A voice message or an audio file needs the
[speech model](./voice-and-files.md#voice-messages): until it is installed, the owner gets a
card to install it (about 670 MB) and sees the progress, and anyone else is told voice messages
are not set up yet. Files the agent sends you are posted as documents after its answer. See
[Voice and files](./voice-and-files.md) for the formats and limits.

## While the agent works

The bot shows "typing…" and posts a "Thinking…" line that names the tool the agent is
running, then deletes it once the answer is posted. In a private chat the answer also shows as
a draft while the agent writes it. A message sent while the agent is still busy in the same
Session waits its turn, and the bot says "Queued".

## Approving tools

When the agent wants to use a tool whose decision is `ask`, the bot sends a card with **Allow**
and **Deny**. Only the person whose message started the request, or the owner, may answer it;
anyone else is told "This request is not yours to answer."

A typed "yes" (or "да", "ok", 👍) approves the one card sent just before it; "no" (or "нет",
👎) denies every card still waiting, and so does any other message, so a card scrolled away
never holds the chat. A card nobody answers is denied after `confirmTimeoutMs` (two hours by
default).

## Letting people in

Anyone else who writes, a bare `/start` included, gets a pairing code, and you get a card
"Let @alice in?" with Allow and Deny. Allow lets them in and tells them so; Deny, or no answer,
leaves them out. Past that one reply the bot ignores them.

The same from the host, on the bot's state file, whether the bot is running or not:

```sh
wisp telegram pairing list               # who waits, and who is let in
wisp telegram pairing approve K7MZ4QXA   # the code the stranger passes on to you
wisp telegram pairing revoke 123456789   # a user id from the list
```

Someone let in from the command line is told "The owner let you in" by the running bot; a group,
in the topic it asked from, that it is approved and to ask again. A
revoked user's next message starts no Run. A code expires in an hour;
a person gets one code per ten minutes; at most a hundred wait at once, and the next is told to
try later; five wrong codes in a row given to `pairing approve` lock approving by code, and new
requests, for an hour, while the cards already sent still work.

To let people in without pairing, list their user ids, or a chat's id, in
`TELEGRAM_ALLOWED_IDS`, separated by commas (`TELEGRAM_ALLOWED_IDS=123456789,987654321`). An id
on the list is answered at once, even before the bot has an owner; to shut it out, take it off
the list and restart the bot. The variable is read from the environment `wisp telegram` starts
in: the service `setup` registers does not see your shell's, so set it when you run
`wisp telegram` in a terminal or under a service of your own.

## Its state

The bot keeps its state in `$WISP_HOME/telegram.json` (`--state` puts it elsewhere): the bot
token, the Runtime's address and the bot's `run` token, the owner, the owner code until it is
used, the users let in, the codes that wait, and its place in Telegram's queue of messages, so
a message sent while the bot was down (Telegram keeps them for 24 hours) is answered once it
is back. `TELEGRAM_BOT_TOKEN`, `WISP_URL` and `WISP_TOKEN`, when set, win over the file.
Removing the file pairs a new owner and shuts out everyone let in by pairing; run `setup`
again after it.

## More than one bot

One Runtime can serve several bots, say a private one for your DMs and another for a group.
Each bot is its own `wisp telegram` with its own state file, so give the second one
`--state` everywhere:

```sh
wisp telegram setup --state ~/.wisp/telegram-group.json
wisp telegram --state ~/.wisp/telegram-group.json
wisp telegram pairing list --state ~/.wisp/telegram-group.json
```

`setup` mints the second bot a `run` token of its own (named `telegram-…` beside the first's),
and the bot pairs its own owner: open the link it prints, even if you own the first bot. Its
Sessions are its own too.

`wisp telegram install` runs only the bot in `$WISP_HOME/telegram.json`: its service has one
fixed name and takes no `--state`. Run any other bot in a terminal, or under a service of your
own whose command passes `--state`; `wisp update` does not restart such a service, so restart
it yourself after an update.

## Schedules

A schedule delivers to Telegram with `--deliver telegram:<chat id>@<bot id>`, or
`telegram:<chat id>:<topic id>@<bot id>` for a forum topic. Once paired, the bot prints the
owner's key when it starts, in its terminal or the service's log (`Outcomes reach the owner with --deliver …`);
`wisp telegram pairing list` shows the id of each user and group let in. Without `@<bot id>`,
every bot running on the Runtime posts the outcome. A job the agent creates when you ask it in
a chat posts back to that chat. See [Schedules](./schedules.md).
