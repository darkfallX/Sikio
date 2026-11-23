import fs from "fs";
import os from "os";
import path from "path";

let resolvedDataDir: string | null = null;

/**
 * Resolves a writable data directory (process.cwd()/data locally, falling back to
 * os.tmpdir()/sikio-data on read-only serverless filesystems).
 */
export function getDataDir(): string {
  if (resolvedDataDir) return resolvedDataDir;
  const preferred = path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(preferred, { recursive: true });
    const probe = path.join(preferred, `.write-probe-${process.pid}`);
    fs.writeFileSync(probe, "1", "utf8");
    fs.unlinkSync(probe);
    resolvedDataDir = preferred;
    return resolvedDataDir;
  } catch {
    const fallback = path.join(os.tmpdir(), "sikio-data");
    fs.mkdirSync(fallback, { recursive: true });
    resolvedDataDir = fallback;
    return resolvedDataDir;
  }
}

export function getStateFilePath(): string {
  return path.join(getDataDir(), "sikio-state.json");
}

export function getUploadsDir(): string {
  const dir = path.join(getDataDir(), "uploads");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Writes JSON atomically via temp file + rename in the same directory so concurrent
 * reads never observe partial writes.
 */
export function writeJsonAtomic(filePath: string, payload: unknown): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

export interface UploadedClipMeta {
  clipId: string;
  fileName: string;
  storedFileName: string;
  mimeType: string;
  sizeBytes: number;
  isWav: boolean;
  createdAt: string;
}

export interface UploadedClipRecord {
  meta: UploadedClipMeta;
  filePath: string;
}

export function saveUploadedClip(params: {
  clipId: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
}): UploadedClipRecord {
  if (!/^[a-z0-9-]+$/i.test(params.clipId)) {
    throw new Error("Invalid clipId");
  }
  const uploadsDir = getUploadsDir();
  const isWav =
    params.bytes.length >= 12 &&
    params.bytes.toString("ascii", 0, 4) === "RIFF" &&
    params.bytes.toString("ascii", 8, 12) === "WAVE";

  const rawExt = path.extname(params.fileName || "").toLowerCase();
  const safeExt = /^\.[a-z0-9]{1,8}$/.test(rawExt)
    ? rawExt
    : isWav
    ? ".wav"
    : ".audio";

  const storedFileName = `${params.clipId}${safeExt}`;
  const filePath = path.join(uploadsDir, storedFileName);
  fs.writeFileSync(filePath, params.bytes);

  const meta: UploadedClipMeta = {
    clipId: params.clipId,
    fileName: params.fileName || storedFileName,
    storedFileName,
    mimeType: params.mimeType || (isWav ? "audio/wav" : "application/octet-stream"),
    sizeBytes: params.bytes.length,
    isWav,
    createdAt: new Date().toISOString(),
  };

  writeJsonAtomic(path.join(uploadsDir, `${params.clipId}.meta.json`), meta);
  return { meta, filePath };
}

export function findUploadedClip(clipId: string): UploadedClipRecord | null {
  if (!/^[a-z0-9-]+$/i.test(clipId)) return null;
  const uploadsDir = getUploadsDir();
  const metaPath = path.join(uploadsDir, `${clipId}.meta.json`);
  if (!fs.existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(
      fs.readFileSync(metaPath, "utf8")
    ) as UploadedClipMeta;
    const filePath = path.join(uploadsDir, meta.storedFileName);
    if (!fs.existsSync(filePath)) return null;
    return { meta, filePath };
  } catch {
    return null;
  }
}
