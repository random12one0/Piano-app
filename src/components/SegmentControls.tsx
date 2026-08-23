"use client";

import { useState, useTransition } from "react";
import { updateSegmentStatus, updateSegmentNotes, toggleStruggling } from "@/lib/actions";
import { SEGMENT_STATUSES, STATUS_LABEL, type SegmentStatus } from "@/lib/status";

export default function SegmentControls({
  segmentId,
  initialStatus,
  initialNotes,
  transcriptExcerpt,
}: {
  segmentId: string;
  initialStatus: SegmentStatus;
  initialNotes: string;
  transcriptExcerpt: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [notes, setNotes] = useState(initialNotes);
  const [savedNotes, setSavedNotes] = useState(initialNotes);
  const [, startTransition] = useTransition();

  function applyStatus(next: SegmentStatus) {
    setStatus(next);
    startTransition(() => {
      updateSegmentStatus(segmentId, next);
    });
  }

  function handleStruggling() {
    const next: SegmentStatus = status === "needs_review" ? "in_progress" : "needs_review";
    setStatus(next);
    startTransition(() => {
      toggleStruggling(segmentId);
    });
  }

  function saveNotes() {
    if (notes === savedNotes) return;
    setSavedNotes(notes);
    startTransition(() => {
      updateSegmentNotes(segmentId, notes);
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-foreground-dim">Status</p>
        <div className="flex flex-wrap gap-2">
          {SEGMENT_STATUSES.filter((s) => s !== "needs_review").map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applyStatus(s)}
              aria-pressed={status === s}
              className={`cursor-pointer border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                status === s
                  ? "border-accent bg-accent text-accent-contrast"
                  : "border-rule text-foreground-dim hover:border-accent hover:text-accent"
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={handleStruggling}
          aria-pressed={status === "needs_review"}
          className={`w-full cursor-pointer border px-4 py-3 text-left font-sans text-sm transition-colors ${
            status === "needs_review"
              ? "border-flag bg-flag/10 text-flag"
              : "border-rule text-foreground-dim hover:border-flag hover:text-flag"
          }`}
        >
          {status === "needs_review"
            ? "◆ Struggling with this — in review queue"
            : "◇ Struggling with this? Flag for review"}
        </button>
      </div>

      <div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-foreground-dim">Notes</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Fingering, tempo reminders, what to try next time…"
          rows={4}
          className="w-full resize-none border border-rule bg-surface px-3 py-2 font-sans text-sm text-foreground placeholder:text-foreground-dim/60 focus:border-accent focus:outline-none"
        />
      </div>

      {transcriptExcerpt && (
        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-foreground-dim">
            From the lesson
          </p>
          <p className="border-l-2 border-rule pl-4 font-sans text-sm italic text-foreground-dim">
            &ldquo;{transcriptExcerpt}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}
