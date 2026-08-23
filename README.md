# Practice Rail

A personal piano practice companion — songs, their lesson video segments, and
your progress notes, all in one continuous timeline instead of scattered
across separate video pages.

Single-user, local-first. No accounts, no external services.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS v4
- SQLite via Prisma (`@prisma/adapter-better-sqlite3`)
- Server Actions for all mutations; no separate REST/API layer

## Getting started

```bash
npm install
npm run db:migrate   # creates prisma/dev.db and applies the schema
npm run db:seed      # loads sample songs/segments so the UI has something to show
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Using your own local video files

Drop your video file into `public/videos/` (e.g.
`public/videos/river-flows-part1.mp4`). That folder is git-ignored, so
nothing in it is ever committed or pushed — it stays on your machine.

Then in the app's "Add video" flow (`/songs/[id]/ingest`), pick source type
**Local file** and enter the path as `/videos/river-flows-part1.mp4` (same
name, with a leading `/`, no `public`). Next.js serves anything under
`public/` at that path automatically while `npm run dev` is running, and the
native `<video>` player handles seeking/scrubbing on it directly — no
external hosting or upload step involved.

## How it's organized

- `prisma/schema.prisma` — `Song` → `Segment` (ordered, resumable practice
  units) → `Video` (the source lesson video a segment lives inside) →
  `TranscriptLine` (raw timestamped captions).
- `src/lib/captions.ts` — parses uploaded `.srt`/`.vtt` files (both input
  paths from the original spec).
- `src/lib/plainTranscript.ts` — parses a pasted timestamped transcript
  (e.g. copied by hand from YouTube's transcript panel).
- `src/lib/chaptering.ts` — proposes chapter breaks from a transcript using
  a pause + teaching-cue-phrase heuristic ("right hand", "let's now…", a
  long pause, etc). Proposals are never saved automatically — they go
  through the review screen at `/songs/[id]/ingest` first.
- `src/components/player/` — the practice player: a YouTube-embed backend
  and a native `<video>` backend behind one shared interface, with resume,
  segment looping, and speed control.
- `src/components/rail/` — "the rail": the signature horizontal timeline
  used for both the song library and a song's own segment sequence.
- `src/lib/actions.ts` — all Server Action mutations (status, notes, the
  "struggling with this" flag, progress tracking).

## Design

Palette and type system are documented as CSS custom properties in
`src/app/globals.css` (see the comment at the top) — "Manuscript & Brass":
Ebony/Ivory surfaces, Brass as the single interactive accent, Sealing Wax
reserved for the review-queue flag. Type pairing is Fraunces (display) with
IBM Plex Sans/Mono (UI and timestamps).
