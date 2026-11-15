/**
 * Đăng nhập bằng chữ ký ví (kiểu Sign-In With Ethereum rút gọn):
 *   1. GET  /api/auth/nonce?address=0x..  → message chứa nonce
 *   2. Ví ký message (personal_sign)
 *   3. POST /api/auth/verify {address, signature} → BE khôi phục địa chỉ ký,
 *      kiểm tra ORGANIZER_ROLE on-chain, cấp token 1 giờ.
 * Không lưu mật khẩu; quyền luôn lấy từ contract.
 */
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const config = require("./config");
const { ethers, contract, ORGANIZER_ROLE } = require("./chain");

const NONCE_TTL_MS = 5 * 60 * 1000;
const nonces = new Map(); // address → { nonce, expires }

const buildMessage = (address, nonce) =>
  `FairPass — xác thực ví\n\nVí: ${address}\nNonce: ${nonce}\n\nChữ ký này chỉ dùng để đăng nhập, không tạo giao dịch và không tốn phí.`;

function issueNonce(address) {
  const nonce = crypto.randomBytes(16).toString("hex");
  nonces.set(address, { nonce, expires: Date.now() + NONCE_TTL_MS });
  return buildMessage(address, nonce);
}

async function verifyLogin(address, signature) {
  const entry = nonces.get(address);
  if (!entry || entry.expires < Date.now()) throw httpError(400, "Nonce không tồn tại hoặc đã hết hạn");
  nonces.delete(address); // mỗi nonce chỉ dùng 1 lần

  let recovered;
  try {
    recovered = ethers.verifyMessage(buildMessage(address, entry.nonce), signature).toLowerCase();
  } catch {
    throw httpError(401, "Chữ ký không hợp lệ");
  }
  if (recovered !== address) throw httpError(401, "Chữ ký không khớp với địa chỉ ví");

  const isOrganizer = await contract.hasRole(ORGANIZER_ROLE, address);
  const token = jwt.sign({ sub: address, organizer: isOrganizer }, config.jwtSecret, { expiresIn: "1h" });
  return { token, address, isOrganizer };
}

function requireOrganizer(req, _res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return next(httpError(401, "Cần đăng nhập bằng ví"));
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (!payload.organizer) return next(httpError(403, "Chỉ ban tổ chức (ORGANIZER_ROLE) được upload"));
    req.user = { address: payload.sub };
    next();
  } catch {
    next(httpError(401, "Token không hợp lệ hoặc đã hết hạn"));
  }
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { issueNonce, verifyLogin, requireOrganizer, httpError };
