import addresses from "../contracts/addresses.json";
import abi from "../contracts/EventTicketNFT.abi.json";

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000/api").replace(/\/$/, "");
export const TARGET_CHAIN_ID = Number(import.meta.env.VITE_CHAIN_ID || 31337);

const CHAINS = {
  31337: {
    name: "Hardhat Local",
    shortName: "Local",
    rpcUrl: "http://127.0.0.1:8545",
    explorer: null,
    currency: { name: "Ether", symbol: "ETH", decimals: 18 },
  },
  11155111: {
    name: "Sepolia",
    shortName: "Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    explorer: "https://sepolia.etherscan.io",
    currency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
};

export const CHAIN = {
  id: TARGET_CHAIN_ID,
  ...(CHAINS[TARGET_CHAIN_ID] || CHAINS[31337]),
  ...(import.meta.env.VITE_RPC_URL ? { rpcUrl: import.meta.env.VITE_RPC_URL } : {}),
};

export const CONTRACT_ADDRESS = addresses[TARGET_CHAIN_ID]?.address || null;
export const CONTRACT_ABI = abi;

/** Thời hạn chữ ký QR (giây) — contract cho phép tối đa 10 phút */
export const QR_VALIDITY_SECONDS = 60;

export const txUrl = (hash) => (CHAIN.explorer ? `${CHAIN.explorer}/tx/${hash}` : null);
export const addressUrl = (addr) => (CHAIN.explorer ? `${CHAIN.explorer}/address/${addr}` : null);
