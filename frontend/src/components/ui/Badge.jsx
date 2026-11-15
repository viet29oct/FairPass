import { Icon } from "./Icon";

const TONES = {
  neutral: "bg-muted text-muted-fg border-border",
  primary: "bg-primary/10 text-primary border-primary/30",
  success: "bg-success/12 text-[#4ade80] border-success/35",
  warning: "bg-warning/12 text-warning border-warning/35",
  danger: "bg-danger/12 text-danger-text border-danger/40",
};

/** Trạng thái luôn có icon + chữ, không chỉ màu (MASTER §1) */
export function Badge({ tone = "neutral", icon, children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold leading-none whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {icon && <Icon name={icon} className="size-3.5!" />}
      {children}
    </span>
  );
}
