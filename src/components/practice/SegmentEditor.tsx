"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import TimeInput from "@/components/TimeInput";
import { deleteSegment, splitSegment, updateSegment } from "@/lib/actions";
import { formatTimestamp } from "@/lib/format";
import { LABEL } from "@/lib/ui";

/**
 * Fixing a chapter used to be impossible: nothing in the app could rename,
 * retime, split, or remove a segment, and re-ingesting to correct one
 * appended a duplicate. This is the repair kit for the segment you're on.
 */
export default function SegmentEditor({
  segmentId,
  title,
  startSeconds,
  endSeconds,
  getPlayhead,
}: {
  segmentId: string;
  title: string;
  startSeconds: number;
  endSeconds: number;
  /** Live position, for "split here" — read on demand so typing doesn't rerender. */
  getPlayhead: () => number;
}) {
  const router = useRouter();
  const [draftTitle, setDraftTitle] = useState(title);
  const [start, setStart] = useState(startSeconds);
  const [end, setEnd] = useState(endSeconds);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirty = draftTitle !== title || start !== startSeconds || end !== endSeconds;

  function run(work: () => Promise<unknown>, onDone?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await work();
        onDone?.();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "That didn't work.");
      }
    });
  }

  function handleSave() {
    if (!(end > start)) {
      setError("A segment has to end after it starts.");
      return;
    }
    run(() => updateSegment(segmentId, { title: draftTitle, startSeconds: start, endSeconds: end }));
  }

  function handleSplit() {
    const at = Math.round(getPlayhead());
    if (!(at > start && at < end)) {
      setError(`Playhead is at ${formatTimestamp(at)} — park it inside the segment to split there.`);
      return;
    }
    run(() => splitSegment(segmentId, at));
  }

  function handleDelete() {
    if (!window.confirm("Delete this segment? Its notes and progress go with it.")) return;
    run(() => deleteSegment(segmentId));
  }

  const buttonClass =
    "inline-flex min-h-11 cursor-pointer items-center border border-rule px-3 font-mono text-xs uppercase tracking-wide text-foreground-dim transition-colors hover:border-accent hover:text-accent disabled:opacity-50";

  return (
    <div className="flex flex-col gap-3 border border-rule bg-surface p-3">
      <p className={LABEL}>Edit segment</p>

      <input
        type="text"
        value={draftTitle}
        onChange={(e) => setDraftTitle(e.target.value)}
        placeholder="Name this segment"
        className="min-h-11 w-full border border-rule bg-background px-3 font-sans text-base text-foreground placeholder:text-foreground-dim/60 focus:border-accent focus:outline-none"
      />

      <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-foreground-dim">
        <TimeInput value={start} onChange={setStart} label="Segment start" />
        <span aria-hidden>–</span>
        <TimeInput value={end} onChange={setEnd} label="Segment end" />
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending || !dirty}
          className={`${buttonClass} ${dirty ? "border-accent text-accent" : ""}`}
        >
          {isPending ? "Saving…" : "Save"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleSplit} disabled={isPending} className={buttonClass}>
          ✂ Split at playhead
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={isPending}
          className={`${buttonClass} ml-auto hover:border-flag hover:text-flag`}
        >
          Delete
        </button>
      </div>

      {error && <p className="font-mono text-xs text-flag">{error}</p>}
    </div>
  );
}
