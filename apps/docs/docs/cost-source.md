---
title: Cost source
sidebar_position: 7
---

# Cost source

The Cost view shows what your agents spend per day, split by agent and model: estimated cost, tokens, cache hit rate and the top agents. A cost chip in the header shows the estimated cost so far today. Both stay hidden until a cost source is connected, and they never show a guessed number.

Every dollar figure is **estimated, at API list price**. That's the price the API would charge for the same tokens, not what a subscription plan bills. Token counts are exact.

Cost needs the [history store](./optional-views.md), because the reports are kept in Postgres. Without `DATABASE_URL` there is no Cost view and no cost source.

## OpenTelemetry

Each Claude Code agent sends its own token and cost reports straight to the dashboard over OpenTelemetry (OTLP/HTTP). No key leaves the machine the agents run on. It works for Claude Code agents only, for now.

1. **Sign in as the owner** ([Owner sign-in](./owner-sign-in.md)). Only the owner can connect a cost source.
2. **Create an ingest token** in **Settings → Sources**. Agents send it with every report, so nobody else who can reach the dashboard can post numbers. It's shown once: copy it before you leave the page. The dashboard keeps only its hash.
3. **Add this to each agent's environment** in Buzz Desktop, then restart the agent. Settings → Sources shows the block with your dashboard's address filled in, and with the token right after you create it.

```sh
CLAUDE_CODE_ENABLE_TELEMETRY=1
OTEL_METRICS_EXPORTER=otlp
OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
OTEL_EXPORTER_OTLP_ENDPOINT=https://<your dashboard>/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <your ingest token>
OTEL_RESOURCE_ATTRIBUTES=agent=<agent name>
```

The agent name must match the agent's Buzz display name, so its cost joins the right agent. A report without it shows as "Unattributed".

Agents must be able to reach the endpoint. Claude Code exports every minute, so the first numbers show up a minute or so after an agent's first turn. The Agents table in Settings → Sources lists each agent with its last report, and flags any agent that hasn't reported in the last hour.

### What the dashboard reads

The endpoint (`/otlp/v1/metrics`) takes two Claude Code metrics and ignores the rest:

- `claude_code.cost.usage`: the estimated cost of each API request, by model.
- `claude_code.token.usage`: input, output, cache read and cache creation tokens, by model.

It keeps the agent name, the model, the token type and the amount. It doesn't store any other attribute, such as the session id, account or email; it only uses them, hashed, to tell two reports at the same moment apart. Reports older than `HISTORY_RETENTION_DAYS` are deleted with the rest of the history.

Claude Code sends delta values by default. Leave `OTEL_EXPORTER_OTLP_METRICS_TEMPORALITY_PREFERENCE` unset: the dashboard ignores cumulative reports, since counting them would add the same spend again on every export.

### The ingest token

- A report without a valid token gets a `401` with no detail. The token only lets an agent post metrics. It can't read anything.
- **Rotate** in Settings → Sources makes a new token and stops the old one at once. Every agent's reports stop until you paste the new token into its environment.
- If you lose the token, rotate it. It can't be shown again.

## One cost source at a time

The opt-in owner signer (NIP-46), which reads the per-turn reports Buzz already publishes, will be the other choice. Settings → Sources keeps the two to one at a time, so the numbers never double-count.

## Not per issue

Cost is per agent, per model and per day. It isn't per issue: a report knows which agent and model it came from, not which issue the agent was working on. Cost per channel needs per-turn reports, which OpenTelemetry doesn't send, so it shows as not connected.
