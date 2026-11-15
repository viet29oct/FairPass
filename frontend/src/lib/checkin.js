/**
 * Mã kiểm tra soát vé (MASTER.md §9): FP1.<chainId>.<tokenId>.<deadline>.<signature>
 * Cùng một chuỗi dùng cho QR và cho nút [Sao chép mã kiểm tra].
 */
import { verifyTypedData } from "ethers";
import { CHAIN, CONTRACT_ADDRESS, QR_VALIDITY_SECONDS } from "./config";

const TYPES = { CheckIn: [{ name: "tokenId", type: "uint256" }, { name: "deadline", type: "uint256" }] };
const domain = () => ({ name: "FairPass", version: "1", chainId: CHAIN.id, verifyingContract: CONTRACT_ADDRESS });

/** Chủ vé ký EIP-712 → payload */
export async function createCheckInPayload(signer, tokenId) {
  const deadline = Math.floor(Date.now() / 1000) + QR_VALIDITY_SECONDS;
  const signature = await signer.signTypedData(domain(), TYPES, { tokenId: BigInt(tokenId), deadline: BigInt(deadline) });
  return { payload: encodePayload({ tokenId, deadline, signature }), deadline, signature };
}

export const encodePayload = ({ tokenId, deadline, signature }) =>
  `FP1.${CHAIN.id}.${tokenId}.${deadline}.${signature}`;

const PATTERN = /^FP1\.(\d+)\.(\d+)\.(\d+)\.(0x[0-9a-fA-F]{130})$/;

/** → { chainId, tokenId, deadline, signature } hoặc ném lỗi tiếng Việt */
export function decodePayload(raw) {
  const m = String(raw || "").trim().match(PATTERN);
  if (!m) throw new Error("Mã kiểm tra không đúng định dạng FairPass");
  const [, chainId, tokenId, deadline, signature] = m;
  if (Number(chainId) !== CHAIN.id) throw new Error(`Mã thuộc mạng khác (chainId ${chainId})`);
  return { chainId: Number(chainId), tokenId: Number(tokenId), deadline: Number(deadline), signature };
}

/** Khôi phục địa chỉ đã ký (kiểm tra trước ở FE, contract vẫn kiểm tra lại) */
export function recoverSigner({ tokenId, deadline, signature }) {
  return verifyTypedData(domain(), TYPES, { tokenId: BigInt(tokenId), deadline: BigInt(deadline) }, signature);
}
