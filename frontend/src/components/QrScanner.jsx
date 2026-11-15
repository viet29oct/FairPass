/**
 * Khung quét QR (MASTER §7.4): vạch quét lên xuống + 4 góc nhịp nhàng,
 * loé xanh/đỏ khi bắt được mã. Camera qua html5-qrcode (tải động khi bật).
 */
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui/Button";
import { Icon } from "./ui/Icon";

const READER_ID = "fairpass-qr-reader";

export function QrScanner({ onScan, paused, flash }) {
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const scannerRef = useRef(null);
  const onScanRef = useRef(onScan);
  const pausedRef = useRef(paused);
  onScanRef.current = onScan;
  pausedRef.current = paused;

  async function start() {
    setError("");
    setStarting(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, aspectRatio: 1 },
        (text) => !pausedRef.current && onScanRef.current(text),
        () => {}
      );
      setActive(true);
    } catch (err) {
      setError(
        /permission|notallowed/i.test(String(err))
          ? "Trình duyệt chưa được cấp quyền camera."
          : "Không mở được camera — hãy dùng ô Dán mã kiểm tra bên dưới."
      );
      scannerRef.current = null;
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    const s = scannerRef.current;
    scannerRef.current = null;
    setActive(false);
    try {
      if (s?.isScanning) await s.stop();
      s?.clear();
    } catch {
      /* đã dừng */
    }
  }

  useEffect(() => {
    return () => {
      stop();
    };
  }, []);

  const flashCls =
    flash === "ok" ? "ring-4 ring-success" : flash === "bad" ? "ring-4 ring-danger-text" : "ring-0 ring-transparent";

  return (
    <div>
      <div
        className={`relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-3xl border border-border bg-black transition-[box-shadow] duration-300 ${flashCls}`}
        style={{ "--scan-distance": "calc(min(360px, 100vw - 48px) - 2px)" }}
      >
        <div id={READER_ID} className="absolute inset-0 [&_video]:size-full! [&_video]:object-cover" />

        {!active && (
          <div className="absolute inset-0 grid place-items-center bg-muted text-center">
            <div className="px-6">
              <Icon name="camera" size="lg" className="mx-auto mb-3 text-primary" />
              <p className="text-sm text-muted-fg">Camera đang tắt</p>
            </div>
          </div>
        )}

        {/* Khung ngắm */}
        <div className="pointer-events-none absolute inset-6">
          <span className="scan-corner top-0 left-0 rounded-tl-xl border-t-4 border-l-4 [transform-origin:top_left]" />
          <span className="scan-corner top-0 right-0 rounded-tr-xl border-t-4 border-r-4 [transform-origin:top_right]" />
          <span className="scan-corner bottom-0 left-0 rounded-bl-xl border-b-4 border-l-4 [transform-origin:bottom_left]" />
          <span className="scan-corner right-0 bottom-0 rounded-br-xl border-r-4 border-b-4 [transform-origin:bottom_right]" />
        </div>
        {!paused && <div className="scanline" style={{ "--scan-distance": "calc(min(360px, 100vw - 48px) - 4px)" }} />}
      </div>

      <div className="mt-3 flex justify-center">
        {active ? (
          <Button variant="secondary" size="sm" icon="pause" onClick={stop}>
            Tắt camera
          </Button>
        ) : (
          <Button size="sm" icon={starting ? "spinner" : "camera"} onClick={start} disabled={starting}>
            {starting ? "Đang mở camera…" : "Bật camera"}
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-center text-sm text-danger-text">{error}</p>}
    </div>
  );
}
