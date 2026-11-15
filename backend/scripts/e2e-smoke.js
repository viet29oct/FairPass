/**
 * Smoke test end-to-end: chain local ↔ indexer ↔ REST API.
 * Yêu cầu: `npx hardhat node` + deploy.js + seed.js + backend đang chạy.
 *   node scripts/e2e-smoke.js
 *
 * Tài khoản Hardhat: #1 organizer, #2 buyer A, #3 buyer B, #4 staff, #5 buyer C, #6 người ngoài
 */
require("dotenv").config();
const assert = require("node:assert/strict");
const { ethers } = require("ethers");
const config = require("../src/config");

const API = `http://localhost:${config.port}/api`;
const provider = new ethers.JsonRpcProvider(config.rpcUrl, config.chainId, { staticNetwork: true });
// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed++;
  console.log(`  ✔ ${name}`);
};

async function api(path, opts) {
  const res = await fetch(API + path, opts);
  const body = await res.json();
  return { status: res.status, body };
}

/** Chờ indexer theo kịp block chứa giao dịch cuối */
async function waitIndexed(blockNumber) {
  for (let i = 0; i < 60; i++) {
    const { body } = await api("/health");
    if (body.indexer.lastBlock >= blockNumber) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Indexer chưa tới block ${blockNumber}`);
}

const send = async (txPromise) => (await txPromise).wait();

async function login(signer) {
  const address = await signer.getAddress();
  const { body } = await api(`/auth/nonce?address=${address}`);
  const signature = await signer.signMessage(body.message);
  return api("/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address, signature }),
  });
}

async function signCheckIn(signer, tokenId, deadline) {
  return signer.signTypedData(
    { name: "FairPass", version: "1", chainId: config.chainId, verifyingContract: config.contractAddress },
    { CheckIn: [{ name: "tokenId", type: "uint256" }, { name: "deadline", type: "uint256" }] },
    { tokenId, deadline }
  );
}

async function main() {
  const [organizer, buyerA, buyerB, staff, buyerC, outsider] = await Promise.all(
    [1, 2, 3, 4, 5, 6].map((i) => provider.getSigner(i))
  );
  const nft = new ethers.Contract(config.contractAddress, config.abi, provider);
  const as = (s) => nft.connect(s);
  const addr = async (s) => (await s.getAddress()).toLowerCase();

  console.log("🔐 Đăng nhập ví & upload");
  let token;
  await step("organizer đăng nhập bằng chữ ký ví", async () => {
    const { status, body } = await login(organizer);
    assert.equal(status, 200);
    assert.equal(body.isOrganizer, true);
    token = body.token;
  });
  await step("ví thường đăng nhập được nhưng upload bị 403, không token bị 401", async () => {
    const { body } = await login(outsider);
    assert.equal(body.isOrganizer, false);
    const res403 = await fetch(`${API}/upload/event`, { method: "POST", headers: { Authorization: `Bearer ${body.token}` } });
    assert.equal(res403.status, 403);
    const res401 = await fetch(`${API}/upload/event`, { method: "POST" });
    assert.equal(res401.status, 401);
  });
  await step("nonce chỉ dùng được 1 lần", async () => {
    const address = await outsider.getAddress();
    const { body } = await api(`/auth/nonce?address=${address}`);
    const signature = await outsider.signMessage(body.message);
    const verify = () =>
      api("/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, signature }) });
    assert.equal((await verify()).status, 200);
    assert.equal((await verify()).status, 400);
  });

  const startTime = (await provider.getBlock("latest")).timestamp + 3 * 24 * 3600;
  let uris;
  await step("upload poster + metadata sự kiện và hạng vé", async () => {
    const form = new FormData();
    form.append("poster", new Blob([PNG], { type: "image/png" }), "poster.png");
    form.append(
      "data",
      JSON.stringify({ name: "Sự kiện thử nghiệm E2E", description: "Smoke test", venue: "Online", startTime, tiers: [{ name: "Chuẩn" }] })
    );
    const res = await fetch(`${API}/upload/event`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    uris = await res.json();
    assert.equal(res.status, 200, JSON.stringify(uris));
    assert.equal(uris.tierURIs.length, 1);
    const meta = await (await fetch(uris.tierURIs[0])).json();
    assert.equal(meta.name, "Sự kiện thử nghiệm E2E — Chuẩn");
  });

  console.log("⛓️  Giao dịch on-chain → indexer");
  const before = Number(await nft.totalEvents());
  const newEventId = before + 1;
  const price = ethers.parseEther("0.01");
  let last = await send(
    as(organizer).createEvent(
      { name: "Sự kiện thử nghiệm E2E", venue: "Online", startTime, metadataURI: uris.eventURI, maxPerWallet: 2, resaleCapPercent: 120 },
      [{ name: "Chuẩn", price, supply: 10, metadataURI: uris.tierURIs[0] }]
    )
  );

  // Bán lại: buyer A rao vé #1 (VIP seed), buyer C mua
  const cap = await nft.maxResalePrice(1);
  await send(as(buyerA).listForResale(1, cap));
  last = await send(as(buyerC).buyResale(1, { value: cap }));

  // Check-in: buyer B ký QR cho vé #2, staff quét
  const deadline = (await provider.getBlock("latest")).timestamp + 60;
  last = await send(as(staff).checkIn(2, deadline, await signCheckIn(buyerB, 2, deadline)));

  // Rao vé #3 để kiểm tra /listings
  last = await send(as(buyerB).listForResale(3, ethers.parseEther("0.02")));

  // Huỷ sự kiện mới → buyer A hoàn tiền
  const buyRc = await send(as(buyerA).buyTicket(newEventId, 0, 1, { value: price }));
  const refundTokenId = Number(buyRc.logs.map((l) => nft.interface.parseLog(l)).find((l) => l?.name === "TicketPurchased").args.tokenId);
  await send(as(organizer).cancelEvent(newEventId));
  last = await send(as(buyerA).claimRefund(refundTokenId));

  await waitIndexed(last.blockNumber);
  await new Promise((r) => setTimeout(r, 1500)); // chờ job tải metadata

  const [A, B, C, S] = await Promise.all([addr(buyerA), addr(buyerB), addr(buyerC), addr(staff)]);

  await step("bán lại: vé #1 đổi chủ sang C, có lịch sử LISTED → RESOLD", async () => {
    const { body } = await api("/tickets/1");
    assert.equal(body.owner, C);
    assert.equal(body.listed, false);
    const types = body.history.map((h) => h.type);
    assert.deepEqual(types.slice(-2), ["LISTED", "RESOLD"]);
    assert.equal(body.history.at(-1).amount, cap.toString());
  });
  await step("check-in: vé #2 used=true, ghi nhận staff", async () => {
    const { body } = await api("/tickets/2");
    assert.equal(body.used, true);
    assert.equal(body.history.at(-1).type, "CHECKED_IN");
    assert.equal(body.history.at(-1).to, S);
  });
  await step("/listings chỉ có vé #3 với giá trần đúng", async () => {
    const { body } = await api("/listings");
    assert.deepEqual(body.map((t) => t.tokenId), [3]);
    assert.equal(body[0].listPrice, ethers.parseEther("0.02").toString());
    assert.equal(body[0].maxResalePrice, ((ethers.parseEther("0.02") * 110n) / 100n).toString());
  });
  await step("huỷ + hoàn tiền: vé burned, doanh thu về 0, ẩn khỏi vé của A", async () => {
    const { body: evt } = await api(`/events/${newEventId}`);
    assert.equal(evt.cancelled, true);
    assert.equal(evt.revenue, "0");
    assert.ok(evt.image, "metadata/poster đã được tải về");
    const { body: tickets } = await api(`/users/${A}/tickets`);
    assert.ok(!tickets.some((t) => t.tokenId === refundTokenId));
    const { body: cancelled } = await api("/events?status=cancelled");
    assert.ok(cancelled.some((e) => e.id === newEventId));
  });
  await step("stats sự kiện #1", async () => {
    const { body } = await api("/events/1/stats");
    assert.equal(body.totalSold, 3);
    assert.equal(body.checkedIn, 1);
    assert.equal(body.resales, 1);
    assert.equal(body.listed, 1);
  });
  await step("roles: staff thấy sự kiện được soát, organizer đọc từ chain", async () => {
    const { body } = await api(`/users/${S}/roles`);
    assert.deepEqual(body.staffEventIds, [1]);
    assert.equal(body.isOrganizer, false);
    const { body: org } = await api(`/users/${await addr(organizer)}/roles`);
    assert.equal(org.isOrganizer, true);
  });

  await step("DB khớp chain: owner/used/listed của mọi vé", async () => {
    const owners = [A, B, C];
    for (const o of owners) {
      const { body } = await api(`/users/${o}/tickets`);
      for (const t of body) {
        assert.equal((await nft.ownerOf(t.tokenId)).toLowerCase(), o, `owner vé #${t.tokenId}`);
        const onchain = await nft.getTicket(t.tokenId);
        assert.equal(onchain.used, t.used, `used vé #${t.tokenId}`);
        const listing = await nft.getListing(t.tokenId);
        assert.equal(listing.seller !== ethers.ZeroAddress, t.listed, `listed vé #${t.tokenId}`);
      }
    }
  });
  await step("API báo lỗi đúng định dạng", async () => {
    assert.equal((await api("/events/9999")).status, 404);
    assert.equal((await api("/users/abc/tickets")).status, 400);
    assert.equal((await api("/events?status=xyz")).status, 400);
  });

  console.log(`\n✅ ${passed} bước smoke test đều qua`);
}

main().catch((err) => {
  console.error("\n❌ Smoke test thất bại:", err.message);
  process.exitCode = 1;
});
