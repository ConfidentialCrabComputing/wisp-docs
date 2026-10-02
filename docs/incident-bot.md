---
description: The adapter contract as a walkthrough you can run, with one Session per incident and one Run per alert.
---

# Example: an incident bot

An on-call assistant. Alerts arrive in your own systems. Each incident gets one Session, and
each new alert on it becomes a Run whose input is what changed. The agent reads the
procedure, looks things up through your connectors, and drafts the message for the
operators. It reads the on-call chat through the built-in Telegram connector and leaves its
message in that chat's draft box: it is allowed to draft, not to send.

You need a Runtime that is running and signed in. If you do not have one, start with the
[Quickstart](./quickstart.md).

## 1. The Project folder

```sh
mkdir -p ~/agents/incidents/.settings/skills/open-case
cd ~/agents/incidents

cat > AGENTS.md <<'MD'
# Incident SOP

You are the on-call assistant for the payments service.

For every signal:
1. Say what changed since the last message on this incident.
2. Check the runbook and the dashboards before guessing.
3. Read the Telegram chat "Payments on-call" for what the operators already know.
4. You may not message anyone. Leave what you would send as a draft in that chat
   (save_draft), and return the same text.
MD

cat > .settings/skills/open-case/SKILL.md <<'MD'
---
name: open-case
description: Open an incident case from the first alert
whenToUse: The first signal of a new incident
argumentHint: <alert json>
---

Summarise the alert, name the service, list the three checks to run first,
and draft the first operator message.
MD
```

## 2. The connector, and what it may do

Telegram signs in as your own account, with API keys from
[my.telegram.org](https://my.telegram.org) (see [Connectors](./connectors.md#telegram)):

```sh
wisp connectors telegram keys --api-id 123456 --api-hash-stdin
wisp connectors auth telegram
wisp connectors enable telegram --project .

# find the chat, read it, and draft in it; nothing else
for tool in resolve_chat list_chats get_messages search_messages save_draft; do
  wisp permissions set "mcp__telegram__$tool" allow --project .
done
wisp permissions get --project .
```

These tools now run without asking. `mcp__telegram__send_message` and the other tools that
write are left at their default, `ask`, so in an unattended Run they are refused. That is
exactly what step 4 of the SOP relies on. (`wisp permissions allow-connector telegram`
would have allowed sending too.)

## 3. The first alert, from the CLI

```sh
wisp run --skill open-case "$(cat alert.json)" --json > case.json
SESSION=$(jq -r .sessionId case.json)
jq -r .output.text case.json
```

Without `--json`, `wisp run` prints `session <id>` on stderr and the answer on stdout.

## 4. The next alert is another Run on the same Session

```sh
wisp run "$SESSION" "the error rate dropped to 2% after the rollback" --key "incident-4711:evt-8823"
```

`--key` is the alert's own id. If whatever calls you delivers the same alert twice, the
second call gets the first Run's answer instead of running the turn again.

## 5. The same thing, the way an adapter does it

Your adapter does not shell out to `wisp`. It reads the address and token where the CLI
does, and makes two calls per alert:

```sh
URL=$(jq -r .url ~/.wisp/runtime.lock)
TOKEN=$(jq -r .token ~/.wisp/runtime.lock)

# conversation → Session: every alert for this incident lands on one Session
SESSION=$(curl -sS "$URL/v1/sessions" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"projectRoot\":\"$HOME/agents/incidents\",\"origin\":\"cli\",\"externalKey\":\"incident:4711\",\"title\":\"incident 4711\"}" \
  | jq -r .id)

# message → Run: the connection stays open until the Run ends
curl -sS "$URL/v1/sessions/$SESSION/runs" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"input":"grafana: latency p99 back under 400ms for 10 minutes","idempotencyKey":"incident-4711:evt-8824"}' \
  | jq
```

The first call answers `201` the first time and `200` for every alert after it. The second
returns the Run's outcome:

```json
{ "runId": "…",
  "status": "completed",
  "output": { "text": "Latency has recovered…\n\nDraft for Payments on-call: …" },
  "toolCalls": [ { "name": "mcp__telegram__get_messages", "ok": true, "durationMs": 380 },
                 { "name": "mcp__telegram__save_draft", "ok": true, "durationMs": 210 } ],
  "usage": { "inputTokens": 8122, "outputTokens": 311, "totalTokens": 8433 },
  "artifacts": [] }
```

The draft is in `output.text` and in the chat's draft box. An operator opens "Payments
on-call", reads it and presses send. Had the agent tried `send_message`, the call would be
refused and listed with `"ok": false`: no Rule allows it.

## 6. What an operator sees afterwards

```sh
wisp sessions list          # the Sessions this folder has
wisp audit "$SESSION"       # every tool call: when, which, ok, how long, and the decision
```

Audit rows never contain what a tool sent or received, so they are safe to read and to ship
elsewhere.

## 7. A restart in the middle

If the Runtime stops while a Run is going, the caller's connection closes and that Run's
answer is lost. The Session's history is on disk, so nothing else is. Once `wisp status`
says `ready`, send the alert again with the same key. After a restart the Runtime has
forgotten its keys, so this starts a new Run; [Runs and restarts](./runs-and-restarts.md)
explains why.

What stayed on your side the whole time: the alert source, the incident id, the retry and
the decision to send. What stayed on Wisp's: the Session, the SOP, the tools, the Rules and the
audit.
