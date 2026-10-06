---
title: Glossary
sidebar_label: Glossary
description: The words used across Wisp's architecture pages.
---

# Glossary

The words specific to running Wisp from a terminal or your own code (Runtime, Session, Run,
Project, Connector, Rule) are on [The Wisp Runtime](../runtime.md#words-used-on-this-site).

**Agent**: the component that plans what Wisp should do next. It decides which tool to call
and with what arguments, but does not execute actions directly: all execution goes
through the Kernel.

**Attestation**: a hardware-signed cryptographic report that proves what code is running
inside a TEE. Your machine verifies the attestation before sending any data to the cloud
enclave. If the fingerprint doesn't match the published code, the connection is refused.

**Confirmation gate**: the Kernel step after the schema and Rule checks. A tool call whose
decision is `ask` (by default shell commands and every connector tool) waits until you see
the exact action and approve it. An `allow` Rule or a Project bypass skips it, and an
unanswered confirmation is denied. See [Permissions](../permissions.md).

**Enclave**: a protected region of memory where code runs isolated from the operating
system and the system administrator. In Wisp, the LLM and the Proxy run inside an enclave.

**Encrypted storage**: local on-disk storage (chat history, audit log, tokens, keys)
encrypted with a key held only in the OS keyring. Wisp holds no copy of the key.

**End-to-end verifiable**: Wisp's security property. Your machine verifies the cloud
enclave's identity before sending data, instead of relying on transport encryption alone.
Not to be confused with end-to-end encryption.

**Kernel**: the gate every real-world action must pass: schema, Rule, confirmation, then
audit. The agent asks; the Kernel decides whether to allow it.

**OS keyring**: the operating system's secure credential store: macOS Keychain, Windows
DPAPI/Credential Manager, or Linux libsecret/Secret Service. It holds the local storage
encryption key.

**Phala**: Wisp's TEE hosting provider. It runs on Intel TDX confidential computing
hardware.

**Sealed enclave**: the hardware (Intel TDX), Proxy and LLM running in the cloud, taken
together. "Sealed" means the memory is encrypted by a key the CPU generates and never
reveals.

**Stateless proxy**: the routing component inside the sealed enclave. It holds the model
API credentials and forwards requests, but stores nothing: no database, no log, no state.

**Symlink escape**: an attack where a symbolic link inside the project folder points to a
sensitive file outside it. The Kernel's path check resolves symlinks first, then checks
the resolved path against the boundary of the opened folder.

**TEE (Trusted Execution Environment)**: a hardware-isolated execution environment built
into the processor. Code and data inside can't be read by the OS, the hypervisor or the
system administrator. Intel TDX is the implementation Wisp uses.

**Trust anchor**: the root of verification. For attestation, it is the chip manufacturer's
hardware signing key: not Wisp, not the hosting provider, but the silicon vendor.
