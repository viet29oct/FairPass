/**
 * Soát vé (MASTER §6, §7.4, §9)
 * Quét QR hoặc dán mã FP1… → kiểm tra trước bằng cách ĐỌC contract (không tốn gas)
 * → khối kết quả bung ra → staff bấm Xác nhận → giao dịch checkIn (contract kiểm tra lại toàn bộ).
 */
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWallet } from "../hooks/useWallet";
import { api } from "../lib/api";
import { decodePayload, recoverSigner } from "../lib/checkin";
import { readContract } from "../lib/contract";
import { formatDateTime, sameAddress, shortAddress, tokenLabel } from "../lib/format";
import { RequireWallet } from "../components/RequireWallet";
import { QrScanner } from "../components/QrScanner";
import { Button } from "../components/ui/Button";
import { Card, SectionTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import { inputClass } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { TxButton } from "../components/ui/TxButton";

export default function CheckIn() {
  return (
    <RequireWallet
      allow={(r) => r.checkinEvents.length > 0}
      deniedTitle="Bạn không phải nhân viên soát vé"
      deniedText="Ban tổ chức cần thêm ví của bạn làm staff cho sự kiện."
    >
      <CheckInInner />
    </RequireWallet>
  );
}

function CheckInInner() {
  const { account, roles } = useWallet();
  const events = roles.checkinEvents;
  const [eventId, setEventId] = useState(events[0]?.id ?? null);
  const [paste, setPaste] = useState("");
  const [result, setResult] = useState(null); // { key, state: checking|valid|invalid|done, ... }
  const [flash, setFlash] = useState(null);
  const lastScan = useRef({ text: "", at: 0 });

  useEffect(() => {
    if (!events.some((e) => e.id === eventId)) setEventId(events[0]?.id ?? null);
  }, [events, eventId]);

  const flashOnce = (kind) => {
    setFlash(kind);
    setTimeout(() => setFlash(null), 320);
  };

  async function verify(raw) {
    const key = Date.now();
    setResult({ key, state: "checking" });
    try {
      const p = decodePayload(raw);
      let signer = null;
      try {
        signer = recoverSigner(p);
      } catch {
        /* chữ ký bị sửa tới mức không khôi phục được → coi như sai người ký */
      }
      let owner;
      try {
        owner = await readContract.ownerOf(p.tokenId);
      } catch {
        throw new Error(`Vé ${tokenLabel(p.tokenId)} không tồn tại hoặc đã được hoàn tiền`);
      }
      const [ticket, info] = await Promise.all([api(`/tickets/${p.tokenId}`).catch(() => null), readContract.getTicket(p.tokenId)]);
      const evInfo = await readContract.getEventInfo(info.eventId);
      const ticketEventId = Number(info.eventId);
      const staffOk =
        sameAddress(evInfo.organizer, account) || (await readContract.isStaff(ticketEventId, account));

      const checks = [
        { ok: sameAddress(signer, owner), label: "Chữ ký số của chủ vé", fail: "Người ký không phải chủ vé hiện tại" },
        { ok: p.deadline * 1000 > Date.now(), label: "Mã QR còn hạn", fail: "Mã QR đã hết hạn — yêu cầu khách mở mã mới" },
        { ok: !info.used, label: "Vé chưa được sử dụng", fail: "Vé đã được soát trước đó" },
        { ok: !evInfo.cancelled, label: "Sự kiện còn hiệu lực", fail: "Sự kiện đã bị huỷ" },
        { ok: ticketEventId === Number(eventId), label: "Đúng sự kiện đang soát", fail: `Vé thuộc sự kiện khác: ${evInfo.name}` },
        { ok: staffOk, label: "Ví bạn có quyền soát vé", fail: "Ví của bạn không phải staff của sự kiện này" },
      ];
      const valid = checks.every((c) => c.ok);
      flashOnce(valid ? "ok" : "bad");
      setResult({
        key,
        state: valid ? "valid" : "invalid",
        payload: p,
        owner,
        checks,
        eventName: evInfo.name,
        tierName: ticket?.tier?.name,
        startTime: ticket?.event?.startTime,
      });
    } catch (err) {
      flashOnce("bad");
      setResult({ key, state: "invalid", message: err.message });
    }
  }

  const onScan = (text) => {
    const now = Date.now();
    if (text === lastScan.current.text && now - lastScan.current.at < 4000) return;
    lastScan.current = { text, at: now };
    verify(text);
  };

  const reset = () => {
    setResult(null);
    setPaste("");
  };

  if (!eventId) return <EmptyState icon="staff" title="Không có sự kiện nào để soát vé" />;

  return (
    <>
      <SectionTitle
        title="Soát vé"
        subtitle="Quét mã QR động của khách hoặc dán mã kiểm tra."
        action={
          <label className="w-full sm:w-80">
            <span className="sr-only">Sự kiện đang soát</span>
            <select value={eventId} onChange={(e) => { setEventId(Number(e.target.value)); reset(); }} className={inputClass(false)}>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {formatDateTime(e.startTime)}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <QrScanner onScan={onScan} paused={!!result && result.state !== "checking"} flash={flash} />

          <form
            className="mt-6 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (paste.trim()) verify(paste.trim());
            }}
          >
            <label htmlFor="paste-code" className="mb-1.5 flex items-center gap-2 text-sm font-medium">
              <Icon name="paste" className="text-primary" /> Dán mã kiểm tra
            </label>
            <div className="flex gap-2">
              <input
                id="paste-code"
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                onPaste={(e) => {
                  const text = e.clipboardData.getData("text").trim();
                  if (text.startsWith("FP1.")) {
                    e.preventDefault();
                    setPaste(text);
                    verify(text);
                  }
                }}
                placeholder="FP1.31337.…"
                autoComplete="off"
                spellCheck={false}
                className={`${inputClass(false)} font-mono text-sm`}
              />
              <Button type="submit" variant="secondary" disabled={!paste.trim()}>
                Kiểm tra
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-fg">Dán là tự kiểm tra ngay — dùng khi demo trên 1 máy hoặc camera không quét được.</p>
          </form>
        </Card>

        <div aria-live="polite">
          <AnimatePresence mode="wait">
            {!result ? (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="flex h-full min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-muted-fg">
                  <Icon name="qrcode" size="lg" className="mb-3 text-primary" />
                  <p className="font-medium text-fg">Đang chờ mã vé</p>
                  <p className="mt-1 text-sm">Kết quả kiểm tra sẽ hiện ở đây.</p>
                </div>
              </motion.div>
            ) : (
              <ResultPanel key={result.key} result={result} onNext={reset} onDone={() => setResult((r) => ({ ...r, state: "done" }))} />
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}

function ResultPanel({ result, onNext, onDone }) {
  const { state } = result;
  const valid = state === "valid" || state === "done";
  const [left, setLeft] = useState(() => (result.payload ? result.payload.deadline - Math.floor(Date.now() / 1000) : 0));

  useEffect(() => {
    if (state !== "valid") return;
    const id = setInterval(() => setLeft(result.payload.deadline - Math.floor(Date.now() / 1000)), 500);
    return () => clearInterval(id);
  }, [state, result.payload]);

  if (state === "checking")
    return (
      <motion.div key="checking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-h-80 items-center justify-center rounded-2xl border border-border bg-card">
        <span className="flex items-center gap-3 text-muted-fg">
          <Icon name="spinner" spin /> Đang kiểm tra trên blockchain…
        </span>
      </motion.div>
    );

  const tone = valid ? "border-success/50 bg-success/10" : "border-danger/50 bg-danger/10";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0, x: valid ? 0 : [0, -6, 6, -4, 4, 0] }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1], x: { delay: 0.2, duration: 0.3 } }}
      className={`rounded-2xl border p-6 ${tone}`}
    >
      <div className="flex items-center gap-4">
        <ResultIcon valid={valid} />
        <div>
          <p className={`text-[32px] leading-none font-black tracking-tight ${valid ? "text-[#4ade80]" : "text-danger-text"}`}>
            {state === "done" ? "ĐÃ CHECK-IN" : valid ? "HỢP LỆ" : "KHÔNG HỢP LỆ"}
          </p>
          {result.payload && (
            <p className="mt-1.5 text-sm text-muted-fg">
              Vé <span className="font-mono text-fg">{tokenLabel(result.payload.tokenId)}</span>
              {result.tierName && <> · {result.tierName}</>}
              {result.owner && <> · <span className="font-mono">{shortAddress(result.owner)}</span></>}
            </p>
          )}
        </div>
      </div>

      {result.message && <p className="mt-5 text-danger-text">{result.message}</p>}

      {result.checks && (
        <ul className="mt-5 space-y-2">
          {result.checks.map((c, i) => (
            <motion.li
              key={c.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.25 }}
              className="flex items-start gap-2.5 text-sm"
            >
              <Icon name={c.ok ? "valid" : "invalid"} className={`mt-0.5 ${c.ok ? "text-[#4ade80]" : "text-danger-text"}`} />
              <span className={c.ok ? "text-fg" : "text-danger-text"}>{c.ok ? c.label : c.fail}</span>
            </motion.li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {state === "valid" && (
          <TxButton
            size="lg"
            variant="success"
            icon="valid"
            label={left > 0 ? `Xác nhận check-in · ${left}s` : "Xác nhận check-in"}
            successLabel="Đã check-in"
            successToast={`Đã soát vé ${tokenLabel(result.payload.tokenId)}`}
            action={({ contract }) => contract.checkIn(result.payload.tokenId, result.payload.deadline, result.payload.signature)}
            onSuccess={onDone}
          />
        )}
        <Button variant={state === "valid" ? "ghost" : "secondary"} size="lg" icon="qrcode" onClick={onNext}>
          {state === "done" ? "Soát vé tiếp theo" : "Quét vé khác"}
        </Button>
      </div>
    </motion.div>
  );
}

/** Icon FA + vòng tròn tự vẽ nét (stroke) quanh icon khi hợp lệ */
function ResultIcon({ valid }) {
  return (
    <span className="relative grid size-16 shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <motion.circle
          cx="32"
          cy="32"
          r="29"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          className={valid ? "stroke-success" : "stroke-danger-text"}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <motion.span
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 15, delay: 0.15 }}
        className={valid ? "text-[#4ade80]" : "text-danger-text"}
      >
        <Icon name={valid ? "valid" : "invalid"} size="lg" className="size-8!" />
      </motion.span>
    </span>
  );
}
