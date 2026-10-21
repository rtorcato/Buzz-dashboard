import { cn } from "cn";
import { ChevronDown, ExternalLink, Images } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  type GallerySection,
  MediaGallery,
  RepoSelect,
  type Tile,
} from "@/components/media-gallery";
import { EmptyState, SourceDown } from "@/components/states";
import { buttonVariants } from "@/components/ui/button";
import {
  groupMedia,
  isImage,
  listMedia,
  type MediaEnv,
  type MediaFile,
  publicUrl,
  readMediaEnv,
  takeFiles,
  thumbUrl,
} from "@/lib/media";

export const metadata: Metadata = { title: "Media · Hive" };

const PAGE_SIZE = 60;
const PREVIEW_TILES = 10;

// "Wed Oct 7" from the key's YYYY-MM-DD.
function dateLabel(date: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatToParts(new Date(`${date}T00:00:00Z`));
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  return `${get("weekday")} ${get("month")} ${get("day")}`;
}

// Upload time follows the server clock, like "Today" on the other views.
const timeOf = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(ms);

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${Math.round(kb)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

function toTile(env: MediaEnv, f: MediaFile): Tile {
  const image = isImage(f.name);
  return {
    key: f.key,
    name: f.name,
    repo: f.repo,
    dateLabel: dateLabel(f.date),
    time: timeOf(f.modified),
    size: formatSize(f.size),
    url: publicUrl(env.baseUrl, f.key),
    thumb: image ? thumbUrl(env.baseUrl, f.key) : null,
  };
}

export default async function MediaPage({ searchParams }: PageProps<"/media">) {
  const params = await searchParams;
  const repo = typeof params.repo === "string" ? params.repo : null;
  const shown = Math.max(PAGE_SIZE, Number(params.n) || PAGE_SIZE);

  let env: MediaEnv;
  let files: MediaFile[];
  try {
    env = readMediaEnv();
    files = await listMedia(env);
  } catch (err) {
    console.error("Media:", err);
    return (
      <SourceDown source="R2">
        The media bucket listing failed. Check the R2 settings in the
        server&apos;s environment; the other views are unaffected.
      </SourceDown>
    );
  }

  const host = new URL(env.baseUrl).host;
  const groups = groupMedia(files);
  const visible = repo ? groups.filter((g) => g.repo === repo) : groups;
  const sections: GallerySection[] = visible.map((g) => ({
    repo: g.repo,
    count: g.count,
    dates: (repo
      ? takeFiles(g.dates, shown)
      : takeFiles(g.dates.slice(0, 2), PREVIEW_TILES)
    ).map((d) => ({
      date: d.date,
      label: dateLabel(d.date),
      total: g.dates.find((x) => x.date === d.date)?.files.length ?? 0,
      files: d.files.map((f) => toTile(env, f)),
    })),
  }));
  const hasOlder = repo !== null && (visible[0]?.count ?? 0) > shown;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Media</h2>
          <p className="text-sm text-muted-foreground">
            <span className="tabular-nums">{files.length}</span> files in{" "}
            <span className="font-mono text-[13px]">{host}</span> · newest first
          </p>
        </div>
        <div className="flex gap-2">
          <RepoSelect repos={groups.map((g) => g.repo)} value={repo} />
          <a
            href={`https://dash.cloudflare.com/${env.accountId}/r2/default/buckets/${encodeURIComponent(env.bucket)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "hidden h-9 sm:inline-flex",
            )}
          >
            Bucket
            <ExternalLink aria-hidden />
          </a>
        </div>
      </div>

      {files.length === 0 ? (
        <EmptyState icon={Images} title="No media yet">
          Agents upload with{" "}
          <span className="font-mono text-[13px]">
            media_put.sh &lt;repo&gt; &lt;file&gt;
          </span>
          . New files show up here within a minute.
        </EmptyState>
      ) : sections.length === 0 ? (
        <EmptyState icon={Images} title={`Nothing in ${repo}`}>
          No uploads for this repo.{" "}
          <Link href="/media" className="underline underline-offset-3">
            Show all repos
          </Link>
        </EmptyState>
      ) : (
        <MediaGallery sections={sections} viewAll={repo === null} />
      )}

      {hasOlder ? (
        <div className="flex justify-center">
          <Link
            href={`/media?repo=${encodeURIComponent(repo)}&n=${shown + PAGE_SIZE}`}
            scroll={false}
            className={cn(buttonVariants({ variant: "outline" }), "h-9")}
          >
            Load older
            <ChevronDown aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
