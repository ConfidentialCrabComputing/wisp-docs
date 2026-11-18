---
sidebar_label: How it works
description: A private agent beside Hermes — Hermes keeps orchestrating, Wisp holds the private accounts and folders, and Hermes gets conclusions back but cannot reach the data itself.
---

# Wisp inside Hermes

[Hermes Agent](https://github.com/NousResearch/hermes-agent) runs your automations: skills, cron
jobs, chats in Telegram and Slack. Its model is a cloud model, and everything Hermes reads goes to
it. Wisp inside Hermes puts a second, private agent beside it:

- **Wisp holds what is private**: your sensitive accounts as [Connectors](./connectors.md) (Gmail,
  Notion, your Telegram account, a broker's MCP server) and your sensitive folders as
  [Private Folders](#private-folders). You name them once, in Wisp.
- **Hermes keeps orchestrating.** When a task needs one of those, Hermes hands it to Wisp with its
  `ask_wisp` tool, or you hand it over yourself with `/wisp <task>`.
- **Wisp answers with conclusions, not raw data.** "You spent 412 € on restaurants in October", not
  the statement's lines.
- **Hermes cannot reach the data itself**, even when its model tries: it holds no key to those
  accounts, and on the same machine an OS sandbox keeps every Hermes process out of Wisp's files.

Setting it up is one command on one machine, or a plugin and a credential on two:
[Set up Wisp inside Hermes](./hermes-setup.md).

## How a task goes

```text
you ── "how much did I spend on restaurants?" ──▶ Hermes
                                                   │  ask_wisp(task)
                                                   ▼
                              Wisp's Runtime, /mcp (Host Agent Credential)
                                                   │  a Run in a Desk Session,
                                                   │  with your Gmail, your folders
                                                   ▼
you ◀── Hermes relays it ◀── "412 € in October, mostly …" (a conclusion)
```

1. Wisp's plugin in Hermes adds a rule to Hermes's system prompt that names Wisp's services (its
   Connectors) and the Private Folders as tasks for Wisp. Hermes's model then calls `ask_wisp` on
   its own, in a chat, the CLI or a cron job.
2. `ask_wisp` reaches the Runtime's `/mcp` endpoint, with a **Host Agent Credential** that opens
   that endpoint and nothing else: none of Wisp's other API, so not your Sessions, transcripts or
   settings.
3. Wisp runs the task as a **Delegated Run**, with its own tools and Connectors, under your
   [Rules](./permissions.md). When a tool needs your yes, the question appears in Hermes
   ([Confirmations](#confirmations)).
4. Wisp answers with a conclusion, and a `conversation` id: Hermes passes it back on a follow-up
   ("and last month?"), which continues the same Wisp Session.

When Hermes reaches for something private anyway, such as reading a Private Folder with its file
tools or terminal, or calling an MCP server Wisp took over, the plugin refuses the call with
`This goes through Wisp — use ask_wisp.`, and the model switches. That refusal is a guide for the
model; the [sandbox](#the-sandbox-around-hermes) is what actually keeps Hermes out.

## What Hermes gets

| In Hermes | What it does |
| --- | --- |
| `ask_wisp(task, conversation?)` | hands a task to Wisp and waits for its answer; `conversation` continues an earlier one |
| `wisp_result(run?)` | collects the answer of a task that outlived one call; without `run`, lists the answers no call has taken yet |
| `/wisp <task>` | hands a task to Wisp yourself, with Hermes's model out of the loop. In the CLI, Telegram, Slack and every other Hermes surface |
| `/wisp-model` (`/wisp_model` in Telegram) | shows or sets the model Wisp uses for Hermes's tasks |
| `hermes wisp connect <url>` | connects the plugin to a Runtime; `--remove` undoes it. `wisp integrate hermes` runs it for you |
| the routing rule | tells Hermes's model which tasks go to Wisp, from Wisp's own list |
| the hook | refuses Hermes's own calls that reach into Wisp's zone or to an MCP server Wisp took over |
| the sandbox | on the same machine, keeps every Hermes process out of Wisp's zone |

## Private Folders

A Private Folder is a folder no Host Agent, such as Hermes, may open. **It changes nothing for
Wisp**: a Project, a [Knowledge Folder](./knowledge-folders.md) or any other folder is reached as
before.

```sh
wisp private add ~/Documents/Finance    # a relative path is taken from the current folder
wisp private list
wisp private remove ~/Documents/Finance
```

Always private, without being listed: **Wisp's data directory** (`~/.wisp`, with your Sessions and
Connector keys), **the Desk root** (`~/Wisp`, where Wisp writes its reports), and the files outside
them that hold Wisp's secrets (the key file of a Linux server, a `--config` file). Hermes gets Wisp's
results through `ask_wisp`, not as files.

- **A change applies at Hermes's next start.** The sandbox is built when a Hermes process starts and
  cannot be tightened while it runs. `wisp private add` reminds you, and `wisp private list` marks
  each folder a running Hermes profile has not picked up yet with `restart Hermes to apply`.
- **A moved folder stays closed.** Wisp keeps each folder's identity beside its path. Renamed,
  moved or replaced, it is marked `moved`: its old path stays denied, and you add the new one.
  Under a parent folder Wisp cannot read, it is marked `unreadable`.
- **Not the folders Hermes runs from.** Hermes's own install, its venvs and its Python stay open to
  it, or it could not start. `wisp private add` says so when you name one of those.
- The same list is `GET`/`POST`/`DELETE` `/v1/private-folders` (see the
  [reference](./reference.md)). Hermes reads it through its endpoint, and never changes it.

## Moving Hermes's MCP servers into Wisp

If Hermes already reaches a private account through one of its own MCP servers, Hermes holds that
account's keys. `wisp integrate hermes` offers to move such servers into Wisp, during setup or
later with `wisp integrate hermes --connectors`. You pick them by name, and before anything changes
it says what happens to each:

- **A server Wisp has its own Connector for** (Notion, Linear, Gmail…) is not copied. You sign in
  to Wisp's Connector right there.
- **Telegram** is not copied either: connect [Wisp's own Telegram Connector](./connectors.md#telegram);
  no session file is carried over.
- **Anything else** is copied as a custom Connector: its command or URL, and its environment and
  headers, with `${VAR}` values taken from Hermes's `.env` into Wisp's encrypted store.

A server is switched off in Hermes only once its Wisp counterpart is connected. Wisp then lists the
keys to delete from Hermes's `.env` (and any sign-in Hermes kept for it); it never edits that file
itself. The hook refuses calls to a switched-off server and attempts to switch it back on.
`wisp integrate hermes --remove` switches them back on, and keeps their Wisp Connectors.

## Using it

- **Let Hermes decide.** Ask as you always do. A task that needs a Wisp Connector or a Private
  Folder goes to Wisp; the rest stays with Hermes.
- **Decide yourself** with `/wisp <task>`, the way you would say "use local for this". The answer is
  shown to you; it does not enter Hermes's own conversation, so Hermes's model never sees it.
- **Long tasks** keep running: a call waits up to 30 minutes, and a task still going after that
  answers `running`, with Hermes collecting its answer through `wisp_result`. A dropped connection
  does not stop the task either.
- **Cancel** with Hermes's `/stop`: it cancels the Wisp task it was waiting on. A new message sent
  mid-task redirects Hermes's turn, and the Wisp task finishes.
- **Cron jobs** in Hermes delegate as chats do. Nobody is there to answer a
  [Confirmation](#confirmations), so allow beforehand the Wisp tools a job needs:
  `wisp permissions set <tool> allow`.
- **Wisp asks no questions back.** When it lacks something, it ends its answer with the question
  ("which month?"), and Hermes continues the conversation.

## Confirmations

When a Wisp tool needs your yes ([Rules](./permissions.md)), the question appears where you already
talk to Hermes:

- **For `ask_wisp`**, in Hermes's own approval panel: the CLI's prompt, or Telegram's "Allow Once" /
  "Deny" buttons. It names the action and the target as Wisp recorded it, not as Hermes's model
  described it. Hermes denies what nobody answers within its 5 minutes (`approvals.timeout`).
- **For `/wisp`**, in the chat itself, denied when nobody answers within Hermes's clarify timeout,
  90 seconds by default (`agent.clarify_timeout`). The task goes on without that tool.
- **One "Allow once" covers that tool for the rest of the task**, except a command or a file write
  (`bash_run`, `fs_write`, `fs_edit`), which asks at each call, and except what your Rules mark
  "Always ask".
- **With [Auto Mode](./permissions.md#auto-mode) on**, Wisp's Judge answers first, and Hermes shows you only
  what it escalates.
- **In a group chat**, anyone allowed to use your Hermes there can answer, not only whoever asked:
  Hermes checks who may use the chat, not who asked.

A Confirmation in Hermes is only as trustworthy as Hermes: see [Known limits](#known-limits).

## Choosing the model

`/wisp-model` in the Hermes CLI, `/wisp_model` in Telegram:

```text
/wisp_model                    the model Wisp uses for Hermes, and the choices
/wisp_model advanced           a tier: advanced or balanced
/wisp_model <model id>         a model from the catalog it lists
/wisp_model thinking on        or off
/wisp_model reset              back to the Runtime's default
```

The choice applies from Wisp's next task on, a conversation already going included, until you change
it. Without one, Hermes's tasks use the [Runtime Default](./configuration.md#change-the-default-model). It is Hermes's own:
the Runtime keeps it apart from yours (`GET`/`PUT /v1/settings/host-agent-model`).

## What Wisp keeps for you

- Every task Hermes hands over is a Session in Wisp, on the Desk, and every tool call in it is in
  Wisp's audit, so you can see what Hermes asked and what Wisp touched.
- A Delegated Run is told to answer with conclusions and not to quote raw records (messages,
  statement lines, account numbers, lab values) unless the task cannot be answered without one, and
  to refuse to return a Private Folder's file or a message history verbatim. This narrows what Wisp
  says; it is not a mechanical check.
- Delegated Runs are API usage, paid from your [prepaid balance](./billing.md). When it is empty,
  Hermes is told so, with where to top up.

## The credential

Hermes signs in with a **Host Agent Credential**, a kind of [named token](./remote-access.md#a-token-per-device):

```sh
wisp tokens list
# hermes  host_agent  -  2026-11-17T09:12:44.120Z  local
```

It opens the Runtime's `/mcp` endpoint and nothing else: every other route answers `403`. On one
machine, `wisp integrate hermes` makes it (`local`, the one this machine's Hermes holds) and keeps
it in each Hermes profile's `.env`. On two machines you make it with
`wisp tokens create --name hermes --host-agent`. `wisp tokens revoke hermes` cuts Hermes off.

:::note[The one token changes]
On a machine where `wisp integrate hermes` has run, the Runtime replaces its own `agentToken` each
time a sandboxed Hermes process starts, so a copy Hermes's model saw before its sandbox is useless.
The `wisp` CLI is not affected. A script or a device that copied that token gets `401`: give it a
[named token](./remote-access.md#a-token-per-device) instead.
:::

## The sandbox around Hermes

When Wisp runs on the same machine, the plugin sandboxes the Hermes process it loads into. So every
way Hermes starts is covered (the CLI, each profile's gateway service, cron inside the gateway, the
dashboard), and everything Hermes starts inherits it: its terminal, its scripts, its MCP servers, its
browser.

The sandbox denies only **Wisp's zone**: the Private Folders, Wisp's data directory, the Desk root,
Wisp's secret files, and writes to the plugin's own folder. Everything else works as before:
Python and pip, the network, writing files, skills, cron, Hermes's browser.

- **macOS**: Seatbelt (`sandbox_init`), applied to Hermes's own process.
- **Linux**: Hermes restarts itself inside [bubblewrap](https://github.com/containers/bubblewrap), with
  each zone folder replaced by an empty one. A small supervisor stays in its place, so systemd and
  Hermes's own `gateway stop/restart/status` work as before. Inside it, `sudo` and other setuid
  programs do not work.
- **Windows**: none. Hermes on Windows connects to a Wisp on another machine.

When the sandbox could not start (on Linux, usually bubblewrap missing or blocked by AppArmor),
Hermes keeps running without it and says so at start: `Wisp's zone is unprotected: <reason>`.
`wisp doctor` checks each profile: the plugin present and enabled, `mcp_servers.wisp` pointing at
this Runtime, the credential not revoked.

Under the sandbox Hermes's browser runs without Chrome's own sandbox, which cannot start inside
Wisp's.

## Known limits

Wisp says these when you set it up, and they hold:

- **Whoever holds the credential is Hermes.** A prompt-injected Hermes can approve Wisp's
  Confirmations itself. It cannot read the data, but it can make Wisp move it out.
- **Anyone Hermes lets in uses Wisp as you**: its allowlist, its groups.
- **Hermes's model can read the credential** from its terminal's environment, and call the endpoint
  outside Hermes.
- On one machine, **Hermes's model can switch the plugin off and restart Hermes.** That is not
  detected while Hermes runs; `wisp doctor` shows it.
- On one machine, **the sandbox stops Hermes reading Wisp's zone itself, not a model set on escaping
  it**: anything Hermes has an unsandboxed process run (an app it opens or scripts on macOS, a shell
  startup file or a tool on `PATH` it rewrites) runs outside the sandbox. Wisp on another machine is
  the boundary that holds against that.
- On macOS, **Hermes's computer use can still open Private Folders**: it drives apps the sandbox
  does not cover.
- On one machine, **a server moved into Wisp stays out of Hermes only while its keys are gone from
  Hermes**: delete them from its `.env` as `integrate` lists them.
- On Linux, **a Hermes running as root** has Private Folders hidden from ordinary reads only. Run
  Hermes as a regular user.
- **A sandbox start that fails leaves Hermes running without it**, saying so on start. A process
  left from an earlier Hermes, or an `LD_PRELOAD` in its `.env`, can use this at the next start.
- On one machine, **Hermes cannot sign Wisp in** once it is wired in: a lost sign-in takes a terminal
  on Wisp's machine (`wisp login`).
- **While the Runtime is stopped or restarting** (every `wisp update` restarts it), Hermes says Wisp is
  not answering, and gets it back within seconds once it answers again.

The plugin's [README](https://github.com/ConfidentialCrabComputing/wisp-hermes-plugin#known-limits)
gives each limit in full.
