// One-off import: walks the "piano music/" prefix in the R2 bucket, groups
// files into songs by folder, and creates real Song/Video/Segment records
// (replacing the placeholder seed data). Each video becomes exactly one
// segment spanning the whole video for now — proper sub-chaptering happens
// later once real captions are available per video.
//
// Run with: node --env-file=.env node_modules/.bin/tsx scripts/import-library.ts

import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";
import { listAllObjects, getObjectText, getPresignedUrl } from "../src/lib/r2";
import { extractYouTubeId } from "../src/lib/urlShortcut";

const execFileAsync = promisify(execFile);

const dbUrl = `file:${path.join(__dirname, "..", "prisma", "dev.db")}`;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });

const PREFIX = "piano music/";

// Best-effort cleanup of the messy folder names into real song titles +
// attribution. Folders not listed here fall back to a title-cased version
// of the folder name.
const SONG_CONFIG: Record<string, { title: string; notes?: string }> = {
  "3 nils frahm": { title: "Because This Must Be", notes: "Nils Frahm." },
  andata: { title: "Andata", notes: "Ryuichi Sakamoto." },
  chainsaw: { title: "Chainsaw" },
  "christmas time is here": { title: "Christmas Time Is Here", notes: "From A Charlie Brown Christmas." },
  "city starts": { title: "City of Stars", notes: "From La La Land." },
  "downtown abby'": { title: "Downton Abbey Theme" },
  genossi: { title: "Gnossienne No. 1", notes: "Erik Satie." },
  "hedwigs theme": { title: "Hedwig's Theme", notes: "From Harry Potter." },
  "ill be home for chrismas": { title: "I'll Be Home for Christmas" },
  lala: { title: "La La Land — Engagement Party" },
  "leias theme lv 2": { title: "Leia's Theme", notes: "From Star Wars. (Level 2 arrangement)" },
  "lord of the rings": { title: "The Lord of the Rings — Main Theme" },
  "merry go round of life": { title: "Merry Go Round of Life", notes: "From Howl's Moving Castle." },
  mia: { title: "Mia and Sebastian's Theme", notes: "From La La Land." },
  nutcracker: { title: "March of the Nutcracker" },
  "oh holy lv2": { title: "O Holy Night", notes: "(Level 2 arrangement)" },
  "pink pamther": { title: "The Pink Panther Theme" },
  "prowlers theme": { title: "Prowler's Theme", notes: "From Into the Spider-Verse." },
  "song from up": { title: "Married Life (Sad Version)", notes: "From Up." },
  starkiller: { title: "Starkiller", notes: "From Star Wars." },
  "ylang ylang": { title: "Ylang Ylang", notes: "Ryuichi Sakamoto." },
};

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function sortKey(filename: string): [number, number, number, string] {
  const leading = filename.match(/^(\d+)(?=\D)/);
  const section = filename.match(/\bsection\s+(\d+)/i);
  const part = filename.match(/\bpart\s+(\d+)/i);
  return [
    leading ? parseInt(leading[1], 10) : Infinity,
    section ? parseInt(section[1], 10) : Infinity,
    part ? parseInt(part[1], 10) : Infinity,
    filename,
  ];
}

async function probeDuration(key: string): Promise<number | null> {
  const url = await getPresignedUrl(key, 3600);
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      url,
    ]);
    const seconds = parseFloat(stdout.trim());
    return Number.isFinite(seconds) ? seconds : null;
  } catch (err) {
    console.warn(`  ffprobe failed for ${key}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

type FolderFiles = {
  pdf?: string;
  urls: string[];
  mp4s: string[];
};

async function main() {
  console.log("Listing bucket...");
  const objects = await listAllObjects(PREFIX);

  const folders = new Map<string, FolderFiles>();
  for (const obj of objects) {
    const rel = obj.key.slice(PREFIX.length);
    const slash = rel.indexOf("/");
    if (slash === -1) continue;
    const folder = rel.slice(0, slash);
    const filename = rel.slice(slash + 1);
    if (!filename || filename.endsWith("/")) continue;

    const entry = folders.get(folder) ?? { urls: [], mp4s: [] };
    if (filename.toLowerCase().endsWith(".pdf")) entry.pdf = obj.key;
    else if (filename.toLowerCase().endsWith(".url")) entry.urls.push(obj.key);
    else if (filename.toLowerCase().endsWith(".mp4")) entry.mp4s.push(obj.key);
    folders.set(folder, entry);
  }

  console.log(`Found ${folders.size} song folders.\n`);

  console.log("Clearing placeholder data...");
  await prisma.segment.deleteMany();
  await prisma.transcriptLine.deleteMany();
  await prisma.video.deleteMany();
  await prisma.song.deleteMany();

  const flags: string[] = [];

  for (const [folder, files] of [...folders.entries()].sort()) {
    const config = SONG_CONFIG[folder];
    const title = config?.title ?? titleCase(folder);
    if (!config) flags.push(`"${folder}" — no title mapping, used a naive title-case guess: "${title}".`);

    const sortedMp4s = [...files.mp4s].sort((a, b) => {
      const ka = sortKey(path.basename(a));
      const kb = sortKey(path.basename(b));
      for (let i = 0; i < ka.length; i++) {
        if (ka[i] < kb[i]) return -1;
        if (ka[i] > kb[i]) return 1;
      }
      return 0;
    });

    const totalVideoCount = files.urls.length + sortedMp4s.length;
    if (totalVideoCount === 0) {
      flags.push(`"${folder}" — no video or shortcut found, skipped entirely.`);
      continue;
    }

    console.log(`--- ${title} (${folder}) ---`);

    const song = await prisma.song.create({
      data: {
        title,
        instructorNotes: config?.notes ?? "",
        sheetMusicKey: files.pdf,
      },
    });

    let partNumber = 1;
    let order = 0;

    // Part 1: the free YouTube shortcut, if present.
    for (const urlKey of files.urls) {
      const raw = await getObjectText(urlKey);
      const videoId = extractYouTubeId(raw);
      if (!videoId) {
        flags.push(`"${folder}" — couldn't extract a YouTube ID from ${urlKey}, skipped it.`);
        continue;
      }
      const videoTitle = totalVideoCount > 1 ? `${title} — Part ${partNumber}` : title;
      const video = await prisma.video.create({
        data: { title: videoTitle, sourceType: "youtube", sourceRef: videoId },
      });
      // Unknown duration ahead of time — 0/0 is the app's sentinel for
      // "use the live player-reported duration."
      await prisma.segment.create({
        data: {
          songId: song.id,
          videoId: video.id,
          order: order++,
          title: videoTitle,
          startSeconds: 0,
          endSeconds: 0,
        },
      });
      console.log(`  Part ${partNumber}: YouTube ${videoId} (duration unknown until played)`);
      partNumber++;
    }

    // Remaining parts: the downloaded R2 video files, in inferred order.
    for (const mp4Key of sortedMp4s) {
      const videoTitle = totalVideoCount > 1 ? `${title} — Part ${partNumber}` : title;
      const duration = await probeDuration(mp4Key);
      if (duration == null) {
        flags.push(`"${folder}" — ffprobe couldn't read a duration for ${mp4Key}, skipped it.`);
        continue;
      }
      const video = await prisma.video.create({
        data: { title: videoTitle, sourceType: "local", sourceRef: mp4Key, durationSeconds: duration },
      });
      await prisma.segment.create({
        data: {
          songId: song.id,
          videoId: video.id,
          order: order++,
          title: videoTitle,
          startSeconds: 0,
          endSeconds: duration,
        },
      });
      console.log(`  Part ${partNumber}: ${path.basename(mp4Key)} (${Math.round(duration)}s)`);
      partNumber++;
    }
  }

  // Known-ambiguous cases spotted by hand during analysis — the generic
  // ordering heuristic makes a reasonable call for these, but they're worth
  // a human glance since the source filenames were genuinely inconsistent.
  if (folders.has("ylang ylang")) {
    flags.push(
      `"ylang ylang" — only video file found is labeled "part 3" in its filename; ` +
        `there may be a missing middle part not yet uploaded.`,
    );
  }
  if (folders.has("merry go round of life")) {
    flags.push(
      `"merry go round of life" — no YouTube shortcut in this folder and the video files' own ` +
        `filenames start at "2"; renumbered sequentially from Part 1, but double-check nothing's missing.`,
    );
  }
  if (folders.has("3 nils frahm")) {
    flags.push(
      `"3 nils frahm" (Because This Must Be) — video filenames have confusing embedded labels ` +
        `("2nd part part 1", "2nd part part 2"); ordered by each file's leading number, worth confirming ` +
        `the part order is actually right.`,
    );
  }

  console.log(`\nImported ${folders.size} songs.`);
  if (flags.length > 0) {
    console.log("\nThings worth double-checking:");
    for (const f of flags) console.log(` - ${f}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
