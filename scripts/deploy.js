const hre = require("hardhat");
const { exportAbi } = require("./export-abi");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const { chainId } = await hre.ethers.provider.getNetwork();
  console.log(`🚀 Deploy EventTicketNFT lên ${hre.network.name} (chainId ${chainId})`);
  console.log("Deployer:", deployer.address);
  console.log("Số dư:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH\n");

  const contract = await hre.ethers.deployContract("EventTicketNFT");
  await contract.waitForDeployment();
  const receipt = await contract.deploymentTransaction().wait();
  const address = await contract.getAddress();
  console.log("✅ Đã deploy tại:", address, "(block", receipt.blockNumber + ")");

  // Lưu địa chỉ + ABI cho frontend/backend
  exportAbi({
    network: hre.network.name,
    chainId: Number(chainId),
    address,
    deployBlock: receipt.blockNumber,
    deployer: deployer.address,
  });

  if (hre.network.name === "sepolia") {
    console.log("\n⏳ Chờ 6 block xác nhận rồi verify trên Etherscan...");
    await contract.deploymentTransaction().wait(6);
    try {
      await hre.run("verify:verify", { address, constructorArguments: [] });
      console.log("✅ Đã verify trên Etherscan");
    } catch (err) {
      console.log("❌ Verify thất bại:", err.message);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
