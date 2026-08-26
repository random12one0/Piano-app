"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { writeProgressToDb } from "@/lib/progress";
import { isValidStatus, type SegmentStatus } from "@/lib/status";
import type { ParsedCaptionLine } from "@/lib/captions";
import type { ChapterProposal } from "@/lib/chaptering";

export async function createSong(input: { title: string; instructorNotes?: string }) {
  const title = input.title.trim();
  if (!title) throw new Error("Song title is required.");
  const song = await prisma.song.create({
    data: { title, instructorNotes: input.instructorNotes?.trim() ?? "" },
  });
  revalidatePath("/");
  return { id: song.id };
}

export async function createVideoWithSegments(input: {
  songId: string;
  videoTitle: string;
  sourceType: "youtube" | "local";
  sourceRef: string;
  durationSeconds?: number;
  transcriptLines: ParsedCaptionLine[];
  chapters: ChapterProposal[];
}) {
  const existingCount = await prisma.segment.count({ where: { songId: input.songId } });

  const video = await prisma.video.create({
    data: {
      title: input.videoTitle.trim() || "Untitled video",
      sourceType: input.sourceType,
      sourceRef: input.sourceRef.trim(),
      durationSeconds: input.durationSeconds,
      transcriptLines: {
        create: input.transcriptLines.map((l) => ({
          startSeconds: l.startSeconds,
          endSeconds: l.endSeconds,
          text: l.text,
        })),
      },
    },
  });

  await prisma.segment.createMany({
    data: input.chapters.map((c, i) => ({
      songId: input.songId,
      videoId: video.id,
      order: existingCount + i,
      title: c.title,
      startSeconds: c.startSeconds,
      endSeconds: c.endSeconds,
      transcriptExcerpt: c.transcriptExcerpt,
    })),
  });

  revalidatePath("/");
  revalidatePath(`/songs/${input.songId}`);
  return { videoId: video.id };
}

export async function updateSegmentStatus(segmentId: string, status: string) {
  if (!isValidStatus(status)) throw new Error(`Invalid status: ${status}`);

  let songId: string;
  let finalStatus: string;

  if (status === "done") {
    // Marking a segment done also marks everything before it (in song
    // order, across all of the song's videos) done — so practicing through
    // a song only ever needs one "Done" click at wherever you stopped,
    // rather than one per segment. Segments already flagged "needs_review"
    // are left alone rather than silently cleared.
    const target = await prisma.segment.findUniqueOrThrow({ where: { id: segmentId } });
    const [updated] = await prisma.$transaction([
      prisma.segment.update({ where: { id: segmentId }, data: { status, statusBeforeFlag: null } }),
      prisma.segment.updateMany({
        where: {
          songId: target.songId,
          order: { lt: target.order },
          status: { not: "needs_review" },
        },
        data: { status: "done" },
      }),
    ]);
    songId = updated.songId;
    finalStatus = updated.status;
  } else {
    const segment = await prisma.segment.update({
      where: { id: segmentId },
      data: { status, statusBeforeFlag: null },
    });
    songId = segment.songId;
    finalStatus = segment.status;
  }

  revalidatePath(`/songs/${songId}`);
  revalidatePath("/");
  revalidatePath("/review");
  return { status: finalStatus as SegmentStatus };
}

export async function toggleStruggling(segmentId: string) {
  const segment = await prisma.segment.findUniqueOrThrow({ where: { id: segmentId } });
  const isFlagged = segment.status === "needs_review";

  // Clearing a flag restores whatever the segment was before it was flagged,
  // so flagging a finished segment and then clearing it doesn't quietly drop
  // it back to "in progress" and dent the completion count. Segments flagged
  // before this column existed fall back to "in_progress".
  const nextStatus: SegmentStatus = isFlagged
    ? ((segment.statusBeforeFlag as SegmentStatus | null) ?? "in_progress")
    : "needs_review";

  await prisma.segment.update({
    where: { id: segmentId },
    data: {
      status: nextStatus,
      statusBeforeFlag: isFlagged ? null : segment.status,
    },
  });

  revalidatePath(`/songs/${segment.songId}`);
  revalidatePath("/review");
  revalidatePath("/");
  return { status: nextStatus };
}

export async function updateSegmentNotes(segmentId: string, notes: string) {
  const segment = await prisma.segment.update({
    where: { id: segmentId },
    data: { notes },
  });
  revalidatePath(`/songs/${segment.songId}`);
  return { notes: segment.notes };
}

export async function resetSongProgress(songId: string) {
  await prisma.$transaction([
    prisma.segment.updateMany({
      where: { songId },
      data: { status: "not_started", notes: "", lastWatchedPositionSeconds: 0 },
    }),
    prisma.song.update({
      where: { id: songId },
      data: { lastSegmentId: null, lastWatchedAt: null },
    }),
  ]);
  revalidatePath(`/songs/${songId}`);
  revalidatePath("/");
  revalidatePath("/review");
}

export async function resetAllProgress() {
  await prisma.$transaction([
    prisma.segment.updateMany({
      data: { status: "not_started", notes: "", lastWatchedPositionSeconds: 0 },
    }),
    prisma.song.updateMany({
      data: { lastSegmentId: null, lastWatchedAt: null },
    }),
  ]);
  revalidatePath("/", "layout");
}

// Interactive save — used for the moments that change what's on screen
// (pausing, switching segment, leaving the page), so it revalidates. The
// periodic every-few-seconds save during playback goes through
// /api/progress instead, which skips revalidation: re-rendering the whole
// song page mid-video costs a DB round-trip and a React reconciliation for
// data nothing visible consumes.
export async function recordProgress(segmentId: string, positionSeconds: number, didPlay = true) {
  const songId = await writeProgressToDb(segmentId, positionSeconds, didPlay);
  if (!songId || !didPlay) return;
  revalidatePath(`/songs/${songId}`);
  revalidatePath("/");
}
