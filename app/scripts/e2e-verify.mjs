/**
 * End-to-end integration test against a running Sikio server.
 * Verifies:
 * 1. All public routes & SEO files (/ , /ear, /approve, /receipts, /legal/terms, /legal/privacy, /sitemap.xml, /robots.txt)
 * 2. Real HTTP 402 Payment Required (x402) handshake on /api/transcribe
 * 3. Byte-level WAV excerpt slicing confidentiality on /api/excerpt/[clipId]
 * 4. Full payment lifecycle: reset -> run agent -> submit fix -> accept once -> reject double-pay -> reject refund -> SRT/VTT export -> reset
 */

const BASE = process.env.SIKIO_BASE_URL || "http://127.0.0.1:3000";

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function run() {
  console.log(`Testing Sikio E2E against ${BASE}...`);

  // 1. Pages & SEO
  const routes = [
    "/",
    "/ear",
    "/approve",
    "/receipts",
    "/legal/terms",
    "/legal/privacy",
    "/sitemap.xml",
    "/robots.txt",
  ];
  for (const r of routes) {
    const res = await fetch(`${BASE}${r}`);
    assert(res.status === 200, `Route ${r} returned ${res.status}`);
    const text = await res.text();
    assert(text.length > 50, `Route ${r} returned empty body`);
  }
  console.log("✓ All 8 pages & SEO routes returned HTTP 200");

  // 2. Real HTTP 402 Payment Required (x402)
  const res402 = await fetch(`${BASE}/api/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clipId: "lagos-fintech-ep14" }),
  });
  assert(res402.status === 402, `Expected HTTP 402, got ${res402.status}`);
  const body402 = await res402.json();
  assert(
    body402.challenge?.network === "eip155:44005" &&
      body402.challenge?.asset === "0x456569838f1d43009A91ebA4263147Afd7233483",
    "x402 challenge missing Aevum 44005 / tUSD8 parameters"
  );

  // Retry with valid X-PAYMENT header -> 200 OK
  const paymentProof = Buffer.from(
    JSON.stringify({
      x402Version: 1,
      network: "eip155:44005",
      requestId: body402.challenge.requestId,
      txHash: "0x" + "ab".repeat(32),
      payer: "0x51C10A9E00000000000000000000000000002002",
      amountBaseUnits: body402.challenge.maxAmountRequired,
      mode: "sandbox",
    })
  ).toString("base64");

  const res200 = await fetch(`${BASE}/api/transcribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": paymentProof,
    },
    body: JSON.stringify({ clipId: "lagos-fintech-ep14" }),
  });
  assert(res200.status === 200, `Expected HTTP 200 on paid retry, got ${res200.status}`);
  const body200 = await res200.json();
  assert(body200.words?.length === 43, `Expected 43 timed words, got ${body200.words?.length}`);
  console.log("✓ Real HTTP 402 -> X-PAYMENT -> HTTP 200 x402 handshake verified");

  // 3. Byte-level WAV Excerpt Confidentiality Slicer
  const fullWav = await fetch(`${BASE}/clips/lagos-fintech-ep14.wav`);
  const fullBuf = Buffer.from(await fullWav.arrayBuffer());
  const excerptRes = await fetch(
    `${BASE}/api/excerpt/lagos-fintech-ep14?start=5.0&end=8.5`
  );
  assert(excerptRes.status === 200, `Excerpt returned ${excerptRes.status}`);
  assert(
    excerptRes.headers.get("x-sikio-excerpt-only") === "true",
    "Missing X-Sikio-Excerpt-Only header"
  );
  const excerptBuf = Buffer.from(await excerptRes.arrayBuffer());
  assert(excerptBuf.toString("ascii", 0, 4) === "RIFF", "Excerpt is not valid RIFF/WAV");
  assert(
    excerptBuf.length < fullBuf.length * 0.35,
    `Excerpt size (${excerptBuf.length}) should be far smaller than full WAV (${fullBuf.length})`
  );
  console.log(
    `✓ Byte-level WAV excerpt verified (${excerptBuf.length} bytes vs full ${fullBuf.length} bytes)`
  );

  // 4. Full End-to-End Job -> Editor -> Approver -> Double-Pay Block -> Refund -> SRT/VTT Export
  await fetch(`${BASE}/api/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });

  const jobRes = await fetch(`${BASE}/api/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clipId: "lagos-fintech-ep14",
      confidenceThreshold: 0.78,
      feePerTaskTusd8: 0.25,
    }),
  });
  assert(jobRes.status === 200, `Job creation failed: ${jobRes.status}`);
  const jobJson = await jobRes.json();
  assert(jobJson.createdTasks.length >= 4, "Expected at least 4 flagged African speech spans");
  const paystackTask = jobJson.createdTasks.find((t) =>
    t.aiGuess.toLowerCase().includes("pay stark")
  );
  assert(paystackTask, "Expected 'Pay stark' flagged task");

  // Editor submits fix (zero gas)
  const submitRes = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "submit",
      taskId: paystackTask.id,
      submittedText: "Paystack",
    }),
  });
  assert(submitRes.status === 200, "Editor submit failed");

  // Approver accepts -> pays once
  const acceptRes = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "accept", taskId: paystackTask.id }),
  });
  assert(acceptRes.status === 200, "Approver accept failed");

  // Second accept MUST fail (exact-once invariant)
  const doublePayRes = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "accept", taskId: paystackTask.id }),
  });
  assert(doublePayRes.status === 400, `Double pay should return 400, got ${doublePayRes.status}`);

  // Reject another task -> returns reserved fee to available budget
  const otherTask = jobJson.createdTasks.find((t) => t.id !== paystackTask.id);
  const availBeforeReject = (await (await fetch(`${BASE}/api/state`)).json())
    .availableBudgetTusd8;
  const rejectRes = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", taskId: otherTask.id }),
  });
  assert(rejectRes.status === 200, "Reject failed");
  const availAfterReject = (await rejectRes.json()).availableBudgetTusd8;
  assert(
    Number((availAfterReject - availBeforeReject).toFixed(2)) === 0.25,
    `Expected +0.25 refund on reject, got ${availAfterReject - availBeforeReject}`
  );

  // Verify SRT & VTT exports contain merged "Paystack" and not "Pay stark"
  const srt = await (
    await fetch(`${BASE}/api/jobs/${jobJson.job.id}/export?format=srt`)
  ).text();
  const vtt = await (
    await fetch(`${BASE}/api/jobs/${jobJson.job.id}/export?format=vtt`)
  ).text();
  assert(srt.includes("Paystack") && !srt.includes("Pay stark"), "SRT missing merged fix");
  assert(vtt.startsWith("WEBVTT") && vtt.includes("Paystack"), "VTT missing merged fix");
  console.log("✓ End-to-end payment, exact-once guard, refund, and SRT/VTT export verified");

  // Reset to clean state for demo
  await fetch(`${BASE}/api/state`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }),
  });
  console.log("ALL SIKIO E2E CHECKS PASSED!");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
