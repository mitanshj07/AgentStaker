// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ERC721Enumerable} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Base64} from "openzeppelin-contracts/contracts/utils/Base64.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

/// @title BetSlipNFT
/// @notice Shareable gameplay card linked to an authoritative ArenaX position.
/// @dev This card is intentionally separate from the financial parlay NFT.
contract BetSlipNFT is ERC721Enumerable, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant STATUS_ROLE = keccak256("STATUS_ROLE");
    bytes32 public constant BATTLE_ROLE = keccak256("BATTLE_ROLE");

    enum SlipStatus {
        OPEN,
        WON,
        LOST,
        CASHED_OUT,
        CLAIMED,
        VOIDED
    }

    struct SlipData {
        address originContract;
        uint256 originId;
        uint256[] marketIds;
        bool[] sides;
        uint256 stakeWei;
        uint256 oddsSnapshot1e18;
        uint64 createdAt;
        uint8 slipType;
        uint8 rarity;
        bytes32 strategyHash;
        SlipStatus status;
    }

    struct CardStats {
        uint256 power;
        uint256 defense;
        uint256 speed;
        uint256 luck;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => SlipData) private _slips;
    mapping(uint256 => bool) public battleLocked;

    event SlipMinted(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed originContract,
        uint256 originId,
        uint8 slipType,
        uint8 rarity,
        uint256 stakeWei,
        uint256 oddsSnapshot1e18
    );
    event SlipStatusUpdated(uint256 indexed tokenId, uint8 status);
    event BattleLockUpdated(uint256 indexed tokenId, bool locked);

    constructor() ERC721("Monad ArenaX Bet Slip", "AXSLIP") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(STATUS_ROLE, msg.sender);
        _grantRole(BATTLE_ROLE, msg.sender);
    }

    function mintSlip(
        address to,
        address originContract,
        uint256 originId,
        uint256[] calldata marketIds,
        bool[] calldata sides,
        uint256 stakeWei,
        uint256 oddsSnapshot1e18,
        uint8 slipType,
        uint8 rarity,
        bytes32 strategyHash
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(to != address(0), "BAD_OWNER");
        require(marketIds.length > 0 && marketIds.length == sides.length, "BAD_LEGS");

        tokenId = nextTokenId++;
        SlipData storage slip = _slips[tokenId];
        slip.originContract = originContract;
        slip.originId = originId;
        slip.marketIds = marketIds;
        slip.sides = sides;
        slip.stakeWei = stakeWei;
        slip.oddsSnapshot1e18 = oddsSnapshot1e18;
        slip.createdAt = uint64(block.timestamp);
        slip.slipType = slipType;
        slip.rarity = rarity;
        slip.strategyHash = strategyHash;
        slip.status = SlipStatus.OPEN;

        _safeMint(to, tokenId);
        emit SlipMinted(tokenId, to, originContract, originId, slipType, rarity, stakeWei, oddsSnapshot1e18);
    }

    function updateStatus(uint256 tokenId, SlipStatus status) external onlyRole(STATUS_ROLE) {
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_SLIP");
        require(!battleLocked[tokenId], "BATTLE_LOCKED");
        _slips[tokenId].status = status;
        emit SlipStatusUpdated(tokenId, uint8(status));
    }

    function setBattleLock(uint256 tokenId, bool locked) external onlyRole(BATTLE_ROLE) {
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_SLIP");
        require(_slips[tokenId].status == SlipStatus.WON, "SLIP_NOT_WON");
        battleLocked[tokenId] = locked;
        emit BattleLockUpdated(tokenId, locked);
    }

    function getSlip(uint256 tokenId) external view returns (SlipData memory) {
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_SLIP");
        return _slips[tokenId];
    }

    function cardStats(uint256 tokenId) public view returns (CardStats memory stats) {
        SlipData storage slip = _slips[tokenId];
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_SLIP");
        stats.power = _cap(40 + slip.oddsSnapshot1e18 / 1e16 + slip.marketIds.length * 8 + slip.rarity * 12);
        stats.defense = _cap(30 + slip.stakeWei / 1e16 + slip.marketIds.length * 6);
        stats.speed = _cap(50 + slip.marketIds.length * 10 + slip.rarity * 20);
        stats.luck = uint256(keccak256(abi.encode(tokenId, slip.strategyHash, slip.createdAt))) % 1_000;
    }

    function battleStats(uint256 tokenId) external view returns (uint256 power, uint256 luck) {
        CardStats memory stats = cardStats(tokenId);
        return (stats.power, stats.luck);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_SLIP");
        SlipData storage slip = _slips[tokenId];
        CardStats memory stats = cardStats(tokenId);
        string memory rarity = _rarityName(slip.rarity);
        string memory status = _statusName(slip.status);
        string memory slipType = _typeName(slip.slipType);
        string memory accent = _rarityColor(slip.rarity);
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">',
            '<rect width="720" height="960" fill="#f7f8f6"/><rect x="36" y="36" width="648" height="888" rx="28" fill="#ffffff" stroke="',
            accent,
            '" stroke-width="6"/><path d="M36 260H684" stroke="',
            accent,
            '" stroke-width="4"/>',
            '<text x="80" y="128" fill="#25283a" font-family="Arial" font-size="42" font-weight="700">MONAD ARENAX</text>',
            '<text x="80" y="184" fill="',
            accent,
            '" font-family="Arial" font-size="26" font-weight="700">',
            slipType,
            ' CARD #',
            tokenId.toString(),
            '</text><text x="80" y="230" fill="#6d7180" font-family="Arial" font-size="22">',
            status,
            ' - ',
            rarity,
            '</text><text x="80" y="338" fill="#25283a" font-family="Arial" font-size="34" font-weight="700">Power ',
            stats.power.toString(),
            '</text><text x="80" y="410" fill="#25283a" font-family="Arial" font-size="34" font-weight="700">Defense ',
            stats.defense.toString(),
            '</text><text x="80" y="482" fill="#25283a" font-family="Arial" font-size="34" font-weight="700">Speed ',
            stats.speed.toString(),
            '</text><text x="80" y="554" fill="#25283a" font-family="Arial" font-size="34" font-weight="700">Luck ',
            stats.luck.toString(),
            '</text><path d="M80 624H640" stroke="#e7e5ea" stroke-width="3"/>',
            '<text x="80" y="704" fill="#25283a" font-family="Arial" font-size="30">Legs ',
            slip.marketIds.length.toString(),
            '</text><text x="80" y="766" fill="#25283a" font-family="Arial" font-size="30">Stake ',
            (slip.stakeWei / 1e15).toString(),
            ' mMON</text><text x="80" y="862" fill="#6d7180" font-family="Arial" font-size="22">Gameplay metadata - Monad testnet</text></svg>'
        );
        string memory json = string.concat(
            '{"name":"ArenaX Bet Slip #',
            tokenId.toString(),
            '","description":"Shareable Monad ArenaX testnet gameplay card","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Type","value":"',
            slipType,
            '"},{"trait_type":"Rarity","value":"',
            rarity,
            '"},{"trait_type":"Status","value":"',
            status,
            '"},{"trait_type":"Legs","value":',
            slip.marketIds.length.toString(),
            '},{"trait_type":"Power","value":',
            stats.power.toString(),
            '},{"trait_type":"Defense","value":',
            stats.defense.toString(),
            '},{"trait_type":"Speed","value":',
            stats.speed.toString(),
            '},{"trait_type":"Luck","value":',
            stats.luck.toString(),
            '}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
    }

    function _cap(uint256 value) private pure returns (uint256) {
        return value > 9_999 ? 9_999 : value;
    }

    function _typeName(uint8 slipType) private pure returns (string memory) {
        if (slipType == 1) return "PARLAY";
        if (slipType == 2) return "SOCIAL";
        return "MARKET";
    }

    function _rarityName(uint8 rarity) private pure returns (string memory) {
        if (rarity >= 3) return "LEGENDARY";
        if (rarity == 2) return "EPIC";
        if (rarity == 1) return "RARE";
        return "COMMON";
    }

    function _rarityColor(uint8 rarity) private pure returns (string memory) {
        if (rarity >= 3) return "#d38b43";
        if (rarity == 2) return "#8f78bd";
        if (rarity == 1) return "#4c9a79";
        return "#d06a72";
    }

    function _statusName(SlipStatus status) private pure returns (string memory) {
        if (status == SlipStatus.WON) return "WON";
        if (status == SlipStatus.LOST) return "LOST";
        if (status == SlipStatus.CASHED_OUT) return "CASHED OUT";
        if (status == SlipStatus.CLAIMED) return "CLAIMED";
        if (status == SlipStatus.VOIDED) return "VOIDED";
        return "OPEN";
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
