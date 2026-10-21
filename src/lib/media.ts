import "server-only";

import { checkEnv } from "@rtorcato/js-common/env";
import { AwsClient } from "aws4fetch";
import { z } from "zod";

// Media tab data (DESIGN.md → "Media tab"). The server lists the public R2
// bucket with a read-only S3 token; the browser only ever sees public URLs.

export type MediaEnv = {
  baseUrl: string;
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const MediaEnvSchema = z.object({
  MEDIA_BASE_URL: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
  R2_BUCKET: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
});

// Media is optional: when unset the tab shows "source down", the app still runs.
export function readMediaEnv(
  source: Record<string, string | undefined> = process.env,
): MediaEnv {
  const env = checkEnv(MediaEnvSchema, source);
  if (new URL(env.MEDIA_BASE_URL).protocol !== "https:") {
    throw new Error("MEDIA_BASE_URL must be an https URL");
  }
  return {
    baseUrl: env.MEDIA_BASE_URL.replace(/\/+$/, ""),
    accountId: env.R2_ACCOUNT_ID,
    bucket: env.R2_BUCKET,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  };
}

export type MediaObject = {
  key: string;
  size: number;
  /** Unix ms. */
  modified: number;
};

export type MediaFile = MediaObject & {
  /** Repo segment of the key, or OTHER for keys outside <repo>/<date>/<file>. */
  repo: string;
  /** YYYY-MM-DD from the key, or from LastModified for OTHER keys. */
  date: string;
  name: string;
};

export const OTHER = "other";
const KEY_RE = /^([^/]+)\/(\d{4}-\d{2}-\d{2})\/([^/]+)$/;

export function parseKey(o: MediaObject): MediaFile {
  const m = KEY_RE.exec(o.key);
  if (m) return { ...o, repo: m[1], date: m[2], name: m[3] };
  return {
    ...o,
    repo: OTHER,
    date: new Date(o.modified).toISOString().slice(0, 10),
    name: o.key.split("/").pop() || o.key,
  };
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i;
export const isImage = (name: string) => IMAGE_EXT.test(name);

// Keys laid out as <repo>/<date>/<file> are URL-safe, but "other" keys can
// hold anything.
const encodeKey = (key: string) =>
  key.split("/").map(encodeURIComponent).join("/");

export const publicUrl = (baseUrl: string, key: string) =>
  `${baseUrl}/${encodeKey(key)}`;

// Cloudflare Image Transformations; SVGs are tiny, so they load the original.
export function thumbUrl(baseUrl: string, key: string): string {
  if (/\.svg$/i.test(key)) return publicUrl(baseUrl, key);
  return `${baseUrl}/cdn-cgi/image/width=480,format=auto/${encodeKey(key)}`;
}

const XML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, ent: string) => {
    if (ent[0] !== "#") return XML_ENTITIES[ent] ?? whole;
    const code =
      ent[1].toLowerCase() === "x"
        ? Number.parseInt(ent.slice(2), 16)
        : Number(ent.slice(1));
    return String.fromCodePoint(code);
  });
}

const tag = (xml: string, name: string) =>
  new RegExp(`<${name}>([^<]*)</${name}>`).exec(xml)?.[1];

// ponytail: regex over the flat ListObjectsV2 XML, no parser dependency.
export function parseListing(xml: string): {
  objects: MediaObject[];
  next?: string;
} {
  const objects = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)].map(
    ([, c]) => ({
      key: decodeXml(tag(c, "Key") ?? ""),
      size: Number(tag(c, "Size") ?? 0),
      modified: Date.parse(tag(c, "LastModified") ?? ""),
    }),
  );
  const token = tag(xml, "NextContinuationToken");
  return {
    objects,
    next:
      tag(xml, "IsTruncated") === "true" && token
        ? decodeXml(token)
        : undefined,
  };
}

const TTL_MS = 60_000;
const MAX_PAGES = 20;
let cache: { at: number; files: MediaFile[] } | undefined;

// The whole bucket, newest first, cached for 60s per server process.
// ponytail: lists every key so the tab can sort newest-first (S3 lists in key
// order). Fine to MAX_PAGES × 1000 objects; past that, index uploads instead.
export const r2Client = (env: MediaEnv) =>
  new AwsClient({
    accessKeyId: env.accessKeyId,
    secretAccessKey: env.secretAccessKey,
    service: "s3",
    region: "auto",
  });

/** S3 API URL of the bucket, or of one object when `key` is given. */
export const r2Url = (env: MediaEnv, key = "") =>
  new URL(
    `https://${env.accountId}.r2.cloudflarestorage.com/${encodeURIComponent(env.bucket)}${key && `/${encodeKey(key)}`}`,
  );

export async function listMedia(env: MediaEnv): Promise<MediaFile[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.files;
  const client = r2Client(env);
  const objects: MediaObject[] = [];
  let token: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = r2Url(env);
    url.searchParams.set("list-type", "2");
    if (token) url.searchParams.set("continuation-token", token);
    const res = await client.fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`R2 list failed: HTTP ${res.status}`);
    const listing = parseListing(await res.text());
    objects.push(...listing.objects);
    token = listing.next;
    if (!token) break;
  }
  const files = objects.map(parseKey).sort((a, b) => b.modified - a.modified);
  cache = { at: Date.now(), files };
  return files;
}

export type DateGroup = { date: string; files: MediaFile[] };
export type RepoGroup = { repo: string; count: number; dates: DateGroup[] };

// Repos by newest upload, OTHER last; dates newest first. Input is newest first.
export function groupMedia(files: MediaFile[]): RepoGroup[] {
  const repos = new Map<string, Map<string, MediaFile[]>>();
  for (const f of files) {
    const dates = repos.get(f.repo) ?? new Map<string, MediaFile[]>();
    repos.set(f.repo, dates);
    const list = dates.get(f.date) ?? [];
    dates.set(f.date, list);
    list.push(f);
  }
  const groups = [...repos].map(([repo, dates]) => ({
    repo,
    count: [...dates.values()].reduce((n, l) => n + l.length, 0),
    dates: [...dates]
      .map(([date, list]) => ({ date, files: list }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  }));
  return [
    ...groups.filter((g) => g.repo !== OTHER),
    ...groups.filter((g) => g.repo === OTHER),
  ];
}

// The first `limit` files, still grouped by date. "All repos" passes each
// repo's 2 newest dates and 10; one repo passes every date and the page size.
export function takeFiles(dates: DateGroup[], limit: number): DateGroup[] {
  const out: DateGroup[] = [];
  let left = limit;
  for (const d of dates) {
    if (left <= 0) break;
    out.push({ date: d.date, files: d.files.slice(0, left) });
    left -= d.files.length;
  }
  return out;
}
