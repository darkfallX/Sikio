import { ethers } from "hardhat";

const AEVUM_TUSD8 = "0x456569838f1d43009A91ebA4263147Afd7233483";
const SIKIO_X402_PROVIDER = "0x71C051C10000000000000000000000000000A402";
const TUSD8 = (n: string) => ethers.parseUnits(n, 6);

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

async function main() {
  const escrowAddress = process.env.REVIEW_ESCROW_ADDRESS;
  if (!escrowAddress) {
    throw new Error("Set REVIEW_ESCROW_ADDRESS in environment before running demo-flow.");
  }

  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Running live Aevum end-to-end flow on chainId:", network.chainId.toString());
  console.log("Agency / Agent / Approver signer:", signer.address);
  console.log("ReviewEscrow:", escrowAddress);

  // Fresh zero-tQDAY editor wallet to prove real zero-gas EIP-712 editor submission + tUSD8 payout
  const editorWallet = ethers.Wallet.createRandom();
  console.log("Zero-gas Editor address (0 tQDAY):", editorWallet.address);

  const token = new ethers.Contract(AEVUM_TUSD8, ERC20_ABI, signer);
  const escrow = await ethers.getContractAt("ReviewEscrow", escrowAddress, signer);

  const txHashes: Record<string, string> = {};

  // 1. Approve 2.00 tUSD8
  const approveTx = await token.approve(escrowAddress, TUSD8("2.00"));
  await approveTx.wait();
  txHashes.approve = approveTx.hash;
  console.log("1. Approved 2.00 tUSD8:", approveTx.hash);

  // 2. Create and fund Batch #1
  const latestBlock = await ethers.provider.getBlock("latest");
  const now = Number(latestBlock?.timestamp ?? Math.floor(Date.now() / 1000));
  const batchExpiry = now + 7 * 86400;
  const labelHash = ethers.id("sikio-lagos-fintech-ep14");

  const nextIdBefore = await escrow.nextBatchId();
  const createTx = await escrow.createBatch(
    signer.address,
    signer.address,
    TUSD8("2.00"),
    TUSD8("0.50"),
    batchExpiry,
    true,
    labelHash,
    TUSD8("2.00")
  );
  await createTx.wait();
  const batchId = Number(nextIdBefore);
  txHashes.createBatch = createTx.hash;
  console.log(`2. Created & funded Batch #${batchId} (2.00 tUSD8):`, createTx.hash);

  // 3. Allowlist trusted editor
  const allowTx = await escrow.setTrustedEditor(batchId, editorWallet.address, true);
  await allowTx.wait();
  txHashes.setTrustedEditor = allowTx.hash;
  console.log("3. Allowlisted trusted editor:", allowTx.hash);

  // 4. Pay x402 AI transcription inference (0.04 tUSD8)
  const reqId = ethers.id(`sikio-x402-lagos-${now}`);
  const infTx = await escrow.payInference(batchId, reqId, SIKIO_X402_PROVIDER, TUSD8("0.04"));
  await infTx.wait();
  txHashes.payInference = infTx.hash;
  console.log("4. Paid x402 AI inference (0.04 tUSD8):", infTx.hash);

  // 5. Offer micro-review task (0.25 tUSD8) for "Pay stark" -> "Paystack"
  const taskId = ethers.id(`sikio-task-paystack-${now}`);
  const excerptHash = ethers.id("lagos-fintech-ep14:5.10-8.90");
  const offerTx = await escrow.offerTask(
    batchId,
    taskId,
    editorWallet.address,
    TUSD8("0.25"),
    now + 48 * 3600,
    excerptHash
  );
  await offerTx.wait();
  txHashes.offerTask = offerTx.hash;
  console.log("5. Reserved 0.25 tUSD8 in ReviewEscrow (offerTask):", offerTx.hash);

  // 6. Editor signs EIP-712 correction off-chain (0 tQDAY needed) and relayer submits on-chain
  const correctionHash = ethers.id("Pay stark -> Paystack");
  const nonce = await escrow.editorNonces(editorWallet.address);
  const deadline = now + 3600;
  const domain = {
    name: "SikioReviewEscrow",
    version: "1",
    chainId: network.chainId,
    verifyingContract: escrowAddress,
  };
  const types = {
    SubmitCorrection: [
      { name: "taskId", type: "bytes32" },
      { name: "correctionHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };
  const signature = await editorWallet.signTypedData(domain, types, {
    taskId,
    correctionHash,
    nonce,
    deadline,
  });

  const submitTx = await escrow.submitCorrectionBySig(taskId, correctionHash, deadline, signature);
  await submitTx.wait();
  txHashes.submitCorrectionBySig = submitTx.hash;
  console.log("6. Relayed zero-gas EIP-712 editor correction:", submitTx.hash);

  // 7. Approver accepts & pays editor EXACTLY ONCE in tUSD8
  const acceptTx = await escrow.acceptTask(taskId);
  await acceptTx.wait();
  txHashes.acceptTask = acceptTx.hash;
  console.log("7. Accepted & paid editor 0.25 tUSD8 once:", acceptTx.hash);

  const editorBal = await token.balanceOf(editorWallet.address);
  console.log("Verified editor tUSD8 balance:", ethers.formatUnits(editorBal, 6));

  // 8. Reclaim remaining unused budget (1.71 tUSD8) back to agency wallet
  const withdrawTx = await escrow.withdrawAvailable(batchId, signer.address);
  await withdrawTx.wait();
  txHashes.withdrawAvailable = withdrawTx.hash;
  console.log("8. Reclaimed unused 1.71 tUSD8 to agency:", withdrawTx.hash);

  console.log("\n=== LIVE AEVUM VERIFIED SUMMARY ===");
  console.log(JSON.stringify({ escrowAddress, batchId, editorAddress: editorWallet.address, txHashes }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
