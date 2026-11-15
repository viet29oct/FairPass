import { formatEther } from "ethers";

/** wei (string | bigint) → "0.05 ETH" (tối đa 4 chữ số thập phân, bỏ số 0 thừa) */
export function formatEth(wei, { symbol = true } = {}) {
  if (wei === null || wei === undefined || wei === "") return "—";
  const n = Number(formatEther(BigInt(wei)));
  const text = n.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
  return symbol ? `${text} ETH` : text;
}

export const shortAddress = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export const sameAddress = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" });

export const formatDate = (d) => dateFmt.format(new Date(d));
export const formatTime = (d) => timeFmt.format(new Date(d));
export const formatDateTime = (d) => `${formatTime(d)} · ${formatDate(d)}`;

export const tokenLabel = (id) => `#${String(id).padStart(4, "0")}`;

/** "còn 3 ngày", "còn 5 giờ", "đã diễn ra" */
export function relativeStart(d) {
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return "Đã diễn ra";
  const h = diff / 3_600_000;
  if (h < 1) return `Còn ${Math.ceil(diff / 60_000)} phút`;
  if (h < 48) return `Còn ${Math.floor(h)} giờ`;
  return `Còn ${Math.floor(h / 24)} ngày`;
}

/** ipfs://CID → gateway http */
export function ipfsToHttp(uri) {
  if (!uri) return uri;
  return uri.startsWith("ipfs://") ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : uri;
}

/** Tỉ lệ còn vé → trạng thái hiển thị */
export function availability(sold, supply) {
  const left = supply - sold;
  if (left <= 0) return { key: "soldout", label: "Hết vé", tone: "danger", icon: "invalid" };
  if (left / supply <= 0.15) return { key: "low", label: `Sắp hết · còn ${left}`, tone: "warning", icon: "warning" };
  return { key: "ok", label: `Còn ${left} vé`, tone: "success", icon: "valid" };
}
