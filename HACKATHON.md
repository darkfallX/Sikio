# HACKATHON.md: Aevum Builder Challenge #1

Rules read from https://dorahacks.io/hackathon/qday/detail and https://qday.io/builder-challenge on 25 Nov 2026.

## Judge
The QDay / PQA Labs team (not named). Top 5 present live on Demo Day, 15 Dec 2026 06:00 UTC.

## Judge's product
QDay Aevum testnet (chain 44005) and tUSD8. Named features in the criteria and docs:
- ERC-4337 smart accounts, scoped session keys, spending limits, identity primitives (ERC-8004)
- Stablecoin paymaster (gas in tUSD8), x402 facilitator, bundler
- tUSD8 with EIP-2612 permit and EIP-3009 signed transfers

What Sikio uses today: chain 44005, tUSD8, its own escrow with caps, expiry, allowlist, approver and revoke, EIP-712 signed answers relayed by the server (no gas for editors), and since 26 Nov standard x402 "exact" payments with tUSD8's EIP-3009: the agent signs a transfer for exactly the price (5 min, nonce bound to the request, no gas, 0.40 float), Sikio's facilitator verifies and settles it (`transferWithAuthorization`, tx 0x31ea35ef…cac3e95). Replay returns the same tx; underpaying gets 402.
Not used: 4337 accounts, session keys, the QDay paymaster, ERC-8004. QDay's x402 facilitator is said to be live but no endpoint is published (searched 26 Nov), so Sikio runs its own verify and settle; 4337 needs the bundler that the starter kit calls unsupported (KernelFactory unstaked per an open issue).

## Scoring (qday.io weights, DoraHacks wording)
Innovation 20 · UX and presentation 15 · Technical quality and platform integration 15 · Real-world utility 15 · Safety, trust and controls 15 · Demo 10 · Documentation 10.
Demo: "Verifiable on-chain activity: transparent proof of live execution, including visible transaction hashes, explorer links, and verifiable state changes."

## Must-haves
- [x] Public GitHub repo, MIT licence, credits section (https://github.com/darkfallX/Sikio)
- [x] QDay infrastructure evidence: ReviewEscrow 0x36Cf1caB839bf01306E647C56B2e44e7d4a35E6b, 8 confirmed tx in README
- [ ] Live deployment (public link or Docker image) (user, last)
- [ ] Demo video (DoraHacks requirement) (user, last)
- [x] README: problem, architecture, workflows, technologies
- [x] All code written in the build window (first commit 22 Nov 2026)
- [ ] DoraHacks form submitted (user)

## Our one job
When speech AI is unsure of a word, pay a native speaker in tUSD8 to hear only those seconds, once per approved fix.

## What their product visibly changes
Before: Run agent and Approve produced sandbox receipts unless the visitor had a wallet. Now (verified 26 Nov, local build, no wallet): Run agent pays 0.04 tUSD8 on chain via payInference (receipt "live 44005", explorer link, about 10 s), and Approve sends offerTask, submitCorrectionBySig and acceptTask, paying the editor once (about 31 s).

## Headline number
Old: "humans skipped 49% of the audio, cost per minute $1.86 vs $3.50 full pass", from a prepared transcript (not measured).
Measured 26 Nov 2026 with real Deepgram nova-3 on the three clips (threshold 0.78, `app/scripts/asr-proof.mjs`, results in `.claude/idea/asr-proof.json`): humans hear 16.3 of 44.3 s (37%, with the app's 0.65 s context either side; an earlier 21% figure used 0.3 s and was wrong). Deepgram got 104 of 109 words right; it flagged 9 words, 3 really wrong (precision 0.33); 3 of 5 errors were flagged, 2 missed confidently ("Wahela" 0.82, "Danfoe" 0.94).
Pre-set pass mark: Lagos 4 of 6 hard words caught (pass), precision 0.33 vs 0.8 (FAIL). At 0.85: 4 of 5 errors caught, precision 0.27 (listening share not re-measured at 0.65 s padding).
Out-of-sample test, 26 Nov 2026: the founder's own 37 s natural Pidgin voice note (private, in .claude/audio, not for the public demo). Deepgram nova-3 got 31 of 93 words wrong (33%, vs 5 of 109 on the scripted clips). Pass mark set before listening: >=50% of errors sent to a human and <=50% of audio heard. Result: 21 of 31 errors sent (68%, pass), 18.3 of 37.2 s heard (49%, pass by a hair). Threshold alone sent 14; the neighbour rule added 7, so it held up on new audio. 10 errors were missed confidently (e.g. "rugged" heard as "rogue" at 0.99, "be" as "been" at 1.00), so about 1 word in 10 stays wrong after review. One speaker, one clip, transcript typed by the same person.
Honest reading: the staged errors overstated how bad ASR is on these clips. Confidence alone misses confident slang errors. Only 3 short scripted clips, mostly standard English with local words (the repo does not record who or what voiced them); a real recorded Pidgin conversation is the next test.

## Judge path
Target: one public link, under 2 minutes, no wallet: Studio, Run agent, Ear, send answer, Approve, explorer link. Public link not yet made (user, last).
26 Nov 2026, local production build, no wallet: Approve sent real offerTask, submitCorrectionBySig and acceptTask; 0.10 tUSD8 reached the editor (tx 0x235db966…a5e0), 31 s click to explorer link. Before the fix it failed or took 60 to 155 s: the public RPC answers in 2.5 to 19 s and viem gave up at 10 s.

## Public demo budget (26 Nov 2026)
Operator wallet 3.23 tUSD8 + batch 2 leftovers, 0.99 tQDAY. One full judge run (transcript 0.04 + four approvals 0.40) costs 0.44 tUSD8.
Render free plan wipes the disk on every sleep and wake. Before the fix, each wake locked a fresh 2 tUSD8 batch, so the second wake would have left every later judge on sandbox. Now the server finds its own batch on chain, takes back leftovers before opening a new one, and funds a new batch with what it holds (min 0.50).
Limits: 1.00 tUSD8 per visitor per hour, 1.50 tUSD8 per day for the whole server (LIVE_VISITOR_HOURLY_TUSD8, LIVE_DAILY_CAP_TUSD8); over a limit the payment is labelled sandbox.
Needed for judging (12 to 14 Dec): top up the operator so each judging day has its 1.50.

## Field (26 Nov 2026)
About 138 public entries (117 counted 25 Nov plus 21 new repos on GitHub since). Base rate 3 paid places / 138 ≈ 2.2%. None of the new ones is in speech or captions; most are invoices, Confirmation of Payee and agent spending mandates, many using session keys, EIP-3009 or gasless flows that Sikio does not.

## Deadline
11 Dec 2026, 08:00 UTC. User plans to submit earlier.
