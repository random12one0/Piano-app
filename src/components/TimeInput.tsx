"use client";

import { useState } from "react";
import { formatTimestamp, parseTimestampInput } from "@/lib/format";

/**
 * A timestamp field that edits as text ("4:12") and commits on blur, falling
 * back to the last good value if what you typed isn't a timestamp.
 */
export default function TimeInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (seconds: number) => void;
  label?: string;
}) {
  // Local text only — callers remount this (via key) when the underlying
  // value changes on the server, so there's nothing to synchronise.
  const [text, setText] = useState(() => formatTimestamp(value));

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const parsed = parseTimestampInput(text);
        if (parsed !== null) {
          onChange(parsed);
          setText(formatTimestamp(parsed));
        } else {
          setText(formatTimestamp(value));
        }
      }}
      // 16px minimum, or iOS Safari zooms the viewport on focus.
      className="min-h-11 w-24 border border-rule bg-surface px-2 text-center font-mono text-base tabular-nums text-foreground focus:border-accent focus:outline-none"
    />
  );
}
