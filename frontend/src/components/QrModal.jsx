/**
 * Modal QR động (MASTER §7.2, §9)
 *  - Chủ vé ký EIP-712 (MetaMask) → payload FP1.<chainId>.<tokenId>.<deadline>.<sig>
 *  - Vòng SVG stroke-dashoffset chạy theo thời gian thực (rAF), ≤10s chuyển warning
 *  - Còn 5s tự yêu cầu ký lại (MetaMask luôn bật popup xác nhận) → QR lật 250ms
 *  - Chấm ping "Mã QR động đang hoạt động" chỉ khi mã còn hiệu lực
 *  - [Sao chép mã kiểm tra] để demo nhanh trên 1 laptop (dán sang /checkin)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "../hooks/useWallet";
import { createCheckInPayload } from "../lib/checkin";
import { copyText } from "../lib/clipboard";
import { QR_VALIDITY_SECONDS } from "../lib/config";
import { describeError } from "../lib/errors";
import { sameAddress, tokenLabel } from "../lib/format";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";
import { Modal } from "./ui/Modal";

const RING = 300; // kích thước SVG
const R = 140;
const CIRC = 2 * Math.PI * R;
const RENEW_AT = 5; // giây

export function QrModal({ ticket, open, onClose }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ticket ? `Vé ${tokenLabel(ticket.tokenId)} · ${ticket.tier.name}` : ""}
      subtitle={ticket?.event.name}
    >
      {open && ticket && <QrBody ticket={ticket} />}
    </Modal>
  );
}

function QrBody({ ticket }) {
  const wallet = useWallet();
  const [qr, setQr] = useState(null); // { payload, deadline }
  const [phase, setPhase] = useState("signing"); // signing | active | expired | error
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(QR_VALIDITY_SECONDS);
  const [copied, setCopied] = useState(false);
  const signingRef = useRef(false);
  const circleRef = useRef(null);
  const ownerMatches = sameAddress(wallet.account, ticket.owner);

  const sign = useCallback(async () => {
    if (signingRef.current) return;
    signingRef.current = true;
    setError("");
    setPhase((p) => (p === "active" ? p : "signing")); // đang hiện mã cũ thì giữ nguyên tới khi có mã mới
    try {
      const res = await wallet.withAuthRetry(async () =>
        createCheckInPayload(await wallet.getSigner(), ticket.tokenId)
      );
      setQr(res);
      setPhase("active");
    } catch (err) {
      const d = describeError(err);
      setError(d.rejected ? "Bạn đã từ chối ký — mã QR chưa được tạo/làm mới." : d.title);
      setPhase((p) => (p === "active" ? p : qrRef.current ? "expired" : "error"));
    } finally {
      signingRef.current = false;
    }
  }, [wallet, ticket.tokenId]);

  const qrRef = useRef(qr);
  qrRef.current = qr;

  // Ký lần đầu khi mở
  useEffect(() => {
    if (ownerMatches) sign();
    else setPhase("error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vòng đếm ngược theo thời gian thực
  useEffect(() => {
    if (!qr) return;
    let raf;
    let lastSec = -1;
    const tick = () => {
      const remainingMs = qr.deadline * 1000 - Date.now();
      const frac = Math.max(0, Math.min(1, remainingMs / (QR_VALIDITY_SECONDS * 1000)));
      if (circleRef.current) {
        circleRef.current.style.strokeDashoffset = String(CIRC * (1 - frac));
        circleRef.current.dataset.warn = remainingMs <= 10_000 ? "true" : "false";
      }
      const sec = Math.max(0, Math.ceil(remainingMs / 1000));
      if (sec !== lastSec) {
        lastSec = sec;
        setSeconds(sec);
      }
      if (remainingMs <= 0) {
        setPhase("expired");
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [qr]);

  // Tự làm mới khi còn 5s — chỉ khi ví đang chọn vẫn là chủ vé
  useEffect(() => {
    if (phase === "active" && seconds <= RENEW_AT && seconds > 0 && ownerMatches && !error) sign();
  }, [phase, seconds, ownerMatches, error, sign]);

  const copy = async () => {
    if (!qr || !(await copyText(qr.payload))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const active = phase === "active";
  const warn = seconds <= 10;

  return (
    <div className="flex flex-col items-center">
      {/* ── QR + vòng đếm ngược ── */}
      <div className="relative grid place-items-center" style={{ width: RING, height: RING, maxWidth: "100%" }}>
        <svg viewBox={`0 0 ${RING} ${RING}`} className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
          <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" strokeWidth="6" className="stroke-muted" />
          {qr && (
            <circle
              ref={circleRef}
              cx={RING / 2}
              cy={RING / 2}
              r={R}
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              className="stroke-success transition-[stroke] duration-300 data-[warn=true]:stroke-warning"
            />
          )}
        </svg>

        <div className="relative size-[212px]" style={{ perspective: 800 }}>
          <AnimatePresence mode="wait" initial={false}>
            {qr ? (
              <motion.div
                key={qr.payload}
                className="absolute inset-0 rounded-2xl bg-white p-3"
                initial={{ rotateY: -90, opacity: 0, filter: "blur(4px)" }}
                animate={{ rotateY: 0, opacity: 1, filter: "blur(0px)" }}
                exit={{ rotateY: 90, opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.125, ease: "easeInOut" }}
              >
                <QRCodeSVG
                  value={qr.payload}
                  size={188}
                  level="M"
                  className={`size-full transition-[filter,opacity] duration-300 ${active ? "" : "opacity-40 blur-[3px]"}`}
                  title={`Mã soát vé ${tokenLabel(ticket.tokenId)}`}
                />
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                className="absolute inset-0 grid place-items-center rounded-2xl border border-dashed border-border bg-muted text-center"
                exit={{ opacity: 0 }}
              >
                {phase === "signing" ? (
                  <div className="px-6 text-sm text-muted-fg">
                    <Icon name="wallet" size="lg" className="mx-auto mb-3 animate-pulse text-primary" />
                    Mở MetaMask và ký để tạo mã QR
                  </div>
                ) : (
                  <Icon name="qrcode" size="lg" className="text-muted-fg" />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Lớp phủ khi hết hạn */}
          {qr && phase === "expired" && (
            <div className="absolute inset-0 grid place-items-center">
              <Button size="sm" icon="refresh" onClick={sign}>
                Làm mới mã
              </Button>
            </div>
          )}
        </div>

        {qr && (
          <span
            className={`absolute bottom-1 rounded-full bg-card px-2.5 py-0.5 font-mono text-sm font-medium tabular-nums ${
              warn ? "text-warning" : "text-[#4ade80]"
            } ${active && seconds <= RENEW_AT ? "animate-pulse" : ""}`}
            aria-live="off"
          >
            {seconds}s
          </span>
        )}
      </div>

      {/* ── Trạng thái động ── */}
      <div className="mt-3 flex min-h-6 items-center gap-2 text-sm" aria-live="polite">
        {active ? (
          <>
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            <span className="font-medium text-[#4ade80]">Mã QR động đang hoạt động</span>
          </>
        ) : phase === "expired" ? (
          <>
            <span className="size-2.5 rounded-full bg-muted-fg" />
            <span className="text-muted-fg">Mã đã hết hạn</span>
          </>
        ) : null}
      </div>

      {/* ── Sao chép mã kiểm tra ── */}
      <button
        type="button"
        onClick={copy}
        disabled={!qr || !active}
        className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-muted px-3.5 text-sm font-medium transition-colors hover:border-primary/60 disabled:opacity-40"
      >
        <span className="relative inline-flex size-4 overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={copied ? "ok" : "copy"}
              className="absolute inset-0 inline-flex"
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <Icon name={copied ? "valid" : "copy"} className={copied ? "text-[#4ade80]" : ""} />
            </motion.span>
          </AnimatePresence>
        </span>
        {copied ? "Đã chép mã kiểm tra" : "Sao chép mã kiểm tra"}
      </button>

      {/* ── Ghi chú / lỗi ── */}
      <div className="mt-4 w-full space-y-2 text-center text-xs text-muted-fg">
        {error && <p className="text-sm text-danger-text">{error}</p>}
        {!ownerMatches && (
          <p className="rounded-lg bg-warning/10 px-3 py-2 text-sm text-warning">
            Ví đang chọn trong MetaMask không phải chủ vé — đã dừng tự làm mới mã.
          </p>
        )}
        {phase === "error" && ownerMatches && (
          <Button size="sm" variant="secondary" icon="qrcode" onClick={sign}>
            Ký để hiện mã QR
          </Button>
        )}
        <p className="flex items-center justify-center gap-1.5">
          <Icon name="shield" className="size-3!" />
          Mã tự đổi mỗi {QR_VALIDITY_SECONDS} giây — ảnh chụp màn hình sẽ không dùng được.
        </p>
      </div>
    </div>
  );
}
