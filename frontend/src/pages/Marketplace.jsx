import { useSearchParams } from "react-router";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { waitIndexed } from "../lib/api";
import { formatDateTime, formatEth, sameAddress, tokenLabel } from "../lib/format";
import { EventPoster } from "../components/EventCard";
import { Badge } from "../components/ui/Badge";
import { Card, SectionTitle } from "../components/ui/Card";
import { EmptyState, ErrorState, Skeleton, StaggerItem } from "../components/ui/Feedback";
import { Icon } from "../components/ui/Icon";
import { TxButton } from "../components/ui/TxButton";
import { inputClass } from "../components/ui/Field";

export default function Marketplace() {
  const [params, setParams] = useSearchParams();
  const eventId = params.get("eventId") || "";
  const { data, error, loading, reload } = useApi(`/listings${eventId ? `?eventId=${eventId}` : ""}`);
  const { data: events } = useApi("/events?status=upcoming&limit=100");
  const w = useWallet();

  return (
    <>
      <SectionTitle
        title="Chợ bán lại"
        subtitle="Mua lại vé từ người hâm mộ khác — giá luôn được hợp đồng giới hạn bởi giá trần."
        action={
          <label className="w-full sm:w-72">
            <span className="sr-only">Lọc theo sự kiện</span>
            <select
              value={eventId}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                e.target.value ? next.set("eventId", e.target.value) : next.delete("eventId");
                setParams(next, { replace: true });
              }}
              className={inputClass(false)}
            >
              <option value="">Tất cả sự kiện</option>
              {events?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      ) : data?.length ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t, i) => {
            const mine = sameAddress(t.owner, w.account);
            const pct = Number((BigInt(t.listPrice) * 10000n) / BigInt(t.pricePaid)) / 100;
            return (
              <StaggerItem key={t.tokenId} index={i}>
                <Card className="flex h-full flex-col overflow-hidden">
                  <EventPoster src={t.event.image} name={t.event.name} className="aspect-[2/1]" />
                  <div className="flex flex-1 flex-col p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <Badge tone="primary" icon="ticket">
                        {t.tier.name}
                      </Badge>
                      <span className="font-mono text-sm text-muted-fg">{tokenLabel(t.tokenId)}</span>
                    </div>
                    <h3 className="line-clamp-2 font-semibold leading-snug">{t.event.name}</h3>
                    <p className="mt-1.5 flex items-center gap-2 text-sm text-muted-fg">
                      <Icon name="calendar" className="size-3.5!" />
                      {formatDateTime(t.event.startTime)}
                    </p>

                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center text-xs">
                      <PriceCell label="Giá rao" value={formatEth(t.listPrice)} strong />
                      <PriceCell label="Giá gốc" value={formatEth(t.pricePaid)} />
                      <PriceCell label="So với gốc" value={`${pct.toLocaleString("vi-VN")}%`} />
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-fg">
                      <Icon name="shield" className="size-3!" /> Giá trần {t.event.resaleCapPercent}% · được hợp đồng bảo đảm
                    </p>

                    <div className="mt-auto pt-4">
                      {mine ? (
                        <div className="rounded-xl bg-muted px-4 py-2.5 text-center text-sm text-muted-fg">Vé bạn đang rao bán</div>
                      ) : (
                        <TxButton
                          full
                          icon="resale"
                          label={`Mua lại · ${formatEth(t.listPrice)}`}
                          successLabel="Đã mua lại"
                          successToast="Mua lại thành công — vé đã vào ví của bạn"
                          action={({ contract }) => contract.buyResale(t.tokenId, { value: BigInt(t.listPrice) })}
                          onSuccess={async (r) => {
                            await waitIndexed(r.blockNumber);
                            await reload();
                          }}
                        />
                      )}
                    </div>
                  </div>
                </Card>
              </StaggerItem>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="store"
          title="Chưa có vé nào đang được rao bán"
          description="Khi người giữ vé rao bán lại, vé sẽ xuất hiện ở đây với giá không vượt quá giá trần."
        />
      )}
    </>
  );
}

function PriceCell({ label, value, strong }) {
  return (
    <div>
      <p className="text-muted-fg">{label}</p>
      <p className={`mt-0.5 font-semibold tabular-nums ${strong ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
