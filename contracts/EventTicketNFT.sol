// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title EventTicketNFT
 * @author Đề tài 58 — Lập trình Blockchain
 * @notice Hệ thống bán vé sự kiện bằng NFT với cơ chế chống vé giả và đầu cơ
 * @dev Kế thừa ERC721URIStorage, AccessControl, ReentrancyGuard, Pausable
 *
 * Cơ chế chống đầu cơ:
 *   1. Giới hạn số vé mỗi ví (maxTicketsPerWallet)
 *   2. Giá trần bán lại (resalePriceCap — phần trăm so với giá gốc)
 *
 * Cơ chế chống vé giả:
 *   1. Mỗi vé là NFT duy nhất trên blockchain
 *   2. Soát vé bằng chữ ký số (ecrecover) — xác thực chủ sở hữu thật
 */
contract EventTicketNFT is
    ERC721URIStorage,
    AccessControl,
    ReentrancyGuard,
    Pausable
{
    // ═══════════════════════════════════════════════════════════════
    //                          ROLES
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");

    // ═══════════════════════════════════════════════════════════════
    //                       DATA STRUCTURES
    // ═══════════════════════════════════════════════════════════════

    struct Event {
        uint256 eventId;
        string name;
        address organizer;
        uint256 date; // Timestamp ngày diễn ra
        string venue;
        uint256 ticketPrice; // Giá vé (wei)
        uint256 maxTickets; // Tổng số vé tối đa
        uint256 ticketsSold; // Số vé đã bán
        uint256 maxTicketsPerWallet; // Giới hạn vé/ví (chống đầu cơ)
        uint256 resalePriceCap; // % giá trần bán lại (vd: 110 = 110%)
        bool isActive;
    }

    struct Ticket {
        uint256 tokenId;
        uint256 eventId;
        uint256 originalPrice;
        bool isUsed; // Đã soát vé
        bool isForSale; // Đang rao bán lại
        uint256 resalePrice;
    }

    // ═══════════════════════════════════════════════════════════════
    //                          STORAGE
    // ═══════════════════════════════════════════════════════════════

    mapping(uint256 => Event) public events;
    uint256 public nextEventId;

    mapping(uint256 => Ticket) public tickets;
    uint256 public nextTokenId;

    // eventId => wallet => số vé đã mua
    mapping(uint256 => mapping(address => uint256)) public ticketsPurchased;

    // eventId => tổng tiền bán vé chưa rút
    mapping(uint256 => uint256) public eventFunds;

    // ═══════════════════════════════════════════════════════════════
    //                          EVENTS
    // ═══════════════════════════════════════════════════════════════

    event EventCreated(
        uint256 indexed eventId,
        string name,
        address indexed organizer,
        uint256 ticketPrice,
        uint256 maxTickets
    );
    event EventToggled(uint256 indexed eventId, bool isActive);
    event TicketPurchased(
        address indexed buyer,
        uint256 indexed eventId,
        uint256 tokenId
    );
    event TicketListedForResale(uint256 indexed tokenId, uint256 price);
    event ResaleListingCancelled(uint256 indexed tokenId);
    event TicketResold(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 price
    );
    event TicketCheckedIn(uint256 indexed tokenId, address indexed holder);
    event FundsWithdrawn(
        uint256 indexed eventId,
        address indexed organizer,
        uint256 amount
    );

    // ═══════════════════════════════════════════════════════════════
    //                        CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════

    constructor() ERC721("EventTicketNFT", "ETNFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORGANIZER_ROLE, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════
    //                    EVENT MANAGEMENT
    //                (Chỉ ORGANIZER_ROLE)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Tạo sự kiện mới
     * @param _name Tên sự kiện
     * @param _date Timestamp ngày diễn ra
     * @param _venue Địa điểm
     * @param _ticketPrice Giá vé (wei)
     * @param _maxTickets Tổng số vé tối đa
     * @param _maxTicketsPerWallet Giới hạn vé mỗi ví (chống đầu cơ)
     * @param _resalePriceCap Phần trăm giá trần bán lại (vd: 110 = 110% giá gốc)
     */
    function createEvent(
        string memory _name,
        uint256 _date,
        string memory _venue,
        uint256 _ticketPrice,
        uint256 _maxTickets,
        uint256 _maxTicketsPerWallet,
        uint256 _resalePriceCap
    ) external onlyRole(ORGANIZER_ROLE) returns (uint256) {
        require(bytes(_name).length > 0, "Name required");
        require(_date > block.timestamp, "Date must be in the future");
        require(_maxTickets > 0, "Max tickets must be > 0");
        require(_maxTicketsPerWallet > 0, "Max per wallet must be > 0");
        require(
            _maxTicketsPerWallet <= _maxTickets,
            "Per wallet limit exceeds max tickets"
        );
        require(
            _resalePriceCap >= 100,
            "Resale cap must be >= 100%"
        );

        uint256 eventId = nextEventId++;

        events[eventId] = Event({
            eventId: eventId,
            name: _name,
            organizer: msg.sender,
            date: _date,
            venue: _venue,
            ticketPrice: _ticketPrice,
            maxTickets: _maxTickets,
            ticketsSold: 0,
            maxTicketsPerWallet: _maxTicketsPerWallet,
            resalePriceCap: _resalePriceCap,
            isActive: true
        });

        emit EventCreated(eventId, _name, msg.sender, _ticketPrice, _maxTickets);
        return eventId;
    }

    /**
     * @notice Bật/tắt trạng thái sự kiện
     */
    function toggleEventActive(uint256 _eventId) external onlyRole(ORGANIZER_ROLE) {
        require(_eventId < nextEventId, "Event does not exist");
        require(
            events[_eventId].organizer == msg.sender ||
                hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Not event organizer"
        );

        events[_eventId].isActive = !events[_eventId].isActive;
        emit EventToggled(_eventId, events[_eventId].isActive);
    }

    /**
     * @notice Ban tổ chức rút tiền bán vé
     */
    function withdrawEventFunds(
        uint256 _eventId
    ) external onlyRole(ORGANIZER_ROLE) nonReentrant {
        require(_eventId < nextEventId, "Event does not exist");
        require(
            events[_eventId].organizer == msg.sender,
            "Not event organizer"
        );

        uint256 amount = eventFunds[_eventId];
        require(amount > 0, "No funds to withdraw");

        // Effects trước Interactions (CEI pattern)
        eventFunds[_eventId] = 0;

        // Interactions
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "Transfer failed");

        emit FundsWithdrawn(_eventId, msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════════════
    //                      BUY TICKET
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Mua vé cho sự kiện
     * @param _eventId ID sự kiện
     * @param _tokenURI URI metadata trên IPFS
     */
    function buyTicket(
        uint256 _eventId,
        string memory _tokenURI
    ) external payable whenNotPaused nonReentrant {
        Event storage evt = events[_eventId];

        // Checks
        require(_eventId < nextEventId, "Event does not exist");
        require(evt.isActive, "Event not active");
        require(block.timestamp < evt.date, "Event already passed");
        require(evt.ticketsSold < evt.maxTickets, "Sold out");
        require(msg.value == evt.ticketPrice, "Incorrect payment amount");
        require(
            ticketsPurchased[_eventId][msg.sender] < evt.maxTicketsPerWallet,
            "Exceeds per-wallet limit"
        );

        // Effects
        uint256 tokenId = nextTokenId++;
        evt.ticketsSold++;
        ticketsPurchased[_eventId][msg.sender]++;
        eventFunds[_eventId] += msg.value;

        tickets[tokenId] = Ticket({
            tokenId: tokenId,
            eventId: _eventId,
            originalPrice: msg.value,
            isUsed: false,
            isForSale: false,
            resalePrice: 0
        });

        // Interactions
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);

        emit TicketPurchased(msg.sender, _eventId, tokenId);
    }

    // ═══════════════════════════════════════════════════════════════
    //                   RESALE — CHỐNG ĐẦU CƠ
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Rao bán lại vé với giá trần
     * @param _tokenId ID vé (NFT)
     * @param _price Giá bán lại (wei)
     */
    function listForResale(uint256 _tokenId, uint256 _price) external {
        require(ownerOf(_tokenId) == msg.sender, "Not ticket owner");
        require(!tickets[_tokenId].isUsed, "Ticket already used");
        require(!tickets[_tokenId].isForSale, "Already listed");

        // Chống đầu cơ: kiểm tra giá trần
        uint256 eventId = tickets[_tokenId].eventId;
        uint256 maxPrice = (tickets[_tokenId].originalPrice *
            events[eventId].resalePriceCap) / 100;
        require(_price <= maxPrice, "Price exceeds resale cap");
        require(_price > 0, "Price must be > 0");

        tickets[_tokenId].isForSale = true;
        tickets[_tokenId].resalePrice = _price;

        emit TicketListedForResale(_tokenId, _price);
    }

    /**
     * @notice Mua vé đang rao bán lại
     * @param _tokenId ID vé (NFT)
     */
    function buyResaleTicket(
        uint256 _tokenId
    ) external payable whenNotPaused nonReentrant {
        Ticket storage ticket = tickets[_tokenId];
        require(ticket.isForSale, "Ticket not for sale");
        require(!ticket.isUsed, "Ticket already used");
        require(msg.value == ticket.resalePrice, "Incorrect payment amount");

        address seller = ownerOf(_tokenId);
        require(seller != msg.sender, "Cannot buy own ticket");

        // Effects
        ticket.isForSale = false;
        ticket.resalePrice = 0;

        // Interactions — chuyển NFT
        _transfer(seller, msg.sender, _tokenId);

        // Chuyển tiền cho người bán
        (bool sent, ) = payable(seller).call{value: msg.value}("");
        require(sent, "Transfer to seller failed");

        emit TicketResold(_tokenId, seller, msg.sender, msg.value);
    }

    /**
     * @notice Hủy rao bán
     */
    function cancelResaleListing(uint256 _tokenId) external {
        require(ownerOf(_tokenId) == msg.sender, "Not ticket owner");
        require(tickets[_tokenId].isForSale, "Not listed for sale");

        tickets[_tokenId].isForSale = false;
        tickets[_tokenId].resalePrice = 0;

        emit ResaleListingCancelled(_tokenId);
    }

    // ═══════════════════════════════════════════════════════════════
    //               CHECK-IN — XÁC THỰC CHỮ KÝ SỐ
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Soát vé bằng chữ ký số
     * @dev Ban tổ chức gửi thông điệp challenge, người giữ vé ký bằng private key.
     *      Contract xác thực chữ ký → đảm bảo người đó sở hữu vé.
     *      Liên hệ mật mã bất đối xứng (khối 1 đề cương).
     * @param _tokenId ID vé
     * @param _messageHash Hash thông điệp challenge
     * @param _signature Chữ ký của người giữ vé
     */
    function checkIn(
        uint256 _tokenId,
        bytes32 _messageHash,
        bytes memory _signature
    ) external onlyRole(ORGANIZER_ROLE) {
        require(!tickets[_tokenId].isUsed, "Already checked in");

        uint256 eventId = tickets[_tokenId].eventId;
        require(events[eventId].isActive, "Event not active");

        // Xác thực chữ ký: người ký phải là chủ vé
        bytes32 ethSignedHash = _getEthSignedMessageHash(_messageHash);
        address signer = _recoverSigner(ethSignedHash, _signature);
        require(
            signer == ownerOf(_tokenId),
            "Invalid signature - not ticket owner"
        );

        // Đánh dấu đã sử dụng
        tickets[_tokenId].isUsed = true;

        emit TicketCheckedIn(_tokenId, signer);
    }

    // ═══════════════════════════════════════════════════════════════
    //                       VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Lấy thông tin sự kiện
     */
    function getEvent(uint256 _eventId) external view returns (Event memory) {
        require(_eventId < nextEventId, "Event does not exist");
        return events[_eventId];
    }

    /**
     * @notice Lấy thông tin vé
     */
    function getTicket(uint256 _tokenId) external view returns (Ticket memory) {
        _requireOwned(_tokenId);
        return tickets[_tokenId];
    }

    /**
     * @notice Lấy danh sách vé của msg.sender cho sự kiện
     */
    function getMyTickets(
        uint256 _eventId
    ) external view returns (uint256[] memory) {
        uint256 count = 0;

        // Đếm số vé
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (
                tickets[i].eventId == _eventId &&
                _ownerOf(i) == msg.sender
            ) {
                count++;
            }
        }

        // Thu thập tokenIds
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (
                tickets[i].eventId == _eventId &&
                _ownerOf(i) == msg.sender
            ) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Lấy danh sách vé đang rao bán lại cho sự kiện
     */
    function getResaleTickets(
        uint256 _eventId
    ) external view returns (uint256[] memory) {
        uint256 count = 0;

        for (uint256 i = 0; i < nextTokenId; i++) {
            if (tickets[i].eventId == _eventId && tickets[i].isForSale) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < nextTokenId; i++) {
            if (tickets[i].eventId == _eventId && tickets[i].isForSale) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }

    /**
     * @notice Kiểm tra vé có hợp lệ (chưa sử dụng, sự kiện chưa qua)
     */
    function isTicketValid(uint256 _tokenId) external view returns (bool) {
        _requireOwned(_tokenId);
        Ticket memory ticket = tickets[_tokenId];
        Event memory evt = events[ticket.eventId];
        return !ticket.isUsed && evt.isActive;
    }

    /**
     * @notice Tổng số sự kiện
     */
    function getTotalEvents() external view returns (uint256) {
        return nextEventId;
    }

    // ═══════════════════════════════════════════════════════════════
    //                       ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Tạm dừng toàn bộ giao dịch (khẩn cấp)
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Mở lại giao dịch
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════
    //                     INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════

    /**
     * @dev Prefix Ethereum Signed Message theo EIP-191
     */
    function _getEthSignedMessageHash(
        bytes32 _messageHash
    ) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    _messageHash
                )
            );
    }

    /**
     * @dev Khôi phục địa chỉ người ký từ chữ ký
     *      Đây là phần liên hệ mật mã bất đối xứng trong đề cương
     */
    function _recoverSigner(
        bytes32 _ethSignedHash,
        bytes memory _signature
    ) internal pure returns (address) {
        require(_signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(_signature, 32))
            s := mload(add(_signature, 64))
            v := byte(0, mload(add(_signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature v value");

        return ecrecover(_ethSignedHash, v, r, s);
    }

    // ═══════════════════════════════════════════════════════════════
    //                       OVERRIDES
    // ═══════════════════════════════════════════════════════════════

    /**
     * @dev Override để tự động hủy listing khi transfer
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = super._update(to, tokenId, auth);

        // Nếu vé đang rao bán mà bị transfer → hủy listing
        if (from != address(0) && to != address(0)) {
            if (tickets[tokenId].isForSale) {
                tickets[tokenId].isForSale = false;
                tickets[tokenId].resalePrice = 0;
            }
        }

        return from;
    }

    /**
     * @dev Giải quyết xung đột kế thừa giữa ERC721URIStorage và AccessControl
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721URIStorage, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
