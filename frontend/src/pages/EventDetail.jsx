import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { waitIndexed } from "../lib/api";
import { readContract } from "../lib/contract";
import { availability, formatDateTime, formatEth, relativeStart } from "../lib/format";
import { EventPoster } from "../components/EventCard";
import { Badge } from "../components/ui/Badge";
import { Card } from "../components/ui/Card";
import { ErrorState, ProgressBar, Skeleton } from "../components/ui/Feedback";
import { Icon } from "../components/ui/Icon";
import { TxButton } from "../components/ui/TxButton";
import { Button } from "../components/ui/Button";
import { useToast } from "../components/ui/Toast";

export default function EventDetail() {
  const { id } = useParams();
  const { data: evt, error, loading, reload } = useApi(`/events/${id}`);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading && !evt) return <DetailSkeleton />;

  const started = new Date(evt.startTime).getTime() <= Date.now();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="min-w-0">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-fg hover:text-fg">
          <Icon name="left" className="size-3!" /> Tất cả sự kiện
        </Link>
        <EventPoster src={evt.image} name={evt.name} className="aspect-[16/9] rounded-3xl border border-border" />

        <div className="mt-6 flex flex-wrap items-center gap-2">
          {evt.cancelled ? (
            <Badge tone="danger" icon="cancel">Sự kiện đã bị huỷ</Badge>
          ) : started ? (
            <Badge tone="neutral" icon="clock">Đã diễn ra</Badge>
          ) : (
            <Badge tone="primary" icon="clock">{relativeStart(evt.startTime)}</Badge>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance sm:text-[40px] sm:leading-tight">{evt.name}</h1>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoRow icon="calendar" label="Thời gian" value={formatDateTime(evt.startTime)} />
          <InfoRow icon="location" label="Địa điểm" value={evt.venue || "—"} />
        </div>

        {evt.description && <p className="mt-6 leading-relaxed whitespace-pre-line text-muted-fg">{evt.description}</p>}

        <Card className="mt-8 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Icon name="shield" className="text-primary" /> Quy định chống đầu cơ & vé giả
          </h2>
          <ul className="mt-4 space-y-3 text-sm text-muted-fg">
            <Rule icon="users">Tối đa <b className="text-fg">{evt.maxPerWallet} vé</b> mỗi ví (cả mua mới lẫn mua lại).</Rule>
            <Rule icon="tag">Bán lại tối đa <b className="text-fg">{evt.resaleCapPercent}%</b> giá gốc trên chợ FairPass.</Rule>
            <Rule icon="lock">Vé không thể chuyển nhượng hay bán ngoài sàn FairPass.</Rule>
            <Rule icon="qrcode">Soát vé bằng mã QR động có chữ ký số, đổi mỗi 60 giây.</Rule>
            <Rule icon="refund">Sự kiện bị huỷ → người giữ vé tự rút lại tiền gốc từ hợp đồng.</Rule>
          </ul>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <BuyPanel evt={evt} onBought={reload} />
      </aside>
    </div>
  );
}

function BuyPanel({ evt, onBought }) {
  const w = useWallet();
  const [tierIndex, setTierIndex] = useState(() => {
    const first = evt.tiers.findIndex((t) => t.sold < t.supply);
    return first === -1 ? 0 : first;
  });
  const [qty, setQty] = useState(1);
  const [holding, setHolding] = useState(null); // { owned, purchased } đọc trực tiếp từ contract

  const loadHolding = useCallback(async () => {
    if (!w.account || !readContract) return setHolding(null);
    try {
      const [owned, purchased] = await Promise.all([
        readContract.ownedPerEvent(evt.id, w.account),
        readContract.primaryPurchased(evt.id, w.account),
      ]);
      setHolding({ owned: Number(owned), purchased: Number(purchased) });
    } catch {
      setHolding(null);
    }
  }, [w.account, evt.id]);

  useEffect(() => {
    loadHolding();
  }, [loadHolding]);

  const tier = evt.tiers[tierIndex];
  const left = tier ? tier.supply - tier.sold : 0;
  const used = holding ? Math.max(holding.owned, holding.purchased) : 0;
  const walletLeft = Math.max(0, evt.maxPerWallet - used);
  const maxQty = Math.max(0, Math.min(left, walletLeft));
  const total = tier ? BigInt(tier.price) * BigInt(qty) : 0n;
  const started = new Date(evt.startTime).getTime() <= Date.now();

  useEffect(() => {
    if (qty > Math.max(1, maxQty)) setQty(Math.max(1, maxQty));
  }, [maxQty, qty]);

  // Kiểm tra số dư trước khi bật MetaMask (giá vé + chừa ~0.001 ETH phí gas)
  const notEnoughEth = w.isConnected && w.balance !== null && w.balance < total + 10n ** 15n;

  const blocked = evt.cancelled
    ? "Sự kiện đã bị huỷ"
    : started
      ? "Sự kiện đã bắt đầu — ngừng bán vé"
      : left <= 0
        ? "Hạng vé này đã hết"
        : w.isConnected && holding && walletLeft === 0
          ? `Bạn đã đạt giới hạn ${evt.maxPerWallet} vé/ví`
          : null;

  return (
    <Card className="p-5">
      <h2 className="mb-4 text-lg font-bold">Chọn vé</h2>
      <div className="space-y-2.5" role="radiogroup" aria-label="Hạng vé">
        {evt.tiers.map((t, i) => {
          const a = availability(t.sold, t.supply);
          const selected = i === tierIndex;
          return (
            <button
              key={t.tierIndex}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={a.key === "soldout"}
              onClick={() => {
                setTierIndex(i);
                setQty(1);
              }}
              className={`w-full rounded-xl border p-3.5 text-left transition-[border-color,background-color] duration-150 disabled:opacity-50 ${
                selected ? "border-primary bg-primary/8" : "border-border hover:border-primary/50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{t.name}</span>
                <span className="font-bold text-primary">{formatEth(t.price)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <Badge tone={a.tone} icon={a.icon}>{a.label}</Badge>
                <span className="text-xs text-muted-fg tabular-nums">{t.sold}/{t.supply}</span>
              </div>
              <div className="mt-2.5">
                <ProgressBar value={t.sold / t.supply} tone={a.key === "soldout" ? "danger" : a.key === "low" ? "warning" : "primary"} label={`Đã bán hạng ${t.name}`} />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-sm text-muted-fg">Số lượng</span>
        <div className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
          <StepButton icon="minus" label="Giảm" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} />
          <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">{qty}</span>
          <StepButton icon="plus" label="Tăng" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
        <span className="text-muted-fg">Tổng</span>
        <span className="text-2xl font-bold tabular-nums">{formatEth(total)}</span>
      </div>

      <p className="mt-2 text-xs text-muted-fg">
        Giới hạn {evt.maxPerWallet} vé/ví
        {holding && ` · bạn đang có ${holding.owned} vé, đã mua ${holding.purchased}`}
      </p>

      <div className="mt-5">
        {blocked ? (
          <div className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm text-muted-fg">
            <Icon name="lock" /> {blocked}
          </div>
        ) : notEnoughEth ? (
          <NotEnoughEth need={total} />
        ) : (
          <TxButton
            full
            size="lg"
            icon="ticket"
            label={`Mua ${qty} vé`}
            successLabel="Đã mua vé"
            successToast="Mua vé thành công — NFT đã vào ví của bạn"
            action={({ contract }) => contract.buyTicket(evt.id, tier.tierIndex, qty, { value: total })}
            onSuccess={async (receipt) => {
              await waitIndexed(receipt.blockNumber);
              await Promise.all([onBought(), loadHolding()]);
            }}
          />
        )}
      </div>
      {w.isConnected && (
        <Button to="/my-tickets" variant="ghost" size="sm" full className="mt-2" iconRight="arrow">
          Xem vé của tôi
        </Button>
      )}
    </Card>
  );
}

/** Ví không đủ ETH: báo rõ + (mạng local) nút nạp ETH test ngay tại chỗ */
function NotEnoughEth({ need }) {
  const w = useWallet();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold text-warning">
        <Icon name="warning" /> Ví không đủ ETH
      </p>
      <p className="mt-1 text-muted-fg">
        Cần {formatEth(need)} + phí gas · ví đang có {formatEth(w.balance)}
      </p>
      {w.isLocalChain ? (
        <Button
          full
          size="sm"
          className="mt-3"
          icon={busy ? "spinner" : "plus"}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await w.fundTestEth(100);
              toast.success("Đã nạp 100 ETH test");
            } catch (err) {
              toast.error("Không nạp được ETH test", err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Nhận 100 ETH test
        </Button>
      ) : (
        <p className="mt-2 text-xs text-muted-fg">Xin ETH Sepolia miễn phí từ faucet testnet rồi tải lại trang.</p>
      )}
    </div>
  );
}

function StepButton({ icon, label, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="grid size-9 place-items-center rounded-lg text-muted-fg transition-colors hover:bg-card hover:text-fg disabled:opacity-40"
      {...props}
    >
      <Icon name={icon} className="size-3.5!" />
    </button>
  );
}

function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary">
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-fg">{label}</p>
        <p className="truncate font-medium">{value}</p>
      </div>
    </div>
  );
}

function Rule({ icon, children }) {
  return (
    <li className="flex gap-3">
      <Icon name={icon} className="mt-0.5 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}

function DetailSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <Skeleton className="aspect-[16/9] rounded-3xl" />
        <Skeleton className="h-10 w-3/4" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}
