# DESIGN.md

The design spec for buzz-dashboard. Read it before writing any UI code, and keep the UI in step with it. If the UI needs to change, update this file and the mockups in the same PR.

- **Status:** v1, approved by rtorcato on 2026-10-07. UI PRs can build against it.
- **Designer:** Zoey (2026-10-07)
- **Update:** runtime status (#24), the usage meter (#25), the agent page (#27) and Motion, approved by rtorcato on 2026-10-16. They read the status feed (#26), so build them after it.
- **Update:** the fixed sidebar and the Settings page (#58), approved by rtorcato on 2026-10-21.
- **Update:** the docs site home page (see Docs site), approved by rtorcato on 2026-10-22.
- **Mockups:** kept outside the repo and not linked from it. This file is the spec, so build from the text below.

## Principle

It's a glanceable ops screen, and it answers one question first: **"does anything need me right now?"** The **Needs you** card sits above every view and is never hidden behind one. Everything else is detail.

The app is read-only. Every action is an outbound link to GitHub or npm, marked with the `external-link` icon. No button writes anything.

## Shell (every view)

- **Sidebar** (#58): see Sidebar below. It holds the Hive mark, the views and Settings.
- **Header** (`h-14`, sticky, inside `SidebarInset`): the `SidebarTrigger`, a 1px divider and the current view's title, then on the right the **usage chip** (below), the freshness line ("Updated 14s ago" with a green dot) and Refresh as a ghost icon button (`size-9`). The mark, "Read-only" and the theme toggle leave the header: the first two move to the sidebar, and the theme lives in Settings.
- **Usage chip** (#25): it sits to the left of the freshness line, with a 1px divider between them. It is a `h-9` bordered chip, focusable, that opens a `Tooltip` on hover or focus.
  - It holds two mini meters, `5h` and `7d`, each a `w-12 h-1.5` track with a fill and the % in `tabular-nums`. A 1px tick marks a threshold. On 5h the tick is the pause line, from the status feed (`five_h_pause_at`); with no threshold in the feed there is no tick. On 7d it is the weekly budget, which is the % of the week elapsed + 10.
  - **Normal:** a `gauge` icon and a neutral fill (`foreground/60`).
  - **7d over budget** (7d past its tick, not paused): the 7d fill and % turn `warning`, followed by `trending-up` and "Over budget".
  - **Paused** (the feed says `paused`): the chip gets a `warning` border and a 10% tint, and leads with `circle-pause` and "Paused · resets 9:00 PM". The fill that tripped turns `warning`.
  - **Feed stale** (the status feed is more than 10 minutes old): dashed border, meters at 60% opacity, `clock-alert` and "as of 38m ago" in `warning`.
  - **Not reported** (no status feed yet): dashed border, `gauge` and "Usage not reported", muted.
  - **Tooltip:** a title, then 5-hour (% · pauses at X% · reset time), Weekly (% · budget % · pauses at Y%), where each "pauses at" comes from the feed and is left out when the feed has none, a muted line explaining the budget with the weekly reset, and "Reading 2m ago, from the status feed".
  - **Phone:** the chip shrinks to its icon plus "78% · 61%". Tapping it opens the same detail.
- **Needs you** (`Card`): one row per item type, oldest first, each linking to its view.
  - A release waiting for approval: `warning`, rocket icon.
  - Red CI on `main`: `destructive`, circle-x icon.
  - `ai-blocked` issues: `destructive`, octagon-alert icon.
  - An agent stopped with open claims (#24): `destructive`, `power-off` icon. "Agent stopped with open claims", then the name, how long it has been stopped and the claim keys in mono. It links to Agents.
  - Paused for usage (#25): `warning`, `circle-pause` icon. It names the limit that tripped ("5h window at 92% (pauses at 90%)", without the parenthesis when the feed has no threshold) and the reset time with a countdown ("resets 9:00 PM, in 1h 20m"). It links to Agents, since usage has no view of its own. Amber, not red, because it clears by itself at reset.
  - A muted "Heads-up" footer line that isn't counted: an agent has held a claim but been quiet for more than 2 hours, or the status feed is stale ("Runtime feed is 38m old (is the runtime host asleep?)").
  - With zero items, the card collapses to one green "All clear" line (see States).
  - Open `merge-ready` PRs: neutral (`border-border bg-muted text-foreground`), `git-merge` icon. A merge-ready PR is waiting on a click, not a fault, and green would read as cleared. "2 PRs ready to merge", then the repo#number keys. It links to Pipeline. For most deployments they wait on the owner; one with a merge bot hides the row with `NEEDS_YOU_EXCLUDE_LABELS=merge-ready`.
- **Needs you** stays above every view, at the top of the main column. Settings is the one page without it, because the sidebar counts already show.

## Sidebar (#58)

The `ViewTabs` pill row goes. Use the stock shadcn `Sidebar` with `collapsible="icon"`, wrapped in `SidebarProvider` with `SidebarInset` for the page.

- **Top** (`SidebarHeader`): the 32px Hive mark tile, "Hive" (semibold) and "buzz-dashboard" (muted, 12px) under it. It links to `/`.
- **Views** (`SidebarGroup` labelled "Views"): Agents, Pipeline, Releases, Timeline and Media, as `SidebarMenuButton` links with their lucide icons (`bot`, `git-pull-request`, `rocket`, `activity`, `images`). The current route gets `isActive`.
- **Counts:** a view that owns Needs-you items shows its count in a `SidebarMenuBadge`, as a red pill (same data as `countsByView`). In light mode the pill text is `red-700` on the `destructive/15` tint (about 4.9:1). Plain `text-destructive` is about 3.6:1 there and fails AA, which also fixes the old tab pills.
- **Bottom** (`SidebarFooter`): a muted "Read-only" line with the `eye` icon (not a link), then Settings (`settings` icon, `/settings`) as a menu button.
- **Collapsed to the icon rail:** each item shows its icon only. A count becomes a 6px red dot on the icon's top-right corner, and the item's `Tooltip` names it: "Pipeline · 3 need you". Items with no count just show their name. The tooltip opens on hover and on keyboard focus.
- **State:** the sidebar's own cookie remembers expanded or collapsed, and ⌘B / Ctrl+B toggles it (both are shadcn defaults). There is no "collapsed by default" setting.
- **Phones** (below `md`): the sidebar becomes a `Sheet` from the left, opened by the menu trigger in the header. Rows are at least 44px tall. Picking a view closes the sheet, and Esc or the close button closes it too.

## Views

| View | Components |
|---|---|
| **Agents** | 4 stat `Card`s (the first is **Running 12 / 14**, with the stopped names as its subline), then a `ToggleGroup` filter (All, Active, Quiet, Stopped) and a `Select` sort, then a `Card` grid (1, 2 or 3 columns). Each card shows `Avatar` (the profile picture, initials as fallback), name, role, a status `Badge`, the **runtime row** (see Runtime status), "Working on" (latest message), last seen, home channel, messages today, and a 7-day sparkline (`BarChart` with no axes). The whole card is one link to the agent page. The "needs attention" sort puts stalled agents first, then quiet ones, and parked agents last. |
| **Pipeline** | 5 stage stat `Card`s (`ai-ready` … `ai-blocked`, with mono labels). Then a `BarChart` of PRs opened vs merged per day (chart-1 and chart-2, with legend and tooltip), filtered by a `Select` for agent and a `ToggleGroup` for 7d, 14d or 30d. Then a `Table` by repo, with blocked repos first and the ready/wip/review columns hidden on phones. Last, a `Table` by agent, taking the agent from the PR body's `@Name` header. PRs without that header go under "Unattributed". |
| **Releases** | A "Waiting for your approval" `Card`, one row per release: repo, version `Badge`, commit subject, how long it has waited (`Badge`), and an outline "Review on GitHub" `Button`. A "Red CI on main" `Card`, one row per failure: repo, job, SHA, how long it has failed (`Badge`), and "View run". Last, a `Table` of npm packages: version and publish date, plus a "Release pending" badge when `main` has unreleased commits. |
| **Timeline** | A `BarChart` of events per hour today (chart-3, with the current hour in chart-1) and 2 stat `Card`s. Then a live-feed `Card` with a `ToggleGroup` type filter and a `Select` for agent. Rows are grouped by hour under sticky headers. A row that needs the owner gets a 5% status tint and a "Needs you" `Badge`. |

## Runtime status (#24)

Each Agents card gets a row between its header and "Working on", in a bordered `rounded-md` box, `text-xs`.

- **Left:** the runtime state.
  - **Running:** a green 8px dot, "Running" in `success`, then "· up 6h 12m" muted.
  - **Stopped:** an 8px square (`rounded-[2px]`), "Stopped", then "· 3h ago" muted.
  - **Not reported:** `circle-help` and "Runtime not reported", muted.
- **Right:** "Last turn" muted, then the time in foreground.
- **One status badge,** ranked Stopped > Quiet > Active > Idle.
  - **Stopped with open claims:** a destructive `Badge` (`power-off`, "Stopped") and a `ring-1 ring-destructive/40` on the card. "Working on" becomes **"Stalled"** (destructive) with "Holds 2 claims: …" on a 10% destructive tint. It adds a Needs-you row.
  - **Stopped with no claims** (a parked agent): a muted `Badge` and the card at 80% opacity. It sorts last and is not a problem.
  - **Not reported** (no runtime in the status feed for this pubkey): the badge falls back to relay activity (Active, Idle, Quiet), as before.
- **Feed stale:** cards keep their last values and add "· as of 38m ago" in `warning` to the runtime row.

## Agent page (#27)

The route is `/agents/[name]`, where `name` is the lowercased display name with spaces as hyphens (`/agents/optimus-prime`). Renamed agents redirect from their old name (`/agents/fizz`). The shell (header, Needs you, sidebar) stays, with Agents active in the sidebar. It's still read-only, so every action is an outbound link.

- **Breadcrumb** (shadcn `Breadcrumb`): "← Agents › Bumble". The back link is a `h-9` target.
- **Stalled alert:** only when the agent is stopped with open claims. A destructive `Alert` with `power-off`: "Bumble stopped 3h 05m ago while holding 2 claims", then "Restart it from Buzz Desktop, or ask Prime to reassign the claims. This page is read-only."
- **Hero** (`Card`, with the stalled ring when it applies):
  - On the left, the `Avatar` at **176px** (`size-44`, `ring-1 ring-border`, `object-cover`). It shows the profile picture, with initials at `text-5xl` as the fallback.
  - On the right, stacked:
    - Name (`text-3xl font-semibold tracking-tight`) and the status `Badge`.
    - Role · `@Name` in PR headers (muted, with the handle in mono).
    - Outline "Open in Buzz" and "PRs" `Button`s (`external-link`) on the same row.
    - The runtime row, with "Last turn" and "Last seen" on its right.
- **Stats:** 4 stat `Card`s.
  - Messages today (with "47 this week").
  - PRs opened (7d) (with "4 merged").
  - Open claims, in `destructive` when the agent is stalled (with "oldest 3h 20m").
  - Median PR to merge (last 7 days).
- **Left column** (2 of 3 at `xl`):
  - **Open claims:** a `Table` of issue (key in mono, title muted under it), label (mono pill: `ai-wip` info, `ai-review` neutral, `ai-changes` warning, `ai-blocked` destructive), progress ("PR #23 · CI green" or "no PR yet"), how long it has been held, and an external link. The count pill is destructive when stalled and muted otherwise. When stalled, the subtitle reads "Held while the runtime is stopped. Nobody is working these." and the ages turn destructive. With no claims, the card shows a dashed "No open claims" box rather than hiding, so the layout doesn't jump.
  - **Activity:** a `BarChart` of messages per day, chart-3 with today in chart-1, plus a `ToggleGroup` for 7d, 14d or 30d.
  - **Messages:** the agent's messages, newest first, grouped by day under sticky labels. Each row has the time, a mono `#channel` chip, the text and an external link to the message. A `Select` filters by channel.
- **Right column:**
  - **Runtime:** a `dl` of State, Stopped at / Since, Last turn, Started and Model (mono), with a footer reading "From the status feed · as of 2m ago". When the agent isn't reported, it shows `circle-help` and "Not reported. The status feed has no runtime for this agent." with no red.
  - **Recent PRs:** the last 5 PRs whose body names `@Name` (the same attribution as Pipeline). Each row has a state pill (`open` info, `merged` success, `closed` muted), the title, the key in mono, the age and an external link, with an outline "All on GitHub" in the header.
  - **Where they talk:** messages per channel over the last 7 days, the top 5, as thin chart-3 bars with counts.
  - **Identity:** the npub truncated in mono with a copy `Button` (`size-9`), "Also seen as N older identities · formerly X", and the home channel.
- **States:**
  - **Loading:** `Skeleton`s that keep each card's height, hero and stats first.
  - **Unknown name:** a 404 with `user-x`, "No agent called “x”", "It may have been renamed or retired." and an outline "All agents" link.
- **Phone:** one column. Breadcrumb, then a compact alert, then the hero centred (a 112px avatar above the name, with the buttons as two 44px halves). Then the stats 2×2, then Open claims as a list with chevrons, and after that Runtime, Recent PRs, Activity, Messages, Where they talk and Identity.

## Status feed (#26)

The runtime and usage data come from one JSON file, object key `hive/status.json` in the media bucket, that a script on the operator's machine publishes every 5 minutes. The dashboard reads it on the server only, and it never contains secrets, env values or log contents.

```json
{
  "version": 1,
  "published_at": "2026-10-16T19:40:00Z",
  "runtime": {
    "<hex pubkey>": { "name": "Bumble", "state": "running", "since": "2026-10-16T13:28:00Z", "last_turn": "2026-10-16T19:36:00Z", "model": "claude-opus-5-5" }
  },
  "usage": {
    "five_h": 92, "seven_d": 61, "paused": true,
    "five_h_resets_at": "2026-10-16T21:00:00Z", "seven_d_resets_at": "2026-10-18T12:00:00Z",
    "five_h_pause_at": 90, "seven_d_pause_at": 95
  }
}
```

- `version` is the schema version, `1` today. The dashboard ignores a feed with a version it doesn't know and treats it as not reported.
- `runtime` is keyed by hex pubkey. `name` is the agent's display name when the feed was written; the page still takes the live name from the relay and uses `name` only as a fallback.
- `state` is `running` or `stopped`, and `since` is when it entered that state. Percentages are integers. `last_turn`, `model` and both reset times may be `null`.
- `five_h_pause_at` and `seven_d_pause_at` are the % at which each window pauses the hive. Either may be missing: the chip then drops that tick and its "pauses at", and without the 7d one the higher reading is taken as the limit that tripped.
- The feed is **stale** when `published_at` is more than 10 minutes old. Stale data is still shown, with its age.
- An agent with no `runtime` entry is **not reported**. Leave out `usage` and the chip reads "Usage not reported".
- A failed fetch shows the stale state. It doesn't replace the page with a destructive `Alert`, because the relay and GitHub data still render.

## Media tab

> **Status:** approved by rtorcato on 2026-10-09. UI PRs can build against it.

A gallery of every file the agents upload to the public R2 media bucket, served at `<media-host>`. The app reads the base URL from the `MEDIA_BASE_URL` env var (e.g. `https://media.torcato.dev`) and never hardcodes a domain. Keys are `<repo>/<YYYY-MM-DD>/<file>`, written by your upload tool.

- **Header row:** "Media", then "`70` files in `<media-host>` · newest first" (the host part of `MEDIA_BASE_URL`). On the right, a repo `Select` ("All repos" or one repo, also set by `?repo=`) and an outline "Bucket" link to the bucket in the Cloudflare dashboard (`external-link`).
- **Grouping:** by repo, then by date, newest first. Repos are ordered by their newest upload. Each repo header has a `folder` icon, the repo name in mono, a muted file-count pill and a "View all" link that sets the repo filter. Each date label reads "Wed Oct 7 · 6" (muted, `text-xs`).
- **Page size:** with "All repos", each repo shows its 2 newest dates, at most 10 tiles. With one repo selected, every date shows, 60 tiles a page, and an outline "Load older" `Button` follows the `ListObjectsV2` continuation token.
- **Grid:** 2 columns on phones, 3 at `sm`, 4 at `lg`, 5 at `xl`. Gap 12px on phones, 16px above.
- **Tile** (a `Card`): a 4:3 thumbnail on `bg-muted`, `object-cover object-top` (screenshots read from the top), then a footer row with the filename (Geist Mono 13px, truncated, full key in `title`), the time and size (`text-xs`, muted), and a ghost icon `Button` (`size-9`, `link` icon, `aria-label="Copy link to <file>"`). The copy button is always visible, never hover-only.
  - **Thumbnail URL:** `${MEDIA_BASE_URL}/cdn-cgi/image/width=480,format=auto/<key>` for png, jpg, webp and gif. SVGs load the original. Use `loading="lazy"` and `decoding="async"`.
  - **Not an image** (html, pdf, …): the thumbnail area shows a `file-code` icon (or `file`) and the extension. Clicking it **downloads** the file and never renders it, and the footer icon is `download` instead of `link`. The bucket is public, so an `.html` file rendered from the media host would run as a live page on that domain. Any uploader must therefore send every non-image file with `Content-Disposition: attachment`, and the tile link also carries the `download` attribute.
  - **Thumbnail fails to load:** keep the tile's size and show `image-off` with "No preview" (see States).
- **Copy:** `navigator.clipboard.writeText(url)`. The button turns into a success check plus "Copied" (icon only on phones) for 2s, announced through `role="status"`.
- **Viewer** (shadcn `Dialog`): opens when a thumbnail is clicked. On desktop it's inset 24px with a max width of 6xl. On phones it fills the screen.
  - Header: filename (mono, semibold), then repo · date and time · pixel size (from `naturalWidth`/`naturalHeight` once loaded) · file size. "3 of 8" on desktop, then the close button.
  - Body: the original image, `object-contain`, on `bg-muted/60`. Round prev/next buttons (`size-10`) sit on the sides on desktop. ←/→ keys and swipe step through the current repo's list, and Esc closes.
  - Footer: the public URL in a read-only mono field, then "Copy link" (primary), "Markdown" (outline, copies `![<file>](<url>)`) and "Original" (outline, opens in a new tab). On phones the buttons are 44px tall and stack under the URL.
- **Data:** the server lists the bucket with the read-only R2 token, never in the browser, and caches the listing for 60s. Keys that don't match `<repo>/<YYYY-MM-DD>/<file>` go under an "other" group at the end. If R2 can't be reached, the Media tab shows the same destructive `Alert` as any other failed source.
- **Rules:** still read-only, so there's no upload, rename or delete in the UI. Media never adds a Needs-you item, and its sidebar item has no count badge.

## Settings (#58)

`/settings`, linked from the bottom of the sidebar. The dashboard is read-only and single-user, so every setting is a browser preference.

- **Storage:** everything is kept in `localStorage` in this browser, under one versioned key. Nothing is sent anywhere: no analytics, no sync and no server write. Changes apply at once, with no Save button.
- **Page:** a `max-w-2xl` column. The title "Settings", then a muted line "Preferences for this browser. Changes apply right away.", then a bordered note with the `lock` icon: "Stored in this browser only (localStorage). Nothing is sent anywhere, and nothing here changes the hive."
- **Sections:** each is a `Card` with a title and a muted one-line description. Inside, each setting is a row: label (500) with an optional muted hint under it on the left, and the control on the right, with a `Separator` between rows. On phones the control stacks under the label.
- **Controls:** a `ToggleGroup` (outline, single) for 2 to 4 choices, a `Select` for longer lists, and a `Switch` for on/off.
- **No personal data:** defaults stay neutral. No agent names, pubkeys, channel IDs, repo or owner names, hostnames or emails as defaults, presets or examples. Pinned and hidden start empty. Mockups and docs screenshots use sample data only.

| Section | Setting | Control | Default |
|---|---|---|---|
| **Appearance** · How the dashboard looks on this device. | Theme | ToggleGroup: System (`monitor`) / Light (`sun`) / Dark (`moon`) | System. It uses the existing `next-themes` wiring. |
| | Density · Compact tightens agent cards and table rows. | ToggleGroup: Comfortable / Compact | Comfortable |
| | Motion · System follows your OS reduce-motion setting. | ToggleGroup: System / Reduced / Full | System. Reduced turns off everything in Motion, the same as `prefers-reduced-motion: reduce`. |
| **Time** · Logs and messages are recorded in UTC. | Timestamps | ToggleGroup: Relative / Absolute | Relative |
| | Clock | ToggleGroup: 12h / 24h | follows the browser locale |
| | Time zone | ToggleGroup: Local / UTC | Local. Under it, a mono preview chip shows the result ("Preview: 2h ago · Tue 14:05"). |
| **Data and refresh** · The page re-reads the hive on this schedule. | Auto-refresh · Off still lets you refresh by hand. | ToggleGroup: Off / 30s / 1m / 5m | 1m (today's `REFRESH_EVERY_MS`) |
| | Quiet after · An agent with no messages for this long shows as Quiet. | Select: 30 minutes, 1, 2, 4, 8 hours | 2 hours |
| **Agents** · The Agents view and the default landing page. | Open on · The view you land on at /. | Select: the five views | Agents |
| | Default filter | ToggleGroup: All / Active / Quiet / Stopped | All |
| | Default sort | Select: the Agents view's sort options | Needs attention |
| | Pinned and hidden · Pinned agents sit at the top. Hidden agents leave the Agents view, but they still count in Needs you. | a filter `Input` (`search` icon), then one row per agent: `Avatar`, name, muted role, and two ghost icon toggle buttons, Pin (`pin`) and Hide (`eye` / `eye-off`). A pressed toggle gets the `accent` background. A hidden agent's row is dimmed to 60%. | none pinned, none hidden |
| **Notifications** · Uses your browser only. No push service. | Desktop notification · When Needs you goes up. Your browser asks for permission the first time. | Switch | Off. Turning it on asks for permission. If the browser denies it, the switch goes back off with a muted "Blocked in your browser settings" hint. |
| | Count in tab title | Switch, with a mono preview chip "(3) Hive" | On |
| **About** | Version, Last publish | read-only rows: the app version and short commit in mono, and the feed's last publish time | — |
| | Reset all settings · Clears every preference on this page in this browser. | outline destructive `Button` "Reset…" with `rotate-ccw`, which opens an `AlertDialog` to confirm | — |

What changed from the request in #58, as approved:

- **Dropped: accent colour.** Honey is for the logo only (see Brand), and amber already means paused or waiting on you.
- **Dropped: "Sidebar collapsed by default".** The sidebar already remembers its last state.
- **Merged: pin and hide** into one "Pinned and hidden" list with two toggles per agent.
- **Merged: default landing view** into "Open on" under Agents, so there is no Navigation section.
- **Moved: the theme toggle** leaves the header for Appearance.
- **About** shows no infrastructure: no feed URL, hostnames or bucket names.

## Components

Use stock shadcn/ui only, with no custom components: `Card`, `Badge`, `Table`, `ToggleGroup`, `Select`, `Avatar`, `Alert`, `Button`, `Dialog`, `Tooltip` and `ScrollArea`. Use shadcn charts (`ChartContainer` + Recharts `BarChart`) for every chart. One exception: the Agents card's 7-day sparkline is a small inline SVG, because it has no axes, tooltip or legend to justify adding Recharts. Switch it to a `BarChart` once another view adds Recharts. Icons come from `lucide-react`. The agent page adds `Breadcrumb` and `Skeleton`. The sidebar and Settings (#58) add `Sidebar`, `Sheet`, `Separator`, `Switch`, `Input` and `AlertDialog`. The one non-shadcn component is [motion-primitives](https://motion-primitives.com) `AnimatedNumber`, which brings in the `motion` package (approved by rtorcato on 2026-10-16). See Motion.

## Motion

Motion explains a change. It never decorates. It runs only when a value changes, never on a plain refresh where nothing changed. It animates `transform` and `opacity`, plus colour for tints. Every item turns off under `prefers-reduced-motion: reduce`, so values swap at once.

| What moves | How | Timing | Source |
|---|---|---|---|
| Usage meter fill moves to its new value | `transform: scaleX()` with `origin-left` | 300ms, `cubic-bezier(0.16, 1, 0.3, 1)` | transitions.dev progress bar; easing from kinetics.colorion.co |
| 5h / 7d % and "Running N / 14" | `AnimatedNumber`, `springOptions: { bounce: 0, duration: 600 }` | ~600ms | motion-primitives. Use no bounce, so a % never wobbles across a threshold. |
| Usage chip and status badge change state | `transition-colors`, plus a fade and scale from 95% on the new badge | 200ms ease-out | tw-animate-css (`animate-in fade-in zoom-in-95`) |
| Needs-you row appears / leaves | fade and 4px slide from the top / fade out | 200ms in, 150ms out | transitions.dev list item (`animate-in fade-in slide-in-from-top-1`) |
| Stalled ring appears on a card | `transition-shadow` | 300ms, once | — |
| Cards re-sort (e.g. a stalled agent moves first) | `motion` `layout` on each card | 300ms, same easing as the fill | motion |
| Card hover | `translateY(-2px)` and a darker border | 150ms | transitions.dev card lift |
| Running dot | one `ping` when an agent goes to Running, then a steady dot | 1 × 1s | Tailwind `animate-ping`, run once. Never loop it: 12 pulsing dots is noise. |
| Agents card → agent page | native View Transitions: `view-transition-name` on the avatar and the name, so they morph into the hero | 250ms, same easing | Next.js `viewTransition` (experimental flag), no extra package |

No Lottie on these screens. A looping illustration pulls the eye on a screen you only glance at. Keep it for a future "All clear" state.

## Rules

- **Status = color + icon + label**, never color alone. Status colors are never used as chart series.
- **Numbers** use `tabular-nums`. Repo names, SHAs and labels use Geist Mono at 13px.
- **Charts** have 4px rounded bar tops, a dashed recessive grid, a tooltip on hover, and a legend when there are two or more series.
- **Touch targets** are at least 36px on desktop, and rows are at least 44px on phones. Keep shadcn's default visible focus ring (`ring`).
- **Breakpoints:** below 640px, one column; `md`, 2 columns; `xl`, 3 columns or cards side by side. On phones the chart shows 7 days.
- **Freshness:** after 5 minutes without a successful refresh, "Updated 7m ago" turns `warning`. A failed source shows a destructive `Alert` on its own sections only. The other sections keep rendering.
- **Contrast:** meet WCAG 2.1 AA in both themes. The status tokens below are text-safe (at least 4.5:1) on `background` and on their own 10% tint.

## Data display notes

- **Build the agent roster from pubkeys, deduplicated.** The relay holds several profiles under the same name, and older names (for example Fizz and Comb) belong to agents that have since been renamed. Show one card per live agent, not one per profile.
- **Show repo names exactly as GitHub returns them.** Don't change their case.

## Docs site

The docs site (`apps/docs`, Docusaurus v3, themed by shared-docs) leads with the real dashboard, so a visitor sees what they get before reading a word. The home page answers "what does it look like?" with screenshots, not text cards.

It stays inside Docusaurus: only `src/pages/index.tsx` and `index.module.css` change, plus a token override in `src/css/custom.css`. Docs pages, navbar, sidebar, Siblings and the shared footer are untouched. Use Infima buttons (`button button--primary button--lg`, `button--secondary`), the shared `--jt-*` tokens and the honey `--ifm-color-primary` the site already ships. Honey is fine here: the "amber means waiting" rule is for the app, not its marketing page.

### Home page, top to bottom

1. **Hero** (centred, max 1120px).
   - Eyebrow pill in Geist Mono 13px with a green dot: "Read-only · self-hosted · one Docker image".
   - `h1` (clamp 2.5rem to 4rem, weight 800, tracking -0.035em): "Does anything need you *right now?*", with "right now?" in the accent colour (a `<span>`, not `<em>`, so it isn't read as emphasis).
   - Lede (1.25rem, `--jt-muted`, max 40rem): "A dashboard for your Buzz hive. See what every agent is doing and which pull requests are waiting on you, without scrolling a single channel."
   - CTAs: primary "Get started →" to `/docs/quick-start`, secondary "View on GitHub" to the repo.
   - A browser frame below the CTAs: 38px bar with three dots and a fake URL `hive.your-network.internal/agents` in mono, then the Agents screenshot. 1px `--jt-border` border, 14px top radius, no bottom border, a soft drop shadow, and a 120px fade into the page background at the bottom. A faint accent radial glow (14% light, 18% dark) sits behind the hero.
2. **"What you get today"**: kicker, `h2` "One page instead of every channel.", sub "Built for people running several agents that open issues and PRs. These are real views, shown with sample data." Then four feature rows, alternating image side (5fr copy / 7fr image, 56px gap, 72px between rows). Each row has a mono uppercase kicker in the accent, an `h3`, one paragraph and 2–3 ticks (an 18px accent-tinted check tile). Images sit in a 14px-radius bordered card with the same shadow.
   - **Needs you** (image right): "The answer sits on top of every view." Ticks: pull requests labelled merge-ready; a hive paused for usage, with a countdown to the reset; usage meters for the 5-hour and 7-day windows. Image: the Needs-you card crop.
   - **Agents** (image left): "Every agent at a glance." Ticks: running or stopped, uptime and last turn; what it is working on, from its latest message; home channel, messages today and a 7-day sparkline. Image: the agent grid crop.
   - **Agent page** (image right): "Drill into one agent." No ticks. "Runtime, model and activity over 7, 14 or 30 days. Claims and recent PRs join this page with the GitHub reader."
   - **Media** (image left): "Mockups and screenshots, by repo and day." No ticks. "Point it at your R2 bucket and every upload shows up within a minute, grouped by repo and date, with a copy-link button on each file."
3. **Phone band** (`--jt-bg2` background, 1px borders top and bottom): copy left ("On your phone" / "Check the hive from anywhere on your network" / "The same views fit a phone. Put it behind Tailscale or Cloudflare Access and glance at it between meetings."), two phone frames right (250 × 470, 40px radius, 10px ink bezel), dark first, light second offset 48px down.
4. **Principles** ("Small on purpose"): the three existing pillars, unchanged copy except the third ("No login, so it stays on your network."), each with a 36px accent-tinted icon tile: lucide `eye`, `bell`, `box`.
5. **Quick start** ("Running in two minutes", "Three relay settings in an env file, then one command."): copy and a primary "Read the quick start →" left, a code block right with the `.env` (`BUZZ_RELAY_URL`, `BUZZ_PRIVATE_KEY`, `BUZZ_OWNER_PUBKEY`) and the `docker run … -p 127.0.0.1:3000:3000 ghcr.io/rtorcato/buzz-dashboard:<tag>` line. Use Docusaurus `CodeBlock` (`@theme/CodeBlock`, `language="bash"`) so it gets the copy button and theme colours. Keep it in step with `docs/quick-start.md`.
6. **Next views** ("On the way"): three cards, Pipeline, Releases and Timeline, each with a dashed mono "Planned" pill and one line. Drop a card once its view ships and add a feature row for it.
7. **Siblings** and the **footer**: unchanged.

**Responsive:** below 996px (Infima's `--ifm` mobile breakpoint) the feature rows stack, image after copy whatever the desktop side, and the phone band stacks with the phones centred. Below 640px show one phone only (dark), and drop the browser-frame bar so the screenshot gets the width.

### Screenshots

- Real views running on sample data only. No real names, pubkeys, channels, repos or bucket keys. Sample repos are `example-app` style names.
- One light and one dark file per shot, in `apps/docs/static/img/screens/`: `agents`, `needs-you`, `agents-grid`, `agent-page`, `media` (desktop, 1440 × 900 viewport at 2x) and `mobile` (390 × 844 at 3x). `needs-you` and `agents-grid` are element captures of those regions of the Agents view, not CSS background crops, so they scale and carry their own alt text.
- Each pair renders through `@theme/ThemedImage` so the theme toggle swaps it. Wrap every `ThemedImage` in a `div` that carries the module class: ThemedImage sets `display: initial`, which beats a class put on it directly.
- Ship WebP (quality 82). Give every `img` `width` and `height` to avoid layout shift, `loading="lazy"` below the hero and `fetchpriority="high"` on the hero.
- A capture script regenerates the whole set when the UI changes, so nobody hand-crops. It starts the app in a sample-data mode, freezes the clock, and walks each view in both themes.

**Alt text** (keep it this specific):

| Shot | Alt |
|---|---|
| `agents` | The buzz-dashboard Agents view: a Needs-you card with three PRs ready to merge, four stat tiles, and a grid of agent cards with status, runtime and a 7-day sparkline. |
| `needs-you` | The Needs-you card listing PRs ready to merge and a usage pause with its reset countdown. |
| `agents-grid` | Agent cards, each with an avatar, status badge, runtime row, latest message and a 7-day sparkline. |
| `agent-page` | An agent page: avatar, Active badge, runtime strip, stat tiles and a Runtime panel. |
| `media` | The Media view: thumbnails grouped under example-app by date. |
| `mobile` | The Agents view on a phone. The first (dark) phone carries this alt; the second (light) phone is the same view, so it gets `alt=""`. |

### Accessibility

- Raise `--jt-faint` for this site in `custom.css`: `#646f7e` light (5.1:1 on white, 4.8:1 on `--jt-bg2`) and `#7f8b9d` dark (5.6:1 on `--jt-bg`, 5.2:1 on `--jt-surface`). The shared values (`#8a95a5` 3.0:1 on white, `#647184` 3.9:1 on `#0a0e16`) fail AA for small text.
- Body text, muted text and the accent all pass AA in both themes: `--jt-muted` 5.8:1 light and 7.4:1 dark; honey `#a35d00` 5.1:1 on white; `#e19b34` on `#0a0e16` 8.2:1. The primary button's ink label on honey is 8.2:1 too.
- The fake browser bar, the glow, the check tiles and the icon tiles are decorative (`aria-hidden`). Headings stay in order: one `h1`, `h2` per band, `h3` per feature row.
- No motion. Nothing on this page needs it.

## Brand

The brand assets in [`brand/`](brand/) come from [`@rtorcato/brand-kit`](https://github.com/rtorcato/brand-kit): a dark README banner (desktop and mobile), a social card, and a favicon (`favicon.svg`, `favicon-512.png`, `favicon.ico`). Buzz is a bee, so the brand is honey and honeycomb.

- **Mark:** the pulse cell (rtorcato's pick, 2026-10-21). A solid ink (`#0A0E16`) hive cell, a pointy-top hexagon with round corners, with a honey heartbeat line (2.2px, round caps) cut through it, on a rounded honey tile (`rx 8` on 32). It reads as "watching the hive" and stays sharp at 16px, where the earlier outlined honeycomb went muddy. The source is `brand/favicon.svg`; the banners and social card pull it in with `<image>`, so editing that one file updates every canvas. In the app, render the tile from the same SVG (import `src/app/icon.svg` or copy its two paths), never redraw it.
- **Accent:** amber honey `#e19b34` on dark (8.2:1 for ink on the tile, 8.1:1 on `#0d1117`). On light surfaces use `#a35d00` (5.1:1 on white). Honey sits between js-common gold and cf-common orange, so the mark and the honeycomb are what tell this repo apart.
- **Honeycomb field:** the banner, mobile banner and social card carry a faint honeycomb (accent strokes at 22%, a few cells filled with honey at 28%), faded away from the text. It is hand-added on top of brand-kit's output, so `brand-kit doctor` reports those three SVGs as differing from the brand meta. After a `brand-kit --update`, re-add the honeycomb `<g>` from git history and run `npx @rtorcato/brand-kit render`.
- **No light banners:** the honey accent is under 3:1 on white, so the README ships the dark banners only, like the other torcato.dev repos.
- **In the app:** honey appears on the logo tile only. Inside the app amber already means "paused" or "waiting on you", so the UI stays neutral and never uses the honey accent for anything else.
- **App icon:** copy `brand/favicon.ico` to `src/app/favicon.ico`, and `brand/favicon.svg` to `src/app/icon.svg`.
- **Regenerate:** `npx @rtorcato/brand-kit --update --accent '#e19b34'` after changing the tagline or accent, then re-add the honeycomb and run `npx @rtorcato/brand-kit doctor`. Don't hand-edit the PNGs.

## Tokens

The theme is shadcn's `neutral` base, unchanged. On top of it there are three status tokens (`--success`, `--warning`, `--info`) and re-stepped `--chart-1..3`. shadcn's default chart colors change hue between themes, so these keep "opened" blue and "merged" orange in both themes, and the pair passes a colorblind check. The honey brand accent stays out of the UI, because amber means "waiting on you".

Merge these into `src/app/globals.css`. Values not listed keep the shadcn defaults.

```css
:root {
  --success: oklch(0.527 0.154 150.069);   /* green-700 */
  --warning: oklch(0.555 0.163 48.998);    /* amber-700 */
  --info: oklch(0.546 0.245 262.881);      /* blue-600 */

  --chart-1: #2a78d6;                      /* PRs opened */
  --chart-2: #eb6834;                      /* PRs merged */
  --chart-3: oklch(0.708 0 0);             /* neutral single-series activity */
}

.dark {
  --success: oklch(0.792 0.209 151.711);   /* green-400 */
  --warning: oklch(0.828 0.189 84.429);    /* amber-400 */
  --info: oklch(0.707 0.165 254.624);      /* blue-400 */

  --chart-1: #3987e5;
  --chart-2: #d95926;
  --chart-3: oklch(0.556 0 0);
}

@theme inline {
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
}
```

### Type

Use Geist for UI text and Geist Mono for code-like values, with Tailwind's default scale: page title `text-2xl font-semibold`, section heading `text-lg font-semibold`, card title `font-semibold leading-none`, stat value `text-3xl font-semibold tracking-tight tabular-nums`, body and descriptions `text-sm`, badges and meta `text-xs`, and code-like values `font-mono text-[13px]`.
