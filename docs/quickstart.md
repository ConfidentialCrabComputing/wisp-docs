---
sidebar_position: 2
description: From a machine with nothing installed to an agent that answers.
---

# Quickstart

A fresh Linux box, about ten minutes, and one answered Run. Every command here is one the
Runtime ships today.

## 1. Install

```sh
curl -fsSL https://usewisp.io/install.sh | sh
```

The installer downloads the release for your platform, checks it against the manifest the
release key signs, unpacks it into `~/.wisp/versions/<version>` and links `~/.wisp/bin/wisp`
at it. It also adds `~/.wisp/bin` to your `PATH` in your shell's rc file — open a new shell,
or run the `export` line it prints.

Set `WISP_HOME` to install somewhere other than `~/.wisp`. Install `minisign` first
(`apt install minisign`) if you want the manifest's signature verified rather than skipped:
without it the install still checks TLS and the archive's SHA-256, and says that it did not
check the signature.

## 2. Give it a token

Everything reaches the Runtime over HTTP on loopback, and every request carries a bearer
token. The token is yours to pick; write it into `$WISP_HOME/runtime.json` before the first
start:

```sh
mkdir -p ~/.wisp
printf '{"agentToken":"%s"}\n' "$(openssl rand -base64 32)" > ~/.wisp/runtime.json
chmod 600 ~/.wisp/runtime.json
```

At least 32 characters, or the Runtime refuses to start. Nothing else goes in the file for
now — the release already knows where to reach the model and where you sign in. A file it
cannot load, or one owned by another user, exits **78** and says what is wrong.

## 3. Start it

```sh
wisp serve
```

It writes `$WISP_HOME/runtime.lock` — the address and token every other command reads, which
is why none of them takes a flag. Leave it running and open a second shell:

```sh
wisp status
# login_required (wisp 1.4.0, serve)
```

<details>
<summary>Or let systemd keep it up</summary>

Re-run the installer with `WISP_SERVICE=1` and it writes a **user** unit, enables it and
starts it — no root anywhere:

```sh
WISP_SERVICE=1 curl -fsSL https://usewisp.io/install.sh | sh
systemctl --user restart wisp   # after writing runtime.json
journalctl --user -u wisp -f
```

A user service stops when you log out until you grant lingering:
`loginctl enable-linger "$(id -un)"`.

</details>

On Linux the agent's `bash_run` tool needs bubblewrap and refuses to run commands without
it: `apt install bubblewrap`.

## 4. Sign in

The Runtime reaches the model through your account, so a fresh install sits at
`login_required` until somebody signs in. A server has no browser, so sign in on whatever
machine does:

```sh
wisp login --manual
```

It prints a URL. Open it anywhere, sign in, and paste back the URL you were redirected to.
Then:

```sh
wisp status
# ready (wisp 1.4.0, serve)
```

Without `--manual` the Runtime opens a browser on **its own** host and the command waits for
the login to land.

## 5. Run something

`cd` into the folder the agent should work in — that folder becomes the Session's Project,
and the agent's tools are confined to it:

```sh
cd ~/projects/thing
wisp run "read the source and tell me what this project does"
```

The answer goes to stdout; the Session's id goes to stderr, so a pipe gets the answer alone.
Continue that Session by naming it:

```sh
wisp run 01JB… "now write a README for it"
```

The command waits for the Run and exits **0** when it completed, **1** when it failed or was
cancelled, **2** on a bad command line, **4** when no Runtime answered and **5** when the
token was refused. `--json` prints the whole outcome as one JSON document instead.

```sh
wisp sessions list        # the Sessions this folder has
wisp cancel 01JB…         # stop what a Session is running
```

## 6. Connect one thing

The agent's own tools are built in. Everything else arrives as an MCP connector — added
once, then enabled per Project:

```sh
wisp connectors add github --http https://api.githubcopilot.com/mcp/ --header-stdin Authorization
# paste: Bearer <your GitHub token>
wisp connectors enable github --project .
wisp connectors list
# github  http  connected  38
```

`--header-stdin` asks for the secret on the terminal so it never lands in your shell
history. A server that signs you in with OAuth instead takes `wisp connectors auth github`,
which prints a URL and takes the redirect the same way `wisp login --manual` does.

That is the whole loop: install, start, sign in, run, connect.
