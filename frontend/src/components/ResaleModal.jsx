/**
 * Rao bán lại vé — giá bị chặn bởi giá trần ngay khi gõ (ô rung + báo lỗi),
 * không cần đợi giao dịch revert (MASTER §7.3).
 */
import { useMemo, useState } from "react";
import { formatEther, parseEther } from "ethers";
import { formatEth, tokenLabel } from "../lib/format";
import { Field, inputClass } from "./ui/Field";
import { Modal } from "./ui/Modal";
import { TxButton } from "./ui/TxButton";
import { Icon } from "./ui/Icon";

export function ResaleModal({ ticket, open, onClose, onDone }) {
  return (
    <Modal open={open} onClose={onClose} title="Rao bán lại vé" subtitle={ticket && `${tokenLabel(ticket.tokenId)} · ${ticket.event.name}`}>
      {open && ticket && <ResaleForm ticket={ticket} onDone={onDone} />}
    </Modal>
  );
}

function ResaleForm({ ticket, onDone }) {
  const original = BigInt(ticket.pricePaid);
  const cap = BigInt(ticket.maxResalePrice);
  const capPercent = ticket.event.resaleCapPercent;
  const [value, setValue] = useState(formatEther(ticket.listed ? BigInt(ticket.listPrice) : cap));
  const [shakeKey, setShakeKey] = useState(0);

  const { wei, error } = useMemo(() => {
    if (!value) return { wei: null, error: "Nhập giá bán" };
    let w;
    try {
      w = parseEther(value);
    } catch {
      return { wei: null, error: "Giá không hợp lệ" };
    }
    if (w <= 0n) return { wei: null, error: "Giá phải lớn hơn 0" };
    if (w > cap) return { wei: null, error: `Vượt giá trần ${capPercent}% (tối đa ${formatEth(cap)})` };
    return { wei: w, error: null };
  }, [value, cap, capPercent]);

  const onChange = (e) => {
    const next = e.target.value.replace(",", ".");
    setValue(next);
    try {
      const w = parseEther(next || "0");
      if (w > cap) setShakeKey((k) => k + 1); // rung mỗi lần gõ vượt trần
    } catch {
      /* đang gõ dở */
    }
  };

  const percent = wei && original > 0n ? Number((wei * 10000n) / original) / 100 : null;
  const presets = [100, Math.round((100 + capPercent) / 2), capPercent].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl bg-muted p-3.5 text-sm">
        <div>
          <p className="text-muted-fg">Giá gốc</p>
          <p className="font-semibold">{formatEth(original)}</p>
        </div>
        <div>
          <p className="text-muted-fg">Giá trần ({capPercent}%)</p>
          <p className="font-semibold text-primary">{formatEth(cap)}</p>
        </div>
      </div>

      <Field
        label="Giá bán (ETH)"
        error={value ? error : null}
        shakeKey={shakeKey}
        hint={percent !== null ? `= ${percent.toLocaleString("vi-VN")}% giá gốc` : undefined}
        suffix="ETH"
      >
        {({ id, invalid }) => (
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            onChange={onChange}
            aria-invalid={invalid}
            className={`${inputClass(invalid)} pr-14 font-mono`}
          />
        )}
      </Field>

      <div className="mb-5 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setValue(formatEther((original * BigInt(p)) / 100n))}
            className="h-9 rounded-lg border border-border px-3 text-sm text-muted-fg transition-colors hover:border-primary/60 hover:text-fg"
          >
            {p}%
          </button>
        ))}
      </div>

      <p className="mb-4 flex gap-2 text-xs text-muted-fg">
        <Icon name="lock" className="mt-0.5 size-3!" />
        Vé chỉ đổi chủ qua chợ FairPass. Tiền chuyển thẳng vào ví bạn khi có người mua.
      </p>

      <TxButton
        full
        icon="tag"
        label={ticket.listed ? "Cập nhật giá rao" : "Rao bán"}
        successLabel="Đã rao bán"
        disabled={!wei}
        action={({ contract }) => contract.listForResale(ticket.tokenId, wei)}
        onSuccess={onDone}
      />
    </div>
  );
}
