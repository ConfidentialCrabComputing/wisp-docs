---
description: Add MCP servers and Telegram, sign them in, and enable them per Project.
---

# Connectors

A connector gives the agent more tools. It is either an MCP server, reached over HTTP, SSE
or as a local process, or Telegram, which is built in.

A connector needs three things before the agent can use it:

| Step | Command | Scope |
| --- | --- | --- |
| Add it, with its secret | `wisp connectors add` | once per Runtime |
| Enable it for a Project | `wisp connectors enable <name> --project <path>` | per Project |
| Allow its tools to run | `wisp permissions allow-connector <name> --project <path>` | per Project, or global |

Skip the last step and the agent sees the tools but every call is refused, because nobody
is there to approve it. [Permissions](./permissions.md) explains why and how to allow only
some tools.

`add` and `auth` take the other two steps as options: `--project <path>` enables the
connector for that Project, and `--allow` allows all its tools (in that Project, or
globally without `--project`):

```sh
wisp connectors add github --http https://api.githubcopilot.com/mcp/ --header-stdin Authorization --project . --allow
```

`--allow` needs the connector to be connected. If it is not signed in yet, the command
stores it, exits `1` and names the `wisp connectors auth <name> … --allow` to run next; if
it failed, it prints the server's error. The connector stays added either way.

## Adding an MCP server

```sh
# a remote server over HTTP, with a secret header read from the terminal
wisp connectors add github --http https://api.githubcopilot.com/mcp/ --header-stdin Authorization

# a remote server over SSE, with a non-secret header
wisp connectors add metrics --sse https://metrics.internal/sse --header X-Team=payments

# a local server run as a process
wisp connectors add files --stdio "npx -y @modelcontextprotocol/server-filesystem /srv/shared"
```

- `--header-stdin <name>` asks you to paste the header's value. Use it for tokens: a value
  given on the command line ends up in your shell history and can be seen by other users on
  the machine while the command runs. You can pass one `--header-stdin` per command.
- `--header <name>=<value>` can repeat. Headers apply to `--http` and `--sse` only.
- `--stdio` splits the command on spaces, so an argument that contains a space cannot be
  passed.
- Secrets are stored encrypted in the Runtime's data directory, never in a Project folder.
- If you send headers to a remote server over plain `http`, the command warns you before it
  asks for the secret.

## Signing in with OAuth

Some servers sign you in through a browser instead of taking a token. After `add`, such a
connector shows as not signed in:

```sh
wisp connectors list
# notion  not signed in: run wisp connectors auth notion

wisp connectors auth notion
```

`auth` prints a URL. Open it on any device, sign in, and paste back the address the browser
lands on, the same way as [`wisp login --manual`](./quickstart.md#2-sign-in). The command
prints the connector's new state and exits `0` once it is connected. Add `--project <path>`
and `--allow` to enable it and allow its tools in the same command.

## Telegram

Telegram signs in as your own account, so it needs API keys from
[my.telegram.org](https://my.telegram.org) and a login code:

```sh
wisp connectors telegram keys --api-id 123456 --api-hash-stdin
# paste the API Hash, then press Enter

wisp connectors auth telegram
# asks for your phone number (+14155552671 format), the code Telegram sends you,
# and your two-step verification password if you have one
```

A mistyped code or password asks again. An expired code makes Telegram send a new one.

Messages the Telegram connector returns carry `fromMe`, so the agent can tell what you wrote
from what others wrote.

## Enabling per Project

```sh
wisp connectors enable github --project .
```

A connector is available in a Project only after it is enabled there. If you ask the agent
for something a connected but not-enabled connector would do, it says the connector is not
enabled in this Project and gives you the `enable` command to run.

Enabling is stored on this machine, not in the Project folder, so a fresh checkout on
another server has to be enabled there too. See
[Deploying an agent](./deploy-an-agent.md#what-a-deploy-does-not-carry).

## Checking and removing

```sh
wisp connectors list
# github   connected
# metrics  failed: 401 Unauthorized
# notion   not signed in: run wisp connectors auth notion

wisp connectors remove metrics
```

A connector is `connected`, `connecting...`, `disconnected`, `failed` (followed by the
server's error), or not signed in. `wisp connectors list --json` adds the transport and the
tool count.

Connectors are shared with Wisp Desktop when both use the same data directory.
