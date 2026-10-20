---
description: What a Session is, the Project folder it can work in, the Desk it gets without one, and what an adapter must send to find a Session again.
---

# Sessions, Projects and the Desk

A **Session** is one conversation: its messages, its Runs and its audit. Every Session works
in one folder, and that folder decides what the agent can see.

- **A Project** is a folder you choose, such as a repository or an
  [agent's folder](./deploy-an-agent.md). A Session with a Project reads its instructions
  and Skills, goes by its Rules, and uses only the connectors enabled there.
- **A Desk** is a folder the Runtime gives a Session that has no Project. It is the
  Session's own scratch space.

## Sessions with a Project

`wisp run` without a Session id starts a Session whose Project is the current folder.
Over `/v1`, send the folder as `projectRoot` when you open the Session:

```http
POST /v1/sessions

{ "projectRoot": "/srv/agents/incidents", "origin": "cli" }
```

The first time a folder is used, the Runtime writes `.wisp/project-id` in it. That id is
what ties the folder to its Rules, which are kept on this machine, not in the folder. The
list of connectors enabled there is kept in the folder, in `.wisp/mcp.json` (see
[Deploying an agent](./deploy-an-agent.md#what-the-folder-holds)).

The folder must exist and be a directory. A Desk, or the folder that holds the Desks, is
refused as a Project with `400`: what the agent wrote there must not become the next turn's
instructions.

## Desk Sessions

A Session opened without `projectRoot` is a **Desk Session**. Its folder is
`~/Wisp/<session id>`:

- The Runtime creates it only when the agent first reaches for a file or runs a command. A
  conversation that only talks leaves nothing on disk.
- It is readable only by you (mode `700`), and so is `~/Wisp` itself.
- The Session's `deskPath` field names it. It is `null` for a Session with a Project.

A Desk is not a Project, so a Desk Session differs in three ways:

- **Instructions and Skills** are your global ones only: `~/.wisp/AGENTS.md`, and the Skills
  in `~/.wisp/skills/`, in `skillPaths` and built in. Files on the Desk are never read as
  either.
- **Rules**: only global Rules and each tool's default apply. See
  [Permissions](./permissions.md#where-a-decision-comes-from).
- **Connectors**: every connected connector is available. A Project narrows this to the ones
  [enabled in it](./connectors.md#enabling-per-project).

Every Session a [Telegram bot](./telegram-bot.md) or a [Slack app](./slack-app.md) opens is a
Desk Session: a `run` token opens Sessions on the Desk only, and naming a `projectRoot` with
one is `403`. A [schedule](./reference.md#schedules) runs in a Project if it was created with
one, and on a fresh Desk otherwise.

## Giving a Desk Session a Project

A Desk Session can gain a Project once:

```http
PATCH /v1/sessions/{id}

{ "projectRoot": "/home/you/reports" }
```

- It is permanent. There is no way to detach the Project or move the Session to another
  one; a Session that already has a Project answers `409`.
- From that point on the Session works in the Project: its Rules, its instructions and only
  its enabled connectors. The transcript gets a line saying where this happened, so a later
  reader can see why a file was refused before it and read after it.
- Files the agent already wrote on the Desk stay there.
- The same body may carry `title`, to rename the Session; a `PATCH` without either is `400`.

## Finding a Session again

The Runtime keeps Sessions on disk and loads one into memory when a request needs it. A
Desk Session it can always find by its id. A Session with a Project it can load only when
told the Project's folder, because the folder is what holds `.wisp/project-id`. After a
restart, for example, it no longer has that folder in memory.

So the Session routes take the folder as a query parameter:

```http
POST /v1/sessions/{id}/runs?projectRoot=/srv/agents/incidents
```

- It applies to `GET /v1/sessions/{id}`, `PATCH /v1/sessions/{id}`,
  `GET /v1/sessions/{id}/history`, `POST /v1/sessions/{id}/runs`,
  `POST /v1/sessions/{id}/cancel` and `POST /v1/runs/{runId}/retry`.
- Without it, or with a folder that holds another Project, a Session with a Project that
  is not in memory is `404 Session not found`. Only `GET /v1/sessions/{id}` and
  `GET /v1/sessions/{id}/history` still answer, from the stored messages, the first with
  `projectRoot: null`.
- It is ignored when the Session is already in memory, and a Desk Session needs none.
- Do not confuse it with `projectRoot` in the body of a `PATCH`, which is the Project being
  given to the Session.

An adapter that opens Sessions with a Project should send the same folder on every request.
`wisp` does this for you with the folder it runs in. That is why `wisp run <id> "…"` on a
Session with a Project must run from that Project's folder: from another folder it can
answer `404` after a restart.

`GET /v1/sessions` lists every Session, loaded or not, but its rows carry no `projectRoot`:
the Runtime keeps no map from a Project's id back to its folder. `?projectRoot=` there filters
the list to that folder's Sessions, and `?origin=` to the Sessions one client opened.

## Files a Run wrote

A Run's `artifacts` are the files the agent sent with its `deliver_file` tool, as paths
relative to the Session's folder, with forward slashes: the Project folder, or the Desk. A
file it only wrote stays in the folder unlisted. `GET /v1/runs/{runId}/artifacts/{index}` answers
one file's bytes, read from the folder the Run worked in, so it needs no `projectRoot`. See
[the adapter contract](./adapter-contract.md#a-message-is-a-run).

## Deleting a Session

```sh
wisp sessions delete <id>
```

`DELETE /v1/sessions/{id}` removes the Session, its messages, its audit and the memories the
agent stored in it. It answers `409`
while a Run is going on in the Session: cancel it first with `wisp cancel <id>` or
`POST /v1/sessions/{id}/cancel`. It needs no `projectRoot`, and works even for a Session
whose Project folder is gone. It deletes no files, from a Project or a Desk.
