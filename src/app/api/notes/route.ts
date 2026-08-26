import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Teardown-time notes flush, sent via navigator.sendBeacon when the page is
// hidden or closing. iOS does not fire blur on a textarea when you switch
// apps or lock the phone, so without this a note typed and abandoned is
// simply lost. No revalidation — the page is already going away.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const segmentId = body?.segmentId;
  const notes = body?.notes;

  if (typeof segmentId !== "string" || !segmentId || typeof notes !== "string") {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    await prisma.segment.update({ where: { id: segmentId }, data: { notes } });
    return NextResponse.json({ ok: true });
  } catch {
    // A segment that no longer exists isn't worth surfacing — the sender is
    // already gone and nothing is listening for the response.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
