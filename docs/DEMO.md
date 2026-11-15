# FairPass — Hướng dẫn chạy & demo sản phẩm từ A đến Z

> Tài liệu này giúp bạn tự cài đặt, chạy và trình diễn **toàn bộ** tính năng của FairPass trên **một laptop**, dùng mạng blockchain local (Hardhat).
> Thời lượng: cài đặt lần đầu khoảng 20 phút · chạy lại trước buổi demo khoảng 3 phút · kịch bản demo khoảng 12–15 phút.

---

## Mục lục
1. [Chuẩn bị phần mềm](#1-chuẩn-bị-phần-mềm-một-lần)
2. [Khởi động hệ thống (4 terminal)](#2-khởi-động-hệ-thống-4-terminal)
3. [Cài MetaMask & tài khoản test](#3-cài-metamask--tài-khoản-test)
4. [Kiểm tra nhanh trước demo](#4-kiểm-tra-nhanh-trước-demo-2-phút)
5. [Kịch bản demo chi tiết](#5-kịch-bản-demo-chi-tiết)
6. [Chứng minh bằng kiểm thử tự động](#6-chứng-minh-bằng-kiểm-thử-tự-động)
7. [Xử lý sự cố](#7-xử-lý-sự-cố)
8. [Reset dữ liệu sạch](#8-reset-dữ-liệu-sạch)
9. [Checklist trước buổi bảo vệ](#9-checklist-trước-buổi-bảo-vệ)

---

## 1. Chuẩn bị phần mềm (một lần)

| Phần mềm | Ghi chú |
|---|---|
| **Node.js 20+** | Máy đang dùng Node 24 |
| **PostgreSQL** | Dùng bản cài sẵn trên máy (cổng 5432) hoặc Docker (`docker compose up -d`, cổng 5433) |
| **Google Chrome** | Cần tạo **3 Chrome profile** (xem mục 3) |
| **MetaMask** | Cài tiện ích MetaMask trên **từng** Chrome profile |

Cài thư viện (chạy ở thư mục gốc dự án):

```bash
npm install
cd backend  && npm install && cd ..
cd frontend && npm install && cd ..
```

Tạo file cấu hình:

```bash
copy backend\.env.example backend\.env      # Windows (macOS/Linux: cp)
copy frontend\.env.example frontend\.env
```

Mở `backend/.env` và sửa dòng `DATABASE_URL` theo mật khẩu Postgres của bạn, ví dụ:

```
DATABASE_URL=postgresql://postgres:<MẬT_KHẨU>@localhost:5432/fairpass?schema=public
```

Tạo bảng trong database (Prisma tự tạo database `fairpass` nếu chưa có):

```bash
cd backend && npm run db:deploy && cd ..
```

---

## 2. Khởi động hệ thống (4 terminal)

Mở **4 cửa sổ terminal** ở thư mục gốc dự án và chạy **đúng thứ tự**:

| # | Terminal | Lệnh | Chờ tới khi thấy |
|---|---|---|---|
| ① | Blockchain | `npx hardhat node` | `Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/` |
| ② | Deploy | `npm run deploy:local` rồi `npm run seed:local` | `✅ Đã deploy tại: 0x…` và `🎟️ Buyer A mua 1 VIP…` |
| ③ | Backend | `cd backend` rồi `npm run dev` | `🚀 FairPass API: http://localhost:4000/api` và `📥 Block …: … log` |
| ④ | Frontend | `cd frontend` rồi `npm run dev` | `Local: http://localhost:5173/` |

> **Terminal ① phải chạy suốt buổi demo.** Tắt nó là toàn bộ dữ liệu blockchain mất; khi đó làm lại từ mục 8.
> Terminal ② chạy xong thì dùng tiếp cho các lệnh phụ (faucet, console…).

**Dữ liệu mẫu sau khi seed:**

| Sự kiện | Hạng vé | Quy định |
|---|---|---|
| **#1 Đêm nhạc FairPass 2026** (sau 14 ngày) | VIP 0.05 ETH × 20 · Thường 0.02 ETH × 100 | Tối đa 4 vé/ví · bán lại ≤ 110% |
| **#2 Hội thảo Blockchain Việt Nam** (sau 30 ngày) | Vé tham dự 0.01 ETH × 50 | Tối đa 2 vé/ví · bán lại ≤ 100% |

| Vé có sẵn | Chủ sở hữu |
|---|---|
| #0001 (VIP, sự kiện 1) | Khách A — tài khoản #2 |
| #0002, #0003 (Thường, sự kiện 1) | Khách B — tài khoản #3 |

Tài khoản #4 đã là **staff soát vé** của sự kiện 1.

---

## 3. Cài MetaMask & tài khoản test

### 3.1. Tạo 3 Chrome profile
Bấm avatar ở góc phải Chrome → **Add** → tạo 3 profile. Mỗi profile giữ một ví MetaMask riêng, nhờ vậy chuyển vai trò không cần đổi tài khoản liên tục:

| Profile | Mục đích | Import các tài khoản |
|---|---|---|
| 🟦 **Ban tổ chức** | Quản trị + tổ chức sự kiện | #0, #1 |
| 🟩 **Khách** | Người mua vé | #2, #3, #5 |
| 🟧 **Soát vé** | Nhân viên cổng | #4 |

### 3.2. Thêm mạng Hardhat Local vào MetaMask (làm ở từng profile)
MetaMask → menu mạng → **Add network** → **Add a network manually**:

| Trường | Giá trị |
|---|---|
| Network name | `Hardhat Local` |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |

> Có thể bỏ qua bước này: khi mở web ở mạng khác, bấm nút **"Chuyển sang Local"** trên banner vàng, FairPass sẽ tự thêm mạng.

### 3.3. Import tài khoản test
MetaMask → biểu tượng tài khoản → **Add account or hardware wallet** → **Import account** → dán private key.

> ⚠️ Đây là các key **mặc định công khai** của Hardhat (cũng được in ra ở terminal ①). Mọi người trên thế giới đều biết chúng, nên **tuyệt đối không gửi tiền thật** vào các địa chỉ này.

| # | Vai trò | Địa chỉ | Private key |
|---|---|---|---|
| 0 | Admin (+ organizer) | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` |
| 1 | Ban tổ chức | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` |
| 2 | Khách A | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` |
| 3 | Khách B | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` |
| 4 | Staff soát vé | `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` | `0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a` |
| 5 | Khách C (mới) | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba` |
| 6 | Ví dự phòng | `0x976EA74026E726554dB657fA54763abd0C3a0aa9` | `0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e` |

Mỗi tài khoản có sẵn **10.000 ETH test**.

### 3.4. Kết nối ví với trang
Ở mỗi profile: mở **http://localhost:5173** → **Kết nối ví** → trong popup MetaMask, chọn **tất cả** tài khoản đã import của profile đó và tích mạng **Hardhat Local** → **Connect**.

> Mỗi khi đổi sang tài khoản khác trong MetaMask, tài khoản đó phải **đã được kết nối** với trang. Nếu chưa, khi ký FairPass sẽ tự mở hộp thoại xin quyền; chỉ cần bấm Connect.

### 3.5. Ví không có ETH?
- Trên web: menu ví (góc phải) → **Nhận 100 ETH test**
- Hoặc ở terminal: `npm run faucet -- 0xĐịaChỉVí`

---

## 4. Kiểm tra nhanh trước demo (2 phút)

| Kiểm tra | Cách làm | Đúng khi |
|---|---|---|
| Backend & indexer | Mở http://localhost:4000/api/health | `"ok":true`, `lastBlock` bằng `headBlock` |
| Trang chủ | Mở http://localhost:5173 | Thấy 2 sự kiện mẫu |
| Ví | Mỗi profile: nút ví hiện số dư ETH, chấm xanh "Local" | Không có banner vàng "sai mạng" |
| Menu theo vai trò | Profile Ban tổ chức (#0) | Thấy cả **Tổ chức** và **Quản trị** |
| | Profile Soát vé (#4) | Thấy **Soát vé** |
| | Profile Khách | Chỉ thấy Sự kiện / Chợ bán lại / Vé của tôi |

---

## 5. Kịch bản demo chi tiết

> Ký hiệu: 🟦 = profile Ban tổ chức · 🟩 = profile Khách · 🟧 = profile Soát vé · **[#n]** = tài khoản đang chọn trong MetaMask.
> 💬 = câu gợi ý để thuyết trình với hội đồng.

### Phần 0 — Giới thiệu (1 phút)
1. 🟩 Mở trang chủ. Chỉ vào 3 cam kết: **Xác thực on-chain · Không phe vé · QR động**.
2. Di chuột qua các thẻ sự kiện: thẻ nổi lên, thanh "đã bán" chạy từ 0.

💬 *"Mỗi vé là một NFT ERC-721. Mọi luật chống đầu cơ và chống giả nằm trong smart contract, backend không thể can thiệp."*

---

### Phần 1 — Quản trị: cấp quyền ban tổ chức (1 phút)
1. 🟦 **[#0]** → menu **Quản trị**.
2. Ô *Cấp quyền ban tổ chức cho ví* → dán `0x976EA74026E726554dB657fA54763abd0C3a0aa9` (#6) → **Cấp quyền ORGANIZER** → ký.
   - Quan sát nút đổi trạng thái: *Chờ ký trên ví… → Đang xác nhận… → ✓ Đã cấp quyền*, kèm toast ở góc màn hình.
3. #6 xuất hiện trong danh sách → bấm **Thu hồi** để dọn lại.
4. Thử dán một địa chỉ sai (ví dụ `0x123`) → ô nhập **rung** và báo "Địa chỉ ví không hợp lệ".

💬 *"Chỉ admin mới cấp được ORGANIZER_ROLE (OpenZeppelin AccessControl). Như vậy ngăn được sự kiện lừa đảo."*

---

### Phần 2 — Ban tổ chức: tạo sự kiện (2 phút)
> ⏰ **Làm phần này đầu tiên** vì sự kiện cần bắt đầu sau khoảng 10 phút để đến cuối buổi demo được phần **Rút doanh thu**.

1. 🟦 **[#1]** → **Tổ chức** → **Tạo sự kiện**.
2. **Bước 1 — Thông tin:**
   - Tên: `Demo bảo vệ đồ án`
   - Địa điểm: `Phòng bảo vệ`
   - Thời gian bắt đầu: **giờ hiện tại + 10 phút**
   - Poster: chọn một ảnh bất kỳ
   - Thử bấm **Tiếp tục** khi để trống tên → ô rung và báo lỗi.
3. **Bước 2 — Hạng vé:**
   - `VIP` · `0.05` · `5`
   - `Thường` · `0.01` · `20`
4. **Bước 3 — Quy định:**
   - Giới hạn vé/ví: `2`
   - Giá trần: `110`
   - Bấm **Tạo sự kiện**.
5. MetaMask yêu cầu ký **2 lần**:
   1. Ký message đăng nhập ví (không tốn phí). Backend kiểm tra ORGANIZER_ROLE trên chain rồi mới cho upload poster và metadata lên IPFS.
   2. Ký giao dịch `createEvent`.
6. Trang tự chuyển sang **trang quản lý sự kiện**, hiện các ô số liệu, tiến độ từng hạng vé và phần staff.
7. Trong khung **Nhân viên soát vé** → dán `0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65` (#4) → **Thêm staff** → ký.

💬 *"Metadata NFT chuẩn ERC-721 được lưu trên IPFS. Backend chỉ giữ API key Pinata; mọi giao dịch đi thẳng từ ví tới contract."*

> Chưa cấu hình `PINATA_JWT` thì poster được lưu local ở `backend/uploads` (chế độ demo offline). Luồng vẫn giống hệt.

---

### Phần 3 — Khách mua vé & giới hạn vé/ví (2 phút)
1. 🟩 **[#2]** → trang chủ → mở **Demo bảo vệ đồ án**.
2. Chỉ vào khung **Quy định chống đầu cơ** ở cột trái.
3. Chọn hạng **Thường**, số lượng **2** → **Mua 2 vé** → ký → *✓ Đã mua vé*. Số "đã bán" tăng ngay.
4. Khung mua giờ hiện 🔒 **"Bạn đã đạt giới hạn 2 vé/ví"**, và nút + số lượng bị khoá.
5. Vào **Vé của tôi**: 2 vé NFT dạng "vé xé".
   - Di chuột trên vé: vé **nghiêng 3D**, có **dải hologram** lướt qua.
   - Di chuột vào hàng nút: **cuống vé tách ra** như sắp xé.

💬 *"Giới hạn vé/ví được contract kiểm tra cả lúc mua mới lẫn lúc mua lại. Giao diện chỉ hiển thị trước, contract mới là nơi quyết định."*

---

### Phần 4 — Bán lại có giá trần (2 phút)
1. 🟩 **[#2]** → **Vé của tôi** → vé đầu tiên → **Bán lại**.
2. Gõ `0.012` (120%) → ô **rung** và báo *"Vượt giá trần 110% (tối đa 0,011 ETH)"*, nút bị khoá.
3. Bấm nút gợi ý **110%** → **Rao bán** → ký. Vé chuyển sang badge **Đang rao bán**.
4. Đổi MetaMask sang **[#3]** (cùng profile Khách) → **Chợ bán lại**: thấy vé với *Giá rao / Giá gốc / 110%*.
5. **Mua lại · 0,011 ETH** → ký → vé biến khỏi chợ và nằm trong **Vé của tôi** của #3.
6. (Tuỳ chọn) Đổi lại **[#2]**: số dư tăng 0,011 ETH. Tiền đi thẳng từ người mua sang người bán, không qua trung gian.

💬 *"Giá trần tính theo giá gốc sơ cấp, nên bán qua bao nhiêu tay cũng không thể đội giá."*

---

### Phần 5 — Không thể lách luật bằng cách chuyển vé ngoài sàn (1 phút)
Đây là chỗ hội đồng hay hỏi: *"Nếu họ chuyển NFT qua OpenSea hoặc ví khác thì sao?"*

Ở terminal ②:

```bash
npx hardhat console --network localhost
```

Lấy địa chỉ contract ở footer trang web hoặc trong `deployments/localhost.json`, rồi dán từng dòng:

```js
const nft = await ethers.getContractAt("EventTicketNFT", "0xĐỊA_CHỈ_CONTRACT")
const [, , a, b] = await ethers.getSigners()
await nft.connect(b).transferFrom(b.address, a.address, 3)
await nft.connect(b).approve(a.address, 3)
```

Kết quả: cả hai lệnh đều báo `reverted with custom error 'TransfersDisabled()'`. Gõ `.exit` để thoát.

💬 *"Hàm `_update` của ERC-721 bị override: vé chỉ đổi chủ khi mint, khi burn (lúc hoàn tiền) hoặc qua chợ nội bộ. `approve` cũng bị chặn nên không đưa được lên sàn ngoài."*

---

### Phần 6 — Soát vé bằng QR động (3 phút) ⭐
1. 🟩 **[#3]** → **Vé của tôi** → vé vừa mua lại → **Hiện QR** → ký (EIP-712, không tốn phí).
2. Chỉ cho hội đồng:
   - **Vòng đếm ngược 60 giây** quanh QR; chuyển sang **vàng** khi còn 10 giây.
   - Chấm xanh nhấp nháy **"Mã QR động đang hoạt động"**.
   - Khi còn 5 giây, MetaMask tự bật popup để ký mã mới → QR **lật** sang mã mới.
3. Bấm **Sao chép mã kiểm tra**.
4. 🟧 **[#4]** → **Soát vé** → chọn sự kiện **Demo bảo vệ đồ án** → dán vào ô **Dán mã kiểm tra**.
   - Khối kết quả **bung ra**: **HỢP LỆ** cùng 6 dấu ✓ (chữ ký chủ vé · mã còn hạn · vé chưa dùng · sự kiện hợp lệ · đúng sự kiện · ví có quyền soát).
5. Bấm **Xác nhận check-in · …s** → ký → **ĐÃ CHECK-IN**.
6. 🟩 Quay lại **Vé của tôi** của #3 (lọc *Đã dùng / đã qua*): vé có **con dấu "ĐÃ SOÁT"** đóng vào.

**Quét bằng webcam thật (tuỳ chọn):** ở bước 3, dùng điện thoại chụp ảnh QR trên màn hình → 🟧 **Bật camera** → giơ ảnh trước webcam, cách 15–25 cm, màn hình điện thoại để sáng tối đa. Phải làm trong 60 giây.

💬 *"QR chứa chữ ký số EIP-712 của chủ vé. Contract dùng ECDSA khôi phục địa chỉ ký rồi so với `ownerOf`. Không có private key thì không thể làm giả."*

---

### Phần 7 — Các trường hợp bị từ chối (2 phút) ⭐
Làm ngay sau Phần 6, ở 🟧 trang Soát vé:

| # | Thao tác | Kết quả |
|---|---|---|
| 1 | Dán lại **đúng mã vừa check-in** | ✗ **KHÔNG HỢP LỆ** — "Vé đã được soát trước đó" (chống dùng lại vé) |
| 2 | 🟩 Hiện QR vé còn lại của **[#2]**, copy, **đợi hơn 60 giây** rồi dán | ✗ "Mã QR đã hết hạn" (chống ảnh chụp màn hình) |
| 3 | Copy mã mới, sửa vài ký tự ở cuối rồi dán | ✗ "Người ký không phải chủ vé hiện tại" hoặc "không đúng định dạng" (chống sửa mã) |
| 4 | Đổi ô sự kiện sang **Đêm nhạc FairPass 2026**, dán mã vé của sự kiện Demo | ✗ "Vé thuộc sự kiện khác" |

Khi kết quả không hợp lệ, khối kết quả **rung** và khung camera **loé đỏ**.

💬 *"Phía giao diện kiểm tra trước bằng cách đọc contract (không tốn gas), nhưng khi xác nhận thì contract kiểm tra lại toàn bộ. Có ai sửa giao diện cũng không lách được."*

---

### Phần 8 — Huỷ sự kiện & hoàn tiền (2 phút)
1. 🟩 **[#5]** → mở **Hội thảo Blockchain Việt Nam** → mua **1 vé** (0,01 ETH). Ghi nhớ số dư trên nút ví.
2. 🟦 **[#1]** → **Tổ chức** → **Hội thảo Blockchain Việt Nam** → **Huỷ sự kiện…** → gõ đúng tên sự kiện để xác nhận → ký.
3. 🟩 **[#5]** → **Vé của tôi** → vé hiện badge đỏ **"Sự kiện bị huỷ"** cùng nút **Hoàn tiền** → bấm → ký.
4. Số dư tăng lại 0,01 ETH (trừ phí gas). Vé bị **burn** nên biến khỏi danh sách.

💬 *"Tiền vé được giữ trong contract (escrow) tới giờ diễn. Khi huỷ, người giữ vé tự rút lại (pull payment), không phụ thuộc thiện chí ban tổ chức."*

---

### Phần 9 — Dừng khẩn cấp (1 phút)
1. 🟦 **[#0]** → **Quản trị** → **Tạm dừng hệ thống** → ký.
2. Mọi trang hiện banner đỏ **"Hệ thống đang tạm dừng khẩn cấp"** (tự cập nhật trong khoảng 15 giây, hoặc tải lại trang).
3. 🟩 Thử mua vé → thông báo *"Hệ thống đang tạm dừng khẩn cấp"*.
4. 🟦 **Mở lại hệ thống** → ký.

💬 *"Pausable của OpenZeppelin dùng khi phát hiện lỗi bảo mật. Riêng hoàn tiền vẫn hoạt động, để không khoá tiền của người dùng."*

---

### Phần 10 — Rút doanh thu sau giờ diễn (1 phút)
> Chỉ làm được khi đã qua **thời gian bắt đầu** của sự kiện "Demo bảo vệ đồ án" (khoảng 10 phút sau Phần 2).

1. 🟦 **[#1]** → **Tổ chức** → **Demo bảo vệ đồ án**.
   - Trước giờ diễn, nút ghi *"Mở khoá lúc …"* và bị khoá.
   - Sau giờ diễn, bấm **Rút …ETH** → ký → badge **Đã rút doanh thu**.
2. 🟩 Mở trang sự kiện: khung mua hiện *"Sự kiện đã bắt đầu — ngừng bán vé"*. Bán lại cũng bị khoá, nhưng soát vé vẫn được.

💬 *"Ban tổ chức chỉ nhận tiền sau khi sự kiện diễn ra. Đã rút thì không huỷ được nữa, nên người mua luôn được bảo vệ."*

---

## 6. Chứng minh bằng kiểm thử tự động

Chạy trước hội đồng nếu được hỏi về chất lượng code (ở terminal ②):

```bash
npx hardhat test            # 48 test smart contract — tất cả phải "passing"
npm run test:coverage       # Độ phủ: 100% dòng, ~89% nhánh
```

**Test giao diện tự động bằng Playwright.** Bộ test bấm thật qua toàn bộ kịch bản mục 5 trên Chrome, khoảng 5–6 phút, 16 bước:

```bash
cd frontend
npm run test:e2e            # chạy ẩn
npm run test:e2e:headed     # mở Chrome để xem test tự bấm (hay để trình diễn)
npm run test:e2e:report     # xem báo cáo HTML
```

- Playwright không điều khiển được popup MetaMask, nên test dùng **ví giả lập EIP-1193** (`frontend/e2e/wallet.js`): yêu cầu ký và gửi giao dịch được chuyển thẳng tới Hardhat node. Contract, backend và frontend đều chạy thật.
- Test tự tạo sự kiện riêng (tên `E2E Demo …`) nên chạy được trên chain đã có dữ liệu. Tuy vậy, nó **thêm dữ liệu**, nên reset (mục 8) trước buổi demo thật.
- Ảnh chụp các màn hình chính nằm ở `frontend/e2e/screenshots/`.

Test end-to-end giữa chain, indexer và API (`backend/scripts/e2e-smoke.js`) **tạo thêm dữ liệu** trên chain. Chỉ chạy nó trên chain mới seed, **không** chạy ngay trước buổi demo, rồi reset lại (mục 8):

```bash
cd backend && node scripts/e2e-smoke.js     # 12 bước phải ✔
```

---

## 7. Xử lý sự cố

| Triệu chứng | Nguyên nhân | Cách xử lý |
|---|---|---|
| **"Ví không đủ ETH…"** hoặc *could not coalesce error* | Ví 0 ETH trên mạng local | Menu ví → **Nhận 100 ETH test**, hoặc `npm run faucet -- 0x…` |
| **"Tài khoản MetaMask chưa được cấp quyền…"** (lỗi 4100) | Tài khoản hoặc mạng chưa kết nối với trang | Bấm Connect trong popup FairPass tự mở; hoặc MetaMask → *Connected sites* → kết nối tài khoản và mạng Hardhat Local |
| **"Lệch nonce giao dịch…"** / giao dịch treo | Đã chạy lại `hardhat node` nhưng MetaMask còn nhớ lịch sử cũ | MetaMask → **Settings → Advanced → Clear activity tab data** (làm ở **mỗi** profile) |
| Banner vàng **"Ví đang ở sai mạng"** | MetaMask không ở chain 31337 | Bấm **Chuyển sang Local** |
| **"Không kết nối được máy chủ FairPass"** | Backend chưa chạy | Kiểm tra terminal ③ |
| Trang trống, không có sự kiện | Indexer chưa đồng bộ, hoặc chưa seed | Mở `/api/health` xem `lastBlock`; chạy `npm run seed:local` |
| Dữ liệu cũ sau khi chạy lại chain | Bình thường | Backend tự phát hiện chain mới, xoá DB và index lại. Khởi động lại terminal ③ nếu cần |
| Banner đỏ **"Chưa có địa chỉ contract…"** | Chưa deploy | `npm run deploy:local` rồi tải lại trang |
| Camera không mở | Chưa cấp quyền, hoặc webcam đang bận | Cho phép camera ở thanh địa chỉ; dùng ô **Dán mã kiểm tra** thay thế |
| QR không quét được | Ngược sáng hoặc ảnh quá nhỏ | Tăng độ sáng điện thoại, để QR chiếm khoảng 2/3 khung; hoặc dán mã |
| MetaMask bật popup ký QR liên tục | QR tự làm mới mỗi 60 giây (thiết kế chống chụp màn hình) | Đóng modal QR khi không dùng |
| Muốn xem lỗi gốc | — | Mở Console (F12) → dòng `[FairPass] lỗi giao dịch:` |

---

## 8. Reset dữ liệu sạch

Dùng khi muốn demo lại từ đầu, hoặc dữ liệu đã bị test làm rối:

1. Terminal ①: `Ctrl + C`, rồi chạy lại `npx hardhat node`.
2. Terminal ②: `npm run deploy:local` rồi `npm run seed:local`.
3. Terminal ③: `Ctrl + C`, rồi `npm run dev`. Backend tự xoá dữ liệu cũ và index lại.
4. Terminal ④: không cần làm gì (Vite tự nạp lại địa chỉ contract mới), chỉ cần tải lại trang.
5. **Trong MetaMask ở mỗi profile:** Settings → Advanced → **Clear activity tab data**. Bắt buộc, nếu không sẽ bị lỗi nonce.

---

## 9. Checklist trước buổi bảo vệ

**Hôm trước**
- [ ] Đã reset dữ liệu sạch (mục 8) và chạy thử trọn kịch bản mục 5 một lần.
- [ ] 3 Chrome profile đã import đủ tài khoản và kết nối với trang.
- [ ] `npx hardhat test` ra 48 passing.
- [ ] Chuẩn bị sẵn 1 ảnh poster trong thư mục dễ tìm.

**30 phút trước**
- [ ] Bật 4 terminal theo mục 2 (chain mới, deploy, seed).
- [ ] Clear activity tab data ở cả 3 profile MetaMask.
- [ ] Mục 4: kiểm tra nhanh mọi thứ xanh.
- [ ] Sạc đầy laptop, tắt thông báo hệ điều hành, phóng to trình duyệt khoảng 110–125% cho hội đồng dễ nhìn.
- [ ] Mở sẵn các tab: Trang chủ (🟩), Quản trị (🟦), Soát vé (🟧), và terminal ② sẵn `npx hardhat console`.

**Thứ tự gợi ý khi lên bảng** (khoảng 15 phút):
`Phần 0 → 2 (tạo sự kiện +10 phút) → 1 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → mục 6 (chạy test)`
