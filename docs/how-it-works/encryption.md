---
title: Data encryption
sidebar_label: Data encryption
description: How Wisp encrypts what it keeps on your machine.
---

# Data encryption

Before any data, prompts or attachments are sent from the Wisp app to the cloud, your
information is encrypted and stored locally.

The cryptography happens in the storage layer of the [Wisp agent](./agent.md). As a design
choice, the desktop app deliberately holds almost nothing sensitive, so the encrypted
databases live in the agent's custody.

The encryption algorithm is ChaCha20-Poly1305, an authenticated encryption (AEAD) scheme.
It gives two guarantees:

1. **Confidentiality**: data at rest is unreadable without the key.
2. **Integrity**: the Poly1305 auth tag means any tampering with the ciphertext (bit-flips,
   truncation, substitution) fails decryption instead of silently corrupting it. The
   system detects modification instead of loading forged state.
