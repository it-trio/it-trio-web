import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const SUPPORTED_EXTENSIONS = new Set([".mp3", ".m4a", ".wav"]);

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createR2Client(): S3Client {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function uploadToR2(
  audioPath: string,
  keyPrefix: string,
): Promise<{ key: string; publicUrl: string; size: number }> {
  const resolvedPath = path.resolve(audioPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Audio file not found: ${resolvedPath}`);
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(
      `Unsupported audio extension "${extension}". Use .mp3, .m4a, or .wav.`,
    );
  }

  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    throw new Error(`No content type mapping for extension: ${extension}`);
  }

  const body = fs.readFileSync(resolvedPath);
  const normalizedPrefix = keyPrefix.endsWith("/")
    ? keyPrefix
    : `${keyPrefix}/`;
  const key = `${normalizedPrefix}${randomUUID()}${extension}`;
  const bucket = requireEnv("R2_BUCKET");
  const publicBase = requireEnv("R2_PUBLIC_BASE").replace(/\/$/, "");

  const client = createR2Client();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000",
    }),
  );

  return {
    key,
    publicUrl: `${publicBase}/${key}`,
    size: body.byteLength,
  };
}
