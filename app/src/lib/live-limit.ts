/**
 * Spending limits for live testnet payments made by the server's operator wallet.
 *
 * A public demo pays real tUSD8 for every visitor with no wallet. Without a limit,
 * one visitor (or a bot) could empty the operator before the judges arrive, and every
 * later run would fall back to sandbox. Limits are in tUSD8, kept in memory:
 *  - each visitor: LIVE_VISITOR_HOURLY_TUSD8 per rolling hour (default 1.00, about two
 *    full judge runs: one transcript and four approvals is 0.44);
 *  - the whole server: LIVE_DAILY_CAP_TUSD8 per rolling 24 hours (default 1.50).
 * Over a limit, the caller pays in sandbox and labels it sandbox; the flow still works.
 */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function envAmount(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

interface Spend {
  at: number;
  amount: number;
  visitor: string;
}

let spends: Spend[] = [];
// Keys (such as a taskId) already counted, so a retry of the same payment is not
// counted twice and a task that started on chain can always finish there.
const counted = new Map<string, number>();

export type LiveLimitResult = { ok: true } | { ok: false; reason: "visitor" | "daily" };

/** Best-effort visitor id from the proxy headers (Render, Cloudflare), else "local". */
export function visitorKey(req: Request): string {
  const h = req.headers;
  const direct = h.get("cf-connecting-ip") || h.get("true-client-ip") || h.get("x-real-ip");
  if (direct) return direct.trim();
  const fwd = h.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || "local";
}

export function takeLiveSpend(visitor: string, amount: number, key?: string): LiveLimitResult {
  const now = Date.now();
  spends = spends.filter((s) => now - s.at < DAY);
  for (const [k, at] of counted) if (now - at > DAY) counted.delete(k);
  if (key && counted.has(key)) return { ok: true };

  const daily = spends.reduce((sum, s) => sum + s.amount, 0);
  if (daily + amount > envAmount("LIVE_DAILY_CAP_TUSD8", 1.5) + 1e-9) {
    return { ok: false, reason: "daily" };
  }
  const visitorHour = spends
    .filter((s) => s.visitor === visitor && now - s.at < HOUR)
    .reduce((sum, s) => sum + s.amount, 0);
  if (visitorHour + amount > envAmount("LIVE_VISITOR_HOURLY_TUSD8", 1.0) + 1e-9) {
    return { ok: false, reason: "visitor" };
  }

  spends.push({ at: now, amount, visitor });
  if (key) counted.set(key, now);
  return { ok: true };
}

export function liveLimitNote(reason: "visitor" | "daily", what: string): string {
  return reason === "visitor"
    ? `You have used this hour's live testnet payments, so ${what} was paid in sandbox.`
    : `Today's live testnet budget is used up, so ${what} was paid in sandbox.`;
}

/** Test helper. */
export function resetLiveLimits() {
  spends = [];
  counted.clear();
}
