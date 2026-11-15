require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
const { task } = require("hardhat/config");

/**
 * Nạp ETH test cho một ví bất kỳ trên mạng local:
 *   npx hardhat faucet 0xĐịaChỉVí --network localhost [--amount 100]
 */
task("faucet", "Gửi ETH test từ tài khoản #0 tới một địa chỉ (chỉ mạng local)")
  .addPositionalParam("address", "Địa chỉ ví nhận")
  .addOptionalParam("amount", "Số ETH", "100")
  .setAction(async ({ address, amount }, hre) => {
    if (!["localhost", "hardhat"].includes(hre.network.name)) {
      throw new Error("Faucet chỉ dùng cho mạng local. Sepolia: dùng faucet công khai.");
    }
    if (!hre.ethers.isAddress(address)) throw new Error(`Địa chỉ không hợp lệ: ${address}`);
    const [funder] = await hre.ethers.getSigners();
    const tx = await funder.sendTransaction({ to: address, value: hre.ethers.parseEther(amount) });
    await tx.wait();
    const balance = await hre.ethers.provider.getBalance(address);
    console.log(`✅ Đã gửi ${amount} ETH tới ${address} — số dư: ${hre.ethers.formatEther(balance)} ETH`);
  });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      evmVersion: "cancun", // OpenZeppelin 5.x dùng opcode mcopy
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts:
        process.env.DEPLOYER_PRIVATE_KEY
          ? [process.env.DEPLOYER_PRIVATE_KEY]
          : [],
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
  },
};
