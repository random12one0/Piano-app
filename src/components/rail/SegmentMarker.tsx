import type { SegmentStatus } from "@/lib/status";

const SHAPE_CLASS: Record<SegmentStatus, string> = {
  not_started: "rounded-full border-[1.5px] border-foreground-dim bg-transparent",
  in_progress: "rounded-full border-[1.5px] border-accent bg-[linear-gradient(90deg,var(--accent)_50%,transparent_50%)]",
  done: "rounded-full border-[1.5px] border-accent bg-accent",
  needs_review: "rotate-45 border-[1.5px] border-flag bg-flag",
};

export default function SegmentMarker({
  status,
  isCurrent,
  size = 9,
}: {
  status: SegmentStatus;
  isCurrent?: boolean;
  size?: number;
}) {
  return (
    <span
      className={`block shrink-0 transition-transform duration-150 group-hover:scale-125 ${SHAPE_CLASS[status]} ${
        isCurrent ? "ring-2 ring-accent-bright ring-offset-2 ring-offset-background" : ""
      }`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  );
}
