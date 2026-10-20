---
description: Run a prompt on a clock — make a job with wisp schedules, post its answers to Telegram or Slack, or ask the agent to make one from a chat.
---

# Schedules

A **schedule** is a job: a message the Runtime sends to the agent on a clock. Each time it
fires, the Runtime opens a fresh Session with origin `schedule` and starts a Run in it, as any
`/v1` caller would. The answer is kept as the job's last outcome and, if you ask, posted to a
Telegram or Slack chat.

The Runtime must be running for anything to fire. The routes are in the
[reference](./reference.md#schedules).

## Make a job

`wisp schedules create` takes a `--name`, exactly one time spec, and the message in quotes. It
prints the job's id.

```sh
# every weekday at nine
wisp schedules create --name standup --cron "0 9 * * 1-5" "summarise yesterday's commits"

# every two hours, counted from now
wisp schedules create --name inbox --every 2h "anything urgent in my mail?"

# once
wisp schedules create --name dentist --at 2026-11-01T09:00:00+01:00 "remind me of the dentist at ten"
```

- **`--cron`** is a five-field cron expression: minute, hour, day of month, month, day of
  week. A sixth field, seconds, is refused.
- **`--every`** is a whole number of minutes, hours or days: `30m`, `2h`, `1d`. It counts
  from when the job is made, or from when its time spec is changed.
- **`--at`** is one ISO 8601 instant with its offset, such as `2026-11-01T09:00:00Z`. One
  already gone by is refused.

A spec that never fires, such as 31 February, is refused when you make the job, not at night.

Over HTTP, an interval of days can also name a time of day: `{ "every": "2d", "time": "09:00" }`
fires at nine every second day, in the job's zone as a cron job's is (see below), and stays at
nine across a change of clock. `time` goes with days only, up to `366d`; `wisp schedules create`
has no flag for it.

More flags for `wisp schedules create`:

| flag | what it does |
| --- | --- |
| `--project <path>` | each fire's Session opens on this folder; without it, on the Desk |
| `--skill <name>` | each fire runs this Skill, the message its arguments (`/<skill> <message>`) |
| `--output-schema <file>` | a JSON Schema each fire's answer must match, as for [`wisp run`](./reference.md#wisp-run) |
| `--deliver <key>` | post each outcome to this chat — see [Posting to a chat](#posting-to-a-chat) |

## Time zones

A `--cron` job runs in a time zone:

1. the one `wisp schedules create --cron "<expr>" --tz Europe/Berlin` names;
2. otherwise the user's time zone, from [`/v1/timezone`](./reference.md#rules-skills-and-the-audit);
   Wisp Desktop sets it on every connect;
3. otherwise the host's.

The zone is written into the job when it is made, so the job keeps its clock wherever the
Runtime runs later. `--tz` goes with `--cron` only: `--every` and `--at` need no zone. Over
HTTP, the zone is the `schedule`'s `timezone`.

## Managing jobs

```sh
wisp schedules list            # id, name, next instant, how it last ended
wisp schedules pause <id>      # stop it firing
wisp schedules resume <id>     # let it fire again
wisp schedules run <id>        # fire it now and print the Run's id
wisp schedules remove <id>     # delete it
```

- `wisp schedules list` shows `next <instant>`, or `paused`, or `done` for a one-off that
  fired, then the last outcome with its Run's id, or `never fired`. `wisp schedules list --json`
  prints the jobs whole.
- A recurring job you resume counts on from now, so a long pause is not a missed fire. A
  one-off keeps its instant.
- `wisp schedules run` fires off the clock: the next instant stays where it was. Read the
  answer with `wisp runs show <run id>`.
- A fire already going when you remove its job runs on.

There is no `wisp schedules` command to edit a job; change one with
`PATCH /v1/schedules/{id}` or from a chat. A `PATCH` replaces the fields it names, and `null`
clears an optional one such as `deliver`.

## Posting to a chat

Without `--deliver`, a job's answers are kept only as its last outcome and in its Runs. With
it, the [Telegram bot](./telegram-bot.md) or the [Slack app](./slack-app.md) posts each
outcome to that chat:

```sh
wisp schedules create --name standup --cron "0 9 * * 1-5" --deliver telegram:123456789 "summarise yesterday's commits"
```

The key's prefix names the Channel:

- `telegram:<chat id>`, or `telegram:<chat id>:<topic id>` for a forum topic;
- `slack:<DM id>`, `slack:<channel id>` or `slack:<channel id>:<thread ts>`;
- `desktop`, Wisp Desktop, which shows each outcome as a system notification.

A Telegram or Slack key may end with `@<bot id>` (Telegram's numeric bot id, Slack's bot user
id): only that bot posts the outcome. Without it, every bot of the Channel running on the
Runtime does.

The bot and the app print the owner's key, with their own id, when they start: "Outcomes reach the owner with
--deliver …". The Runtime sends nothing itself: the bot or app picks the outcome up, so it must
be running. An outcome that settles while it is down is posted once it is back.

Over HTTP, `deliver` is `{ "channel": "telegram", "externalKey": "telegram:123456789" }`.

Wisp Desktop reads its outcomes from `GET /v1/fires?channel=desktop&settledAfter=<sequence>`:
each settled fire of a job addressed to it, oldest first, with the job's name, the instant,
the outcome, the first line of the answer and the fire's `sequence`, which the next request
passes as `settledAfter`.

## Asking the agent from a chat

In a chat you can just ask: "every weekday at nine, summarise yesterday's commits". The agent
turns that into a time spec and calls its schedule tools:

| tool | default |
| --- | --- |
| `schedule_create` | `ask` |
| `schedule_update` | `ask` |
| `schedule_delete` | `ask` |
| `schedule_list` | `allow` |
| `schedule_pause` | `allow` |

- **Create, change and delete always ask.** Every call is a Prompt, even with an `allow` Rule
  or a Project's bypass: a job outlives the Run that made it. The card shows the whole job:
  its message, its time spec, the folder it runs on and the chat it posts to.
- **Only where someone can answer.** The tools are offered only to an `interactive` Run, such
  as a chat with the Telegram bot or the Slack app. A Run under `policy`, a fired job's own
  included, does not see them, so a job cannot plant more jobs.
- **A job made in a chat posts back to that chat.** The agent cannot name another one. Each
  fire opens on the conversation's Project, or on the Desk when it has none. A job made in a
  Wisp Desktop chat notifies the desktop. A job made where there is no chat to post to, such
  as `wisp run --interactive`, is kept as its last outcome only, and the agent says so.
- **A job belongs to its chat.** In a chat, the agent sees, changes and deletes only the jobs
  that post to that chat. Everyone let in to that chat manages them as their maker would: in
  a Telegram group, the key is the group, not the person. Let people in to a chat that holds
  jobs knowing that.

## What a fire sees

Each fire's message is the job's own, with a few lines from the Runtime after it:

- **A word on silence.** "This is a scheduled run. If there is nothing worth sending, answer
  exactly `[SILENT]` and nothing else." An answer whose first or last line is `[SILENT]` is
  not posted to the chat. Use it for jobs like "tell me if anything is stuck": quiet runs stay
  quiet. A job with an `outputSchema` is not told this: its answer is the structured value.
- **The previous answer.** Once the job has completed with an answer, the next fire gets that
  answer, up to its first 8000 characters, so it can say what changed. It reaches the agent
  marked as a third party's, as data rather than an instruction: it may quote a mail or a page
  the previous fire read. A `[SILENT]` answer, an empty one, or a failed fire does not replace
  it.
- **No one to ask.** A fire runs under `policy`: a tool whose decision is `ask` is refused,
  not asked. [Allow](./permissions.md) what the job needs, in its Project when it has one. A
  fire refused a tool this way is recorded as `failed` whatever it answered, and its chat is
  sent "Needs `<tool>` allowed to run unattended…", with the `wisp permissions set` to run, in
  place of the answer.

A fire's Session is kept for `runRecordRetentionMs` (7 days) after it was last touched; then a
daily sweep deletes it, with its messages, its audit and the memories it stored. A Session
someone has open, or whose Desk folder still exists, is kept.

## When a fire is skipped

- **Fires of one job never overlap.** An instant that comes while the job's previous fire is
  still queued or running is skipped, and `lastOutcome` counts it as `skipped`. A one-off
  waits for the previous fire to end instead.
- **The clock is checked every 15 seconds**, so a fire can start up to 15 seconds after its
  instant.
- **A job that can no longer be timed is paused.** If its next instant cannot be worked out,
  for instance a time zone the host no longer knows, the Runtime pauses it and records the
  outcome as `failed`. Change its time spec, then resume it.
- **A fire that cannot start is recorded as `failed`**, for instance when its Project folder
  was deleted. The job stays as it is and tries again at its next instant.
- **While the Runtime is down, nothing fires.** What happens on the way back, and how a
  restart never fires one instant twice, is in
  [Scheduled Runs and restarts](./runs-and-restarts.md#scheduled-runs-and-restarts).

Your own scheduler, such as cron calling `wisp run`, works too: see
[A scheduler is an adapter too](./adapter-contract.md#a-scheduler-is-an-adapter-too).
