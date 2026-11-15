import { isRouteErrorResponse, useRouteError } from "react-router";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";

/** Thay màn hình lỗi mặc định của React Router bằng giao diện FairPass */
export default function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error?.message || String(error);
  if (import.meta.env.DEV) console.error(error);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-danger/15 text-danger-text">
        <Icon name="warning" size="lg" />
      </div>
      <h1 className="text-xl font-bold">Đã có lỗi xảy ra</h1>
      <p className="mt-2 text-sm text-muted-fg">Trang gặp sự cố ngoài ý muốn. Hãy tải lại trang hoặc quay về trang chủ.</p>
      {import.meta.env.DEV && (
        <pre className="mt-4 max-h-40 w-full overflow-auto rounded-xl bg-muted p-3 text-left font-mono text-xs text-danger-text">
          {message}
        </pre>
      )}
      <div className="mt-6 flex gap-2">
        <Button icon="refresh" onClick={() => window.location.reload()}>
          Tải lại trang
        </Button>
        <Button variant="secondary" onClick={() => (window.location.href = "/")}>
          Về trang chủ
        </Button>
      </div>
    </div>
  );
}
