"use client";

import { copyToClipboard } from "@rtorcato/browser-common/clipboard";
import { cn } from "cn";
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCode,
  Folder,
  ImageOff,
  Link as LinkIcon,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Tile = {
  key: string;
  name: string;
  repo: string;
  dateLabel: string;
  time: string;
  size: string;
  /** Public URL of the original. */
  url: string;
  /** Thumbnail URL, or null for files that are not images. */
  thumb: string | null;
};

export type GallerySection = {
  repo: string;
  count: number;
  dates: { date: string; label: string; total: number; files: Tile[] }[];
};

const ALL = "__all__";

export function RepoSelect({
  repos,
  value,
}: {
  repos: string[];
  value: string | null;
}) {
  const router = useRouter();
  const items = [
    { value: ALL, label: "All repos" },
    ...repos.map((r) => ({ value: r, label: r })),
  ];
  return (
    <Select
      items={items}
      value={value ?? ALL}
      onValueChange={(v) =>
        router.push(
          !v || v === ALL ? "/media" : `/media?repo=${encodeURIComponent(v)}`,
        )
      }
    >
      <SelectTrigger className="h-9! min-w-32" aria-label="Repo">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem
            key={i.value}
            value={i.value}
            className={i.value === ALL ? undefined : "font-mono text-[13px]"}
          >
            {i.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Clipboard write with a 2s "Copied" state (DESIGN.md → Media tab → Copy).
function useCopy(): [string | null, (label: string, text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, [copied]);
  const copy = (label: string, text: string) =>
    copyToClipboard(text).then((ok) => setCopied(ok ? label : null));
  return [copied, copy];
}

function NoPreview() {
  return (
    <span className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <ImageOff className="size-8" aria-hidden />
      <span className="text-xs">No preview</span>
    </span>
  );
}

const thumbArea =
  "block aspect-[4/3] w-full overflow-hidden bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

function MediaTile({ tile, onOpen }: { tile: Tile; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  const [copied, copy] = useCopy();
  const ext = tile.name.includes(".") ? tile.name.split(".").pop() : "";

  return (
    <li className="group overflow-hidden rounded-xl border bg-card shadow-sm">
      {tile.thumb ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`Open ${tile.name}`}
          className={thumbArea}
        >
          {broken ? (
            <NoPreview />
          ) : (
            // biome-ignore lint/performance/noImgElement: Cloudflare already resizes; next/image would proxy it again.
            <img
              src={tile.thumb}
              alt=""
              loading="lazy"
              decoding="async"
              onError={() => setBroken(true)}
              className="size-full object-cover object-top transition-transform group-hover:scale-[1.02]"
            />
          )}
        </button>
      ) : (
        // Never render non-images: an .html file would run on the media host.
        <a
          href={tile.url}
          download={tile.name}
          aria-label={`Download ${tile.name}`}
          className={thumbArea}
        >
          <span className="flex size-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <FileCode className="size-8" aria-hidden />
            {ext ? <span className="font-mono text-xs">.{ext}</span> : null}
          </span>
        </a>
      )}
      <div className="flex items-center gap-1 border-t py-1.5 pr-1 pl-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-[13px]" title={tile.key}>
            {tile.name}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {tile.time} · {tile.size}
          </p>
        </div>
        {!tile.thumb ? (
          <a
            href={tile.url}
            download={tile.name}
            aria-label={`Download ${tile.name}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "size-9 text-muted-foreground",
            )}
          >
            <Download aria-hidden />
          </a>
        ) : copied ? (
          <span className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-xs font-medium text-success">
            <Check className="size-3.5" aria-hidden />
            <span className="sr-only sm:not-sr-only">Copied</span>
          </span>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-muted-foreground"
            aria-label={`Copy link to ${tile.name}`}
            onClick={() => copy("link", tile.url)}
          >
            <LinkIcon aria-hidden />
          </Button>
        )}
        <output className="sr-only">
          {copied ? `Copied link to ${tile.name}` : ""}
        </output>
      </div>
    </li>
  );
}

function Viewer({
  list,
  index,
  onIndex,
  onClose,
}: {
  list: Tile[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const tile = list[index];
  const [dims, setDims] = useState<{ url: string; w: number; h: number }>();
  const [copied, copy] = useCopy();
  const touchX = useRef<number | null>(null);
  const step = (d: number) => onIndex((index + d + list.length) % list.length);
  const size = dims?.url === tile.url ? `${dims.w} × ${dims.h} · ` : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") step(-1);
          if (e.key === "ArrowRight") step(1);
        }}
        className="inset-0 top-0 left-0 flex h-auto w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-none bg-background p-0 sm:inset-6 sm:mx-auto sm:max-w-6xl sm:rounded-xl sm:border"
      >
        <div className="flex items-center gap-3 border-b py-2 pr-2 pl-4 sm:pl-6">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate font-mono text-sm font-semibold">
              {tile.name}
            </DialogTitle>
            <DialogDescription className="truncate text-xs">
              <span className="font-mono">{tile.repo}</span> · {tile.dateLabel},{" "}
              {tile.time} · {size}
              {tile.size}
            </DialogDescription>
          </div>
          <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">
            {index + 1} of {list.length}
          </span>
          <DialogClose
            render={<Button variant="ghost" size="icon" className="size-10" />}
          >
            <X className="size-5" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>

        <div
          className="relative flex min-h-0 flex-1 items-center justify-center bg-muted/60 p-4 sm:p-6"
          onTouchStart={(e) => {
            touchX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          }}
        >
          {/* biome-ignore lint/performance/noImgElement: the original from the public bucket, shown as-is. */}
          <img
            key={tile.url}
            src={tile.url}
            alt={tile.name}
            decoding="async"
            onLoad={(e) =>
              setDims({
                url: tile.url,
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              })
            }
            className="max-h-full max-w-full rounded-md object-contain shadow-sm"
          />
          {list.length > 1 ? (
            <>
              <Button
                variant="outline"
                size="icon"
                aria-label="Previous image"
                onClick={() => step(-1)}
                className="absolute top-1/2 left-4 hidden size-10 -translate-y-1/2 rounded-full bg-background/90 shadow-sm sm:inline-flex"
              >
                <ChevronLeft className="size-5" aria-hidden />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Next image"
                onClick={() => step(1)}
                className="absolute top-1/2 right-4 hidden size-10 -translate-y-1/2 rounded-full bg-background/90 shadow-sm sm:inline-flex"
              >
                <ChevronRight className="size-5" aria-hidden />
              </Button>
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:px-6">
          <Input
            readOnly
            value={tile.url}
            aria-label="Public URL"
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 min-w-0 flex-1 bg-muted/40 font-mono text-[13px] text-muted-foreground"
          />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              className="col-span-2 h-11 sm:h-9"
              onClick={() => copy("link", tile.url)}
            >
              {copied === "link" ? (
                <Check aria-hidden />
              ) : (
                <LinkIcon aria-hidden />
              )}
              {copied === "link" ? "Copied" : "Copy link"}
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-9"
              onClick={() => copy("md", `![${tile.name}](${tile.url})`)}
            >
              {copied === "md" ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied === "md" ? "Copied" : "Markdown"}
            </Button>
            <a
              href={tile.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                buttonVariants({ variant: "outline" }),
                "h-11 sm:h-9",
              )}
            >
              <ExternalLink aria-hidden />
              Original
            </a>
          </div>
          <output className="sr-only">
            {copied === "link"
              ? "Link copied"
              : copied === "md"
                ? "Markdown copied"
                : ""}
          </output>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function MediaGallery({
  sections,
  viewAll,
}: {
  sections: GallerySection[];
  /** "All repos": each repo header links to its own filtered view. */
  viewAll: boolean;
}) {
  const [open, setOpen] = useState<{ repo: string; index: number } | null>(
    null,
  );
  // The viewer steps through the images of one repo, in on-screen order.
  const images = (repo: string) =>
    (sections.find((s) => s.repo === repo)?.dates ?? [])
      .flatMap((d) => d.files)
      .filter((t) => t.thumb);

  return (
    <>
      {sections.map((s) => (
        <section
          key={s.repo}
          className="space-y-3"
          aria-labelledby={`media-${s.repo}`}
        >
          <div className="flex items-center gap-2 border-b pb-2">
            <Folder className="size-4 text-muted-foreground" aria-hidden />
            <h3
              id={`media-${s.repo}`}
              className="font-mono text-sm font-semibold"
            >
              {s.repo}
            </h3>
            <span className="rounded-full bg-muted px-2 text-xs leading-5 text-muted-foreground tabular-nums">
              {s.count}
            </span>
            {viewAll ? (
              <Link
                href={`/media?repo=${encodeURIComponent(s.repo)}`}
                className={cn(
                  buttonVariants({ variant: "ghost" }),
                  "ml-auto h-9",
                )}
              >
                View all<span className="sr-only"> in {s.repo}</span>
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
          {s.dates.map((d) => (
            <div key={d.date} className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                <time dateTime={d.date}>{d.label}</time> ·{" "}
                <span className="tabular-nums">{d.total}</span>
              </p>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
                {d.files.map((t) => (
                  <MediaTile
                    key={t.key}
                    tile={t}
                    onOpen={() =>
                      setOpen({
                        repo: s.repo,
                        index: images(s.repo).findIndex((x) => x.key === t.key),
                      })
                    }
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}
      {open ? (
        <Viewer
          list={images(open.repo)}
          index={open.index}
          onIndex={(index) => setOpen({ ...open, index })}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </>
  );
}
