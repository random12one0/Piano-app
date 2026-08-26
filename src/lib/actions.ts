"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
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
  /**
   * Re-chaptering a part used to append a second copy of it with no way to
   * remove either. Pass the existing part's video id to swap it out in place
   * instead — the new segments land where the old ones sat in the song.
   */
  replaceVideoId?: string;
}) {
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

  await prisma.$transaction(async (tx: OrderTx) => {
    const rows = await park(tx, input.songId);

    let insertAt = rows.length;
    if (input.replaceVideoId) {
      const firstReplaced = rows.findIndex((r) => r.videoId === input.replaceVideoId);
      insertAt =
        firstReplaced < 0
          ? rows.length
          : rows.slice(0, firstReplaced).filter((r) => r.videoId !== input.replaceVideoId).length;
      await tx.segment.deleteMany({ where: { songId: input.songId, videoId: input.replaceVideoId } });
    }

    const kept = rows.filter((r) => r.videoId !== input.replaceVideoId).map((r) => r.id);

    // Parked at SCRATCH_ORDER until the final pass hands out real positions.
    const created = await tx.segment.createManyAndReturn({
      data: input.chapters.map((c, i) => ({
        songId: input.songId,
        videoId: video.id,
        order: SCRATCH_ORDER + i,
        title: c.title,
        startSeconds: c.startSeconds,
        endSeconds: c.endSeconds,
        transcriptExcerpt: c.transcriptExcerpt,
      })),
      select: { id: true, order: true },
    });
    const createdIds = created
      .sort((a, b) => a.order - b.order)
      .map((r) => r.id);

    await assignOrder(tx, [
      ...kept.slice(0, insertAt),
      ...createdIds,
      ...kept.slice(insertAt),
    ]);
  }, TX_OPTIONS);

  if (input.replaceVideoId) {
    const stillUsed = await prisma.segment.count({ where: { videoId: input.replaceVideoId } });
    if (stillUsed === 0) await prisma.video.delete({ where: { id: input.replaceVideoId } });
    const song = await prisma.song.findUnique({
      where: { id: input.songId },
      select: { lastSegmentId: true },
    });
    if (song?.lastSegmentId) {
      const exists = await prisma.segment.count({ where: { id: song.lastSegmentId } });
      if (exists === 0) {
        await prisma.song.update({ where: { id: input.songId }, data: { lastSegmentId: null } });
      }
    }
  }

  revalidatePath("/");
  revalidatePath(`/songs/${input.songId}`);
  revalidatePath("/review");
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
      // Notes are deliberately left alone — "reset progress" means status and
      // resume position, not throwing away everything you wrote down.
      data: { status: "not_started", statusBeforeFlag: null, lastWatchedPositionSeconds: 0 },
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
      data: { status: "not_started", statusBeforeFlag: null, lastWatchedPositionSeconds: 0 },
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

// ---------------------------------------------------------------------------
// Editing
//
// `Segment.order` is unique per song, and Postgres checks that per statement,
// so any structural change has to park the affected rows out of the way before
// handing out final positions. `park` moves every segment in a song to a
// negative slot (freeing the whole 0..n range) and returns the current order;
// `assignOrder` then writes the final sequence.
// ---------------------------------------------------------------------------

type OrderTx = Prisma.TransactionClient;

/** A slot no in-song ordering will ever reach, for rows created mid-transaction. */
const SCRATCH_ORDER = 1_000_000;

// Structural edits walk a whole song; Prisma's 5s interactive default is tight
// over a pooled connection.
const TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

async function park(tx: OrderTx, songId: string) {
  const rows = await tx.segment.findMany({
    where: { songId },
    orderBy: { order: "asc" },
    select: { id: true, videoId: true },
  });
  // One statement rather than one per segment: negating every order keeps the
  // values distinct (so the unique constraint holds at every row) while
  // clearing the whole 0..n range for the final pass.
  await tx.$executeRaw`UPDATE "Segment" SET "order" = -"order" - 1 WHERE "songId" = ${songId}`;
  return rows;
}

async function assignOrder(tx: OrderTx, ids: string[]) {
  if (ids.length === 0) return;
  const values = Prisma.join(ids.map((id, i) => Prisma.sql`(${id}::text, ${i}::int)`));
  await tx.$executeRaw`
    UPDATE "Segment" AS s SET "order" = v.ord
    FROM (VALUES ${values}) AS v(id, ord)
    WHERE s.id = v.id
  `;
}

function revalidateSong(songId: string) {
  revalidatePath(`/songs/${songId}`);
  revalidatePath("/");
  revalidatePath("/review");
}

export async function updateSong(songId: string, input: { title: string; instructorNotes: string }) {
  const title = input.title.trim();
  if (!title) throw new Error("Song title is required.");
  await prisma.song.update({
    where: { id: songId },
    data: { title, instructorNotes: input.instructorNotes.trim() },
  });
  revalidateSong(songId);
}

export async function deleteSong(songId: string) {
  // Segments cascade from Song, but Videos don't — they hang off Segment the
  // other way round. Sweep up any that no song references any more, so their
  // transcript lines go with them instead of accumulating forever.
  await prisma.song.delete({ where: { id: songId } });
  await prisma.video.deleteMany({ where: { segments: { none: {} } } });
  revalidatePath("/");
  revalidatePath("/review");
}

export async function updateSegment(
  segmentId: string,
  input: { title?: string; startSeconds?: number; endSeconds?: number },
) {
  const segment = await prisma.segment.findUniqueOrThrow({ where: { id: segmentId } });
  const startSeconds = input.startSeconds ?? segment.startSeconds;
  const endSeconds = input.endSeconds ?? segment.endSeconds;
  if (!(endSeconds > startSeconds)) {
    throw new Error("A segment has to end after it starts.");
  }

  await prisma.segment.update({
    where: { id: segmentId },
    data: {
      title: input.title === undefined ? segment.title : input.title.trim(),
      startSeconds,
      endSeconds,
      // Retiming can strand the resume point outside the segment entirely.
      lastWatchedPositionSeconds: Math.min(
        Math.max(segment.lastWatchedPositionSeconds, startSeconds),
        endSeconds,
      ),
    },
  });
  revalidateSong(segment.songId);
}

export async function deleteSegment(segmentId: string) {
  const segment = await prisma.segment.findUniqueOrThrow({ where: { id: segmentId } });
  const { songId } = segment;

  await prisma.$transaction(async (tx: OrderTx) => {
    const rows = await park(tx, songId);
    await tx.segment.delete({ where: { id: segmentId } });
    await assignOrder(
      tx,
      rows.filter((r) => r.id !== segmentId).map((r) => r.id),
    );
  }, TX_OPTIONS);

  // The song may have been pointing its resume marker at what we just removed.
  await prisma.song.updateMany({
    where: { id: songId, lastSegmentId: segmentId },
    data: { lastSegmentId: null },
  });
  revalidateSong(songId);
}

/** Splits a segment in two at `atSeconds`, keeping both halves in order. */
export async function splitSegment(segmentId: string, atSeconds: number) {
  const segment = await prisma.segment.findUniqueOrThrow({ where: { id: segmentId } });
  const at = Math.round(atSeconds * 100) / 100;
  if (!(at > segment.startSeconds && at < segment.endSeconds)) {
    throw new Error("Pick a split point inside the segment.");
  }

  await prisma.$transaction(async (tx: OrderTx) => {
    const rows = await park(tx, segment.songId);
    // Parked out of the way until the final pass assigns real positions.
    const created = await tx.segment.create({
      data: {
        songId: segment.songId,
        videoId: segment.videoId,
        order: SCRATCH_ORDER,
        title: "",
        startSeconds: at,
        endSeconds: segment.endSeconds,
        transcriptExcerpt: "",
      },
    });
    await tx.segment.update({
      where: { id: segmentId },
      data: {
        endSeconds: at,
        lastWatchedPositionSeconds: Math.min(segment.lastWatchedPositionSeconds, at),
      },
    });

    const ids = rows.map((r) => r.id);
    ids.splice(ids.indexOf(segmentId) + 1, 0, created.id);
    await assignOrder(tx, ids);
  }, TX_OPTIONS);

  revalidateSong(segment.songId);
}

export async function updateVideoTitle(videoId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error("A part needs a title.");
  const video = await prisma.video.update({ where: { id: videoId }, data: { title: trimmed } });
  const first = await prisma.segment.findFirst({ where: { videoId: video.id }, select: { songId: true } });
  if (first) revalidateSong(first.songId);
}

/** Removes a whole part from a song: its segments, then the video itself. */
export async function deleteVideo(songId: string, videoId: string) {
  await prisma.$transaction(async (tx: OrderTx) => {
    const rows = await park(tx, songId);
    await tx.segment.deleteMany({ where: { songId, videoId } });
    await assignOrder(
      tx,
      rows.filter((r) => r.videoId !== videoId).map((r) => r.id),
    );
  }, TX_OPTIONS);

  // Only drop the video once nothing else points at it; transcript lines
  // cascade with it.
  const stillUsed = await prisma.segment.count({ where: { videoId } });
  if (stillUsed === 0) await prisma.video.delete({ where: { id: videoId } });

  const song = await prisma.song.findUnique({ where: { id: songId }, select: { lastSegmentId: true } });
  if (song?.lastSegmentId) {
    const exists = await prisma.segment.count({ where: { id: song.lastSegmentId } });
    if (exists === 0) {
      await prisma.song.update({ where: { id: songId }, data: { lastSegmentId: null } });
    }
  }
  revalidateSong(songId);
}

/**
 * Moves a whole part earlier or later in the song. Lesson series don't always
 * arrive in order — a part ingested late otherwise sits at the end forever.
 */
export async function moveVideo(songId: string, videoId: string, direction: "up" | "down") {
  await prisma.$transaction(async (tx: OrderTx) => {
    const rows = await park(tx, songId);

    const groups: { videoId: string; ids: string[] }[] = [];
    for (const row of rows) {
      const last = groups[groups.length - 1];
      if (!last || last.videoId !== row.videoId) groups.push({ videoId: row.videoId, ids: [row.id] });
      else last.ids.push(row.id);
    }

    const i = groups.findIndex((g) => g.videoId === videoId);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < groups.length) {
      [groups[i], groups[j]] = [groups[j], groups[i]];
    }

    await assignOrder(
      tx,
      groups.flatMap((g) => g.ids),
    );
  }, TX_OPTIONS);
  revalidateSong(songId);
}
