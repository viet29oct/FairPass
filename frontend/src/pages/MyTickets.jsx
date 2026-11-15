import { useState } from "react";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { waitIndexed } from "../lib/api";
import { ticketActions } from "../lib/ticket";
import { RequireWallet } from "../components/RequireWallet";
import { TicketCard } from "../components/TicketCard";
import { QrModal } from "../components/QrModal";
import { ResaleModal } from "../components/ResaleModal";
import { Button } from "../components/ui/Button";
import { SectionTitle } from "../components/ui/Card";
import { EmptyState, ErrorState, Skeleton, StaggerItem } from "../components/ui/Feedback";
import { TxButton } from "../components/ui/TxButton";

const FILTERS = [
  { key: "active", label: "Còn hiệu lực" },
  { key: "done", label: "Đã dùng / đã qua" },
  { key: "all", label: "Tất cả" },
];

export default function MyTickets() {
  return (
    <RequireWallet>
      <MyTicketsInner />
    </RequireWallet>
  );
}

function MyTicketsInner() {
  const { account } = useWallet();
  const { data, error, loading, reload } = useApi(`/users/${account}/tickets`);
  const [qrTicket, setQrTicket] = useState(null);
  const [resaleTicket, setResaleTicket] = useState(null);
  const [filter, setFilter] = useState("active");

  const after = async (receipt) => {
    await waitIndexed(receipt.blockNumber);
    await reload();
  };

  const tickets = (data || []).filter((t) => {
    const done = t.used || t.event.cancelled || new Date(t.event.startTime).getTime() < Date.now() - 6 * 3600_000;
    return filter === "all" || (filter === "active" ? !done || ticketActions(t).canRefund : done);
  });

  return (
    <>
      <SectionTitle
        title="Vé của tôi"
        subtitle="Mỗi vé là một NFT trong ví của bạn. Hiện mã QR động khi vào cửa."
        action={
          <div className="flex gap-1 rounded-xl border border-border bg-card p-1" role="tablist">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`h-9 rounded-lg px-3 text-sm font-medium transition-colors ${filter === f.key ? "bg-muted text-fg" : "text-muted-fg hover:text-fg"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : tickets.length ? (
        <div className="grid gap-x-5 gap-y-6 md:grid-cols-2">
          {tickets.map((t, i) => {
            const a = ticketActions(t);
            return (
              <StaggerItem key={t.tokenId} index={i}>
                <TicketCard
                  ticket={t}
                  actions={
                    (a.canShowQr || a.canList || a.canRefund) && (
                      <>
                        {a.canShowQr && (
                          <Button size="sm" icon="qrcode" onClick={() => setQrTicket(t)}>
                            Hiện QR
                          </Button>
                        )}
                        {a.canList && (
                          <Button size="sm" variant="secondary" icon="resale" onClick={() => setResaleTicket(t)}>
                            {t.listed ? "Đổi giá" : "Bán lại"}
                          </Button>
                        )}
                        {a.canCancelListing && (
                          <TxButton
                            size="sm"
                            variant="secondary"
                            icon="close"
                            label="Huỷ rao"
                            successLabel="Đã huỷ rao"
                            action={({ contract }) => contract.cancelListing(t.tokenId)}
                            onSuccess={after}
                          />
                        )}
                        {a.canRefund && (
                          <TxButton
                            size="sm"
                            icon="refund"
                            label="Hoàn tiền"
                            successLabel="Đã hoàn tiền"
                            successToast="Đã hoàn tiền gốc về ví — vé đã bị huỷ"
                            action={({ contract }) => contract.claimRefund(t.tokenId)}
                            onSuccess={after}
                          />
                        )}
                      </>
                    )
                  }
                />
              </StaggerItem>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="ticket"
          title={filter === "active" ? "Bạn chưa có vé còn hiệu lực" : "Không có vé nào"}
          description="Vé bạn mua sẽ xuất hiện ở đây dưới dạng NFT."
          action={<Button to="/" icon="calendar">Khám phá sự kiện</Button>}
        />
      )}

      <QrModal ticket={qrTicket} open={!!qrTicket} onClose={() => setQrTicket(null)} />
      <ResaleModal
        ticket={resaleTicket}
        open={!!resaleTicket}
        onClose={() => setResaleTicket(null)}
        onDone={async (receipt) => {
          setResaleTicket(null);
          await after(receipt);
        }}
      />
    </>
  );
}
