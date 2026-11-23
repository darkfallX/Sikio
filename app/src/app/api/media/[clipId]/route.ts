import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import { findUploadedClip } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ clipId: string }> }
) {
  const { clipId } = await context.params;
  const record = findUploadedClip(clipId);
  if (!record) {
    return NextResponse.json({ error: "Uploaded clip not found" }, { status: 404 });
  }

  const stat = fs.statSync(record.filePath);
  const total = stat.size;
  const contentType = record.meta.isWav
    ? "audio/wav"
    : record.meta.mimeType || "application/octet-stream";

  const rangeHeader = req.headers.get("range");
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(total - 1, Number(match[2])) : total - 1;
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < total) {
        const chunkLen = end - start + 1;
        const fd = fs.openSync(record.filePath, "r");
        try {
          const slice = Buffer.alloc(chunkLen);
          fs.readSync(fd, slice, 0, chunkLen, start);
          return new NextResponse(new Uint8Array(slice), {
            status: 206,
            headers: {
              "Content-Type": contentType,
              "Content-Range": `bytes ${start}-${end}/${total}`,
              "Accept-Ranges": "bytes",
              "Content-Length": String(chunkLen),
              "Cache-Control": "private, max-age=3600",
            },
          });
        } finally {
          fs.closeSync(fd);
        }
      }
    }
  }

  const full = fs.readFileSync(record.filePath);
  return new NextResponse(new Uint8Array(full), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Content-Length": String(full.length),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
