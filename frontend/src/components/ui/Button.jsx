import { Link } from "react-router";
import { Icon } from "./Icon";

export const BUTTON_VARIANTS = {
  primary: "bg-primary text-on-primary hover:bg-primary-hover",
  secondary: "bg-muted text-fg border border-border hover:border-primary/60 hover:bg-[#21263a]",
  ghost: "text-muted-fg hover:text-fg hover:bg-muted",
  danger: "bg-danger text-white hover:bg-[#b91c1c]",
  success: "bg-success text-bg hover:bg-[#15803d]",
};

export const BUTTON_SIZES = {
  sm: "h-10 px-3.5 text-sm gap-2 rounded-lg",
  md: "h-11 px-5 text-[15px] gap-2 rounded-xl",
  lg: "h-13 px-6 text-base gap-2.5 rounded-xl",
};

export const buttonClass = ({ variant = "primary", size = "md", full = false, className = "" } = {}) =>
  [
    "inline-flex items-center justify-center font-semibold select-none whitespace-nowrap",
    "transition-[background-color,border-color,color,transform,opacity] duration-150 ease-[var(--ease-standard)]",
    "active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    full ? "w-full" : "",
    className,
  ].join(" ");

export function Button({ variant, size, full, icon, iconRight, children, className, to, ...props }) {
  const cls = buttonClass({ variant, size, full, className });
  const content = (
    <>
      {icon && <Icon name={icon} />}
      {children}
      {iconRight && <Icon name={iconRight} />}
    </>
  );
  if (to)
    return (
      <Link to={to} className={cls} {...props}>
        {content}
      </Link>
    );
  return (
    <button type="button" className={cls} {...props}>
      {content}
    </button>
  );
}

/** Nút chỉ có icon — bắt buộc có aria-label, vùng bấm 44×44 */
export function IconButton({ icon, label, className = "", ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-11 items-center justify-center rounded-xl text-muted-fg transition-colors duration-150 hover:bg-muted hover:text-fg ${className}`}
      {...props}
    >
      <Icon name={icon} />
    </button>
  );
}
