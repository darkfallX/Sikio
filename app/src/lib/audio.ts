import { spawn } from "child_process";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

/**
 * Converts any uploaded audio or video to 16 kHz mono 16-bit PCM WAV with ffmpeg, so
 * the excerpt endpoint can cut exact byte ranges and editors never receive more than
 * the uncertain seconds. Phone recordings (.m4a, .ogg voice notes, .mp3) cannot be
 * sliced safely as they are, so they are never stored or served unconverted.
 *
 * Needs ffmpeg on the server: on PATH, or at FFMPEG_PATH. The Docker image installs it.
 */

const MAX_SECONDS = 600; // a 15 MB upload limit already applies; this bounds decode time

export class AudioConversionError extends Error {}

export function ffmpegCommand(): string {
  return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
}

export function isWavBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WAVE"
  );
}

/** Seconds of PCM in a WAV, from its data chunk (0 when there is none). */
export function wavDataSeconds(wav: Buffer): number {
  if (!isWavBuffer(wav) || wav.length < 44) return 0;
  const byteRate = wav.readUInt32LE(28);
  let pos = 12;
  while (pos + 8 <= wav.length) {
    const id = wav.toString("ascii", pos, pos + 4);
    const size = wav.readUInt32LE(pos + 4);
    if (id === "data") return byteRate ? Math.min(size, wav.length - pos - 8) / byteRate : 0;
    pos += 8 + size;
  }
  return 0;
}

export async function convertToPcmWav(input: Buffer, timeoutMs = 60_000): Promise<Buffer> {
  // ffmpeg reads from a temporary file, not a pipe: phone recordings are often MP4
  // (even when named .ogg) with their index at the end, which a pipe cannot reach;
  // ffmpeg then exits 0 with an empty WAV.
  const tmp = path.join(os.tmpdir(), `sikio-upload-${crypto.randomBytes(8).toString("hex")}`);
  fs.writeFileSync(tmp, input);
  try {
    return await runFfmpeg(tmp, timeoutMs);
  } finally {
    fs.rm(tmp, { force: true }, () => {});
  }
}

function runFfmpeg(inputPath: string, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let proc;
    try {
      proc = spawn(
        ffmpegCommand(),
        [
          "-hide_banner", "-loglevel", "error",
          "-i", inputPath,
          "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
          "-t", String(MAX_SECONDS),
          "-f", "wav", "pipe:1",
        ],
        { stdio: ["ignore", "pipe", "pipe"], windowsHide: true }
      );
    } catch {
      reject(new AudioConversionError("ffmpeg is not available on this server."));
      return;
    }

    const out: Buffer[] = [];
    let errText = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new AudioConversionError("Converting the audio took too long."));
    }, timeoutMs);

    proc.stdout.on("data", (d: Buffer) => out.push(d));
    proc.stderr.on("data", (d: Buffer) => {
      if (errText.length < 2000) errText += d.toString();
    });
    proc.on("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        new AudioConversionError(
          err.code === "ENOENT"
            ? "ffmpeg is not available on this server."
            : "Could not start the audio converter."
        )
      );
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      const wav = Buffer.concat(out);
      // ffmpeg writes a placeholder size when streaming to a pipe; fix both headers
      // so the excerpt slicer and duration parser read the real length.
      if (isWavBuffer(wav)) fixWavSizes(wav);
      // Exit code 0 is not enough: on unreadable input ffmpeg can succeed with an
      // empty WAV. Demand at least a quarter second of real sound.
      if (code !== 0 || wavDataSeconds(wav) < 0.25) {
        if (errText) console.error("[audio] ffmpeg failed:", errText.trim().slice(0, 300));
        reject(new AudioConversionError("That file has no audio we could read."));
        return;
      }
      resolve(wav);
    });
  });
}

function fixWavSizes(wav: Buffer) {
  wav.writeUInt32LE(wav.length - 8, 4);
  let pos = 12;
  while (pos + 8 <= wav.length) {
    const id = wav.toString("ascii", pos, pos + 4);
    if (id === "data") {
      wav.writeUInt32LE(wav.length - (pos + 8), pos + 4);
      return;
    }
    pos += 8 + wav.readUInt32LE(pos + 4);
  }
}
