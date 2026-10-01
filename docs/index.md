---
slug: /
title: The Wisp Runtime
sidebar_label: What is Wisp
description: An AI agent you run on your own machine, with a model inside a trusted execution environment.
---

# The Wisp Runtime

Wisp is an AI agent you run on your own machine. You install one program, `wisp`. It keeps
your credentials and your conversations on that machine and does the work there. The model
it talks to runs inside a trusted execution environment, so the files it reads are never
visible in the clear on the way to the model.

There are two ways to use it, and both talk to the same Runtime:

- **From a terminal or a script.** `wisp run "…"` sends a prompt and prints the answer, the
  way `claude -p` does.
- **Over HTTP.** The `/v1` API on `127.0.0.1` lets your own code (a chat bot, a webhook
  handler, a scheduler) turn its events into Runs.

If you also use Wisp Desktop, the CLI talks to the Runtime inside the app, and your Sessions
and connectors are shared between the two.

## Where to go next

| You want to… | Read |
| --- | --- |
| Install it and get a first answer | [Quickstart](./quickstart.md) |
| Run it as a service, update it, remove it | [Install, update, uninstall](./install.md) |
| Use it day to day from the terminal | [Using the CLI](./cli.md) |
| Give the agent access to GitHub, Drive, Telegram, your own MCP servers | [Connectors](./connectors.md) |
| Decide which tools may run unattended | [Permissions](./permissions.md) |
| Ship an agent as a folder you can check out on a server | [Deploying an agent](./deploy-an-agent.md) |
| Call Wisp from your own code | [The adapter contract](./adapter-contract.md) and [a worked example](./incident-bot.md) |
| Keep it running | [Runs and restarts](./runs-and-restarts.md), [Troubleshooting](./runbook.md), [Security](./security.md) |
| Look up a command, route or setting | [Reference](./reference.md) |

## Words used on this site

- **Runtime**: the running `wisp serve` process (or the one inside Wisp Desktop).
- **Session**: one conversation. It keeps its history between Runs and across restarts.
- **Run**: one prompt sent to a Session, and the agent's work until it answers.
- **Project**: the folder a Session works in. The agent's file tools are confined to it.
- **Connector**: an MCP server, or Telegram, that gives the agent more tools.
- **Rule**: a decision (`allow`, `ask` or `deny`) for one tool, globally or for one Project.
