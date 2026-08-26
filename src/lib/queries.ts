import { prisma } from "@/lib/db";

// Explicit selects rather than `include`: the library page is force-dynamic
// and hands these straight to a client component, so every column pulled here
// is serialised into the RSC payload on every load. Notes, transcript
// excerpts, and timestamps for all 361 segments are not on that page.
export async function getSongsWithSegments() {
  return prisma.song.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      title: true,
      instructorNotes: true,
      lastSegmentId: true,
      lastWatchedAt: true,
      segments: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          videoId: true,
          video: { select: { title: true, sourceType: true, sourceRef: true } },
        },
      },
    },
  });
}

export async function getSongWithSegments(songId: string) {
  return prisma.song.findUnique({
    where: { id: songId },
    select: {
      id: true,
      title: true,
      instructorNotes: true,
      sheetMusicKey: true,
      lastSegmentId: true,
      segments: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          title: true,
          status: true,
          notes: true,
          transcriptExcerpt: true,
          videoId: true,
          startSeconds: true,
          endSeconds: true,
          lastWatchedPositionSeconds: true,
          video: { select: { title: true, sourceType: true, sourceRef: true } },
        },
      },
    },
  });
}

export async function getFlaggedSegments() {
  return prisma.segment.findMany({
    where: { status: "needs_review" },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      songId: true,
      title: true,
      notes: true,
      transcriptExcerpt: true,
      video: { select: { title: true } },
      song: { select: { title: true } },
    },
  });
}

export async function getSongs() {
  return prisma.song.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true },
  });
}

export type PracticeSessionRow = {
  songId: string;
  endedAt: Date;
  secondsPracticed: number;
};

/**
 * Raw sessions for the last `days` days. Bucketing into calendar days happens
 * on the client, because the server runs in UTC and the day boundaries that
 * matter are the ones on the user's own clock.
 */
export async function getRecentSessions(days = 365): Promise<PracticeSessionRow[]> {
  const since = new Date(Date.now() - days * 86_400_000);
  return prisma.practiceSession.findMany({
    where: { endedAt: { gte: since } },
    orderBy: { endedAt: "asc" },
    select: { songId: true, endedAt: true, secondsPracticed: true },
  });
}

export async function getSongPracticeSummary(songId: string) {
  const [last, totals] = await Promise.all([
    prisma.practiceSession.findFirst({
      where: { songId },
      orderBy: { endedAt: "desc" },
      select: { endedAt: true, secondsPracticed: true },
    }),
    prisma.practiceSession.aggregate({
      where: { songId },
      _sum: { secondsPracticed: true },
      _count: true,
    }),
  ]);
  return {
    lastEndedAt: last?.endedAt ?? null,
    lastSeconds: last?.secondsPracticed ?? 0,
    totalSeconds: totals._sum.secondsPracticed ?? 0,
    sessionCount: totals._count,
  };
}
