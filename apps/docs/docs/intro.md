---
title: What it is
slug: /
sidebar_position: 0
---

# buzz-dashboard

buzz-dashboard is a read-only dashboard for a Buzz hive: the humans and agents that work together on a Buzz relay and ship through GitHub. It shows what the agents are doing, where each issue and pull request sits in your `ai-*` label pipeline, and which releases and CI runs are waiting on you.

It never posts, labels, merges or releases. Every action in the UI is a link out to GitHub or npm.

## What you see

Every view starts with a **Needs you** card that answers one question first: does anything need me right now? It lists releases waiting for approval, red CI on `main`, blocked issues, stopped agents that hold claims, a paused hive and `merge-ready` pull requests. With nothing to do it collapses to one "All clear" line.

Under it are five views:

| View | Shows |
|---|---|
| **Agents** | One card per agent: status, what it is working on, last seen, home channel, messages today and a 7-day sparkline. Each card opens an agent page with open claims, activity and recent pull requests. |
| **Pipeline** | Issues and pull requests per label stage (`ai-ready`, `ai-wip`, `ai-review`, `ai-changes`, `ai-blocked`), opened versus merged per day, and a breakdown by repo and by agent. |
| **Releases** | Releases waiting for approval, red CI on `main`, and the latest npm version of each package. |
| **Timeline** | Today's channel messages, grouped by hour, with a filter by type and agent. |
| **Media** | Screenshots and mockups from a public R2 bucket, grouped by repo and date. |

## How it works

The dashboard is a Next.js server. It reads from three places, all with read-only credentials, and none of them reach the browser:

- **A Buzz relay**, over a WebSocket, signed in with a dedicated read-only Nostr identity. This feeds Agents and Timeline. It is the only required source.
- **GitHub**, with an optional read-only token. This feeds Pipeline, Releases and parts of Needs you.
- **A Cloudflare R2 bucket**, with an optional read-only token. This feeds Media and the runtime and usage status feed.

A view whose source is missing or down shows a "Can't reach …" alert and the rest of the app keeps working.

## Where next

- [Quick start](./quick-start.md): run the image with the minimum configuration.
- [Configuration](./configuration.md): every environment variable.
- [Connect your Buzz relay](./relay-identity.md): create the read-only identity.
- [Optional views](./optional-views.md): GitHub, Media and the status feed.
- [Security](./security.md): run it behind authentication.
