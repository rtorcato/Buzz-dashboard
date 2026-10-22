"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useSettings } from "@/lib/settings";

const COUNT_PREFIX = /^\(\d+\) /;

// Applies the browser-side preferences that no single page owns: density and
// motion on <html>, the tab-title count, and the desktop notification.
export function AppEffects({ needsYou }: { needsYou: number }) {
  const { density, motion, tabCount, notify } = useSettings();
  const path = usePathname();
  const previous = useRef(needsYou);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    document.documentElement.dataset.motion = motion;
  }, [density, motion]);

  // Next rewrites the title on navigation, so re-apply the count when it does.
  // biome-ignore lint/correctness/useExhaustiveDependencies: path re-runs the effect after a navigation
  useEffect(() => {
    const apply = () => {
      const bare = document.title.replace(COUNT_PREFIX, "");
      const next = tabCount && needsYou > 0 ? `(${needsYou}) ${bare}` : bare;
      if (document.title !== next) document.title = next;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => observer.disconnect();
  }, [tabCount, needsYou, path]);

  useEffect(() => {
    if (
      notify &&
      needsYou > previous.current &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      new Notification("Hive", { body: `${needsYou} need you` });
    }
    previous.current = needsYou;
  }, [needsYou, notify]);

  return null;
}
