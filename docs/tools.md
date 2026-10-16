---
sidebar_label: Tools
description: Every tool the agent has, what it does, and whether it runs on its own or asks first.
---

# Tools

The agent acts through tools. Each tool has a default decision: `allow` runs it, `ask` waits
for a person. A Rule changes the default, and [Permissions](./permissions.md) explains how.
This page lists the tool names, so you can write a Rule without looking them up first.

`wisp permissions get` shows the tools you are likely to write a Rule for, with the
decision that applies now. It leaves out the agent's own mechanics: `memory_*`,
`preference_*`, `diagnostics_read`, `skill_*`, `spawn_agent`, and a connector's
`list_resources`, `read_resource`, `list_prompts` and `get_prompt`. A Rule for any of them
still works.

## Files

The file tools work inside the Session's folder: its Project, or, for a Session without a
Project, a folder of its own under `~/Wisp`.

| Tool | What it does | Default |
| --- | --- | --- |
| `fs_read` | reads a text file; a PDF, `.docx` or `.xlsx` is turned into text | `allow` |
| `fs_read_media` | shows the agent an image: PNG, JPEG, GIF or WebP | `allow` |
| `fs_list` | lists files and folders | `allow` |
| `fs_glob` | finds files by name pattern | `allow` |
| `fs_grep` | searches file contents | `allow` |
| `fs_write` | creates or overwrites a file | `ask` |
| `fs_edit` | replaces exact text in a file | `ask` |

## Shell

| Tool | What it does | Default |
| --- | --- | --- |
| `bash_run` | runs a shell command, in a [sandbox](./sandbox.md) | `ask` |

Read [`bash_run`](./permissions.md#bash_run) before you allow it: the
[sandbox](./sandbox.md) keeps a command inside its folder, but its network is on.

## Schedules

The agent can make a [scheduled job](./schedules.md) from a chat: "every weekday at nine,
summarise my inbox".

| Tool | What it does | Default |
| --- | --- | --- |
| `schedule_create` | creates a job | `ask` |
| `schedule_update` | changes a job | `ask` |
| `schedule_delete` | deletes a job | `ask` |
| `schedule_list` | lists the jobs | `allow` |
| `schedule_pause` | pauses a job | `allow` |

These tools differ from the rest in two ways:

- **They are offered only to a Run a person can answer.** A Run in the `policy` mode, which
  is the default for `wisp run` and `/v1`, and every Run a job fires, does not see them at
  all, whatever the Rules say.
- **Creating, changing or deleting a job asks every time.** A Rule or a Project bypass that
  says `allow` is still an `ask` for these three. A `deny` is still a `deny`.

A Run from a chat sees only that chat's jobs.

## Skills

| Tool | What it does | Default |
| --- | --- | --- |
| `skill_invoke` | runs a [Skill](./skills.md) by name | `allow` |
| `skill_fs_read` | reads a file of a Skill | `allow` |
| `skill_fs_list` | lists Skills, or the files of one | `allow` |
| `skill_fs_write` | creates or changes a file of a Skill | `allow` |
| `skill_fs_delete` | deletes a file of a Skill, or the whole Skill | `ask` |

:::warning[The agent writes Skills without asking]
`skill_fs_write` defaults to `allow`. The agent can create or change a Skill in
`~/.wisp/skills/<name>/`, which every Project sees, or in the Project's
`.settings/skills/<name>/`, and no one is asked. A Skill it writes there is offered to later
Runs too. Built-in Skills cannot be changed. To be asked first:

```sh
wisp permissions set skill_fs_write ask
```

:::

## Memory and other agent tools

| Tool | What it does | Default |
| --- | --- | --- |
| `memory_store` | saves a memory, tied to this Session or kept for good | `allow` |
| `memory_recall` | finds memories by text, tag or type | `allow` |
| `memory_update` | changes a memory | `allow` |
| `memory_delete` | deletes a memory | `allow` |
| `memory_get_all` | reads every memory, with no filter | `ask` |
| `preference_get` | reads a stored preference of the user | `allow` |
| `preference_set` | stores a preference of the user | `allow` |
| `spawn_agent` | starts a subagent for part of the task | `allow` |
| `diagnostics_read` | reads the Runtime's recent errors and warnings | `allow` |
| `recording_list` | lists meeting recordings | `allow` |
| `recording_read` | reads a recording's transcript | `allow` |
| `recording_search` | searches recordings for a topic | `allow` |
| `recording_delete` | deletes a recording and its transcript | `ask` |

The agent also remembers on its own. After each turn in which it stored nothing itself, the
Runtime asks the model what in the turn is worth keeping and saves that. Before each turn
it adds the memories and preferences that look relevant, from every Session and Project, and
points the agent at recordings that do. A memory the agent marks `project` is not limited
to the Project: it is offered everywhere, and it is deleted with the Session that stored it.
A `global` one stays until it is deleted.

A subagent can use every tool the agent has, writing files included, unless the agent
narrows it to the read tools and `bash_run`. Its tool calls go through the same Rules as the
agent's own. By default it stops after 200 steps or 5 minutes.

## Connector tools

Each [connector](./connectors.md) adds its own tools, named `mcp__<connector>__<tool>`. Every
one of them defaults to `ask`, whatever the server says about it.

A connector whose server offers resources or prompts also gets four tools that default to
`allow`:

- `mcp__<connector>__list_resources`
- `mcp__<connector>__read_resource`
- `mcp__<connector>__list_prompts`
- `mcp__<connector>__get_prompt`

`wisp permissions get --connector <name>` lists one connector's tools.

## Web search and fetch

The agent reaches the web through the Wisp proxy's own connector, `wisp_proxy`. It needs no
`wisp connectors add` and no `enable`, and `wisp connectors list` does not show it. Its tools:

| Tool | What it does | Default |
| --- | --- | --- |
| `mcp__wisp_proxy__brave_search` | searches the web | `ask` |
| `mcp__wisp_proxy__fetch_url` | fetches a page as text | `ask` |
| `mcp__wisp_proxy__curl` | sends any HTTP request, `POST` and `DELETE` among them | `ask` |

Like every connector tool they ask, so under `wisp run` the agent cannot search the web
until a Rule allows it. Allow the two that read:

```sh
wisp permissions set mcp__wisp_proxy__brave_search allow
wisp permissions set mcp__wisp_proxy__fetch_url allow
```

:::warning
`wisp permissions allow-connector wisp_proxy` allows `mcp__wisp_proxy__curl` as well, and
that lets the agent send data to any address. Allow the tools one by one unless you mean it.
:::

`mcp__wisp_proxy__brave_search` is there only when the proxy has search set up.
`wisp permissions get --connector wisp_proxy` shows what your proxy offers.
