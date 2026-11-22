# Sikio Decisive A/B Test Benchmark

## Methodology (§6 of Concept)

To evaluate whether targeted micro-review genuinely helps African localisation agencies without silently degrading caption quality, we compare two workflows on the same African-voice clips against a careful human reference transcript:

- **Run A — Full Review:** A native-speaker editor checks the entire machine transcript from start to finish.
- **Run B — Targeted Review (Sikio):** The editor listens only to Sikio's flagged low-confidence excerpts (`confidence < 0.78`, padded ±1.3s), corrects or confirms each span, and skips high-confidence passages.

We measure:
1. **Editor time taken (seconds)**
2. **Total cost per publishable minute** (baseline full review rate `$3.50/min` vs. Sikio `x402` AI + `$0.25` per micro-task)
3. **Residual errors left**, explicitly separating **overconfident AI misses** (words the ASR got wrong while scoring `>= 0.78` confidence).

## Pilot Results (Included Transparently in `/receipts`)

| Clip | Dialect | Clip Length | Full Review Time | Sikio Targeted Time | Time Saved | Errors Left (Full / Sikio) | Overconfident AI Misses | Cost (Full → Sikio) |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Tech Point Lagos (pilot cut) | Nigerian English / Pidgin | 190s | 465s | 112s | 76% | 1 / 2 | **1** (`Mainland` at 86%) | $11.08 → **$1.62** |
| Nairobi Mobility Doc (pilot cut) | Kenyan English / Swahili | 160s | 390s | 94s | 76% | 0 / 1 | **1** (`Safaricom` at 84%) | $9.33 → **$1.37** |
| Osu Studio Drama (pilot cut) | Ghanaian English | 125s | 310s | 78s | 75% | 1 / 1 | **0** | $7.29 → **$1.12** |

## Honest Takeaways

1. **Targeted review cut editor review time by ~76%** and reduced captioning cost per minute by ~85% across all three clips.
2. **Silent overconfident errors are real:** On 2 of 3 clips, the ASR mis-split a proper noun (`Main land`, `Safari com`) while reporting `0.84–0.86` confidence — above the default `0.78` threshold.
3. **Operational control:** Sikio surfaces this trade-off directly in **Studio** via the **Confidence Floor slider** (`50%–90%`). Raising the floor to `88%` catches those compound proper nouns at a modest increase in micro-task fees, letting each agency tune accuracy vs. budget per client.
4. **Live logging:** Agencies and judges can record new measured A/B runs directly inside `/receipts`.
