/**
 * Tạo dữ liệu demo trên mạng local (sau khi đã chạy deploy.js):
 *   npx hardhat run scripts/seed.js --network localhost
 *
 * Tài khoản Hardhat: #0 admin, #1 organizer, #2 buyer A, #3 buyer B, #4 staff
 */
const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

const DAY = 24 * 60 * 60;

async function main() {
  const { ethers } = hre;
  const deployment = JSON.parse(
    fs.readFileSync(path.join(__dirname, `../deployments/${hre.network.name}.json`), "utf8")
  );
  const [admin, organizer, buyerA, buyerB, staff] = await ethers.getSigners();
  const nft = await ethers.getContractAt("EventTicketNFT", deployment.address);

  await (await nft.connect(admin).grantRole(await nft.ORGANIZER_ROLE(), organizer.address)).wait();
  console.log("👤 Organizer:", organizer.address);

  const now = (await ethers.provider.getBlock("latest")).timestamp;
  const events = [
    {
      info: {
        name: "Đêm nhạc FairPass 2026",
        venue: "Nhà hát Lớn Hà Nội",
        startTime: now + 14 * DAY,
        metadataURI: "",
        maxPerWallet: 4,
        resaleCapPercent: 110,
      },
      tiers: [
        { name: "VIP", price: ethers.parseEther("0.05"), supply: 20, metadataURI: "" },
        { name: "Thường", price: ethers.parseEther("0.02"), supply: 100, metadataURI: "" },
      ],
    },
    {
      info: {
        name: "Hội thảo Blockchain Việt Nam",
        venue: "Trung tâm Hội nghị Quốc gia",
        startTime: now + 30 * DAY,
        metadataURI: "",
        maxPerWallet: 2,
        resaleCapPercent: 100,
      },
      tiers: [{ name: "Vé tham dự", price: ethers.parseEther("0.01"), supply: 50, metadataURI: "" }],
    },
  ];

  for (const e of events) {
    await (await nft.connect(organizer).createEvent(e.info, e.tiers)).wait();
  }
  const total = await nft.totalEvents();
  console.log(`🎪 Đã tạo ${events.length} sự kiện (tổng ${total})`);

  const firstId = total - BigInt(events.length) + 1n;
  await (await nft.connect(organizer).setStaff(firstId, staff.address, true)).wait();
  await (await nft.connect(buyerA).buyTicket(firstId, 0, 1, { value: ethers.parseEther("0.05") })).wait();
  await (await nft.connect(buyerB).buyTicket(firstId, 1, 2, { value: ethers.parseEther("0.04") })).wait();
  console.log("🎟️  Buyer A mua 1 VIP, Buyer B mua 2 vé Thường; staff:", staff.address);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
