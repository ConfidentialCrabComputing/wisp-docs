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
5. Adds `~/.wisp/bin` to `PATH` in `~/.zshrc`, `~/.bashrc` or `~/.profile`, whichever
   matches your shell.
6. If you said yes, or set `WISP_SERVICE=1`, installs and starts the service.

Running the installer again upgrades in place and keeps your data and settings.

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

A user service stops when you log out. To keep it running on a server, enable lingering
once:

```sh
loginctl enable-linger "$(id -un)"
```

The unit restarts the Runtime if it crashes, except after exit code 78. That code means a
configuration problem, which a restart cannot fix. See
[Troubleshooting](./runbook.md#exit-codes).

### Without a service

```sh
wisp serve     # runs in this terminal; Ctrl-C stops it
wisp stop      # stops it from another terminal
```

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

## The access token

Every request to the Runtime carries the token from `runtime.json`. You never have to type
it: `wisp serve` writes the address and token to `~/.wisp/runtime.lock` (readable only by
you), and every other `wisp` command reads them from there.

To use a different token, edit `agentToken` in `~/.wisp/runtime.json`. It must be at least
32 characters long. Then restart the Runtime.

## Update

```sh
wisp update
```

This downloads and verifies the newest release next to the current one. The running
Runtime keeps going on the old version until you restart it (see the restart commands
above). When a newer release exists, every `wisp` command mentions it once on stderr:

```
wisp 0.2.0 is available — run `wisp update`
```

## Uninstall

```sh
wisp uninstall
```

This removes the service, `~/.wisp/bin`, `~/.wisp/versions`, `runtime.json` and the `PATH`
line the installer added. It keeps your data, meaning Sessions, connectors and keys, because
Wisp Desktop may be using it. If you started `wisp serve` by hand, `wisp stop` it first.

To delete the data as well, remove `~/.wisp` after uninstalling. Do not do this while Wisp
Desktop is installed: that folder holds the app's data too.
