# FairPass — Tiến độ dự án

> Cập nhật: **15/11/2026** · Nhánh: `dev` · Kế hoạch: 6 tuần, 1 người (hạn dự kiến cuối 12/2026)

## Tổng quan

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Smart contract | ✅ Xong | `contracts/EventTicketNFT.sol` (560 dòng) · 48 test · 100% dòng / ~89% nhánh |
| Backend | ✅ Xong | Indexer + REST API + đăng nhập ví + upload IPFS · smoke test 12 bước |
| Frontend | ✅ Xong | 9 trang, 15 component có animation · E2E Playwright 16/16 |
| Tài liệu demo | ✅ Xong | `docs/DEMO.md` |
| Deploy Sepolia + verify Etherscan | ⏳ Chưa làm | Cần `SEPOLIA_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `ETHERSCAN_API_KEY` |
| IPFS thật (Pinata) | ⏳ Chưa cấu hình | Đang chạy chế độ local (`backend/uploads`); cần `PINATA_JWT` |
| Báo cáo đồ án (3 khối) + sơ đồ | ⏳ Chưa làm | Dàn ý ở mục "Việc tiếp theo" |

**So với lộ trình 6 tuần:** đã xong khối lượng của tuần 1–5 (contract, backend, frontend). Còn lại tuần 6: Sepolia, báo cáo và tập demo.

---

## Đã hoàn thành

### 1. Smart contract — `contracts/EventTicketNFT.sol`
ERC-721 + AccessControl + ReentrancyGuard + Pausable + EIP-712 (OpenZeppelin 5).
- **Sự kiện nhiều hạng vé** (tối đa 10), vai trò Admin → Organizer → Staff theo từng sự kiện.
- **Chống đầu cơ:**
  - giới hạn vé/ví, tính cả mua sơ cấp lẫn số vé đang giữ
  - giá trần bán lại theo % giá gốc
  - **chặn chuyển nhượng tự do**: `transferFrom` và `approve` đều revert `TransfersDisabled`
- **Chống vé giả:** check-in bằng chữ ký EIP-712 `CheckIn(tokenId, deadline)`, mã có hạn ≤ 10 phút, vé chỉ soát được một lần.
- **Escrow:** tiền vé nằm trong contract tới giờ diễn. Huỷ sự kiện thì người giữ vé tự claim refund (pull payment) và vé bị burn.
- **Custom errors** cho mọi nhánh revert, kèm event đầy đủ cho indexer.
- Script: `deploy.js` (ghi `deployments/` và export ABI cho FE/BE), `seed.js`, `export-abi.js`, task `npx hardhat faucet`.

### 2. Backend — `backend/` (Express 5 + Prisma 6 + PostgreSQL + ethers 6)
- **Indexer:** quét log theo từng khoảng block.
  - Idempotent theo `(txHash, logIndex)`, nên chạy lại không bị cộng trùng.
  - Đọc RPC **ngoài** transaction DB.
  - Tự reset khi phát hiện chain mới.
- **REST API chỉ đọc:** events, stats, tickets, listings, activity, organizers, `users/:addr/roles` (có `checkinEvents`).
- **Đăng nhập ví:** nonce → ký → kiểm tra `ORGANIZER_ROLE` trên chain → JWT. Upload poster và metadata ERC-721 lên Pinata (có chế độ local).
- **Chịu lỗi kết nối:** tự thử lại khi Postgres chập chờn (Prisma extension).
- `scripts/e2e-smoke.js`: 12 bước kiểm tra chain ↔ indexer ↔ API.

### 3. Frontend — `frontend/` (React 19 + Vite 8 + Tailwind 4 + ethers 6 + motion)
- Design system đã duyệt: `design-system/fairpass/MASTER.md`. Tông tối, primary cyan `#06B6D4`, icon Font Awesome 7 Solid, font Be Vietnam Pro.
- **`useWallet`** tự viết:
  - kết nối, đổi và thêm mạng, đọc quyền của ví, hiện số dư
  - nạp ETH test (mạng local)
  - tự xin lại quyền khi MetaMask báo lỗi 4100
- **TxButton:** 4–6 trạng thái có animation; dịch mọi lỗi ví và contract sang tiếng Việt, kể cả lỗi "could not coalesce".
- **Các trang:** Trang chủ, Chi tiết sự kiện, Vé của tôi, Chợ bán lại, Tổ chức (danh sách, tạo mới 3 bước, quản lý sự kiện), Soát vé, Quản trị.
- **Hiệu ứng:**
  - TicketCard: nghiêng 3D, dải hologram, cuống vé tách ra, con dấu "ĐÃ SOÁT"
  - Modal QR: vòng đếm ngược, live pulse, lật QR, nút **Sao chép mã kiểm tra**
  - Trang soát vé: tia quét, khối kết quả bung ra
  - Tôn trọng `prefers-reduced-motion`
- **E2E Playwright** (`frontend/e2e/`): ví giả lập EIP-1193, 16 bước bám theo kịch bản trong DEMO.md.

### 4. Lỗi đã phát hiện & sửa trong quá trình test
| Lỗi | Phát hiện bởi | Sửa |
|---|---|---|
| `getEvent` trùng tên hàm của ethers v6; thiếu `evmVersion: cancun` | Chạy test contract | Đổi tên `getEventInfo`; thêm cấu hình |
| `useEffect` trả về Promise của `scrollTo()` → "destroy is not a function" | Người dùng | Bọc effect trong ngoặc nhọn; thêm trang báo lỗi cho router |
| "could not coalesce error" khi ví 0 ETH | Người dùng | Duyệt toàn bộ lỗi lồng nhau; kiểm tra số dư trước khi mua; nạp ETH test |
| MetaMask 4100 "not authorized" | Người dùng | `reauthorize` rồi thử lại 1 lần |
| Form tạo sự kiện không hiện lỗi validate | E2E Playwright | Tra lỗi theo đúng nhóm |
| Indexer gọi RPC trong transaction DB → hết hạn, API 500 | E2E Playwright | Đọc chain trước khi mở transaction (prefetch) |
| Postgres/RPC chập chờn → 500 | E2E Playwright | Tự thử lại ở cả BE và FE; host `127.0.0.1` |

---

## Cách chạy & kiểm thử
Xem chi tiết trong [`docs/DEMO.md`](./DEMO.md).

```bash
npx hardhat test                    # 48 test contract
cd backend  && node scripts/e2e-smoke.js   # 12 bước chain ↔ indexer ↔ API (thêm dữ liệu)
cd frontend && npm run test:e2e     # 16 bước giao diện (thêm dữ liệu)
```

---

## Việc tiếp theo (tuần 6)

1. **Deploy Sepolia**
   - Điền `.env` gốc, chạy `npm run deploy:sepolia` (tự verify Etherscan).
   - Backend: `RPC_URL` (Alchemy/Infura), `CHAIN_ID=11155111`, `CONFIRMATIONS=2`.
   - Frontend: `VITE_CHAIN_ID=11155111`, `VITE_RPC_URL`.
   - Xin ETH Sepolia từ faucet cho các ví demo.
2. **Pinata:** tạo JWT, điền `PINATA_JWT`, test lại luồng tạo sự kiện để metadata lên IPFS thật.
3. **Báo cáo** (`docs/`):
   - **Khối Cơ sở lý thuyết & Nền tảng công nghệ:** blockchain, EVM, smart contract, ERC-721, ECDSA/EIP-712, IPFS, Hardhat/ethers/OpenZeppelin, MetaMask.
   - **Khối Định hướng nghiên cứu & Đặt vấn đề:** vé giả, phe vé, các giải pháp hiện có, mục tiêu và phạm vi.
   - **Khối Thiết kế kỹ thuật & Kiến trúc:** sơ đồ kiến trúc, use case, state diagram của vé, sequence (mua, bán lại, check-in, huỷ/hoàn tiền), cơ chế bảo mật, ERD, kết quả test, gas report.
4. **Tuỳ chọn:**
   - Tách nhỏ bundle FE (khoảng 970KB, chủ yếu là ethers).
   - Nút "Quét từ ảnh" ở trang Soát vé.
   - Chạy Slither.
   - Tách tài khoản admin và organizer khi deploy thật.

## Ghi chú kỹ thuật
- Người mua lại vé chỉ được hoàn **giá gốc sơ cấp** khi sự kiện bị huỷ; phần chênh lệch đã trả cho người bán thì không được hoàn. Nên nêu trong báo cáo.
- Organizer bị thu hồi quyền vẫn quản lý được sự kiện cũ (contract kiểm tra theo organizer của từng sự kiện, không theo role).
- Làm mới QR luôn cần một lần ký trên MetaMask (DApp không ký ngầm được).
