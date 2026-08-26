import { NextResponse } from "next/server";
import { writeProgressToDb } from "@/lib/progress";

// Non-revalidating progress writes: the periodic save during playback, and
// the teardown flush fired via navigator.sendBeacon from PracticePlayer's
// visibilitychange/pagehide handlers. Neither needs a fresh RSC payload —
// the first because nothing on screen shows the playhead, the second
// because the page is already going away.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const segmentId = body?.segmentId;
  const positionSeconds = body?.positionSeconds;

  if (
    typeof segmentId !== "string" ||
    !segmentId ||
    typeof positionSeconds !== "number" ||
    !Number.isFinite(positionSeconds)
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    // Only ever called for real playback — a beacon is never sent unless
    // the user actually watched something.
    const songId = await writeProgressToDb(segmentId, Math.max(0, positionSeconds), true);
    // A segment that no longer exists (reset, deleted) is not an error worth
    // surfacing: the beacon's sender is already gone.
    return NextResponse.json({ ok: songId !== null });
  } catch {
    return NextResponse.json({ error: "Write failed" }, { status: 500 });
  }
}
