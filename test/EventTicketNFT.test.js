const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

const ONE_DAY = 24 * 60 * 60;
const VIP_PRICE = ethers.parseEther("0.1");
const STD_PRICE = ethers.parseEther("0.05");

describe("EventTicketNFT (FairPass)", function () {
  // ─────────────────────────── Fixtures ───────────────────────────

  async function deployFixture() {
    const [admin, organizer, alice, bob, carol, staff, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("EventTicketNFT");
    const nft = await Factory.deploy();
    await nft.waitForDeployment();
    await nft.grantRole(await nft.ORGANIZER_ROLE(), organizer.address);
    return { nft, admin, organizer, alice, bob, carol, staff, outsider };
  }

  async function eventInput(overrides = {}) {
    const now = await time.latest();
    return {
      name: "Concert FairPass",
      venue: "Nhà hát Lớn Hà Nội",
      startTime: now + 7 * ONE_DAY,
      metadataURI: "ipfs://event",
      maxPerWallet: 2,
      resaleCapPercent: 110,
      ...overrides,
    };
  }

  const TIERS = [
    { name: "VIP", price: VIP_PRICE, supply: 5, metadataURI: "ipfs://vip" },
    { name: "Thường", price: STD_PRICE, supply: 10, metadataURI: "ipfs://std" },
  ];

  async function eventFixture() {
    const base = await deployFixture();
    const { nft, organizer, staff } = base;
    const info = await eventInput();
    await nft.connect(organizer).createEvent(info, TIERS);
    await nft.connect(organizer).setStaff(1, staff.address, true);
    return { ...base, info, eventId: 1n };
  }

  /** alice mua 1 vé VIP → tokenId 1 */
  async function purchasedFixture() {
    const base = await eventFixture();
    await base.nft.connect(base.alice).buyTicket(1, 0, 1, { value: VIP_PRICE });
    return { ...base, tokenId: 1n };
  }

  async function signCheckIn(nft, signer, tokenId, deadline) {
    const { chainId } = await ethers.provider.getNetwork();
    const domain = {
      name: "FairPass",
      version: "1",
      chainId,
      verifyingContract: await nft.getAddress(),
    };
    const types = { CheckIn: [{ name: "tokenId", type: "uint256" }, { name: "deadline", type: "uint256" }] };
    return signer.signTypedData(domain, types, { tokenId, deadline });
  }

  // ─────────────────────────── Deployment ───────────────────────────

  describe("Deployment", function () {
    it("đặt tên/symbol và cấp quyền cho deployer", async function () {
      const { nft, admin } = await loadFixture(deployFixture);
      expect(await nft.name()).to.equal("FairPass Ticket");
      expect(await nft.symbol()).to.equal("FPT");
      expect(await nft.hasRole(await nft.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
      expect(await nft.hasRole(await nft.ORGANIZER_ROLE(), admin.address)).to.be.true;
      expect(await nft.totalEvents()).to.equal(0);
    });

    it("hỗ trợ interface ERC-721 và AccessControl", async function () {
      const { nft } = await loadFixture(deployFixture);
      expect(await nft.supportsInterface("0x80ac58cd")).to.be.true; // ERC721
      expect(await nft.supportsInterface("0x7965db0b")).to.be.true; // AccessControl
    });
  });

  // ─────────────────────────── Tạo sự kiện ───────────────────────────

  describe("Tạo sự kiện", function () {
    it("organizer tạo sự kiện với nhiều hạng vé", async function () {
      const { nft, organizer } = await loadFixture(deployFixture);
      const info = await eventInput();
      await expect(nft.connect(organizer).createEvent(info, TIERS))
        .to.emit(nft, "EventCreated")
        .withArgs(1, organizer.address, info.name, info.startTime, info.metadataURI)
        .and.to.emit(nft, "TierCreated")
        .withArgs(1, 1, "Thường", STD_PRICE, 10);

      const evt = await nft.getEventInfo(1);
      expect(evt.organizer).to.equal(organizer.address);
      expect(evt.maxPerWallet).to.equal(2);
      expect(evt.cancelled).to.be.false;
      const tiers = await nft.getTiers(1);
      expect(tiers.length).to.equal(2);
      expect(tiers[0].price).to.equal(VIP_PRICE);
      expect(await nft.totalEvents()).to.equal(1);
    });

    it("từ chối khi không có ORGANIZER_ROLE", async function () {
      const { nft, alice } = await loadFixture(deployFixture);
      await expect(nft.connect(alice).createEvent(await eventInput(), TIERS))
        .to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
    });

    it("từ chối dữ liệu sự kiện không hợp lệ", async function () {
      const { nft, organizer } = await loadFixture(deployFixture);
      const now = await time.latest();
      for (const bad of [
        { name: "" },
        { startTime: now - 1 },
        { maxPerWallet: 0 },
        { resaleCapPercent: 99 },
      ]) {
        await expect(nft.connect(organizer).createEvent(await eventInput(bad), TIERS))
          .to.be.revertedWithCustomError(nft, "InvalidEventData");
      }
    });

    it("từ chối hạng vé không hợp lệ", async function () {
      const { nft, organizer } = await loadFixture(deployFixture);
      const info = await eventInput();
      await expect(nft.connect(organizer).createEvent(info, [])).to.be.revertedWithCustomError(nft, "InvalidTier");
      await expect(
        nft.connect(organizer).createEvent(info, [{ ...TIERS[0], supply: 0 }])
      ).to.be.revertedWithCustomError(nft, "InvalidTier");
      await expect(
        nft.connect(organizer).createEvent(info, Array(11).fill(TIERS[0]))
      ).to.be.revertedWithCustomError(nft, "InvalidTier");
    });

    it("đọc sự kiện không tồn tại bị revert", async function () {
      const { nft } = await loadFixture(deployFixture);
      await expect(nft.getEventInfo(0)).to.be.revertedWithCustomError(nft, "EventNotFound");
      await expect(nft.getTiers(5)).to.be.revertedWithCustomError(nft, "EventNotFound");
    });
  });

  // ─────────────────────────── Staff ───────────────────────────

  describe("Staff", function () {
    it("organizer thêm/gỡ staff", async function () {
      const { nft, organizer, carol } = await loadFixture(eventFixture);
      await expect(nft.connect(organizer).setStaff(1, carol.address, true))
        .to.emit(nft, "StaffUpdated")
        .withArgs(1, carol.address, true);
      expect(await nft.isStaff(1, carol.address)).to.be.true;
      await nft.connect(organizer).setStaff(1, carol.address, false);
      expect(await nft.isStaff(1, carol.address)).to.be.false;
    });

    it("người khác không được thêm staff", async function () {
      const { nft, admin, carol } = await loadFixture(eventFixture);
      await expect(nft.connect(admin).setStaff(1, carol.address, true))
        .to.be.revertedWithCustomError(nft, "NotEventOrganizer");
    });
  });

  // ─────────────────────────── Mua vé ───────────────────────────

  describe("Mua vé sơ cấp", function () {
    it("mua vé thành công: mint NFT, ghi nhận doanh thu, tokenURI theo hạng vé", async function () {
      const { nft, alice } = await loadFixture(eventFixture);
      await expect(nft.connect(alice).buyTicket(1, 1, 2, { value: STD_PRICE * 2n }))
        .to.emit(nft, "TicketPurchased")
        .withArgs(1, 1, 1, alice.address, STD_PRICE);

      expect(await nft.ownerOf(1)).to.equal(alice.address);
      expect(await nft.ownerOf(2)).to.equal(alice.address);
      expect(await nft.balanceOf(alice.address)).to.equal(2);
      expect(await nft.tokenURI(1)).to.equal("ipfs://std");
      expect(await nft.ownedPerEvent(1, alice.address)).to.equal(2);
      expect((await nft.getTiers(1))[1].sold).to.equal(2);
      expect((await nft.getEventInfo(1)).revenue).to.equal(STD_PRICE * 2n);
      expect(await ethers.provider.getBalance(await nft.getAddress())).to.equal(STD_PRICE * 2n);

      const t = await nft.getTicket(1);
      expect(t.eventId).to.equal(1);
      expect(t.pricePaid).to.equal(STD_PRICE);
      expect(t.used).to.be.false;
    });

    it("từ chối khi gửi sai số tiền", async function () {
      const { nft, alice } = await loadFixture(eventFixture);
      await expect(nft.connect(alice).buyTicket(1, 0, 1, { value: STD_PRICE }))
        .to.be.revertedWithCustomError(nft, "IncorrectPayment");
    });

    it("từ chối hạng vé / số lượng không hợp lệ", async function () {
      const { nft, alice } = await loadFixture(eventFixture);
      await expect(nft.connect(alice).buyTicket(1, 9, 1, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "InvalidTier");
      await expect(nft.connect(alice).buyTicket(1, 0, 0)).to.be.revertedWithCustomError(nft, "InvalidQuantity");
      await expect(nft.connect(alice).buyTicket(7, 0, 1)).to.be.revertedWithCustomError(nft, "EventNotFound");
    });

    it("từ chối khi hết vé", async function () {
      const { nft, organizer, alice } = await loadFixture(deployFixture);
      await nft.connect(organizer).createEvent(await eventInput({ maxPerWallet: 5 }), [
        { ...TIERS[0], supply: 1 },
      ]);
      await nft.connect(alice).buyTicket(1, 0, 1, { value: VIP_PRICE });
      await expect(nft.connect(alice).buyTicket(1, 0, 1, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "SoldOut");
    });

    it("CHỐNG ĐẦU CƠ: từ chối khi vượt giới hạn vé/ví", async function () {
      const { nft, alice } = await loadFixture(eventFixture);
      await expect(nft.connect(alice).buyTicket(1, 1, 3, { value: STD_PRICE * 3n }))
        .to.be.revertedWithCustomError(nft, "WalletLimitExceeded");
      await nft.connect(alice).buyTicket(1, 1, 2, { value: STD_PRICE * 2n });
      await expect(nft.connect(alice).buyTicket(1, 0, 1, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "WalletLimitExceeded");
    });

    it("CHỐNG ĐẦU CƠ: bán bớt vé rồi cũng không mua sơ cấp thêm được", async function () {
      const { nft, alice, bob } = await loadFixture(eventFixture);
      await nft.connect(alice).buyTicket(1, 1, 2, { value: STD_PRICE * 2n });
      await nft.connect(alice).listForResale(1, STD_PRICE);
      await nft.connect(bob).buyResale(1, { value: STD_PRICE });
      expect(await nft.ownedPerEvent(1, alice.address)).to.equal(1);
      await expect(nft.connect(alice).buyTicket(1, 1, 1, { value: STD_PRICE }))
        .to.be.revertedWithCustomError(nft, "WalletLimitExceeded");
    });

    it("từ chối khi sự kiện đã bắt đầu hoặc bị huỷ", async function () {
      const { nft, organizer, alice, info } = await loadFixture(eventFixture);
      await nft.connect(organizer).createEvent(await eventInput(), TIERS);
      await nft.connect(organizer).cancelEvent(2);
      await expect(nft.connect(alice).buyTicket(2, 0, 1, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "EventIsCancelled");

      await time.increaseTo(info.startTime);
      await expect(nft.connect(alice).buyTicket(1, 0, 1, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "EventAlreadyStarted");
    });
  });

  // ─────────────────────────── Chặn chuyển nhượng ───────────────────────────

  describe("CHỐNG ĐẦU CƠ: chặn chuyển nhượng tự do", function () {
    it("transferFrom / safeTransferFrom bị chặn", async function () {
      const { nft, alice, bob, tokenId } = await loadFixture(purchasedFixture);
      await expect(nft.connect(alice).transferFrom(alice.address, bob.address, tokenId))
        .to.be.revertedWithCustomError(nft, "TransfersDisabled");
      await expect(
        nft.connect(alice)["safeTransferFrom(address,address,uint256)"](alice.address, bob.address, tokenId)
      ).to.be.revertedWithCustomError(nft, "TransfersDisabled");
    });

    it("approve / setApprovalForAll bị chặn (không lên sàn ngoài được)", async function () {
      const { nft, alice, bob, tokenId } = await loadFixture(purchasedFixture);
      await expect(nft.connect(alice).approve(bob.address, tokenId))
        .to.be.revertedWithCustomError(nft, "TransfersDisabled");
      await expect(nft.connect(alice).setApprovalForAll(bob.address, true))
        .to.be.revertedWithCustomError(nft, "TransfersDisabled");
    });
  });

  // ─────────────────────────── Bán lại ───────────────────────────

  describe("Chợ bán lại", function () {
    it("rao bán trong giới hạn giá trần", async function () {
      const { nft, alice, tokenId } = await loadFixture(purchasedFixture);
      const cap = await nft.maxResalePrice(tokenId);
      expect(cap).to.equal((VIP_PRICE * 110n) / 100n);
      await expect(nft.connect(alice).listForResale(tokenId, cap))
        .to.emit(nft, "TicketListed")
        .withArgs(tokenId, alice.address, cap);
      const l = await nft.getListing(tokenId);
      expect(l.seller).to.equal(alice.address);
      expect(l.price).to.equal(cap);
    });

    it("CHỐNG ĐẦU CƠ: từ chối giá vượt giá trần hoặc bằng 0", async function () {
      const { nft, alice, tokenId } = await loadFixture(purchasedFixture);
      const cap = await nft.maxResalePrice(tokenId);
      await expect(nft.connect(alice).listForResale(tokenId, cap + 1n))
        .to.be.revertedWithCustomError(nft, "PriceExceedsCap");
      await expect(nft.connect(alice).listForResale(tokenId, 0))
        .to.be.revertedWithCustomError(nft, "PriceExceedsCap");
    });

    it("chỉ chủ vé được rao/huỷ rao", async function () {
      const { nft, alice, bob, tokenId } = await loadFixture(purchasedFixture);
      await expect(nft.connect(bob).listForResale(tokenId, VIP_PRICE))
        .to.be.revertedWithCustomError(nft, "NotTicketOwner");
      await nft.connect(alice).listForResale(tokenId, VIP_PRICE);
      await expect(nft.connect(bob).cancelListing(tokenId)).to.be.revertedWithCustomError(nft, "NotTicketOwner");
    });

    it("mua lại thành công: NFT đổi chủ, tiền về người bán", async function () {
      const { nft, alice, bob, tokenId } = await loadFixture(purchasedFixture);
      const price = ethers.parseEther("0.105");
      await nft.connect(alice).listForResale(tokenId, price);

      const tx = nft.connect(bob).buyResale(tokenId, { value: price });
      await expect(tx).to.emit(nft, "TicketResold").withArgs(tokenId, alice.address, bob.address, price);
      await expect(tx).to.changeEtherBalances([alice, bob], [price, -price]);

      expect(await nft.ownerOf(tokenId)).to.equal(bob.address);
      expect((await nft.getListing(tokenId)).seller).to.equal(ethers.ZeroAddress);
      expect(await nft.ownedPerEvent(1, alice.address)).to.equal(0);
      expect(await nft.ownedPerEvent(1, bob.address)).to.equal(1);
      // giá trần vẫn tính theo giá gốc, không cộng dồn qua các lần bán
      expect(await nft.maxResalePrice(tokenId)).to.equal((VIP_PRICE * 110n) / 100n);
    });

    it("từ chối mua: chưa rao, sai tiền, tự mua vé của mình", async function () {
      const { nft, alice, bob, tokenId } = await loadFixture(purchasedFixture);
      await expect(nft.connect(bob).buyResale(tokenId, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "NotListed");
      await nft.connect(alice).listForResale(tokenId, VIP_PRICE);
      await expect(nft.connect(bob).buyResale(tokenId, { value: 1 }))
        .to.be.revertedWithCustomError(nft, "IncorrectPayment");
      await expect(nft.connect(alice).buyResale(tokenId, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "CannotBuyOwnTicket");
    });

    it("CHỐNG ĐẦU CƠ: người mua lại cũng bị giới hạn vé/ví", async function () {
      const { nft, alice, bob } = await loadFixture(eventFixture);
      await nft.connect(bob).buyTicket(1, 1, 2, { value: STD_PRICE * 2n });
      await nft.connect(alice).buyTicket(1, 1, 1, { value: STD_PRICE });
      await nft.connect(alice).listForResale(3, STD_PRICE);
      await expect(nft.connect(bob).buyResale(3, { value: STD_PRICE }))
        .to.be.revertedWithCustomError(nft, "WalletLimitExceeded");
    });

    it("huỷ rao bán", async function () {
      const { nft, alice, bob, tokenId } = await loadFixture(purchasedFixture);
      await expect(nft.connect(alice).cancelListing(tokenId)).to.be.revertedWithCustomError(nft, "NotListed");
      await nft.connect(alice).listForResale(tokenId, VIP_PRICE);
      await expect(nft.connect(alice).cancelListing(tokenId)).to.emit(nft, "ListingCancelled").withArgs(tokenId);
      await expect(nft.connect(bob).buyResale(tokenId, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "NotListed");
    });

    it("khoá bán lại khi sự kiện đã bắt đầu", async function () {
      const { nft, alice, bob, tokenId, info } = await loadFixture(purchasedFixture);
      await nft.connect(alice).listForResale(tokenId, VIP_PRICE);
      await time.increaseTo(info.startTime);
      await expect(nft.connect(bob).buyResale(tokenId, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "EventAlreadyStarted");
      await expect(nft.connect(alice).listForResale(tokenId, VIP_PRICE))
        .to.be.revertedWithCustomError(nft, "EventAlreadyStarted");
    });
  });

  // ─────────────────────────── Soát vé ───────────────────────────

  describe("CHỐNG VÉ GIẢ: soát vé bằng chữ ký EIP-712", function () {
    it("staff soát vé thành công với QR hợp lệ", async function () {
      const { nft, alice, staff, tokenId } = await loadFixture(purchasedFixture);
      const deadline = (await time.latest()) + 60;
      const sig = await signCheckIn(nft, alice, tokenId, deadline);

      await expect(nft.connect(staff).checkIn(tokenId, deadline, sig))
        .to.emit(nft, "TicketCheckedIn")
        .withArgs(tokenId, 1, alice.address, staff.address);
      expect((await nft.getTicket(tokenId)).used).to.be.true;
      expect(await nft.isTicketValid(tokenId)).to.be.false;
    });

    it("organizer cũng soát vé được; người ngoài thì không", async function () {
      const { nft, alice, organizer, outsider, tokenId } = await loadFixture(purchasedFixture);
      const deadline = (await time.latest()) + 60;
      const sig = await signCheckIn(nft, alice, tokenId, deadline);
      await expect(nft.connect(outsider).checkIn(tokenId, deadline, sig))
        .to.be.revertedWithCustomError(nft, "NotStaff");
      await expect(nft.connect(organizer).checkIn(tokenId, deadline, sig)).to.emit(nft, "TicketCheckedIn");
    });

    it("từ chối QR quét lần 2 (vé đã dùng)", async function () {
      const { nft, alice, staff, tokenId } = await loadFixture(purchasedFixture);
      const deadline = (await time.latest()) + 60;
      const sig = await signCheckIn(nft, alice, tokenId, deadline);
      await nft.connect(staff).checkIn(tokenId, deadline, sig);
      await expect(nft.connect(staff).checkIn(tokenId, deadline, sig))
        .to.be.revertedWithCustomError(nft, "TicketAlreadyUsed");
    });

    it("từ chối chữ ký không phải của chủ vé", async function () {
      const { nft, bob, staff, tokenId } = await loadFixture(purchasedFixture);
      const deadline = (await time.latest()) + 60;
      const sig = await signCheckIn(nft, bob, tokenId, deadline);
      await expect(nft.connect(staff).checkIn(tokenId, deadline, sig))
        .to.be.revertedWithCustomError(nft, "InvalidSignature");
      await expect(nft.connect(staff).checkIn(tokenId, deadline, "0x1234"))
        .to.be.revertedWithCustomError(nft, "InvalidSignature");
    });

    it("từ chối chữ ký bị sửa deadline (không khớp dữ liệu đã ký)", async function () {
      const { nft, alice, staff, tokenId } = await loadFixture(purchasedFixture);
      const deadline = (await time.latest()) + 60;
      const sig = await signCheckIn(nft, alice, tokenId, deadline);
      await expect(nft.connect(staff).checkIn(tokenId, deadline + 30, sig))
        .to.be.revertedWithCustomError(nft, "InvalidSignature");
    });

    it("từ chối QR hết hạn (ảnh chụp màn hình cũ)", async function () {
      const { nft, alice, staff, tokenId } = await loadFixture(purchasedFixture);
      const deadline = (await time.latest()) + 60;
      const sig = await signCheckIn(nft, alice, tokenId, deadline);
      await time.increase(61);
      await expect(nft.connect(staff).checkIn(tokenId, deadline, sig))
        .to.be.revertedWithCustomError(nft, "QRExpired");
    });

    it("từ chối QR có thời hạn quá dài", async function () {
      const { nft, alice, staff, tokenId } = await loadFixture(purchasedFixture);
      const deadline = (await time.latest()) + 3600;
      const sig = await signCheckIn(nft, alice, tokenId, deadline);
      await expect(nft.connect(staff).checkIn(tokenId, deadline, sig))
        .to.be.revertedWithCustomError(nft, "QRDeadlineTooFar");
    });

    it("QR của chủ cũ vô hiệu sau khi vé đã bán lại", async function () {
      const { nft, alice, bob, staff, tokenId } = await loadFixture(purchasedFixture);
      const deadline = (await time.latest()) + 120;
      const oldSig = await signCheckIn(nft, alice, tokenId, deadline);
      await nft.connect(alice).listForResale(tokenId, VIP_PRICE);
      await nft.connect(bob).buyResale(tokenId, { value: VIP_PRICE });

      await expect(nft.connect(staff).checkIn(tokenId, deadline, oldSig))
        .to.be.revertedWithCustomError(nft, "InvalidSignature");
      const newSig = await signCheckIn(nft, bob, tokenId, deadline);
      await expect(nft.connect(staff).checkIn(tokenId, deadline, newSig)).to.emit(nft, "TicketCheckedIn");
    });

    it("chữ ký không dùng lại được trên contract khác (domain separator)", async function () {
      const { nft, alice, staff, tokenId } = await loadFixture(purchasedFixture);
      const other = await (await ethers.getContractFactory("EventTicketNFT")).deploy();
      const deadline = (await time.latest()) + 60;
      const sigForOther = await signCheckIn(other, alice, tokenId, deadline);
      await expect(nft.connect(staff).checkIn(tokenId, deadline, sigForOther))
        .to.be.revertedWithCustomError(nft, "InvalidSignature");
    });

    it("soát vé tự gỡ tin rao, vé đã dùng không bán lại được", async function () {
      const { nft, alice, staff, tokenId } = await loadFixture(purchasedFixture);
      await nft.connect(alice).listForResale(tokenId, VIP_PRICE);
      const deadline = (await time.latest()) + 60;
      const sig = await signCheckIn(nft, alice, tokenId, deadline);
      await expect(nft.connect(staff).checkIn(tokenId, deadline, sig)).to.emit(nft, "ListingCancelled");
      expect((await nft.getListing(tokenId)).seller).to.equal(ethers.ZeroAddress);
      await expect(nft.connect(alice).listForResale(tokenId, VIP_PRICE))
        .to.be.revertedWithCustomError(nft, "TicketAlreadyUsed");
    });

    it("digest on-chain khớp với typed data ở FE", async function () {
      const { nft, tokenId } = await loadFixture(purchasedFixture);
      const { chainId } = await ethers.provider.getNetwork();
      const digest = ethers.TypedDataEncoder.hash(
        { name: "FairPass", version: "1", chainId, verifyingContract: await nft.getAddress() },
        { CheckIn: [{ name: "tokenId", type: "uint256" }, { name: "deadline", type: "uint256" }] },
        { tokenId, deadline: 123 }
      );
      expect(await nft.checkInDigest(tokenId, 123)).to.equal(digest);
    });
  });

  // ─────────────────────────── Huỷ & hoàn tiền ───────────────────────────

  describe("Huỷ sự kiện & hoàn tiền", function () {
    it("organizer huỷ, người giữ vé tự rút lại giá gốc, vé bị burn", async function () {
      const { nft, organizer, alice, tokenId } = await loadFixture(purchasedFixture);
      await expect(nft.connect(organizer).cancelEvent(1)).to.emit(nft, "EventCancelled").withArgs(1);
      expect(await nft.isTicketValid(tokenId)).to.be.false;

      const tx = nft.connect(alice).claimRefund(tokenId);
      await expect(tx).to.emit(nft, "RefundClaimed").withArgs(tokenId, alice.address, VIP_PRICE);
      await expect(tx).to.changeEtherBalances([alice, nft], [VIP_PRICE, -VIP_PRICE]);

      await expect(nft.ownerOf(tokenId)).to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
      expect(await nft.ownedPerEvent(1, alice.address)).to.equal(0);
      expect((await nft.getEventInfo(1)).revenue).to.equal(0);
    });

    it("người mua lại được hoàn giá gốc sơ cấp", async function () {
      const { nft, organizer, alice, bob, tokenId } = await loadFixture(purchasedFixture);
      await nft.connect(alice).listForResale(tokenId, ethers.parseEther("0.11"));
      await nft.connect(bob).buyResale(tokenId, { value: ethers.parseEther("0.11") });
      await nft.connect(organizer).cancelEvent(1);
      await expect(nft.connect(bob).claimRefund(tokenId)).to.changeEtherBalance(bob, VIP_PRICE);
    });

    it("từ chối hoàn tiền khi sự kiện chưa huỷ / không phải chủ / rút 2 lần", async function () {
      const { nft, organizer, alice, bob, tokenId } = await loadFixture(purchasedFixture);
      await expect(nft.connect(alice).claimRefund(tokenId)).to.be.revertedWithCustomError(nft, "EventNotCancelled");
      await nft.connect(organizer).cancelEvent(1);
      await expect(nft.connect(bob).claimRefund(tokenId)).to.be.revertedWithCustomError(nft, "NotTicketOwner");
      await nft.connect(alice).claimRefund(tokenId);
      await expect(nft.connect(alice).claimRefund(tokenId)).to.be.reverted;
    });

    it("quyền huỷ: chỉ organizer/admin, organizer không huỷ được sau giờ diễn", async function () {
      const { nft, admin, organizer, alice, info } = await loadFixture(purchasedFixture);
      await expect(nft.connect(alice).cancelEvent(1)).to.be.revertedWithCustomError(nft, "NotEventOrganizer");
      await time.increaseTo(info.startTime);
      await expect(nft.connect(organizer).cancelEvent(1)).to.be.revertedWithCustomError(nft, "EventAlreadyStarted");
      await expect(nft.connect(admin).cancelEvent(1)).to.emit(nft, "EventCancelled");
      await expect(nft.connect(admin).cancelEvent(1)).to.be.revertedWithCustomError(nft, "EventIsCancelled");
    });

    it("vé của sự kiện bị huỷ không soát / bán lại được", async function () {
      const { nft, organizer, alice, staff, tokenId } = await loadFixture(purchasedFixture);
      await nft.connect(organizer).cancelEvent(1);
      const deadline = (await time.latest()) + 60;
      const sig = await signCheckIn(nft, alice, tokenId, deadline);
      await expect(nft.connect(staff).checkIn(tokenId, deadline, sig))
        .to.be.revertedWithCustomError(nft, "EventIsCancelled");
      await expect(nft.connect(alice).listForResale(tokenId, VIP_PRICE))
        .to.be.revertedWithCustomError(nft, "EventIsCancelled");
    });
  });

  // ─────────────────────────── Rút tiền ───────────────────────────

  describe("Escrow & rút doanh thu", function () {
    it("không rút được trước giờ diễn", async function () {
      const { nft, organizer } = await loadFixture(purchasedFixture);
      await expect(nft.connect(organizer).withdrawRevenue(1)).to.be.revertedWithCustomError(nft, "EventNotStarted");
    });

    it("rút thành công sau giờ diễn, không rút lần 2, không huỷ được nữa", async function () {
      const { nft, admin, organizer, info } = await loadFixture(purchasedFixture);
      await time.increaseTo(info.startTime);
      const tx = nft.connect(organizer).withdrawRevenue(1);
      await expect(tx).to.emit(nft, "RevenueWithdrawn").withArgs(1, organizer.address, VIP_PRICE);
      await expect(tx).to.changeEtherBalance(organizer, VIP_PRICE);
      await expect(nft.connect(organizer).withdrawRevenue(1)).to.be.revertedWithCustomError(nft, "NothingToWithdraw");
      await expect(nft.connect(admin).cancelEvent(1)).to.be.revertedWithCustomError(nft, "AlreadyWithdrawn");
    });

    it("chỉ organizer của sự kiện mới rút được; sự kiện huỷ thì không rút", async function () {
      const { nft, admin, organizer, info } = await loadFixture(purchasedFixture);
      await time.increaseTo(info.startTime);
      await expect(nft.connect(admin).withdrawRevenue(1)).to.be.revertedWithCustomError(nft, "NotEventOrganizer");
      await nft.connect(admin).cancelEvent(1);
      await expect(nft.connect(organizer).withdrawRevenue(1)).to.be.revertedWithCustomError(nft, "EventIsCancelled");
    });
  });

  // ─────────────────────────── Pausable ───────────────────────────

  describe("Tạm dừng khẩn cấp", function () {
    it("admin pause chặn mua/bán/soát, vẫn cho hoàn tiền; unpause mở lại", async function () {
      const { nft, admin, organizer, alice, tokenId } = await loadFixture(purchasedFixture);
      await nft.connect(admin).pause();
      await expect(nft.connect(alice).buyTicket(1, 0, 1, { value: VIP_PRICE }))
        .to.be.revertedWithCustomError(nft, "EnforcedPause");
      await expect(nft.connect(alice).listForResale(tokenId, VIP_PRICE))
        .to.be.revertedWithCustomError(nft, "EnforcedPause");

      await nft.connect(admin).cancelEvent(1);
      await expect(nft.connect(alice).claimRefund(tokenId)).to.emit(nft, "RefundClaimed");

      await nft.connect(admin).unpause();
      await expect(nft.connect(organizer).createEvent(await eventInput(), TIERS)).to.emit(nft, "EventCreated");
    });

    it("không phải admin thì không pause được", async function () {
      const { nft, organizer } = await loadFixture(deployFixture);
      await expect(nft.connect(organizer).pause())
        .to.be.revertedWithCustomError(nft, "AccessControlUnauthorizedAccount");
    });
  });

  // ─────────────────────────── View ───────────────────────────

  describe("View", function () {
    it("isTicketValid / getTicket với token không tồn tại", async function () {
      const { nft } = await loadFixture(eventFixture);
      expect(await nft.isTicketValid(99)).to.be.false;
      await expect(nft.getTicket(99)).to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
      await expect(nft.tokenURI(99)).to.be.revertedWithCustomError(nft, "ERC721NonexistentToken");
    });
  });
});
