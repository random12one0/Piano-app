export type SegmentStatus = "not_started" | "in_progress" | "needs_review" | "done";

export const SEGMENT_STATUSES: SegmentStatus[] = ["not_started", "in_progress", "needs_review", "done"];

export const STATUS_LABEL: Record<SegmentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  needs_review: "Struggling",
  done: "Done",
};

export function isValidStatus(value: string): value is SegmentStatus {
  return (SEGMENT_STATUSES as string[]).includes(value);
}
