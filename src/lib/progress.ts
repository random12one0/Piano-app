import { prisma } from "@/lib/db";

// Raw DB write for a progress tick — no cache revalidation. Shared by the
// `recordProgress` server action (interactive saves) and the /api/progress
// route (teardown-time sendBeacon flush, where no client remains to see a
// revalidated cache).
export async function writeProgressToDb(segmentId: string, positionSeconds: number): Promise<string> {
  const segment = await prisma.segment.findUniqueOrThrow({ where: { id: segmentId } });
  const nextStatus = segment.status === "not_started" ? "in_progress" : segment.status;

  await prisma.$transaction([
    prisma.segment.update({
      where: { id: segmentId },
      data: { lastWatchedPositionSeconds: positionSeconds, status: nextStatus },
    }),
    prisma.song.update({
      where: { id: segment.songId },
      data: { lastSegmentId: segmentId, lastWatchedAt: new Date() },
    }),
  ]);

  return segment.songId;
}
