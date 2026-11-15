import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { useApi } from "../hooks/useApi";
import { EventCard } from "../components/EventCard";
import { EmptyState, ErrorState, Skeleton, StaggerItem } from "../components/ui/Feedback";
import { Icon } from "../components/ui/Icon";
import { inputClass } from "../components/ui/Field";

const TABS = [
  { key: "upcoming", label: "Sắp diễn ra" },
  { key: "past", label: "Đã qua" },
  { key: "cancelled", label: "Đã huỷ" },
];

const PROMISES = [
  { icon: "shield", title: "Xác thực on-chain", text: "Mỗi vé là một NFT ERC-721 duy nhất" },
  { icon: "lock", title: "Không phe vé", text: "Giới hạn vé/ví và giá trần bán lại" },
  { icon: "qrcode", title: "QR động", text: "Chữ ký số đổi mỗi 60 giây" },
];

export default function Home() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || "upcoming";
  const q = params.get("q") || "";
  const [search, setSearch] = useState(q);

  // Tìm kiếm có debounce 300ms
  useEffect(() => {
    const id = setTimeout(() => {
      if (search === q) return;
      const next = new URLSearchParams(params);
      search ? next.set("q", search) : next.delete("q");
      setParams(next, { replace: true });
    }, 300);
    return () => clearTimeout(id);
  }, [search, q, params, setParams]);

  const { data, error, loading, reload } = useApi(`/events?status=${status}${q ? `&q=${encodeURIComponent(q)}` : ""}`);

  return (
    <>
      <section className="relative mb-10 overflow-hidden rounded-3xl border border-border bg-card px-6 py-10 sm:px-10 sm:py-14">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgb(6_182_212/0.18),transparent_45%),radial-gradient(circle_at_0%_100%,rgb(139_92_246/0.12),transparent_40%)]"
          aria-hidden="true"
        />
        <div className="relative max-w-2xl">
          <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Icon name="ticket" className="size-3.5!" /> Vé sự kiện NFT
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-[40px] sm:leading-[1.15]">
            Vé chính chủ — không vé giả, không phe vé.
          </h1>
          <p className="mt-4 max-w-xl text-muted-fg">
            Mua vé dưới dạng NFT trên Ethereum. Bán lại minh bạch với giá trần, soát vé bằng chữ ký số không thể làm giả.
          </p>
        </div>
        <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
          {PROMISES.map((p) => (
            <div key={p.title} className="flex items-start gap-3 rounded-2xl border border-border bg-bg/50 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon name={p.icon} size="md" />
              </span>
              <div>
                <p className="font-semibold">{p.title}</p>
                <p className="text-sm text-muted-fg">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1" role="tablist" aria-label="Lọc sự kiện">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={status === t.key}
              onClick={() => {
                const next = new URLSearchParams(params);
                next.set("status", t.key);
                setParams(next, { replace: true });
              }}
              className={`h-10 rounded-lg px-4 text-sm font-medium transition-colors duration-150 ${
                status === t.key ? "bg-muted text-fg" : "text-muted-fg hover:text-fg"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="relative sm:w-72">
          <span className="sr-only">Tìm sự kiện</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-fg" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên sự kiện…"
            className={`${inputClass(false)} pl-10`}
          />
        </label>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <Skeleton className="aspect-[16/9] rounded-none" />
              <div className="space-y-3 p-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-4/5" />
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : data?.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((e, i) => (
            <StaggerItem key={e.id} index={i}>
              <EventCard event={e} />
            </StaggerItem>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="calendar"
          title={q ? `Không tìm thấy sự kiện "${q}"` : "Chưa có sự kiện nào"}
          description={status === "upcoming" ? "Các sự kiện sắp diễn ra sẽ xuất hiện ở đây." : undefined}
        />
      )}
    </>
  );
}
