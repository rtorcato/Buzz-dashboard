import { expect, it, vi } from "vitest";

// A report with no bearer token never reaches the database (#66).
const otlpTokenRecord = vi.fn(async () => null);
vi.mock("server-only", () => ({}));
vi.mock("./history", () => ({ historyEnabled: () => true }));
vi.mock("./cost-source", () => ({ otlpTokenRecord }));

const { receiveOtlp } = await import("./otlp-receive");

const post = (authorization?: string) =>
  receiveOtlp(
    new Request("http://dash/otlp/v1/metrics", {
      method: "POST",
      headers: authorization ? { authorization } : {},
    }),
    "test",
    () => [],
    async () => {},
  );

it("refuses a report without a bearer token before reading the token", async () => {
  for (const auth of [undefined, "Basic abc", "Bearer", "Bearer  "]) {
    expect((await post(auth)).status).toBe(401);
  }
  expect(otlpTokenRecord).not.toHaveBeenCalled();
  expect((await post("Bearer hive_otel_x")).status).toBe(401);
  expect(otlpTokenRecord).toHaveBeenCalledOnce();
});
