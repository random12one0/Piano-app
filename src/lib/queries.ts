import { prisma } from "@/lib/db";

export async function getSongsWithSegments() {
  return prisma.song.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      segments: {
        orderBy: { order: "asc" },
        include: { video: true },
      },
    },
  });
}

export async function getSongWithSegments(songId: string) {
  return prisma.song.findUnique({
    where: { id: songId },
    include: {
      segments: {
        orderBy: { order: "asc" },
        include: { video: true },
      },
    },
  });
}

export async function getSegment(segmentId: string) {
  return prisma.segment.findUnique({
    where: { id: segmentId },
    include: { video: true, song: true },
  });
}

export async function getFlaggedSegments() {
  return prisma.segment.findMany({
    where: { status: "needs_review" },
    orderBy: { updatedAt: "desc" },
    include: { video: true, song: true },
  });
}

export async function getSongs() {
  return prisma.song.findMany({ orderBy: { createdAt: "asc" } });
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
