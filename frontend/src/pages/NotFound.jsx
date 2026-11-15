import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/Feedback";

export default function NotFound() {
  return (
    <EmptyState
      icon="ticket"
      title="Không tìm thấy trang"
      description="Đường dẫn không tồn tại hoặc đã bị thay đổi."
      action={<Button to="/" icon="calendar">Về trang sự kiện</Button>}
    />
  );
}
