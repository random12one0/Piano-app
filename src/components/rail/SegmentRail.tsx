import Link from "next/link";
import SegmentMarker from "./SegmentMarker";
import { isValidStatus } from "@/lib/status";
import { LABEL } from "@/lib/ui";

type RailSegment = {
  id: string;
  title: string;
  status: string;
  videoId: string;
  video: { title: string };
};

export function videoLabel(videoTitle: string): string {
  const parts = videoTitle.split("—");
  return parts.length > 1 ? parts[parts.length - 1].trim() : videoTitle;
}

export default function SegmentRail({
  songId,
  segments,
  currentSegmentId,
  wrap = false,
}: {
  songId: string;
  segments: RailSegment[];
  currentSegmentId?: string | null;
  /** Wrap onto multiple rows (grouped per video) instead of scrolling horizontally. */
  wrap?: boolean;
}) {
  if (segments.length === 0) {
    return (
      <p className="font-mono text-xs text-foreground-dim">
        No segments yet — ingest a video to auto-chapter this song.
      </p>
    );
  }

  const rows = segments.map((segment, i) => ({
    segment,
    isNewVideo: i === 0 || segment.videoId !== segments[i - 1].videoId,
    status: isValidStatus(segment.status) ? segment.status : ("not_started" as const),
  }));

  if (wrap) {
    // Library cards get every segment at once instead of a 1,960px-wide
    // horizontal scroller nobody can scroll inside a vertically-scrolling
    // page. No per-part headings here — a wider gap marks each part boundary,
    // which keeps a 48-segment song to about four rows.
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5">
        {rows.map(({ segment, isNewVideo, status }, i) => (
          <Link
            key={segment.id}
            href={`/songs/${songId}?segment=${segment.id}`}
            className={`group relative flex items-center px-1 ${isNewVideo && i > 0 ? "ml-3" : ""}`}
            title={`${videoLabel(segment.video.title)} · ${segment.title} — ${status.replace("_", " ")}`}
          >
            <span className="absolute -inset-3" aria-hidden />
            <SegmentMarker status={status} isCurrent={segment.id === currentSegmentId} />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto pt-5 pb-1">
      <div className="pointer-events-none absolute inset-x-0 top-[44px] h-px bg-rule" aria-hidden />
      <div className="relative flex min-w-max items-start gap-7">
        {rows.map(({ segment, isNewVideo, status }) => {
          return (
            <div key={segment.id} className="relative flex flex-col items-center">
              <span className={`mb-2 h-3 whitespace-nowrap ${LABEL}`}>
                {isNewVideo ? videoLabel(segment.video.title) : ""}
              </span>
              <Link
                href={`/songs/${songId}?segment=${segment.id}`}
                className="group relative z-10 flex flex-col items-center bg-background px-1.5"
                title={`${segment.title} — ${status.replace("_", " ")}`}
              >
                <span className="absolute -inset-2.5" aria-hidden />
                <SegmentMarker status={status} isCurrent={segment.id === currentSegmentId} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
