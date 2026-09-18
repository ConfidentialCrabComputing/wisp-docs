---
sidebar_position: 5
description: The adapter contract as a walkthrough you can run — one Session per incident, one Run per signal.
---

# A worked example: the incident bot

An on-call bot. Alerts land in the team's own systems; one Session holds one incident; every
signal becomes a Run whose input is the delta. The agent reads the SOP, looks things up
through the team's connectors, and drafts the operator message it is not allowed to send.
Nothing in it needs the Runtime to know what Slack or Telegram is.

Ten minutes against a Runtime that is already running — the [quickstart](./quickstart.md) if
it is not.

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
3. You may not message anyone. Draft what you would send and hand it back.
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

## 2. The connectors, and the Rules that let them run

```sh
wisp connectors add chatstore --http https://chat.internal/mcp/ --header-stdin Authorization
wisp connectors enable chatstore --project .
wisp permissions allow-connector chatstore --project .
wisp permissions get --project .
```

The read tools are now silent. Leave every send-class tool alone: with no Rule of its own,
under `policy`, it is refused — which is the behaviour the SOP above depends on.

## 3. The first signal, from the CLI

```sh
wisp run --skill open-case "$(cat alert.json)" --json > case.json
SESSION=$(jq -r .sessionId case.json)
jq -r .output.text case.json
```

Without `--json` the answer goes to stdout and the Session's id to stderr, so a pipe gets
the answer alone.

## 4. The next signal is another Run on the same Session

```sh
wisp run "$SESSION" "the error rate dropped to 2% after the rollback" --key "incident-4711:evt-8823"
```

`--key` is the signal's own id. When the thing that called you retries — and an at-least-once
caller will — the repeat meets the Run it already started instead of running the turn twice.

## 5. The same thing, the way the adapter does it

Your adapter does not shell out. It reads the Runtime's address and token where the CLI
reads them, and makes two calls per signal:

```sh
URL=$(jq -r .url ~/.wisp/runtime.lock)
TOKEN=$(jq -r .token ~/.wisp/runtime.lock)

# origin → externalKey → Session: every signal for this incident lands on one Session
SESSION=$(curl -sS "$URL/v1/sessions" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d "{\"projectRoot\":\"$HOME/agents/incidents\",\"origin\":\"cli\",\"externalKey\":\"incident:4711\",\"title\":\"incident 4711\"}" \
  | jq -r .id)

# message → Run: the connection is held until the Run ends
curl -sS "$URL/v1/sessions/$SESSION/runs" \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"input":"grafana: latency p99 back under 400ms for 10 minutes","idempotencyKey":"incident-4711:evt-8824"}' \
  | jq
```

The first call answers `201` the first time and `200` for every signal after. The second
answers the outcome:

```json
{ "runId": "…",
  "status": "completed",
  "output": { "text": "Latency has recovered…\n\nDraft for #ops: …" },
  "toolCalls": [ { "name": "mcp__chatstore__read_thread", "ok": true, "durationMs": 380 },
                 { "name": "mcp__chatstore__post_message", "ok": false, "durationMs": 1 } ],
  "usage": { "inputTokens": 8122, "outputTokens": 311, "totalTokens": 8433 },
  "artifacts": [] }
```

`outcome → send`: the draft is in `output.text`, and your adapter posts it, as the side that
owns the channel. The refused `post_message` is the design working rather than a fault — no
Rule allows it, so the `ask` became a deny, the agent was told, and it drafted instead.

## 6. What an operator sees afterwards

```sh
wisp sessions list          # the Sessions this folder has
wisp audit "$SESSION"       # every tool call: when, which, ok, how long, and the decision
```

The audit rows never carry what a tool sent or received, which is what makes them safe to
read and to ship somewhere else.

## 7. A restart in the middle

Stop the Runtime while a Run is live and the caller's connection closes: there is no durable
Run record in phase 1. The Session's history is on disk, so nothing is lost but the answer —
resend the signal with the same key once `wisp status` says `ready`. After a restart the key
map is empty, so that resend starts a new Run; that is the at-most-once promise stated
honestly, and [Runs and restarts](./runs-and-restarts.md) has the rest of it.

What stayed on your side throughout: the alert source, the incident id, the retry, the
sending. What stayed on the Runtime's: the Session, the SOP, the tools, the Rules and the
audit.
