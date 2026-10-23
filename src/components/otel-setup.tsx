"use client";

import { cn } from "cn";
import {
  Check,
  CircleCheckBig,
  KeyRound,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

const TOKEN_HOLDER = "<your ingest token>";
const AGENT_HOLDER = "<agent name>";

const envBlock = (endpoint: string, token: string) =>
  [
    "CLAUDE_CODE_ENABLE_TELEMETRY=1",
    "OTEL_METRICS_EXPORTER=otlp",
    "OTEL_LOGS_EXPORTER=otlp",
    "OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf",
    `OTEL_EXPORTER_OTLP_ENDPOINT=${endpoint}`,
    `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer ${token}`,
    `OTEL_RESOURCE_ATTRIBUTES=agent=${AGENT_HOLDER}`,
  ].join("\n");

// The placeholders render in the warning colour, so the owner sees what to
// replace.
function EnvLines({ text }: { text: string }) {
  return text.split(/(<your ingest token>|<agent name>)/).map((part, i) =>
    part === TOKEN_HOLDER || part === AGENT_HOLDER ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: a fixed split of one string
      <span key={i} className="text-warning">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

// DESIGN.md → Settings → Sources → OpenTelemetry setup (#42).
export function OtelSetup({
  endpoint,
  token,
  canEdit,
  reporting,
  agents,
  lastReportAgo,
}: {
  endpoint: string;
  /** The stored token, masked, or null before one is created. */
  token: { masked: string; createdAt: string } | null;
  canEdit: boolean;
  reporting: number;
  agents: number;
  lastReportAgo: string | null;
}) {
  const router = useRouter();
  // The full token, only right after it was created or rotated.
  const [fresh, setFresh] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sources/token", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? "Sign in as the owner first."
            : "Couldn’t create the token. Try again.",
        );
        return;
      }
      setFresh(((await res.json()) as { token: string }).token);
      router.refresh();
    } catch {
      setError("Couldn’t create the token. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const receiving = reporting > 0;
  const env = envBlock(endpoint, fresh ?? TOKEN_HOLDER);

  return (
    <div className="space-y-5">
      <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {receiving ? (
          <>
            <span className="inline-flex items-center gap-1 rounded-md border border-success/20 bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
              <CircleCheckBig className="size-3" aria-hidden />
              Receiving
            </span>
            {reporting} of {agents} agents reporting
            {lastReportAgo && ` · last report ${lastReportAgo}`}
          </>
        ) : (
          <>
            <LoaderCircle className="size-4" aria-hidden />
            No reports yet. This updates by itself when the first agent reports.
          </>
        )}
      </p>

      <ol className="space-y-5">
        <Step n={1} done={token !== null} title="Ingest token">
          {token ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-[13px]">
                  {fresh ?? token.masked}
                </code>
                {fresh && <CopyButton value={fresh} label="Copy token" />}
                <AlertDialog>
                  <AlertDialogTrigger
                    render={
                      <Button
                        variant="outline"
                        className="h-9 max-md:h-11"
                        disabled={!canEdit || busy}
                      />
                    }
                  >
                    <RotateCcw aria-hidden />
                    Rotate
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Rotate the ingest token?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Rotating it stops every agent’s reports until you paste
                        the new one.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction variant="destructive" onClick={create}>
                        Rotate
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
              <p className="text-xs text-muted-foreground">
                {fresh
                  ? "Copy it now. It isn’t shown again."
                  : `created ${new Date(token.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Button
                className="h-9 max-md:h-11"
                disabled={!canEdit || busy}
                onClick={create}
              >
                <KeyRound aria-hidden />
                Create ingest token
              </Button>
              <p className="text-xs text-muted-foreground">
                Agents send it with every report, so nobody else can post
                numbers to your dashboard. Shown once.
              </p>
            </div>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </Step>

        <Step n={2} done={receiving} title="Endpoint">
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-md border bg-muted px-3 py-2 font-mono text-[13px]">
              {endpoint}
            </code>
            <CopyButton value={endpoint} label="Copy endpoint" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Agents must be able to reach this address. It only accepts metrics
            with a valid ingest token.
          </p>
        </Step>

        <Step
          n={3}
          done={receiving}
          title="Add this to each agent’s environment in Buzz Desktop, then restart the agent"
        >
          <div className="relative rounded-md border bg-muted">
            <div className="flex justify-end p-2 sm:absolute sm:top-0 sm:right-0">
              <CopyButton value={env} label="Copy environment" />
            </div>
            <pre className="overflow-x-auto px-3 pb-3 font-mono text-[13px] leading-6 sm:py-3 sm:pr-14">
              <EnvLines text={env} />
            </pre>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Replace the {fresh ? "highlighted value" : "two highlighted values"}
            . The agent name must match its Buzz display name so cost joins the
            right agent.
          </p>
        </Step>
      </ol>
    </div>
  );
}

function Step({
  n,
  done,
  title,
  children,
}: {
  n: number;
  done: boolean;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          done
            ? "bg-success/14 text-success"
            : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="size-3.5" aria-label="Done" /> : n}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium">{title}</p>
        {children}
      </div>
    </li>
  );
}
