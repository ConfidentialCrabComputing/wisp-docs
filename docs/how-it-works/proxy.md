---
title: Wisp Proxy (Anonymizer)
sidebar_label: Wisp Proxy
description: The stateless gateway inside a TEE that forwards model calls and runs identifiable requests on your behalf.
---

# Wisp Proxy (Anonymizer)

The Wisp Proxy is the single egress point for anything leaving your machine. Its sole job
is to broker three kinds of traffic without ever letting raw data exist outside the enclave:

- **LLM calls**, forwarded to TEE-hosted providers (Redpill, Tinfoil).
- **Remote tool execution**, particularly for identifiable requests: web search, page
  fetching and raw HTTP requests. The Proxy sends them from its own IP address instead of
  yours, then delivers the output to the local agent over MCP.
- **Google connectors**: Gmail, Google Calendar and Google Drive, each an MCP server the
  Proxy hosts, including tools that write. See [Google connectors](#google-connectors).

The anonymity comes from that IP address alone. The Proxy removes the auth headers
from a request.

## Architecture

The Wisp Proxy is built with NestJS (Node.js, TypeScript). It runs inside a Phala CVM
(Confidential Virtual Machine), a TEE at the level of the whole VM rather than a single
process. The entire process executes inside the enclave, isolated from the host OS, the
hypervisor and the cloud operator.

The Proxy is stateless by design: no database, no disk writes, no persistent volumes. It
lives in memory only and doesn't log request bodies, response payloads or query strings.
Search queries and LLM prompts exist only in process memory for the duration of the
request, and are then gone.

Because the Proxy runs inside a [TEE](./tee.md), nobody at Wisp can read or manipulate its
contents. Before any of your information is sent to the Proxy, the Wisp app verifies its
attestation by matching the code measurement against the published build. On any
mismatch, nothing is sent from your device.

## Google connectors

The Proxy hosts three MCP connectors that call Google APIs on your behalf, one per mount
path. The agent finds them through the Proxy's `/mcp/connectors` catalog, so a new tool or
scope reaches the agent without an agent release.

| Connector | Mount | Reads | Writes |
| --- | --- | --- | --- |
| Gmail | `/mcp/gmail` | `search_messages`, `get_message` | `send_email` |
| Google Calendar | `/mcp/calendar` | `list_events`, `get_event` | `create_event`, `update_event`, `delete_event` |
| Google Drive | `/mcp/drive` | `search_files`, `list_folder`, `list_shared_drives`, `get_file`, `read_file`, `read_document`, `read_sheet`, `get_spreadsheet_info`, `read_comments` | `create_document`, `append_to_document`, `replace_text`, `create_spreadsheet`, `update_sheet_values`, `append_sheet_rows`, `add_comment`, `reply_to_comment` |

The Google Drive connector covers file discovery across Drive together with the content of
Google Docs and Google Sheets: one mount, one consent, three Google APIs.

**Authorization.** You sign in to Google through OAuth with Google itself; the Proxy only
tells the agent which scopes to ask for. The agent keeps the token and sends it with every
call. The Proxy uses it for that one request and never stores it, true to its stateless
design, and redacts it from its logs.

| Connector | Scopes requested |
| --- | --- |
| Gmail | `gmail.readonly`, `gmail.send` |
| Google Calendar | `calendar.readonly`, `calendar.events` |
| Google Drive | `drive.readonly`, `documents`, `spreadsheets`, `drive` (optional) |

Google's consent screen lets you untick any scope. A connector missing a required scope
stays in the "needs authorization" state. Full `drive` is the one optional scope: it is
needed only to write comments, so declining it costs `add_comment` and `reply_to_comment`
and nothing else.

**Shared drives.** In the Google Drive connector's settings you can limit which shared
drives it may reach. The Proxy enforces that list on every call. My Drive and files shared
directly with you are always reachable.
