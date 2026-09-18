---
sidebar_position: 8
description: The boundary is the operating-system user — what the token defends, and what it never did.
---

# Security

## The boundary is the operating-system user

A process running as the same user as the Runtime is **trusted**. That is the same boundary
Chrome, Docker Desktop and every password manager draw, and it is the one to design around:
if something hostile is already running as you, it is not the Runtime's token that stands
between it and your data.

What the token, the loopback `Host` allowlist and the CORS allowlist defend against is
everything that is *not* that user:

- a page in a browser doing `fetch("http://127.0.0.1:3000/v1/…")`;
- another account on the same machine;
- anything on the network — the listener never leaves loopback in phase 1.

Raising the bar above the user — verifying a caller's code signature, protecting the Project
folder or the binary itself — is a different product and is not attempted here.

## The lock file

`$WISP_HOME/runtime.lock` holds the Runtime's address and its token under mode `0600`, and
that is how the CLI and an adapter find it without being configured twice. It moves nothing
across the boundary: the token reaches the process in its environment, and a same-user
process can read another's environment on every platform we ship to. The file puts the token
where something that could already read it can now also find it.

On Windows there is no `0600`; the file sits under `%USERPROFILE%`, whose ACL already admits
the user alone. Same boundary.

## What changes when nobody is watching

On a desktop, an `ask` is a card someone reads. On a server there is no one, so phase 1 runs
under one Confirmation Mode: **`policy`** — every `ask` resolves to a deny, the tool returns
a refusal, the agent is told and continues.

The consequence worth stating: **the default outcome of an injected "send this" is a
denial**, not a card nobody sees. Web content, connector results and your own data all reach
the model, and none of them can talk it into a side effect that no Rule already allowed.
Nothing runs that a Rule did not explicitly allow, and no caller can approve anything for the
duration of a Run.

That puts the whole weight on Rules. `wisp permissions allow-connector <name> --project .`
writes one per-tool row for everything a Connector exposes; `wisp permissions get --project .`
shows what actually resolves, and which step decided it.

## `bash_run`

It baselines to `ask`, so under `policy` it is denied until a Rule allows it, per Project.
Two things to know before writing that Rule:

- It needs an OS sandbox and fails closed without one — bubblewrap on Linux
  (`apt install bubblewrap`), and on Windows there is no backend yet, so every call there
  returns that error.
- The sandbox confines the filesystem, not the network. An allowed `bash_run` has the host's
  full network, so that Rule is the decision to allow egress, and it stays deny by default
  for exactly that reason.

## What reaches the model

Every connector result passes through one place that strips control, zero-width and
bidirectional characters and the reserved framing tags, so a tool's output cannot impersonate
the transcript's structure. What that pass cannot decide is who *wrote* a line — see
[provenance](./adapter-contract.md#provenance) in the adapter contract, and mark authorship
in the MCP servers you own.

Confirmation payloads carry ids and kernel-named fields, never text a model chose.

## Secrets

- At rest: SQLCipher, with the key in the OS keyring. Connector secrets live in the encrypted
  store, never in a Project folder.
- In transit to the Runtime: `wisp connectors add … --header-stdin Authorization` reads the
  secret from the terminal, because a command line is readable by another local account —
  which is outside the boundary, which is the point.
- `runtime.json` holds the agent token. A file owned by another user is refused outright
  (exit 78); a file of your own that is readable by others earns a warning to `chmod 600` it.

## What a token can do

What the desktop's chat can already do: run turns, write Rules, manage Connectors, read the
audit. It deliberately cannot stop the Runtime — there is no stop endpoint on `/v1`, and
`wisp stop` is a signal to a pid from the lock file, not a request. Treat a leaked token as a
compromised account: rotate it in `runtime.json` and restart.

Named Service Tokens with narrower capabilities, a listener off loopback, `allowedHosts` and
TLS at a reverse proxy arrive together in phase 2. Until then, if something off-host has to
reach a Runtime, tunnel to its loopback rather than binding it wider.
