"use client";

import type { SegmentStatus } from "@/lib/status";

/**
 * The two status actions you reach for mid-practice, sized for a thumb and
 * rendered inside the player's control bar so they're available inline *and*
 * in fullscreen — previously they lived in a sibling panel that the
 * fullscreen overlay covered, so flagging a hard passage at the piano meant
 * leaving fullscreen, scrolling, tapping, and going back in.
 */
export default function SegmentStatusControls({
  status,
  onSetStatus,
  onToggleFlag,
  compact = false,
}: {
  status: SegmentStatus;
  onSetStatus: (next: SegmentStatus) => void;
  onToggleFlag: () => void;
  compact?: boolean;
}) {
  const isDone = status === "done";
  const isFlagged = status === "needs_review";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onSetStatus(isDone ? "in_progress" : "done")}
        aria-pressed={isDone}
        title={isDone ? "Marked done" : "Mark done up to here"}
        className={`inline-flex min-h-11 cursor-pointer items-center border px-3 font-mono text-xs uppercase tracking-wide transition-colors ${
          isDone
            ? "border-accent bg-accent text-accent-contrast"
            : "border-rule text-foreground-dim hover:border-accent hover:text-accent"
        }`}
      >
        {isDone ? "✓ Done" : "Done"}
      </button>

      <button
        type="button"
        onClick={onToggleFlag}
        aria-pressed={isFlagged}
        title={isFlagged ? "In the review queue" : "Flag as struggling"}
        className={`inline-flex min-h-11 cursor-pointer items-center border px-3 font-mono text-xs uppercase tracking-wide transition-colors ${
          isFlagged
            ? "border-flag bg-flag/10 text-flag"
            : "border-rule text-foreground-dim hover:border-flag hover:text-flag"
        }`}
      >
        {isFlagged ? "◆ Flagged" : compact ? "◇ Flag" : "◇ Struggling"}
      </button>
    </div>
  );
}
