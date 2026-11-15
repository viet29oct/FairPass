import { useCallback, useEffect, useState } from "react";
import { isAddress } from "ethers";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { waitIndexed } from "../lib/api";
import { ORGANIZER_ROLE, readContract } from "../lib/contract";
import { formatDate, sameAddress } from "../lib/format";
import { RequireWallet } from "../components/RequireWallet";
import { AddressPill } from "../components/ui/AddressPill";
import { Badge } from "../components/ui/Badge";
import { Card, SectionTitle } from "../components/ui/Card";
import { ErrorState, Skeleton, StaggerItem } from "../components/ui/Feedback";
import { Field, inputClass } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { TxButton } from "../components/ui/TxButton";

export default function Admin() {
  return (
    <RequireWallet allow={(r) => r.isAdmin} deniedTitle="Chỉ dành cho quản trị viên">
      <AdminInner />
    </RequireWallet>
  );
}

function AdminInner() {
  const w = useWallet();
  const orgs = useApi("/organizers");
  const [paused, setPaused] = useState(null);
  const [addr, setAddr] = useState("");
  const [shake, setShake] = useState(0);

  const loadPaused = useCallback(() => readContract?.paused().then(setPaused).catch(() => setPaused(null)), []);
  useEffect(() => {
    loadPaused();
  }, [loadPaused]);

  const valid = isAddress(addr.trim());
  const exists = orgs.data?.some((o) => sameAddress(o.address, addr.trim()));
  const error = addr && !valid ? "Địa chỉ ví không hợp lệ" : exists ? "Ví này đã là ban tổ chức" : null;

  const afterRole = async (r) => {
    await waitIndexed(r.blockNumber);
    await Promise.all([orgs.reload(), w.refreshRoles()]);
  };

  return (
    <>
      <SectionTitle title="Quản trị hệ thống" subtitle="Cấp quyền ban tổ chức và dừng khẩn cấp hợp đồng." />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Icon name="organizer" className="text-primary" /> Ban tổ chức ({orgs.data?.length ?? "…"})
          </h2>
          {orgs.error ? (
            <ErrorState error={orgs.error} onRetry={orgs.reload} />
          ) : !orgs.data ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {orgs.data.map((o, i) => (
                <StaggerItem as="li" key={o.address} index={i} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <AddressPill address={o.address} />
                      {sameAddress(o.address, w.account) && <Badge tone="primary">Bạn</Badge>}
                      <span className="text-xs text-muted-fg">từ {formatDate(o.grantedAt)}</span>
                    </div>
                    <TxButton
                      size="sm"
                      variant="ghost"
                      icon="ban"
                      label="Thu hồi"
                      successLabel="Đã thu hồi"
                      action={({ contract }) => contract.revokeRole(ORGANIZER_ROLE, o.address)}
                      onSuccess={afterRole}
                    />
                  </>
                </StaggerItem>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t border-border pt-5">
            <Field label="Cấp quyền ban tổ chức cho ví" error={error} shakeKey={error ? shake : 0}>
              {({ id, invalid }) => (
                <input
                  id={id}
                  value={addr}
                  onChange={(e) => setAddr(e.target.value)}
                  onBlur={() => error && setShake((k) => k + 1)}
                  placeholder="0x…"
                  className={`${inputClass(invalid)} font-mono text-sm`}
                />
              )}
            </Field>
            <TxButton
              icon="plus"
              label="Cấp quyền ORGANIZER"
              successLabel="Đã cấp quyền"
              disabled={!valid || exists}
              action={({ contract }) => contract.grantRole(ORGANIZER_ROLE, addr.trim())}
              onSuccess={async (r) => {
                setAddr("");
                await afterRole(r);
              }}
            />
          </div>
        </Card>

        <Card className={`h-fit p-5 ${paused ? "border-danger/50" : ""}`}>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Icon name={paused ? "pause" : "shield"} className={paused ? "text-danger-text" : "text-primary"} /> Dừng khẩn cấp
          </h2>
          <div className="mb-4">
            {paused === null ? (
              <Skeleton className="h-6 w-32" />
            ) : paused ? (
              <Badge tone="danger" icon="pause">Đang tạm dừng</Badge>
            ) : (
              <Badge tone="success" icon="play">Đang hoạt động</Badge>
            )}
          </div>
          <p className="mb-4 text-sm text-muted-fg">
            Khi tạm dừng: khoá tạo sự kiện, mua vé, bán lại, soát vé và rút doanh thu. Người dùng vẫn được hoàn tiền nếu sự kiện bị huỷ.
          </p>
          {paused !== null && (
            <TxButton
              full
              variant={paused ? "primary" : "danger"}
              icon={paused ? "play" : "pause"}
              label={paused ? "Mở lại hệ thống" : "Tạm dừng hệ thống"}
              successLabel={paused ? "Đã mở lại" : "Đã tạm dừng"}
              action={({ contract }) => (paused ? contract.unpause() : contract.pause())}
              onSuccess={loadPaused}
            />
          )}
        </Card>
      </div>
    </>
  );
}
