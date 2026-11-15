/**
 * Toast: trượt vào bằng spring, các toast tự dồn chỗ mượt khi chồng nhau (layout),
 * thanh thời gian dừng khi hover (MASTER §7.3).
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Icon } from "./Icon";

const ToastContext = createContext(null);

const TONE = {
  success: { icon: "valid", color: "text-[#4ade80]", bar: "bg-success" },
  error: { icon: "invalid", color: "text-danger-text", bar: "bg-danger-text" },
  info: { icon: "info", color: "text-primary", bar: "bg-primary" },
  pending: { icon: "spinner", color: "text-primary", bar: "bg-primary" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  /** push → id; update(id, patch) để đổi toast "đang xử lý" thành kết quả */
  const push = useCallback((toast) => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, duration: 5000, tone: "info", ...toast }]);
    return id;
  }, []);
  const update = useCallback(
    (id, patch) => setToasts((t) => t.map((x) => (x.id === id ? { ...x, ...patch, version: (x.version || 0) + 1 } : x))),
    []
  );

  const api = useMemo(
    () => ({
      push,
      update,
      dismiss,
      success: (title, message, extra) => push({ tone: "success", title, message, ...extra }),
      error: (title, message, extra) => push({ tone: "error", title, message, duration: 7000, ...extra }),
      info: (title, message, extra) => push({ tone: "info", title, message, ...extra }),
    }),
    [push, update, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-20 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2 md:bottom-6"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastItem key={t.id} toast={t} onClose={() => dismiss(t.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }) {
  const reduce = useReducedMotion();
  const tone = TONE[toast.tone] || TONE.info;
  const persistent = toast.tone === "pending" || !toast.duration;

  // Reduced motion: thanh thời gian không chạy → tự đóng bằng timer
  useEffect(() => {
    if (!reduce || persistent) return;
    const id = setTimeout(onClose, toast.duration);
    return () => clearTimeout(id);
  }, [reduce, persistent, toast.duration, toast.version, onClose]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 40, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 40, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="group pointer-events-auto relative overflow-hidden rounded-xl border border-border bg-card/95 shadow-2xl shadow-black/50 backdrop-blur"
      role={toast.tone === "error" ? "alert" : "status"}
    >
      <div className="flex gap-3 p-3.5 pr-11">
        <span className={`mt-0.5 ${tone.color}`}>
          <Icon name={tone.icon} spin={toast.tone === "pending"} size="md" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold leading-snug">{toast.title}</p>
          {toast.message && <p className="mt-0.5 text-sm break-words text-muted-fg">{toast.message}</p>}
          {toast.link && (
            <a
              href={toast.link.href}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              {toast.link.label} <Icon name="external" className="size-3!" />
            </a>
          )}
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label="Đóng thông báo"
        className="absolute top-2 right-2 grid size-8 place-items-center rounded-lg text-muted-fg hover:bg-muted hover:text-fg"
      >
        <Icon name="close" />
      </button>
      {!persistent && (
        <span
          key={toast.version || 0}
          className={`absolute bottom-0 left-0 h-0.5 w-full origin-left opacity-70 ${tone.bar} animate-toast-timer group-hover:[animation-play-state:paused]`}
          style={{ animationDuration: `${toast.duration}ms` }}
          onAnimationEnd={onClose}
        />
      )}
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast phải nằm trong <ToastProvider>");
  return ctx;
}
