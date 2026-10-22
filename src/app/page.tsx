"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSettings } from "@/lib/settings";

// "Open on" is a browser preference, so the redirect happens in the browser.
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    // Read the store directly: the hook still holds the server default on the
    // first effect after hydration.
    router.replace(`/${getSettings().openOn}`);
  }, [router]);
  return null;
}
