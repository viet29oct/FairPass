# FairPass Backend

Express + PostgreSQL (Prisma) + ethers v6. Backend **không giữ private key và không ghi on-chain**, chỉ làm 2 việc:

1. **Indexer:** đọc event của contract `EventTicketNFT`, ghi vào PostgreSQL để FE truy vấn nhanh.
2. **Upload:** đẩy poster và metadata NFT lên IPFS (Pinata) để không lộ API key ra FE.

Mọi giao dịch (mua, bán lại, soát vé…) đi thẳng từ FE qua MetaMask tới contract.

## Chạy local

```bash
# 1. Chain + contract (ở thư mục gốc)
npx hardhat node
npm run deploy:local && npm run seed:local   # ghi ABI + địa chỉ vào backend/src/contracts

# 2. Database: dùng Postgres có sẵn, hoặc `docker compose up -d` (cổng 5433)
cd backend
cp .env.example .env        # sửa DATABASE_URL
npm install
npm run db:deploy           # tạo bảng (dùng `npm run db:migrate` khi sửa schema)

# 3. Chạy
npm run dev                 # API: http://localhost:4000/api
node scripts/e2e-smoke.js   # smoke test end-to-end (chạy trên chain local mới seed)
```

Khi chạy lại `hardhat node` và deploy lại, indexer tự phát hiện chain mới, xoá dữ liệu cũ và index lại từ đầu.
Chưa có `PINATA_JWT` thì file được lưu ở `backend/uploads/` (chế độ local).

## Sepolia

Trong `.env` đặt `RPC_URL` là URL Alchemy/Infura, `CHAIN_ID=11155111`, `CONFIRMATIONS=2`. Nếu RPC giới hạn `eth_getLogs` thì giảm `LOG_CHUNK_SIZE`.
Địa chỉ contract và block deploy được lấy từ `src/contracts/addresses.json`, file này do `npm run deploy:sepolia` ghi ra.

## API

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/health` | Trạng thái indexer |
| GET | `/api/events?status=upcoming\|past\|cancelled\|all&organizer=&q=` | Danh sách sự kiện |
| GET | `/api/events/:id` | Chi tiết, các hạng vé, staff |
| GET | `/api/events/:id/stats` | Đã bán / đã soát / hoàn tiền / bán lại |
| GET | `/api/tickets/:tokenId` | Vé, giá trần bán lại, lịch sử |
| GET | `/api/users/:address/tickets` | Vé đang giữ |
| GET | `/api/users/:address/roles` | Admin/organizer (đọc từ chain), sự kiện được làm staff |
| GET | `/api/listings?eventId=` | Vé đang rao bán lại |
| GET | `/api/activity?eventId=&tokenId=&address=&type=` | Lịch sử giao dịch |
| GET | `/api/organizers` | Danh sách ví organizer |
| GET | `/api/auth/nonce?address=` | Message để ví ký |
| POST | `/api/auth/verify` | `{address, signature}` → token (kiểm tra ORGANIZER_ROLE on-chain) |
| POST | `/api/upload/event` | (organizer) multipart `poster` + `data` → `{imageURI, eventURI, tierURIs}` |

Số tiền (wei) trả về dạng chuỗi.
