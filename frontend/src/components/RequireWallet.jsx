import { useWallet } from "../hooks/useWallet";
import { describeError } from "../lib/errors";
import { Button } from "./ui/Button";
import { EmptyState } from "./ui/Feedback";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

/** Chặn trang cần ví; `allow(roles)` để chặn thêm theo quyền */
export function RequireWallet({ children, allow, deniedTitle, deniedText }) {
  const w = useWallet();
  const toast = useToast();

  if (!w.hasWallet)
    return (
      <EmptyState
        icon="wallet"
        title="Cần ví MetaMask"
        description="FairPass dùng ví MetaMask để xác thực quyền sở hữu vé trên blockchain. Cài tiện ích MetaMask rồi tải lại trang."
        action={
          <Button icon="external" onClick={() => window.open("https://metamask.io/download/", "_blank", "noopener")}>
            Cài MetaMask
          </Button>
        }
      />
    );

  if (!w.isConnected)
    return (
      <EmptyState
        icon="wallet"
        title="Kết nối ví để tiếp tục"
        description="Ví của bạn chính là tài khoản — không cần mật khẩu, không cần đăng ký."
        action={
          <Button
            icon="wallet"
            onClick={() =>
              w.connect().catch((e) => {
                const d = describeError(e);
                d.rejected ? toast.info(d.title) : toast.error(d.title);
              })
            }
          >
            Kết nối ví
          </Button>
        }
      />
    );

  if (allow && w.rolesLoading && !allow(w.roles))
    return (
      <div className="flex min-h-60 items-center justify-center gap-3 text-muted-fg">
        <Icon name="spinner" spin /> Đang kiểm tra quyền của ví…
      </div>
    );

  if (allow && !allow(w.roles))
    return (
      <EmptyState
        icon="lock"
        title={deniedTitle || "Bạn không có quyền truy cập"}
        description={deniedText || "Ví đang kết nối không có vai trò phù hợp cho trang này."}
        action={<Button to="/" variant="secondary">Về trang chủ</Button>}
      />
    );

  return children;
}
