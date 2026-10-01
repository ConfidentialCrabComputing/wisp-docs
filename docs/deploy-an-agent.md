---
description: An agent is a folder. What goes in it, and the setup each machine needs on top.
---

# Deploying an agent

In Wisp, an agent is a **Project folder**. You write it, commit it and check it out on the
machine that runs it. The folder holds the agent's instructions and Skills; the machine
holds its secrets and permissions.

## What the folder holds

```
incident-agent/
├── AGENTS.md                       # standing instructions for every Session
├── .settings/skills/
│   └── open-case/SKILL.md          # a named procedure: wisp run --skill open-case
└── .wisp/                          # this machine's bookkeeping; never committed
```

- **`AGENTS.md`** is read at the start of every Session in this Project. `CLAUDE.md` and
  `WISP.md` work too.
- **`.settings/skills/<name>/SKILL.md`** is a Skill. The front matter is flat `key: value`
  pairs:

  | Key | Meaning |
  | --- | --- |
  | `name` | what `--skill` calls it |
  | `description` | one line, shown by `wisp skills list` |
  | `whenToUse` | tells the agent when the Skill fits |
  | `arguments`, `argumentHint` | what the text after the Skill's name should be |
  | `allowedTools` | limits the tools the agent can use during this Skill |
  | `context` | `inline` (in the Session) or `fork` (in a separate sub-conversation) |
  | `paths` | file patterns the Skill relates to |

- **`.wisp/`** is created by the Runtime the first time the folder is used. It holds the
  Project's id, which connectors are enabled, and its Rules. It contains its own
  `.gitignore` with `*`, so it is never committed.

## Deploying to a server

With the Runtime [installed and signed in](./quickstart.md) on the server:

```sh
git clone git@example.com:ops/incident-agent.git /srv/agents/incidents
cd /srv/agents/incidents

# once per machine: add the connector with its secret
wisp connectors add chatstore --http https://chat.internal/mcp/ --header-stdin Authorization

# once per Project: enable it, and allow the tools it may use unattended
wisp connectors enable chatstore --project .
wisp permissions allow-connector chatstore --project .
```

Then check what the agent will actually get:

```sh
wisp permissions get --project .   # each tool's decision, and the Rule behind it
wisp skills list --project .
wisp connectors list
```

## What a deploy does not carry

A checkout brings `AGENTS.md` and the Skills, nothing else. Everything below is set up
once on each machine:

- **The login:** `wisp login`, or `wisp login --manual` on a server.
- **Connectors and their secrets:** `wisp connectors add`.
- **Enabled connectors and Rules:** `wisp connectors enable` and `wisp permissions`. These
  are tied to the Project's id on this machine, so a copy of the folder never inherits
  someone else's permissions.
- **`bash_run`:** refused until a Rule allows it, and on Linux it also needs bubblewrap.
  See [Permissions](./permissions.md#bash_run).

## One Runtime, many Projects

Run one Runtime per machine. It serves every Project; you do not start a second one for a
second folder, and the data directory lock would refuse it anyway.

The Project is chosen per Session, by whoever starts it:

- the CLI uses the current folder (`cd` before `wisp run`), or `--project`;
- an adapter passes `projectRoot` to `POST /v1/sessions`.

Sessions in different Projects run side by side, up to `maxConcurrentRuns` at once. The
folder `wisp serve` was started from does not matter.
