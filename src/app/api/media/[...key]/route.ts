import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/r2";

// Everything this app serves lives under one prefix in the bucket. Without a
// guard the route mints a presigned URL for *any* key in R2 to anyone who can
// reach it, which is a wide-open read proxy onto the whole bucket.
const ALLOWED_PREFIXES = (process.env.R2_ALLOWED_PREFIXES ?? "piano music/")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

// Long enough to cover a practice session; the player reconnects with a fresh
// URL if one does expire mid-video.
const PRESIGN_TTL_SECONDS = 3 * 60 * 60;

// Private media proxy: the R2 bucket is never public, so the browser is
// redirected to a short-lived presigned URL instead. A 302 redirect from a
// <video> element still forwards the browser's Range header to the final
// URL, so seeking/scrubbing works exactly as if the bucket were public.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await params;
  // Next has already decoded each catch-all segment. Decoding again corrupts
  // any key containing a literal "%" — and throws outright on a bare one.
  const key = keyParts.join("/");

  if (!key) {
    return NextResponse.json({ error: "Missing object key" }, { status: 400 });
  }

  if (key.includes("..") || !ALLOWED_PREFIXES.some((prefix) => key.startsWith(prefix))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const url = await getPresignedUrl(key, PRESIGN_TTL_SECONDS);
  return NextResponse.redirect(url, { status: 302 });
}
