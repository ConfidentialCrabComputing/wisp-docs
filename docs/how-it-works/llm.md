---
title: The LLM
sidebar_label: LLM
description: Where the model runs, why only open-weight models, and the path a prompt takes.
---

# The LLM

The LLMs Wisp uses don't run on your machine, and they don't run on ordinary cloud servers
either. They run inside their own Trusted Execution Environments, currently brokered
through two confidential inference providers, Redpill and Tinfoil.

## Open-weight models only

Wisp supports only leading open-weight models, for two reasons:

1. **Attestation requires full code visibility.** To cryptographically prove what software
   runs inside an enclave, the operator must control the deployment. Proprietary models
   (Fable, Sol, Gemini and others) can't be deployed this way by a third party.
2. **Licensing.** Open-weight licenses allow self-hosting inside confidential compute,
   which is what makes privacy verifiable at the inference layer.

## The path of a prompt

The LLM sits at the end of a prompt's journey:

1. You write a prompt in the Wisp app.
2. The prompt leaves the agent encrypted.
3. The [Wisp Proxy](./proxy.md) anonymizes identifiable requests like web search and
   forwards the prompt to the LLM.
4. The LLM runs inside its provider's TEE (Redpill or Tinfoil).
5. The response returns through the same encrypted path.
6. Conversation history persists only in your local encrypted SQLite.

At no point does any party, including Wisp or the inference provider, hold plaintext access
to your conversation. Privacy doesn't rest on policies or trust: it rests on hardware
attestation at every step where computation happens.
