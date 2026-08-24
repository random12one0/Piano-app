-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Song" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "instructorNotes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSegmentId" TEXT,
    "lastWatchedAt" TIMESTAMP(3),
    "sheetMusicKey" TEXT,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Video" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "durationSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Video_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptLine" (
    "id" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "text" TEXT NOT NULL,

    CONSTRAINT "TranscriptLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "videoId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "startSeconds" DOUBLE PRECISION NOT NULL,
    "endSeconds" DOUBLE PRECISION NOT NULL,
    "transcriptExcerpt" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "notes" TEXT NOT NULL DEFAULT '',
    "lastWatchedPositionSeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptLine_videoId_startSeconds_idx" ON "TranscriptLine"("videoId", "startSeconds");

-- CreateIndex
CREATE INDEX "Segment_songId_order_idx" ON "Segment"("songId", "order");

-- AddForeignKey
ALTER TABLE "TranscriptLine" ADD CONSTRAINT "TranscriptLine_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_videoId_fkey" FOREIGN KEY ("videoId") REFERENCES "Video"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

