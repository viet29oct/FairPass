/**
 * Ánh xạ mỗi event on-chain → cập nhật DB.
 * Mỗi handler nhận (tx, args, ctx) và trả về dữ liệu Activity tương ứng.
 * Handler chạy trong cùng transaction với việc ghi Activity (unique txHash+logIndex),
 * nên một log bị xử lý lại sẽ rollback toàn bộ → idempotent.
 */
const { contract, ORGANIZER_ROLE } = require("../chain");

const lc = (a) => (a ? a.toLowerCase() : a);
const num = (v) => Number(v);
const wei = (v) => v.toString();

/**
 * Đọc thêm dữ liệu từ chain TRƯỚC khi mở transaction DB.
 * Không gọi RPC bên trong transaction: RPC chậm sẽ giữ kết nối Postgres và làm transaction hết hạn.
 */
const prefetch = {
  async EventCreated(args, ctx) {
    const eventId = num(args.eventId);
    try {
      return { info: await contract.getEventInfo(eventId, { blockTag: ctx.blockNumber }) };
    } catch {
      return { info: await contract.getEventInfo(eventId) };
    }
  },
  async TierCreated(args, ctx) {
    try {
      const tiers = await contract.getTiers(num(args.eventId), { blockTag: ctx.blockNumber });
      return { metadataURI: tiers[num(args.tierId)]?.metadataURI || "" };
    } catch {
      return { metadataURI: "" }; // metadata hạng vé là tuỳ chọn
    }
  },
};

const handlers = {
  async EventCreated(tx, args, ctx) {
    const eventId = num(args.eventId);
    // Một số trường (venue, maxPerWallet, ...) không có trong event → đã đọc ở prefetch
    const { info } = ctx.extra;
    await tx.event.create({
      data: {
        id: eventId,
        organizer: lc(args.organizer),
        name: args.name,
        venue: info.venue,
        startTime: new Date(num(args.startTime) * 1000),
        metadataURI: args.metadataURI,
        maxPerWallet: num(info.maxPerWallet),
        resaleCapPercent: num(info.resaleCapPercent),
        createdTx: ctx.txHash,
        createdAt: ctx.timestamp,
      },
    });
    ctx.afterCommit.push({ type: "fetchEventMetadata", eventId, uri: args.metadataURI });
    return { type: "EVENT_CREATED", eventId, from: lc(args.organizer) };
  },

  async TierCreated(tx, args, ctx) {
    const eventId = num(args.eventId);
    const tierIndex = num(args.tierId);
    const { metadataURI } = ctx.extra;
    await tx.tier.create({
      data: {
        eventId,
        tierIndex,
        name: args.name,
        price: wei(args.price),
        supply: num(args.supply),
        metadataURI,
      },
    });
    return { type: "TIER_CREATED", eventId, amount: wei(args.price) };
  },

  async EventCancelled(tx, args) {
    const eventId = num(args.eventId);
    await tx.event.update({ where: { id: eventId }, data: { cancelled: true } });
    return { type: "EVENT_CANCELLED", eventId };
  },

  async StaffUpdated(tx, args) {
    const eventId = num(args.eventId);
    const address = lc(args.staff);
    if (args.allowed) {
      await tx.staff.upsert({
        where: { eventId_address: { eventId, address } },
        create: { eventId, address },
        update: {},
      });
    } else {
      await tx.staff.deleteMany({ where: { eventId, address } });
    }
    return { type: "STAFF_UPDATED", eventId, to: address };
  },

  async TicketPurchased(tx, args, ctx) {
    const tokenId = num(args.tokenId);
    const eventId = num(args.eventId);
    const tierIndex = num(args.tierId);
    await tx.ticket.create({
      data: {
        tokenId,
        eventId,
        tierIndex,
        owner: lc(args.buyer),
        pricePaid: wei(args.price),
        mintedAt: ctx.timestamp,
      },
    });
    await tx.tier.update({
      where: { eventId_tierIndex: { eventId, tierIndex } },
      data: { sold: { increment: 1 } },
    });
    await tx.event.update({ where: { id: eventId }, data: { revenue: { increment: wei(args.price) } } });
    return { type: "PURCHASE", eventId, tokenId, to: lc(args.buyer), amount: wei(args.price) };
  },

  async TicketListed(tx, args) {
    const tokenId = num(args.tokenId);
    const t = await tx.ticket.update({
      where: { tokenId },
      data: { listed: true, listPrice: wei(args.price) },
    });
    return { type: "LISTED", eventId: t.eventId, tokenId, from: lc(args.seller), amount: wei(args.price) };
  },

  async ListingCancelled(tx, args) {
    const tokenId = num(args.tokenId);
    const t = await tx.ticket.update({ where: { tokenId }, data: { listed: false, listPrice: null } });
    return { type: "LISTING_CANCELLED", eventId: t.eventId, tokenId };
  },

  async TicketResold(tx, args) {
    const tokenId = num(args.tokenId);
    const t = await tx.ticket.update({
      where: { tokenId },
      data: { owner: lc(args.buyer), listed: false, listPrice: null },
    });
    return {
      type: "RESOLD",
      eventId: t.eventId,
      tokenId,
      from: lc(args.seller),
      to: lc(args.buyer),
      amount: wei(args.price),
    };
  },

  async TicketCheckedIn(tx, args) {
    const tokenId = num(args.tokenId);
    await tx.ticket.update({ where: { tokenId }, data: { used: true, listed: false, listPrice: null } });
    return { type: "CHECKED_IN", eventId: num(args.eventId), tokenId, from: lc(args.holder), to: lc(args.staff) };
  },

  async RefundClaimed(tx, args) {
    const tokenId = num(args.tokenId);
    const t = await tx.ticket.update({
      where: { tokenId },
      data: { burned: true, listed: false, listPrice: null },
    });
    await tx.event.update({ where: { id: t.eventId }, data: { revenue: { decrement: wei(args.amount) } } });
    return { type: "REFUNDED", eventId: t.eventId, tokenId, to: lc(args.holder), amount: wei(args.amount) };
  },

  async RevenueWithdrawn(tx, args) {
    const eventId = num(args.eventId);
    await tx.event.update({ where: { id: eventId }, data: { revenue: 0, withdrawn: true } });
    return { type: "WITHDRAWN", eventId, to: lc(args.organizer), amount: wei(args.amount) };
  },

  async RoleGranted(tx, args, ctx) {
    if (args.role !== ORGANIZER_ROLE) return null;
    const address = lc(args.account);
    await tx.organizer.upsert({ where: { address }, create: { address, grantedAt: ctx.timestamp }, update: {} });
    return { type: "ROLE_GRANTED", to: address, from: lc(args.sender) };
  },

  async RoleRevoked(tx, args) {
    if (args.role !== ORGANIZER_ROLE) return null;
    const address = lc(args.account);
    await tx.organizer.deleteMany({ where: { address } });
    return { type: "ROLE_REVOKED", to: address, from: lc(args.sender) };
  },
};

module.exports = { handlers, prefetch };
