import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { ICONS } from "../../lib/icons";

const SIZES = { sm: 16, md: 20, lg: 24 };

/**
 * <Icon name="ticket" size="md" /> — trang trí (aria-hidden).
 * Truyền `label` khi icon mang nghĩa mà không có chữ đi kèm.
 */
export function Icon({ name, size = "sm", label, className = "", spin = false }) {
  const icon = ICONS[name];
  if (!icon) {
    if (import.meta.env.DEV) console.warn(`[Icon] không có icon "${name}" trong lib/icons.js`);
    return null;
  }
  const px = SIZES[size] || SIZES.sm;
  return (
    <FontAwesomeIcon
      icon={icon}
      spin={spin}
      className={className}
      style={{ width: px, height: px }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? "img" : undefined}
    />
  );
}
