"use client";

import { useCallback, useState } from "react";
import PracticePlayer from "@/components/player/PracticePlayer";
import SegmentList, { type ListSegment } from "@/components/rail/SegmentList";
import SegmentNotes from "./SegmentNotes";
import SegmentStatusControls from "./SegmentStatusControls";
import { formatTimestamp } from "@/lib/format";
import { videoLabel } from "@/components/rail/SegmentRail";
import { updateSegmentStatus, toggleStruggling } from "@/lib/actions";
import { STATUS_LABEL, type SegmentStatus } from "@/lib/status";

export type PracticeCurrent = {
  id: string;
  videoId: string;
  title: string;
  status: SegmentStatus;
  notes: string;
  transcriptExcerpt: string;
  startSeconds: number;
  endSeconds: number;
  lastWatchedPositionSeconds: number;
  video: { title: string; sourceType: string; sourceRef: string };
};

/**
 * Owns the two things the player and the list both need to agree on: the
 * current segment's status, and whether we're in fullscreen. Status lives
 * here so tapping "Done" in the control bar updates the segment list behind
 * it without a round trip; `expanded` lives here because the player itself is
 * keyed by video id, and stepping into the next part would otherwise remount
 * it and drop you out of fullscreen mid-practice.
 */
export default function PracticeSurface({
  songId,
  current,
  segments,
}: {
  songId: string;
  current: PracticeCurrent;
  segments: ListSegment[];
}) {
  const [status, setStatus] = useState<SegmentStatus>(current.status);
  const [expanded, setExpanded] = useState(false);

  const applyStatus = useCallback(
    (next: SegmentStatus) => {
      const previous = status;
      setStatus(next);
      updateSegmentStatus(current.id, next)
        .then((r) => setStatus(r.status))
        .catch(() => setStatus(previous));
    },
    [current.id, status],
  );

  const handleToggleFlag = useCallback(() => {
    const previous = status;
    setStatus(previous === "needs_review" ? "in_progress" : "needs_review");
    // The server decides what clearing a flag restores to — it remembers the
    // status the segment held before it was flagged — so take its answer.
    toggleStruggling(current.id)
      .then((r) => setStatus(r.status))
      .catch(() => setStatus(previous));
  }, [current.id, status]);

  const handleToggleDone = useCallback(() => {
    applyStatus(status === "done" ? "in_progress" : "done");
  }, [applyStatus, status]);

  const index = segments.findIndex((s) => s.id === current.id);
  const part = videoLabel(current.video.title);

  const nowPlaying = (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-xs">
      <span className="text-foreground">
        {part} · #{index + 1}
      </span>
      <span className="tabular-nums text-foreground-dim">
        {formatTimestamp(current.startSeconds)} – {formatTimestamp(current.endSeconds)}
      </span>
      <span
        className={`ml-auto uppercase tracking-wide ${
          status === "needs_review" ? "text-flag" : status === "done" ? "text-accent" : "text-foreground-dim/70"
        }`}
      >
        {STATUS_LABEL[status]}
      </span>
    </div>
  );

  // Keep the list's marker for the current row in sync with the optimistic
  // status above, so "Done" doesn't leave a stale dot sitting under it.
  const listSegments = segments.map((s) => (s.id === current.id ? { ...s, status } : s));

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start lg:gap-12">
      <div className="lg:sticky lg:top-4">
        <PracticePlayer
          key={current.videoId}
          songId={songId}
          segment={{
            id: current.id,
            videoId: current.videoId,
            title: current.title,
            startSeconds: current.startSeconds,
            endSeconds: current.endSeconds,
            lastWatchedPositionSeconds: current.lastWatchedPositionSeconds,
          }}
          video={{ sourceType: current.video.sourceType, sourceRef: current.video.sourceRef }}
          navSegments={segments}
          nowPlaying={nowPlaying}
          statusControls={
            <SegmentStatusControls
              status={status}
              onSetStatus={applyStatus}
              onToggleFlag={handleToggleFlag}
              compact
            />
          }
          expanded={expanded}
          onExpandedChange={setExpanded}
          onToggleDone={handleToggleDone}
        />

        {current.title && (
          <p className="mt-3 font-sans text-sm italic text-foreground-dim">{current.title}</p>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-8">
        <SegmentList songId={songId} segments={listSegments} currentSegmentId={current.id} />

        <SegmentNotes
          key={current.id}
          segmentId={current.id}
          initialNotes={current.notes}
          transcriptExcerpt={current.transcriptExcerpt}
          footer={
            status !== "not_started" ? (
              <button
                type="button"
                onClick={() => applyStatus("not_started")}
                className="cursor-pointer font-mono text-[11px] uppercase tracking-wider text-foreground-dim/70 transition-colors hover:text-accent"
              >
                Mark this segment not started
              </button>
            ) : null
          }
        />
      </div>
    </div>
  );
}
