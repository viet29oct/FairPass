/**
 * Tạo sự kiện — form 3 bước (MASTER §6):
 *  1. Thông tin + poster  2. Hạng vé  3. Quy định + xem lại
 * Gửi: đăng nhập ví (ký message) → upload IPFS qua BE → ký giao dịch createEvent.
 */
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useNavigate } from "react-router";
import { parseEther } from "ethers";
import { useWallet } from "../hooks/useWallet";
import { api, waitIndexed } from "../lib/api";
import { findEvent } from "../lib/contract";
import { formatDateTime, formatEth } from "../lib/format";
import { RequireWallet } from "../components/RequireWallet";
import { Button, IconButton } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, inputClass } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { TxButton } from "../components/ui/TxButton";

const STEPS = ["Thông tin", "Hạng vé", "Quy định & xem lại"];
const emptyTier = () => ({ name: "", price: "", supply: "" });

export default function OrganizerNew() {
  return (
    <RequireWallet allow={(r) => r.isOrganizer} deniedTitle="Chỉ ban tổ chức được tạo sự kiện">
      <CreateEventForm />
    </RequireWallet>
  );
}

function CreateEventForm() {
  const navigate = useNavigate();
  const { account } = useWallet();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [shake, setShake] = useState(0);
  const [touched, setTouched] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    venue: "",
    start: "",
    poster: null,
    tiers: [{ name: "VIP", price: "", supply: "" }, { name: "Thường", price: "", supply: "" }],
    maxPerWallet: "4",
    resaleCapPercent: "110",
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const posterUrl = useMemo(() => (form.poster ? URL.createObjectURL(form.poster) : null), [form.poster]);
  useEffect(() => {
    return () => {
      if (posterUrl) URL.revokeObjectURL(posterUrl);
    };
  }, [posterUrl]);

  const errors = useMemo(() => validate(form), [form]);
  const stepErrors = [errors.info, errors.tiers, errors.rules];

  const go = (next) => {
    if (next > step && Object.keys(stepErrors[step] || {}).length) {
      setTouched(true);
      setShake((s) => s + 1);
      return;
    }
    setTouched(false);
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  const startTime = form.start ? Math.floor(new Date(form.start).getTime() / 1000) : 0;
  // group = "info" | "rules" → tra theo tên nhóm trong `errors` (không phải mảng stepErrors theo chỉ số)
  const show = (group, key) => (touched ? errors[group]?.[key] : null);

  async function submit({ signer, contract, setStage }) {
    // 1. Đăng nhập ví → token (BE kiểm tra ORGANIZER_ROLE on-chain)
    setStage("signing");
    const { message } = await api(`/auth/nonce?address=${account}`);
    const signature = await signer.signMessage(message);
    const { token } = await api("/auth/verify", { method: "POST", body: { address: account, signature } });

    // 2. Upload poster + metadata lên IPFS
    setStage("preparing", "Đang tải lên IPFS…");
    const fd = new FormData();
    fd.append("poster", form.poster);
    fd.append(
      "data",
      JSON.stringify({
        name: form.name.trim(),
        description: form.description.trim(),
        venue: form.venue.trim(),
        startTime,
        tiers: form.tiers.map((t) => ({ name: t.name.trim() })),
      })
    );
    const uris = await api("/upload/event", { method: "POST", body: fd, token });

    // 3. Ký giao dịch tạo sự kiện
    setStage("signing");
    return contract.createEvent(
      {
        name: form.name.trim(),
        venue: form.venue.trim(),
        startTime,
        metadataURI: uris.eventURI,
        maxPerWallet: Number(form.maxPerWallet),
        resaleCapPercent: Number(form.resaleCapPercent),
      },
      form.tiers.map((t, i) => ({
        name: t.name.trim(),
        price: parseEther(t.price),
        supply: Number(t.supply),
        metadataURI: uris.tierURIs[i],
      }))
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <IconButton icon="left" label="Quay lại" onClick={() => navigate("/organizer")} className="-ml-3 mb-2" />
      <h1 className="text-2xl font-bold">Tạo sự kiện mới</h1>

      {/* Thanh bước */}
      <ol className="mt-6 mb-6 grid grid-cols-3 gap-2" aria-label="Các bước">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="progress-fill h-full bg-primary"
                style={{ transform: `scaleX(${i <= step ? 1 : 0})` }}
              />
            </div>
            <p className={`mt-2 text-xs font-medium sm:text-sm ${i === step ? "text-fg" : "text-muted-fg"}`}>
              {i + 1}. {s}
            </p>
          </li>
        ))}
      </ol>

      <Card className="overflow-hidden p-5 sm:p-6">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -24 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && (
              <div className="space-y-1">
                <Field label="Tên sự kiện" error={show("info", "name")} shakeKey={show("info", "name") ? shake : 0}>
                  {({ id, invalid }) => (
                    <input id={id} value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass(invalid)} placeholder="Đêm nhạc FairPass 2026" />
                  )}
                </Field>
                <Field label="Mô tả" hint="Hiển thị trên trang sự kiện và trong metadata NFT">
                  {({ id }) => (
                    <textarea
                      id={id}
                      rows={3}
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      className={`${inputClass(false)} h-auto py-2.5`}
                    />
                  )}
                </Field>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Địa điểm" error={show("info", "venue")} shakeKey={show("info", "venue") ? shake : 0}>
                    {({ id, invalid }) => (
                      <input id={id} value={form.venue} onChange={(e) => set("venue", e.target.value)} className={inputClass(invalid)} />
                    )}
                  </Field>
                  <Field label="Thời gian bắt đầu" error={show("info", "start")} shakeKey={show("info", "start") ? shake : 0}>
                    {({ id, invalid }) => (
                      <input id={id} type="datetime-local" value={form.start} onChange={(e) => set("start", e.target.value)} className={inputClass(invalid)} />
                    )}
                  </Field>
                </div>
                <Field label="Poster" error={show("info", "poster")} shakeKey={show("info", "poster") ? shake : 0} hint="Ảnh ≤ 5MB, tỉ lệ 16:9 đẹp nhất">
                  {({ id, invalid }) => (
                    <label
                      htmlFor={id}
                      className={`relative flex aspect-[16/9] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted transition-colors hover:border-primary/60 ${invalid ? "border-danger-text" : "border-border"}`}
                    >
                      {posterUrl ? (
                        <img src={posterUrl} alt="Xem trước poster" className="absolute inset-0 size-full object-cover" />
                      ) : (
                        <span className="flex flex-col items-center gap-2 text-sm text-muted-fg">
                          <Icon name="image" size="lg" className="text-primary" />
                          Chọn ảnh poster
                        </span>
                      )}
                      <input
                        id={id}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(e) => set("poster", e.target.files?.[0] || null)}
                      />
                    </label>
                  )}
                </Field>
              </div>
            )}

            {step === 1 && (
              <div>
                <p className="mb-4 text-sm text-muted-fg">Mỗi hạng vé có giá và số lượng riêng (tối đa 10 hạng).</p>
                <div className="space-y-3">
                  <AnimatePresence initial={false}>
                    {form.tiers.map((t, i) => {
                      const e = touched ? errors.tierRows[i] || {} : {};
                      const update = (k, v) => set("tiers", form.tiers.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
                      return (
                        <motion.div
                          key={i}
                          layout
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-[1fr_1fr_1fr_44px] items-start gap-2 rounded-xl border border-border p-3">
                            <Field label="Tên hạng" error={e.name} shakeKey={e.name ? shake : 0}>
                              {({ id, invalid }) => <input id={id} value={t.name} onChange={(ev) => update("name", ev.target.value)} className={inputClass(invalid)} />}
                            </Field>
                            <Field label="Giá (ETH)" error={e.price} shakeKey={e.price ? shake : 0}>
                              {({ id, invalid }) => (
                                <input id={id} inputMode="decimal" value={t.price} onChange={(ev) => update("price", ev.target.value.replace(",", "."))} className={`${inputClass(invalid)} font-mono`} placeholder="0.05" />
                              )}
                            </Field>
                            <Field label="Số lượng" error={e.supply} shakeKey={e.supply ? shake : 0}>
                              {({ id, invalid }) => (
                                <input id={id} inputMode="numeric" value={t.supply} onChange={(ev) => update("supply", ev.target.value.replace(/\D/g, ""))} className={inputClass(invalid)} placeholder="100" />
                              )}
                            </Field>
                            <IconButton
                              icon="trash"
                              label={`Xoá hạng ${t.name || i + 1}`}
                              className="mt-7"
                              disabled={form.tiers.length === 1}
                              onClick={() => set("tiers", form.tiers.filter((_, j) => j !== i))}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  icon="plus"
                  className="mt-3"
                  disabled={form.tiers.length >= 10}
                  onClick={() => set("tiers", [...form.tiers, emptyTier()])}
                >
                  Thêm hạng vé
                </Button>
              </div>
            )}

            {step === 2 && (
              <div>
                <div className="grid gap-x-4 sm:grid-cols-2">
                  <Field label="Giới hạn vé mỗi ví" hint="Chống đầu cơ: áp dụng cả mua mới và mua lại" error={errors.rules.maxPerWallet} shakeKey={errors.rules.maxPerWallet ? shake : 0}>
                    {({ id, invalid }) => (
                      <input id={id} inputMode="numeric" value={form.maxPerWallet} onChange={(e) => set("maxPerWallet", e.target.value.replace(/\D/g, ""))} className={inputClass(invalid)} />
                    )}
                  </Field>
                  <Field label="Giá trần bán lại (%)" hint="≥ 100. Ví dụ 110 = tối đa 110% giá gốc" error={errors.rules.resaleCapPercent} shakeKey={errors.rules.resaleCapPercent ? shake : 0} suffix="%">
                    {({ id, invalid }) => (
                      <input id={id} inputMode="numeric" value={form.resaleCapPercent} onChange={(e) => set("resaleCapPercent", e.target.value.replace(/\D/g, ""))} className={`${inputClass(invalid)} pr-10`} />
                    )}
                  </Field>
                </div>

                <div className="mt-2 rounded-xl bg-muted p-4 text-sm">
                  <p className="mb-3 font-semibold">Xem lại</p>
                  <dl className="grid grid-cols-[120px_1fr] gap-y-2">
                    <dt className="text-muted-fg">Sự kiện</dt>
                    <dd className="font-medium">{form.name || "—"}</dd>
                    <dt className="text-muted-fg">Thời gian</dt>
                    <dd>{form.start ? formatDateTime(form.start) : "—"}</dd>
                    <dt className="text-muted-fg">Địa điểm</dt>
                    <dd>{form.venue || "—"}</dd>
                    <dt className="text-muted-fg">Hạng vé</dt>
                    <dd className="space-y-1">
                      {form.tiers.map((t, i) => (
                        <p key={i}>
                          {t.name || "?"} · {safeEth(t.price)} · {t.supply || 0} vé
                        </p>
                      ))}
                    </dd>
                  </dl>
                </div>
                <p className="mt-4 flex gap-2 text-xs text-muted-fg">
                  <Icon name="info" className="mt-0.5 size-3!" />
                  Bạn sẽ ký 2 lần trên MetaMask: (1) xác thực ví để tải poster lên IPFS, (2) giao dịch tạo sự kiện.
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center justify-between gap-3 border-t border-border pt-5">
          <Button variant="ghost" icon="left" onClick={() => go(step - 1)} disabled={step === 0}>
            Quay lại
          </Button>
          {step < 2 ? (
            <Button iconRight="right" onClick={() => go(step + 1)}>
              Tiếp tục
            </Button>
          ) : (
            <TxButton
              icon="plus"
              label="Tạo sự kiện"
              successLabel="Đã tạo sự kiện"
              disabled={Object.keys(errors.rules).length > 0 || !errors.valid}
              action={submit}
              onSuccess={async (receipt) => {
                const ev = findEvent(receipt, "EventCreated");
                await waitIndexed(receipt.blockNumber);
                navigate(ev ? `/organizer/events/${ev.args.eventId}` : "/organizer");
              }}
            />
          )}
        </div>
      </Card>
    </div>
  );
}

function safeEth(v) {
  try {
    return formatEth(parseEther(v || "0"));
  } catch {
    return "—";
  }
}

function validate(f) {
  const info = {};
  if (!f.name.trim()) info.name = "Nhập tên sự kiện";
  if (!f.venue.trim()) info.venue = "Nhập địa điểm";
  if (!f.start) info.start = "Chọn thời gian";
  else if (new Date(f.start).getTime() <= Date.now() + 60_000) info.start = "Thời gian phải ở tương lai";
  if (!f.poster) info.poster = "Chọn ảnh poster";
  else if (f.poster.size > 5 * 1024 * 1024) info.poster = "Ảnh quá 5MB";

  const tierRows = f.tiers.map((t) => {
    const e = {};
    if (!t.name.trim()) e.name = "Nhập tên";
    try {
      if (!t.price || parseEther(t.price) < 0n) e.price = "Giá không hợp lệ";
    } catch {
      e.price = "Giá không hợp lệ";
    }
    if (!t.supply || Number(t.supply) <= 0) e.supply = "> 0";
    else if (Number(t.supply) > 1_000_000) e.supply = "Quá lớn";
    return e;
  });
  const tiers = tierRows.some((e) => Object.keys(e).length) ? { rows: true } : {};

  const rules = {};
  const mpw = Number(f.maxPerWallet);
  if (!mpw || mpw < 1) rules.maxPerWallet = "Ít nhất 1";
  else if (mpw > 1000) rules.maxPerWallet = "Quá lớn";
  const cap = Number(f.resaleCapPercent);
  if (!cap || cap < 100) rules.resaleCapPercent = "Phải ≥ 100";
  else if (cap > 1000) rules.resaleCapPercent = "Quá lớn";

  return { info, tiers, tierRows, rules, valid: !Object.keys(info).length && !Object.keys(tiers).length };
}
