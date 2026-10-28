---
description: What the installer does, running Wisp as a service, living next to Wisp Desktop, updating and uninstalling.
---

# Install, update, uninstall

## Platforms

| OS | Architectures | Service |
| --- | --- | --- |
| macOS | Apple silicon, Intel | launchd agent |
| Linux | x86-64, arm64 | systemd user service |

The installer does not support Windows yet.

## What the installer does

```sh
curl -fsSL https://usewisp.io/runtime/install.sh | sh
```

1. Downloads the release manifest and checks its signature against the Wisp release key.
2. Downloads the archive for your platform and checks its SHA-256 against the manifest. On
   a Mac it also checks that every binary in it is signed with Wisp's Developer ID.
3. Unpacks it into `~/.wisp/versions/<version>` and points `~/.wisp/bin/wisp` at it.
4. On the first install, writes `~/.wisp/runtime.json` with a random access token
   (`agentToken`), readable only by you. A later run keeps the file you have.
5. Adds `~/.wisp/bin` to `PATH` in `~/.zshrc`, `~/.bashrc`, `~/.config/fish/config.fish`
   or `~/.profile`, whichever matches your shell, and ends by printing the command that
   loads it into the current terminal (`source <file>`, or `. ~/.profile`).
6. If you said yes, or set `WISP_SERVICE=1`, installs and starts the service. On Linux it
   first writes the Runtime's encryption key to `~/.config/wisp/master.key`, once, and
   then turns lingering on, so the service keeps running after you log out.
7. If you are not signed in and the service came up, asks `Log in now? [Y/n]` and runs
   `wisp login`. Then it prints `wisp status`.

Running the installer again upgrades in place. It keeps your data, your settings and the
service, if you have one, and restarts the service onto the new version.

### Signature checks

To check the manifest signature, the installer needs either `minisign` or OpenSSL 3:

- **Linux:** one of them is required. Without it the installer stops before it changes
  anything. Install one with `sudo apt install minisign`.
- **macOS:** if neither is installed, the installer warns and relies on the Developer ID
  check of every binary instead. Set `WISP_REQUIRE_SIGNATURE=1` to make the signature
  required there too.

### Installer options

Set these on the `sh` side of the pipe. In front of `curl` they would apply to `curl`,
not to the installer.

```sh
curl -fsSL https://usewisp.io/runtime/install.sh | WISP_HOME=/srv/wisp WISP_SERVICE=1 sh
```

| Variable | Effect |
| --- | --- |
| `WISP_HOME` | Install and keep data here instead of `~/.wisp`. |
| `WISP_SERVICE` | `1` installs the service without asking; `0` skips it without asking. |
| `WISP_VERSION` | Install this release (for example `0.1.0`) instead of the latest. |
| `WISP_REQUIRE_SIGNATURE` | `1` refuses to install without a verified signature, on any OS. |
| `NO_COLOR` | Plain output with no colours. |

## Run it as a service

Every command except `wisp serve` talks to a running Runtime, so in practice you want it
running in the background. On the first install the installer asks whether it should be.
It only asks at a terminal, and only when no `runtime.json` exists yet. To add the service
later, run the installer again with `WISP_SERVICE=1`.

A service needs a login session to register with: a systemd user session on Linux, or a
Mac with someone logged in at its screen. Where there is none (WSL, a container, a Mac
reached over SSH with nobody logged in) the installer does not offer it, and
`WISP_SERVICE=1` stops the install before it changes anything. Run `wisp serve` yourself
there.

Both services run as your user, never as root, and start again every time you log in.

### macOS

The service is a launchd agent, `io.usewisp.runtime`, defined in
`~/Library/LaunchAgents/io.usewisp.runtime.plist`.

```sh
tail -f ~/.wisp/logs/serve.log                              # the log
launchctl kickstart -k "gui/$(id -u)/io.usewisp.runtime"    # restart it
```

If the Runtime crashes, launchd does not restart it right away. It starts again at your next
login, or when you restart it with the `kickstart` command above.

### Linux

The service is a systemd user unit, `~/.config/systemd/user/wisp.service`.

```sh
journalctl --user -u wisp -f        # the log
systemctl --user restart wisp       # restart it
```

A user service stops when you log out unless lingering is on. The installer turns it on.
Where your user may not do that, often over SSH, it warns
`the service stops at logout until: sudo loginctl enable-linger <you>`: run that once. An
installation made before the installer did this needs the same command, or the installer run
again:

```sh
sudo loginctl enable-linger "$(id -un)"
```

The unit restarts the Runtime if it crashes, except after exit code 78. That code means a
configuration problem, which a restart cannot fix. See
[Troubleshooting](./runbook.md#exit-codes).

The unit hands the Runtime its key file, `~/.config/wisp/master.key`. **Back that file up**:
without it nothing the Runtime stored can be read again. See
[the encryption key on a server](./remote-access.md#the-encryption-key-on-a-server).

The installer also warns when bubblewrap is not installed. You need it only once you turn
the `bash_run` [sandbox](./sandbox.md) on, which is off by default:
`sudo apt install bubblewrap`.

### Without a service

```sh
wisp serve     # runs in this terminal; Ctrl-C stops it
wisp stop      # stops it from another terminal
```

:::warning[Linux]
On Linux, `wisp serve` keeps its encryption key in a file and stops with exit code 78 until
you name one with `WISP_MASTER_KEY_FILE`. The service sets this up for you; without it, see
[the encryption key on a server](./remote-access.md#the-encryption-key-on-a-server).
:::

## Next to Wisp Desktop

Wisp Desktop and the CLI share one data directory, `~/.wisp`. That means one set of
Sessions, connectors, Rules and the same login. Only one Runtime can use a data directory at
a time:

- While the app is open, `wisp` commands talk to the Runtime inside it. You do not need
  `wisp serve`.
- `wisp serve` refuses to start while the app is open, with exit code 78.
- `wisp stop` will not stop the app's Runtime. Quit the app instead.
- The installer does not offer a service on a machine where Wisp Desktop has run, because
  the service would keep the app from starting.

To run both at the same time, give the CLI its own data directory with `WISP_HOME`.

The app can also work with a Runtime on another machine, such as a server: it reaches it
over SSH, with no port to open. See [Connect to a server](./desktop/connect-to-a-server.md).

## The access token

Every request to the Runtime carries the token from `runtime.json`. You never have to type
it: `wisp serve` writes the address and token to `~/.wisp/runtime.lock` (readable only by
you), and every other `wisp` command reads them from there.

To use a different token, edit `agentToken` in `~/.wisp/runtime.json`. It must be at least
32 characters long. Then restart the Runtime.

## What `~/.wisp` holds

| path | what it is |
| --- | --- |
| `runtime.json` | the settings — see [Configuration](./configuration.md) |
| `runtime.lock` | the running Runtime's address and token, for the other `wisp` commands |
| `data.db`, `global.db` | Sessions, messages, memory, Rules, schedules and the audit, encrypted |
| `keys/` | how the encryption keys are kept: in the OS keyring, or sealed with the [key file](./remote-access.md#the-encryption-key-on-a-server) |
| `mcp.json` | the connectors |
| `telegram.json`, `slack.json` | the [Telegram bot](./telegram-bot.md)'s and the [Slack app](./slack-app.md)'s owner, users and tokens |
| `models/` | the speech model, once installed |
| `logs/` | on macOS, the logs of the Runtime's, the Telegram bot's and the Slack app's services |
| `bin/`, `versions/` | the installed `wisp` |

To back up or move a Runtime, stop it and copy the whole directory. The databases open only
with their keys: on a server, take the key file too
(`~/.config/wisp/master.key`); the OS keyring does not travel with the folder.

## Update

The Runtime checks for a newer release when it starts and once a day. There are four ways
to install one, and all of them run the same `wisp update` on the Runtime's host:

- [from the shell](#from-the-shell), with `wisp update`;
- [from Wisp Desktop](#from-wisp-desktop) connected to a Runtime on a server;
- [from Telegram or Slack](#from-telegram-or-slack), with `/update` or `!update`;
- [by itself](#automatically), with `autoUpdate` turned on.

Only a signed release is ever installed, and only the newest one.

### From the shell

```sh
wisp update
```

This downloads and verifies the newest release next to the current one, then restarts the
service onto it and waits for it to come up on the new version. If the service does not
come up within 30 seconds, the release is still installed; `wisp doctor` says why. A running
[Telegram bot](./telegram-bot.md) or [Slack app](./slack-app.md) service is restarted onto
the new version too.

Each version in `~/.wisp/versions` is a few hundred megabytes, so `wisp update` then deletes
the old ones. It keeps the new version, the one it replaced, and the one a running Runtime
was started from, if that is yet another. A directory it cannot delete is named on stderr,
and the update still counts as done.

A service you stopped stays stopped. When a newer release exists, every `wisp` command
mentions it once on stderr:

```
wisp 0.2.0 is available — run `wisp update`
```

A service can take longer than the 30 seconds, for instance while Runs drain. `wisp update`
then prints that the service did not come up within 30 seconds, but the update is not lost:
once the service comes up on the new version, the Runtime reads the update as done, and Wisp
Desktop, the chats and `wisp status` report it as installed. Only a service that never comes
up on the new version leaves the update failed.

`wisp status` shows the same, and how the last update ended, whichever way it was started:

```
update   wisp 0.2.0 is available — wisp update installs it
last update  wisp 0.1.9 installed 2026-10-21T09:12:44.120Z
```

### From Wisp Desktop

Connected to a Runtime on a server, Wisp Desktop shows a banner when that Runtime has a newer
release: "Wisp 0.2.0 is available on the server", with **Update**. It reads it at launch and
every half hour.

- **Update** asks first, and says how many Runs are in flight on the server when there are
  any. Confirm, and the server updates and restarts. The banner says "Updating…" while it
  does. The app reconnects by itself, and the banner goes away once the server is back on
  the new release.
- If the update fails, the banner gives the reason. Close the message with its **×** to get
  the offer back and try again. If the server is not back within 5 minutes, the banner says
  so; if it was started by hand, the banner says to restart `wisp serve` on the server.
- Dismissing the banner hides it for that release on that server. The next release brings it
  back.
- When the server is too old for the app, the "Different versions" dialog has an **Update the
  server** button that does the same, on a server whose release already has the update
  route. An older server is told to run `wisp update` on it.
- When the server finds nothing newer to install after all, because the release its daily
  check named is no longer newer, the banner stops waiting at once and says "The server has
  nothing newer to install." Closing it hides the offer for that release.

The app's own Runtime, on your machine, gets no banner: the app's own updater replaces it.

### From Telegram or Slack

The [Telegram bot](./telegram-bot.md) and the [Slack app](./slack-app.md) ask the Runtime
about a newer release when they start and once an hour, so they hear of one at most an hour
after the Runtime's own daily check found it. They tell their owner, once per release, in a
direct message:

```
Wisp 0.2.0 is available. Send /update to install it.
```

The owner sends `/update` in Telegram or `!update` in Slack. Nobody else may: groups and the
people the owner let in never get the notice, and their `/update` is answered "Only the owner
can update."

- With Runs in flight, the bot says how many and starts nothing. Send `/update now`
  (`!update now`) to update anyway.
- Otherwise it answers "Updating, back in a moment." and the Runtime updates. After the
  restart, the bot says how it ended in the chat the command came from: "Updated to Wisp
  0.2.0.", that the release is installed and `wisp serve` needs a restart, or that the update
  failed. The reason for a failure is given only in the owner's direct message; a group is
  told that `wisp status` on the server says why.
- When there is nothing newer, it says "Wisp is on the newest release." It says the same after
  the restart when the update found nothing to install after all, because the release the
  daily check named is no longer newer; the Runtime then offers no update until its next
  daily check.

### Automatically

A Runtime nobody watches, such as an [incident bot](./incident-bot.md), can install a newer
release by itself. Turn it on in `runtime.json`, or with `WISP_AUTO_UPDATE=true`, and restart
the Runtime:

```json
{ "agentToken": "…", "autoUpdate": true }
```

It is off by default, so a release never restarts your Runtime unless you said it may. When
it is on:

- the Runtime looks once a minute, and starts the update only when no Run is executing,
  waiting for an approval, or queued. A Run that starts while the release downloads is not
  cut off: the restart waits until none is in flight, as `wisp update --when-idle` does;
- a failed update leaves the old release running, and the same version is tried again a day
  after the failure ended, at the first look that finds the Runtime idle, even across a
  restart. After three failures in a row of that version it stops and waits for a newer
  release, which it tries as usual. Failures of an update started any other way,
  `wisp update`, `/update` or the desktop, count toward the three too. Once you fixed the
  cause, run `wisp update`;
- a release installed and waiting for a hand-started `wisp serve` to be restarted is not
  installed again;
- each start and outcome goes to the Runtime's log.

Wisp Desktop's own Runtime ignores `autoUpdate`.

### Runs in flight

An update restarts the service, so Runs in flight get the
[drain window](./runs-and-restarts.md#the-drain-window), as on any restart. A Run still going
when the window ends fails with `shutdown`. On a Runtime that runs long jobs, raise
`shutdownDrainTimeoutMs` and restart it at a quiet moment, well before an update: the Runtime
reads the window only when it starts.

### A `wisp serve` started by hand

`wisp update` restarts only the service the installer set up. A `wisp serve` you started by
hand keeps running the old version: the update installs the new release, and every way of
updating reports it as installed and waiting. Restart `wisp serve` yourself to run it.

### What an update leaves behind

An update started from Wisp Desktop, a chat or `autoUpdate` runs in a process of its own, so
that restarting the service does not stop it. On Linux, when the Runtime runs as the systemd
service, the update runs with `systemd-run --user --scope` for the same reason. Its output
goes to `update.log` in the data directory (`~/.wisp` by default), and how it ended to
`update.json` beside it, which every surface reads after the restart. An update whose process
died before it finished, or that was still running when the machine went down or restarted,
is reported as failed, and counts as one of `autoUpdate`'s three tries.

These updates run the `bin/wisp` in the data directory. When that is a symlink into another
installation, they do not start, and are reported as failed: the update would record its
outcome in the other installation, where the Runtime never reads it. Run the installer with
`WISP_HOME` set to the data directory to give it a `bin/wisp` of its own.

## Uninstall

```sh
wisp uninstall
```

This removes the service, the Telegram bot's and the Slack app's services, `~/.wisp/bin/wisp`,
`~/.wisp/versions` and the `PATH` line the installer added. It removes `runtime.json` only while it holds
nothing but the installer's `agentToken`: a file you edited is kept. At a terminal it first
asks what to do with your data:

```
  1) Keep data: remove the Runtime; Sessions, connectors and settings stay
  2) Delete everything: also every Session, connector and setting, Wisp Desktop's included
  3) Cancel
Choose [1]:
```

**Keep data** is the default, and the only choice when there is no terminal to ask on. Pick
it when Wisp Desktop is installed: `~/.wisp` holds the app's data too. **Delete everything**
asks once more, then deletes `~/.wisp`; it refuses while Wisp Desktop is running. Neither
choice touches the key file `~/.config/wisp/master.key` on Linux: delete it yourself once
you no longer need the data.

If you started `wisp serve` by hand, `wisp stop` it first. The command refuses before it
removes anything.
