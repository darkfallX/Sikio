import { NextRequest, NextResponse } from "next/server";
import { serializeToSrt, serializeToVtt } from "@/lib/captions";
import { readState } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const format = new URL(req.url).searchParams.get("format") === "vtt" ? "vtt" : "srt";

  const state = readState();
  const job = state.jobs.find((j) => j.id === id);
  if (!job) {
    return NextResponse.json({ error: "Caption job not found" }, { status: 404 });
  }

  const content =
    format === "vtt" ? serializeToVtt(job.words) : serializeToSrt(job.words);
  const safeSlug = job.clipId.replace(/[^a-zA-Z0-9_-]/g, "");
  const ext = format === "vtt" ? "vtt" : "srt";

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": format === "vtt" ? "text/vtt; charset=utf-8" : "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="sikio-${safeSlug}.${ext}"`,
      "Cache-Control": "no-store",
    },
  });
}
