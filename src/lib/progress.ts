import { prisma } from "@/lib/db";

// Raw DB write for a progress tick — no cache revalidation. Shared by the
// `recordProgress` server action (interactive saves) and the /api/progress
// route (periodic in-playback saves and teardown-time sendBeacon flushes,
// where revalidating would be wasted work).
//
// `didPlay` distinguishes "the user actually watched something" from "the
// player merely existed". Only real playback may promote a segment out of
// `not_started` or move the song's resume pointer — otherwise opening a song
// and backing straight out would mark it in progress and take over the
// "Continue practicing" list, and an explicit "Not started" would be undone
// by the next tick.
export async function writeProgressToDb(
  segmentId: string,
  positionSeconds: number,
  didPlay: boolean,
): Promise<string | null> {
  const segment = await prisma.segment.findUnique({ where: { id: segmentId } });
  if (!segment) return null;
  if (!didPlay) return segment.songId;

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
