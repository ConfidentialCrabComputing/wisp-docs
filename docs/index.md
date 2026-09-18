---
slug: /
title: The Wisp Runtime
sidebar_label: What this is
sidebar_position: 1
---

# The Wisp Runtime

Wisp is an agent you run yourself. One binary on a machine you own: it holds the
credentials, does the work, and talks to a model that runs inside a trusted execution
environment — so the documents it reads never leave the vault in the clear.

It is driven two ways, and they are the same Runtime:

- **`wisp run "…"`** from a terminal or a script, the way `claude -p` is used.
- **`/v1` over HTTP on loopback**, for an adapter that turns a chat message, an issue or a
  webhook into a Run.

Start with the [quickstart](./quickstart.md): install, start, run, connect — about ten
minutes on a machine with nothing on it.

Then, depending on which side of it you are on:

- Writing something that calls a Runtime — [the adapter contract](./adapter-contract.md),
  [deploying an agent](./deploy-an-agent.md), and [a worked example](./incident-bot.md) you
  can run.
- Running one — [runs and restarts](./runs-and-restarts.md),
  [states and the runbook](./runbook.md), and [security](./security.md).
