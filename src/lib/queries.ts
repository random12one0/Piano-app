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
