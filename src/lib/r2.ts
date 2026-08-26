import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

const BUCKET = () => process.env.R2_BUCKET_NAME!;

export type R2Object = { key: string; size: number };

/** Lists every object in the bucket (or under a prefix), following pagination. */
export async function listAllObjects(prefix?: string): Promise<R2Object[]> {
  const s3 = client();
  const results: R2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET(),
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }),
    );
    for (const obj of res.Contents ?? []) {
      if (obj.Key) results.push({ key: obj.Key, size: obj.Size ?? 0 });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);

  return results;
}

/** Reads a small text object (e.g. a .url shortcut) fully into memory. */
export async function getObjectText(key: string): Promise<string> {
  const s3 = client();
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET(), Key: key }));
  return (await res.Body?.transformToString()) ?? "";
}

/** Presigned, time-limited GET URL for private streaming/downloading. */
export async function getPresignedUrl(key: string, expiresInSeconds = 3 * 60 * 60): Promise<string> {
  const s3 = client();
  const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
  return getSignedUrl(s3, command, { expiresIn: expiresInSeconds });
}
