/** Builds the private-media-proxy URL for an R2 object key. */
export function mediaUrl(objectKey: string): string {
  return `/api/media/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
}
