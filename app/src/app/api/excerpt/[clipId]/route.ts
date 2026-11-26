import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getClipSpec } from "@/lib/clips";
import { findUploadedClip } from "@/lib/storage";
import { readState } from "@/lib/store";

/** The 12 s cap alone would let anyone walk a recording in 12 s steps. Only serve a
 *  window that lies inside a review task created for this clip. */
function windowBelongsToTask(clipId: string, start: number, end: number): boolean {
  const slack = 0.05;
  return readState().tasks.some(
    (t) => t.clipId === clipId && start >= t.start - slack && end <= t.end + slack
  );
}

export const runtime = "nodejs";

function sliceWavBuffer(
  buf: Buffer,
  startSec: number,
  endSec: number
): Buffer | null {
  if (
    buf.length < 44 ||
    buf.toString("ascii", 0, 4) !== "RIFF" ||
    buf.toString("ascii", 8, 12) !== "WAVE"
  ) {
    return null;
  }

  const channels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const byteRate = buf.readUInt32LE(28);
  const blockAlign = buf.readUInt16LE(32);
  const bitsPerSample = buf.readUInt16LE(34);
  if (!byteRate || !blockAlign) return null;

  let pos = 12;
  let dataOffset = 44;
  let dataSize = buf.length - 44;
  while (pos + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", pos, pos + 4);
    const chunkSize = buf.readUInt32LE(pos + 4);
    if (chunkId === "data") {
      dataOffset = pos + 8;
      dataSize = Math.min(chunkSize, buf.length - dataOffset);
      break;
    }
    pos += 8 + chunkSize;
  }

  const rawStartByte = Math.floor(startSec * byteRate);
  const rawEndByte = Math.ceil(endSec * byteRate);
  const startByte = Math.min(
    Math.max(0, dataSize - blockAlign),
    rawStartByte - (rawStartByte % blockAlign)
  );
  const endByte = Math.min(
    dataSize,
    Math.max(startByte + blockAlign, rawEndByte - (rawEndByte % blockAlign))
  );
  const pcmSlice = buf.subarray(dataOffset + startByte, dataOffset + endByte);

  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcmSlice.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcmSlice.length, 40);

  return Buffer.concat([header, pcmSlice]);
}

/**
 * Excerpt-only audio delivery for client confidentiality:
 * Editors ONLY receive the flagged [start, end] seconds (max 12s), never the full master file.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await context.params;
    const url = new URL(req.url);
    const rawStart = url.searchParams.get("start");
    const rawEnd = url.searchParams.get("end");

    const parsedStart = rawStart !== null ? Number(rawStart) : 0;
    const parsedEnd = rawEnd !== null ? Number(rawEnd) : parsedStart + 4;

    if (
      !Number.isFinite(parsedStart) ||
      !Number.isFinite(parsedEnd) ||
      parsedStart < 0 ||
      parsedEnd <= parsedStart
    ) {
      return NextResponse.json(
        { error: "Invalid excerpt window" },
        { status: 400 }
      );
    }

    const startSec = parsedStart;
    // Hard confidentiality guard: max 12s excerpt
    const endSec = Math.min(parsedEnd, startSec + 12);

    if (!windowBelongsToTask(clipId, startSec, endSec)) {
      return NextResponse.json(
        { error: "No review task covers that window." },
        { status: 403 }
      );
    }

    const spec = getClipSpec(clipId);
    if (spec) {
      const wavPath = path.join(process.cwd(), "public", "clips", `${clipId}.wav`);
      const buf = fs.readFileSync(wavPath);
      const excerptWav = sliceWavBuffer(buf, startSec, endSec);
      if (!excerptWav) {
        return NextResponse.json({ error: "Corrupt clip WAV" }, { status: 500 });
      }
      return new NextResponse(new Uint8Array(excerptWav), {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(excerptWav.length),
          "Cache-Control": "no-store",
          "X-Sikio-Excerpt-Only": "true",
          "X-Sikio-Window": `${startSec.toFixed(2)}s-${endSec.toFixed(2)}s`,
          "X-Sikio-Full-Duration-Withheld": "true",
        },
      });
    }

    const uploaded = findUploadedClip(clipId);
    if (!uploaded) {
      return NextResponse.json({ error: "Unknown clip" }, { status: 404 });
    }

    const buf = fs.readFileSync(uploaded.filePath);
    // Uploads are stored as PCM WAV (converted on upload). Anything else cannot be
    // sliced safely, so it is refused rather than sent whole.
    const excerptWav = sliceWavBuffer(buf, startSec, endSec);
    if (excerptWav) {
      return new NextResponse(new Uint8Array(excerptWav), {
        status: 200,
        headers: {
          "Content-Type": "audio/wav",
          "Content-Length": String(excerptWav.length),
          "Cache-Control": "no-store",
          "X-Sikio-Excerpt-Only": "true",
          "X-Sikio-Window": `${startSec.toFixed(2)}s-${endSec.toFixed(2)}s`,
          "X-Sikio-Full-Duration-Withheld": "true",
        },
      });
    }

    return NextResponse.json(
      { error: "This recording cannot be sliced, so it is not served." },
      { status: 415 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Excerpt slice failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
