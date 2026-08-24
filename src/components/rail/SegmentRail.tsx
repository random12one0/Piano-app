import Link from "next/link";
import SegmentMarker from "./SegmentMarker";
import { isValidStatus } from "@/lib/status";

type RailSegment = {
  id: string;
  title: string;
  status: string;
  videoId: string;
  video: { title: string };
};

function videoLabel(videoTitle: string): string {
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
    const groups: { videoId: string; label: string; items: typeof rows }[] = [];
    for (const row of rows) {
      if (row.isNewVideo) {
        groups.push({ videoId: row.segment.videoId, label: videoLabel(row.segment.video.title), items: [] });
      }
      groups[groups.length - 1].items.push(row);
    }

    return (
      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.videoId}>
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-foreground-dim/60">
              {group.label}
            </p>
            <div className="relative pt-1 pb-1">
              <div className="pointer-events-none absolute inset-x-0 top-[13px] h-px bg-rule" aria-hidden />
              <div className="relative flex flex-wrap items-start gap-x-5 gap-y-3">
                {group.items.map(({ segment, status }) => (
                  <Link
                    key={segment.id}
                    href={`/songs/${songId}?segment=${segment.id}`}
                    className="group relative z-10 flex flex-col items-center bg-background px-1"
                    title={`${segment.title} — ${status.replace("_", " ")}`}
                  >
                    <SegmentMarker status={status} isCurrent={segment.id === currentSegmentId} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto pt-5 pb-1">
      <div className="pointer-events-none absolute inset-x-0 top-[34px] h-px bg-rule" aria-hidden />
      <div className="relative flex min-w-max items-start gap-7">
        {rows.map(({ segment, isNewVideo, status }) => {
          return (
            <div key={segment.id} className="relative flex flex-col items-center">
              <span className="mb-2 h-3 whitespace-nowrap font-mono text-[10px] uppercase tracking-wider text-foreground-dim/60">
                {isNewVideo ? videoLabel(segment.video.title) : ""}
              </span>
              <Link
                href={`/songs/${songId}?segment=${segment.id}`}
                className="group relative z-10 flex flex-col items-center bg-background px-1.5"
                title={`${segment.title} — ${status.replace("_", " ")}`}
              >
                <SegmentMarker status={status} isCurrent={segment.id === currentSegmentId} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
