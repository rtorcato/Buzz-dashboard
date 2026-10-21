import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const {
  groupMedia,
  isImage,
  OTHER,
  parseKey,
  parseListing,
  publicUrl,
  readMediaEnv,
  takeFiles,
  thumbUrl,
} = await import("./media");

const BASE = "https://media.example";

describe("readMediaEnv", () => {
  const ok = {
    MEDIA_BASE_URL: `${BASE}/`,
    R2_ACCOUNT_ID: "acct",
    R2_BUCKET: "bucket",
    R2_ACCESS_KEY_ID: "ak",
    R2_SECRET_ACCESS_KEY: "sk",
  };

  it("reads the vars and trims the trailing slash", () => {
    expect(readMediaEnv(ok)).toEqual({
      baseUrl: BASE,
      accountId: "acct",
      bucket: "bucket",
      accessKeyId: "ak",
      secretAccessKey: "sk",
    });
  });

  it("names missing vars and rejects non-https hosts", () => {
    expect(() => readMediaEnv({ MEDIA_BASE_URL: BASE })).toThrow(
      "R2_ACCOUNT_ID\nR2_BUCKET\nR2_ACCESS_KEY_ID\nR2_SECRET_ACCESS_KEY",
    );
    expect(() =>
      readMediaEnv({ ...ok, MEDIA_BASE_URL: "http://media.example" }),
    ).toThrow("https");
  });
});

describe("parseListing", () => {
  it("reads objects, decodes entities and follows truncation", () => {
    const xml = `<?xml version="1.0"?><ListBucketResult>
      <IsTruncated>true</IsTruncated>
      <Contents><Key>a/2026-10-07/x&amp;y.png</Key><LastModified>2026-10-07T16:31:00.000Z</LastModified><Size>1024</Size></Contents>
      <Contents><Key>b.txt</Key><LastModified>2026-10-08T00:00:00.000Z</LastModified><Size>5</Size></Contents>
      <NextContinuationToken>tok&#x2F;1</NextContinuationToken></ListBucketResult>`;
    expect(parseListing(xml)).toEqual({
      objects: [
        {
          key: "a/2026-10-07/x&y.png",
          size: 1024,
          modified: Date.parse("2026-10-07T16:31:00Z"),
        },
        { key: "b.txt", size: 5, modified: Date.parse("2026-10-08T00:00Z") },
      ],
      next: "tok/1",
    });
  });

  it("stops when the listing is not truncated", () => {
    expect(
      parseListing("<IsTruncated>false</IsTruncated>").next,
    ).toBeUndefined();
  });
});

describe("keys and URLs", () => {
  const at = Date.parse("2026-10-08T12:00:00Z");

  it("splits <repo>/<date>/<file> and puts the rest under other", () => {
    expect(
      parseKey({ key: "esp32/2026-10-07/a.png", size: 1, modified: at }),
    ).toMatchObject({ repo: "esp32", date: "2026-10-07", name: "a.png" });
    expect(
      parseKey({ key: "_smoke/x/y.png", size: 1, modified: at }),
    ).toMatchObject({ repo: OTHER, date: "2026-10-08", name: "y.png" });
  });

  it("thumbnails raster images and loads SVGs as-is", () => {
    expect(thumbUrl(BASE, "r/2026-10-07/a.png")).toBe(
      `${BASE}/cdn-cgi/image/width=480,format=auto/r/2026-10-07/a.png`,
    );
    expect(thumbUrl(BASE, "r/2026-10-07/g.svg")).toBe(
      `${BASE}/r/2026-10-07/g.svg`,
    );
    expect(publicUrl(BASE, "other/a b#?.png")).toBe(
      `${BASE}/other/a%20b%23%3F.png`,
    );
    expect(isImage("a.JPG")).toBe(true);
    expect(isImage("directions.html")).toBe(false);
  });
});

describe("groupMedia and takeFiles", () => {
  const f = (key: string, modified: number) =>
    parseKey({ key, size: 1, modified });
  // Newest first, as listMedia returns them.
  const files = [
    f("b/2026-10-09/1.png", 9),
    f("_smoke/x.png", 8),
    f("a/2026-10-08/1.png", 7),
    f("b/2026-10-07/2.png", 6),
    f("b/2026-10-07/1.png", 5),
    f("b/2026-10-06/1.png", 4),
  ];

  it("orders repos by newest upload, other last, dates newest first", () => {
    const groups = groupMedia(files);
    expect(groups.map((g) => [g.repo, g.count])).toEqual([
      ["b", 4],
      ["a", 1],
      [OTHER, 1],
    ]);
    expect(groups[0].dates.map((d) => d.date)).toEqual([
      "2026-10-09",
      "2026-10-07",
      "2026-10-06",
    ]);
  });

  it("caps tiles across dates", () => {
    const b = groupMedia(files)[0];
    expect(
      takeFiles(b.dates.slice(0, 2), 2).map((d) => d.files.length),
    ).toEqual([1, 1]);
    expect(takeFiles(b.dates, 10).flatMap((d) => d.files)).toHaveLength(4);
  });
});
