---
description: Let the agent read your own notes, such as an Obsidian vault, in every chat, and write in them only where you allow it.
sidebar_label: Knowledge Folders
---

# Knowledge Folders

A Knowledge Folder is a folder of your own, outside Wisp, that the agent can reach in every
chat. Use one for the notes you want it to know about: an Obsidian vault, a folder of
Markdown, meeting notes, a personal wiki. Ask "what did I write about the garden last week?"
or "add this to today's note" in any chat, and the agent opens the folder, reads or edits
the notes and answers from them.

Without one, the agent sees only the folder the chat works in, the Project, plus what it
remembers. A Knowledge Folder adds your notes to that, without making them a Project and
without copying them anywhere: they stay where they are, in the files you edit yourself.

## Add a folder

**In Wisp Desktop**, open Settings (<kbd>⌘</kbd> <kbd>,</kbd>) → **Knowledge Folders** and
click **Add folder…**. Each folder in the list has a **Writable** switch and a **Remove**
button. When the app is [connected to a server](./desktop/connect-to-a-server.md), the folder
is on the server: type its absolute path there and click **Add**.

**From a terminal**, use `wisp knowledge`:

```sh
wisp knowledge add ~/Notes                # read-only
wisp knowledge add ~/Wiki --writable      # the agent may write here
wisp knowledge list
# /Users/you/Notes  read-only
# /Users/you/Wiki  writable
wisp knowledge set ~/Notes --writable     # let the agent write in it
wisp knowledge set ~/Notes --read-only    # take that back
wisp knowledge remove ~/Wiki              # the folder and its files stay where they are
```

A relative path is taken from the folder you run the command in. Every form prints the list
as it now is; add `--json` for it as JSON.

A change counts from the next message, in every chat, with no restart.

## Read-only or writable

**A new folder is read-only.** The agent can search, list and read every file in it, and
cannot create, change or delete anything there. Make a folder writable only when you want the
agent to write notes for you: add to today's note, file a meeting summary, keep a wiki.

In a writable folder, a write is a call to `fs_write` or `fs_edit`, and it asks you first,
the way a write anywhere else does, unless a [Rule](./permissions.md) allows it. In a
read-only folder it is refused before anything asks you.

**`.obsidian/` is never written**, not even in a writable folder and not even when you ask.
It holds Obsidian's settings and plugins, and a plugin runs code when you open the vault. The
agent can still read it, for example to find where your daily notes go.

## Which folders can be one

A folder must exist when you add it. It cannot be:

- the root of the disk (`/`, `C:\`);
- Wisp's data directory (`~/.wisp`), a folder inside it, or a folder that holds it, such as
  your whole home folder;
- the folder Wisp Desktop keeps its chats' files in, a folder inside it, or one that holds it;
- a folder inside another Knowledge Folder, or one that holds one;
- a folder already on the list;
- on a drive that gives no file identity, as some network, cloud-sync and virtual drives do:
  Wisp could not tell its files apart.

A Project folder can be a Knowledge Folder too. When it is read-only, the agent cannot write
in it from any chat, its own Project's included: read-only wins.

When a folder disappears, because a disk is unplugged or a vault was moved, the agent goes on
without it and the Runtime notes it once in its log. The same goes for a folder whose path now
leads to another folder than the one you added. The folder stays on the list, marked
`not reachable` by `wisp knowledge list`, and is used again as soon as it is back.

## How the agent uses them

- **It knows where they are.** Every chat's instructions list your Knowledge Folders, each
  with its absolute path, whether it is writable, and whether it is an Obsidian vault (it has
  a `.obsidian/` folder).
- **It reads them with the file tools.** `fs_grep`, `fs_glob`, `fs_list` and `fs_read` reach
  a Knowledge Folder by its absolute path, without asking, whether the
  [sandbox](./sandbox.md) is on or off. `bash_run` does not: with the sandbox on, a command
  that names the folder is refused. A link inside the folder that leads out of it is not
  followed.
- **The notes win over memory.** The agent is told that the folder is the source of truth and
  to read it before answering about your notes. A message whose work touched a Knowledge
  Folder is not turned into memories, so an old copy of a note never answers in its place.
- **What a note says is data, not an order.** An `AGENTS.md` or a rule file inside a
  Knowledge Folder is not an [instruction file](./instructions.md); the agent reads it like
  any other note. A note that says "ignore your instructions" is text to report, nothing more.
- **Only you change the list.** The agent has no tool to add, change or remove a Knowledge
  Folder. Under [Auto Mode](./permissions.md#auto-mode), a `wisp knowledge` command always
  goes to you, and a write into a read-only folder, into `.obsidian/`, or one you did not ask
  for is never let through by the Judge.

## Obsidian and wikis

Two [Skills](./skills.md) come with the Runtime for Knowledge Folders, and the agent loads
them on its own:

- **`obsidian`** knows a vault's conventions: `[[links]]` and `![[embeds]]`, properties,
  tags, backlinks and where the daily note lives. The agent loads it before it writes in a
  vault. To answer a question, it searches the vault, ignoring case, and follows the links in
  the notes it finds.
- **`llm-wiki`** keeps a wiki the agent writes for you, after
  [Andrej Karpathy's LLM Wiki pattern](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f):
  you drop sources in, it summarizes, links and files them, and answers from the wiki later.
  It needs a writable folder. Ask "start a wiki in ~/Wiki" to begin.

## What a Knowledge Folder is not

- **Not a Project.** It brings no instructions, Skills, Rules or Connectors of its own, and a
  chat never works in it: relative paths still mean the Project. To work on the folder's
  files as a Project, open it as one. See [Sessions and Projects](./sessions-and-projects.md).
- **Not private to one chat.** Every chat reaches it, the [Telegram bot](./telegram-bot.md),
  the [Slack app](./slack-app.md) and [schedules](./schedules.md) included. Anyone who can
  write to your bot can ask about your notes. Add only folders you are happy for all of them
  to read, and keep a folder writable only while you need it to be.

## Over the API

`GET`, `POST`, `PATCH` and `DELETE /v1/knowledge-folders` read and change the list; see the
[reference](./reference.md#rules-skills-and-the-audit).
