/** Trạng thái hiển thị của một vé (từ dữ liệu API /users/:addr/tickets) */
export function ticketStatus(t) {
  const started = new Date(t.event.startTime).getTime() <= Date.now();
  if (t.burned) return { key: "refunded", label: "Đã hoàn tiền", tone: "neutral", icon: "refund" };
  if (t.event.cancelled) return { key: "cancelled", label: "Sự kiện bị huỷ", tone: "danger", icon: "cancel" };
  if (t.used) return { key: "used", label: "Đã soát vé", tone: "neutral", icon: "check" };
  if (t.listed) return { key: "listed", label: "Đang rao bán", tone: "warning", icon: "tag" };
  if (started) return { key: "live", label: "Hợp lệ · đang diễn ra", tone: "primary", icon: "valid" };
  return { key: "valid", label: "Hợp lệ", tone: "success", icon: "valid" };
}

/** Các hành động được phép theo đúng ràng buộc của contract */
export function ticketActions(t) {
  const s = ticketStatus(t).key;
  const started = new Date(t.event.startTime).getTime() <= Date.now();
  return {
    canShowQr: s === "valid" || s === "live" || s === "listed",
    canList: (s === "valid" || s === "listed") && !started,
    canCancelListing: s === "listed",
    canRefund: s === "cancelled",
  };
}
