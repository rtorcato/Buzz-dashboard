import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { agentName } from "./hive";

// The GitHub reader: open claims and recent PRs on the GITHUB_OWNERS repos,
// read on the server with the optional read-only GITHUB_TOKEN. Every agent
// opens its GitHub comments and PR bodies with a "🤖 *Automated — `@Name` 🐝 …"
// header, and that names the agent.

/** A comma (or space) separated env var as a list; unset or empty is []. */
export const envList = (name: string): string[] =>
  (process.env[name] ?? "").split(/[\s,]+/).filter(Boolean);

export const CLAIM_LABELS = [
  "ai-wip",
  "ai-review",
  "ai-changes",
  "ai-blocked",
] as const;
export const PR_WINDOW_DAYS = 30;

export type GitHubItem = {
  /** "owner/name", exactly as GitHub returns it. */
  repo: string;
  number: number;
  title: string;
  url: string;
  isPr: boolean;
  labels: string[];
  /** The agent from the `@Name` header, or null when unattributed. */
  agent: string | null;
  /** GitHub login of the author, e.g. "dependabot[bot]". */
  author: string;
  /** Unix seconds. */
  createdAt: number;
  closedAt: number | null;
  mergedAt: number | null;
};

export type Claim = GitHubItem & {
  /** Unix seconds of the claim comment; a PR's own creation time. */
  claimedAt: number;
};

export type GitHub = {
  /** Open issues and PRs carrying a claim label, newest first. */
  claims: Claim[];
  /** PRs opened in the last PR_WINDOW_DAYS days, newest first. */
  prs: GitHubItem[];
  /** True when a search matched more than its 100 nodes, so items are missing. */
  truncated: boolean;
};

// Stops at a backslash: some bodies escape the closing tick (`@Name\`).
const HEADER_RE = /🤖[^\n]*?`@([^`\n\\]+)\\?`/;

// Anyone can paste a header into a PR or comment on a public repo, so it only
// names an agent when a GITHUB_TRUSTED_AUTHORS login wrote it. Unset trusts
// nobody: every item stays unattributed.
const trusted = (author: { login: string } | null | undefined) =>
  author != null && envList("GITHUB_TRUSTED_AUTHORS").includes(author.login);

/** The agent named by the first bot header in `body`, or null. */
export function headerAgent(body: string | null | undefined): string | null {
  const m = HEADER_RE.exec(body ?? "");
  return m ? agentName(m[1].trim()) : null;
}

type RawComment = {
  body: string | null;
  createdAt: string;
  author: { login: string } | null;
};

type RawItem = {
  __typename: "Issue" | "PullRequest";
  number: number;
  title: string;
  url: string;
  body: string | null;
  createdAt: string;
  closedAt: string | null;
  mergedAt?: string | null;
  author: { login: string } | null;
  repository: { nameWithOwner: string };
  labels: { nodes: { name: string }[] } | null;
  /** Claims only: an issue's newest comments, oldest first. */
  comments?: { nodes: RawComment[] };
};

type RawSearch = { issueCount: number; nodes: (RawItem | null)[] };

const secs = (iso: string) => Math.floor(Date.parse(iso) / 1000);
const secsOrNull = (iso: string | null | undefined) => (iso ? secs(iso) : null);

export function toItem(raw: RawItem): GitHubItem {
  const isPr = raw.__typename === "PullRequest";
  return {
    repo: raw.repository.nameWithOwner,
    number: raw.number,
    title: raw.title,
    url: raw.url,
    isPr,
    labels: raw.labels?.nodes.map((l) => l.name) ?? [],
    // An issue's body is the filer's; its claimer is found in the comments.
    agent: isPr && trusted(raw.author) ? headerAgent(raw.body) : null,
    author: raw.author?.login ?? "ghost",
    createdAt: secs(raw.createdAt),
    closedAt: secsOrNull(raw.closedAt),
    mergedAt: secsOrNull(raw.mergedAt),
  };
}

/** The newest trusted "Claimed by" comment's header agent and time, or null. */
export function claimFrom(
  comments: RawComment[],
): { agent: string; at: number } | null {
  for (const c of comments.toReversed()) {
    const agent =
      c.body?.includes("Claimed by") && trusted(c.author)
        ? headerAgent(c.body)
        : null;
    if (agent) return { agent, at: secs(c.createdAt) };
  }
  return null;
}

export function toClaim(raw: RawItem): Claim {
  const item = toItem(raw);
  if (item.isPr) return { ...item, claimedAt: item.createdAt };
  const claim = claimFrom(raw.comments?.nodes ?? []);
  return {
    ...item,
    agent: claim?.agent ?? null,
    claimedAt: claim?.at ?? item.createdAt,
  };
}

const users = (owners: string[]) => owners.map((o) => `user:${o}`).join(" ");

export const claimQuery = (owners: string[]) =>
  `is:open label:${CLAIM_LABELS.join(",")} ${users(owners)}`;

const day = (now: Date, daysAgo: number) =>
  new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);

const SLICE_DAYS = 1;
const PAGE = 100;

// ponytail: each search returns at most 100 nodes, so the window is cut into
// 1-day `created:` slices (about 30 PRs a day today, 2-day slices already
// overflowed). If `truncated` shows up, page the slices with `after` cursors.
export function prQueries(now: Date, owners: string[]): string[] {
  const queries: string[] = [];
  for (let from = PR_WINDOW_DAYS; from > 0; from -= SLICE_DAYS) {
    const range =
      from <= SLICE_DAYS
        ? `>=${day(now, from)}`
        : `${day(now, from)}..${day(now, from - SLICE_DAYS + 1)}`;
    queries.push(`is:pr ${users(owners)} created:${range}`);
  }
  return queries;
}

const FIELDS = `number title url body createdAt closedAt
  author { login } repository { nameWithOwner } labels(first: 20) { nodes { name } }`;
const NODES = `__typename
  ... on Issue { ${FIELDS} }
  ... on PullRequest { ${FIELDS} mergedAt }`;

const CLAIM_NODES = `${NODES}
  ... on Issue { comments(last: 30) { nodes { body createdAt author { login } } } }`;

// The search strings travel as variables, never spliced into the query.
export function buildQuery(aliases: string[]): string {
  const vars = aliases.map((a) => `$${a}: String!`).join(", ");
  const fields = aliases.map(
    (a) =>
      `${a}: search(type: ISSUE, query: $${a}, first: ${PAGE}) { issueCount nodes { ${a === "claims" ? CLAIM_NODES : NODES} } }`,
  );
  return `query(${vars}) { ${fields.join("\n")} }`;
}

async function graphql(
  token: string,
  query: string,
  variables: Record<string, string>,
): Promise<Record<string, RawSearch>> {
  // A fixed URL: the token only ever goes to api.github.com.
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "buzz-dashboard",
    },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL failed: HTTP ${res.status}`);
  const json = (await res.json()) as {
    data?: Record<string, RawSearch> | null;
    errors?: { type?: string }[];
  };
  if (json.errors?.length || !json.data) {
    throw new Error(
      `GitHub GraphQL error: ${json.errors?.[0]?.type ?? "no data"}`,
    );
  }
  return json.data;
}

const nodes = (s: RawSearch) => s.nodes.filter((n) => n !== null);

// Searches per request. 16 in one request ran into GitHub's 10s GraphQL
// timeout (HTTP 502), and parallel requests trip its secondary rate limit, so
// the reader sends small requests one after another.
const PER_REQUEST = 4;

export async function getGitHub(
  token: string,
  now = new Date(),
): Promise<GitHub> {
  const owners = envList("GITHUB_OWNERS");
  // Without a user: qualifier the searches would span all of GitHub.
  if (!owners.length) throw new Error("GITHUB_OWNERS is not set");
  const slices = prQueries(now, owners);
  const searches: [string, string][] = [
    ["claims", claimQuery(owners)],
    ...slices.map((q, i): [string, string] => [`s${i}`, q]),
  ];
  const data: Record<string, RawSearch> = {};
  for (let i = 0; i < searches.length; i += PER_REQUEST) {
    const chunk = searches.slice(i, i + PER_REQUEST);
    Object.assign(
      data,
      await graphql(
        token,
        buildQuery(chunk.map(([alias]) => alias)),
        Object.fromEntries(chunk),
      ),
    );
  }
  const prs = slices
    .flatMap((_, i) => nodes(data[`s${i}`]))
    .map(toItem)
    .sort((a, b) => b.createdAt - a.createdAt);
  return {
    claims: nodes(data.claims)
      .map(toClaim)
      .sort((a, b) => b.createdAt - a.createdAt),
    prs,
    truncated: Object.values(data).some((s) => s.issueCount > s.nodes.length),
  };
}

export type GitHubResult =
  | { github: GitHub; fetchedAt: string }
  | { github: null; error: string };

type Fetched = { github: GitHub; fetchedAt: string };

const TTL_MS = 2 * 60_000;
// The freshness line turns `warning` at 5 minutes (DESIGN.md), so a read that
// old is never served: the request waits for a new one, or shows "source down".
const STALE_MS = 5 * 60_000;
let last: Fetched | undefined;
let inflight: Promise<Fetched> | undefined;

// One read at a time per server process, however many requests want it.
function refresh(token: string): Promise<Fetched> {
  inflight ??= getGitHub(token)
    .then((github) => {
      last = { github, fetchedAt: new Date().toISOString() };
      return last;
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

// A full read is 8 sequential requests and takes about 20s, so requests get
// the last good read at once and a refresh runs behind them once it is 2
// minutes old. Only the first request after a start (or after 5 minutes of
// failures) waits.
export const loadGitHub = cache(async (): Promise<GitHubResult> => {
  await connection();
  // Read directly: readServerEnv() also demands the relay vars, and a relay
  // misconfiguration shouldn't take GitHub down with it.
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { github: null, error: "GITHUB_TOKEN is not set" };
  const age = last ? Date.now() - Date.parse(last.fetchedAt) : Infinity;
  if (last && age < STALE_MS) {
    if (age >= TTL_MS) refresh(token).catch(() => {});
    return last;
  }
  try {
    return await refresh(token);
  } catch (err) {
    return {
      github: null,
      error: err instanceof Error ? err.message : "error",
    };
  }
});
