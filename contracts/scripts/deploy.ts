import { ethers, network } from "hardhat";

// Official QDay Aevum Testnet tUSD8 (6 decimals, Chain ID 44005)
const AEVUM_TUSD8 = "0x456569838f1d43009A91ebA4263147Afd7233483";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Network:", network.name, "Chain ID:", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("Deployer:", deployer.address);

  let tokenAddress = process.env.TUSD8_ADDRESS || AEVUM_TUSD8;

  if (network.name === "hardhat" || network.name === "localhost") {
    const MockTUSD8 = await ethers.getContractFactory("MockTUSD8");
    const mock = await MockTUSD8.deploy();
    await mock.waitForDeployment();
    tokenAddress = await mock.getAddress();
    console.log("Deployed MockTUSD8 locally at:", tokenAddress);
  }

  const ReviewEscrow = await ethers.getContractFactory("ReviewEscrow");
  const escrow = await ReviewEscrow.deploy(tokenAddress);
  await escrow.waitForDeployment();

  const escrowAddress = await escrow.getAddress();
  console.log("ReviewEscrow deployed at:", escrowAddress);
  console.log("Bound tUSD8 token:", tokenAddress);

  if (network.name === "aevum") {
    console.log(`Explorer: https://explorer-test.qday.info/address/${escrowAddress}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
