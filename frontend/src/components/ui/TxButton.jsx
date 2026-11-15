/**
 * TxButton — nút gửi giao dịch dùng chung (MASTER §7.3, §8).
 *
 * Trạng thái: idle → (preparing) → signing → pending → success | error
 * - Chiều rộng cố định theo nhãn dài nhất → không nhảy layout.
 * - Nội dung đổi bằng trượt dọc 180ms; success: icon nảy lò xo; error: rung ngang 300ms.
 * - Tự xử lý: chưa kết nối ví → connect; sai mạng → switch; user huỷ ký → thông báo trung tính.
 *
 * action({ signer, contract, setStage }) phải trả về TransactionResponse.
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWallet } from "../../hooks/useWallet";
import { writeContract } from "../../lib/contract";
import { describeError } from "../../lib/errors";
import { txUrl } from "../../lib/config";
import { buttonClass } from "./Button";
import { Icon } from "./Icon";
import { useToast } from "./Toast";

const EASE = [0.16, 1, 0.3, 1];

export function TxButton({
  action,
  label,
  icon,
  successLabel = "Thành công",
  successToast,
  onSuccess,
  onError,
  variant = "primary",
  size = "md",
  full = false,
  disabled = false,
  className = "",
  confirmations = 1,
}) {
  const wallet = useWallet();
  const toast = useToast();
  const [phase, setPhase] = useState("idle");
  const [stageLabel, setStageLabel] = useState("");
  const [errorKey, setErrorKey] = useState(0);
  const timer = useRef(null);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      clearTimeout(timer.current);
    },
    []
  );

  const busy = phase === "preparing" || phase === "signing" || phase === "pending";
  const setSafe = (p) => mounted.current && setPhase(p);
  const resetLater = (ms) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSafe("idle"), ms);
  };

  // Nhãn khi ví chưa sẵn sàng
  const gate = !wallet.hasWallet
    ? { icon: "wallet", text: "Cài MetaMask" }
    : !wallet.isConnected
      ? { icon: "wallet", text: "Kết nối ví" }
      : !wallet.isCorrectChain
        ? { icon: "warning", text: "Chuyển mạng" }
        : null;

  const CONTENT = {
    idle: gate || { icon, text: label },
    preparing: { spinner: true, text: stageLabel || "Đang chuẩn bị…" },
    signing: { icon: "wallet", pulse: true, text: "Chờ ký trên ví…" },
    pending: { spinner: true, text: "Đang xác nhận…" },
    success: { icon: "valid", spring: true, text: successLabel },
    error: { icon: "invalid", text: "Thất bại" },
  };
  const content = CONTENT[phase];

  async function run() {
    if (busy || disabled) return;
    clearTimeout(timer.current);

    if (!wallet.hasWallet) return window.open("https://metamask.io/download/", "_blank", "noopener");
    try {
      if (!wallet.isConnected) return await wallet.connect();
      if (!wallet.isCorrectChain) return await wallet.switchNetwork();
    } catch (err) {
      const d = describeError(err);
      return d.rejected ? toast.info(d.title) : toast.error(d.title, d.message);
    }

    let pendingToast = null;
    try {
      setSafe("signing");
      // MetaMask 4100 (tài khoản/mạng chưa cấp quyền) → xin quyền rồi thử lại 1 lần
      const tx = await wallet.withAuthRetry(async () => {
        const signer = await wallet.getSigner();
        return action({
          signer,
          contract: writeContract(signer),
          setStage: (stage, text = "") => {
            setStageLabel(text);
            setSafe(stage);
          },
        });
      });
      setSafe("pending");
      const link = txUrl(tx.hash);
      pendingToast = toast.push({
        tone: "pending",
        title: "Giao dịch đang được xác nhận…",
        message: `${tx.hash.slice(0, 10)}…${tx.hash.slice(-6)}`,
        link: link && { href: link, label: "Xem trên Etherscan" },
      });

      const receipt = await tx.wait(confirmations);
      setSafe("success");
      toast.update(pendingToast, {
        tone: "success",
        title: successToast || successLabel,
        message: `Đã ghi vào block #${receipt.blockNumber}`,
        duration: 5000,
      });
      resetLater(2000);
      wallet.refreshBalance?.();
      await onSuccess?.(receipt);
    } catch (err) {
      const d = describeError(err);
      if (pendingToast) toast.dismiss(pendingToast);
      if (d.rejected) {
        toast.info(d.title);
        setSafe("idle");
        return;
      }
      setSafe("error");
      setErrorKey((k) => k + 1);
      toast.error(d.title, d.message);
      onError?.(d);
      resetLater(2500);
    }
  }

  // Bộ "sizer" vô hình: mọi nhãn chồng cùng 1 ô lưới → nút rộng bằng nhãn dài nhất
  const sizerLabels = [label, successLabel, "Chờ ký trên ví…", "Đang xác nhận…", stageLabel, gate?.text].filter(Boolean);
  const effVariant = phase === "success" ? "success" : phase === "error" ? "danger" : variant;

  return (
    <motion.button
      type="button"
      onClick={run}
      disabled={disabled && !busy}
      aria-busy={busy}
      animate={phase === "error" ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.3 }}
      data-error-count={errorKey}
      className={buttonClass({ variant: effVariant, size, full, className: `relative grid! ${className}` })}
    >
      {sizerLabels.map((t) => (
        <span key={t} aria-hidden="true" className="invisible col-start-1 row-start-1 flex items-center gap-2">
          <Icon name="wallet" />
          {t}
        </span>
      ))}
      <span className="pointer-events-none col-start-1 row-start-1 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={phase + (content.text || "")}
            className="flex items-center gap-2"
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            {content.spinner ? (
              <Icon name="spinner" spin />
            ) : content.spring ? (
              <motion.span
                className="inline-flex"
                initial={{ scale: 0.4 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 15 }}
              >
                <Icon name={content.icon} />
              </motion.span>
            ) : (
              content.icon && <Icon name={content.icon} className={content.pulse ? "animate-pulse" : ""} />
            )}
            {content.text}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="sr-only" aria-live="polite">
        {phase !== "idle" ? content.text : ""}
      </span>
    </motion.button>
  );
}
