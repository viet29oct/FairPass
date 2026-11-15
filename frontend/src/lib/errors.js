/**
 * Dịch lỗi ví / contract sang tiếng Việt (MASTER.md §8).
 *
 * MetaMask bọc lỗi của node thành nhiều lớp ("Internal JSON-RPC error." → data → data…),
 * ethers v6 không giải mã được thì báo "could not coalesce error". Vì vậy ta duyệt
 * TOÀN BỘ object lỗi để gom mọi message + mọi chuỗi revert data rồi mới phân loại.
 */
import { AbiCoder } from "ethers";
import { iface } from "./contract";
import { CHAIN } from "./config";

const MESSAGES = {
  EventNotFound: "Sự kiện không tồn tại",
  InvalidEventData: "Thông tin sự kiện không hợp lệ (tên, thời gian, giới hạn vé/ví, % giá trần ≥ 100)",
  InvalidTier: "Hạng vé không hợp lệ",
  NotEventOrganizer: "Bạn không phải ban tổ chức của sự kiện này",
  NotStaff: "Ví này không có quyền soát vé cho sự kiện",
  EventIsCancelled: "Sự kiện đã bị huỷ",
  EventNotCancelled: "Sự kiện chưa bị huỷ nên chưa thể hoàn tiền",
  EventAlreadyStarted: "Sự kiện đã bắt đầu",
  EventNotStarted: "Chỉ rút được doanh thu sau giờ diễn",
  AlreadyWithdrawn: "Doanh thu đã được rút, không thể huỷ sự kiện",
  SoldOut: "Hạng vé này đã hết",
  InvalidQuantity: "Số lượng vé không hợp lệ",
  IncorrectPayment: "Số tiền gửi không khớp với giá vé",
  WalletLimitExceeded: "Bạn đã đạt giới hạn số vé mỗi ví cho sự kiện này",
  NotTicketOwner: "Bạn không sở hữu vé này",
  TicketAlreadyUsed: "Vé đã được sử dụng",
  PriceExceedsCap: "Giá vượt mức giá trần cho phép",
  NotListed: "Vé không còn được rao bán",
  CannotBuyOwnTicket: "Bạn không thể mua vé của chính mình",
  TransfersDisabled: "Vé không thể chuyển nhượng ngoài chợ FairPass",
  InvalidSignature: "Chữ ký không hợp lệ — người ký không phải chủ vé",
  QRExpired: "Mã QR đã hết hạn — yêu cầu khách mở lại mã mới",
  QRDeadlineTooFar: "Mã QR có thời hạn không hợp lệ",
  NothingToWithdraw: "Không có doanh thu để rút",
  PaymentFailed: "Chuyển tiền thất bại",
  EnforcedPause: "Hệ thống đang tạm dừng khẩn cấp",
  AccessControlUnauthorizedAccount: "Ví này không có quyền thực hiện thao tác",
  ERC721NonexistentToken: "Vé không tồn tại hoặc đã được hoàn tiền",
};

const ERROR_STRING_SELECTOR = "0x08c379a0"; // Error(string)

/** Duyệt đệ quy toàn bộ object lỗi → { messages[], hexes[], codes[] } */
function collect(err) {
  const out = { messages: [], hexes: [], codes: [] };
  const seen = new WeakSet();
  const walk = (v, depth) => {
    if (v === null || v === undefined || depth > 10) return;
    if (typeof v === "string") {
      if (/^0x[0-9a-fA-F]{8,}$/.test(v)) out.hexes.push(v);
      else if (v.length > 2) out.messages.push(v);
      return;
    }
    if (typeof v !== "object" || seen.has(v)) return;
    seen.add(v);
    if (v.code !== undefined) out.codes.push(v.code);
    for (const key of Object.getOwnPropertyNames(v)) {
      if (key === "stack" || key === "transaction" || key === "request") continue;
      try {
        walk(v[key], depth + 1);
      } catch {
        /* getter lỗi */
      }
    }
  };
  walk(err, 0);
  return out;
}

function decodeRevert(hexes) {
  for (const data of hexes) {
    if (data.startsWith(ERROR_STRING_SELECTOR)) {
      try {
        const [reason] = AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10));
        return { name: null, reason };
      } catch {
        /* bỏ qua */
      }
    }
    try {
      const parsed = iface.parseError(data);
      if (parsed) return { name: parsed.name };
    } catch {
      /* không phải lỗi của contract này */
    }
  }
  return null;
}

export function isUserRejection(err) {
  const { messages, codes } = collect(err);
  return (
    err?.code === "ACTION_REJECTED" ||
    codes.includes(4001) ||
    messages.some((m) => /user (rejected|denied)|rejected the request/i.test(m))
  );
}

/** MetaMask 4100: tài khoản / mạng chưa được cấp quyền cho trang */
export function isUnauthorized(err) {
  const { messages, codes } = collect(err);
  return codes.includes(4100) || messages.some((m) => /not been authorized|unauthorized/i.test(m));
}

const fundHint = () =>
  CHAIN.id === 31337 ? "Mạng local: mở menu ví (góc phải) → Nhận 100 ETH test" : "Sepolia: xin ETH miễn phí từ faucet testnet";

/** → { title, message, rejected } */
export function describeError(err) {
  if (import.meta.env.DEV) console.error("[FairPass] lỗi giao dịch:", err);
  if (isUserRejection(err)) return { rejected: true, title: "Bạn đã huỷ thao tác trên ví", message: "" };

  const { messages, hexes } = collect(err);
  const text = messages.join(" | ");

  // 1. Lỗi revert của contract (custom error hoặc require string)
  const name = err?.revert?.name || decodeRevert(hexes)?.name || text.match(/custom error '(\w+)\(/)?.[1];
  if (name && MESSAGES[name]) return { title: MESSAGES[name], message: "" };
  const reason = err?.reason || decodeRevert(hexes)?.reason;
  if (reason) return { title: "Hợp đồng từ chối giao dịch", message: reason };

  // 2. Lỗi ví / node thường gặp
  if (isUnauthorized(err))
    return {
      title: "Tài khoản MetaMask chưa được cấp quyền cho FairPass",
      message: "Mở MetaMask → chọn đúng tài khoản → Kết nối với trang này (cả mạng Hardhat Local), rồi thử lại",
    };
  if (err?.code === "INSUFFICIENT_FUNDS" || /insufficient funds|doesn't have enough funds|exceeds balance/i.test(text))
    return { title: "Ví không đủ ETH để thanh toán và trả phí gas", message: fundHint() };
  if (/nonce too (high|low)|invalid nonce|nonce has already been used/i.test(text))
    return {
      title: "Lệch nonce giao dịch giữa MetaMask và mạng local",
      message: "MetaMask → Settings → Advanced → Clear activity tab data, rồi thử lại",
    };
  if (/chain ?id|chainId/i.test(text) && /mismatch|invalid|does not match/i.test(text))
    return { title: "MetaMask đang ở sai mạng", message: `Chuyển MetaMask sang ${CHAIN.name}` };
  if (/failed to fetch|ECONNREFUSED|could not detect network|network error/i.test(text))
    return { title: "Không kết nối được mạng blockchain", message: "Hardhat node / RPC đã chạy chưa?" };
  if (/execution reverted|VM Exception|CALL_EXCEPTION/i.test(text) || err?.code === "CALL_EXCEPTION")
    return { title: "Hợp đồng từ chối giao dịch", message: "Kiểm tra lại điều kiện (số lượng, giá, trạng thái sự kiện)" };

  // 3. Không phân loại được → lấy message có ý nghĩa nhất, tránh "could not coalesce error"
  const useful = messages.find(
    (m) => !/could not coalesce|Internal JSON-RPC error|unknown error|^UNKNOWN_ERROR$/i.test(m) && m.length < 300
  );
  return { title: "Giao dịch không thành công", message: useful || err?.shortMessage || err?.message || "" };
}
