"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { updateSegmentNotes } from "@/lib/actions";
import { LABEL } from "@/lib/ui";

const AUTOSAVE_MS = 1200;

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export default function SegmentNotes({
  segmentId,
  initialNotes,
  transcriptExcerpt,
  footer,
}: {
  segmentId: string;
  initialNotes: string;
  transcriptExcerpt: string;
  /** Rare per-segment actions that don't earn a spot in the control bar. */
  footer?: ReactNode;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const savedRef = useRef(initialNotes);
  const notesRef = useRef(initialNotes);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(
    (viaBeacon = false) => {
      const value = notesRef.current;
      if (value === savedRef.current) return;

      if (viaBeacon) {
        // The page is going away — a server action isn't guaranteed to land,
        // so hand delivery to the browser.
        savedRef.current = value;
        const payload = JSON.stringify({ segmentId, notes: value });
        navigator.sendBeacon?.("/api/notes", new Blob([payload], { type: "application/json" }));
        return;
      }

      const previous = savedRef.current;
      savedRef.current = value;
      setSaveState("saving");
      updateSegmentNotes(segmentId, value)
        .then(() => setSaveState("saved"))
        .catch(() => {
          // Roll back so the next keystroke retries rather than assuming
          // this text is safely stored.
          savedRef.current = previous;
          setSaveState("error");
        });
    },
    [segmentId],
  );

  // Debounced autosave. onBlur alone loses notes: iOS never fires blur when
  // you switch apps or lock the phone mid-sentence.
  useEffect(() => {
    notesRef.current = notes;
    if (notes === savedRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => flush(), AUTOSAVE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notes, flush]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [flush]);

  const saveLabel =
    saveState === "error"
      ? "Couldn't save"
      : saveState === "dirty" || saveState === "saving"
        ? "Saving…"
        : saveState === "saved"
          ? "Saved"
          : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className={LABEL}>Notes</p>
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
          onBlur={() => flush()}
          placeholder="Fingering, tempo reminders, what to try next time…"
          rows={4}
          // 16px minimum, or iOS Safari zooms the viewport on focus.
          className="w-full resize-none border border-rule bg-surface px-3 py-2 font-sans text-base text-foreground placeholder:text-foreground-dim/60 focus:border-accent focus:outline-none"
        />
      </div>

      {transcriptExcerpt && (
        <div>
          <p className={`mb-3 ${LABEL}`}>
            From the lesson
          </p>
          <p className="border-l-2 border-rule pl-4 font-sans text-sm italic text-foreground-dim">
            &ldquo;{transcriptExcerpt}&rdquo;
          </p>
        </div>
      )}

      {footer}
    </div>
  );
}
