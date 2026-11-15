/**
 * Đăng nhập ví + upload poster & metadata NFT lên IPFS (chỉ organizer).
 *
 * POST /api/upload/event  (multipart/form-data)
 *   poster: file ảnh (≤ 5MB)
 *   data:   JSON { name, description, venue, startTime (unix giây), tiers: [{ name }] }
 * → { imageURI, eventURI, tierURIs: [] }
 * FE dùng các URI này khi gọi createEvent(info, tiers) trên contract.
 */
const express = require("express");
const multer = require("multer");
const { pinFile, pinJSON, isLocalMode } = require("../ipfs");
const { issueNonce, verifyLogin, requireOrganizer, httpError } = require("../auth");
const { ethers } = require("../chain");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(httpError(400, "Poster phải là file ảnh")),
});

// ─────────── đăng nhập ví ───────────

router.get("/auth/nonce", (req, res) => {
  const { address } = req.query;
  if (!address || !ethers.isAddress(address)) throw httpError(400, "Địa chỉ ví không hợp lệ");
  res.json({ message: issueNonce(address.toLowerCase()) });
});

router.post("/auth/verify", async (req, res) => {
  const { address, signature } = req.body || {};
  if (!address || !ethers.isAddress(address) || !signature) throw httpError(400, "Thiếu address hoặc signature");
  res.json(await verifyLogin(address.toLowerCase(), signature));
});

// ─────────── upload ───────────

function parseEventData(raw) {
  let data;
  try {
    data = JSON.parse(raw || "{}");
  } catch {
    throw httpError(400, "Trường data phải là JSON");
  }
  const { name, description = "", venue = "", startTime, tiers } = data;
  if (!name || typeof name !== "string") throw httpError(400, "Thiếu tên sự kiện");
  if (!Number.isInteger(Number(startTime))) throw httpError(400, "startTime phải là unix timestamp (giây)");
  if (!Array.isArray(tiers) || tiers.length === 0 || tiers.length > 10 || tiers.some((t) => !t?.name))
    throw httpError(400, "Cần 1–10 hạng vé, mỗi hạng có name");
  return { name, description, venue, startTime: Number(startTime), tiers };
}

router.post("/upload/event", requireOrganizer, upload.single("poster"), async (req, res) => {
  const data = parseEventData(req.body.data);
  if (!req.file) throw httpError(400, "Thiếu ảnh poster");

  const imageURI = await pinFile(req.file.buffer, req.file.originalname, req.file.mimetype);
  const dateISO = new Date(data.startTime * 1000).toISOString();

  const eventURI = await pinJSON(
    {
      name: data.name,
      description: data.description,
      image: imageURI,
      venue: data.venue,
      startTime: data.startTime,
      organizer: req.user.address,
    },
    `event-${data.name}`
  );

  // Metadata chuẩn ERC-721 cho từng hạng vé (hiển thị trên ví / Etherscan)
  const tierURIs = [];
  for (const tier of data.tiers) {
    tierURIs.push(
      await pinJSON(
        {
          name: `${data.name} — ${tier.name}`,
          description: data.description || `Vé ${tier.name} cho sự kiện ${data.name}`,
          image: imageURI,
          attributes: [
            { trait_type: "Sự kiện", value: data.name },
            { trait_type: "Hạng vé", value: tier.name },
            { trait_type: "Địa điểm", value: data.venue },
            { trait_type: "Thời gian", value: dateISO },
          ],
        },
        `tier-${data.name}-${tier.name}`
      )
    );
  }

  res.json({ imageURI, eventURI, tierURIs, storage: isLocalMode() ? "local" : "ipfs" });
});

module.exports = router;
