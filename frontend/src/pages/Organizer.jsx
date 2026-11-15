import { Link } from "react-router";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { formatDateTime, formatEth } from "../lib/format";
import { RequireWallet } from "../components/RequireWallet";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, SectionTitle } from "../components/ui/Card";
import { EmptyState, ErrorState, ProgressBar, Skeleton, StaggerItem } from "../components/ui/Feedback";
import { Icon } from "../components/ui/Icon";

export default function Organizer() {
  return (
    <RequireWallet
      allow={(r) => r.isOrganizer || r.organizedEventIds.length > 0}
      deniedTitle="Chỉ dành cho ban tổ chức"
      deniedText="Ví của bạn chưa được quản trị viên cấp quyền ORGANIZER_ROLE."
    >
      <OrganizerInner />
    </RequireWallet>
  );
}

function OrganizerInner() {
  const { account, roles } = useWallet();
  const { data, error, loading, reload } = useApi(`/events?status=all&organizer=${account}&limit=200`);

  return (
    <>
      <SectionTitle
        title="Sự kiện của tôi"
        subtitle="Quản lý vé, nhân viên soát vé và doanh thu."
        action={
          roles.isOrganizer && (
            <Button to="/organizer/new" icon="plus">
              Tạo sự kiện
            </Button>
          )
        }
      />
      {!roles.isOrganizer && (
        <p className="mb-5 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          Quyền ban tổ chức của ví này đã bị thu hồi — bạn vẫn quản lý được sự kiện cũ nhưng không tạo được sự kiện mới.
        </p>
      )}

      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : loading && !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : data?.length ? (
        <div className="space-y-3">
          {data.map((e, i) => {
            const started = new Date(e.startTime).getTime() <= Date.now();
            return (
              <StaggerItem key={e.id} index={i}>
                <Link to={`/organizer/events/${e.id}`} className="block">
                  <Card className="grid items-center gap-4 p-4 transition-colors duration-150 hover:border-primary/50 sm:grid-cols-[1fr_180px_140px_24px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold">{e.name}</h3>
                        {e.cancelled ? (
                          <Badge tone="danger" icon="cancel">Đã huỷ</Badge>
                        ) : started ? (
                          <Badge tone="neutral" icon="clock">Đã diễn ra</Badge>
                        ) : (
                          <Badge tone="success" icon="valid">Đang bán</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-fg">{formatDateTime(e.startTime)} · {e.venue}</p>
                    </div>
                    <div>
                      <div className="mb-1.5 flex justify-between text-xs text-muted-fg">
                        <span>Đã bán</span>
                        <span className="tabular-nums">{e.totalSold}/{e.totalSupply}</span>
                      </div>
                      <ProgressBar value={e.totalSupply ? e.totalSold / e.totalSupply : 0} label="Tỉ lệ đã bán" />
                    </div>
                    <div className="text-sm">
                      <p className="text-xs text-muted-fg">{e.withdrawn ? "Đã rút" : "Doanh thu escrow"}</p>
                      <p className="font-semibold tabular-nums">{formatEth(e.revenue)}</p>
                    </div>
                    <Icon name="right" className="hidden text-muted-fg sm:block" />
                  </Card>
                </Link>
              </StaggerItem>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="calendar"
          title="Bạn chưa tạo sự kiện nào"
          description="Tạo sự kiện, đặt các hạng vé và quy định chống đầu cơ — vé sẽ được phát hành dưới dạng NFT."
          action={roles.isOrganizer && <Button to="/organizer/new" icon="plus">Tạo sự kiện đầu tiên</Button>}
        />
      )}
    </>
  );
}
