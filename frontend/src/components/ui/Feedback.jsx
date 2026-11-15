import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Icon } from "./Icon";

export function Skeleton({ className = "" }) {
  return <div className={`skeleton rounded-lg ${className}`} aria-hidden="true" />;
}

export function EmptyState({ icon = "ticket", title, description, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted text-primary">
        <Icon name={icon} size="lg" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-md text-sm text-muted-fg">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <EmptyState
      icon="warning"
      title="Không tải được dữ liệu"
      description={error?.message}
      action={
        onRetry && (
          <button onClick={onRetry} className="text-sm font-semibold text-primary hover:underline">
            Thử lại
          </button>
        )
      }
    />
  );
}

/** Thanh tiến độ: scaleX 0 → value trong 700ms (GPU, MASTER §7.5) */
export function ProgressBar({ value, tone = "primary", label }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(Math.max(0, Math.min(1, value || 0))));
    return () => cancelAnimationFrame(id);
  }, [value]);
  const color = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round((value || 0) * 100)}
    >
      <div className={`progress-fill h-full w-full rounded-full ${color}`} style={{ transform: `scaleX(${shown})` }} />
    </div>
  );
}

/**
 * Hiện nối tiếp: trễ 45ms mỗi phần tử, tối đa 12 (MASTER §7.5).
 * Phần tử giữ nguyên key khi reload → không chạy lại hiệu ứng.
 */
export function StaggerItem({ index, children, className = "", as = "div" }) {
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.045, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </Tag>
  );
}

export function Spinner({ className = "" }) {
  return <Icon name="spinner" spin className={className} />;
}
