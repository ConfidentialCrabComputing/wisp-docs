---
description: The files the agent reads as standing instructions — AGENTS.md and the rest — where they go, and which one comes last.
sidebar_label: Instructions
---

# Instruction files

Instruction files are Markdown the agent treats as standing rules: how to answer, what the
Project is, what never to do. The Runtime reads them again before every message, so an edit
counts from the next message.

## The files

| File | Where | Read when |
| --- | --- | --- |
| `AGENTS.md` | `$WISP_HOME/` (`~/.wisp/` by default) | every Session, with a Project or without |
| `AGENTS.md`, `CLAUDE.md`, `WISP.md` | the Project folder | Sessions in that Project |
| `AGENTS.md`, `CLAUDE.md`, `WISP.md` | any subfolder of the Project | Sessions in that Project |
| `*.md` | `.wisp/rules/` in the Project, and its subfolders | Sessions in that Project |
| `AGENTS.local.md` | the Project folder | Sessions in that Project |

The lowercase spellings (`agents.md`, `claude.md`, `wisp.md`, `agents.local.md`) work too.

- **A Session without a Project reads only the global file.** That covers the Telegram bot,
  the Slack app and run tokens. Put instructions for those in `~/.wisp/AGENTS.md`.
- **The global file is `AGENTS.md` only.** A `CLAUDE.md` or `WISP.md` in `$WISP_HOME` is not
  read.
- **Every name is read, not the first one found.** A folder with both `AGENTS.md` and
  `CLAUDE.md` gives the agent both files. Two names linked to the same file count once.
- **Subfolders are searched up to 16 levels deep.** `node_modules` and every folder whose
  name starts with `.` are skipped.
- **`.wisp/rules/` is not committed.** The Runtime puts a `.gitignore` with `*` in `.wisp/`,
  so these files stay on the machine. Use them for one machine's additions; put shared
  instructions in `AGENTS.md`.
- **`AGENTS.local.md` is meant for you alone.** Add it to the Project's `.gitignore`. Wisp
  does not do that for you.
- **Empty files are skipped**, and so are files larger than `fsMaxFileSize` (30 MiB by
  default). In a subfolder, a link that points outside the Project is not followed; in
  `.wisp/rules/`, one that points outside `.wisp/rules/`.

## Order

The agent gets every file it found, in this order, from the most general to the most
specific:

1. `~/.wisp/AGENTS.md`
2. the Project's own `AGENTS.md`, `CLAUDE.md` and `WISP.md`, in alphabetical order
3. the subfolders' files, shallower folders first
4. `.wisp/rules/*.md`, by path
5. `AGENTS.local.md`

Each file is introduced with its path. Files are not merged: the agent sees them all, and
the later ones are the closer to the conversation. When two files disagree, write the
exception in the more specific file, the one later in this list.

## Size

All the files together may take up to 200 KiB. Above that, the Runtime leaves out files from
the top of the list until the rest fits, so the global file goes first and
`AGENTS.local.md` last.

A [subagent](./tools.md) gets a short version, up to 4,000 characters: the global file and
the Project's own files first, then the most specific of the rest that fit.

## What else shapes the agent

- **Skills** are procedures the agent runs on demand, not rules it always follows. See
  [Skills](./skills.md).
- **Rules** in [Permissions](./permissions.md) decide what the agent may do. An instruction
  file can ask the agent not to use a tool; only a Rule can stop it.
