---
description: When to turn on the sandbox for the agent's shell commands, what it protects, what stops working inside it, and how to switch it and its network.
---

# Sandbox

With the sandbox on, every command the agent runs with [`bash_run`](./tools.md) runs in an
OS-level cage that keeps it inside the folder it runs in. **The sandbox is off by default**:
it is a trade, more safety for fewer things a command can do, and you choose it. Its network
is on by default. The cage covers `bash_run` only, and connectors run outside it. The switch
also sets how far the [file tools](./tools.md#files) reach: with it on they stop at the
Project too. With the sandbox off, `bash_run` still asks before every command unless a Rule
allows it.

## When to turn it on

Turn it on when commands can run without you reading each one first:

- **You allow `bash_run` by a Rule**, or with bypass, so commands run with no card.
- **Runs and schedules** that work unattended with such a Rule.
- **Chat bots** ([Telegram](./telegram-bot.md), [Slack](./slack-app.md)) where other people
  write to the agent.
- **Input you did not write**: web pages, emails, documents, someone else's repository. A
  hidden instruction in them can steer the agent into running a command.
- **A shared server**, or a machine that holds other people's data.

Leaving it off is fine when you sit at the machine and read every command's card before you
approve it. Then you are the fence.

## What a command can do

- **Write only in its own folder.** That is the folder the command runs in: the Project, or
  the subfolder the agent named, and `/tmp`. Nothing else on the machine can be changed.
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
- **Reach the network**, unless you [turn the network off](#turn-it-on-or-off). With it on,
  that includes services on the machine itself (`localhost`).

On Linux the command also gets its own process, IPC and hostname namespaces, a fresh empty
`/tmp` that disappears when it ends, and a filtered set of system calls. It is killed if the
Runtime dies. On macOS `/tmp` is the machine's own.

## What stops working

Most work inside a Project still runs: reading and editing its files, `git status`, `diff`
and `commit`, builds, tests, and `python3` or `node` scripts. What does not:

| What | Why | What to do |
| --- | --- | --- |
| `sudo`, `apt`, `brew install`, `npm install -g`, `pip install` into the system Python | system folders are read-only | install tools yourself, outside Wisp, before you turn the sandbox on |
| tools installed in your home folder: nvm, pyenv, conda, rustup, `~/.local/bin` | your home folder is not readable, so they fail even though `PATH` names them | install the tool system-wide or with Homebrew |
| on Linux, tools under `/opt`, `/snap` or Linuxbrew | only `/usr`, `/bin`, `/sbin`, `/lib` and `/etc` are there | install the tool through the system's packages |
| `git push` or `pull` over SSH, or with saved credentials | `~/.ssh`, the SSH agent, `~/.gitconfig` and the Keychain are out of reach | push yourself; set `git config user.name` and `user.email` in the repository, where a commit can see them |
| a file outside the Project | the path is refused before the command runs | copy the file into the Project |
| downloads, `npm install`, `pip install`, `git fetch` with the network off | no network at all, not even `localhost` | `wisp sandbox network on` |

Project-local installs work while the network is on: `npm install` puts `node_modules` in
the folder, and `python3 -m venv .venv` then `.venv/bin/pip install ...` gives Python
packages of its own.

If a task needs the whole machine, installing system tools or pushing with your keys, the
sandbox is the wrong place for it: do that step yourself, or turn the sandbox off for it and
read each card.

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
wisp sandbox                 # sandbox off, network on
wisp sandbox off             # run commands without the sandbox
wisp sandbox on
wisp sandbox network off     # keep the sandbox, take its network away
wisp sandbox network on
```

The same switches are `GET` and `PUT /v1/sandbox`, with `enabled` and `allowNetwork`. In
[Wisp Desktop](./desktop/app.md) they are the two toggles in Settings → Sandbox:
**Sandbox terminal commands** and **Allow network in the sandbox**.

- **The switches cover the whole Runtime**, every Project and Session, not one Project.
- **A change applies to the next command**, with no restart.
- **The agent cannot change them.** They are kept where no tool can write, so the agent
  cannot loosen its own cage.

Know what each switch costs:

- **Sandbox off:** a command runs as the Runtime's own user, with no OS isolation, and may
  name any path. It can read your home folder and the key source. Only the stripped
  environment above remains, and a check that refuses a command naming `.wisp` or Wisp's
  data directory, which a determined command can get past. The file tools may then reach
  outside the Project, each such call on a card. `wisp sandbox off` warns you of this.
- **Network off:** a command cannot reach the internet or the machine's own services,
  which also breaks package managers (`npm`, `pip`) and `git`. The switch does nothing
  while the sandbox is off: commands then have the machine's full network.

See [Security](./security.md).
