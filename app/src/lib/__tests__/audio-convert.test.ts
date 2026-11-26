import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { describe, expect, it } from "vitest";
import { convertToPcmWav, ffmpegCommand, wavDataSeconds } from "../audio";

const hasFfmpeg = (() => {
  try {
    execFileSync(ffmpegCommand(), ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const clip = path.join(process.cwd(), "public", "clips", "lagos-fintech-ep14.wav");

describe.skipIf(!hasFfmpeg)("upload conversion (needs ffmpeg)", () => {
  it("converts an MP4 with its index at the end (a phone voice note) without losing audio", async () => {
    // ffmpeg's mp4 muxer writes the index last, like many phone apps; a pipe cannot
    // read that, which once produced an empty WAV that still "succeeded".
    const m4a = path.join(os.tmpdir(), `sikio-test-${process.pid}.ogg`); // misnamed on purpose
    execFileSync(ffmpegCommand(), ["-y", "-loglevel", "error", "-i", clip, "-c:a", "aac", "-f", "mp4", m4a]);
    try {
      const wav = await convertToPcmWav(fs.readFileSync(m4a));
      expect(wavDataSeconds(wav)).toBeGreaterThan(17);
      expect(wavDataSeconds(wav)).toBeLessThan(18);
    } finally {
      fs.rmSync(m4a, { force: true });
    }
  });

  it("refuses a file with no audio in it", async () => {
    await expect(convertToPcmWav(Buffer.from("not audio at all"))).rejects.toThrow(/no audio/);
  });
});
