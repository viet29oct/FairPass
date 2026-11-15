// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title  EventTicketNFT (FairPass)
 * @notice Hệ thống bán vé sự kiện dạng NFT (ERC-721) chống đầu cơ và chống vé giả.
 *
 * Chống đầu cơ:
 *   1. Giới hạn số vé mỗi ví (mua sơ cấp + nắm giữ).
 *   2. Giá trần bán lại = giá gốc × resaleCapPercent / 100.
 *   3. Chặn chuyển nhượng tự do: vé chỉ đổi chủ qua chợ bán lại nội bộ,
 *      nên không thể lách giá trần bằng transferFrom / sàn NFT bên ngoài.
 *
 * Chống vé giả:
 *   1. Mỗi vé là một NFT duy nhất, quyền sở hữu xác minh trên blockchain.
 *   2. Soát vé bằng chữ ký EIP-712 có thời hạn của chủ vé (QR động):
 *      contract khôi phục địa chỉ ký (ECDSA) và so với ownerOf(tokenId).
 *
 * Tài chính:
 *   - Tiền bán vé sơ cấp được giữ trong contract (escrow) tới khi sự kiện bắt đầu.
 *   - Sự kiện bị huỷ → người giữ vé tự rút lại giá gốc (pull payment), vé bị burn.
 */
contract EventTicketNFT is ERC721, AccessControl, ReentrancyGuard, Pausable, EIP712 {
    // ═══════════════════════════════════════════════════════════════
    //                          CONSTANTS
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");

    /// @dev EIP-712 typehash cho thông điệp soát vé
    bytes32 public constant CHECKIN_TYPEHASH =
        keccak256("CheckIn(uint256 tokenId,uint256 deadline)");

    /// @notice Thời hạn tối đa của một mã QR soát vé
    uint256 public constant MAX_QR_VALIDITY = 10 minutes;

    uint256 public constant MAX_TIERS = 10;

    // ═══════════════════════════════════════════════════════════════
    //                       DATA STRUCTURES
    // ═══════════════════════════════════════════════════════════════

    struct EventInput {
        string name;
        string venue;
        uint64 startTime; // Thời điểm bắt đầu (unix)
        string metadataURI; // ipfs:// thông tin + poster sự kiện
        uint32 maxPerWallet; // Giới hạn vé mỗi ví
        uint16 resaleCapPercent; // Giá trần bán lại, vd 110 = 110% giá gốc
    }

    struct TierInput {
        string name; // VIP, Thường, ...
        uint256 price; // wei
        uint32 supply;
        string metadataURI; // ipfs:// metadata NFT của hạng vé
    }

    struct EventInfo {
        address organizer;
        string name;
        string venue;
        uint64 startTime;
        string metadataURI;
        uint32 maxPerWallet;
        uint16 resaleCapPercent;
        bool cancelled;
        bool withdrawn;
        uint256 revenue; // Tiền đang giữ trong escrow
    }

    struct Tier {
        string name;
        uint256 price;
        uint32 supply;
        uint32 sold;
        string metadataURI;
    }

    struct Ticket {
        uint256 eventId;
        uint256 tierId;
        uint256 pricePaid; // Giá mua sơ cấp — cơ sở tính giá trần & hoàn tiền
        bool used;
    }

    struct Listing {
        address seller;
        uint256 price;
    }

    // ═══════════════════════════════════════════════════════════════
    //                          STORAGE
    // ═══════════════════════════════════════════════════════════════

    uint256 public nextEventId = 1;
    uint256 public nextTokenId = 1;

    mapping(uint256 => EventInfo) private _events;
    mapping(uint256 => Tier[]) private _tiers;
    mapping(uint256 => Ticket) private _tickets;
    mapping(uint256 => Listing) private _listings;

    /// eventId => staff => được phép soát vé
    mapping(uint256 => mapping(address => bool)) public isStaff;
    /// eventId => ví => số vé đã mua sơ cấp
    mapping(uint256 => mapping(address => uint256)) public primaryPurchased;
    /// eventId => ví => số vé đang nắm giữ
    mapping(uint256 => mapping(address => uint256)) public ownedPerEvent;

    /// @dev Bật trong buyResale để cho phép chuyển NFT nội bộ
    bool private _inMarketTransfer;

    // ═══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ═══════════════════════════════════════════════════════════════

    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        string name,
        uint64 startTime,
        string metadataURI
    );
    event TierCreated(
        uint256 indexed eventId,
        uint256 indexed tierId,
        string name,
        uint256 price,
        uint32 supply
    );
    event EventCancelled(uint256 indexed eventId);
    event StaffUpdated(uint256 indexed eventId, address indexed staff, bool allowed);
    event TicketPurchased(
        uint256 indexed tokenId,
        uint256 indexed eventId,
        uint256 indexed tierId,
        address buyer,
        uint256 price
    );
    event TicketListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed tokenId);
    event TicketResold(
        uint256 indexed tokenId,
        address indexed seller,
        address indexed buyer,
        uint256 price
    );
    event TicketCheckedIn(uint256 indexed tokenId, uint256 indexed eventId, address holder, address staff);
    event RefundClaimed(uint256 indexed tokenId, address indexed holder, uint256 amount);
    event RevenueWithdrawn(uint256 indexed eventId, address indexed organizer, uint256 amount);

    // ═══════════════════════════════════════════════════════════════
    //                          ERRORS
    // ═══════════════════════════════════════════════════════════════

    error EventNotFound();
    error InvalidEventData();
    error InvalidTier();
    error NotEventOrganizer();
    error NotStaff();
    error EventIsCancelled();
    error EventNotCancelled();
    error EventAlreadyStarted();
    error EventNotStarted();
    error AlreadyWithdrawn();
    error SoldOut();
    error InvalidQuantity();
    error IncorrectPayment();
    error WalletLimitExceeded();
    error NotTicketOwner();
    error TicketAlreadyUsed();
    error PriceExceedsCap();
    error NotListed();
    error CannotBuyOwnTicket();
    error TransfersDisabled();
    error InvalidSignature();
    error QRExpired();
    error QRDeadlineTooFar();
    error NothingToWithdraw();
    error PaymentFailed();

    // ═══════════════════════════════════════════════════════════════
    //                        CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor() ERC721("FairPass Ticket", "FPT") EIP712("FairPass", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORGANIZER_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════
    //                         MODIFIERS
    // ═══════════════════════════════════════════════════════════════

    modifier eventExists(uint256 eventId) {
        if (eventId == 0 || eventId >= nextEventId) revert EventNotFound();
        _;
    }

    modifier onlyEventOrganizer(uint256 eventId) {
        if (_events[eventId].organizer != msg.sender) revert NotEventOrganizer();
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //                    QUẢN LÝ SỰ KIỆN (ORGANIZER)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Tạo sự kiện mới cùng các hạng vé
     */
    function createEvent(
        EventInput calldata info,
        TierInput[] calldata tiers
    ) external onlyRole(ORGANIZER_ROLE) whenNotPaused returns (uint256 eventId) {
        if (
            bytes(info.name).length == 0 ||
            info.startTime <= block.timestamp ||
            info.maxPerWallet == 0 ||
            info.resaleCapPercent < 100
        ) revert InvalidEventData();
        if (tiers.length == 0 || tiers.length > MAX_TIERS) revert InvalidTier();

        eventId = nextEventId++;
        EventInfo storage evt = _events[eventId];
        evt.organizer = msg.sender;
        evt.name = info.name;
        evt.venue = info.venue;
        evt.startTime = info.startTime;
        evt.metadataURI = info.metadataURI;
        evt.maxPerWallet = info.maxPerWallet;
        evt.resaleCapPercent = info.resaleCapPercent;

        emit EventCreated(eventId, msg.sender, info.name, info.startTime, info.metadataURI);

        for (uint256 i = 0; i < tiers.length; i++) {
            TierInput calldata t = tiers[i];
            if (bytes(t.name).length == 0 || t.supply == 0) revert InvalidTier();
            _tiers[eventId].push(
                Tier({name: t.name, price: t.price, supply: t.supply, sold: 0, metadataURI: t.metadataURI})
            );
            emit TierCreated(eventId, i, t.name, t.price, t.supply);
        }
    }

    /**
     * @notice Thêm / gỡ nhân viên soát vé cho sự kiện
     */
    function setStaff(
        uint256 eventId,
        address staff,
        bool allowed
    ) external eventExists(eventId) onlyEventOrganizer(eventId) {
        isStaff[eventId][staff] = allowed;
        emit StaffUpdated(eventId, staff, allowed);
    }

    /**
     * @notice Huỷ sự kiện. Organizer chỉ huỷ được trước giờ diễn;
     *         admin có thể huỷ bất cứ lúc nào nếu tiền chưa bị rút.
     */
    function cancelEvent(uint256 eventId) external eventExists(eventId) {
        EventInfo storage evt = _events[eventId];
        bool isAdmin = hasRole(DEFAULT_ADMIN_ROLE, msg.sender);
        if (evt.organizer != msg.sender && !isAdmin) revert NotEventOrganizer();
        if (evt.cancelled) revert EventIsCancelled();
        if (evt.withdrawn) revert AlreadyWithdrawn();
        if (!isAdmin && block.timestamp >= evt.startTime) revert EventAlreadyStarted();

        evt.cancelled = true;
        emit EventCancelled(eventId);
    }

    /**
     * @notice Organizer rút tiền bán vé sau khi sự kiện đã bắt đầu
     */
    function withdrawRevenue(
        uint256 eventId
    ) external eventExists(eventId) onlyEventOrganizer(eventId) nonReentrant whenNotPaused {
        EventInfo storage evt = _events[eventId];
        if (evt.cancelled) revert EventIsCancelled();
        if (block.timestamp < evt.startTime) revert EventNotStarted();
        uint256 amount = evt.revenue;
        if (amount == 0) revert NothingToWithdraw();

        // Effects
        evt.revenue = 0;
        evt.withdrawn = true;

        // Interactions
        _sendValue(msg.sender, amount);
        emit RevenueWithdrawn(eventId, msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                        MUA VÉ SƠ CẤP
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Mua `quantity` vé hạng `tierId` của sự kiện `eventId`
     */
    function buyTicket(
        uint256 eventId,
        uint256 tierId,
        uint256 quantity
    ) external payable eventExists(eventId) whenNotPaused nonReentrant {
        EventInfo storage evt = _events[eventId];
        if (evt.cancelled) revert EventIsCancelled();
        if (block.timestamp >= evt.startTime) revert EventAlreadyStarted();
        if (tierId >= _tiers[eventId].length) revert InvalidTier();
        if (quantity == 0) revert InvalidQuantity();

        Tier storage tier = _tiers[eventId][tierId];
        if (uint256(tier.sold) + quantity > tier.supply) revert SoldOut();
        if (msg.value != tier.price * quantity) revert IncorrectPayment();
        if (
            primaryPurchased[eventId][msg.sender] + quantity > evt.maxPerWallet ||
            ownedPerEvent[eventId][msg.sender] + quantity > evt.maxPerWallet
        ) revert WalletLimitExceeded();

        // Effects
        tier.sold += uint32(quantity);
        primaryPurchased[eventId][msg.sender] += quantity;
        evt.revenue += msg.value;

        // Mint (ownedPerEvent được cập nhật trong _update)
        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = nextTokenId++;
            _tickets[tokenId] = Ticket({eventId: eventId, tierId: tierId, pricePaid: tier.price, used: false});
            _safeMint(msg.sender, tokenId);
            emit TicketPurchased(tokenId, eventId, tierId, msg.sender, tier.price);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //                  CHỢ BÁN LẠI — CHỐNG ĐẦU CƠ
    // ═══════════════════════════════════════════════════════════════

    /// @notice Giá bán lại tối đa của một vé
    function maxResalePrice(uint256 tokenId) public view returns (uint256) {
        _requireOwned(tokenId);
        Ticket storage t = _tickets[tokenId];
        return (t.pricePaid * _events[t.eventId].resaleCapPercent) / 100;
    }

    /**
     * @notice Rao bán lại vé (hoặc đổi giá rao). Giá phải ≤ giá trần.
     */
    function listForResale(uint256 tokenId, uint256 price) external whenNotPaused {
        if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner();
        Ticket storage t = _tickets[tokenId];
        _requireTradable(t);
        if (price == 0 || price > maxResalePrice(tokenId)) revert PriceExceedsCap();

        _listings[tokenId] = Listing({seller: msg.sender, price: price});
        emit TicketListed(tokenId, msg.sender, price);
    }

    /// @notice Huỷ rao bán
    function cancelListing(uint256 tokenId) external {
        if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner();
        if (_listings[tokenId].seller == address(0)) revert NotListed();
        delete _listings[tokenId];
        emit ListingCancelled(tokenId);
    }

    /**
     * @notice Mua vé đang được rao bán lại. Tiền chuyển thẳng cho người bán.
     */
    function buyResale(uint256 tokenId) external payable whenNotPaused nonReentrant {
        Listing memory listing = _listings[tokenId];
        if (listing.seller == address(0)) revert NotListed();
        if (listing.seller == msg.sender) revert CannotBuyOwnTicket();
        if (msg.value != listing.price) revert IncorrectPayment();

        Ticket storage t = _tickets[tokenId];
        _requireTradable(t);
        if (ownedPerEvent[t.eventId][msg.sender] + 1 > _events[t.eventId].maxPerWallet)
            revert WalletLimitExceeded();

        // Effects
        delete _listings[tokenId];
        _inMarketTransfer = true;
        _transfer(listing.seller, msg.sender, tokenId);
        _inMarketTransfer = false;

        // Interactions
        _sendValue(listing.seller, msg.value);
        emit TicketResold(tokenId, listing.seller, msg.sender, msg.value);
    }

    // ═══════════════════════════════════════════════════════════════
    //              SOÁT VÉ — CHỮ KÝ SỐ EIP-712 (CHỐNG GIẢ)
    // ═══════════════════════════════════════════════════════════════

    /// @notice Digest EIP-712 mà chủ vé cần ký (FE dùng signTypedData)
    function checkInDigest(uint256 tokenId, uint256 deadline) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(CHECKIN_TYPEHASH, tokenId, deadline)));
    }

    /**
     * @notice Staff quét QR (tokenId, deadline, signature) và soát vé
     * @dev    Chữ ký phải do chủ vé hiện tại ký, còn hạn, vé chưa dùng.
     */
    function checkIn(uint256 tokenId, uint256 deadline, bytes calldata signature) external whenNotPaused {
        address holder = ownerOf(tokenId);
        Ticket storage t = _tickets[tokenId];
        EventInfo storage evt = _events[t.eventId];

        if (evt.organizer != msg.sender && !isStaff[t.eventId][msg.sender]) revert NotStaff();
        if (evt.cancelled) revert EventIsCancelled();
        if (t.used) revert TicketAlreadyUsed();
        if (block.timestamp > deadline) revert QRExpired();
        if (deadline > block.timestamp + MAX_QR_VALIDITY) revert QRDeadlineTooFar();

        (address signer, ECDSA.RecoverError err, ) = ECDSA.tryRecover(checkInDigest(tokenId, deadline), signature);
        if (err != ECDSA.RecoverError.NoError || signer != holder) revert InvalidSignature();

        t.used = true;
        if (_listings[tokenId].seller != address(0)) {
            delete _listings[tokenId];
            emit ListingCancelled(tokenId);
        }
        emit TicketCheckedIn(tokenId, t.eventId, holder, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════
    //                          HOÀN TIỀN
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Người giữ vé rút lại giá gốc khi sự kiện bị huỷ. Vé bị burn.
     */
    function claimRefund(uint256 tokenId) external nonReentrant {
        if (ownerOf(tokenId) != msg.sender) revert NotTicketOwner();
        Ticket storage t = _tickets[tokenId];
        EventInfo storage evt = _events[t.eventId];
        if (!evt.cancelled) revert EventNotCancelled();

        uint256 amount = t.pricePaid;

        // Effects
        evt.revenue -= amount;
        delete _listings[tokenId];
        _burn(tokenId);

        // Interactions
        if (amount > 0) _sendValue(msg.sender, amount);
        emit RefundClaimed(tokenId, msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                            VIEW
    // ═══════════════════════════════════════════════════════════════

    function getEventInfo(uint256 eventId) external view eventExists(eventId) returns (EventInfo memory) {
        return _events[eventId];
    }

    function getTiers(uint256 eventId) external view eventExists(eventId) returns (Tier[] memory) {
        return _tiers[eventId];
    }

    function getTicket(uint256 tokenId) external view returns (Ticket memory) {
        _requireOwned(tokenId);
        return _tickets[tokenId];
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return _listings[tokenId];
    }

    /// @notice Vé tồn tại, chưa dùng và sự kiện chưa bị huỷ
    function isTicketValid(uint256 tokenId) external view returns (bool) {
        if (_ownerOf(tokenId) == address(0)) return false;
        Ticket storage t = _tickets[tokenId];
        return !t.used && !_events[t.eventId].cancelled;
    }

    function totalEvents() external view returns (uint256) {
        return nextEventId - 1;
    }

    /// @notice Metadata NFT = metadata của hạng vé (IPFS)
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Ticket storage t = _tickets[tokenId];
        return _tiers[t.eventId][t.tierId].metadataURI;
    }

    // ═══════════════════════════════════════════════════════════════
    //                            ADMIN
    // ═══════════════════════════════════════════════════════════════

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════
    //                  CHẶN CHUYỂN NHƯỢNG TỰ DO
    // ═══════════════════════════════════════════════════════════════

    /// @dev Vé không thể ủy quyền cho bên thứ ba (sàn ngoài)
    function approve(address, uint256) public pure override {
        revert TransfersDisabled();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert TransfersDisabled();
    }

    /**
     * @dev Mọi thay đổi chủ sở hữu đều đi qua đây.
     *      Cho phép: mint, burn, chuyển nội bộ trong buyResale. Còn lại → revert.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0) && !_inMarketTransfer) revert TransfersDisabled();

        from = super._update(to, tokenId, auth);

        uint256 eventId = _tickets[tokenId].eventId;
        if (from != address(0)) ownedPerEvent[eventId][from] -= 1;
        if (to != address(0)) ownedPerEvent[eventId][to] += 1;
        return from;
    }

    // ═══════════════════════════════════════════════════════════════
    //                          INTERNAL
    // ═══════════════════════════════════════════════════════════════

    /// @dev Vé còn được giao dịch: chưa dùng, sự kiện chưa huỷ, chưa bắt đầu
    function _requireTradable(Ticket storage t) internal view {
        if (t.used) revert TicketAlreadyUsed();
        EventInfo storage evt = _events[t.eventId];
        if (evt.cancelled) revert EventIsCancelled();
        if (block.timestamp >= evt.startTime) revert EventAlreadyStarted();
    }

    function _sendValue(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert PaymentFailed();
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
