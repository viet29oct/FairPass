import { useState } from "react";
import { addressUrl } from "../../lib/config";
import { shortAddress } from "../../lib/format";
import { copyText } from "../../lib/clipboard";
import { Icon } from "./Icon";

export function AddressPill({ address, label, className = "" }) {
  const [copied, setCopied] = useState(false);
  if (!address) return null;
  const url = addressUrl(address);
  const copy = async () => {
    if (await copyText(address)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg bg-muted py-1 pr-1 pl-2.5 font-mono text-xs ${className}`}>
      {label && <span className="mr-1 font-sans text-muted-fg">{label}</span>}
      <span title={address}>{shortAddress(address)}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Đã sao chép địa chỉ" : "Sao chép địa chỉ"}
        className="grid size-7 place-items-center rounded-md text-muted-fg hover:bg-card hover:text-fg"
      >
        <Icon name={copied ? "check" : "copy"} className="size-3.5!" />
      </button>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="Xem trên Etherscan"
          className="grid size-7 place-items-center rounded-md text-muted-fg hover:bg-card hover:text-fg"
        >
          <Icon name="external" className="size-3.5!" />
        </a>
      )}
    </span>
  );
}
