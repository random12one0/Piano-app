"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { updateSegmentStatus, updateSegmentNotes, toggleStruggling } from "@/lib/actions";
import { SEGMENT_STATUSES, STATUS_LABEL, type SegmentStatus } from "@/lib/status";

const NOTES_AUTOSAVE_MS = 1200;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

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
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const savedNotesRef = useRef(initialNotes);
  const notesRef = useRef(initialNotes);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushNotes = useCallback(
    (viaBeacon = false) => {
      const value = notesRef.current;
      if (value === savedNotesRef.current) return;

      if (viaBeacon) {
        // The page is going away — a server action isn't guaranteed to finish,
        // so hand it to the browser to deliver. Marked saved optimistically;
        // there's no UI left to correct either way.
        savedNotesRef.current = value;
        const payload = JSON.stringify({ segmentId, notes: value });
        navigator.sendBeacon?.("/api/notes", new Blob([payload], { type: "application/json" }));
        return;
      }

      const previouslySaved = savedNotesRef.current;
      savedNotesRef.current = value;
      setSaveState("saving");
      updateSegmentNotes(segmentId, value)
        .then(() => setSaveState("saved"))
        .catch(() => {
          // Roll the marker back so the next keystroke or blur retries,
          // instead of assuming this text is safely stored.
          savedNotesRef.current = previouslySaved;
          setSaveState("error");
        });
    },
    [segmentId],
  );

  // Debounced autosave — onBlur alone loses notes, because iOS does not fire
  // blur when you switch apps or lock the phone mid-sentence.
  useEffect(() => {
    notesRef.current = notes;
    if (notes === savedNotesRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flushNotes(), NOTES_AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notes, flushNotes]);

  // Backgrounding, closing, or navigating away all need a final write.
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) flushNotes(true);
    };
    const onPageHide = () => flushNotes(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flushNotes(true);
    };
  }, [flushNotes]);

  function applyStatus(next: SegmentStatus) {
    const previous = status;
    setStatus(next);
    updateSegmentStatus(segmentId, next)
      .then((r) => setStatus(r.status))
      .catch(() => setStatus(previous));
  }

  function handleStruggling() {
    const previous = status;
    setStatus(previous === "needs_review" ? "in_progress" : "needs_review");
    // The server decides what clearing a flag restores to — it remembers what
    // the segment was before it was flagged — so take its answer as final.
    toggleStruggling(segmentId)
      .then((r) => setStatus(r.status))
      .catch(() => setStatus(previous));
  }

  const saveLabel =
    saveState === "error"
      ? "Couldn't save"
      : saveState === "dirty" || saveState === "saving"
        ? "Saving…"
        : saveState === "saved"
          ? "Saved"
          : "";

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
              className={`min-h-11 cursor-pointer border px-4 font-mono text-xs uppercase tracking-wide transition-colors ${
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
          className={`min-h-11 w-full cursor-pointer border px-4 py-3 text-left font-sans text-sm transition-colors ${
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
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-foreground-dim">Notes</p>
          <span
            aria-live="polite"
            className={`font-mono text-[11px] ${
              saveState === "error" ? "text-flag" : "text-foreground-dim/70"
            }`}
          >
            {saveLabel}
          </span>
        </div>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setSaveState("dirty");
          }}
          onBlur={() => flushNotes()}
          placeholder="Fingering, tempo reminders, what to try next time…"
          rows={4}
          // 16px minimum: anything smaller makes iOS Safari zoom the whole
          // viewport the moment the field is focused.
          className="w-full resize-none border border-rule bg-surface px-3 py-2 font-sans text-base text-foreground placeholder:text-foreground-dim/60 focus:border-accent focus:outline-none"
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
