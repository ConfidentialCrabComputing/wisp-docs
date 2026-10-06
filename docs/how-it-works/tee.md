---
title: Trusted Execution Environments
sidebar_label: Trusted Execution Environments
description: What a TEE is, how Wisp verifies one before sending anything, and why not FHE.
---

# Trusted Execution Environments

A Trusted Execution Environment (TEE) is a hardware-isolated region inside the CPU or GPU
that can't be accessed even by the host's OS, hypervisor or other applications. Wisp uses
TEEs in two places: the [Wisp Proxy](./proxy.md) and the [LLM](./llm.md) itself, inside
Phala, with Tinfoil as a fallback.

## How it works

Intel TDX, which Wisp uses, has a dedicated hardware memory-encryption engine in the CPU's
memory path. It encrypts data with a per-VM key as the data moves between the CPU and RAM.
The key lives inside the CPU and is never exposed to software. Not even Phala, which
supplies the hardware, can see inside.

## Attestation

Before anything leaves your device, the Wisp desktop app asks the TEE for an
*attestation*: cryptographic proof that the TEE is running *this exact code* on *this
exact hardware*.

1. Wisp asks the TEE to attest, sending a fresh nonce.
2. The TEE returns a quote covering a hardware attestation and a measurement of the code
   it booted.
3. Wisp verifies that the hardware attestation is signed by Intel: proof it's a genuine,
   up-to-date TDX chip.
4. Wisp matches the code measurement against the published build: the exact image digest
   our CI produced from the code. We'll open-source it soon, so anyone will be able to
   rebuild it and check the hash themselves.
5. On any mismatch, Wisp refuses to send a single byte off your device.

## TEE vs FHE

TEEs are a robust architecture, but they still require your data to be decrypted inside
the secure enclave in order to be processed. Fully homomorphic encryption (FHE) is, in
theory, the most private option for AI inference, because prompts never get decrypted.

In a TEE, the prompt arrives at the enclave encrypted, and the enclave decrypts it because
the model has to run inference on plaintext. FHE skips the decryption step: the hardware
computes directly on ciphertext and produces an encrypted answer that only your key can
open.

The problem with FHE inference is that it is far from commercially viable. It is currently
several thousand times slower than a TEE, and it still doesn't prove which model ran the
inference, so the Wisp app would still need to verify attestations. When a more private
and performant option emerges, we'll adopt it.

## Is a TEE 100% secure?

Nothing is trust-free (FHE included); the metric is the cost of an attack. Attestation
doesn't remove trust. It moves the attack from "an insider greps the logs" to "physically
taking over a secure machine", which is substantially more expensive.
