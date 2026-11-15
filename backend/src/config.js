require("dotenv").config();

const abi = require("./contracts/EventTicketNFT.abi.json");
const addresses = require("./contracts/addresses.json");

const chainId = Number(process.env.CHAIN_ID || 31337);
const deployment = addresses[chainId] || {};

const contractAddress = process.env.CONTRACT_ADDRESS || deployment.address;
if (!contractAddress) {
  throw new Error(
    `Không tìm thấy địa chỉ contract cho chainId ${chainId}. ` +
      "Hãy chạy scripts/deploy.js hoặc đặt CONTRACT_ADDRESS trong .env"
  );
}

const startBlockEnv = process.env.START_BLOCK;

module.exports = {
  port: Number(process.env.PORT || 4000),
  publicUrl: (process.env.PUBLIC_URL || "http://localhost:4000").replace(/\/$/, ""),
  corsOrigin: process.env.CORS_ORIGIN || "*",
  jwtSecret: process.env.JWT_SECRET || "dev-secret",

  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  chainId,
  contractAddress,
  abi,
  startBlock: startBlockEnv ? Number(startBlockEnv) : Number(deployment.deployBlock || 0),
  confirmations: Number(process.env.CONFIRMATIONS || 0),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS || 3000),
  logChunkSize: Number(process.env.LOG_CHUNK_SIZE || 2000),

  pinataJwt: process.env.PINATA_JWT || "",
  ipfsGateway: (process.env.IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs/").replace(/\/?$/, "/"),
};
