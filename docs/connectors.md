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
wisp connectors add notion-remote --http https://mcp.notion.com/mcp

wisp connectors list
# notion-remote  not signed in: run wisp connectors auth notion-remote

wisp connectors auth notion-remote
```

`auth` prints a URL. Open it on any device, sign in, and paste back the address the browser
lands on, the same way as [`wisp login --manual`](./quickstart.md#2-sign-in). The command
prints the connector's new state and exits `0` once it is connected. Add `--project <path>`
and `--allow` to enable it and allow its tools in the same command.

## Ready-made connectors

Wisp Desktop offers a few connectors by name, and `GET /v1/connectors/templates` lists them.
From the CLI you add one like any other server, with its name and address:

| Name | Service | Address | Signs in with |
| --- | --- | --- | --- |
| `notion-remote` | Notion | `https://mcp.notion.com/mcp` | OAuth: `wisp connectors auth notion-remote` |
| `linear` | Linear | `https://mcp.linear.app/mcp` | OAuth: `wisp connectors auth linear` |
| `granola` | Granola | `https://mcp.granola.ai/mcp` | an API key, sent as the `Authorization` header |
| `telegram` | Telegram | built in | API keys and a login code, see [Telegram](#telegram) |

```sh
wisp connectors add linear --http https://mcp.linear.app/mcp
wisp connectors auth linear --project . --allow

wisp connectors add granola --http https://mcp.granola.ai/mcp --header-stdin Authorization
```

## Gmail, Calendar and Drive

The Google connectors are not added by you: Wisp's proxy publishes them, and once the
Runtime is signed in they appear in `wisp connectors list` on their own, under the names the
proxy gives them. Sign one in with `wisp connectors auth <name>`, then enable it and allow
its tools as for any other connector.

Their names are reserved. `wisp connectors add` with one of them is refused with `409`
(`Connector name is reserved by the catalog`), and so is `wisp connectors remove`
(`Connector is managed by the catalog`).

### Which shared drives Drive reaches

The Drive connector, `google-drive`, reaches every shared drive of the Google account until
you choose some. Your own My Drive and the files shared with you directly stay reachable
whatever you choose. The proxy enforces the choice on every Drive call, so a change applies
from the next call, with no reconnect.

There is no CLI command for it yet; use the API:

```sh
# the account's shared drives, with their ids
curl -fsS -H "Authorization: Bearer $TOKEN" "$URL/v1/connectors/google-drive/shared-drives"

# only these two
curl -fsS -X PUT -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{ "mode": "selected", "driveIds": ["0AAbCdEfGhIjKl", "0AMnOpQrStUvWx"] }' \
  "$URL/v1/connectors/google-drive/drive-settings"
```

- `{ "mode": "selected", "driveIds": [] }` closes every shared drive.
- `{ "mode": "all", "driveIds": [] }` opens them all again; `driveIds` must be empty with
  `all`.
- At most 1000 ids. An id is 6 to 128 letters, digits, `-` or `_`.
- `GET …/drive-settings` answers the current choice. The listing answers `drives` (each with
  `id` and `name`) and `truncated` when Google stopped early; it is `409` while the connector
  is not connected.
- On any connector other than the proxy's `google-drive`, these routes answer `404`.

## Telegram

:::tip[The connector is not the Telegram bot]
The connector is a tool: **the agent reads your own Telegram account**, its chats and
messages. The [Telegram bot](./telegram-bot.md) is a Channel: **you write to the agent** in
Telegram. They are set up apart, and you can use either without the other.
:::

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

Its tools read (`get_me`, `list_chats`, `get_chat`, `get_messages`, `search_messages`,
`search_global`, `get_message_context`, `get_message_link`, `resolve_chat`, `list_contacts`,
`search_contacts`, `download_media`, `transcribe_voice`) and write (`send_message`,
`reply_to_message`, `forward_message`, `send_file`, `save_draft`, `edit_message`,
`delete_message`) as your account. Reading marks nothing read. `transcribe_voice` needs
Telegram Premium on the account.

`POST /v1/connectors/telegram/disconnect` signs the account out at Telegram and keeps the API
keys; `wisp connectors remove telegram` signs it out and deletes the keys too. If Telegram
cannot be reached, remove the Wisp device by hand under Settings › Devices.

## Enabling per Project

```sh
wisp connectors enable github --project .
```

A connector is available in a Project only after it is enabled there. If you ask the agent
for something a connected but not-enabled connector would do, it says the connector is not
enabled in this Project and gives you the `enable` command to run.

Enabling is stored in the Project folder, in `.wisp/mcp.json`, as a list of connector names.
A copy of the folder carries the list, but not the connectors themselves: they, and their
secrets, stay in the Runtime's data directory, so another server must add them before the
list means anything there. See
[Deploying an agent](./deploy-an-agent.md#what-a-deploy-does-not-carry).

## Checking and removing

```sh
wisp connectors list
# github         connected
# metrics        failed: 401 Unauthorized
# notion-remote  not signed in: run wisp connectors auth notion-remote

wisp connectors remove metrics
```

A connector is `connected`, `connecting...`, `disconnected`, `failed` (followed by the
server's error), or not signed in. `wisp connectors list --json` adds the transport and the
tool count.

Connectors are shared with Wisp Desktop when both use the same data directory.
