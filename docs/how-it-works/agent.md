---
title: The Wisp agent
sidebar_label: Wisp agent
description: The local orchestrator that plans each step, and what it is and isn't allowed to do on its own.
---

# The Wisp agent

The Wisp agent is the local orchestrator that runs on your machine as a sidecar process.
Everything the LLM needs or wants to do routes through the agent, and nothing touches your
filesystem or the network without its say-so.

:::note
The Wisp agent is the [Wisp Runtime](../runtime.md) running inside the desktop app. The
same Runtime is what `wisp serve` starts when you use Wisp from a terminal.
:::

The agent sends only the minimal context the LLM needs to reason, and the response comes
back through the same encrypted path. Everything else (reading, writing, execution) stays
local.

## Confirmation before risky actions

Tools whose Rule resolves to `ask` (by default writing files, shell commands, changing a
scheduled job, every connector tool and a few more; see [Tools](../tools.md)) stop
before they run: the [Kernel](./kernel.md) holds the call and the desktop app shows a card
with the exact action. You can approve it once, deny it, or allow the tool for this Project
or everywhere.

Silence is never consent. A confirmation nobody answers is denied after `confirmTimeoutMs`
(2 hours by default), and so is one whose Run is cancelled. Runs started from the CLI or
`/v1` have nobody to ask unless they ask for the `interactive` mode, so there `ask` means
deny. See [Permissions](../permissions.md).

## The audit log

Every tool call that passes its schema is recorded: the tool name, its arguments and result,
approval status and timestamp. Long values are cut short, and values under secret-looking
names are replaced by `[REDACTED]`. The record lives in the encrypted SQLite store
(`~/.wisp/data.db`), so even the audit trail is protected at rest. You can see what the agent
did, when, and whether a human approved it. Deleting a Session deletes its audit rows too.

## Under the hood

**Local tools**

- Files, in the project folder: reading, listing and searching run without
  confirmation; writing and editing are `ask` by default, and so is any call outside the
  folder while the sandbox is off
- Shell commands: `ask` by default
- Encrypted memory and preferences: store, recall, update and delete
- Sub-agents: for parallel work, with every tool unless the agent narrows them to reading
  and `bash_run`, with no step or time limit unless `subagentTimeoutMs` sets one (time
  spent waiting on a confirmation does not count)
- Skills: invoked by name, with their own files
- Call recordings: list, read and search

**Sandbox.** Shell commands can be sandboxed, off by default: with `sandbox-exec` on macOS
and bubblewrap on Linux. A Windows sandbox is in development. See [Sandbox](../sandbox.md).

**Remote tools** (through the [Wisp Proxy](./proxy.md), inside the TEE)

- Web search, page fetching and raw HTTP requests, all executed inside the hardware
  enclave, results returned over MCP

**Connectors.** Gmail, Google Calendar, Google Drive, Telegram and any MCP server you add.
Their tools are named `mcp__<connector>__<tool>` and are `ask` by default. See
[Permissions](../permissions.md).

**Sessions and memory**

- Chat sessions: encrypted SQLite (`~/.wisp/data.db`), scoped per project
- Agent memory: persistent across sessions and Projects, tagged (user, project, feedback,
  reference), saved by the agent or after a turn on its own, and recalled into each turn by
  local embeddings or full-text search. See [Tools](../tools.md#memory-and-other-agent-tools)
- Audit log: every tool call recorded with shortened, redacted arguments and result,
  timestamp and approval status

**Streaming and UI**

- Results stream to the desktop app over Server-Sent Events (SSE)
- The desktop app renders tool execution and diffs live
