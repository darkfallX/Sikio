# Sikio Project Guide (`AGENTS.md`)

## 1. What Sikio is

**Sikio** (*Swahili: "ear"*) creates time-coded captions for African voices (Nigerian Pidgin/English, Kenyan Swahili/English, Ghanaian English). When automatic speech recognition (ASR) confidence drops on local names, slang, or venues, the Sikio agent pays for inference via HTTP `402` (`x402`), slices **only the uncertain seconds (`<= 12s`)** for a native speaker on mobile, and settles payment **once per `taskId`** in `tUSD8` on **QDay Aevum Testnet (`44005`)** via `ReviewEscrow.sol`.

---

## 2. Repository structure and commands

- **Smart contracts (`contracts/`)**: Solidity `0.8.24` (Cancun EVM, OpenZeppelin `5.1`), Hardhat test suite and deployment/demo scripts.
  - Run tests: `cd contracts && npm test`
- **Web application (`app/`)**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, `viem`, `vitest`.
  - Install: `cd app && pnpm install`
  - Typecheck: `cd app && pnpm typecheck`
  - Lint: `cd app && pnpm lint`
  - Unit tests: `cd app && pnpm test`
  - Production build: `cd app && pnpm build`
  - E2E verification (requires running server on `127.0.0.1:3000`, or set `SIKIO_BASE_URL`): `cd app && node scripts/e2e-verify.mjs`

---

## 3. Verified QDay Aevum Testnet (`44005` / `0xABE5`) configuration

- **RPC**: `https://rpc-test.qday.info`
- **Explorer**: `https://explorer-test.qday.info`
- **Faucet**: `https://faucet.qday.info/en`
- **`tUSD8` ERC-20 (6 decimals)**: `0x456569838f1d43009A91ebA4263147Afd7233483`
- **EntryPoint v0.7**: `0x0000000071727De22E5E9d8BAf0edAc6f37da032`
- **Deployed `ReviewEscrow`**: `0x36Cf1caB839bf01306E647C56B2e44e7d4a35E6b`

Real Nov 22, 2026 confirmed on-chain proof hashes belong exclusively in `verifiedOnChainProofs`. Never alter or fabricate on-chain hashes.

---

## 4. Non-negotiable honesty and accounting invariants

1. **Real vs. sandbox separation**: Never label a local `makeSandboxTxHash` digest as `"aevum-live"` or link sandbox hashes to `explorer-test.qday.info/tx/...`. Only genuine confirmed Chain `44005` transaction hashes get `"aevum-live"` and explorer links.
2. **Exact ledger reconciliation**: Active session receipts in `state.receipts` must reconcile 100% with the active `batch` totals (`Funded`, `Settled`, `Escrowed`, `Left`). Historical proof hashes live separately in `verifiedOnChainProofs`.
3. **Truthful ASR engine labeling**: Never label an endpoint `"Whisper"` unless the server actually invokes the OpenAI Whisper API (`OPENAI_API_KEY` + real audio file). Likewise, label an engine `"Deepgram"` only when that request was actually transcribed by Deepgram (`DEEPGRAM_API_KEY` set and the call succeeded); a failed call falls back to the prepared transcript under its own label. Local heuristics/transcripts must be labeled honestly as `Sikio Local ASR Engine`.
4. **Strict settlement rules**: Do not allow accepting an unsubmitted `"offered"` task via `/api/tasks`. Enforce `taskId` exact-once payout and approver identity verification server-side.
5. **Excerpt confidentiality**: `/api/excerpt/[clipId]` must clamp audio slices to `<= 12` seconds, validate numeric query parameters strictly (`Number.isFinite`, HTTP `400` on invalid/inverted bounds), and never serve the full un-sliced agency WAV to the `/ear` endpoint. Serve only windows inside a review task for that clip (HTTP `403` otherwise). Uploads are converted to PCM WAV with ffmpeg on upload (`lib/audio.ts`, ffmpeg from a temp file, never a pipe) and an unsliceable file is refused, never sent whole.
6. **Valid economic math**: Sum merged non-overlapping intervals (`computeMergedDuration`) when computing `reviewTimeSavedPct`. Never display `-0%` or green savings styling when `costPerMinuteProjected > 3.50`.
7. **Secrets hygiene**: Never commit or print `.env`, `.env.local`, or private keys (e.g., `contracts/.env`).

---

## 5. Visual design and motion rules ("Candy outline")

Chosen by the founder from a visual questionnaire (Nov 23, 2026): story page first, bold pastel colour, very round shapes, lots of space, code-style headlines, subtle but premium motion, illustrations and candy-3D objects, top menu, Africa shown subtly through words and places. References they liked: Gumroad, Stripe, Paystack, Vercel.

- **Routes**: `/` is the full-bleed landing page (story first). The working app lives in the `app/src/app/(app)/` route group: `/studio`, `/ear`, `/approve`, `/receipts`, `/legal/*`, framed by `(app)/layout.tsx`.
- **Look**: blush canvas `#fff6fb`, white cards, **2px ink outlines (`--outline`) with hard offset shadows** (`--shadow` 4px 4px 0), very round corners (`--r` 22px, pill buttons). Utility classes: `.brut`, `.brut-sm`, `.brut-lg`, `.brut-flat`, `.press` (button lifts on hover, sinks into its shadow on press), `.pastel-*`.
- **Colour**: pastels `--pink #ffc8ea`, `--yellow #fff27a`, `--sky #b8efff`, `--mint #c6f4c1`, `--lilac`, `--peach`. Pastels always carry `--on-pastel` (#111) text in both themes. Primary action = pink pill with outline. Pay action = mint pill.
- **State colour (never mix)**: yellow = needs an ear, sky = heard, mint = paid once, grey (`--returned-bg`) = returned or expired, peach/`--warn` = cost warning, `--error` = error. Text-on-canvas state colours: `--flag-ink`, `--heard-ink`, `--paid-ink`.
- **Dark theme ("dusk")**: plum canvas `#2a2430` so black outlines and shadows still read. Light is the default; dark only when chosen with the toggle.
- **Type**: `Space Mono` 700 for headlines, numbers and labels (`.font-display`, `.type-hero`, `.type-display`, `.type-page`, `.type-section`, `.type-label`, Tailwind `font-mono`). `Space Grotesk` for all body text. Never set long paragraphs in mono.
- **Shared code**: `components/ui.tsx` (`Button`, `buttonClass`, `ButtonLink`, `Card`, `Tag`, `StatusPill`, `ModeTag`, `Reveal`, `CountUp`, `SPRING`), `components/art.tsx` (`Coin`, `Orb`, `Blob`, `Sparkle`, `IllustrationAI/Ear/Pay`, `WaveGlyph`, `wavePath`). Reuse them instead of new one-off styles.
- **Motion**: the `motion` library (`motion/react`) for springs, `layoutId` transitions (cards moving between lifecycle columns, nav pill), `AnimatePresence` for enter and exit, `whileInView` reveals. `MotionProvider` sets `reducedMotion="user"`, so every animation respects reduced motion. CSS helpers: `.sikio-float`, `.sikio-rise`, `.sikio-card-in`, `.sikio-bubble`, `.sikio-verdict`, `.sikio-check-pop`, `.sikio-marquee`. Motion should explain state changes (a word moving from heard to paid, a payment landing), not decorate.
- **Audio**: real clips use `OrganicWaveRibbon` (smooth Bezier ribbon from real PCM data, never bar histograms). `WaveGlyph` is decorative only, for illustrations.
- **Honesty in visuals**: never show fake photos of editors; real photos only when supplied. Illustrations stand in until then. Sandbox receipts are labelled sandbox.
- **Copy**: sentence case, plain words ("Needs an ear", "Held", "Paid once", "Return fee"), no em or en dashes, no banned words (`unlock`, `seamless`, `revolutionize`, `supercharge`, `next-generation`, `harness`). Little text per screen.
- **Quality bar**: every control >= 44px on a 375px phone, no horizontal scroll, every screen has loading, empty and error states, visible focus rings.

---

## 6. Known environment notes

- **Windows `pnpm` symlinks**: `app/next.config.ts` gates `output: "standalone"` behind `DOCKER_BUILD=1` so Windows builds succeed without administrator symlink privileges.
- **Serverless write paths**: `app/src/lib/storage.ts` writes JSON/uploads atomically to `process.cwd()/data` and automatically falls back to `os.tmpdir()/sikio-data` when running on read-only filesystems.
- **Git pushes**: Pushing large audio assets on Windows requires `git -c http.postBuffer=524288000 push origin main`.
- **Commit messages**: Keep commit messages plain lowercase, modular, and free of em dashes or filler adjectives.
