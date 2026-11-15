import { useId } from "react";
import { motion } from "motion/react";

/**
 * Ô nhập có nhãn thật + lỗi ngay dưới ô (MASTER §10).
 * `shakeKey` thay đổi → ô rung 300ms (MASTER §7.3).
 */
export function Field({ label, hint, error, shakeKey, children, className = "", suffix }) {
  const id = useId();
  const child = typeof children === "function" ? children({ id, invalid: !!error }) : children;
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
          {label}
        </label>
      )}
      <motion.div
        key={shakeKey}
        className={`relative ${shakeKey ? "animate-shake" : ""}`}
        initial={false}
      >
        {child}
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-fg">
            {suffix}
          </span>
        )}
      </motion.div>
      <div aria-live="polite" className="min-h-5">
        {error ? (
          <p className="mt-1.5 text-sm text-danger-text">{error}</p>
        ) : (
          hint && <p className="mt-1.5 text-sm text-muted-fg">{hint}</p>
        )}
      </div>
    </div>
  );
}

export const inputClass = (invalid) =>
  [
    "h-11 w-full rounded-xl border bg-muted px-3.5 text-[15px] text-fg placeholder:text-muted-fg/70",
    "transition-[border-color,box-shadow] duration-150 outline-none",
    "focus:border-primary focus:ring-2 focus:ring-primary/25",
    invalid ? "border-danger-text" : "border-border",
  ].join(" ");
