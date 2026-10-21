"use client";

import { useEffect, useState } from "react";
import { formatClock } from "@/lib/format-time";
import { useSettings } from "@/lib/settings";

// A clock time in the viewer's timezone ("9:00 PM", or "Sun 12:00 PM" with
// `weekday`), following the Time settings. Empty until mounted: the server's
// timezone isn't the viewer's.
export function LocalTime({ at, weekday }: { at: number; weekday?: boolean }) {
  const { clock, timeZone, timestamps } = useSettings();
  const [text, setText] = useState("");
  useEffect(() => {
    setText(
      formatClock(
        new Date(at * 1000),
        { clock, timeZone, timestamps },
        weekday,
      ),
    );
  }, [at, weekday, clock, timeZone, timestamps]);
  return <time dateTime={new Date(at * 1000).toISOString()}>{text}</time>;
}
