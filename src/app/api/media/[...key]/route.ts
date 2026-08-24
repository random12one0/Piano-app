import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/r2";

// Private media proxy: the R2 bucket is never public, so the browser is
// redirected to a short-lived presigned URL instead. A 302 redirect from a
// <video> element still forwards the browser's Range header to the final
// URL, so seeking/scrubbing works exactly as if the bucket were public.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: keyParts } = await params;
  const key = keyParts.map((part) => decodeURIComponent(part)).join("/");

  if (!key) {
    return NextResponse.json({ error: "Missing object key" }, { status: 400 });
  }

  const url = await getPresignedUrl(key);
  return NextResponse.redirect(url, { status: 302 });
}
