const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EventTicketNFT", function () {
  let contract;
  let owner, organizer, buyer1, buyer2, buyer3;
  let eventDate;

  // Helper: Tạo sự kiện mặc định
  async function createDefaultEvent(signer = organizer) {
    const tx = await contract.connect(signer).createEvent(
      "Đêm nhạc ABC",                    // name
      eventDate,                          // date
      "Nhà hát Lớn HCM",                // venue
      ethers.parseEther("0.1"),          // ticketPrice (0.1 ETH)
      100,                               // maxTickets
      4,                                  // maxTicketsPerWallet (chống đầu cơ)
      110                                // resalePriceCap (110%)
    );
    return tx;
  }

  beforeEach(async function () {
    [owner, organizer, buyer1, buyer2, buyer3] = await ethers.getSigners();

    const EventTicketNFT = await ethers.getContractFactory("EventTicketNFT");
    contract = await EventTicketNFT.deploy();
    await contract.waitForDeployment();

    // Cấp role ORGANIZER cho organizer
    const ORGANIZER_ROLE = await contract.ORGANIZER_ROLE();
    await contract.grantRole(ORGANIZER_ROLE, organizer.address);

    // Ngày sự kiện: 30 ngày tương lai
    const block = await ethers.provider.getBlock("latest");
    eventDate = block.timestamp + 30 * 24 * 60 * 60;
  });

  // ═══════════════════════════════════════════════════════════════
  //                       DEPLOYMENT
  // ═══════════════════════════════════════════════════════════════

  describe("Deployment", function () {
    it("Nên đặt tên token đúng", async function () {
      expect(await contract.name()).to.equal("EventTicketNFT");
      expect(await contract.symbol()).to.equal("ETNFT");
    });

    it("Nên cấp DEFAULT_ADMIN_ROLE cho deployer", async function () {
      const DEFAULT_ADMIN_ROLE = await contract.DEFAULT_ADMIN_ROLE();
      expect(await contract.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be
        .true;
    });

    it("Nên cấp ORGANIZER_ROLE cho deployer", async function () {
      const ORGANIZER_ROLE = await contract.ORGANIZER_ROLE();
      expect(await contract.hasRole(ORGANIZER_ROLE, owner.address)).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //                    EVENT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════

  describe("Tạo sự kiện", function () {
    it("Organizer tạo sự kiện thành công", async function () {
      await expect(createDefaultEvent())
        .to.emit(contract, "EventCreated")
        .withArgs(0, "Đêm nhạc ABC", organizer.address, ethers.parseEther("0.1"), 100);

      const evt = await contract.getEvent(0);
      expect(evt.name).to.equal("Đêm nhạc ABC");
      expect(evt.organizer).to.equal(organizer.address);
      expect(evt.maxTicketsPerWallet).to.equal(4);
      expect(evt.resalePriceCap).to.equal(110);
      expect(evt.isActive).to.be.true;
    });

    it("Từ chối tạo sự kiện khi không có ORGANIZER_ROLE", async function () {
      await expect(createDefaultEvent(buyer1)).to.be.reverted;
    });

    it("Từ chối khi tên sự kiện rỗng", async function () {
      await expect(
        contract.connect(organizer).createEvent("", eventDate, "Venue", ethers.parseEther("0.1"), 100, 4, 110)
      ).to.be.revertedWith("Name required");
    });

    it("Từ chối khi ngày đã qua", async function () {
      const pastDate = Math.floor(Date.now() / 1000) - 86400;
      await expect(
        contract.connect(organizer).createEvent("Test", pastDate, "Venue", ethers.parseEther("0.1"), 100, 4, 110)
      ).to.be.revertedWith("Date must be in the future");
    });

    it("Từ chối khi resalePriceCap < 100", async function () {
      await expect(
        contract.connect(organizer).createEvent("Test", eventDate, "Venue", ethers.parseEther("0.1"), 100, 4, 50)
      ).to.be.revertedWith("Resale cap must be >= 100%");
    });
  });

  describe("Toggle sự kiện", function () {
    it("Organizer bật/tắt sự kiện", async function () {
      await createDefaultEvent();
      await contract.connect(organizer).toggleEventActive(0);
      let evt = await contract.getEvent(0);
      expect(evt.isActive).to.be.false;

      await contract.connect(organizer).toggleEventActive(0);
      evt = await contract.getEvent(0);
      expect(evt.isActive).to.be.true;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //                       BUY TICKET
  // ═══════════════════════════════════════════════════════════════

  describe("Mua vé", function () {
    beforeEach(async function () {
      await createDefaultEvent();
    });

    it("Mua vé thành công", async function () {
      const tokenURI = "ipfs://QmTest123/metadata.json";

      await expect(
        contract
          .connect(buyer1)
          .buyTicket(0, tokenURI, { value: ethers.parseEther("0.1") })
      )
        .to.emit(contract, "TicketPurchased")
        .withArgs(buyer1.address, 0, 0);

      // Kiểm tra NFT ownership
      expect(await contract.ownerOf(0)).to.equal(buyer1.address);

      // Kiểm tra tokenURI
      expect(await contract.tokenURI(0)).to.equal(tokenURI);

      // Kiểm tra ticket info
      const ticket = await contract.getTicket(0);
      expect(ticket.eventId).to.equal(0);
      expect(ticket.originalPrice).to.equal(ethers.parseEther("0.1"));
      expect(ticket.isUsed).to.be.false;
    });

    it("Từ chối khi gửi sai giá", async function () {
      await expect(
        contract
          .connect(buyer1)
          .buyTicket(0, "ipfs://test", { value: ethers.parseEther("0.05") })
      ).to.be.revertedWith("Incorrect payment amount");
    });

    it("Từ chối khi sự kiện không active", async function () {
      await contract.connect(organizer).toggleEventActive(0);
      await expect(
        contract
          .connect(buyer1)
          .buyTicket(0, "ipfs://test", { value: ethers.parseEther("0.1") })
      ).to.be.revertedWith("Event not active");
    });

    it("CHỐNG ĐẦU CƠ: Từ chối khi vượt giới hạn vé/ví", async function () {
      // maxTicketsPerWallet = 4
      for (let i = 0; i < 4; i++) {
        await contract
          .connect(buyer1)
          .buyTicket(0, `ipfs://ticket${i}`, {
            value: ethers.parseEther("0.1"),
          });
      }

      // Vé thứ 5 phải bị từ chối
      await expect(
        contract
          .connect(buyer1)
          .buyTicket(0, "ipfs://ticket4", {
            value: ethers.parseEther("0.1"),
          })
      ).to.be.revertedWith("Exceeds per-wallet limit");
    });

    it("Contract nhận đúng số tiền", async function () {
      await contract
        .connect(buyer1)
        .buyTicket(0, "ipfs://test", { value: ethers.parseEther("0.1") });

      const funds = await contract.eventFunds(0);
      expect(funds).to.equal(ethers.parseEther("0.1"));
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //                  RESALE — CHỐNG ĐẦU CƠ
  // ═══════════════════════════════════════════════════════════════

  describe("Bán lại vé", function () {
    beforeEach(async function () {
      await createDefaultEvent();
      await contract
        .connect(buyer1)
        .buyTicket(0, "ipfs://ticket0", { value: ethers.parseEther("0.1") });
    });

    it("Rao bán lại thành công trong giới hạn giá", async function () {
      // resalePriceCap = 110%, giá gốc = 0.1 ETH → max = 0.11 ETH
      await expect(
        contract.connect(buyer1).listForResale(0, ethers.parseEther("0.11"))
      )
        .to.emit(contract, "TicketListedForResale")
        .withArgs(0, ethers.parseEther("0.11"));

      const ticket = await contract.getTicket(0);
      expect(ticket.isForSale).to.be.true;
      expect(ticket.resalePrice).to.equal(ethers.parseEther("0.11"));
    });

    it("CHỐNG ĐẦU CƠ: Từ chối khi giá vượt giá trần", async function () {
      // Max = 0.11 ETH, thử bán 0.2 ETH
      await expect(
        contract.connect(buyer1).listForResale(0, ethers.parseEther("0.2"))
      ).to.be.revertedWith("Price exceeds resale cap");
    });

    it("Người khác mua vé bán lại thành công", async function () {
      await contract
        .connect(buyer1)
        .listForResale(0, ethers.parseEther("0.11"));

      const sellerBalanceBefore = await ethers.provider.getBalance(
        buyer1.address
      );

      await expect(
        contract
          .connect(buyer2)
          .buyResaleTicket(0, { value: ethers.parseEther("0.11") })
      )
        .to.emit(contract, "TicketResold")
        .withArgs(0, buyer1.address, buyer2.address, ethers.parseEther("0.11"));

      // NFT đã chuyển sang buyer2
      expect(await contract.ownerOf(0)).to.equal(buyer2.address);

      // Seller nhận tiền
      const sellerBalanceAfter = await ethers.provider.getBalance(
        buyer1.address
      );
      expect(sellerBalanceAfter).to.be.greaterThan(sellerBalanceBefore);

      // Vé không còn rao bán
      const ticket = await contract.getTicket(0);
      expect(ticket.isForSale).to.be.false;
    });

    it("Không thể mua vé của chính mình", async function () {
      await contract
        .connect(buyer1)
        .listForResale(0, ethers.parseEther("0.11"));
      await expect(
        contract
          .connect(buyer1)
          .buyResaleTicket(0, { value: ethers.parseEther("0.11") })
      ).to.be.revertedWith("Cannot buy own ticket");
    });

    it("Hủy rao bán thành công", async function () {
      await contract
        .connect(buyer1)
        .listForResale(0, ethers.parseEther("0.11"));
      await contract.connect(buyer1).cancelResaleListing(0);

      const ticket = await contract.getTicket(0);
      expect(ticket.isForSale).to.be.false;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //             CHECK-IN — XÁC THỰC CHỮ KÝ SỐ
  // ═══════════════════════════════════════════════════════════════

  describe("Soát vé (Check-in)", function () {
    beforeEach(async function () {
      await createDefaultEvent();
      await contract
        .connect(buyer1)
        .buyTicket(0, "ipfs://ticket0", { value: ethers.parseEther("0.1") });
    });

    it("Soát vé thành công bằng chữ ký hợp lệ", async function () {
      // Ban tổ chức tạo thông điệp challenge
      const message = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "string"],
        [0, 0, "check-in-challenge"]
      );

      // Người giữ vé ký thông điệp bằng private key
      const signature = await buyer1.signMessage(ethers.getBytes(message));

      // Ban tổ chức gọi checkIn
      await expect(
        contract.connect(organizer).checkIn(0, message, signature)
      )
        .to.emit(contract, "TicketCheckedIn")
        .withArgs(0, buyer1.address);

      // Vé đã được đánh dấu đã sử dụng
      const ticket = await contract.getTicket(0);
      expect(ticket.isUsed).to.be.true;
    });

    it("Từ chối chữ ký không hợp lệ (người khác ký)", async function () {
      const message = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "string"],
        [0, 0, "check-in-challenge"]
      );

      // buyer2 (không phải chủ vé) ký
      const fakeSignature = await buyer2.signMessage(ethers.getBytes(message));

      await expect(
        contract.connect(organizer).checkIn(0, message, fakeSignature)
      ).to.be.revertedWith("Invalid signature - not ticket owner");
    });

    it("Từ chối soát vé đã sử dụng", async function () {
      const message = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "string"],
        [0, 0, "challenge"]
      );
      const signature = await buyer1.signMessage(ethers.getBytes(message));

      await contract.connect(organizer).checkIn(0, message, signature);

      // Soát lần 2
      await expect(
        contract.connect(organizer).checkIn(0, message, signature)
      ).to.be.revertedWith("Already checked in");
    });

    it("Chỉ ORGANIZER mới được soát vé", async function () {
      const message = ethers.solidityPackedKeccak256(
        ["uint256", "uint256", "string"],
        [0, 0, "challenge"]
      );
      const signature = await buyer1.signMessage(ethers.getBytes(message));

      await expect(
        contract.connect(buyer2).checkIn(0, message, signature)
      ).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //                     WITHDRAW FUNDS
  // ═══════════════════════════════════════════════════════════════

  describe("Rút tiền", function () {
    beforeEach(async function () {
      await createDefaultEvent();
      await contract
        .connect(buyer1)
        .buyTicket(0, "ipfs://ticket0", { value: ethers.parseEther("0.1") });
    });

    it("Organizer rút tiền thành công", async function () {
      const balanceBefore = await ethers.provider.getBalance(
        organizer.address
      );

      await expect(contract.connect(organizer).withdrawEventFunds(0))
        .to.emit(contract, "FundsWithdrawn")
        .withArgs(0, organizer.address, ethers.parseEther("0.1"));

      const balanceAfter = await ethers.provider.getBalance(organizer.address);
      expect(balanceAfter).to.be.greaterThan(balanceBefore);

      // eventFunds về 0
      expect(await contract.eventFunds(0)).to.equal(0);
    });

    it("Từ chối khi không có tiền", async function () {
      await contract.connect(organizer).withdrawEventFunds(0);
      await expect(
        contract.connect(organizer).withdrawEventFunds(0)
      ).to.be.revertedWith("No funds to withdraw");
    });

    it("Từ chối khi không phải organizer của sự kiện", async function () {
      // owner có ORGANIZER_ROLE nhưng không phải event organizer
      await expect(
        contract.connect(owner).withdrawEventFunds(0)
      ).to.be.revertedWith("Not event organizer");
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //                       PAUSABLE
  // ═══════════════════════════════════════════════════════════════

  describe("Tạm dừng (Pausable)", function () {
    beforeEach(async function () {
      await createDefaultEvent();
    });

    it("Admin tạm dừng và mở lại", async function () {
      await contract.connect(owner).pause();

      await expect(
        contract
          .connect(buyer1)
          .buyTicket(0, "ipfs://test", { value: ethers.parseEther("0.1") })
      ).to.be.reverted;

      await contract.connect(owner).unpause();

      await expect(
        contract
          .connect(buyer1)
          .buyTicket(0, "ipfs://test", { value: ethers.parseEther("0.1") })
      ).not.to.be.reverted;
    });

    it("Không phải admin không thể pause", async function () {
      await expect(contract.connect(buyer1).pause()).to.be.reverted;
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //                     VIEW FUNCTIONS
  // ═══════════════════════════════════════════════════════════════

  describe("View functions", function () {
    beforeEach(async function () {
      await createDefaultEvent();
      await contract
        .connect(buyer1)
        .buyTicket(0, "ipfs://ticket0", { value: ethers.parseEther("0.1") });
      await contract
        .connect(buyer1)
        .buyTicket(0, "ipfs://ticket1", { value: ethers.parseEther("0.1") });
    });

    it("getMyTickets trả về đúng danh sách", async function () {
      const myTickets = await contract.connect(buyer1).getMyTickets(0);
      expect(myTickets.length).to.equal(2);
      expect(myTickets[0]).to.equal(0);
      expect(myTickets[1]).to.equal(1);
    });

    it("getResaleTickets trả về vé đang rao bán", async function () {
      await contract
        .connect(buyer1)
        .listForResale(0, ethers.parseEther("0.11"));

      const resaleTickets = await contract.getResaleTickets(0);
      expect(resaleTickets.length).to.equal(1);
      expect(resaleTickets[0]).to.equal(0);
    });

    it("isTicketValid trả về đúng trạng thái", async function () {
      expect(await contract.isTicketValid(0)).to.be.true;
    });

    it("getTotalEvents đếm đúng", async function () {
      expect(await contract.getTotalEvents()).to.equal(1);
    });
  });
});
