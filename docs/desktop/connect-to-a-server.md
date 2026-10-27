---
title: Connect to a server
sidebar_label: Connect to a server
description: Point Wisp Desktop at the Runtime on your own server. One command on the server, one paste in the app, and the app opens the SSH tunnel itself.
---

# Connect to a server

Wisp Desktop runs a Runtime on this computer. It can use the Runtime on a server of yours
instead: one that is always on, so its schedules fire while your laptop sleeps.

**Wisp Desktop is the easiest way to reach a Runtime on a server.** The app opens the SSH
tunnel to the server itself, with the `ssh` already on your computer, your keys and your
`~/.ssh/config`. You open no port on the server, and you need no domain and no certificate.
You run one command on the server and paste the line it prints into the app.

## Before you start

- **Wisp runs on the server.** Install it there with the [Quickstart](../quickstart.md), as a
  service. On the server, `wisp status` should answer, for example with `ready`.
- **You can log in to the server with `ssh`, without typing a password.** The app never asks
  for a password or a passphrase. If your key has a passphrase, add it to your SSH agent:
  `ssh-add`, on macOS `ssh-add --apple-use-keychain`.
- **This computer already knows the server's key.** If you have never run `ssh you@server`
  from this computer, do it once and check the fingerprint it shows. You do this anyway in
  step 1.
- **On Windows, the OpenSSH Client is installed.** Windows 10 1809 and later and Windows 11
  include it: Settings → Apps → Optional features → OpenSSH Client.

## Connect, step by step

1. **Log in to the server** from a terminal on this computer:

   ```sh
   ssh you@server
   ```

2. **Make a token for this computer.** On the server, run:

   ```sh
   wisp tokens create --name laptop --capability full
   ```

   Name it after the device, so you can revoke it alone later. It prints two lines:

   ```text
   Token:             Q2xhdWRlIHdyb3RlIHRoaXMgZXhhbXBsZSB0b2tlbg
   Connection string: wisp+ssh://you@203.0.113.7/127.0.0.1:3008#Q2xhdWRlIHdyb3RlIHRoaXMgZXhhbXBsZSB0b2tlbg
   ```

   Copy the connection string, from `wisp+` to the end. It is shown only once. It already
   names the server, your user and where the Runtime listens, so there is nothing else to
   copy.

3. **Open Settings → Runtime** in Wisp Desktop: press <kbd>⌘</kbd> <kbd>,</kbd> (on Windows
   and Linux <kbd>Ctrl</kbd> <kbd>,</kbd>), or click the gear next to your name at the
   bottom of the sidebar, then pick **Runtime**. The page shows the same command with a copy
   button.

4. **Paste the line into Connection string.** A **Server** field appears with
   `you@203.0.113.7` taken from the line. Leave it as it is, or change it to the name you
   use with `ssh`: an alias from `~/.ssh/config`, or the public address when the line shows
   a private one (a server behind NAT).

5. **Press Add.** The app opens the tunnel, checks that a Wisp Runtime answers through it,
   that it takes the token, and that its version suits this app. Only then does it save the
   server. The token goes to the system keychain. The server now shows under **Wisp runs
   on**, below **This computer**.

6. **Pick the server.** The window reloads behind a **Connecting to …** screen.

7. **Sign in, if the app asks.** When the server's Runtime is not signed in yet, the welcome
   screen offers **Continue with sign-in**. The browser opens on this computer, and the app
   passes the sign-in on to the server. A server you already ran `wisp login` on skips this
   step.

You are connected when the sidebar shows **Schedules** and **Connectors**, and Settings →
Runtime says **Connected** under the server.

## What you can do on a server

The window on a server is for setting that Runtime up:

- **Schedules.** Create, edit, pause and run jobs. The server runs them whether Wisp Desktop
  is open or not. A job's folder is a path on the server, so you type it into **Path on
  server**. In the activity feed, **Details** shows what a run did. While the app is open,
  a job that reports to the desktop shows a notification on this computer. See
  [Schedules](../schedules.md).
- **Connectors.** Add connectors and sign in to them. The sign-in page opens in the browser
  on this computer, and the app hands the result to the server. See
  [Connectors](../connectors.md).
- **Settings.** **Permissions** and **Sandbox** change the server's Runtime. **Keyboard** and
  **General** are this computer's. **Recording**, **Billing** and **Usage** are hidden.

Everything the app does on a server is paid like a terminal Run, which may mean from your
prepaid balance alone. The balance is your account's, so add to it from **This computer**'s
Settings, or with `wisp billing topup` on the server. See [Plan and balance](../billing.md).

Chats, Projects, Artifacts and Transcripts stay with **This computer**: a recording is this
computer's audio, and a Project is a folder on this computer. To talk to the agent on the
server, use the [Telegram bot](../telegram-bot.md), the [Slack app](../slack-app.md), or
`wisp run` on the server.

## Switching between this computer and the server

- **Settings → Runtime → Wisp runs on** switches between **This computer** and the server.
  Each switch reloads the window. Each Runtime keeps its own Sessions, connectors and
  schedules.
- **The app remembers your choice.** On the next launch it opens the tunnel again by itself.
- **You cannot switch while recording.** The app says **Stop the recording before switching
  where Wisp runs**.
- **One server at a time.** Adding another connection string replaces the server added
  before. **Remove** forgets the server and deletes its token from the keychain; if it was in
  use, Wisp goes back to this computer.
- **When the server does not answer at launch**, the welcome screen says **The Runtime at …:
  it did not answer** (or **it refused this computer's token**) and offers **Use this
  computer**.

## Staying connected

Under the server, Settings → Runtime shows where the tunnel is: **Connecting to the
server…**, **Connected**, **Reconnecting** with the reason, or the reason in red with a
**Retry** button.

After a dropped connection, a sleep or a network change, the app notices within about 45
seconds and opens the tunnel again: after 1 second at first, then waiting longer each time,
up to 30 seconds. It keeps trying for as long as trying can help. For a problem only you can
fix (your key, the server's key, port forwarding, a missing `ssh`) it stops and waits for
**Retry**. Picking **This computer**, or quitting the app, closes the tunnel.

## When something goes wrong

### When you press Add

The message shows under the form, and nothing is saved.

| It says | What to do |
| --- | --- |
| This is not a connection string | Paste the whole `wisp+…` line, the part after `#` included. |
| “…” is not a server: give [user@]host[:port] | Correct the **Server** field. |
| The tunnel to … did not open | The reason follows; see the next table. |
| Could not reach … | Check that the Runtime runs on the server: `wisp status` there. |
| The Runtime refused this token | The token was revoked or copied wrong. Make a new one (step 2). |
| This token cannot set the Runtime up | It was made with `--capability run`. Make one with `--capability full`. |
| The server runs Wisp …, too old for this app | Run `wisp update` on the server. |
| The server runs Wisp …, newer than this app understands | Update Wisp Desktop on this computer. |
| … is Wisp on this computer, not the server | A tunnel you opened yourself uses the app's own port. Forward the server to another local port. |

### The tunnel's status line

The line `ssh` printed shows under each message. A message the app does not recognise is
shown as that line alone.

| It says | Cause | What to do |
| --- | --- | --- |
| The server refused your key | No key the server accepts, or a key with a passphrase that is not in your agent | `ssh-add`, then **Retry** |
| This computer has never connected to the server | The server's key is not in `~/.ssh/known_hosts` | Run `ssh <server>` in a terminal once, check the key it shows, then **Retry** |
| The server's host key changed | The server's key differs from the one in `~/.ssh/known_hosts` | Check with whoever runs the server, remove the old key, then **Retry** |
| Host not found | The **Server** name does not resolve | Correct the Server |
| The server does not allow port forwarding | `AllowTcpForwarding no` on the server, or `restrict` / `no-port-forwarding` on your key | Allow forwarding in the server's `sshd_config`, then **Retry** |
| The tunnel is open but no Runtime answers | Wisp is not running on the server | `systemctl --user start wisp` (or `wisp serve`) on the server |
| The server is unreachable | Timeout, refused connection, no route, or the connection dropped | Check the Server and your network; the app keeps retrying |
| OpenSSH client not found | No `ssh` on this computer | Install the OpenSSH Client |
| Another program holds a port | A program took the tunnel's port on this computer | Usually nothing: the app moves to a free port and reloads the window. A `LocalForward` from `~/.ssh/config` held by another `ssh` session has to be closed. |

### Other problems

- **`wisp: command not found`** when you run `ssh you@server wisp tokens create …` as one
  line. A one-line `ssh` command often skips the shell setup that puts `wisp` on `PATH`. Log
  in first, as in step 1, or call it as `~/.wisp/bin/wisp`.
- **The connection string starts with `wisp+http://127.0.0.1`.** You ran the command on the
  server itself, outside SSH, and the line works on the server only. Run it over SSH, as in
  steps 1 and 2.
- **Wisp runs on this computer: the remote Runtime's token could not be read.** The token is
  gone from the keychain (a new keychain, or removed by hand). Paste the connection string
  again; make a new one if you no longer have it.
- **A Different versions dialog at launch.** The server or the app was updated since you
  connected, and they no longer understand each other. The dialog says which side to update.

## Keeping it safe

- **The token can do everything on the server's Runtime**, `bash` included. It travels only
  inside the SSH tunnel, and the app keeps it in the system keychain.
- **If you lose this computer**, run `wisp tokens revoke laptop` on the server. Your other
  devices keep working. See [A token per device](../remote-access.md#a-token-per-device).
- **The app trusts only the server keys your own `ssh` already trusts.** It never accepts a
  new key on its own. If you do want new keys accepted on first use for a server, set
  `StrictHostKeyChecking accept-new` for it in `~/.ssh/config`.
- **`ssh` looks the key up under the name in the Server field.** A server you know only by its
  IP address is unknown under its hostname, and the other way round. After you change the
  Server, connect to that name once in a terminal.

## Without SSH

A server behind an HTTPS proxy (see [Remote access](../remote-access.md#everything-else-through-a-tls-proxy))
gives a `wisp+https://…` line. Paste it the same way: there is no Server field, and the app
connects directly. The app also takes `wisp+http://127.0.0.1:<port>#…` for a tunnel you open
yourself, but never plain `http` to any other address, which would send the token in clear.
