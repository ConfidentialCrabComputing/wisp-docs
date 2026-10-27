---
description: Which tools may run without a person approving them, and how to change that with Rules.
---

# Permissions

Every tool call is checked against a decision:

- **`allow`**: the call runs.
- **`ask`**: a person has to approve it.
- **`deny`**: the call is refused.
- **`always_ask`** ("Always ask me" in Wisp Desktop): a person has to approve every call,
  whatever else would allow it. Only you set it; no tool has it as its default. See
  [Always ask me](#always-ask-me).

In Wisp Desktop, `ask` shows a card you approve or reject. A Run started from the CLI or
over `/v1` has nobody to ask unless it runs in the `interactive` mode (see
[`--interactive`](./cli.md#long-runs-and-approvals)), so there **`ask` is treated as
`deny`**: the tool returns a
refusal, the agent is told, and it carries on without it. Usually it explains what it could
not do, or drafts the message it was not allowed to send.

The Run still completes. A refused call shows up as `ok: false` in the Run's `toolCalls`
and in `wisp audit`. The refusal tells the agent which `wisp permissions` command would allow
the tool, so it can pass that on to you.

This is the safe default for unattended work. Text from a web page, a connector or a file
cannot talk the agent into an action that you have not allowed in advance.

## Where a decision comes from

Each tool has a default. Tools that only read, such as `fs_read`, `fs_list`, `fs_glob` and
`fs_grep`, default to `allow`. Tools that change something default to `ask`: `fs_write`,
`fs_edit`, `bash_run`, and **every connector tool**, the web search and fetch that go through
the Wisp proxy among them. [Tools](./tools.md) lists every tool with its default, and
`wisp permissions get` shows the decision that applies now.

Rules override the default. The first match in this order wins:

| Step | Set with |
| --- | --- |
| `global-deny-floor`: a global `deny`, which nothing below can override | `wisp permissions set <tool> deny` |
| `project-bypass`: everything allowed in this Project | `wisp permissions bypass on --project <path>` |
| `project-rule`: a Rule for this Project | `wisp permissions set <tool> <decision> --project <path>` |
| `global-rule`: a Rule for every Project | `wisp permissions set <tool> <decision>` |
| `baseline`: the tool's own default | — |

Two kinds of call ask whatever a Rule or a bypass says, and a `deny` still refuses them:
creating, changing or deleting a [scheduled job](./tools.md#schedules), and a file tool call
on a path outside the Session's folder, which only happens with the sandbox off (see
[Files](./tools.md#files)).

## Seeing what applies

```sh
wisp permissions get --project .
# project 3f1c…  bypass off
# fs_read  allow
# bash_run  ask
# mcp__github__list_pull_requests  allow  project-rule
# mcp__github__create_issue  ask
```

Each tool with its effective decision; the agent's own mechanics, such as `memory_*` and
`skill_*`, are left out ([Tools](./tools.md) names them). The step is shown only when a Rule or a bypass made
the decision; a tool on its own default shows none. Without `--project` you see the global
picture. `--connector <name>` shows only that connector's tools.

## Changing it

```sh
# one tool, in one Project
wisp permissions set mcp__github__list_pull_requests allow --project .

# every tool of a connector, in one Project
wisp permissions allow-connector github --project .

# one tool, everywhere
wisp permissions set bash_run deny

# drop a Rule: the tool is back on its own default
wisp permissions set bash_run default
```

`allow-connector` writes one ordinary Rule per tool the connector has right now. A tool the
server adds later has no Rule until you run it again. The connector must be connected when
you run it.

A tool's name is `mcp__<connector>__<tool>` for connector tools. `wisp permissions get`
lists the exact names, and [Tools](./tools.md) lists the built-in ones.

A good pattern for an agent that should read but not act: allow the connector's read tools
one by one, and leave the tools that send, post or delete at their `ask` default. They
will be refused, and the agent drafts instead.

## Project bypass

```sh
wisp permissions bypass on --project .
```

Allows every tool in that Project, except tools with a global `deny`. The two kinds of call
[above](#where-a-decision-comes-from) still ask, and so does a tool set to
[Always ask me](#always-ask-me). Use it only for a Project where you would approve anything
the agent might do.

## Always ask me

```sh
wisp permissions set mcp__github__create_issue always_ask
```

For a tool you want to approve every time, even in a Project with bypass on or with an
`allow` Rule. The decision is first worked out as in the
[table above](#where-a-decision-comes-from); then, unless it is a `deny`, an `always_ask`
Rule for the tool, in this Project or global, makes the call ask.

- Its card offers no Rule: you approve or reject this one call. `wisp confirm` offers only
  `approve` or `deny` for it.
- [Auto Mode](#auto-mode) does not judge it: it always goes to you.
- A Run with nobody to ask refuses it, as it refuses an `ask`.
- `wisp permissions set <tool> default` drops it.

Wisp Desktop can also set it on a whole connector ("All tools → Always ask me"), as can
`POST /v1/permissions/connector` with `always_ask`. That writes a Rule for each tool and one
for the connector itself, so tools the connector adds later ask too. Setting any other
decision on the connector drops it.

## Auto Mode

```sh
wisp auto-mode on
```

Off by default. While it is on, a call that would ask a person is first shown to the
**Judge**, a model the Runtime reaches through the Wisp proxy. The Judge sees what you asked
for and the one action about to run, never what tools returned, and either lets the call run
or sends it on to you as the usual Prompt, marked "Auto Mode sent this for you to check". It
never refuses a call: a refusal is still yours or a Rule's.

- It applies only where there is a person to ask: Wisp Desktop, an `interactive` Run, the
  Telegram bot and the Slack app. Under the CLI's default mode an `ask` is still refused.
- A global `deny` still refuses, and the two kinds of call
  [above](#where-a-decision-comes-from) and a tool set to [Always ask me](#always-ask-me)
  still go to you.
- When the Judge cannot answer (an action too long to judge, a timeout, the proxy failing),
  the call goes to you.
- A Runtime with no proxy cannot judge: `wisp auto-mode status` says so, and every `ask`
  goes to a person.

`wisp auto-mode off` turns it off; the switch is the same for every Project. The owner of
the [Telegram bot](./telegram-bot.md#commands) or the [Slack app](./slack-app.md#commands)
can also turn it on or off from the chat with `/auto on|off` or `!auto on|off`.

## `bash_run`

`bash_run` lets the agent run shell commands. It defaults to `ask`, so under the CLI it is
refused until a Rule allows it. Before you allow it, know that:

- **The sandbox is off by default.** A command runs as the Runtime's own user and can read
  your home folder and the key source. `wisp sandbox on` keeps commands inside their
  folder. See [Sandbox](./sandbox.md#turn-it-on-or-off).
- **The sandbox's network is on by default.** Allowing `bash_run` also allows network
  access from this machine.
- **On Windows there is no sandbox yet.** Allowing `bash_run` there allows anything the user
  can do.

## Where Rules live

Rules are stored in the Runtime's data directory, keyed to this machine's id for the
Project. They do not travel with a checkout of the folder, on purpose: a copied folder
should not inherit the original's permissions. Rules are shared with Wisp Desktop when both
use the same data directory.
