"use client";

import { formatMinutes, relativeDay } from "@/lib/practice";

/**
 * Client-side so "yesterday" and "Tuesday" are worked out on the viewer's
 * clock — the server runs in UTC and would get the day wrong either side of
 * midnight.
 */
export default function LastPracticed({ at, seconds }: { at: string; seconds: number }) {
  return (
    <span>
      Last practiced {relativeDay(new Date(at))}
      {seconds > 0 ? ` · ${formatMinutes(seconds)}` : ""}
    </span>
  );
}
