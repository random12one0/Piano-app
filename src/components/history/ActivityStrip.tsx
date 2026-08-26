"use client";

import { dayKey, recentDayKeys } from "@/lib/practice";

/**
 * A week at a glance: one cell per day, filled in proportion to how long you
 * sat down. Small enough to ride along on a library card.
 */
export default function ActivityStrip({
  days,
  sessions,
}: {
  days: number;
  sessions: { endedAt: string; secondsPracticed: number }[];
}) {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(new Date(s.endedAt));
    totals.set(key, (totals.get(key) ?? 0) + s.secondsPracticed);
  }

  const keys = recentDayKeys(days);
  const active = keys.filter((k) => (totals.get(k) ?? 0) > 0).length;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-[3px]" aria-hidden>
        {keys.map((key) => {
          const seconds = totals.get(key) ?? 0;
          // Four steps, topping out around twenty minutes — enough resolution
          // to tell a quick run-through from a real sitting.
          const level = seconds === 0 ? 0 : seconds < 300 ? 1 : seconds < 1200 ? 2 : 3;
          return (
            <span
              key={key}
              title={`${key}: ${Math.round(seconds / 60)} min`}
              className={`block h-2.5 w-2.5 ${
                level === 0
                  ? "bg-surface-raised"
                  : level === 1
                    ? "bg-accent/30"
                    : level === 2
                      ? "bg-accent/60"
                      : "bg-accent"
              }`}
            />
          );
        })}
      </div>
      <span className="font-mono text-[11px] tabular-nums text-foreground-dim/70">
        {active}/{days}
      </span>
    </div>
  );
}
