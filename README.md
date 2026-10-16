# 🎫 FairPass — NFT Event Ticket System

> Hệ thống bán vé sự kiện bằng NFT — Đề tài 58 (Lập trình Blockchain)
>
> 🔗 **Repository**: [github.com/viet29oct/FairPass](https://github.com/viet29oct/FairPass)

## Mô tả

**FairPass** là hệ thống phát hành vé sự kiện dưới dạng NFT (ERC-721) trên Ethereum, tích hợp cơ chế **chống vé giả** và **chống đầu cơ**.

### Tính năng chính

- 🎪 **Tạo sự kiện**: Ban tổ chức tạo và quản lý sự kiện
- 🎟️ **Mua vé NFT**: Mỗi vé là một NFT duy nhất với metadata trên IPFS
- 🔄 **Bán lại có kiểm soát**: Giá trần bán lại ngăn đầu cơ
- 🛡️ **Chống đầu cơ**: Giới hạn số vé mỗi ví
- ✅ **Soát vé bằng chữ ký số**: Xác thực bằng mật mã bất đối xứng (ecrecover)
- ⏸️ **Tạm dừng khẩn cấp**: Pausable cho tình huống bất thường

## Tech Stack

| Tầng | Công nghệ |
|---|---|
| Smart Contract | Solidity, OpenZeppelin (ERC-721) |
| Phát triển & Kiểm thử | Hardhat, Chai, Ethers.js |
| Mạng | Hardhat Network (local), Sepolia (testnet) |
| Ví | MetaMask |
| Giao diện | React + Vite + Ethers.js |
| Lưu trữ ngoài chuỗi | IPFS (Pinata) |
| Bảo mật | Slither, OpenZeppelin security patterns |

## Cài đặt

```bash
# Clone repo
git clone https://github.com/viet29oct/FairPass.git
cd FairPass

# Cài dependencies
npm install

# Copy file env
cp .env.example .env
# Điền thông tin vào .env

# Chạy test
npx hardhat test

# Deploy local
npx hardhat node
npx hardhat run scripts/deploy.js --network localhost
```

## Cấu trúc dự án

```
├── contracts/              # Smart contracts
│   └── EventTicketNFT.sol
├── test/                   # Test suite
│   └── EventTicketNFT.test.js
├── scripts/                # Deploy & utility scripts
│   └── deploy.js
├── frontend/               # React DApp
│   ├── src/
│   └── package.json
├── hardhat.config.js        # Hardhat configuration
├── package.json
└── README.md
```

## Quy trình phát triển

Dự án tuân theo quy trình Git chuẩn:

1. `main` — Code ổn định, sẵn sàng demo
2. `develop` — Nhánh phát triển chính
3. `feature/*` — Các tính năng mới
4. `hotfix/*` — Sửa lỗi khẩn cấp

## Nhóm thực hiện

- **Môn học**: Lập trình Blockchain
- **Đề tài**: #58 — Bán vé sự kiện bằng NFT

## License

MIT
