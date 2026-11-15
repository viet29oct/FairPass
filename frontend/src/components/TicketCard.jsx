/**
 * TicketCard — vé NFT dạng "vé xé" với hiệu ứng hologram chống giả (MASTER §7.1):
 *  - nghiêng 3D theo con trỏ (≤ 6°) + nhấc 4px + bóng cyan
 *  - dải phản quang lướt chéo (color-dodge)
 *  - cuống vé tách ra khi hover nhóm nút hành động
 *  - vé đã dùng: con dấu "ĐÃ SOÁT" nảy vào
 * Toàn bộ chạy bằng biến CSS → không re-render React khi di chuột.
 */
import { useRef, useState } from "react";
import { Link } from "react-router";
import { formatDateTime, formatEth, tokenLabel } from "../lib/format";
import { ticketStatus } from "../lib/ticket";
import { Badge } from "./ui/Badge";
import { Icon } from "./ui/Icon";

const MAX_TILT = 6;

export function TicketCard({ ticket, actions, footer }) {
  const ref = useRef(null);
  const [tear, setTear] = useState(false);
  const status = ticketStatus(ticket);
  const used = status.key === "used";
  const dim = used || status.key === "refunded";

  const onMove = (e) => {
    if (e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    const el = ref.current;
    el.style.setProperty("--ry", `${((px - 0.5) * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - py) * 2 * MAX_TILT).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    if (el.dataset.hover !== "true") el.dataset.hover = "true";
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.dataset.hover = "false";
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <article
      ref={ref}
      className="ticket rounded-2xl"
      data-used={used}
      data-tear={tear}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      aria-label={`Vé ${tokenLabel(ticket.tokenId)} — ${ticket.event.name}`}
    >
      <div className="flex">
        {/* ── Phần chính ── */}
        <div
          className={`relative min-w-0 flex-1 rounded-l-2xl border border-r-0 border-border bg-card p-4 sm:p-5 ${dim ? "opacity-75 grayscale-[35%]" : ""}`}
        >
          <div className="flex items-start gap-3.5">
            <Poster src={ticket.event.image} />
            <div className="min-w-0 flex-1">
              <Link
                to={`/events/${ticket.event.id}`}
                className="line-clamp-2 font-semibold leading-snug hover:text-primary"
              >
                {ticket.event.name}
              </Link>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-fg">
                <Icon name="calendar" className="size-3.5!" />
                {formatDateTime(ticket.event.startTime)}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted-fg">
                <Icon name="location" className="size-3.5!" />
                <span className="truncate">{ticket.event.venue || "—"}</span>
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge tone={status.tone} icon={status.icon}>
              {status.label}
            </Badge>
            <span className="text-xs text-muted-fg">
              Giá gốc <span className="font-semibold text-fg">{formatEth(ticket.pricePaid)}</span>
              {ticket.listed && (
                <>
                  {" · "}Đang rao <span className="font-semibold text-warning">{formatEth(ticket.listPrice)}</span>
                </>
              )}
            </span>
          </div>

          {actions && (
            <div
              className="mt-4 flex flex-wrap gap-2"
              onMouseEnter={() => setTear(true)}
              onMouseLeave={() => setTear(false)}
              onFocus={() => setTear(true)}
              onBlur={() => setTear(false)}
            >
              {actions}
            </div>
          )}
          {footer}

          {used && (
            <div className="pointer-events-none absolute top-4 right-3 select-none" aria-hidden="true">
              <span className="stamp inline-block rounded-lg border-[3px] border-danger-text/80 px-3 py-1 text-sm font-black tracking-[0.2em] text-danger-text/85 uppercase">
                Đã soát
              </span>
            </div>
          )}
        </div>

        {/* ── Cuống vé ── */}
        <div className="ticket-stub relative flex w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-r-2xl border border-l-0 border-border bg-card px-2 py-4 text-center sm:w-28">
          <span className="ticket-perforation" aria-hidden="true" />
          <span className="ticket-notch -top-[11px]" aria-hidden="true" />
          <span className="ticket-notch -bottom-[11px]" aria-hidden="true" />
          <Icon name="ticket" size="md" className="text-primary" />
          <span className="font-mono text-base font-medium">{tokenLabel(ticket.tokenId)}</span>
          <span className="line-clamp-2 text-xs font-semibold tracking-wide text-muted-fg uppercase">{ticket.tier.name}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-fg">
            <Icon name="shield" className="size-3!" /> NFT
          </span>
        </div>
      </div>
      <div className="ticket-sheen" aria-hidden="true" />
    </article>
  );
}

function Poster({ src }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed)
    return (
      <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-violet-500/20 text-primary">
        <Icon name="ticket" size="lg" />
      </div>
    );
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="size-16 shrink-0 rounded-xl object-cover"
    />
  );
}
