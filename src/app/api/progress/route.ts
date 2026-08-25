import { NextResponse } from "next/server";
import { writeProgressToDb } from "@/lib/progress";

// Teardown-time progress flush, hit via navigator.sendBeacon from
// PracticePlayer's visibilitychange/pagehide handlers. No client is around
// to see a revalidated cache by the time this fires, so this only performs
// the raw write — no revalidatePath.
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

  await writeProgressToDb(segmentId, Math.max(0, positionSeconds));
  return NextResponse.json({ ok: true });
}
