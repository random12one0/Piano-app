import { prisma } from "@/lib/db";

// A sitting is "still going" while progress keeps arriving. Longer than any
// realistic pause to fetch sheet music or answer the door; shorter than the
// gap between two genuinely separate practice sessions.
const SESSION_GAP_MS = 15 * 60 * 1000;
// Per-write credit ceiling. Saves arrive every ~5s of media time, so a much
// larger gap means the video was paused or the tab was backgrounded — time
// that shouldn't be counted as practice.
const MAX_STEP_SECONDS = 60;

/**
 * Attributes this write to a practice session, opening one if the last write
 * for this song is older than SESSION_GAP_MS. Recording this way — rather than
 * from explicit start/stop calls — means a phone locked mid-practice still
 * leaves an accurate session behind, because every write already carries the
 * information needed to close one out.
 */
async function recordPracticeTime(songId: string, segmentId: string) {
  const now = new Date();
  const open = await prisma.practiceSession.findFirst({
    where: { songId, endedAt: { gte: new Date(now.getTime() - SESSION_GAP_MS) } },
    orderBy: { endedAt: "desc" },
  });

  if (!open) {
    await prisma.practiceSession.create({
      data: { songId, startedAt: now, endedAt: now, secondsPracticed: 0, segmentIds: [segmentId] },
    });
    return;
  }

  const step = Math.min(
    MAX_STEP_SECONDS,
    Math.max(0, Math.round((now.getTime() - open.endedAt.getTime()) / 1000)),
  );
  await prisma.practiceSession.update({
    where: { id: open.id },
    data: {
      endedAt: now,
      secondsPracticed: open.secondsPracticed + step,
      segmentIds: open.segmentIds.includes(segmentId)
        ? open.segmentIds
        : [...open.segmentIds, segmentId],
    },
  });
}

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

  await recordPracticeTime(segment.songId, segmentId);

  return segment.songId;
}
