const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying EventTicketNFT...\n");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log(
    "Balance:",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    "ETH\n"
  );

  // Deploy contract
  const EventTicketNFT = await hre.ethers.getContractFactory("EventTicketNFT");
  const contract = await EventTicketNFT.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log("✅ EventTicketNFT deployed to:", contractAddress);

  // Lưu thông tin deploy
  const deployInfo = {
    contractAddress,
    deployer: deployer.address,
    network: hre.network.name,
    timestamp: new Date().toISOString(),
  };

  console.log("\n📋 Deploy Info:", JSON.stringify(deployInfo, null, 2));

  // Nếu deploy trên testnet → verify
  if (hre.network.name === "sepolia") {
    console.log("\n⏳ Waiting for block confirmations...");
    await contract.deploymentTransaction().wait(6);

    console.log("🔍 Verifying on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [],
      });
      console.log("✅ Verified on Etherscan!");
    } catch (error) {
      console.log("❌ Verification failed:", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
