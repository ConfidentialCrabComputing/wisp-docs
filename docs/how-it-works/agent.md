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

Tools whose Rule resolves to `ask` (by default shell commands and every connector tool) stop
before they run: the [Kernel](./kernel.md) holds the call and the desktop app shows a card
with the exact action. You can approve it once, deny it, or allow the tool for this Project
or everywhere.

Silence is never consent. A confirmation nobody answers is denied after `confirmTimeoutMs`
(2 hours by default), and so is one whose Run is cancelled. Runs started from the CLI or
`/v1` have nobody to ask, so there `ask` means deny. See [Permissions](../permissions.md).

## The audit log

Every tool call is recorded: the tool name, full arguments, result, approval status and
timestamp. The record lives in the encrypted SQLite store (`~/.wisp/data.db`), so even the
audit trail is protected at rest. You can reconstruct exactly what the agent did, when, and
whether a human approved it.

## Under the hood

**Runtime and framework**

- Orchestration: LangGraph (node-based agent state machine)
- Language: Node.js (TypeScript, ES modules)
- Persistence: SQLite via better-sqlite3 (synchronous, file-based)
- Encryption: ChaCha20-Poly1305

**Local tools**

- Files, scoped to the project root: reading, listing and searching run without
  confirmation; writing and editing are `ask` by default
- Shell commands: `ask` by default
- Encrypted memory and preferences: store, recall, update and delete
- Sub-agents: for parallel or read-only work, each capped at 200 steps and a 300 s
  timeout (time spent waiting on a confirmation does not count)
- Skills: invoked by name, with their own files
- Call recordings: list, read and search

**Sandbox.** Shell commands are sandboxed by default: with `sandbox-exec` on macOS and
bubblewrap on Linux. A Windows sandbox is in development.

**Remote tools** (through the [Wisp Proxy](./proxy.md), inside the TEE)

- Web search, page fetching and raw HTTP requests, all executed inside the hardware
  enclave, results returned over MCP

**Connectors.** Gmail, Google Calendar, Google Drive, Telegram and any MCP server you add.
Their tools are named `mcp__<connector>__<tool>` and are `ask` by default. See
[Permissions](../permissions.md).

**Sessions and memory**

- Chat sessions: encrypted SQLite (`~/.wisp/data.db`), scoped per project
- Agent memory: persistent across sessions, tagged (user, project, feedback, reference),
  full-text search through FTS5
- Audit log: every tool call recorded with arguments, result, timestamp and approval status

**Streaming and UI**

- Results stream to the desktop app over Server-Sent Events (SSE)
- The desktop app renders tool execution and diffs live
