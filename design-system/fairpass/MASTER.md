# FairPass — Design System MASTER (v2, đã duyệt 2026-11-15)

> Nguồn sự thật duy nhất cho giao diện FE. File riêng của từng trang nằm trong `pages/<page>.md` (nếu có) và **ghi đè** file này.
> Được tạo với skill `ui-ux-pro-max` (design-system: "NFT event ticketing marketplace", density 5, motion 3), sau đó tinh chỉnh theo yêu cầu đồ án.

## 1. Phong cách
- Giao diện tối, bố cục dạng khối, chữ đậm và gọn. Cảm giác "vé thật", sản phẩm cao cấp (tham khảo Apple Wallet và Linear). Không lòe loẹt.
- Chuyển động nhẹ và có ý nghĩa, luôn tôn trọng `prefers-reduced-motion` (xem mục 7).
- Không dùng emoji làm icon. Trạng thái **không bao giờ chỉ thể hiện bằng màu**, luôn có icon và chữ đi kèm.

## 2. Màu (token khai báo trong `@theme`, không dùng mã hex trực tiếp trong component)
| Token | Hex | Dùng cho | Tương phản |
|---|---|---|---|
| `bg` | `#020617` | Nền trang | — |
| `card` | `#0E1223` | Thẻ, modal | — |
| `muted` | `#1A1E2F` | Ô input, khối phụ | — |
| `border` | `#334155` | Viền | — |
| `fg` | `#F8FAFC` | Chữ chính | 18:1 |
| `muted-fg` | `#94A3B8` | Chữ phụ | 7.2:1 trên card |
| `primary` | `#06B6D4` | Nút chính, link, logo, focus ring | 7.7:1 trên card |
| `on-primary` | `#020617` | Chữ trên nền primary (**chữ trắng chỉ đạt 2.4:1, không dùng**) | 8.3:1 |
| `success` | `#16A34A` | Còn vé, hợp lệ (nền thì dùng chữ tối) | 5.6:1 trên card |
| `warning` | `#F59E0B` | Sắp hết, QR sắp hết hạn | 8.7:1 |
| `danger` | `#DC2626` | Chỉ dùng làm **nền** (chữ trắng 4.8:1) | — |
| `danger-text` | `#F87171` | Chữ và viền báo lỗi | 6.7:1 trên card |

## 3. Chữ
- **Be Vietnam Pro** (300–700) cho tiêu đề và nội dung. **JetBrains Mono** cho địa chỉ ví, tx hash, tokenId.
- Cỡ chữ nội dung 16px, line-height 1.5. Tiêu đề 24 / 32 / 40px. Không dùng chữ nội dung nhỏ hơn 12px.

## 4. Icon: Font Awesome 7 Free, chỉ dùng bộ **Solid**
- Package: `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons` và `@fortawesome/react-fontawesome`.
- Không trộn Regular hay Brands. Mọi icon đi qua `<Icon name>` với bảng tên cố định trong `src/lib/icons.js`.
- Chỉ có 3 cỡ: 16, 20, 24px. Icon trang trí có `aria-hidden`; nút chỉ có icon thì có `aria-label` tiếng Việt.

| Ý nghĩa | Icon | Ý nghĩa | Icon |
|---|---|---|---|
| Logo / vé | ticket | Ví | wallet |
| Sự kiện | calendar-days | Địa điểm | location-dot |
| Chợ bán lại | store | Bán lại | right-left |
| Giá | tag | QR | qrcode |
| Staff | id-badge | Camera | camera |
| Organizer | user-tie | Admin | user-shield |
| Chống giả | shield-halved | Khoá chuyển nhượng | lock |
| Hợp lệ | circle-check | Không hợp lệ | circle-xmark |
| Cảnh báo | triangle-exclamation | Hết hạn / chờ | clock |
| Huỷ | ban | Hoàn tiền | rotate-left |
| Rút doanh thu | money-bill-transfer | Thống kê | chart-simple |
| Tạo mới | plus | Poster | image |
| Tìm kiếm | magnifying-glass | Etherscan | arrow-up-right-from-square |
| Sao chép | copy | Đang xử lý | spinner |
| Tạm dừng / mở lại | pause / play | Ngắt ví | right-from-bracket |

## 5. Khung trang và điều hướng
- **Thanh trên cùng:** Logo, Sự kiện, Chợ bán lại, Vé của tôi. Theo quyền thì thêm Tổ chức / Soát vé / Quản trị (lấy từ `/users/:addr/roles`). Cuối thanh là huy hiệu mạng và nút ví.
- **Mobile:** thanh dưới đáy, tối đa 5 mục. Breakpoint 375 / 768 / 1024 / 1440. Lề hai bên 16px. Không cuộn ngang.
- **Sai mạng:** banner với nút "Chuyển mạng". **Chưa có MetaMask:** hướng dẫn cài.

## 6. Các trang
| Route | Nội dung chính |
|---|---|
| `/` | Hero, 3 huy hiệu cam kết, tìm kiếm, tab Sắp diễn ra / Đã qua / Đã huỷ, lưới EventCard |
| `/events/:id` | Poster, thông tin, quy định chống đầu cơ, khung "Chọn vé" (sticky trên mobile): chọn hạng, số lượng, tổng, giới hạn vé/ví, mua |
| `/my-tickets` | TicketCard. Hiện QR / Bán lại / Huỷ rao / Hoàn tiền. Modal QR, Modal bán lại |
| `/marketplace` | Vé đang rao: giá rao, giá gốc, % so với giá gốc, Mua lại |
| `/organizer` | Sự kiện của tôi kèm số liệu, nút Tạo sự kiện |
| `/organizer/new` | Form 3 bước: Thông tin + poster → Hạng vé → Quy định + xem lại, rồi upload IPFS và ký giao dịch |
| `/organizer/events/:id` | Ô số liệu, tiến độ theo hạng, staff, Rút doanh thu (sau giờ diễn), Huỷ (xác nhận bằng cách gõ tên) |
| `/checkin` | Chọn sự kiện (`checkinEvents`), camera quét, ô **[Dán mã kiểm tra]**, khối kết quả |
| `/admin` | Danh sách organizer, cấp / thu hồi quyền, Tạm dừng hệ thống |

## 7. Chuyển động (Micro-interactions)
**Token:** 150ms (hover), 220ms (đổi trạng thái), 320–400ms (xuất hiện). Easing `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`. Chỉ animate `transform` và `opacity`.
**Công cụ:** CSS keyframes cho hiệu ứng lặp. `motion` (`motion/react`) cho TxButton, lật QR, khối kết quả check-in, stagger danh sách và toast.

1. **TicketCard**
   - Nghiêng 3D theo con trỏ (≤ 6°, biến `--rx/--ry`), nhấc lên 4px và bóng đổ đậm dần.
   - Holographic sheen: lớp `::after` với gradient cyan-tím-trắng ~15%, `color-dodge`, lướt chéo 900ms.
   - Cuống vé tách `translateX(6px) rotate(1.5deg)` khi hover vào nhóm nút hành động.
   - Vé đã dùng: con dấu "ĐÃ SOÁT" xoay −12°, nảy 1.8 → 0.92 → 1 trong 450ms. Không còn sheen.
2. **Modal QR**
   - Vòng SVG `stroke-dashoffset` chạy theo thời gian thực (rAF, tính từ `deadline`). Đổi sang `warning` khi còn ≤ 10s; số đếm nhịp khi còn ≤ 5s.
   - Chấm `animate-ping` cạnh "Mã QR động đang hoạt động", tắt khi QR hết hạn.
   - Làm mới: lật `rotateY` kèm blur, 250ms.
   - Nút **[Sao chép mã kiểm tra]**: icon copy đổi sang check bằng trượt dọc.
3. **TxButton**
   - Chiều rộng cố định. Nội dung đổi bằng trượt dọc 180ms.
   - Thành công: icon nảy lò xo (stiffness 500, damping 15). Thất bại: rung ngang 300ms.
   - Ô nhập sai: rung, viền `danger-text`, báo lỗi `aria-live`.
   - **Toast:** trượt vào bằng spring, chồng nhiều toast thì dồn chỗ mượt, thanh thời gian dừng khi hover.
4. **/checkin**
   - Scanline 2,2s lặp, bốn góc khung co giãn 1,6s. Bắt được mã thì khung loé xanh hoặc đỏ.
   - Khối kết quả bung ra (scale 0.9 → 1, y 12 → 0, 420ms, out-expo). Hợp lệ: dấu ✓ tự vẽ nét. Không hợp lệ: rung một lần.
5. **Danh sách và thanh tiến độ**
   - Stagger 45ms mỗi thẻ, giới hạn 12 thẻ, chỉ chạy lần tải đầu.
   - Thanh tiến độ dùng `scaleX` 0 → giá trị trong 700ms ease-out, không animate `width`.

**Khi bật `prefers-reduced-motion`:** dùng `MotionConfig reducedMotion="user"` cùng một khối `@media` chung.
- Tắt: nghiêng, sheen, stagger, scanline, ping, lật QR.
- Thay bằng tín hiệu tĩnh: shake thành viền đỏ, stamp hiện thẳng không nảy.
- Giữ nguyên: vòng đếm ngược (là thông tin) và việc đổi màu trạng thái.

## 8. Trải nghiệm giao dịch
- **TxButton:** Mặc định → (Chuẩn bị) → Chờ ký trên ví… → Đang xác nhận… (có link Etherscan) → ✓ Thành công / ✕ Thất bại. Nút bị khoá khi đang chạy.
- **Lỗi:** custom error của contract được dịch sang tiếng Việt (`src/lib/errors.js`). Người dùng tự huỷ ký thì hiện thông báo trung tính, không rung.
- Sau giao dịch, chờ indexer theo kịp block (`/health`) rồi mới tải lại dữ liệu.

## 9. Mã kiểm tra soát vé
- Định dạng: `FP1.<chainId>.<tokenId>.<deadline>.<signature>`. Đây vừa là nội dung QR, vừa là chuỗi được sao chép. Chữ ký EIP-712 `CheckIn(tokenId, deadline)` có hiệu lực 60 giây.
- Làm mới QR luôn cần MetaMask bật popup để ký. Khi còn 5 giây FE tự yêu cầu ký; nếu không ký kịp thì QR mờ đi và hiện nút [Làm mới]. Đổi ví thì ngừng tự làm mới.
- **Demo trên 1 laptop:** dùng 2 Chrome profile (Khách / Soát vé), hoặc cùng profile: Copy, đổi tài khoản MetaMask, rồi Dán.

## 10. Khả năng tiếp cận
Chữ đạt tương phản ≥ 4.5:1. Focus ring rõ (2px `primary`). Vùng bấm tối thiểu 44×44px. Mọi phần tử bấm được có `cursor-pointer`. Ô nhập có nhãn thật, lỗi hiện ngay cạnh ô. Kiểm tra trên 375px.
