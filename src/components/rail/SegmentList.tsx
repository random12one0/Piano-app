"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import SegmentMarker from "./SegmentMarker";
import { videoLabel } from "./SegmentRail";
import { formatTimestamp } from "@/lib/format";
import { isValidStatus } from "@/lib/status";

export type ListSegment = {
  id: string;
  title: string;
  status: string;
  videoId: string;
  startSeconds: number;
  endSeconds: number;
  video: { title: string };
};

/**
 * The song's segments as a scannable list rather than a row of dots.
 *
 * The auto-generated titles are just the instructor's first sentence, often
 * truncated mid-word and frequently meaningless ("Moving on", "One two
 * three"), so they can't carry navigation on their own. The position — part,
 * index, timestamp — is what actually lets you find your place, so that's
 * the label; the transcript snippet rides along underneath as a hint.
 */
export default function SegmentList({
  songId,
  segments,
  currentSegmentId,
}: {
  songId: string;
  segments: ListSegment[];
  currentSegmentId?: string | null;
}) {
  const currentRef = useRef<HTMLAnchorElement>(null);

  // With 48 segments the current one is usually far off-screen on arrival.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentSegmentId]);

  if (segments.length === 0) {
    return (
      <p className="font-mono text-xs text-foreground-dim">
        No segments yet — ingest a video to auto-chapter this song.
      </p>
    );
  }

  const groups: { videoId: string; label: string; items: ListSegment[] }[] = [];
  for (const segment of segments) {
    const last = groups[groups.length - 1];
    if (!last || last.videoId !== segment.videoId) {
      groups.push({
        videoId: segment.videoId,
        label: videoLabel(segment.video.title),
        items: [segment],
      });
    } else {
      last.items.push(segment);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => {
        const done = group.items.filter((s) => s.status === "done").length;
        return (
          <section key={group.videoId}>
            <div className="mb-1 flex items-baseline justify-between gap-3 border-b border-rule/60 pb-1.5">
              <h3 className="truncate font-mono text-[11px] uppercase tracking-wider text-foreground-dim">
                {group.label}
              </h3>
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-foreground-dim/70">
                {done}/{group.items.length}
              </span>
            </div>
            <ul>
              {group.items.map((segment, i) => {
                const status = isValidStatus(segment.status) ? segment.status : "not_started";
                const isCurrent = segment.id === currentSegmentId;
                return (
                  <li key={segment.id}>
                    <Link
                      ref={isCurrent ? currentRef : undefined}
                      href={`/songs/${songId}?segment=${segment.id}`}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`flex min-h-14 items-center gap-3 border-l-2 py-2 pr-2 pl-3 transition-colors ${
                        isCurrent
                          ? "border-accent bg-accent/10"
                          : "border-transparent hover:bg-surface/60"
                      }`}
                    >
                      <SegmentMarker status={status} isCurrent={isCurrent} size={10} />
                      <span
                        className={`w-7 shrink-0 font-mono text-xs tabular-nums ${
                          isCurrent ? "text-accent" : "text-foreground-dim/70"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block font-mono text-xs tabular-nums ${
                            isCurrent ? "text-foreground" : "text-foreground-dim"
                          }`}
                        >
                          {formatTimestamp(segment.startSeconds)} –{" "}
                          {formatTimestamp(segment.endSeconds)}
                        </span>
                        {segment.title && (
                          <span className="mt-0.5 block truncate font-sans text-sm text-foreground-dim/70">
                            {segment.title}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
