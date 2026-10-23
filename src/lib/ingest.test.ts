import { describe, expect, it, vi } from "vitest";
import type { GitHubItem } from "./github";
import type { NostrEvent } from "./relay";

vi.mock("server-only", () => ({}));

const { buzzRows, githubRows } = await import("./ingest");
const { retentionDays } = await import("./history");

const item = (over: Partial<GitHubItem> = {}): GitHubItem => ({
  repo: "acme/app",
  number: 7,
  title: "feat: thing",
  url: "https://github.com/acme/app/pull/7",
  isPr: true,
  labels: ["ai-review"],
  agent: "Shockwave",
  author: "acme-bot",
  createdAt: 1_700_000_000,
  closedAt: null,
  mergedAt: null,
  ...over,
});

describe("githubRows", () => {
  it("keys each PR transition and issue claim on a stable source id", () => {
    const rows = githubRows({
      prs: [
        item({ mergedAt: 1_700_000_500, closedAt: 1_700_000_500 }),
        item({ number: 8, agent: null, closedAt: 1_700_000_900 }),
      ],
      claims: [
        { ...item({ number: 3, isPr: false }), claimedAt: 1_700_000_100 },
        // A PR's claim is its opening, and an unattributed claim has no time.
        { ...item(), claimedAt: 1_700_000_000 },
        { ...item({ number: 4, isPr: false, agent: null }), claimedAt: 1 },
      ],
      truncated: false,
    });
    expect(rows.map((r) => [r.sourceId, r.kind, r.actor])).toEqual([
      ["acme/app#7:opened", "pr_opened", "Shockwave"],
      ["acme/app#7:merged", "pr_merged", "Shockwave"],
      ["acme/app#8:opened", "pr_opened", "acme-bot"],
      ["acme/app#8:closed", "pr_closed", "acme-bot"],
      ["acme/app#3:claimed:1700000100", "claimed", "Shockwave"],
    ]);
    expect(rows[1].at).toEqual(new Date(1_700_000_500_000));
  });
});

describe("buzzRows", () => {
  it("keeps channel messages only, keyed on the event id", () => {
    const ev = (kind: number, id: string): NostrEvent => ({
      id,
      kind,
      pubkey: "ab".repeat(32),
      created_at: 1_700_000_000,
      tags: [["h", "chan-1"]],
      content: "hello",
      sig: "",
    });
    expect(buzzRows([ev(9, "e1"), ev(0, "e2")])).toEqual([
      {
        source: "buzz",
        sourceId: "e1",
        kind: "message",
        at: new Date(1_700_000_000_000),
        actor: "ab".repeat(32),
        channel: "chan-1",
        body: "hello",
      },
    ]);
  });
});

describe("retentionDays", () => {
  it("defaults to 90 unless given a positive whole number", () => {
    expect(retentionDays(undefined)).toBe(90);
    expect(retentionDays("")).toBe(90);
    expect(retentionDays("0")).toBe(90);
    expect(retentionDays("7.5")).toBe(90);
    expect(retentionDays("30")).toBe(30);
  });
});
