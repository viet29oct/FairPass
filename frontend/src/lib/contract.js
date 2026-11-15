import { Contract, Interface, JsonRpcProvider, id } from "ethers";
import { CHAIN, CONTRACT_ABI, CONTRACT_ADDRESS } from "./config";

export const iface = new Interface(CONTRACT_ABI);

/** Provider chỉ đọc — hoạt động cả khi chưa cài MetaMask */
export const readProvider = new JsonRpcProvider(CHAIN.rpcUrl, CHAIN.id, { staticNetwork: true });

export const readContract = CONTRACT_ADDRESS ? new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, readProvider) : null;

export const writeContract = (signer) => new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

export const ORGANIZER_ROLE = id("ORGANIZER_ROLE");

/** Tìm event log theo tên trong receipt */
export function findEvent(receipt, name) {
  for (const log of receipt?.logs || []) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === name) return parsed;
    } catch {
      /* log của contract khác */
    }
  }
  return null;
}
