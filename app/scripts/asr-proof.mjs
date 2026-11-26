// Proof: does real speech recognition (Deepgram) flag the words a native speaker
// must fix? Scores Deepgram's words and confidences against the true transcript of
// each bundled clip. Reads DEEPGRAM_API_KEY from app/.env.local and never prints it.
//
//   node scripts/asr-proof.mjs [--threshold 0.78] [--model nova-3] [--language en]
//   node scripts/asr-proof.mjs --file ../.claude/audio/pidgin.m4a --ref ../.claude/audio/pidgin.txt
//
// --file/--ref scores your own recording against what was really said (plain text,
// words separated by spaces). Pass mark for a new recording (written 26 Nov 2026,
// before the first one was heard): at least half of Deepgram's word errors are sent
// to a human, and the human hears no more than half of the audio.
//
// Pass mark (written before the first run, 26 Nov 2026):
//   1. Lagos clip: at least 3 of its 6 hard words come out wrong or below the threshold.
//   2. Across all clips: at least 4 in 5 flagged words are really wrong (precision >= 0.8).

import fs from "fs";
import net from "net";
import path from "path";

// Same fix as src/lib/deepgram.ts: Node's 250 ms per-address-family attempt is too
// short for a slow IPv4 handshake, and the IPv6 fallback can hang.
net.setDefaultAutoSelectFamilyAttemptTimeout(2500);
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..");
const args = process.argv.slice(2);
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const THRESHOLD = Number(opt("threshold", "0.78"));
const MODEL = opt("model", "nova-3");
const LANGUAGE = opt("language", "en");
const FILE = opt("file", "");
const REF = opt("ref", "");
// The app plays 0.65 s either side of an unsure word (lib/captions.ts), so "heard"
// uses the same padding. The near-certain line matches the app's neighbour rule.
const PAD = 0.65;
const NEAR_CERTAIN = 0.95;

function readKey() {
  if (process.env.DEEPGRAM_API_KEY) return process.env.DEEPGRAM_API_KEY.trim();
  try {
    const env = fs.readFileSync(path.join(appDir, ".env.local"), "utf8");
    const m = env.match(/^DEEPGRAM_API_KEY=(.*)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
  } catch {
    return "";
  }
}

// The hard words each clip was written around (same list as src/lib/clips.ts).
const HARD = {
  "lagos-fintech-ep14": ["Tunde", "Yaba", "Paystack", "Naira", "wahala", "danfo"],
  "nairobi-matatu-doc": ["Ngong", "matatu", "Kilimani", "Pesa", "mwananchi"],
  "accra-nollywood-scene": ["Kwame", "Osu", "jollof", "Makola", "Kumasi"],
};

// Apostrophes (straight or curly) and punctuation do not count as errors.
const norm = (w) => w.toLowerCase().replace(/['‘’]/g, "").replace(/[^a-z0-9]/g, "");

/** Edit-distance alignment of reference tokens to ASR tokens. Returns, for each
 *  reference index, the ASR indices aligned to it (a substitution or match plus
 *  any ASR insertions that follow it), and a flag for exact match. */
function align(ref, hyp) {
  const n = ref.length, m = hyp.length;
  const d = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(
        d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1),
        d[i - 1][j] + 1,
        d[i][j - 1] + 1
      );
  const map = ref.map(() => ({ hyp: [], exact: false, sub: false }));
  let i = n, j = m;
  let following = null; // the reference word just after the current position
  const pendingIns = []; // insertions waiting for the previous reference word
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (ref[i - 1] === hyp[j - 1] ? 0 : 1)) {
      const same = ref[i - 1] === hyp[j - 1];
      map[i - 1].hyp.unshift(j - 1, ...pendingIns.splice(0));
      map[i - 1].sub = !same;
      map[i - 1].exact = same && map[i - 1].hyp.length === 1;
      following = i - 1;
      i--; j--;
    } else if (j > 0 && (i === 0 || d[i][j] === d[i][j - 1] + 1)) {
      // An extra ASR token ("Pay stark" for "Paystack"): it belongs with the
      // neighbouring word that was misheard. Prefer the following word when it is a
      // substitution, otherwise wait for the previous one.
      if (following !== null && map[following].sub) {
        map[following].hyp.unshift(j - 1);
        map[following].exact = false;
      } else {
        pendingIns.unshift(j - 1);
      }
      j--;
    } else {
      following = i - 1;
      i--; // deletion: reference word has no ASR token
    }
  }
  if (pendingIns.length && map.length) {
    map[0].hyp.unshift(...pendingIns);
    map[0].exact = false;
  }
  return map;
}

const MIME = { ".wav": "audio/wav", ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".opus": "audio/ogg", ".webm": "audio/webm", ".aac": "audio/aac", ".flac": "audio/flac", ".amr": "audio/amr" };
let lastDuration = 0;
async function transcribe(key, file) {
  const url = `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(MODEL)}&language=${encodeURIComponent(LANGUAGE)}&punctuate=true`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": MIME[path.extname(file).toLowerCase()] || "audio/wav" },
    body: fs.readFileSync(file),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${json.err_msg || json.message || "request failed"}`);
  lastDuration = json.metadata?.duration || 0;
  return json.results?.channels?.[0]?.alternatives?.[0]?.words || [];
}

/** Words the app sends to a human: below the threshold, plus a directly adjacent
 *  word below NEAR_CERTAIN (the split-word rule in lib/captions.ts). */
function sentToHuman(words) {
  const below = new Set(words.map((w, j) => (w.confidence < THRESHOLD ? j : -1)).filter((j) => j >= 0));
  const sent = new Set(below);
  for (const j of below) for (const k of [j - 1, j + 1]) {
    if (k >= 0 && k < words.length && !below.has(k) && words[k].confidence < NEAR_CERTAIN) sent.add(k);
  }
  return { below, sent };
}

if (FILE) {
  const key = readKey();
  if (!key) { console.error("DEEPGRAM_API_KEY is not set in app/.env.local"); process.exit(1); }
  if (!REF || !fs.existsSync(REF)) { console.error("Pass --ref with a text file of what was really said."); process.exit(1); }
  const words = await transcribe(key, FILE);
  // Keep only tokens that are words (drop "…" and stray punctuation), in step.
  const refRaw = fs.readFileSync(REF, "utf8").split(/\s+/).filter((t) => norm(t));
  const ref = refRaw.map(norm);
  const hyp = words.map((w) => norm(w.word));
  const map = align(ref, hyp);
  const { below, sent } = sentToHuman(words);
  const wrongHyp = new Set();
  map.forEach((m) => { if (!m.exact) m.hyp.forEach((j) => wrongHyp.add(j)); });
  const hypOf = (i) => (i >= 0 && i < map.length ? map[i].hyp : []);
  const rows = map.map((m, i) => {
    const asr = m.hyp.map((j) => words[j].punctuated_word || words[j].word).join(" ") || "(missing)";
    const conf = m.hyp.length ? Math.min(...m.hyp.map((j) => words[j].confidence)) : null;
    const byThreshold = m.hyp.some((j) => below.has(j));
    // A dropped word is heard if the words around it are sent to the human.
    const byApp = m.hyp.length ? m.hyp.some((j) => sent.has(j)) : [...hypOf(i - 1), ...hypOf(i + 1)].some((j) => sent.has(j));
    return { said: refRaw[i] ?? ref[i], asr, conf, wrong: !m.exact, byThreshold, byApp };
  });
  const errors = rows.filter((r) => r.wrong);
  const caughtThr = errors.filter((r) => r.byThreshold).length;
  const caughtApp = errors.filter((r) => r.byApp).length;
  const duration = lastDuration || (words.length ? words[words.length - 1].end : 0);
  const heardOf = (set) => mergeSeconds([...set].map((j) => [words[j].start, words[j].end]));
  const heardApp = heardOf(sent);
  const sentWrong = [...sent].filter((j) => wrongHyp.has(j)).length;
  const result = {
    at: new Date().toISOString(), file: path.basename(FILE), model: MODEL, language: LANGUAGE, threshold: THRESHOLD,
    duration: Number(duration.toFixed(2)), saidWords: ref.length, asrWords: words.length, wordErrors: errors.length,
    errorsSentByThresholdOnly: caughtThr, errorsSentByApp: caughtApp,
    wordsSentToHuman: sent.size, sentButAlreadyRight: sent.size - sentWrong,
    secondsHeard: Number(heardApp.toFixed(2)), shareHeard: duration ? Number((heardApp / duration).toFixed(2)) : null,
    asrText: words.map((w) => w.punctuated_word || w.word).join(" "),
    rows,
  };
  result.passMark = {
    recall: errors.length ? Number((caughtApp / errors.length).toFixed(2)) : null,
    recallPass: errors.length ? caughtApp / errors.length >= 0.5 : null,
    shareHeardPass: result.shareHeard !== null ? result.shareHeard <= 0.5 : null,
  };
  result.passMark.pass = result.passMark.recallPass !== false && result.passMark.shareHeardPass === true;
  console.log(`ASR: ${result.asrText}
`);
  for (const r of rows) {
    if (!r.wrong && !r.byApp) continue;
    console.log(`  said ${String(r.said).padEnd(14)} heard ${r.asr.padEnd(18)} conf ${r.conf === null ? " -  " : r.conf.toFixed(2)}  ${r.wrong ? "WRONG" : "right"}${r.byApp ? (r.byThreshold ? ", sent (threshold)" : ", sent (neighbour rule)") : r.wrong ? ", MISSED" : ""}`);
  }
  console.log(`
words said ${ref.length} · errors ${errors.length} · sent by threshold alone ${caughtThr} · sent by app ${caughtApp} · words sent ${sent.size} (${result.sentButAlreadyRight} already right) · heard ${result.secondsHeard}s of ${result.duration}s (${Math.round((result.shareHeard || 0) * 100)}%)`);
  console.log("PASS MARK", JSON.stringify(result.passMark));
  const outFile = path.join(appDir, "..", ".claude", "audio", path.basename(FILE).replace(/\.[^.]+$/, "") + ".proof.json");
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`saved ${outFile}`);
  process.exit(0);
}

const key = readKey();
if (!key) {
  console.error("DEEPGRAM_API_KEY is not set in app/.env.local");
  process.exit(1);
}
const timings = JSON.parse(fs.readFileSync(path.join(appDir, "public/clips/timings.json"), "utf8"));
const report = { at: new Date().toISOString(), model: MODEL, language: LANGUAGE, threshold: THRESHOLD, clips: {} };
let flaggedTotal = 0, flaggedWrong = 0;

for (const clipId of Object.keys(HARD)) {
  const words = await transcribe(key, path.join(appDir, "public/clips", `${clipId}.wav`));
  const refRaw = timings[clipId].words.map((w) => w.text);
  const ref = refRaw.map(norm);
  const hyp = words.map((w) => norm(w.word));
  const map = align(ref, hyp);
  const isWrongHyp = new Set();
  map.forEach((m) => { if (!m.exact) m.hyp.forEach((j) => isWrongHyp.add(j)); });

  const flagged = words.map((w, j) => ({ j, w })).filter(({ w }) => w.confidence < THRESHOLD);
  // Seconds heard: what the app plays, i.e. every word it sends (threshold plus the
  // neighbour rule) with 0.65 s either side.
  const heard = mergeSeconds([...sentToHuman(words).sent].map((j) => [words[j].start, words[j].end]));
  flaggedTotal += flagged.length;
  flaggedWrong += flagged.filter(({ j }) => isWrongHyp.has(j)).length;

  const errors = map.map((m, i) => ({ i, m })).filter(({ m }) => !m.exact);
  const errorsCaught = errors.filter(({ m }) => m.hyp.some((j) => words[j].confidence < THRESHOLD));

  const hard = HARD[clipId].map((h) => {
    const i = ref.indexOf(norm(h));
    const m = i >= 0 ? map[i] : { hyp: [], exact: false };
    const asr = m.hyp.map((j) => words[j].punctuated_word || words[j].word).join(" ") || "(missed)";
    const conf = m.hyp.length ? Math.min(...m.hyp.map((j) => words[j].confidence)) : 0;
    return { word: h, asr, confidence: Number(conf.toFixed(2)), wrong: !m.exact, flagged: conf < THRESHOLD, caught: !m.exact || conf < THRESHOLD };
  });

  report.clips[clipId] = {
    duration: timings[clipId].duration,
    asrText: words.map((w) => w.punctuated_word || w.word).join(" "),
    referenceWords: ref.length,
    asrWordErrors: errors.length,
    errorsFlagged: errorsCaught.length,
    errorsMissedConfidently: errors.length - errorsCaught.length,
    flaggedWords: flagged.length,
    flaggedButCorrect: flagged.filter(({ j }) => !isWrongHyp.has(j)).length,
    secondsToHear: Number(heard.toFixed(2)),
    hard,
  };
}

function mergeSeconds(spans) {
  const s = spans.map(([a, b]) => [Math.max(0, a - PAD), b + PAD]).sort((x, y) => x[0] - y[0]);
  let total = 0, cur = null;
  for (const [a, b] of s) {
    if (!cur || a > cur[1]) { if (cur) total += cur[1] - cur[0]; cur = [a, b]; }
    else cur[1] = Math.max(cur[1], b);
  }
  if (cur) total += cur[1] - cur[0];
  return total;
}

const lagos = report.clips["lagos-fintech-ep14"].hard;
const lagosCaught = lagos.filter((h) => h.caught).length;
const precision = flaggedTotal ? flaggedWrong / flaggedTotal : 0;
report.passMark = {
  lagosHardCaught: `${lagosCaught} of ${lagos.length}`,
  lagosPass: lagosCaught >= 3,
  flaggedPrecision: Number(precision.toFixed(2)),
  precisionPass: precision >= 0.8,
  pass: lagosCaught >= 3 && precision >= 0.8,
};

for (const [id, c] of Object.entries(report.clips)) {
  console.log(`\n== ${id} (${c.duration}s)`);
  console.log(`ASR: ${c.asrText}`);
  console.log(`word errors ${c.asrWordErrors} of ${c.referenceWords} · flagged ${c.flaggedWords} (${c.flaggedButCorrect} were right) · errors flagged ${c.errorsFlagged}, missed confidently ${c.errorsMissedConfidently} · human hears ${c.secondsToHear}s`);
  for (const h of c.hard) console.log(`  ${h.word.padEnd(10)} -> ${h.asr.padEnd(16)} conf ${h.confidence}  ${h.wrong ? "WRONG" : "right"}${h.flagged ? ", flagged" : ""}`);
}
console.log("\nPASS MARK", JSON.stringify(report.passMark));
const out = path.join(appDir, "..", ".claude", "idea", "asr-proof.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(`saved ${out}`);
