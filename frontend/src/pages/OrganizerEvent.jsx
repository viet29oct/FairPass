import { useState } from "react";
import { Link, useParams } from "react-router";
import { isAddress } from "ethers";
import { useApi } from "../hooks/useApi";
import { useWallet } from "../hooks/useWallet";
import { waitIndexed } from "../lib/api";
import { formatDateTime, formatEth, sameAddress } from "../lib/format";
import { RequireWallet } from "../components/RequireWallet";
import { AddressPill } from "../components/ui/AddressPill";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, StatTile } from "../components/ui/Card";
import { EmptyState, ErrorState, ProgressBar, Skeleton } from "../components/ui/Feedback";
import { Field, inputClass } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { TxButton } from "../components/ui/TxButton";

export default function OrganizerEvent() {
  return (
    <RequireWallet>
      <Inner />
    </RequireWallet>
  );
}

function Inner() {
  const { id } = useParams();
  const w = useWallet();
  const stats = useApi(`/events/${id}/stats`);
  const detail = useApi(`/events/${id}`);
  const [cancelOpen, setCancelOpen] = useState(false);

  const reloadAll = async (receipt) => {
    if (receipt) await waitIndexed(receipt.blockNumber);
    await Promise.all([stats.reload(), detail.reload()]);
  };

  if (stats.error || detail.error) return <ErrorState error={stats.error || detail.error} onRetry={reloadAll} />;
  if (!stats.data || !detail.data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <div className="grid gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );

  const s = stats.data;
  const evt = detail.data;
  const isOwner = sameAddress(evt.organizer, w.account);
  const started = new Date(evt.startTime).getTime() <= Date.now();

  if (!isOwner && !w.roles.isAdmin)
    return <EmptyState icon="lock" title="Bạn không phải ban tổ chức của sự kiện này" action={<Button to="/organizer" variant="secondary">Về danh sách</Button>} />;

  return (
    <>
      <Link to="/organizer" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-fg hover:text-fg">
        <Icon name="left" className="size-3!" /> Sự kiện của tôi
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            {evt.cancelled ? (
              <Badge tone="danger" icon="cancel">Đã huỷ</Badge>
            ) : started ? (
              <Badge tone="neutral" icon="clock">Đã diễn ra</Badge>
            ) : (
              <Badge tone="success" icon="valid">Đang bán vé</Badge>
            )}
            {evt.withdrawn && <Badge tone="primary" icon="withdraw">Đã rút doanh thu</Badge>}
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">{evt.name}</h1>
          <p className="mt-1 text-sm text-muted-fg">{formatDateTime(evt.startTime)} · {evt.venue}</p>
        </div>
        <Button to={`/events/${evt.id}`} variant="secondary" size="sm" iconRight="external">
          Trang bán vé
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<Icon name="ticket" className="size-3.5!" />} label="Đã bán" value={`${s.totalSold}/${s.totalSupply}`} />
        <StatTile icon={<Icon name="valid" className="size-3.5!" />} label="Đã soát vé" value={s.checkedIn} hint={s.totalSold ? `${Math.round((s.checkedIn / s.totalSold) * 100)}% vé đã bán` : undefined} />
        <StatTile icon={<Icon name="resale" className="size-3.5!" />} label="Lượt bán lại" value={s.resales} hint={`${s.listed} vé đang rao`} />
        <StatTile icon={<Icon name="withdraw" className="size-3.5!" />} label={evt.withdrawn ? "Đã rút" : "Doanh thu escrow"} value={formatEth(s.revenue)} hint={s.refunded ? `${s.refunded} vé đã hoàn tiền` : undefined} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-5">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <Icon name="stats" className="text-primary" /> Tiến độ theo hạng vé
          </h2>
          <div className="space-y-5">
            {s.tiers.map((t) => (
              <div key={t.tierIndex}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{t.name} · <span className="text-primary">{formatEth(t.price)}</span></span>
                  <span className="text-muted-fg tabular-nums">
                    {t.sold}/{t.supply} bán · {t.checkedIn} đã soát
                  </span>
                </div>
                <ProgressBar value={t.supply ? t.sold / t.supply : 0} label={`Đã bán hạng ${t.name}`} />
                <div className="mt-1.5">
                  <ProgressBar value={t.sold ? t.checkedIn / t.sold : 0} tone="success" label={`Đã soát hạng ${t.name}`} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 flex gap-4 text-xs text-muted-fg">
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-primary" /> Đã bán</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-4 rounded-full bg-success" /> Đã soát / đã bán</span>
          </p>
        </Card>

        <div className="space-y-6">
          {isOwner && <StaffCard evt={evt} disabled={evt.cancelled} onChanged={reloadAll} />}

          {isOwner && (
            <Card className="p-5">
              <h2 className="mb-2 flex items-center gap-2 font-semibold">
                <Icon name="withdraw" className="text-primary" /> Doanh thu
              </h2>
              <p className="mb-4 text-sm text-muted-fg">
                Tiền vé được giữ trong hợp đồng (escrow) và chỉ rút được sau giờ diễn, để người mua được hoàn tiền nếu sự kiện bị huỷ.
              </p>
              <TxButton
                full
                icon="withdraw"
                label={`Rút ${formatEth(s.revenue)}`}
                successLabel="Đã rút doanh thu"
                disabled={!started || evt.cancelled || evt.withdrawn || BigInt(s.revenue) === 0n}
                action={({ contract }) => contract.withdrawRevenue(evt.id)}
                onSuccess={reloadAll}
              />
              {!started && !evt.cancelled && (
                <p className="mt-2 text-center text-xs text-muted-fg">Mở khoá lúc {formatDateTime(evt.startTime)}</p>
              )}
            </Card>
          )}

          {!evt.cancelled && !evt.withdrawn && (isOwner ? !started : w.roles.isAdmin) && (
            <Card className="border-danger/40 p-5">
              <h2 className="mb-2 flex items-center gap-2 font-semibold text-danger-text">
                <Icon name="cancel" /> Huỷ sự kiện
              </h2>
              <p className="mb-4 text-sm text-muted-fg">Người giữ vé sẽ tự rút lại tiền gốc từ hợp đồng. Không thể hoàn tác.</p>
              <Button variant="danger" full icon="cancel" onClick={() => setCancelOpen(true)}>
                Huỷ sự kiện…
              </Button>
            </Card>
          )}
        </div>
      </div>

      <CancelModal
        evt={evt}
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onDone={async (r) => {
          setCancelOpen(false);
          await reloadAll(r);
        }}
      />
    </>
  );
}

function StaffCard({ evt, disabled, onChanged }) {
  const [addr, setAddr] = useState("");
  const [shake, setShake] = useState(0);
  const valid = isAddress(addr.trim());
  const exists = evt.staff.some((s) => sameAddress(s.address, addr.trim()));
  const error = addr && !valid ? "Địa chỉ ví không hợp lệ" : exists ? "Ví này đã là staff" : null;

  return (
    <Card className="p-5">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Icon name="staff" className="text-primary" /> Nhân viên soát vé
      </h2>
      <p className="mb-4 text-sm text-muted-fg">Ví staff mở trang Soát vé để quét QR của khách.</p>

      {evt.staff.length ? (
        <ul className="mb-4 space-y-2">
          {evt.staff.map((s) => (
            <li key={s.address} className="flex items-center justify-between gap-2">
              <AddressPill address={s.address} />
              <TxButton
                size="sm"
                variant="ghost"
                icon="trash"
                label="Gỡ"
                successLabel="Đã gỡ"
                disabled={disabled}
                action={({ contract }) => contract.setStaff(evt.id, s.address, false)}
                onSuccess={onChanged}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-fg">Chưa có staff — bạn (ban tổ chức) vẫn soát vé được.</p>
      )}

      <Field error={error} shakeKey={error ? shake : 0} label="Thêm staff">
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
        full
        size="sm"
        variant="secondary"
        icon="plus"
        label="Thêm staff"
        successLabel="Đã thêm staff"
        disabled={!valid || exists || disabled}
        action={({ contract }) => contract.setStaff(evt.id, addr.trim(), true)}
        onSuccess={async (r) => {
          setAddr("");
          await onChanged(r);
        }}
      />
    </Card>
  );
}

function CancelModal({ evt, open, onClose, onDone }) {
  const [text, setText] = useState("");
  const match = text.trim() === evt.name.trim();
  return (
    <Modal open={open} onClose={onClose} title="Huỷ sự kiện?" subtitle="Hành động này không thể hoàn tác.">
      <ul className="mb-4 space-y-2 text-sm text-muted-fg">
        <li className="flex gap-2"><Icon name="refund" className="mt-0.5 text-primary" /> Người giữ vé tự rút lại giá gốc từ hợp đồng.</li>
        <li className="flex gap-2"><Icon name="lock" className="mt-0.5 text-primary" /> Ngừng bán vé, bán lại và soát vé ngay lập tức.</li>
      </ul>
      <Field label={<>Gõ <b className="text-fg">{evt.name}</b> để xác nhận</>}>
        {({ id }) => <input id={id} value={text} onChange={(e) => setText(e.target.value)} className={inputClass(false)} autoComplete="off" />}
      </Field>
      <TxButton
        full
        variant="danger"
        icon="cancel"
        label="Huỷ sự kiện"
        successLabel="Đã huỷ"
        disabled={!match}
        action={({ contract }) => contract.cancelEvent(evt.id)}
        onSuccess={onDone}
      />
    </Modal>
  );
}
