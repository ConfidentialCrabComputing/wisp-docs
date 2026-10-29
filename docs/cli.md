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
There is no time limit on the wait. Ctrl-C ends only the wait: the Run goes on in the
Runtime. `wisp cancel` stops it.

- **Without a Session id** it starts a new Session whose Project is the current folder.
- **stderr** gets `session <id>` first, before the wait, so you can cancel or continue that
  Session. **stdout** gets the answer only, so `wisp run "…" > answer.md` works. With
  `--json` the id is the outcome's `sessionId` instead.
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

`wisp models` lists the models the proxy offers, one per line:

```sh
wisp models
# <id>  <tiers>  <context window>  <capabilities>
```

The columns are the model's id, the tiers it belongs to, its context window in tokens, and
what it can do besides text, such as `images`. A `-` means the catalog says nothing. With
`--json`, `wisp models` prints the catalog as the proxy sent it.

`wisp run --model` picks the model for one Run:

```sh
wisp run --model advanced "…"       # the best model; the proxy picks which
wisp run --model balanced "…"       # a model of the balanced tier
wisp run --model <id> "…"           # this model
wisp run --model tier:<name> "…"    # any model of this tier; the proxy picks which
```

`--thinking` asks for the thinking form of `advanced`, `balanced` or a model id, where the
model can reason.

- **Without `--model`**, the Run uses the Session's own model (chosen with `/model` in a
  chat), else the Runtime Default, else `teeLlmModel` from the configuration. See
  [Configuration](./configuration.md#change-the-default-model).
- **A retry** with `wisp retry` uses the model its Run asked for.
- **Over `/v1`**, the same value goes in the Run's `modelPreference`
  ([the adapter contract](./adapter-contract.md#a-message-is-a-run)).

The Runtime sizes the conversation to the smallest context window among the models your
choice can reach, so a tier with a small model in it compacts earlier. If none of them lists
`images`, the agent cannot look at an image file and tells you so.

### Running a Skill

```sh
wisp skills list --project .                   # the Skills this folder's Sessions get
wisp run --skill open-case "$(cat alert.json)" # the text after the name is the Skill's arguments
wisp run 6b4f2a7e-… --skill summarise ""       # a Skill on an existing Session, no arguments
```

Where Skills live, how to write one and the other ways to run one are in
[Skills](./skills.md).

### Retrying safely

`--key <k>` gives the Run an idempotency key. If the same command runs again with the same
key, it gets the first Run's answer instead of running the prompt twice. This is what makes
a cron job or a retry loop safe. See [Runs and restarts](./runs-and-restarts.md#the-key).

### Structured answers

`--output-schema <file>` sends a JSON Schema (its root an object) that the answer must match.
On success `wisp run` prints only the value, as JSON, so the next command in a pipeline can
read it; `--json` still prints the whole outcome with the value in `output.structured`.

```sh
wisp run --output-schema verdict.json "is the build green?" | jq -r .status
```

A file that cannot be read or is not JSON is a usage error (exit `2`) and nothing is sent; a
schema the Runtime refuses prints its `400` and exits `1`. A Run whose agent never produces a
matching value fails `output_schema_unsatisfied` and exits `1`.

### Long Runs and approvals

```sh
wisp run --detach "rebuild the weekly report"   # prints the Run id and returns
wisp runs events <run>                          # follow it: the answer as it is written, each tool call
wisp runs show <run>                            # its status, and its answer once it ended
wisp runs list --status running,parked          # what runs now, and what waits on a person
wisp retry <run>                                # run a failed or cancelled Run's message again
```

`--interactive` lets a tool the Rules hold for a person wait for an answer instead of being
refused; it is refused only when the operator left `interactive` out of
`confirmationModes`. On a park `wisp run` prints each
Prompt and exits `3`; answer with `wisp confirm <run> <prompt> approve` (or `deny`,
`allow-project`, `allow-global`), which waits for the next park or the end, exactly like
`wisp run`. Add `--detach` to answer and return at once.

A Run has no step limit: the agent works until the task is done, it is cancelled, or the
model stops answering and the retries run out. `--max-turns <n>` stops it after `n` model calls, as `failed` with
`step_ceiling`; use it for unattended work you want bounded.

## Sessions

```sh
wisp sessions list                 # Sessions started from this folder by the CLI
wisp sessions list --all           # every Session, Wisp Desktop's included
wisp sessions list --origin telegram  # every Session one client opened, e.g. the Telegram bot's
wisp sessions show <id>            # a Session's messages
wisp sessions create --title "…"   # start an empty Session and print its id
wisp sessions delete <id>
```

`list` prints one line per Session: id, origin (`cli`, `desktop`, `telegram`, `slack` or `schedule`), last update,
number of messages and title.

Sessions are kept on disk. They survive restarts and cost nothing while idle. A Session
with a Project is found again through its folder, so continue it from that folder; see
[Sessions, Projects and the Desk](./sessions-and-projects.md).

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
succeeded, how long it took, and the Rule's decision. The audit also keeps what each tool
was given and what it returned, in the encrypted store: long strings cut short, and values
under names such as `token` or `password` masked. `--json` shows the arguments. A row like
the second one is a tool that was refused because no Rule
allowed it. See [Permissions](./permissions.md).

## Plan and balance

```sh
wisp billing status          # the plan's windows, the balance, auto-reload
wisp billing topup 10        # print a payment link for $10 and wait until it is paid
wisp billing auto-reload --threshold 5 --target 20
```

`wisp run` may be paid from the prepaid balance rather than the plan. When a Run fails
`quota_exhausted` because the balance is empty, `wisp run` prints the `topup` command to run.
See [Plan and balance](./billing.md).

## From scripts

- `--json` makes a command that lists or shows something print a single JSON document on
  stdout and nothing else there. For `wisp run` it is the full [Run outcome](./adapter-contract.md#a-message-is-a-run) plus
  `sessionId`.
- Exit codes are stable: `0` done, `1` failed, `2` bad command line, `3` parked on a
  Prompt (`--interactive`), `4` no Runtime reachable, `5` token refused. See
  [the full table](./runbook.md#exit-codes).

```sh
wisp run "check the build log for new warnings" --json | jq -r .output.text
```

A script that lets a person approve what the agent may not do alone branches on the exit
code:

```sh
wisp run --interactive --json "draft the release notes and post them to #releases" > out.json
case $? in
  0) jq -r .output.text out.json ;;
  3) jq -r '.runId as $r | .confirmations[] | "wisp confirm \($r) \(.id) approve   # \(.toolName)"' out.json ;;
  *) jq -r '.failure.reason // empty' out.json >&2; exit 1 ;;
esac
```

On `3` it prints the `wisp confirm` line for each Prompt; whoever runs it gets the Run's
next park or its end, with the same exit codes. The same flow over HTTP is in
[A first automation](./adapter-contract.md#a-first-automation).

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
use the `https://` address of a TLS proxy in front of it, or an SSH tunnel to its loopback
port (`ssh -N -L 3008:127.0.0.1:3008 you@server`, then `--url http://127.0.0.1:3008`); see
[Remote access](./remote-access.md#reaching-it-from-another-machine). A token for a script
is a named one, `wisp tokens create --name <n> --capability full`, made on the Runtime's
machine.
