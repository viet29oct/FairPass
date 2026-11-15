/**
 * E2E FairPass — đi trọn kịch bản trong docs/DEMO.md trên trình duyệt thật.
 * Mỗi vai trò = 1 browser context riêng (giống 1 Chrome profile) với ví giả lập (e2e/wallet.js).
 * Test tự tạo sự kiện riêng nên chạy được trên chain đã có dữ liệu.
 */
import { test, expect } from "@playwright/test";
import { Interface, formatEther } from "ethers";
import abi from "../src/contracts/EventTicketNFT.abi.json" with { type: "json" };
import addresses from "../src/contracts/addresses.json" with { type: "json" };
import { ACCOUNTS, rpc, walletContext } from "./wallet.js";

test.describe.configure({ mode: "serial" });

const CONTRACT = addresses["31337"].address;
const iface = new Interface(abi);
const RUN = Date.now().toString(36).slice(-4).toUpperCase();
const EVENT_A = `E2E Demo ${RUN}`;
const EVENT_B = `E2E Huỷ ${RUN}`;
const SHOTS = "e2e/screenshots";
// 1x1 PNG
const POSTER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

/** Lỗi JS phát sinh trong trang (không tính lỗi giao dịch được app log có chủ đích) */
const pageErrors = [];
const s = {}; // trạng thái chia sẻ giữa các bước
let ctx = {};
let pages = {};

// ───────────────────────── helpers ─────────────────────────

const toast = (page, text) => page.locator('[role="status"], [role="alert"]').filter({ hasText: text }).first();
const errorToast = (page, text) => page.getByRole("alert").filter({ hasText: text }).first();

function localDateTime(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const balanceOf = async (addr) => BigInt(await rpc("eth_getBalance", [addr, "latest"]));
const isPaused = async () =>
  iface.decodeFunctionResult("paused", await rpc("eth_call", [{ to: CONTRACT, data: iface.encodeFunctionData("paused") }, "latest"]))[0];

function watch(page, role) {
  page.on("pageerror", (e) => pageErrors.push(`[${role}] ${e.message}`));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    if (/\[FairPass\] lỗi giao dịch|Failed to load resource|favicon/i.test(t)) return;
    pageErrors.push(`[${role}] console: ${t}`);
  });
  return page;
}

async function createEvent(page, { name, start, maxPerWallet = "2" }) {
  await page.goto("/organizer/new");
  await page.getByLabel("Tên sự kiện").fill(name);
  await page.getByLabel("Mô tả").fill("Sự kiện được tạo tự động bởi Playwright E2E");
  await page.getByLabel("Địa điểm").fill("Phòng bảo vệ");
  await page.getByLabel("Thời gian bắt đầu").fill(localDateTime(start));
  await page.locator('input[type="file"]').setInputFiles({ name: "poster.png", mimeType: "image/png", buffer: POSTER });
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await page.getByLabel("Giá (ETH)").nth(0).fill("0.05");
  await page.getByLabel("Số lượng").nth(0).fill("5");
  await page.getByLabel("Giá (ETH)").nth(1).fill("0.01");
  await page.getByLabel("Số lượng").nth(1).fill("20");
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await page.getByLabel("Giới hạn vé mỗi ví").fill(maxPerWallet);
  await page.getByRole("button", { name: "Tạo sự kiện" }).click();
  await page.waitForURL(/\/organizer\/events\/\d+$/, { timeout: 60_000 });
  return Number(page.url().match(/(\d+)$/)[1]);
}

// ───────────────────────── setup ─────────────────────────

test.beforeAll(async ({ browser }) => {
  const health = await fetch("http://localhost:4000/api/health").then((r) => r.json());
  expect(health.ok, "Backend phải đang chạy").toBe(true);
  for (const [role, addr] of Object.entries(ACCOUNTS)) {
    ctx[role] = await walletContext(browser, addr);
    pages[role] = watch(await ctx[role].newPage(), role);
  }
  ctx.guest = await browser.newContext(); // không có ví
  pages.guest = watch(await ctx.guest.newPage(), "guest");
});

test.afterAll(async () => {
  // Dọn dẹp: không để hệ thống ở trạng thái tạm dừng nếu test hỏng giữa chừng
  if (await isPaused().catch(() => false)) {
    await rpc("eth_sendTransaction", [{ from: ACCOUNTS.admin, to: CONTRACT, data: iface.encodeFunctionData("unpause") }]);
  }
  for (const c of Object.values(ctx)) await c.close();
});

// ───────────────────────── kịch bản ─────────────────────────

test("0. Trang chủ — khách chưa có ví", async () => {
  const page = pages.guest;
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Vé chính chủ/ })).toBeVisible();
  await expect(page.getByText("Xác thực on-chain")).toBeVisible();
  await expect(page.getByRole("link", { name: /Đêm nhạc FairPass 2026/ }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Cài MetaMask" })).toBeVisible();
  await page.goto("/my-tickets");
  await expect(page.getByText("Cần ví MetaMask")).toBeVisible();
  await page.goto("/").then(() => page.screenshot({ path: `${SHOTS}/00-home.png` }));
});

test("0b. Menu hiện theo vai trò", async () => {
  const nav = (p) => p.getByRole("navigation", { name: "Điều hướng chính" });
  await pages.admin.goto("/");
  await expect(nav(pages.admin).getByRole("link", { name: "Quản trị" })).toBeVisible();
  await expect(nav(pages.admin).getByRole("link", { name: "Tổ chức" })).toBeVisible();
  await pages.staff.goto("/");
  await expect(nav(pages.staff).getByRole("link", { name: "Soát vé" })).toBeVisible();
  await expect(nav(pages.staff).getByRole("link", { name: "Quản trị" })).toHaveCount(0);
  await pages.outsider.goto("/");
  await expect(nav(pages.outsider).getByRole("link", { name: "Vé của tôi" })).toBeVisible();
  await expect(nav(pages.outsider).getByRole("link", { name: "Tổ chức" })).toHaveCount(0);
});

test("1. Quản trị — cấp & thu hồi ORGANIZER_ROLE", async () => {
  const page = pages.admin;
  await page.goto("/admin");
  const input = page.getByLabel("Cấp quyền ban tổ chức cho ví");
  await input.fill("0x123");
  await input.blur();
  await expect(page.getByText("Địa chỉ ví không hợp lệ")).toBeVisible();

  await input.fill(ACCOUNTS.outsider);
  await page.getByRole("button", { name: "Cấp quyền ORGANIZER" }).click();
  await expect(toast(page, "Đã cấp quyền")).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: "0x2361" });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Thu hồi" }).click();
  await expect(toast(page, "Đã thu hồi")).toBeVisible();
  await expect(page.getByRole("listitem").filter({ hasText: "0x2361" })).toHaveCount(0);
});

test("2. Ban tổ chức — tạo sự kiện 3 bước + thêm staff", async () => {
  const page = pages.organizer;
  // Sự kiện A bắt đầu sau ~3 phút để cuối bài test rút được doanh thu
  const start = new Date(Date.now() + 3 * 60_000);
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1);
  s.startA = start;

  // Kiểm tra validate: bước 1 để trống → không qua được
  await page.goto("/organizer/new");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByText("Nhập tên sự kiện")).toBeVisible();

  s.eventA = await createEvent(page, { name: EVENT_A, start });
  await expect(page.getByRole("heading", { name: EVENT_A })).toBeVisible();
  await expect(page.getByText("Đang bán vé")).toBeVisible();

  await page.getByLabel("Thêm staff").fill(ACCOUNTS.staff);
  await page.getByRole("button", { name: "Thêm staff" }).click();
  await expect(toast(page, "Đã thêm staff")).toBeVisible();
  await expect(page.getByText("0x15d3…6a65")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/02-organizer-event.png`, fullPage: true });
});

test("3. Khách mua vé + giới hạn vé/ví", async () => {
  const page = pages.buyer1;
  await page.goto(`/events/${s.eventA}`);
  await expect(page.getByRole("heading", { name: EVENT_A })).toBeVisible();
  await page.getByRole("radio", { name: /Thường/ }).click();
  await page.getByRole("button", { name: "Tăng" }).click();
  await page.getByRole("button", { name: /Mua 2 vé/ }).click();
  await expect(toast(page, "Mua vé thành công")).toBeVisible();
  await expect(page.getByText("Bạn đã đạt giới hạn 2 vé/ví")).toBeVisible();

  await page.goto("/my-tickets");
  const cards = page.getByRole("article").filter({ hasText: EVENT_A });
  await expect(cards).toHaveCount(2);
  // Hover → hiệu ứng nghiêng + hologram
  const box = await cards.first().boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.35, { steps: 5 });
  await expect(cards.first()).toHaveAttribute("data-hover", "true");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/03-my-tickets-hover.png` });
});

test("4. Bán lại — chặn vượt giá trần, rao 110%", async () => {
  const page = pages.buyer1;
  await page.goto("/my-tickets");
  await page.getByRole("article").filter({ hasText: EVENT_A }).first().getByRole("button", { name: "Bán lại" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Giá bán (ETH)").fill("0.012");
  await expect(dialog.getByText(/Vượt giá trần 110%/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Rao bán" })).toBeDisabled();
  await page.screenshot({ path: `${SHOTS}/04-resale-over-cap.png` });

  await dialog.getByRole("button", { name: "110%" }).click();
  await dialog.getByRole("button", { name: "Rao bán" }).click();
  await expect(toast(page, "Đã rao bán")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: EVENT_A }).filter({ hasText: "Đang rao bán" })).toHaveCount(1);
});

test("5. Chợ bán lại — ví khác mua lại, tiền về người bán", async () => {
  const page = pages.buyer2;
  const sellerBefore = await balanceOf(ACCOUNTS.buyer1);
  await page.goto(`/marketplace?eventId=${s.eventA}`);
  await expect(page.getByText("0,011 ETH").first()).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/05-marketplace.png` });
  await page.getByRole("button", { name: /Mua lại · 0,011 ETH/ }).click();
  await expect(toast(page, "Mua lại thành công")).toBeVisible();
  const sellerAfter = await balanceOf(ACCOUNTS.buyer1);
  expect(sellerAfter - sellerBefore).toBe(11_000_000_000_000_000n); // 0.011 ETH đi thẳng tới người bán

  await page.goto("/my-tickets");
  await expect(page.getByRole("article").filter({ hasText: EVENT_A })).toHaveCount(1);
});

test("6. QR động — ký, đếm ngược, sao chép mã kiểm tra", async () => {
  const page = pages.buyer2;
  await page.goto("/my-tickets");
  await page.getByRole("article").filter({ hasText: EVENT_A }).getByRole("button", { name: "Hiện QR" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Mã QR động đang hoạt động")).toBeVisible();
  await expect(dialog.locator("svg[role='img'], svg title").first()).toBeAttached();
  await expect(dialog.getByText(/^\d{1,2}s$/)).toBeVisible();
  await page.waitForTimeout(800); // chờ hiệu ứng lật QR (250ms) xong rồi mới chụp
  await page.screenshot({ path: `${SHOTS}/06-qr-modal.png` });

  await dialog.getByRole("button", { name: "Sao chép mã kiểm tra" }).click();
  await expect(dialog.getByText("Đã chép mã kiểm tra")).toBeVisible();
  s.code = await page.evaluate(() => navigator.clipboard.readText());
  expect(s.code).toMatch(/^FP1\.31337\.\d+\.\d+\.0x[0-9a-f]{130}$/);
  await page.keyboard.press("Escape");
});

test("7. Soát vé — dán mã → HỢP LỆ → check-in", async () => {
  const page = pages.staff;
  await page.goto("/checkin");
  await page.getByLabel("Sự kiện đang soát").selectOption(String(s.eventA));
  await page.getByLabel("Dán mã kiểm tra").fill(s.code);
  await page.getByRole("button", { name: "Kiểm tra" }).click();
  await expect(page.getByText("HỢP LỆ", { exact: true })).toBeVisible();
  for (const label of ["Chữ ký số của chủ vé", "Mã QR còn hạn", "Vé chưa được sử dụng", "Đúng sự kiện đang soát", "Ví bạn có quyền soát vé"]) {
    await expect(page.getByText(label)).toBeVisible();
  }
  await page.screenshot({ path: `${SHOTS}/07-checkin-valid.png` });

  await page.getByRole("button", { name: /Xác nhận check-in/ }).click();
  await expect(toast(page, "Đã soát vé")).toBeVisible();
  await expect(page.getByText("ĐÃ CHECK-IN")).toBeVisible();
});

test("8. Soát vé — các trường hợp bị từ chối", async () => {
  const page = pages.staff;
  const check = async (code, eventId) => {
    const next = page.getByRole("button", { name: /Soát vé tiếp theo|Quét vé khác/ });
    if (await next.count()) await next.click();
    await page.getByLabel("Sự kiện đang soát").selectOption(String(eventId));
    await page.getByLabel("Dán mã kiểm tra").fill(code);
    await page.getByRole("button", { name: "Kiểm tra" }).click();
    await expect(page.getByText("KHÔNG HỢP LỆ")).toBeVisible();
  };

  // Dùng lại vé đã soát
  await check(s.code, s.eventA);
  await expect(page.getByText("Vé đã được soát trước đó")).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/08-checkin-reused.png` });

  // Sai sự kiện (staff #4 cũng soát sự kiện 1)
  await check(s.code, 1);
  await expect(page.getByText(/Vé thuộc sự kiện khác/)).toBeVisible();

  // Sửa chữ ký
  const tampered = s.code.slice(0, -8) + (s.code.endsWith("1b") ? "deadbe1c" : "deadbe1b");
  await check(tampered, s.eventA);
  await expect(page.getByText("Người ký không phải chủ vé hiện tại")).toBeVisible();

  // Sai định dạng
  await check("FP1.31337.abc", s.eventA);
  await expect(page.getByText("Mã kiểm tra không đúng định dạng FairPass")).toBeVisible();
});

test("9. Vé đã soát có con dấu ĐÃ SOÁT", async () => {
  const page = pages.buyer2;
  await page.goto("/my-tickets");
  await page.getByRole("tab", { name: "Tất cả" }).click();
  const card = page.getByRole("article").filter({ hasText: EVENT_A });
  await expect(card.getByText("Đã soát", { exact: true })).toBeVisible();
  await expect(card).toHaveAttribute("data-used", "true");
  await page.screenshot({ path: `${SHOTS}/09-ticket-used-stamp.png` });
});

test("10. Huỷ sự kiện → người giữ vé tự hoàn tiền (burn vé)", async () => {
  const org = pages.organizer;
  const buyer = pages.buyer3;
  s.eventB = await createEvent(org, { name: EVENT_B, start: new Date(Date.now() + 24 * 3600_000) });

  await buyer.goto(`/events/${s.eventB}`);
  await buyer.getByRole("radio", { name: /VIP/ }).click();
  await buyer.getByRole("button", { name: /Mua 1 vé/ }).click();
  await expect(toast(buyer, "Mua vé thành công")).toBeVisible();

  await org.goto(`/organizer/events/${s.eventB}`);
  await org.getByRole("button", { name: "Huỷ sự kiện…" }).click();
  const dialog = org.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Huỷ sự kiện", exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/để xác nhận/).fill(EVENT_B);
  await confirm.click();
  await expect(toast(org, "Đã huỷ")).toBeVisible();

  await buyer.goto("/my-tickets");
  const card = buyer.getByRole("article").filter({ hasText: EVENT_B });
  await expect(card.getByText("Sự kiện bị huỷ")).toBeVisible();
  const before = await balanceOf(ACCOUNTS.buyer3);
  await card.getByRole("button", { name: "Hoàn tiền" }).click();
  await expect(toast(buyer, "Đã hoàn tiền gốc về ví")).toBeVisible();
  const after = await balanceOf(ACCOUNTS.buyer3);
  expect(after - before > 49_000_000_000_000_000n, `Hoàn ~0.05 ETH, thực nhận ${formatEther(after - before)}`).toBe(true);
  await expect(buyer.getByRole("article").filter({ hasText: EVENT_B })).toHaveCount(0);
});

test("11. Dừng khẩn cấp — chặn mua vé, banner cảnh báo", async () => {
  const admin = pages.admin;
  const buyer = pages.buyer3;
  await admin.goto("/admin");
  await admin.getByRole("button", { name: "Tạm dừng hệ thống" }).click();
  await expect(toast(admin, "Đã tạm dừng")).toBeVisible();

  await buyer.goto("/events/1");
  await expect(buyer.getByText(/tạm dừng khẩn cấp/).first()).toBeVisible();
  await buyer.getByRole("button", { name: /Mua 1 vé/ }).click();
  await expect(errorToast(buyer, "Hệ thống đang tạm dừng khẩn cấp")).toBeVisible();
  await buyer.screenshot({ path: `${SHOTS}/11-paused.png` });

  await admin.getByRole("button", { name: "Mở lại hệ thống" }).click();
  await expect(toast(admin, "Đã mở lại")).toBeVisible();
  expect(await isPaused()).toBe(false);
});

test("12. Ví không đủ ETH — báo rõ + nạp ETH test", async () => {
  const page = pages.outsider;
  const saved = await rpc("eth_getBalance", [ACCOUNTS.outsider, "latest"]);
  await rpc("hardhat_setBalance", [ACCOUNTS.outsider, "0x0"]);
  try {
    await page.goto("/events/1");
    await expect(page.getByText("Ví không đủ ETH")).toBeVisible();
    await page.getByRole("button", { name: "Nhận 100 ETH test" }).click();
    await expect(toast(page, "Đã nạp 100 ETH test")).toBeVisible();
    await expect(page.getByRole("button", { name: /Mua 1 vé/ })).toBeVisible();
  } finally {
    await rpc("hardhat_setBalance", [ACCOUNTS.outsider, saved]);
  }
});

test("13. Rút doanh thu sau giờ diễn (escrow)", async () => {
  const page = pages.organizer;
  await page.goto(`/organizer/events/${s.eventA}`);
  await expect(page.getByRole("button", { name: /^Rút / })).toBeDisabled();
  await expect(page.getByText(/Mở khoá lúc/)).toBeVisible();

  const wait = s.startA.getTime() - Date.now() + 5_000;
  if (wait > 0) await page.waitForTimeout(wait);
  // Có block mới để block.timestamp ≥ startTime
  await rpc("evm_mine");

  await page.reload();
  await page.getByRole("button", { name: /^Rút 0,02 ETH/ }).click();
  await expect(toast(page, "Đã rút doanh thu")).toBeVisible();
  await expect(page.getByText("Đã rút doanh thu").first()).toBeVisible();

  await pages.buyer1.goto(`/events/${s.eventA}`);
  await expect(pages.buyer1.getByText("Sự kiện đã bắt đầu — ngừng bán vé")).toBeVisible();
});

test("14. Không có lỗi JavaScript trong suốt phiên test", async () => {
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});
