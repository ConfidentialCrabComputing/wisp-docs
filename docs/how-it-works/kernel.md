---
title: The Kernel
sidebar_label: Kernel
description: The local gatekeeper every tool call passes through before anything executes.
---

# The Kernel

The Kernel is Wisp's local security gatekeeper. It's part of the [Wisp agent](./agent.md)
on your machine, and sits between the LLM on one side and your filesystem and the
encrypted database on the other, to enforce hard boundaries on what any tool call can do.

## What the Kernel checks

Before anything executes, the Kernel checks:

**Project boundary**

- **Path canonicalization**: resolves `../..`, symlinks and relative paths to their
  absolute form, to prevent directory traversal attacks.
- **Symlink blocking**: rejects tool calls that try to escape the project root through
  symbolic links.
- **Absolute path resolution**: absolute paths aren't rejected outright. The Kernel
  resolves them and refuses only those that lead outside the project, into sensitive
  directories (for example `/etc/passwd` or `~/.ssh/`) or into `~/.wisp`.
- **Bash working directory lock**: bash commands run with the working directory locked to
  the project root, so `cd ..` or `cd /` doesn't let the agent wander.

**Schema and permissions**

- Validates every tool call against its JSON schema, so malformed arguments never reach
  your OS.
- Checks whether the requested operation is allowed: for example, `fs_write`, `fs_edit`
  and `bash_run` require your confirmation first (the confirmation gate), while `fs_read`
  is scoped read-only.

## A request, step by step

1. You send a message.
2. The Wisp agent plans which tools it needs to fulfill the request.
3. The Kernel validates each tool call against its schema.
4. The Kernel checks the call against your Rules.
5. The confirmation gate fires for writes and destructive operations.
6. Tools execute locally or through the [Wisp Proxy](./proxy.md). A tool resolves its
   paths as it starts and refuses the call if they lead out of bounds.
7. The audit logger records what happened.

The Kernel is the universal stopgap. If an LLM hallucinates and tries to `rm -rf ~` or read
your global password store, the Kernel kills that call before it ever spawns a process. It
is the component that lets you give an autonomous agent access to your machine without
trusting it with root-level access.
