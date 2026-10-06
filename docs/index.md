---
slug: /
title: Wisp
sidebar_label: About Wisp
description: A confidential AI harness that lets nobody, including Wisp or the GPU provider, read, store or train on your data.
---

# Wisp

Wisp is a confidential AI harness that lets nobody, including Wisp or the GPU provider,
read, store or train on user data.

Most AI companies enforce *privacy by policy*: they publish a document (Terms of Service or
a Privacy Policy) where they promise not to misuse your data. That guarantee is purely
legal. With no structural buffers, millions of user sessions and terabytes of confidential
information have already been exposed through hacks, system errors and government
subpoenas.

Wisp is built on *privacy by architecture*. The whole harness is built from the ground up
with privacy in mind, so you don't have to trust anyone (even us) and can instead
cryptographically verify exactly how your data is processed.

Wisp is a desktop app that runs a privacy-enhanced local agent. It anonymizes your
identifiable requests (web search, for example) through the Wisp Proxy, which runs inside a
Trusted Execution Environment (TEE), and routes your prompts to open-weight LLMs inside a
TEE: a secure hardware enclave that nobody can access.

## Where to go next

| You want to… | Read |
| --- | --- |
| Understand how Wisp keeps your data private | [How Wisp works](./how-it-works/overview.md) |
| Use the Wisp desktop app and its features | [The desktop app](./desktop/app.md) |
| Run the agent from a terminal, a script or your own code | [The Wisp Runtime](./runtime.md) |
