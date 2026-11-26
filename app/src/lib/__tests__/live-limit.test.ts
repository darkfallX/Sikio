import { afterEach, describe, expect, it } from "vitest";
import { resetLiveLimits, takeLiveSpend, visitorKey } from "../live-limit";

afterEach(() => {
  resetLiveLimits();
  delete process.env.LIVE_DAILY_CAP_TUSD8;
  delete process.env.LIVE_VISITOR_HOURLY_TUSD8;
});

describe("live spending limits", () => {
  it("lets one visitor do two full judge runs in an hour, then falls back", () => {
    // one judge run: a 0.04 transcript and four 0.10 approvals
    for (let run = 0; run < 2; run++) {
      expect(takeLiveSpend("a", 0.04).ok).toBe(true);
      for (let i = 0; i < 4; i++) expect(takeLiveSpend("a", 0.1).ok).toBe(true);
    }
    expect(takeLiveSpend("a", 0.1).ok).toBe(true); // 0.98 of 1.00
    expect(takeLiveSpend("a", 0.1)).toEqual({ ok: false, reason: "visitor" });
    expect(takeLiveSpend("b", 0.1).ok).toBe(true); // another visitor is unaffected
  });

  it("stops every visitor once the daily cap is reached", () => {
    process.env.LIVE_DAILY_CAP_TUSD8 = "0.25";
    expect(takeLiveSpend("a", 0.1).ok).toBe(true);
    expect(takeLiveSpend("b", 0.1).ok).toBe(true);
    expect(takeLiveSpend("c", 0.1)).toEqual({ ok: false, reason: "daily" });
  });

  it("does not count a retry of the same task twice", () => {
    process.env.LIVE_VISITOR_HOURLY_TUSD8 = "0.10";
    expect(takeLiveSpend("a", 0.1, "settle:t1").ok).toBe(true);
    expect(takeLiveSpend("a", 0.1, "settle:t1").ok).toBe(true);
    expect(takeLiveSpend("a", 0.1, "settle:t2").ok).toBe(false);
  });

  it("reads the visitor from proxy headers", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "1.2.3.4, 10.0.0.1" } });
    expect(visitorKey(req)).toBe("1.2.3.4");
    expect(visitorKey(new Request("http://x"))).toBe("local");
  });
});
