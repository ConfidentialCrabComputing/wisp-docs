---
description: What your plan pays for, what the prepaid balance pays for, and how to top it up from the terminal.
---

# Plan and balance

Your Wisp account has two ways to pay for the model:

- **The plan**, your subscription. It has daily, weekly and monthly (cycle) allowances that
  reset on their own.
- **The balance**, prepaid money in dollars that you add yourself. Wisp Desktop calls it
  **usage credits**. It does not expire.

Both belong to the account, not to a machine. Money you add on your laptop pays for a
Runtime on your server too, as long as both are signed in to the same account.

## What pays for what

Every Run is on one of two sides, depending on how it reached the Runtime:

| Desktop side | Terminal side |
| --- | --- |
| A chat in Wisp Desktop, a recording's transcript | `wisp run`, `wisp retry`, `wisp confirm` |
| A schedule that fires in Wisp Desktop's Runtime | Your own code calling the `/v1` API |
| | The [Telegram bot](./telegram-bot.md) and the [Slack app](./slack-app.md) |
| | Anything on a `wisp serve` Runtime (a server), schedules included |

**The desktop side** is paid from the plan. When one of its windows runs out, the chat stops
until the window resets. If you turn on **Use credits after a plan limit** (Settings → Usage in
Wisp Desktop), it carries on from the balance instead.

**The terminal side** is paid from the balance alone when Wisp bills terminal Runs that way.
Then the plan does not pay for anything there, and `wisp billing status` shows no plan lines.
Otherwise it is paid exactly like the desktop side.

Everything a Run causes is paid the same way as the Run: its subagents, the Skills it runs,
the memories it saves afterwards, and the [Auto Mode](./permissions.md#auto-mode) reviewer
that checks its tool calls.

A few cases that surprise people:

- **`wisp run` on a Mac with Wisp Desktop open** runs inside the app's Runtime, and it is still
  on the terminal side.
- **Wisp Desktop [connected to a server](./desktop/connect-to-a-server.md)** works with a
  `wisp serve` Runtime, so everything it does there is on the terminal side.
- **A job made with `wisp schedules` on a Mac with Wisp Desktop open** fires in the app's
  Runtime, so it is on the desktop side, like a job made in the app.

## Check where you stand

```sh
wisp billing status
# plan         Pro
# daily        12% used, resets 2026-10-29T00:00:00Z
# weekly       40% used, resets 2026-11-02T00:00:00Z
# cycle        55% used, resets 2026-11-15T00:00:00Z
# balance      $8.40
# auto-reload  off
```

When terminal Runs are paid from the balance alone, `status` shows only the `balance` and
`auto-reload` lines, because the plan does not pay for anything `wisp run` does.

The balance can go slightly below zero: a request that ends up costing more than its estimate
is still finished, and the difference comes off the balance. Add money to bring it back up.

`--json` prints the whole answer, including `cliBalanceOnly` and the top-up limits.

## Top up

```sh
wisp billing topup 10
# https://checkout.…
# pay at this address; waiting for the payment (Ctrl-C stops the wait, not the payment)
# paid: $10.00 added to the balance
```

The amount is in dollars, like `10` or `12.50`. Billing sets the smallest and the largest
top-up, and the command tells you both if you go outside them. Tax may be added on the payment
page.

`topup` prints the payment link and never opens a browser itself, so it works the same over
SSH: open the link on any device and pay there. The command then waits until the payment is
done and says how it ended:

- `paid`: the money is on the balance. The exit code is `0`.
- `failed`: the payment did not go through, and nothing was added.
- `expired`: the link was not paid in time, and nothing was added.

Ctrl-C only stops the wait. If you pay after that, the money still arrives; check it with
`wisp billing status`.

In Wisp Desktop, top up in Settings → Usage → **Usage credits**.

## Auto-reload

Auto-reload adds money for you when the balance runs low:

```sh
wisp billing auto-reload --threshold 5 --target 20
# auto-reload  on: below $5.00 it tops up to $20.00
```

When the balance drops below `--threshold`, your card is charged enough to bring it back to
`--target`. The target must be above the threshold by at least the smallest top-up.

- `--monthly-limit <usd>` caps how much auto-reload may add in any 30 days. Tax is charged on
  top and does not count toward it. Without the flag there is no cap.
- `--off` turns auto-reload off.

Auto-reload charges a saved card, so it needs one first: run `wisp billing topup` once and
choose to save the card on the payment page.

If auto-reload stops by itself, `wisp billing status` says why and, when there is one, prints
a link to fix it:

| Status | What happened | What to do |
| --- | --- | --- |
| `needs attention` | your bank asked to confirm a charge | open the link, or run `wisp billing topup`, then turn auto-reload on again |
| `failed` | the card was declined | top up through the link or with `wisp billing topup`, then turn auto-reload on again |
| `paused` | it reached its `--monthly-limit`, or the most charges allowed for now | nothing: it stays on and resumes by itself once the 30 days leave room. Top up by hand meanwhile |
| `not available yet` | auto-reload is not switched on for Wisp yet | top up by hand |

## When a Run stops for money

A Run that the plan or the balance cannot pay for fails with the reason `quota_exhausted`.
The same reason covers both cases, and the message says which one it was:

- **The balance is used up.** When terminal Runs are paid from the balance alone, `wisp run`
  (and `wisp retry`, `wisp confirm`) then prints the balance and the command to add to it, on
  stderr and not with `--json`:

  ```
  balance $0.00; wisp run is paid from the balance: wisp billing topup 5
  ```

  The Telegram bot and the Slack app say the same in the chat: "The balance is used up, so the
  run stopped. Top it up with `wisp billing topup 5`." They never show the balance itself,
  because the chat may be shared. A schedule's fire posted to a chat is told only the plain
  failure.
- **A plan window ran out.** The message names the window (daily, weekly or cycle). It comes
  back when the window resets, which `wisp billing status` shows, or sooner with **Use credits
  after a plan limit** on.

Top up and run [`wisp retry <run>`](./cli.md#retrying-safely) to try again.

Other billing reasons are in [Troubleshooting](./runbook.md#why-a-run-failed).

## The agent cannot spend your money

[Auto Mode](./permissions.md#auto-mode) never lets the agent run `wisp billing` on its own: such
a `bash_run` call always goes to you to approve, and a Run with nobody to ask refuses it.

## From your own code

The same four operations are on the `/v1` API: `GET /v1/billing/me`, `POST /v1/billing/topups`,
`GET /v1/billing/topups/{id}` and `PUT /v1/billing/payg-settings`. The last one also sets
`spendAfterLimit`, the **Use credits after a plan limit** switch, which has no `wisp` command.
See the [reference](./reference.md#the-account).
