---
sidebar_label: Telegram bot
description: Talk to the agent from Telegram — set the bot up, pair its owner, and let people in.
---

# A Telegram bot

`wisp telegram` answers you in Telegram. It is the same binary, run as its own process beside
the Runtime: it reaches the Runtime only over `/v1`, with a `run` token, and reaches Telegram
by long polling, so it needs no public port and no TLS of its own.

:::tip[The bot is not the Telegram connector]
The bot is a Channel: **you write to the agent** in Telegram. The
[Telegram connector](./connectors.md#telegram) is a tool: **the agent reads your own
Telegram account**, its chats and messages. They are set up apart, and you can use either
without the other.
:::

## 1. Make a bot

Make a bot with [@BotFather](https://t.me/BotFather) and copy the token it gives you.

## 2. Allow `interactive` Runs

Add `interactive` to `confirmationModes` in `runtime.json` and restart the Runtime:

```json
{ "agentToken": "…", "confirmationModes": ["policy", "interactive"] }
```

:::warning
Without `interactive` in `confirmationModes` the bot answers every message with "Could not
reach the agent", and its log shows `HTTP 403`.
:::

## 3. Set the bot up

On the Runtime's host:

```sh
wisp telegram setup
# paste the bot's token from @BotFather, then press Enter
# @your_bot is set up.
# No owner yet. Open https://t.me/your_bot?start=… and press Start, or send /pair … to the bot.
```

`setup` checks the bot token with Telegram, mints the bot its own `run` token for the
Telegram Channel (`wisp tokens create --name telegram --capability run --channel telegram`,
done for you through `runtime.lock`), and stores both in the bot's
[state file](#its-state), readable only by you. Run it again to change the bot token; a
different bot starts with no owner and no one let in.

## 4. Start it as a service

```sh
wisp telegram install
```

`install` runs the bot as a user service beside the Runtime's, restarted if it fails: a
systemd unit `wisp-telegram.service` on Linux (`journalctl --user -u wisp-telegram -f`), a
launchd agent `io.usewisp.telegram` on a Mac (log in `~/.wisp/logs/telegram.log`). `wisp update`
restarts it onto the new release, and `wisp telegram uninstall` or `wisp uninstall` removes it.
Without `install`, `wisp telegram` runs the bot in this terminal.

## 5. Become its owner

Open the link `setup` printed on your phone and press Start: you are the bot's owner. The code
works once.

The bot answers only the people let in, and each of them drives the agent as you do, with the
same Connectors and memory.

## The bot on another machine

On a host with no Runtime, `setup` asks instead for a connection string. Make one on the
Runtime's host with `wisp tokens create --name telegram --capability run --channel telegram`
and paste the `wisp+…` line. You can also skip `setup` and pass everything in the
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

## Where the bot answers

- **A private chat** is one Session, keyed `telegram:<chat id>`, so the agent remembers the
  conversation. `wisp sessions list --origin telegram` lists them.
- **A group** must first be approved by the owner: the first message addressed to the bot
  there sends you a card.
  The bot then answers only a message that mentions it, replies to it, or is a command.
  With `wisp telegram install --all-messages` (or `wisp telegram --all-messages`) it answers
  every message; turn the bot's privacy mode off in @BotFather (`/setprivacy` → Disable) so
  that Telegram sends them. Each person in a group has their own Session
  (`telegram:<chat id>:u<user id>`), so nobody's question waits behind someone else's.
- **A forum topic** is one shared Session for everyone in it (`telegram:<chat id>:<topic id>`).
- **A reply to someone not let in**: when a participant replies to such a message, it reaches
  the agent marked as a third party's, as data rather than an instruction.

## Files and voice messages

Photos, documents, voice messages and audio files up to 20 MB reach the agent with your
message; a PDF or a text file is read as its text. Videos are refused. A voice message needs
the [speech model](./reference.md#speech): until it is installed, the owner gets a card to
install it (643 MB) and sees the progress. Files the agent writes are sent back as documents
after its answer.

## Approving tools

When the agent wants to use a tool whose decision is `ask`, the bot sends a card with **Allow**
and **Deny**. A typed "yes" approves the one card sent just before it; any other message denies
the cards still waiting, so a card scrolled away never holds the chat. A card nobody answers is
denied after `confirmTimeoutMs` (two hours by default).

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

Someone let in from the command line is not told; their next message is simply answered. A
revoked user's next message starts no Run. A code expires in an hour;
a person gets one code per ten minutes; at most three wait at once, and a fourth is told to try
later; five wrong codes in a row given to `pairing approve` lock approving by code, and new
requests, for an hour, while the cards already sent still work.

To let people in without pairing, list their user ids, or a chat's id, in
`TELEGRAM_ALLOWED_IDS`, separated by commas (`TELEGRAM_ALLOWED_IDS=123456789,987654321`). An id
on the list is answered at once, even before the bot has an owner; to shut it out, take it off
the list and restart the bot.

## Its state

The bot keeps its state in `$WISP_HOME/telegram.json` (`--state` puts it elsewhere): the bot
token, the Runtime's address and the bot's `run` token, the owner, the owner code until it is
used, the users let in, the codes that wait, and its place in Telegram's queue of messages, so
a message sent while the bot was down (Telegram keeps them for 24 hours) is answered once it
is back. `TELEGRAM_BOT_TOKEN`, `WISP_URL` and `WISP_TOKEN`, when set, win over the file.
Removing the file pairs a new owner and shuts out everyone let in by pairing; run `setup`
again after it.

## Schedules

A schedule delivers to Telegram with `--deliver telegram:<chat id>`, or
`telegram:<chat id>:<topic id>` for a forum topic. The bot prints the owner's key once
paired.
