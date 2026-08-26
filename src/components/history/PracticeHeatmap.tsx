"use client";

import { dayKey, formatMinutes, recentDayKeys } from "@/lib/practice";

const WEEKS = 26;

/**
 * Half a year of practice, a column per week. Deliberately not a scoreboard —
 * there's no streak counter and nothing to break; it's a record of when you
 * actually sat down.
 */
export default function PracticeHeatmap({
  sessions,
}: {
  sessions: { endedAt: string; secondsPracticed: number }[];
}) {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(new Date(s.endedAt));
    totals.set(key, (totals.get(key) ?? 0) + s.secondsPracticed);
  }

  // Start on the Sunday that begins the earliest week we're showing, so every
  // column is a whole calendar week and the rows line up as weekdays.
  const today = new Date();
  const leadIn = today.getDay();
  const keys = recentDayKeys(WEEKS * 7 + leadIn, today);

  const columns: string[][] = [];
  for (let i = 0; i < keys.length; i += 7) columns.push(keys.slice(i, i + 7));

  const grandTotal = [...totals.values()].reduce((a, b) => a + b, 0);
  const activeDays = [...totals.values()].filter((v) => v > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-max gap-[3px]">
          {columns.map((week, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {week.map((key) => {
                const seconds = totals.get(key) ?? 0;
                const level = seconds === 0 ? 0 : seconds < 300 ? 1 : seconds < 1200 ? 2 : 3;
                return (
                  <span
                    key={key}
                    title={seconds > 0 ? `${key} · ${formatMinutes(seconds)}` : key}
                    className={`block h-3 w-3 ${
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
          ))}
        </div>
      </div>

      <p className="font-mono text-xs text-foreground-dim">
        {activeDays} {activeDays === 1 ? "day" : "days"} at the piano · {formatMinutes(grandTotal)}{" "}
        in the last {WEEKS} weeks
      </p>
    </div>
  );
}
