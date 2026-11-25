# Sikio review-savings: what is measured, and what is not

Sikio makes one economic claim: a producer pays a human to re-check only the seconds the
machine is unsure about, instead of paying for a full listen-through. This doc is explicit
about which numbers are computed from real data and which require a human timing trial we do
not fabricate.

## 1. Coverage: real, automatic, per clip (the honest headline)

For every captioned clip, Studio shows how much of the audio a reviewer actually has to hear:

```
coverage        = mergedFlaggedSeconds / clipDurationSeconds
audio skipped % = 1 - coverage
```

- `mergedFlaggedSeconds` sums the review excerpts after merging overlapping intervals
  (`computeMergedDuration` in `app/src/lib/captions.ts`), so overlapping spans are never
  double-counted.
- This is derived live from the clip's own flagged spans. Nothing is seeded or assumed.
- Studio states it plainly: "humans skipped X% of the audio" (or "humans heard all of the
  audio" when nothing is flagged).

This is a statement about **how much audio is sent for review**, not a claim about how fast a
particular editor works. It is the number we stand behind without a trial.

## 2. Cost per minute: real, from the session ledger

Studio compares Sikio's actual settled + reserved tUSD8 for a clip against a baseline full
human pass (`$3.50/min`, a common African-localisation agency rate):

```
costPerMinuteProjected = (x402 inference + human paid + human held) / clipMinutes
```

If `costPerMinuteProjected > $3.50`, Studio says so directly — "At this fee, Sikio costs more
than a full human pass on this clip" — and never shows a green savings figure. We do not hide
the cases where targeted review is not cheaper (short clips, or a high per-task fee).

## 3. Review-time A/B: only when you log a real run

Comparing **editor time** on a full pass vs targeted review requires timing a real editor on
the same clip. Sikio ships **no pre-measured results** for this. The Receipts page has a "Log
run" tool where you enter the two times you actually measured; those rows are tagged
"Logged by you" (`source: "user-logged"`) and the "Review time saved" figure is computed only
from runs you have logged. With no logged runs it reads "No runs yet".

### How to log an honest run

1. Pick a clip and a native-speaker editor.
2. Time a full listen-and-correct pass end to end.
3. Reset, then time the same editor correcting only Sikio's flagged excerpts.
4. Enter both times (and any errors each pass left) in Receipts → Log run.
5. Report the result with the editor and clip named, including runs where Sikio did not win.

## What this does and does not prove

- **Proves (automatically):** what share of a clip's audio is routed to a human, and the real
  tUSD8 cost of this session against a stated baseline.
- **Does not prove (without a logged trial):** that a human finishes faster, or that caption
  quality is as good as a full pass. Those need the A/B runs above, timed on real editors.
