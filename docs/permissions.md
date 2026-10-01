---
description: Which tools may run without a person approving them, and how to change that with Rules.
---

# Permissions

Every tool call is checked against a decision:

- **`allow`**: the call runs.
- **`ask`**: a person has to approve it.
- **`deny`**: the call is refused.

In Wisp Desktop, `ask` shows a card you approve or reject. A Run started from the CLI or
over `/v1` has nobody to ask, so there **`ask` is treated as `deny`**: the tool returns a
refusal, the agent is told, and it carries on without it. Usually it explains what it could
not do, or drafts the message it was not allowed to send.

The Run still completes. A refused call shows up as `ok: false` in the Run's `toolCalls`
and in `wisp audit`. The refusal tells the agent which `wisp permissions` command would allow
the tool, so it can pass that on to you.

This is the safe default for unattended work. Text from a web page, a connector or a file
cannot talk the agent into an action that you have not allowed in advance.

## Where a decision comes from

Each tool has a default. Most built-in tools, such as the file tools, default to `allow`.
`bash_run` and **every connector tool** default to `ask`. Rules override the default. The first match in
this order wins:

| Step | Set with |
| --- | --- |
| `global-deny-floor`: a global `deny`, which nothing below can override | `wisp permissions set <tool> deny` |
| `project-bypass`: everything allowed in this Project | `wisp permissions bypass on --project <path>` |
| `project-rule`: a Rule for this Project | `wisp permissions set <tool> <decision> --project <path>` |
| `global-rule`: a Rule for every Project | `wisp permissions set <tool> <decision>` |
| `baseline`: the tool's own default | — |

## Seeing what applies

```sh
wisp permissions get --project .
# project 3f1c…  bypass off
# fs_read  allow
# bash_run  ask
# mcp__github__list_pull_requests  allow  project-rule
# mcp__github__create_issue  ask
```

Every tool with its effective decision. The step is shown only when a Rule or a bypass made
the decision; a tool on its own default shows none. Without `--project` you see the global
picture.

## Changing it

```sh
# one tool, in one Project
wisp permissions set mcp__github__list_pull_requests allow --project .

# every tool of a connector, in one Project
wisp permissions allow-connector github --project .

# one tool, everywhere
wisp permissions set bash_run deny
```

`allow-connector` writes one ordinary Rule per tool the connector has right now. A tool the
server adds later has no Rule until you run it again. The connector must be connected when
you run it.

A tool's name is `mcp__<connector>__<tool>` for connector tools. `wisp permissions get`
lists the exact names.

A good pattern for an agent that should read but not act: allow the connector's read tools
one by one, and leave the tools that send, post or delete at their `ask` default. They
will be refused, and the agent drafts instead.

## Project bypass

```sh
wisp permissions bypass on --project .
```

Allows every tool in that Project, except tools with a global `deny`. Use it only for a
Project where you would approve anything the agent might do.

## `bash_run`

`bash_run` lets the agent run shell commands. It defaults to `ask`, so under the CLI it is
refused until a Rule allows it. Before you allow it, know that:

- **It runs in a sandbox that limits the filesystem, not the network.** Allowing `bash_run`
  also allows network access from this machine.
- **The sandbox needs OS support.** On Linux it needs bubblewrap (`sudo apt install
  bubblewrap`). On macOS it uses the built-in `sandbox-exec`. If the sandbox is not
  available, `bash_run` refuses to run rather than running without it.
- **On Windows there is no sandbox yet.** Commands run directly on the host, so allowing
  `bash_run` there allows anything the user can do.

## Where Rules live

Rules are stored in the Runtime's data directory, keyed to this machine's id for the
Project. They do not travel with a checkout of the folder, on purpose: a copied folder
should not inherit the original's permissions. Rules are shared with Wisp Desktop when both
use the same data directory.
