---
sidebar_position: 4
description: A Project folder is the unit — what a checkout carries, and the two commands it does not.
---

# Deploying an agent

The unit of deployment is a folder. A **Project folder** is what you write, commit and check
out; everything the Runtime knows about "this agent" it learns from there, plus two commands
on the host.

## What the folder holds

- **`AGENTS.md`** — the standing instructions every Session on this Project starts with.
  (`CLAUDE.md` and `WISP.md` are accepted under the same loader.)
- **`.settings/skills/<name>/SKILL.md`** — the named procedures a Run invokes by name. The
  front matter is flat `key: value`: `name`, `description`, `whenToUse`, `arguments`,
  `argumentHint`, `allowedTools`, `context` (`inline` or `fork`), `paths`. `allowedTools`
  narrows the tool set for that one turn.
- **`.wisp/`** — the host's bookkeeping: `project-id` (the UUID everything else is keyed on),
  `mcp.json` (which Connectors are enabled here), `rules/`.

When a folder first becomes a Project the anchor writes `.wisp/.gitignore` containing `*`,
on purpose. A checkout therefore carries `AGENTS.md` and `.settings/skills`, and nothing
else: **Connectors and Rules are host-local by construction.** That is a decision, not an
omission — a Project id that travelled with a folder would hand a copy the original's
permissions.

## Deploying is the checkout plus two commands

```sh
git clone git@example.com:ops/incident-agent.git /srv/agents/incidents
cd /srv/agents/incidents

# once per Runtime — the connector definition and its secret
wisp connectors add chatstore --http https://chat.internal/mcp/ --header-stdin Authorization

# once per Project — enable it here, and write the Rules that let it run
wisp connectors enable chatstore --project .
wisp permissions allow-connector chatstore --project .
```

Both of the last two are needed and they do different things. Enabling puts the Connector's
tools in front of the agent on this Project; the Rule is what lets them run, because under
`policy` a tool no Rule allows is refused. `allow-connector` writes one ordinary per-tool
row for every tool the Connector exposes — the rows a person would otherwise tap out one at
a time on the desktop, in one call.

`--header-stdin` asks for the secret on the terminal, so it lands neither in your shell
history nor in a command line another local account can read.

Then check what the Project actually resolves to:

```sh
wisp permissions get --project .   # every tool, its effective decision, and the step that decided it
wisp skills list --project .
wisp connectors list
```

## One Runtime, every Project

`wisp serve` starts once per machine and never from a Project folder — its own working
directory means nothing. The folder is chosen by the client, per Session: `cd` before
`wisp run`, or `projectRoot` on `POST /v1/sessions`. Two folders are two Sessions on two
Projects inside the one Runtime, running side by side up to `maxConcurrentRuns`. Nobody
starts a second Runtime for a second folder; the data-directory lock refuses one, and the
lock file is how the CLI finds the Runtime that is already there.

A Session created with no Project gets a Desk under `WISP_DESK_ROOT` instead. That is fine
for ad hoc use from a terminal and wrong for an integration: name a Project.

## What a deploy does not carry

- **The Account Login.** Once per host: `wisp login --manual`.
- **Connector secrets.** They live in the Runtime's encrypted store, never in the folder.
- **Rules and Project Bypass.** Keyed on this host's Project id.
- **`bash_run`.** It baselines to `ask`, so under `policy` it is refused until a Rule allows
  it on this Project, and on Linux it needs bubblewrap installed or it fails closed.
  Allowing it hands the agent the host's full network — see [Security](./security.md).
