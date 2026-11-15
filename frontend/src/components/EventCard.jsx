import { useState } from "react";
import { Link } from "react-router";
import { availability, formatEth, formatDateTime, relativeStart } from "../lib/format";
import { Badge } from "./ui/Badge";
import { ProgressBar } from "./ui/Feedback";
import { Icon } from "./ui/Icon";

export function EventCard({ event }) {
  const avail = availability(event.totalSold, event.totalSupply);
  const started = new Date(event.startTime).getTime() <= Date.now();
  const status = event.cancelled
    ? { tone: "danger", icon: "cancel", label: "Đã huỷ" }
    : started
      ? { tone: "neutral", icon: "clock", label: "Đã diễn ra" }
      : avail;

  return (
    <Link
      to={`/events/${event.id}`}
      className="group block overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,transform,box-shadow] duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-1 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10"
    >
      <EventPoster src={event.image} name={event.name} className="aspect-[16/9]" />
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <Badge tone={status.tone} icon={status.icon}>
            {status.label}
          </Badge>
          {!started && !event.cancelled && <span className="text-xs text-muted-fg">{relativeStart(event.startTime)}</span>}
        </div>
        <h3 className="line-clamp-2 text-lg font-bold leading-snug group-hover:text-primary">{event.name}</h3>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted-fg">
          <Icon name="calendar" className="size-3.5!" />
          {formatDateTime(event.startTime)}
        </p>
        <p className="mt-1 flex items-center gap-2 truncate text-sm text-muted-fg">
          <Icon name="location" className="size-3.5!" />
          <span className="truncate">{event.venue || "—"}</span>
        </p>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <span className="text-xs text-muted-fg">Từ</span>
            <p className="text-lg font-bold text-primary">{formatEth(event.minPrice)}</p>
          </div>
          <span className="text-xs text-muted-fg tabular-nums">
            {event.totalSold}/{event.totalSupply} đã bán
          </span>
        </div>
        <div className="mt-2">
          <ProgressBar
            value={event.totalSupply ? event.totalSold / event.totalSupply : 0}
            tone={avail.key === "soldout" ? "danger" : avail.key === "low" ? "warning" : "primary"}
            label="Tỉ lệ vé đã bán"
          />
        </div>
      </div>
    </Link>
  );
}

export function EventPoster({ src, name, className = "" }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div
        className={`relative grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgb(6_182_212/0.35),transparent_55%),radial-gradient(circle_at_80%_80%,rgb(139_92_246/0.3),transparent_50%)] bg-muted ${className}`}
      >
        <Icon name="ticket" size="lg" className="text-primary/80 [&]:size-10!" />
        <span className="sr-only">{name}</span>
      </div>
    );
  return (
    <img
      src={src}
      alt={`Poster ${name}`}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`w-full object-cover ${className}`}
    />
  );
}
