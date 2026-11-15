export function Card({ as: Tag = "div", className = "", children, ...props }) {
  return (
    <Tag className={`rounded-2xl border border-border bg-card ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-muted-fg">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Ô số liệu cho trang organizer */
export function StatTile({ label, value, hint, icon }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted-fg">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-fg">{hint}</div>}
    </Card>
  );
}
