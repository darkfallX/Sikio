import { ethers } from "hardhat";

/**
 * Funds the public-demo operator wallet from the deployer wallet.
 *
 * The hosted Sikio demo signs live settlements with a throwaway operator wallet (not
 * the deployer key). That wallet needs a little tUSD8 (to fund review batches) and a
 * little tQDAY (for gas). Run this once with the deployer key before the demo:
 *
 *   # PowerShell
 *   $env:DEMO_OPERATOR_ADDRESS="0x..."; npx hardhat run scripts/fund-demo.ts --network aevum
 *
 * Optional: FUND_TUSD8 (default 6) and FUND_TQDAY (default 0.1).
 */
const AEVUM_TUSD8 = "0x456569838f1d43009A91ebA4263147Afd7233483";
const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
];

async function main() {
  const to = process.env.DEMO_OPERATOR_ADDRESS;
  if (!to || !/^0x[0-9a-fA-F]{40}$/.test(to)) {
    throw new Error(
      "Set DEMO_OPERATOR_ADDRESS=0x... to the demo operator wallet address before running."
    );
  }
  const tusd8Amount = process.env.FUND_TUSD8 || "6";
  const gasAmount = process.env.FUND_TQDAY || "0.1";

  const [signer] = await ethers.getSigners();
  const token = new ethers.Contract(AEVUM_TUSD8, ERC20_ABI, signer);

  const bal = await token.balanceOf(signer.address);
  const need = ethers.parseUnits(tusd8Amount, 6);
  console.log("Deployer:", signer.address);
  console.log("Deployer tUSD8 balance:", ethers.formatUnits(bal, 6));
  if (bal < need) {
    throw new Error(
      `Deployer holds ${ethers.formatUnits(bal, 6)} tUSD8, needs ${tusd8Amount}. Lower FUND_TUSD8 or top up the deployer.`
    );
  }

  const tx1 = await token.transfer(to, need);
  await tx1.wait();
  console.log(`Sent ${tusd8Amount} tUSD8 to ${to}:`, tx1.hash);

  const gasWei = ethers.parseEther(gasAmount);
  const nativeBal = await ethers.provider.getBalance(signer.address);
  if (nativeBal > gasWei * 2n) {
    const tx2 = await signer.sendTransaction({ to, value: gasWei });
    await tx2.wait();
    console.log(`Sent ${gasAmount} tQDAY (gas) to ${to}:`, tx2.hash);
  } else {
    console.log(
      "Deployer low on tQDAY; skipped gas transfer. Fund the demo wallet from the faucet: https://faucet.qday.info/en"
    );
  }

  const toTusd8 = await token.balanceOf(to);
  const toNative = await ethers.provider.getBalance(to);
  console.log(
    "Demo wallet now holds:",
    ethers.formatUnits(toTusd8, 6),
    "tUSD8,",
    ethers.formatEther(toNative),
    "tQDAY"
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
