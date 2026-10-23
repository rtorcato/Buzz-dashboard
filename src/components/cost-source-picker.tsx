"use client";

import { cn } from "cn";
import { KeyRound, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const API = "/api/sources/signer";

// DESIGN.md → Settings → Sources → Cost source (#43). The radio is the only
// switch, and switching is a confirm step: the signer through its dialog,
// OpenTelemetry through an alert.
export function CostSourcePicker({
  source,
  canEdit,
}: {
  source: "otel" | "signer";
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<"otel" | "signer" | null>(null);
  const [bunker, setBunker] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = (next: "otel" | "signer") => {
    if (next === source) return;
    setError(null);
    setOpen(next);
  };

  const reset = () => {
    setOpen(null);
    setBunker("");
    setUnderstood(false);
    setError(null);
  };
  const close = () => {
    if (!busy) reset();
  };

  const send = async (method: "POST" | "DELETE") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API, {
        method,
        headers: { "content-type": "application/json" },
        body: method === "POST" ? JSON.stringify({ bunker, understood }) : "{}",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        setError(
          res.status === 403
            ? "Sign in as the owner first."
            : (body?.error ?? "That didn’t work. Try again."),
        );
        return;
      }
      reset();
      router.refresh();
    } catch {
      setError("That didn’t work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <fieldset className="grid gap-3 md:grid-cols-2">
        <legend className="sr-only">Cost source</legend>
        <SourceOption
          checked={source === "otel"}
          disabled={!canEdit}
          onPick={() => pick("otel")}
          title="OpenTelemetry"
          badge="Recommended"
          text="Each agent sends its own token and cost reports straight to this dashboard. No key leaves your machine."
        >
          <span className="block text-xs text-muted-foreground">
            Claude Code agents only, for now.
          </span>
        </SourceOption>
        <SourceOption
          checked={source === "signer"}
          disabled={!canEdit}
          onPick={() => pick("signer")}
          title="Owner signer"
          chip="NIP-46"
          badge={source === "signer" ? "Opt-in · on" : "Opt-in · off"}
          text="Reads the per-turn reports Buzz already publishes, through your own Nostr signer. No agent changes."
        >
          <span className="flex items-start gap-1.5 text-xs text-warning">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            Your signer can’t limit this to cost reports, so it could also
            decrypt your DMs.
          </span>
        </SourceOption>
      </fieldset>

      <Dialog open={open === "signer"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Read cost through your owner signer?</DialogTitle>
            <DialogDescription>
              The dashboard will connect to your Nostr signer (a NIP-46 bunker)
              and ask it to decrypt the per-turn reports your agents publish.
              Your key stays in the signer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/8 p-3 text-destructive">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="space-y-1">
              <p className="font-medium">This can also decrypt your DMs</p>
              <p className="text-xs">
                A signer can’t limit decryption to cost reports. If this
                dashboard were ever compromised, it could ask your signer to
                decrypt your direct messages too. Use OpenTelemetry unless your
                agents can’t send it.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="bunker" className="text-sm font-medium">
              Signer address
            </label>
            <Input
              id="bunker"
              value={bunker}
              onChange={(e) => setBunker(e.target.value)}
              placeholder="bunker://…"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              From your signer app. Set it to ask before decrypting, if it can,
              and revoke it there at any time.
            </p>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 size-4 accent-foreground"
            />
            I understand the dashboard could decrypt my DMs if it were
            compromised.
          </label>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {busy && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              Connecting. Approve the request in your signer app if it asks.
            </p>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              className="max-sm:h-11 max-sm:w-full"
              onClick={close}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              className="max-sm:h-11 max-sm:w-full"
              disabled={!understood || !bunker.trim() || busy}
              onClick={() => send("POST")}
            >
              <KeyRound aria-hidden />
              Connect signer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={open === "otel"} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch to OpenTelemetry?</AlertDialogTitle>
            <AlertDialogDescription>
              The signer connection is closed. To revoke the dashboard’s access
              too, remove it in your signer app.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                // Stay open until the switch lands, so an error can show.
                e.preventDefault();
                void send("DELETE");
              }}
            >
              Switch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SourceOption({
  checked,
  disabled,
  onPick,
  title,
  chip,
  badge,
  text,
  children,
}: {
  checked: boolean;
  disabled: boolean;
  onPick: () => void;
  title: string;
  chip?: string;
  badge: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <label
      className={cn(
        "flex gap-3 rounded-lg border p-4",
        checked && "ring-1 ring-foreground",
        disabled && !checked && "opacity-70",
      )}
    >
      <input
        type="radio"
        name="cost-source"
        checked={checked}
        disabled={disabled}
        onChange={onPick}
        className="mt-1 size-4 accent-foreground"
      />
      <span className="min-w-0 space-y-1.5">
        <span className="flex flex-wrap items-center gap-2 font-medium">
          {title}
          {chip && (
            <span className="rounded border px-1 font-mono text-xs font-normal">
              {chip}
            </span>
          )}
          <span className="rounded-md border px-1.5 text-xs font-normal text-muted-foreground">
            {badge}
          </span>
        </span>
        <span className="block text-sm text-muted-foreground">{text}</span>
        {children}
      </span>
    </label>
  );
}
