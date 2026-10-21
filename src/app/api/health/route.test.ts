import { expect, it } from "vitest";
import { GET } from "./route";

it("answers 200 { ok: true }", async () => {
  const res = GET();
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});
