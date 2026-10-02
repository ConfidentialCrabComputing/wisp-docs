---
description: Running prompts, continuing Sessions, Skills, models, and using wisp from scripts.
---

# Using the CLI

`wisp --help` lists every command by group, and `wisp <command> --help` (or
`wisp help <command>`) shows one command's forms and options. The full list is in the
[Reference](./reference.md#commands).

## Running a prompt

```sh
wisp run "summarise the open TODOs in this repo"
```

`wisp run` sends the prompt, waits for the agent to finish, prints the answer and exits.
There is no time limit on the wait. Ctrl-C or `wisp cancel` ends it.

- **Without a Session id** it starts a new Session whose Project is the current folder.
- **stderr** gets `session <id>` first, before the wait, so you can cancel or continue that
  Session. **stdout** gets the answer only, so `wisp run "…" > answer.md` works.
- **Exit code** is `0` when the Run completed and `1` when it failed or was cancelled. A
  failed Run prints `failed: <reason>: <message>` on stderr. The reasons are listed in
  [Troubleshooting](./runbook.md#why-a-run-failed).
- **Not signed in yet?** At a terminal, `wisp run` asks `Not signed in. Run wisp login now?`
  and signs you in before the Run. From a script, or with `--json`, it does not ask.

### Continuing a conversation

Pass the Session id first:

```sh
wisp run 6b4f2a7e-… "now turn that into a checklist"
```

The agent sees the whole history of that Session. If a Run is already going on the Session,
the new one waits for it to finish.

### Choosing a model

```sh
wisp models
# <id>  <tiers>  <context window>  <capabilities>

wisp run --model <id> "…"
```

`--model` takes a model id from `wisp models`, or `tier:<name>` to let the proxy pick a
model from that tier. Without it, the Run uses `teeLlmModel` from the
[configuration](./reference.md#configuration).

### Running a Skill

A Skill is a named procedure stored in the Project. The agent follows its instructions, and
it may limit which tools the agent can use. See
[Deploying an agent](./deploy-an-agent.md#what-the-folder-holds) for how to write one.

```sh
wisp skills list --project .                   # the Skills this folder has
wisp run --skill open-case "$(cat alert.json)" # the text after the name is the Skill's arguments
wisp run 6b4f2a7e-… --skill summarise ""       # a Skill on an existing Session, no arguments
```

### Retrying safely

`--key <k>` gives the Run an idempotency key. If the same command runs again with the same
key, it gets the first Run's answer instead of running the prompt twice. This is what makes
a cron job or a retry loop safe. See [Runs and restarts](./runs-and-restarts.md#the-key).

## Sessions

```sh
wisp sessions list                 # Sessions started from this folder by the CLI
wisp sessions list --all           # every Session, Wisp Desktop's included
wisp sessions show <id>            # a Session's messages
wisp sessions create --title "…"   # start an empty Session and print its id
wisp sessions delete <id>
```

`list` prints one line per Session: id, origin (`cli` or `desktop`), last update, number of
messages and title.

Sessions are kept on disk. They survive restarts and cost nothing while idle.

## Stopping a Run

```sh
wisp cancel <session>
```

This stops the Session's current Run and every Run queued behind it. The `wisp run` that was
waiting exits with `1` and prints `cancelled`.

## What the agent did

```sh
wisp audit <session>
# 2026-09-18T11:04:22Z  mcp__github__list_pull_requests  ok     380ms  allow
# 2026-09-18T11:04:23Z  mcp__github__create_issue        error    1ms  ask
```

Every tool call of the Session, newest first: when it happened, the tool, whether it
succeeded, how long it took, and the Rule's decision. The audit never records what a tool
received or returned. A row like the second one is a tool that was refused because no Rule
allowed it. See [Permissions](./permissions.md).

## From scripts

- `--json` makes any command print a single JSON document on stdout and nothing else there.
  For `wisp run` it is the full [Run outcome](./adapter-contract.md#a-message-is-a-run) plus
  `sessionId`.
- Exit codes are stable: `0` done, `1` failed, `2` bad command line, `4` no Runtime
  reachable, `5` token refused. See [the full table](./runbook.md#exit-codes).

```sh
wisp run "check the build log for new warnings" --json | jq -r .output.text
```

## Reaching a Runtime

A `wisp` command finds the Runtime through `$WISP_HOME/runtime.lock`, which the running
Runtime writes. You can name one explicitly instead, either with flags or with environment
variables:

```sh
wisp status --url http://127.0.0.1:3008 --token "$TOKEN"
WISP_URL=http://127.0.0.1:3008 WISP_TOKEN="$TOKEN" wisp status
```

The URL and the token go together. Plain `http` is accepted for loopback addresses only, so
a token is never sent over a network unencrypted. To reach a Runtime on another machine,
use an SSH tunnel to its loopback port.
