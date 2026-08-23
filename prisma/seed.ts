import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const dbUrl = `file:${path.join(__dirname, "dev.db")}`;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });

type SeedSegment = {
  title: string;
  start: number;
  end: number;
  excerpt: string;
  status: "not_started" | "in_progress" | "needs_review" | "done";
  notes?: string;
  lastWatched?: number;
};

type SeedVideo = {
  title: string;
  sourceType: "youtube" | "local";
  sourceRef: string;
  duration: number;
  segments: SeedSegment[];
};

type SeedSong = {
  title: string;
  instructorNotes: string;
  videos: SeedVideo[];
  // index of the video (within `videos`) and segment (within that video's
  // segments) the user last resumed — used to set Song.lastSegmentId
  lastPosition?: [videoIndex: number, segmentIndex: number];
};

const songs: SeedSong[] = [
  {
    title: "River Flows in You",
    instructorNotes:
      "Yiruma arrangement. Instructor teaches right hand first, then left hand, then combines at half speed before full tempo.",
    videos: [
      {
        title: "River Flows in You — Part 1: Right Hand",
        sourceType: "youtube",
        sourceRef: "dQw4w9WgXcQ",
        duration: 612,
        segments: [
          {
            title: "Intro & hand position",
            start: 0,
            end: 96,
            excerpt:
              "So today we're going to break this down into three parts. First let's just get comfortable with the right hand melody, nice and slow.",
            status: "done",
            lastWatched: 96,
          },
          {
            title: "Right hand, mm. 1–8",
            start: 96,
            end: 288,
            excerpt:
              "Notice the pattern repeats every two bars — once you have that shape under your fingers the rest follows the same logic.",
            status: "done",
            lastWatched: 288,
          },
          {
            title: "Right hand, mm. 9–16 (the lift)",
            start: 288,
            end: 480,
            excerpt:
              "This is where people usually get stuck — the melody jumps up an octave here, so plan your fingering ahead of time.",
            status: "in_progress",
            notes: "Still tripping on the octave jump at bar 12. Try fingers 5-2 instead of 5-1.",
            lastWatched: 340,
          },
          {
            title: "Right hand, full phrase at tempo",
            start: 480,
            end: 612,
            excerpt: "Now let's put it together at performance tempo, no stopping.",
            status: "not_started",
          },
        ],
      },
      {
        title: "River Flows in You — Part 2: Left Hand",
        sourceType: "youtube",
        sourceRef: "dQw4w9WgXcQ",
        duration: 540,
        segments: [
          {
            title: "Left hand arpeggio pattern",
            start: 0,
            end: 210,
            excerpt:
              "The left hand is really just one arpeggio shape moved around — root, fifth, octave, fifth, over and over.",
            status: "in_progress",
            notes: "Getting smoother but still tensing my wrist. Practice slower with a metronome.",
            lastWatched: 140,
          },
          {
            title: "Left hand across the bridge",
            start: 210,
            end: 420,
            excerpt: "Here the pattern shifts down a third — don't let your hand shape go on autopilot.",
            status: "needs_review",
            notes: "Keep losing the shape when it shifts — flagged to revisit.",
          },
          {
            title: "Left hand, full section",
            start: 420,
            end: 540,
            excerpt: "Let's run the whole left hand part start to finish.",
            status: "not_started",
          },
        ],
      },
      {
        title: "River Flows in You — Part 3: Hands Together",
        sourceType: "youtube",
        sourceRef: "dQw4w9WgXcQ",
        duration: 480,
        segments: [
          {
            title: "Hands together, half speed",
            start: 0,
            end: 240,
            excerpt: "We'll drop the tempo way down and just focus on landing both hands together.",
            status: "not_started",
          },
          {
            title: "Full performance tempo",
            start: 240,
            end: 480,
            excerpt: "And here's the piece at full tempo, the way it's meant to sound.",
            status: "not_started",
          },
        ],
      },
    ],
    lastPosition: [0, 2],
  },
  {
    title: "Clair de Lune (opening excerpt)",
    instructorNotes: "Debussy. Focus on voicing the melody over the moving inner texture.",
    videos: [
      {
        title: "Clair de Lune — Voicing the Opening",
        sourceType: "youtube",
        sourceRef: "5qap5aO4i9A",
        duration: 505,
        segments: [
          {
            title: "Reading the opening chords",
            start: 0,
            end: 150,
            excerpt: "These aren't just chords — the top note is always the melody, so it needs to sing out.",
            status: "done",
            lastWatched: 150,
          },
          {
            title: "Balancing melody over texture",
            start: 150,
            end: 340,
            excerpt: "Practice playing the top voice forte and everything underneath at a whisper.",
            status: "needs_review",
            notes: "My inner voices are still too loud. Flagged — needs another pass.",
          },
          {
            title: "Pedaling through the phrase",
            start: 340,
            end: 505,
            excerpt: "Change the pedal on every harmony change, not on a fixed count.",
            status: "not_started",
          },
        ],
      },
    ],
    lastPosition: [0, 1],
  },
  {
    title: "Fly Me to the Moon — Jazz Arrangement",
    instructorNotes: "Swing feel, walking bass line in the left hand. Chord-melody style.",
    videos: [
      {
        title: "Fly Me to the Moon — Part 1: Chords & Voicings",
        sourceType: "youtube",
        sourceRef: "3JZ_D3ELwOQ",
        duration: 450,
        segments: [
          {
            title: "Rootless voicings, A section",
            start: 0,
            end: 220,
            excerpt: "We drop the root and let the bass imply it — this frees up your left hand for the walk.",
            status: "done",
            lastWatched: 220,
          },
          {
            title: "Rootless voicings, bridge",
            start: 220,
            end: 450,
            excerpt: "The bridge cycles through fourths, so your hand shape barely has to move.",
            status: "in_progress",
            notes: "Bridge voicings feel awkward, need more reps.",
            lastWatched: 260,
          },
        ],
      },
      {
        title: "Fly Me to the Moon — Part 2: Walking Bass",
        sourceType: "youtube",
        sourceRef: "3JZ_D3ELwOQ",
        duration: 380,
        segments: [
          {
            title: "Building a walking line",
            start: 0,
            end: 190,
            excerpt: "Target the chord tones on beats one and three, connect them chromatically in between.",
            status: "not_started",
          },
          {
            title: "Walking bass with the right-hand chords",
            start: 190,
            end: 380,
            excerpt: "Now the hard part — keeping the walk steady while the right hand stays light.",
            status: "not_started",
          },
        ],
      },
      {
        title: "Fly Me to the Moon — Part 3: Swing Feel",
        sourceType: "youtube",
        sourceRef: "3JZ_D3ELwOQ",
        duration: 300,
        segments: [
          {
            title: "Triplet subdivision & swing ratio",
            start: 0,
            end: 300,
            excerpt: "Swing isn't a fixed ratio — it stretches and contracts with the tempo and the feel.",
            status: "needs_review",
            notes: "Struggling to feel this without the metronome doing it for me. Flagged.",
          },
        ],
      },
      {
        title: "Fly Me to the Moon — Part 4: Full Arrangement",
        sourceType: "youtube",
        sourceRef: "3JZ_D3ELwOQ",
        duration: 260,
        segments: [
          {
            title: "Full arrangement, performance tempo",
            start: 0,
            end: 260,
            excerpt: "Let's put all four pieces together into one performance.",
            status: "not_started",
          },
        ],
      },
    ],
    lastPosition: [2, 0],
  },
];

async function main() {
  await prisma.segment.deleteMany();
  await prisma.transcriptLine.deleteMany();
  await prisma.video.deleteMany();
  await prisma.song.deleteMany();

  for (const seedSong of songs) {
    const song = await prisma.song.create({
      data: {
        title: seedSong.title,
        instructorNotes: seedSong.instructorNotes,
      },
    });

    let order = 0;
    const createdVideos: { id: string; segmentIds: string[] }[] = [];

    for (const seedVideo of seedSong.videos) {
      const video = await prisma.video.create({
        data: {
          title: seedVideo.title,
          sourceType: seedVideo.sourceType,
          sourceRef: seedVideo.sourceRef,
          durationSeconds: seedVideo.duration,
          transcriptLines: {
            create: seedVideo.segments.map((seg) => ({
              startSeconds: seg.start,
              endSeconds: seg.end,
              text: seg.excerpt,
            })),
          },
        },
      });

      const segmentIds: string[] = [];
      for (const seg of seedVideo.segments) {
        const created = await prisma.segment.create({
          data: {
            songId: song.id,
            videoId: video.id,
            order: order++,
            title: seg.title,
            startSeconds: seg.start,
            endSeconds: seg.end,
            transcriptExcerpt: seg.excerpt,
            status: seg.status,
            notes: seg.notes ?? "",
            lastWatchedPositionSeconds: seg.lastWatched ?? 0,
          },
        });
        segmentIds.push(created.id);
      }
      createdVideos.push({ id: video.id, segmentIds });
    }

    if (seedSong.lastPosition) {
      const [videoIndex, segmentIndex] = seedSong.lastPosition;
      const targetSegmentId = createdVideos[videoIndex]?.segmentIds[segmentIndex];
      if (targetSegmentId) {
        await prisma.song.update({
          where: { id: song.id },
          data: { lastSegmentId: targetSegmentId, lastWatchedAt: new Date() },
        });
      }
    }
  }

  console.log(`Seeded ${songs.length} songs.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
