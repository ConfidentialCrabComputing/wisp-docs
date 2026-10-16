---
description: How the sandbox keeps the agent's shell commands inside their folder, and how to turn it and its network on or off.
---

# Sandbox

Every command the agent runs with [`bash_run`](./tools.md) runs in a sandbox: an OS-level
cage that keeps it inside the folder it runs in. The sandbox is on by default, and so is its
network. It covers `bash_run` only; the file tools have their own checks, and connectors run
outside it.

## What a command can do

- **Write only in its own folder.** That is the folder the command runs in: the Project, or
  the subfolder the agent named. Nothing else on the machine can be changed.
- **Read its folder and the system's.** System folders such as `/usr` and `/etc` are
  readable, so ordinary tools and libraries work. Your home folder is not readable, nor is
  Wisp's data directory (`~/.wisp`) or its key file.
- **Not name a path outside the Project.** Before a command runs, it is refused if it names
  an absolute path outside the Project, `/usr/bin/python3` among them (call `python3`), or
  contains `../`, `~/` or `.wisp`. Only `/tmp`, `/proc` and `/dev/null` (and `/dev/stdin`,
  `/dev/stdout`, `/dev/stderr`) are let through.
- **Not see your environment.** A command gets your login shell's `PATH`, `LANG` and `TERM`;
  its `HOME` is the folder it runs in, and its `TMPDIR` is `.tmp` there. Tokens and keys in
  the Runtime's environment never reach it.
- **Reach the network**, unless you [turn the network off](#turn-it-on-or-off).

On Linux the command also gets its own process, IPC and hostname namespaces, a fresh empty
`/tmp` that disappears when it ends, and a filtered set of system calls. It is killed if the
Runtime dies. On macOS `/tmp` is the machine's own.

## What it needs

| OS | Sandbox | If it is missing |
| --- | --- | --- |
| Linux | bubblewrap (`sudo apt install bubblewrap`) | `bash_run` refuses every command and names the package to install |
| macOS | the built-in `sandbox-exec` | `bash_run` refuses every command |
| Windows | none yet | commands run directly on the host, through `cmd.exe`, with your environment less Wisp's own token |

Wisp never falls back to running a command without the sandbox on its own: where the
sandbox should exist and does not, the command is refused. On Windows, allowing `bash_run`
allows anything your user can do.

## Turn it on or off

```sh
wisp sandbox                 # sandbox on, network on
wisp sandbox off             # run commands without the sandbox
wisp sandbox on
wisp sandbox network off     # keep the sandbox, take its network away
wisp sandbox network on
```

The same switches are `GET` and `PUT /v1/sandbox`, with `enabled` and `allowNetwork`. In
[Wisp Desktop](./desktop/app.md) the **Sandboxed / Unrestricted** button by the message box
turns the sandbox on or off, and Settings has **Allow network in the sandbox**.

- **The switches cover the whole Runtime**, every Project and Session, not one Project.
- **A change applies to the next command**, with no restart.
- **The agent cannot change them.** They are kept where no tool can write, so the agent
  cannot loosen its own cage.

Know what each switch costs:

- **Sandbox off:** a command runs as the Runtime's own user, with no OS isolation. It can
  read your home folder and the key source. Only the path check and the stripped
  environment above remain. `wisp sandbox off` warns you of this.
- **Network off:** a command cannot reach the internet, which also breaks package managers
  (`npm`, `pip`) and `git`. The switch does nothing while the sandbox is off: commands then
  have the machine's full network.

Keep the sandbox on. If a command needs something outside its folder, give it that file in
the Project rather than turning the sandbox off. See [Security](./security.md).
