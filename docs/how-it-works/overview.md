---
title: The Wisp stack
sidebar_label: Overview
description: The local and cloud parts of Wisp, and what each one is trusted with.
---

# The Wisp stack

The Wisp stack splits into local and cloud components.

## Local

**Desktop app.** What you see and click when you open Wisp: chat, your file tree, the diff
viewer, the audit log. The app reads folders straight off your disk, never through the
cloud or the agent. The binary holds zero API keys or credentials, so there are no baked-in
secrets to leak. See [The desktop app](../desktop/app.md).

**Storage (encrypted).** At rest, your chats, audit log, memory and connector tokens live
in a ChaCha20-Poly1305 encrypted database on your machine. The encryption key exists only in your
OS keyring: it's never written to disk and Wisp doesn't keep a copy. See
[Data encryption](./encryption.md).

**Wisp agent.** The Wisp agent runs entirely on your machine. It plans and executes each
step: which file to read, which command to run, which tool to call. See
[The Wisp agent](./agent.md).

**Kernel.** As an additional privacy and security measure, every agent action goes through
the Kernel first. The Kernel refuses any path that leads outside your project folder, into
sensitive directories such as `~/.ssh` or into Wisp's own `~/.wisp`, checks every tool
call against your [Permissions](../permissions.md) (`allow`, `ask` or `deny`), waits for
your approval on `ask`, and logs every tool call locally. It
also encapsulates encryption and key management, so the Wisp agent has no access to
secrets such as MCP auth tokens: the agent can only ask the Kernel to call the MCP tool.
The agent can decide to do something, but it can't reach around the Kernel to do it on its
own. See [The Kernel](./kernel.md).

## Cloud

**Wisp Proxy (Anonymizer).** The stateless gateway that forwards your prompts to the LLM
and executes identifiable requests (web search, for example) on your behalf, so third
parties can't track you or build a profile of you. The Wisp Proxy keeps no database or
logs, and runs inside a Trusted Execution Environment (TEE), so nobody at Wisp can see
inside. See [Wisp Proxy](./proxy.md).

**LLM.** The model itself runs inside a Trusted Execution Environment (Intel TDX), a secure
hardware enclave that the chip encrypts with a key it never reveals. The OS, the cloud
host, the root user and Wisp's own staff see only ciphertext: no person can read what's
inside. See [The LLM](./llm.md) and [Trusted Execution Environments](./tee.md).
