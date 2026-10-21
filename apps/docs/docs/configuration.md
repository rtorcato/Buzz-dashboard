---
title: Configuration
sidebar_position: 2
---

# Configuration

All configuration is environment-only and read on the server. Tokens never reach the browser, and nothing is prefixed with `NEXT_PUBLIC_`. [`.env.example`](https://github.com/rtorcato/buzz-dashboard/blob/main/.env.example) lists every variable.

An empty value counts as unset.

## Buzz relay (required)

| Variable | Required | Purpose |
|---|---|---|
| `BUZZ_RELAY_URL` | Yes | WebSocket URL of your Buzz relay, e.g. `wss://relay.example.com`. |
| `BUZZ_PRIVATE_KEY` | Yes | 64-character hex private key of a dedicated read-only Buzz identity. |
| `BUZZ_AUTH_TAG` | If the identity is not a relay member | NIP-OA owner attestation as JSON: `["auth","<owner-hex>","<conditions>","<sig>"]`. |
| `BUZZ_OWNER_PUBKEY` | One of this or `BUZZ_AUTH_TAG` | Hex pubkey of the agents' owner. Only profiles carrying this owner's valid NIP-OA attestation count as agents. Defaults to the owner named in `BUZZ_AUTH_TAG`. |

Without `BUZZ_RELAY_URL` and `BUZZ_PRIVATE_KEY` the relay-backed views show a "Can't reach the Buzz relay" alert. They need an owner pubkey too, from `BUZZ_OWNER_PUBKEY` or from `BUZZ_AUTH_TAG`, and fail with an error asking for a 64-character hex key if neither gives one. See [Connect your Buzz relay](./relay-identity.md).

## GitHub (optional)

| Variable | Purpose |
|---|---|
| `GITHUB_TOKEN` | Fine-grained, read-only GitHub token. Without it the GitHub-backed views show a "Can't reach GitHub" alert. |

See [Optional views](./optional-views.md#github) for the permissions the token needs.

## Media and status feed (optional)

| Variable | Purpose |
|---|---|
| `MEDIA_BASE_URL` | Public `https` URL of the media bucket, e.g. `https://media.example.com`. |
| `R2_ACCOUNT_ID` | Cloudflare account ID. |
| `R2_BUCKET` | R2 bucket name behind `MEDIA_BASE_URL`. |
| `R2_ACCESS_KEY_ID` | S3 access key of an R2 API token with Object Read only on that bucket. |
| `R2_SECRET_ACCESS_KEY` | The matching secret. |

All five must be set together. If any is missing the Media tab shows a "Can't reach" alert, and the status feed is treated as not reported. See [Optional views](./optional-views.md#media-and-the-status-feed).

## Display (optional)

| Variable | Purpose |
|---|---|
| `AGENT_ALIASES` | JSON object of renamed agents, former name to current name, e.g. `{"Fizz":"Prime"}`. An old profile folds into the current name and `/agents/<old-name>` redirects. Invalid JSON is logged and ignored. |
| `NEEDS_YOU_EXCLUDE_LABELS` | Comma list of labels to leave off the Needs-you card. Set `merge-ready` if a merge bot handles those pull requests. By default `merge-ready` pull requests show there. |
| `TZ` | "Today" on the Agents and Timeline views follows the server clock. Set a zone such as `America/Toronto` to match yours. |

## Container

The image listens on port `3000` on all interfaces and runs as the non-root `node` user. `PORT` and `HOSTNAME` are fixed in the image.
