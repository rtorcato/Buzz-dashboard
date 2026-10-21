"use client";

import { useEffect, useState } from "react";

// A clock time in the viewer's timezone ("9:00 PM", or "Sun 12:00 PM" with
// `weekday`). Empty until mounted: the server's timezone isn't the viewer's.
export function LocalTime({ at, weekday }: { at: number; weekday?: boolean }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(
      new Date(at * 1000).toLocaleString([], {
        weekday: weekday ? "short" : undefined,
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }, [at, weekday]);
  return <time dateTime={new Date(at * 1000).toISOString()}>{text}</time>;
}
