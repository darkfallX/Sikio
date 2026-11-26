import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { AudioConversionError, convertToPcmWav, isWavBuffer } from "@/lib/audio";
import { saveUploadedClip } from "@/lib/storage";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15 MB

function parseWavDurationSeconds(buf: Buffer): number | null {
  if (
    buf.length < 44 ||
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WAVE"
  ) {
    return null;
  }
  const byteRate = buf.readUInt32LE(28);
  if (!byteRate) return null;
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", pos, pos + 4);
    const chunkSize = buf.readUInt32LE(pos + 4);
    if (chunkId === "data") {
      return Number(Math.max(1, chunkSize / byteRate).toFixed(2));
    }
    pos += 8 + chunkSize;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing audio file." }, { status: 400 });
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "Uploaded file is empty." }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "File exceeds 15 MB studio upload limit." },
        { status: 413 }
      );
    }

    const mimeType = file.type || "";
    const lowerName = file.name.toLowerCase();
    const validExt = /\.(wav|mp3|m4a|ogg|webm|aac|flac|mp4|mov)$/.test(lowerName);
    if (
      !validExt &&
      !mimeType.startsWith("audio/") &&
      !mimeType.startsWith("video/")
    ) {
      return NextResponse.json(
        { error: "Unsupported format. Upload WAV, MP3, M4A, OGG, WebM, or MP4 audio." },
        { status: 400 }
      );
    }

    const original = Buffer.from(await file.arrayBuffer());
    const suffix = crypto.randomBytes(3).toString("hex");
    const clipId = `custom-${Date.now().toString(36)}-${suffix}`;

    // Store only sliceable PCM WAV: phone formats are converted, never kept as is,
    // so the excerpt endpoint can always cut the exact uncertain seconds.
    let bytes: Buffer = original;
    if (!isWavBuffer(original)) {
      try {
        bytes = await convertToPcmWav(original);
      } catch (err) {
        const reason = err instanceof AudioConversionError ? err.message : "Could not convert the audio.";
        return NextResponse.json(
          { error: `${reason} Upload a WAV file instead.` },
          { status: 415 }
        );
      }
    }

    const record = saveUploadedClip({
      clipId,
      // Keep the name the user knows, but record that what is stored is WAV.
      fileName: bytes === original ? file.name : `${file.name.replace(/\.[^.]+$/, "")}.wav`,
      mimeType: "audio/wav",
      bytes,
    });

    const wavDurationSeconds = record.meta.isWav
      ? parseWavDurationSeconds(bytes)
      : null;

    return NextResponse.json({
      ok: true,
      clipId,
      audioUrl: `/api/media/${clipId}`,
      fileName: record.meta.fileName,
      isWav: record.meta.isWav,
      wavDurationSeconds,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
