import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getClipSpec } from "@/lib/clips";

export const runtime = "nodejs";

/**
 * Excerpt-only WAV delivery for client confidentiality:
 * Editors on the Ear screen ONLY receive the flagged [start, end] seconds (max 12s),
 * never the full agency master recording.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ clipId: string }> }
) {
  try {
    const { clipId } = await context.params;
    const spec = getClipSpec(clipId);
    if (!spec) {
      return NextResponse.json({ error: "Unknown clip" }, { status: 404 });
    }

    const url = new URL(req.url);
    const startSec = Math.max(0, Number(url.searchParams.get("start") || 0));
    const rawEndSec = Number(url.searchParams.get("end") || startSec + 4);
    // Hard confidentiality guard: never deliver more than 12 seconds in an editor excerpt
    const endSec = Math.min(rawEndSec, startSec + 12);
    if (endSec <= startSec) {
      return NextResponse.json({ error: "Invalid excerpt window" }, { status: 400 });
    }

    const wavPath = path.join(process.cwd(), "public", "clips", `${clipId}.wav`);
    const buf = fs.readFileSync(wavPath);

    const channels = buf.readUInt16LE(22);
    const sampleRate = buf.readUInt32LE(24);
    const byteRate = buf.readUInt32LE(28);
    const blockAlign = buf.readUInt16LE(32);
    const bitsPerSample = buf.readUInt16LE(34);

    // Locate 'data' chunk reliably
    let pos = 12;
    let dataOffset = 44;
    let dataSize = buf.length - 44;
    while (pos + 8 <= buf.length) {
      const chunkId = buf.toString("ascii", pos, pos + 4);
      const chunkSize = buf.readUInt32LE(pos + 4);
      if (chunkId === "data") {
        dataOffset = pos + 8;
        dataSize = chunkSize;
        break;
      }
      pos += 8 + chunkSize;
    }

    const rawStartByte = Math.floor(startSec * byteRate);
    const rawEndByte = Math.ceil(endSec * byteRate);
    // Align to sample frame boundary
    const startByte = Math.min(dataSize, rawStartByte - (rawStartByte % blockAlign));
    const endByte = Math.min(dataSize, rawEndByte - (rawEndByte % blockAlign));
    const sliceLen = Math.max(blockAlign, endByte - startByte);

    const pcmSlice = buf.subarray(dataOffset + startByte, dataOffset + startByte + sliceLen);

    // Build clean standard 44-byte PCM RIFF/WAV header for ONLY this excerpt
    const header = Buffer.alloc(44);
    header.write("RIFF", 0, "ascii");
    header.writeUInt32LE(36 + pcmSlice.length, 4);
    header.write("WAVE", 8, "ascii");
    header.write("fmt ", 12, "ascii");
    header.writeUInt32LE(16, 16); // PCM fmt chunk size
    header.writeUInt16LE(1, 20); // PCM audio format
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write("data", 36, "ascii");
    header.writeUInt32LE(pcmSlice.length, 40);

    const excerptWav = Buffer.concat([header, pcmSlice]);

    return new NextResponse(excerptWav, {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Excerpt slice failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
