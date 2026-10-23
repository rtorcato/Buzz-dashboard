---
title: Alerts
sidebar_position: 8
---

# Alerts

Settings → Alerts sends what Needs you shows to a channel of your choice, so you hear about a failing agent or a PR waiting on you without keeping the dashboard open. Alerts need the history database (`DATABASE_URL`), and only the signed-in owner can change them (see [Owner sign-in](./owner-sign-in.md)). Signed out, the tab is read-only.

## Channels

| Channel | What to paste |
|---|---|
| ntfy | The topic URL, e.g. `https://ntfy.sh/your-topic` or one on your own ntfy server. |
| Slack-compatible webhook | An incoming webhook URL. Works with Slack and Mattermost, and with Discord if you add `/slack` to the end of the Discord webhook URL. |
| Webhook | Any URL that accepts a JSON `POST` of `{ "alert", "title", "detail", "url" }`. |

Use **Send test** to check a channel. A URL is stored encrypted with a key derived from `BUZZ_PRIVATE_KEY` and is only ever shown shortened, so changing that key means adding the channels again. URLs with a user name or password in them are refused. Put the token in the path or query instead.

Email and Buzz DM channels are not available yet.

## Rules

Each rule can be turned off, sent to some channels only, and (where it has a number) tuned by clicking its name.

| Alert | When | Repeat |
|---|---|---|
| Agent failing turns | Over 25% errors for 15 min | Hourly until it clears |
| PR ready to merge | After 2h with `merge-ready` | Once |
| Silent while holding a claim, Release waiting for approval, Issue blocked, Agent over budget | Not watched yet | |

The last four rules can already be set, but they won't fire until Needs you reads those items. An alert that clears starts over if it comes back. When `AUTH_PUBLIC_URL` is set, each alert links to the view it came from.

**Quiet hours** hold every alert except failing agents from 10 PM to 8 AM, on the server's clock. Set `TZ` (for example `TZ=America/Toronto`) so that matches yours. Held alerts go out once quiet hours end, if the item is still there.

The dashboard checks the rules once a minute.

## Snooze and acknowledge

Signed in as the owner, each Needs you row that can alert has two buttons that open a "Stop alerting me about this" menu:

- **For 1 hour**, or **Until tomorrow** (9:00 AM): alerts on that row stop on every channel until then.
- **Until it changes** (ack): alerts stop until the item clears. If it comes back later, it alerts again.

The row stays on the page, dimmed. A new item in the same row, such as one more PR ready to merge, still alerts, so a snooze never hides something that got worse. Snoozes are kept in the history database, like the rest of Alerts.
