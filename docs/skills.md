---
description: Skills are named procedures the agent can run. Where they live, how to write a SKILL.md, and every way to start one.
---

# Skills

A Skill is a named procedure written in Markdown: a folder with a `SKILL.md` file in it. The
agent sees the name and description of every Skill it has. It runs one when the task fits,
or when you start it by name.

## Where Skills live

The Runtime looks for a Skill in four places. When two places hold a Skill with the same
name, the first one in this list wins:

| Place | Path | Who sees it |
| --- | --- | --- |
| Project | `<project>/.settings/skills/<name>/SKILL.md` | Sessions in that Project |
| Home | `$WISP_HOME/skills/<name>/SKILL.md` (`~/.wisp/skills/` by default) | every Session |
| Extra folders | `<folder>/<name>/SKILL.md`, for each folder in `skillPaths` | every Session |
| Built in | inside the Runtime | every Session |

- **Project Skills need a Project.** A Session without one, such as a Session from the
  Telegram bot, the Slack app or a run token, sees only the home, extra and built-in Skills.
- **`skillPaths`** (`SKILL_PATHS`) lists extra folders, separated like `PATH`. Among them,
  the first folder wins. See the [configuration](./reference.md#configuration).
- **The folder name is the Skill's name.** The `name` in the front matter must be exactly
  the folder's name. If it is not, the Runtime skips the Skill without an error.
- **Skills are read from disk each time.** A new or edited `SKILL.md` counts from the next
  message. There is nothing to reload.

To see what a Session would get:

```sh
wisp skills list                 # home, extra folders and built-in Skills
wisp skills list --project .     # the same, plus this folder's Project Skills
```

Each line is a Skill's name and description. `GET /v1/skills` returns the same list.

Two Skills are built in:

- **`create-skill`** teaches the agent to write a Skill; see
  [below](#letting-the-agent-write-skills).
- **`wisp-self-help`** answers questions about Wisp from these docs rather than from
  memory, and, when something fails, reads the Runtime's recent errors first. It fetches
  pages with `mcp__wisp_proxy__fetch_url`, which asks by default; see
  [Web search and fetch](./tools.md#web-search-and-fetch).

## Writing a SKILL.md

```markdown
---
name: open-case
description: Opens an incident case from an alert. Use when the message is an alert payload.
whenToUse: The input is JSON from the monitoring system.
arguments: severity, service
argumentHint: <severity> <service>
---

# Open a case

Severity is ${severity}, the service is ${service}.

1. Read the runbook for ${service}.
2. Open a case with the full alert: ${argument}
```

The front matter is flat `key: value` lines between two `---` lines. It is not full YAML:
each key takes one line, quotes around a value are removed, and a list is a
comma-separated line (`arguments: severity, service`), not a YAML array. Everything after the
front matter is the body.

| Key | Required | Meaning |
| --- | --- | --- |
| `name` | yes | the Skill's name; must match its folder |
| `description` | yes | what the Skill does and when to use it. This is what the agent reads to decide |
| `whenToUse` | no | an extra hint, shown to the agent next to the description |
| `arguments` | no | names for the words after the Skill's name, in order |
| `argumentHint` | no | a short usage hint, such as `<severity> <service>` |
| `context` | no | `inline` (the default) or `fork`, see [below](#inline-and-fork) |
| `allowedTools` | no | the tools a `fork` Skill may use, comma-separated |
| `paths` | no | file patterns. The Runtime reads them but does not act on them yet |

A Skill without a `name` or a `description`, or with a `context` other than `inline` or
`fork`, is skipped. Unknown keys are ignored.

The agent sees each description and `whenToUse` cut to 250 characters. Put the trigger
early.

### Arguments

The text after the Skill's name is its arguments. The Runtime fills these placeholders in
the body:

| Placeholder | Becomes |
| --- | --- |
| `${argument}` | the whole argument text |
| `${<name>}` | a word given by position, for each name in `arguments` |
| `${<key>}` | the value of a `key=value` word in the arguments |
| `${WISP_SKILL_DIR}` | the Skill's folder, to point at files kept next to `SKILL.md` |
| `${WISP_SESSION_ID}` | the Session's id |

Arguments are split on whitespace, so a positional argument is one word. A placeholder with
no value is left as written.

### Inline and fork

- **`inline`**: the body is added to the conversation, and the agent follows it in the same
  Session, with the same tools.
- **`fork`**: a separate agent runs the body as its instructions and returns its conclusion.
  It does not see the conversation. `allowedTools` limits the tools it gets; it never gets
  `skill_invoke` or `spawn_agent`. Rules still apply to every call it makes, and a tool that
  needs approval asks for it as in the main Session. It is limited to 200 steps and 5
  minutes by default.

`allowedTools` has no effect on an `inline` Skill.

## Running a Skill

Every way to run a Skill sends the same line: `/<name> <arguments>`. The Runtime finds the
Skill, fills in the arguments and gives the body to the agent. The name may use letters,
digits, `-` and `_`.

- **From the CLI:**

  ```sh
  wisp run --skill open-case "high payments"               # a new Session on this folder
  wisp run 6b4f2a7e-… --skill summarise ""                # an existing Session, no arguments
  ```

- **In a message:** a message whose text starts with `/<name>` runs that Skill. Text marked
  as a [third party's](./adapter-contract.md#who-wrote-what) never does.
- **Over `/v1`:** send `skill` and an optional `arguments` instead of `input` in the
  [Run body](./adapter-contract.md#a-message-is-a-run).
- **On a schedule:** `wisp schedules create --skill <name>` runs the Skill on each fire, with
  the job's input as its arguments. See [Schedules](./schedules.md).
- **By the agent:** the agent starts a Skill on its own with the `skill_invoke` tool when the
  task fits its description. `skill_invoke` defaults to `allow`. See [Tools](./tools.md).

If no Skill has that name, or the Skill is a `fork` one, the line is not expanded: the agent
gets `/<name> <arguments>` as an ordinary message. The agent can still start a `fork` Skill
from it with `skill_invoke`.

## Letting the agent write Skills

The built-in Skill `create-skill` teaches the agent how to write a Skill. Ask for one in
plain words ("make a Skill that…"), or run it:

```sh
wisp run --skill create-skill "a Skill that drafts the weekly status email"
```

The agent writes Skills with its `skill_fs_*` tools: to `~/.wisp/skills/` (every Session),
or to the Project's `.settings/skills/` when the Session has a Project.

:::warning
`skill_fs_write`, `skill_fs_read` and `skill_fs_list` default to `allow`. The agent can
create or change a Skill without asking, and that Skill is offered in later Sessions. Only
`skill_fs_delete` defaults to `ask`. To review every change, set a Rule:

```sh
wisp permissions set skill_fs_write ask
```

See [Permissions](./permissions.md).
:::

Built-in Skills cannot be changed with these tools. A Skill of the same name in a Project,
home or extra folder takes precedence over a built-in one.
