/**
 * Upload file / JSON lên IPFS qua Pinata.
 * Khi chưa cấu hình PINATA_JWT → chế độ local: lưu vào backend/uploads
 * và trả về URL http để demo offline.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");

const PINATA_API = "https://api.pinata.cloud/pinning";
const UPLOAD_DIR = path.join(__dirname, "../uploads");

const isLocalMode = () => !config.pinataJwt;

function saveLocal(buffer, ext) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = crypto.createHash("sha256").update(buffer).digest("hex").slice(0, 32) + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  return `${config.publicUrl}/uploads/${name}`;
}

async function pinataRequest(endpoint, body, headers = {}) {
  const res = await fetch(`${PINATA_API}/${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.pinataJwt}`, ...headers },
    body,
  });
  if (!res.ok) throw new Error(`Pinata ${endpoint} lỗi ${res.status}: ${await res.text()}`);
  const { IpfsHash } = await res.json();
  return `ipfs://${IpfsHash}`;
}

async function pinFile(buffer, filename, mimetype) {
  if (isLocalMode()) return saveLocal(buffer, path.extname(filename) || ".bin");
  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype }), filename);
  form.append("pinataMetadata", JSON.stringify({ name: `fairpass-${filename}` }));
  return pinataRequest("pinFileToIPFS", form);
}

async function pinJSON(obj, name) {
  if (isLocalMode()) return saveLocal(Buffer.from(JSON.stringify(obj, null, 2)), ".json");
  return pinataRequest(
    "pinJSONToIPFS",
    JSON.stringify({ pinataContent: obj, pinataMetadata: { name: `fairpass-${name}` } }),
    { "Content-Type": "application/json" }
  );
}

/** ipfs://CID → URL gateway; URL http giữ nguyên */
function toGatewayUrl(uri) {
  if (!uri) return uri;
  return uri.startsWith("ipfs://") ? config.ipfsGateway + uri.slice(7) : uri;
}

async function fetchJSON(uri, timeoutMs = 8000) {
  const res = await fetch(toGatewayUrl(uri), { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Tải metadata lỗi ${res.status}`);
  return res.json();
}

module.exports = { pinFile, pinJSON, fetchJSON, toGatewayUrl, isLocalMode, UPLOAD_DIR };
