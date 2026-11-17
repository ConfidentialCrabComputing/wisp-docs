---
sidebar_label: Set it up
description: Install Wisp beside Hermes and wire the two together — on one machine, on two machines (Tailscale, Caddy or an SSH tunnel), or by asking Hermes from a chat.
---

# Set up Wisp inside Hermes

This page takes you from a working [Hermes Agent](https://github.com/NousResearch/hermes-agent)
to Hermes handing its private tasks to Wisp. What the integration does, and what it protects, is
on [Wisp inside Hermes](./hermes.md).

## Pick your setup

| Your situation | Setup | You need |
| --- | --- | --- |
| Hermes runs on your Mac or your Linux machine, and you have a terminal there | [One machine](#one-machine) | about 5 minutes |
| Hermes runs on a VPS, and your private files and accounts should stay on another machine (a Mac mini at home, a second server) | [Two machines](#two-machines) | a way to reach that machine over https or SSH |
| You talk to Hermes only from Telegram or Slack, and have no terminal on its machine | [From a chat](#from-a-chat) | the chat |

**Which one is safer?** On one machine, Wisp keeps Hermes out of its files with an OS sandbox
around every Hermes process. That stops Hermes reading them itself, but not a model that sets out
to escape the sandbox: it can have an app or a script that runs outside it do the reading (see
[Known limits](./hermes.md#known-limits)). On two machines, the files and the keys are simply not on
Hermes's machine. That is the boundary that holds, and the one to choose when the data matters
most.

## Before you start

- **Hermes Agent v0.21.6 or later.** Check with `hermes --version`, and update with
  `hermes update`.
- **macOS or Linux** for Wisp. Hermes on Windows works only as the Hermes side of
  [two machines](#two-machines).
- **A Wisp account with a prepaid balance.** The tasks Hermes hands to Wisp are paid from it, as any
  CLI use is: see [Billing](./billing.md). `wisp integrate hermes` warns when it is empty.
- On Linux, **run Hermes as a regular user**, not root. Wisp's sandbox cannot keep root out.

## One machine

Wisp and Hermes run side by side, as the same user. `wisp integrate hermes` sets up every Hermes
profile in one go.

### 1. Install Wisp

```sh
curl -fsSL https://usewisp.io/runtime/install.sh | sh
```

The installer asks two questions. Answer **yes** to both:

- `Start the Runtime in the background now and at every login? [Y/n]` — Hermes needs Wisp
  running whenever Hermes does.
- `Log in now? [Y/n]` — opens the browser to sign in. On a server without a browser it prints a
  link instead: open it on any device, sign in, and paste back the address the browser lands on
  (see [Sign in](./quickstart.md#2-sign-in)).

Then **open a new terminal**, or run the `source …` line the installer prints at its end. Until
then the shell does not find `wisp`.

Check that it is up:

```sh
wisp status
# ready (wisp 0.1.17, serve)
```

[Install, update, uninstall](./install.md) covers the installer's options and the service.

### 2. Wire Wisp into Hermes

```sh
wisp integrate hermes
```

For each Hermes profile, it lays out Wisp's plugin, enables it, and connects it to this Runtime
with one credential named `hermes`. Every change to Hermes's config goes through Hermes's own CLI;
your skills, plugins, cron jobs and settings stay as they are.

```text
default: laid the Wisp plugin out in /Users/you/.hermes/plugins/wisp
default: hermes wisp connect http://127.0.0.1:3008/mcp
default: Hermes's MCP servers: gmail, deepwiki
default: move which into Wisp? Their names, separated by spaces; Enter for none
```

**The question about MCP servers** is optional. If Hermes already reaches a private account through
an MCP server (Gmail, Notion, a broker), name it and Wisp takes it over: Hermes then no longer holds
its keys. Press Enter to skip, and do it later with `wisp integrate hermes --connectors`. What
happens to each server is on [Moving Hermes's MCP servers into Wisp](./hermes.md#moving-hermess-mcp-servers-into-wisp).
`--skip-connectors` skips the question outright.

It ends with what to do next, and the known limits for your OS.

### 3. Linux only: the fix before the restart

On Linux, Wisp's sandbox around Hermes is [bubblewrap](https://github.com/containers/bubblewrap),
required here, not only for `bash_run`'s sandbox. On Ubuntu 23.10 and later, AppArmor also
blocks it for regular users. You do not have to work this out: `integrate` checks both, and if
bubblewrap is missing or blocked, it prints one more step:

```text
Before the restart: Hermes runs unsandboxed on this machine until this is fixed: …
```

Run the command it names, exactly as printed. It either installs bubblewrap or adds a small
AppArmor profile for it. If your user has no `sudo` (common on a VPS you reach with an SSH key),
run it as root, without its leading `sudo`.

### 4. Restart Hermes

The plugin, and its sandbox, take effect when Hermes starts:

```sh
hermes gateway restart --all
```

Also quit any `hermes` CLI you have open. **Until every Hermes process has stopped once, it runs
without the sandbox.**

### 5. Check it

```sh
wisp doctor
# ✓ hermes default: plugin enabled, connected to http://127.0.0.1:3008/mcp
hermes mcp test wisp
```

Then, in Hermes (the CLI, or Telegram):

- `/wisp Which connectors do you have?` — Wisp answers directly, with no Hermes model involved.
- Ask Hermes to list `~/.wisp`. Its tool call is refused with `This goes through Wisp — use
  ask_wisp.`, and the folder reads as empty even to a script Hermes writes.

### 6. Tell Wisp what is private

Wisp now protects its own data and your [Desks](./sessions-and-projects.md) (`~/Wisp`). Add the
rest:

```sh
wisp connectors auth notion-remote     # an account Hermes should reach only through Wisp
wisp private add ~/Documents/Finance   # a folder Hermes may not open
hermes gateway restart --all           # a new Private Folder applies at Hermes's next start
```

See [Connectors](./connectors.md) for every account Wisp can hold (Gmail, Calendar and Drive appear
once Wisp is signed in, and need only `wisp connectors auth <name>`), and
[Private Folders](./hermes.md#private-folders).

### More than one Hermes profile

`wisp integrate hermes` covers every profile it finds. `--profile <name>` covers only that one. A
profile you create later is not covered until you run `wisp integrate hermes` again (it is safe to
run any number of times, and repairs rather than duplicates). A profile made with
`hermes profile create <name> --clone` copies the plugin along with the rest, and is covered at
once.

## Two machines

The Runtime runs on one machine, which holds your files and accounts and stays on: a VPS, or a Mac
mini at home. Hermes runs on another, and gets only Wisp's plugin, the Runtime's address and a
credential that opens Wisp's `/mcp` endpoint and nothing else. Nothing of Wisp's is on Hermes's
disk, so there is no sandbox to set up there.

The Runtime always listens on `127.0.0.1`, so Hermes reaches it through one of these:

| Way in | Pick it when |
| --- | --- |
| [Tailscale Serve](#tailscale-serve) | both machines can join the same tailnet. The easiest: no domain, no open port |
| [Caddy with a domain](#caddy-with-a-domain) | the Runtime's machine has a public name and ports 80 and 443 |
| [An SSH tunnel](#an-ssh-tunnel) | neither of those; you keep a tunnel up yourself |

### 1. Install Wisp on the Runtime's machine

As in [One machine](#1-install-wisp): the installer, yes to the service and to logging in, then
`wisp status` says `ready`.

### 2. Give the Runtime an address Hermes can reach

#### Tailscale Serve

Install [Tailscale](https://tailscale.com) on both machines, in one tailnet. Once per tailnet, in
Tailscale's admin console, turn on **HTTPS certificates** and **Serve**. (Without them,
`tailscale serve` prints `Serve is not enabled on your tailnet` with a link that turns it on.)

On the Runtime's machine:

```sh
tailscale serve --bg 3008
```

It prints the machine's https name, such as `https://mac-mini.tail1234.ts.net`. That is
`<name>` below.

#### Caddy with a domain

Point a DNS name, such as `wisp.example.com`, at the Runtime's machine, and put a
[Caddy](https://caddyserver.com) site in front of the Runtime. Caddy gets the certificate itself:

```text
wisp.example.com {
    reverse_proxy 127.0.0.1:3008
}
```

`https://wisp.example.com` is `<name>` below. You do not need to edit `allowedHosts` by hand: the
next step adds the name.

#### An SSH tunnel

Keep `ssh -L` running on Hermes's machine as a service (`autossh` under systemd or launchd), so
Hermes reaches the Runtime at `http://127.0.0.1:3008` there:

```sh
autossh -M 0 -N -o ServerAliveInterval=30 -L 3008:127.0.0.1:3008 wisp-tunnel@runtime-host
```

:::warning[Restrict the tunnel's key]
Hermes's model can read any key on its machine, and an ordinary SSH key is a shell on the Runtime's
machine: the files Wisp is there to keep away from Hermes. Use a key that can forward that one port
and do nothing else. In `~/.ssh/authorized_keys` on the Runtime's machine:

```text
restrict,port-forwarding,permitopen="127.0.0.1:3008" ssh-ed25519 AAAA… hermes-tunnel
```
:::

With a tunnel, leave `--public-url` out in the next step, and use `http://127.0.0.1:3008` where the
steps say `https://<name>`.

### 3. Make Hermes's credential

On the Runtime's machine:

```sh
wisp tokens create --name hermes --host-agent --public-url https://<name>
# <name> added to allowedHosts in the Runtime's config file; the running Runtime answers to it once restarted.
# Host Agent Credential: Q2xhdWRlIHdyb3RlIHRoaXMgZXhhbXBsZSB0b2tlbg
#
# Shown once. On Hermes's machine: `hermes plugins install ConfidentialCrabComputing/wisp-hermes-plugin/wisp --enable`,
# then `hermes wisp connect https://<name>/mcp` and paste it at the prompt.
```

It is shown once: keep it for step 5. Then restart the Runtime, so it answers to `<name>`:

```sh
systemctl --user restart wisp                                # Linux
launchctl kickstart -k "gui/$(id -u)/io.usewisp.runtime"     # macOS
```

### 4. Install the plugin beside Hermes

On Hermes's machine:

```sh
hermes plugins install ConfidentialCrabComputing/wisp-hermes-plugin/wisp --enable
```

Hermes warns that the source is custom (not from its catalog) and installs it. An older Hermes
whose scanner rates the plugin `CAUTION` asks `Install anyway? [y/N]`: answer `y`. The plugin's
code is public, at [wisp-hermes-plugin](https://github.com/ConfidentialCrabComputing/wisp-hermes-plugin),
and its README lists what the scanner flags and why.

### 5. Connect it

```sh
hermes wisp connect https://<name>/mcp
# Wisp Host Agent Credential (printed by `wisp tokens create --name hermes --host-agent`):
# (paste it; nothing is shown)
hermes mcp test wisp
```

`connect` reads the credential without echo, so it never lands in your shell history. It refuses a
plain `http://` address anywhere but loopback.

A running Hermes picks up the new server by itself within seconds; `hermes gateway restart` makes
it immediate. In Telegram, `/wisp` and `/wisp_model` reach the bot's command menu after one
`/restart` (then close and reopen the chat); typed, they work at once.

### Then

- Check it as in [One machine](#5-check-it), with `/wisp Which connectors do you have?`.
  `wisp doctor` has nothing to check on Hermes's machine.
- Name what is private on the **Runtime's** machine: `wisp connectors add …`,
  `wisp private add …`. Hermes never had those files; a Private Folder there tells Wisp's answers
  to Hermes not to hand its files over verbatim, and needs no restart of Hermes.
- The Runtime's machine must be on and reachable whenever Hermes needs Wisp. While it is not, Hermes
  says Wisp is not answering, and does not do Wisp's tasks another way.
- Moving Hermes's MCP servers into Wisp is part of the one-machine setup. Here, add those accounts
  in Wisp as [Connectors](./connectors.md), then remove them from Hermes's config and delete their
  keys from Hermes's `.env`.

## From a chat

Hermes can install Wisp itself, in its own terminal, when you ask it from Telegram or Slack. It
follows the steps in the plugin's README, which are written for it.

1. Send Hermes:

   ```text
   Install Wisp, https://github.com/ConfidentialCrabComputing/wisp-hermes-plugin
   ```

2. **Sign in when it asks.** Hermes sends you a sign-in link in a code block. Open it, sign in,
   and send back the address your browser lands on (`http://127.0.0.1:…/callback?code=…`; that
   page does not load, which is fine). Do it within 5 minutes, or ask Hermes to start the sign-in
   again.

3. **The turn ends while Hermes reloads.** Hermes enables the plugin and restarts into the sandbox
   in the middle of that turn, so the turn is lost. Your next message gets
   `⏸️ This conversation is paused …`: send `/discard`, then ask something that needs Wisp, such as
   `/wisp Which connectors do you have?`.

4. **On Linux, if Hermes gives you a command to run as root** (bubblewrap, or its AppArmor
   profile), run it on the server as root, then send `/restart`. Until then Hermes runs without
   the sandbox.

5. **For the command menu**, send `/restart` once and reopen the chat: `/wisp` and `/wisp_model`
   appear in Telegram's menu after the bot's next start.

Things to know about this path:

- Hermes runs the installer with no terminal to ask on, so it installs the Runtime as a service
  and skips the question about MCP servers. Move them later, from a terminal:
  `wisp integrate hermes --connectors`.
- Once Wisp is inside Hermes, **Hermes can no longer sign Wisp in**: the sandbox keeps it from Wisp's
  login. If Wisp loses its sign-in later, run `wisp login` in a terminal on that machine (over SSH
  for a server).
- Hermes does not read `~/.wisp` or `~/.config/wisp` while installing, even when a step fails:
  they hold Wisp's secrets. It asks `wisp status` and reads Wisp's log instead.

## Undo it

On one machine:

```sh
wisp integrate hermes --remove
hermes gateway restart --all
```

It disconnects every profile, switches the MCP servers it moved back on in Hermes (their Wisp
Connectors stay), removes the plugin, and revokes the `hermes` credential. With `--profile <name>`
it undoes only that profile and keeps the credential the others use.

On two machines, on Hermes's machine:

```sh
hermes wisp connect --remove
hermes plugins remove wisp
```

and on the Runtime's machine, `wisp tokens revoke hermes`.

## Troubleshooting

| What you see | What to do |
| --- | --- |
| `wisp: command not found` right after installing | Open a new terminal, or run the `source …` line the installer printed. Or call it as `~/.wisp/bin/wisp`. |
| `Hermes is not on PATH` | Install Hermes Agent, or run `integrate` from a shell where `hermes` works. |
| `Hermes v… is too old for Wisp's plugin` | `hermes update`, then run `integrate` again. |
| `the Runtime is not running in ~/.wisp` | Start it: `systemctl --user start wisp` on Linux, `launchctl kickstart -k "gui/$(id -u)/io.usewisp.runtime"` on macOS, or `wisp serve`. `wisp doctor` names the cause. |
| `Wisp is not signed in` | `wisp login` (`wisp login --manual` on a server). |
| `the prepaid balance is empty` | `wisp billing topup <amount>`. See [Billing](./billing.md). |
| The service stops right after installing, on a Linux server shared with other users | Another user's Runtime holds port 3008. Give yours another `port` in `runtime.json` (see [Change the port](./configuration.md#change-the-port)), restart it, and run `integrate` again. |
| Hermes starts with `Wisp's zone is unprotected: …` | The sandbox did not start, and the line says why. On Linux it is almost always bubblewrap or AppArmor: run the fix `wisp doctor` names, then restart Hermes. |
| `wisp doctor` says `the Wisp plugin is disabled`, or another `hermes <profile>` problem | Run the fix it prints: `wisp integrate hermes --profile <profile>`, then restart Hermes. |
| Hermes says Wisp is not answering, or `ask_wisp` is not available | The Runtime is stopped or restarting (every `wisp update` restarts it), or unreachable. Hermes reconnects by itself within about 10 seconds of it coming back. If `hermes mcp test wisp` passes and Hermes still says so, `hermes gateway restart`. |
| Two machines: `hermes mcp test wisp` fails with `HTTP 400` | The Runtime does not answer to that name yet: make the credential with `--public-url https://<name>` (step 3), and restart the Runtime. |
| Two machines: `tailscale serve` says `Serve is not enabled on your tailnet` | Open the link it prints and enable Serve and HTTPS certificates, then run it again. |
| `hermes wisp connect` refuses the address | Use `https://…`, or `http://127.0.0.1:…` through a tunnel. Plain `http` to another machine would send the credential in clear. |
| Telegram has no `/wisp` in the menu | Send `/restart`, then close and reopen the chat. Typed, `/wisp` works anyway; `/commands` lists every command. |
| A Wisp confirmation was denied while you were away | Hermes denies what nobody answers within its 5 minutes (`approvals.timeout`). Ask again. See [Confirmations](./hermes.md#confirmations). |
| A Hermes cron job's Wisp task fails on a denied tool | Nobody is there to answer. Allow that tool beforehand: `wisp permissions set <tool> allow`. |
| Hermes stops starting after `wisp private add` | The folder holds code Hermes runs from (its venv, its install). `wisp private remove <folder>`, then restart Hermes. `wisp private add` warns when it sees this. |
| On Linux, `sudo` fails inside Hermes | Expected: setuid programs cannot work inside the sandbox. Run commands that need root outside Hermes. |
| A script using the `agentToken` from `runtime.json` gets `401` | On a machine with Wisp inside Hermes, that token changes at every Hermes start. Give the script a [named token](./remote-access.md#a-token-per-device). |
