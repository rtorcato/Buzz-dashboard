import { describe, expect, it } from "vitest";
import {
  type AlertConfig,
  alertRequest,
  channelUrl,
  dueAlerts,
  elide,
  type Item,
} from "./alerts";

const H = 3_600_000;
// Noon local, outside quiet hours.
const NOON = new Date(2026, 9, 23, 12).getTime();

const config = (over: Partial<AlertConfig> = {}): AlertConfig => ({
  channels: [{ id: "c1", type: "ntfy", target: "https://ntfy.sh/t", on: true }],
  rules: {},
  quiet: false,
  ...over,
});
const failing: Item = {
  rule: "failing",
  key: "failing:Gale",
  title: "Gale is failing turns",
  detail: "6 of 14",
  path: "/health",
};
const merge: Item = {
  rule: "merge",
  key: "merge:o/r#1",
  title: "r#1 is ready to merge",
  detail: "t",
  path: "/pipeline",
};

describe("dueAlerts", () => {
  it("sends a failing agent right away, then hourly", () => {
    const first = dueAlerts(config(), {}, [failing], NOON);
    expect(first.due.map((d) => d.item.key)).toEqual(["failing:Gale"]);
    const sent = { "failing:Gale": { first: NOON, sent: NOON } };
    expect(dueAlerts(config(), sent, [failing], NOON + H - 1).due).toEqual([]);
    expect(dueAlerts(config(), sent, [failing], NOON + H).due).toHaveLength(1);
  });

  it("waits the rule's hours, then sends a once rule only once", () => {
    const { state } = dueAlerts(config(), {}, [merge], NOON);
    expect(dueAlerts(config(), state, [merge], NOON + H).due).toEqual([]);
    expect(dueAlerts(config(), state, [merge], NOON + 2 * H).due).toHaveLength(
      1,
    );
    const sent = { [merge.key]: { first: NOON, sent: NOON + 2 * H } };
    expect(dueAlerts(config(), sent, [merge], NOON + 99 * H).due).toEqual([]);
  });

  it("forgets an item that cleared, so it starts over", () => {
    const prev = { [merge.key]: { first: NOON, sent: NOON } };
    expect(dueAlerts(config(), prev, [], NOON).state).toEqual({});
  });

  it("skips a rule that's off, an off channel and one it doesn't send to", () => {
    const off = config({
      rules: { failing: { on: false, channels: ["c1"], value: 1 } },
    });
    expect(dueAlerts(off, {}, [failing], NOON).due).toEqual([]);
    const muted = config({
      channels: [
        { id: "c1", type: "ntfy", target: "https://ntfy.sh/t", on: false },
      ],
    });
    expect(dueAlerts(muted, {}, [failing], NOON).due).toEqual([]);
    const elsewhere = config({
      rules: { failing: { on: true, channels: ["gone"], value: 1 } },
    });
    expect(dueAlerts(elsewhere, {}, [failing], NOON).due).toEqual([]);
  });

  it("lets only failing agents through in quiet hours", () => {
    const night = new Date(2026, 9, 23, 23).getTime();
    const prev = { [merge.key]: { first: night - 3 * H, sent: null } };
    const { due } = dueAlerts(
      config({ quiet: true }),
      prev,
      [failing, merge],
      night,
    );
    expect(due.map((d) => d.item.rule)).toEqual(["failing"]);
  });
});

describe("channel URLs", () => {
  it("takes http(s) only, without credentials", () => {
    expect(channelUrl("https://ntfy.sh/topic")).not.toBeNull();
    expect(channelUrl("http://ntfy.lan/topic")).not.toBeNull();
    expect(channelUrl("file:///etc/passwd")).toBeNull();
    expect(channelUrl("https://u:p@ntfy.sh/topic")).toBeNull();
    expect(channelUrl("not a url")).toBeNull();
  });

  it("elides every path segment", () => {
    expect(elide("https://hooks.slack.com/services/T012/B034/xyz?x=1")).toBe(
      "https://hooks.slack.com/se…/T0…/B0…/xy…",
    );
    expect(elide("https://ntfy.sh/alerts-secret")).toBe("https://ntfy.sh/al…");
  });
});

describe("alertRequest", () => {
  const alert = {
    rule: "failing" as const,
    title: "Gale’s failing",
    detail: "6 of 14",
    link: "https://hive.example/health",
  };

  it("publishes ntfy as JSON to the server root", () => {
    const req = alertRequest(
      "ntfy",
      new URL("https://ntfy.example/sub/topic"),
      alert,
    );
    expect(req.url).toBe("https://ntfy.example/sub/");
    expect(JSON.parse(req.body)).toMatchObject({
      topic: "topic",
      title: "Gale’s failing",
      click: "https://hive.example/health",
    });
  });

  it("sends Slack text and plain JSON", () => {
    const slack = alertRequest("slack", new URL("https://hooks.x/s/1"), alert);
    expect(JSON.parse(slack.body).text).toContain("*Gale’s failing*");
    const hook = alertRequest("webhook", new URL("https://x/h"), alert);
    expect(JSON.parse(hook.body)).toEqual({
      alert: "failing",
      title: "Gale’s failing",
      detail: "6 of 14",
      url: "https://hive.example/health",
    });
  });
});
