# FairPass Frontend

React 19 + Vite + Tailwind CSS v4 + ethers v6 + motion. Icon dùng Font Awesome 7 Free, bộ Solid.
Đặc tả giao diện nằm ở [`design-system/fairpass/MASTER.md`](../design-system/fairpass/MASTER.md).

## Chạy local

```bash
# Ở thư mục gốc: chain + contract + dữ liệu mẫu
npx hardhat node
npm run deploy:local && npm run seed:local

# Backend (xem backend/README.md)
cd backend && npm run dev

# Frontend
cd frontend
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

## Cài MetaMask cho mạng local

1. MetaMask → **Add network manually**: RPC `http://127.0.0.1:8545`, Chain ID `31337`, Symbol `ETH`. Bạn cũng có thể bấm "Chuyển mạng" trên web để FairPass tự thêm mạng.
2. Import private key các tài khoản do `npx hardhat node` in ra:

| Tài khoản | Vai trò sau khi seed |
|---|---|
| #0 | Admin (+ organizer) |
| #1 | Ban tổ chức |
| #2, #3 | Khách A, B |
| #4 | Staff soát vé sự kiện 1 |

3. **Ví không có ETH?** Đây là tiền test, có 3 cách:
   - Trên web: menu ví (góc phải) → **Nhận 100 ETH test** (chỉ hiện ở mạng local).
   - Terminal: `npx hardhat faucet 0xĐịaChỉVí --network localhost`.
   - Import private key tài khoản Hardhat (mỗi tài khoản có sẵn 10.000 ETH).
   - Sepolia thì xin ETH miễn phí ở faucet testnet (Google Cloud Web3 Faucet, Alchemy Faucet…).
4. Nếu chạy lại `hardhat node`, MetaMask cần được xoá lịch sử giao dịch cũ, không thì báo lỗi nonce: **Settings → Advanced → Clear activity tab data**.

## Demo soát vé trên 1 laptop (5 giây)

MetaMask dùng **chung một tài khoản đang chọn cho mọi tab**, vì vậy:

- **Cách 1 (khuyên dùng):** 2 Chrome profile. Profile "Khách" import ví #3, profile "Soát vé" import ví #4.
  1. Ở cửa sổ Khách: **Vé của tôi** → **Hiện QR** → ký → **Sao chép mã kiểm tra**.
  2. Ở cửa sổ Soát vé: **Soát vé** → dán vào ô *Dán mã kiểm tra* → **HỢP LỆ** → **Xác nhận check-in**.
- **Cách 2 (một profile):** Copy ở tab Khách → đổi tài khoản MetaMask sang ví #4 → dán ở tab Soát vé. Mã đã chứa sẵn chữ ký nên vẫn hợp lệ trong 60 giây.

## Cấu trúc

```
src/
  lib/          config, contract, api, errors (dịch lỗi), checkin (mã FP1), icons, format
  hooks/        useWallet (MetaMask, quyền), useApi
  components/
    ui/         Icon, Button, TxButton, Badge, Card, Modal, Field, Toast, Feedback, AddressPill
    TicketCard, EventCard, QrModal, ResaleModal, QrScanner, RequireWallet, layout/
  pages/        Home, EventDetail, MyTickets, Marketplace, Organizer*, CheckIn, Admin
```
