import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { useWallet } from "../../hooks/useWallet";
import { CHAIN, CONTRACT_ADDRESS } from "../../lib/config";
import { readContract } from "../../lib/contract";
import { describeError } from "../../lib/errors";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";
import { WalletButton } from "./WalletButton";

/** Menu theo vai trò (MASTER §5) */
function useNavItems() {
  const { roles } = useWallet();
  const items = [
    { to: "/", label: "Sự kiện", icon: "calendar", end: true },
    { to: "/marketplace", label: "Chợ bán lại", icon: "store" },
    { to: "/my-tickets", label: "Vé của tôi", icon: "ticket" },
  ];
  const role = [];
  if (roles.isOrganizer || roles.organizedEventIds.length) role.push({ to: "/organizer", label: "Tổ chức", icon: "organizer" });
  if (roles.checkinEvents.length) role.push({ to: "/checkin", label: "Soát vé", icon: "staff" });
  if (roles.isAdmin) role.push({ to: "/admin", label: "Quản trị", icon: "admin" });
  return { items, role };
}

export function Layout() {
  const { items, role } = useNavItems();
  const { pathname } = useLocation();

  // Ngoặc nhọn là bắt buộc: Chrome mới cho scrollTo() trả về Promise,
  // nếu return nó React sẽ coi là hàm cleanup → "destroy is not a function"
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
          <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="FairPass — trang chủ">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-on-primary">
              <Icon name="ticket" />
            </span>
            <span className="text-lg font-bold tracking-tight">FairPass</span>
          </Link>

          <nav className="ml-4 hidden items-center gap-1 lg:flex" aria-label="Điều hướng chính">
            {items.map((i) => (
              <TopLink key={i.to} {...i} />
            ))}
            {role.length > 0 && <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />}
            {role.map((i) => (
              <TopLink key={i.to} {...i} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <NetworkBadge />
            <WalletButton />
          </div>
        </div>
      </header>

      <SystemBanners />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 lg:pb-16">
        <Outlet />
      </main>

      <footer className="hidden border-t border-border/70 py-6 text-center text-xs text-muted-fg lg:block">
        FairPass · Đề tài 58 — Hợp đồng thông minh cho hệ thống bán vé sự kiện · Hợp đồng{" "}
        <span className="font-mono">{CONTRACT_ADDRESS}</span> trên {CHAIN.name}
      </footer>

      <MobileNav items={[...items, ...role].slice(0, 5)} />
    </div>
  );
}

function TopLink({ to, label, icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors duration-150 ${
          isActive ? "bg-muted text-fg" : "text-muted-fg hover:text-fg"
        }`
      }
    >
      <Icon name={icon} className="size-3.5!" />
      {label}
    </NavLink>
  );
}

function MobileNav({ items }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      aria-label="Điều hướng"
    >
      <div className="mx-auto flex max-w-lg">
        {items.map((i) => (
          <NavLink
            key={i.to}
            to={i.to}
            end={i.end}
            className={({ isActive }) =>
              `flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                isActive ? "text-primary" : "text-muted-fg"
              }`
            }
          >
            <Icon name={i.icon} size="md" />
            {i.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function NetworkBadge() {
  const w = useWallet();
  if (!w.isConnected) return null;
  if (w.isCorrectChain)
    return (
      <span className="hidden h-10 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-fg sm:flex">
        <span className="size-2 rounded-full bg-success" aria-hidden="true" />
        {CHAIN.shortName}
      </span>
    );
  return null; // sai mạng → banner bên dưới header
}

function SystemBanners() {
  const w = useWallet();
  const toast = useToast();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    let alive = true;
    const check = () =>
      readContract
        ?.paused()
        .then((p) => alive && setPaused(p))
        .catch(() => {});
    check();
    const id = setInterval(check, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      {!CONTRACT_ADDRESS && (
        <Banner tone="danger" icon="warning">
          Chưa có địa chỉ contract cho chainId {CHAIN.id}. Hãy chạy <code className="font-mono">npm run deploy:local</code>.
        </Banner>
      )}
      {w.isConnected && !w.isCorrectChain && (
        <Banner tone="warning" icon="warning">
          Ví đang ở sai mạng. FairPass chạy trên <b>{CHAIN.name}</b>.
          <button
            onClick={() => w.switchNetwork().catch((e) => toast.error(describeError(e).title))}
            className="ml-3 rounded-md bg-warning px-2.5 py-1 text-xs font-semibold text-bg hover:opacity-90"
          >
            Chuyển sang {CHAIN.shortName}
          </button>
        </Banner>
      )}
      {paused && (
        <Banner tone="danger" icon="pause">
          Hệ thống đang <b>tạm dừng khẩn cấp</b> — mua, bán lại và soát vé tạm thời bị khoá. Hoàn tiền vẫn hoạt động.
        </Banner>
      )}
    </>
  );
}

function Banner({ tone, icon, children }) {
  const cls = tone === "danger" ? "bg-danger/15 text-danger-text border-danger/40" : "bg-warning/12 text-warning border-warning/35";
  return (
    <div className={`border-b ${cls}`} role="status">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2.5 text-sm">
        <Icon name={icon} />
        {children}
      </div>
    </div>
  );
}
