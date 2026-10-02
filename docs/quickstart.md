---
description: Install Wisp, sign in, and get a first answer, in about five minutes.
---

# Quickstart

From a Mac or a Linux machine with nothing installed to an agent that answers.

## 1. Install

```sh
curl -fsSL https://usewisp.io/runtime/install.sh | sh
```

The installer asks one question:

```
Start the Runtime in the background now and at every login? [Y/n]
```

Press **Enter**. Wisp then runs as a background service (a launchd agent on a Mac, a
systemd user service on Linux), so you never have to start it by hand.

The installer does everything else for you: it downloads and verifies the release, puts the
`wisp` command in `~/.wisp/bin`, adds that folder to your `PATH`, and creates
`~/.wisp/runtime.json` with a random access token. You do not need to configure anything.

Open a new terminal so the `PATH` change takes effect, then check:

```sh
wisp status
# login_required (wisp 0.1.0, serve)
```

`login_required` is expected: the Runtime is up and waiting for you to sign in.

:::note[Linux]
On Linux the installer needs `minisign` or OpenSSL 3 to verify the release signature, and
stops if neither is installed. The agent's `bash_run` tool also needs bubblewrap. On
Debian or Ubuntu: `sudo apt install minisign bubblewrap`.
:::

<details>
<summary>Answered "no", or there was no terminal to ask on?</summary>

Then nothing is running yet. Start the Runtime yourself and keep that terminal open:

```sh
wisp serve
```

Run the remaining commands in a second terminal. To get the background service later, see
[Install, update, uninstall](./install.md#run-it-as-a-service).

</details>

<details>
<summary>Already use Wisp Desktop on this Mac?</summary>

Then the installer does not offer the service, because the app already runs a Runtime on
the same data. Keep the app open: `wisp` commands talk to the Runtime inside it, and you are
already signed in. See [Install, update, uninstall](./install.md#next-to-wisp-desktop).

</details>

## 2. Sign in

The Runtime reaches the model through your Wisp account.

```sh
wisp login
```

This opens a browser, waits for you to sign in, and prints `ready`.

On a server without a browser, or over SSH, it does not wait for one. It prints a URL instead
(`--manual` does the same anywhere): open it on any device, sign in, then copy the address
the browser ends up on (something like
`127.0.0.1:49873/callback?code=…`; the page itself will not load, and that is fine) and paste
it back into the terminal.

```sh
wisp login --manual
```

```sh
wisp status
# ready (wisp 0.1.0, serve)
```

## 3. Ask something

`cd` into the folder the agent should work in. That folder becomes the Session's
**Project**, and the agent's file tools can only reach inside it.

```sh
cd ~/projects/thing
wisp run "read the source and tell me what this project does"
```

The first line, `session 6b4f2a7e-…`, goes to stderr; the answer goes to stdout. To keep
talking in the same conversation, pass that id:

```sh
wisp run 6b4f2a7e-… "now write a README for it"
```

Some useful commands to go with it:

```sh
wisp sessions list      # this folder's Sessions
wisp cancel 6b4f2a7e-…  # stop a Run that is taking too long
wisp models             # models you can pick with: wisp run --model <id>
```

## 4. Connect a service

The agent has file, shell and web tools built in. Anything else comes from a
**connector**, an MCP server you add once and then enable for each Project. For example,
GitHub:

```sh
wisp connectors add github --http https://api.githubcopilot.com/mcp/ --header-stdin Authorization
# paste: Bearer <your GitHub token>, then press Enter

wisp connectors enable github --project .
wisp permissions allow-connector github --project .
```

The three commands do three different things:

1. `add` stores the connector and its secret. `--header-stdin` reads the secret from the
   terminal, so it never ends up in your shell history.
2. `enable` makes its tools visible to the agent in this folder.
3. `allow-connector` lets those tools run. Nobody is watching a CLI Run to approve a tool
   call, so a tool with no Rule that allows it is refused. This command allows every
   GitHub tool in this folder. To allow only some of them, see [Permissions](./permissions.md).

```sh
wisp connectors list
# github  connected

wisp run "list my open pull requests"
```

## Next

- [Using the CLI](./cli.md): everything `wisp run` and friends can do.
- [Connectors](./connectors.md): OAuth sign-in, local MCP servers, Telegram.
- [Deploying an agent](./deploy-an-agent.md): turn a folder into an agent you can ship to a
  server.
