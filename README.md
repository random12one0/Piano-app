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
