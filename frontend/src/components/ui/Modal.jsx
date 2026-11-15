import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { IconButton } from "./Button";

/**
 * Modal: nền mờ + khung bật lên (out-expo). Esc để đóng, khoá cuộn trang,
 * focus vào khung khi mở và trả focus khi đóng.
 */
export function Modal({ open, onClose, title, subtitle, children, size = "md", dismissible = true }) {
  const titleId = useId();
  const panelRef = useRef(null);
  const lastFocus = useRef(null);

  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const onKey = (e) => e.key === "Escape" && dismissible && onClose?.();
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      lastFocus.current?.focus?.();
    };
  }, [open, dismissible, onClose]);

  const width = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" }[size];

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => dismissible && onClose?.()}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={`relative max-h-[92dvh] w-full ${width} overflow-y-auto rounded-t-3xl border border-border bg-card p-5 shadow-2xl outline-none sm:rounded-3xl sm:p-6`}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.15 } }}
            transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id={titleId} className="text-lg font-bold">
                  {title}
                </h2>
                {subtitle && <p className="mt-0.5 text-sm text-muted-fg">{subtitle}</p>}
              </div>
              {dismissible && <IconButton icon="close" label="Đóng" onClick={onClose} className="-mt-2 -mr-2" />}
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
