/**
 * REST API CHỈ ĐỌC từ DB đã index. Mọi thao tác ghi đi thẳng FE → MetaMask → contract.
 */
const express = require("express");
const { prisma } = require("../db");
const { ethers, contract, DEFAULT_ADMIN_ROLE, ORGANIZER_ROLE } = require("../chain");
const { status: indexerStatus } = require("../indexer");
const { httpError } = require("../auth");
const config = require("../config");

const router = express.Router();

// ─────────── helpers ───────────

function parseAddress(value) {
  if (!value || !ethers.isAddress(value)) throw httpError(400, "Địa chỉ ví không hợp lệ");
  return value.toLowerCase();
}

function parseId(value, label = "id") {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw httpError(400, `${label} không hợp lệ`);
  return n;
}

const limitOf = (q, def = 50) => Math.min(Math.max(Number(q) || def, 1), 200);

/** Bổ sung số liệu tổng hợp cho sự kiện */
function withEventStats(evt) {
  const tiers = evt.tiers || [];
  return {
    ...evt,
    totalSupply: tiers.reduce((s, t) => s + t.supply, 0),
    totalSold: tiers.reduce((s, t) => s + t.sold, 0),
    minPrice: tiers.length ? tiers.reduce((m, t) => (t.price.lt(m) ? t.price : m), tiers[0].price) : null,
  };
}

const tierOrder = { orderBy: { tierIndex: "asc" } };

// ─────────── hệ thống ───────────

router.get("/health", async (_req, res) => {
  res.json({
    ok: true,
    chainId: config.chainId,
    contractAddress: config.contractAddress,
    indexer: indexerStatus,
  });
});

// ─────────── sự kiện ───────────

/**
 * GET /events?status=upcoming|past|cancelled|all&organizer=0x..&q=tên
 */
router.get("/events", async (req, res) => {
  const now = new Date();
  const where = {};
  switch (req.query.status || "upcoming") {
    case "upcoming":
      Object.assign(where, { cancelled: false, startTime: { gt: now } });
      break;
    case "past":
      Object.assign(where, { cancelled: false, startTime: { lte: now } });
      break;
    case "cancelled":
      where.cancelled = true;
      break;
    case "all":
      break;
    default:
      throw httpError(400, "status không hợp lệ");
  }
  if (req.query.organizer) where.organizer = parseAddress(req.query.organizer);
  if (req.query.q) where.name = { contains: String(req.query.q), mode: "insensitive" };

  const events = await prisma.event.findMany({
    where,
    include: { tiers: tierOrder },
    orderBy: { startTime: req.query.status === "past" ? "desc" : "asc" },
    take: limitOf(req.query.limit),
  });
  res.json(events.map(withEventStats));
});

router.get("/events/:id", async (req, res) => {
  const id = parseId(req.params.id, "eventId");
  const evt = await prisma.event.findUnique({
    where: { id },
    include: { tiers: tierOrder, staff: true },
  });
  if (!evt) throw httpError(404, "Không tìm thấy sự kiện");
  res.json(withEventStats(evt));
});

/** Thống kê cho trang organizer */
router.get("/events/:id/stats", async (req, res) => {
  const id = parseId(req.params.id, "eventId");
  const evt = await prisma.event.findUnique({ where: { id }, include: { tiers: tierOrder } });
  if (!evt) throw httpError(404, "Không tìm thấy sự kiện");

  const [checkedIn, refunded, listed, resales] = await Promise.all([
    prisma.ticket.count({ where: { eventId: id, used: true } }),
    prisma.ticket.count({ where: { eventId: id, burned: true } }),
    prisma.ticket.count({ where: { eventId: id, listed: true } }),
    prisma.activity.count({ where: { eventId: id, type: "RESOLD" } }),
  ]);
  const usedByTier = await prisma.ticket.groupBy({
    by: ["tierIndex"],
    where: { eventId: id, used: true },
    _count: true,
  });

  res.json({
    eventId: id,
    revenue: evt.revenue,
    withdrawn: evt.withdrawn,
    cancelled: evt.cancelled,
    ...withEventStats(evt),
    checkedIn,
    refunded,
    listed,
    resales,
    tiers: evt.tiers.map((t) => ({
      ...t,
      checkedIn: usedByTier.find((u) => u.tierIndex === t.tierIndex)?._count || 0,
    })),
  });
});

// ─────────── vé ───────────

const ticketInclude = {
  event: { select: { id: true, name: true, venue: true, startTime: true, image: true, cancelled: true, resaleCapPercent: true, organizer: true } },
  tier: { select: { name: true, price: true, metadataURI: true } },
};

const withCap = (t) => ({
  ...t,
  maxResalePrice: t.pricePaid.mul(t.event.resaleCapPercent).div(100).floor(),
});

router.get("/tickets/:tokenId", async (req, res) => {
  const tokenId = parseId(req.params.tokenId, "tokenId");
  const ticket = await prisma.ticket.findUnique({ where: { tokenId }, include: ticketInclude });
  if (!ticket) throw httpError(404, "Không tìm thấy vé");
  const history = await prisma.activity.findMany({ where: { tokenId }, orderBy: { id: "asc" } });
  res.json({ ...withCap(ticket), history });
});

/** Vé đang nắm giữ (kể cả đã dùng; bỏ vé đã hoàn tiền trừ khi ?includeBurned=1) */
router.get("/users/:address/tickets", async (req, res) => {
  const owner = parseAddress(req.params.address);
  const tickets = await prisma.ticket.findMany({
    where: { owner, ...(req.query.includeBurned ? {} : { burned: false }) },
    include: ticketInclude,
    orderBy: [{ event: { startTime: "asc" } }, { tokenId: "asc" }],
  });
  res.json(tickets.map(withCap));
});

/**
 * Quyền của ví — admin/organizer đọc trực tiếp từ contract (không tin DB),
 * danh sách sự kiện được làm staff lấy từ DB.
 */
router.get("/users/:address/roles", async (req, res) => {
  const address = parseAddress(req.params.address);
  const [isAdmin, isOrganizer, staffOf, organizing] = await Promise.all([
    contract.hasRole(DEFAULT_ADMIN_ROLE, address),
    contract.hasRole(ORGANIZER_ROLE, address),
    prisma.staff.findMany({ where: { address }, select: { eventId: true } }),
    prisma.event.findMany({ where: { organizer: address }, select: { id: true } }),
  ]);
  const staffEventIds = staffOf.map((s) => s.eventId);
  const organizedEventIds = organizing.map((e) => e.id);

  // Sự kiện ví này được soát vé (contract cho phép staff HOẶC organizer), bỏ sự kiện đã huỷ
  const checkinEvents = await prisma.event.findMany({
    where: { id: { in: [...new Set([...staffEventIds, ...organizedEventIds])] }, cancelled: false },
    select: { id: true, name: true, venue: true, startTime: true },
    orderBy: { startTime: "asc" },
  });

  res.json({ address, isAdmin, isOrganizer, staffEventIds, organizedEventIds, checkinEvents });
});

// ─────────── chợ bán lại ───────────

router.get("/listings", async (req, res) => {
  const where = { listed: true, burned: false, used: false, event: { cancelled: false, startTime: { gt: new Date() } } };
  if (req.query.eventId) where.eventId = parseId(req.query.eventId, "eventId");
  const listings = await prisma.ticket.findMany({
    where,
    include: ticketInclude,
    orderBy: { listPrice: "asc" },
    take: limitOf(req.query.limit, 100),
  });
  res.json(listings.map(withCap));
});

// ─────────── lịch sử & quản trị ───────────

router.get("/activity", async (req, res) => {
  const where = {};
  if (req.query.eventId) where.eventId = parseId(req.query.eventId, "eventId");
  if (req.query.tokenId) where.tokenId = parseId(req.query.tokenId, "tokenId");
  if (req.query.address) {
    const a = parseAddress(req.query.address);
    where.OR = [{ from: a }, { to: a }];
  }
  if (req.query.type) where.type = String(req.query.type).toUpperCase();
  const items = await prisma.activity.findMany({ where, orderBy: { id: "desc" }, take: limitOf(req.query.limit) });
  res.json(items);
});

router.get("/organizers", async (_req, res) => {
  res.json(await prisma.organizer.findMany({ orderBy: { grantedAt: "asc" } }));
});

module.exports = router;
