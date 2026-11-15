import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWallet } from "../../hooks/useWallet";
import { CHAIN } from "../../lib/config";
import { describeError } from "../../lib/errors";
import { formatEth, shortAddress } from "../../lib/format";
import { copyText } from "../../lib/clipboard";
import { buttonClass } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

export function WalletButton() {
  const w = useWallet();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [funding, setFunding] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  if (!w.hasWallet)
    return (
      <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className={buttonClass({ size: "sm" })}>
        <Icon name="wallet" /> Cài MetaMask
      </a>
    );

  if (!w.isConnected)
    return (
      <button
        type="button"
        onClick={() =>
          w.connect().catch((err) => {
            const d = describeError(err);
            d.rejected ? toast.info(d.title) : toast.error(d.title);
          })
        }
        disabled={w.connecting}
        className={buttonClass({ size: "sm" })}
      >
        <Icon name={w.connecting ? "spinner" : "wallet"} spin={w.connecting} />
        {w.connecting ? "Đang kết nối…" : "Kết nối ví"}
      </button>
    );

  const roleLabel = w.roles.isAdmin ? "Quản trị" : w.roles.isOrganizer ? "Ban tổ chức" : w.roles.staffEventIds.length ? "Soát vé" : "Khách";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex h-10 items-center gap-2 rounded-lg border border-border bg-muted pr-2.5 pl-3 text-sm transition-colors hover:border-primary/60"
      >
        <span className="size-2 rounded-full bg-success" aria-hidden="true" />
        {w.balance !== null && (
          <span className="hidden font-semibold tabular-nums sm:inline">{formatEth(w.balance)}</span>
        )}
        <span className="font-mono text-muted-fg sm:text-fg">{shortAddress(w.account)}</span>
        <Icon name="down" className={`size-3! text-muted-fg transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card p-1.5 shadow-2xl shadow-black/50"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: "top right" }}
          >
            <div className="px-3 py-2.5">
              <p className="text-xs text-muted-fg">Đang kết nối · {CHAIN.name}</p>
              <p className="mt-0.5 font-mono text-sm break-all">{w.account}</p>
              <p className="mt-1.5 text-xs text-primary">Vai trò: {roleLabel}</p>
              <p className="mt-2 text-xs text-muted-fg">Số dư</p>
              <p className="text-lg font-bold tabular-nums">{w.balance === null ? "—" : formatEth(w.balance)}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            {w.isLocalChain && (
              <MenuItem
                icon={funding ? "spinner" : "plus"}
                disabled={funding}
                onClick={async () => {
                  setFunding(true);
                  try {
                    await w.fundTestEth(100);
                    toast.success("Đã nạp 100 ETH test", "Chỉ có giá trị trên mạng Hardhat local");
                  } catch (err) {
                    toast.error("Không nạp được ETH test", err.message);
                  } finally {
                    setFunding(false);
                  }
                }}
              >
                Nhận 100 ETH test
              </MenuItem>
            )}
            <MenuItem
              icon="copy"
              onClick={async () => {
                if (await copyText(w.account)) toast.success("Đã sao chép địa chỉ ví");
                setOpen(false);
              }}
            >
              Sao chép địa chỉ
            </MenuItem>
            <MenuItem
              icon="disconnect"
              onClick={() => {
                w.disconnect();
                setOpen(false);
              }}
            >
              Ngắt kết nối
            </MenuItem>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon, children, ...props }) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm text-muted-fg hover:bg-muted hover:text-fg disabled:opacity-50"
      {...props}
    >
      <Icon name={icon} />
      {children}
    </button>
  );
}
