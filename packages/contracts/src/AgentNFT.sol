// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ERC721Enumerable} from "openzeppelin-contracts/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Base64} from "openzeppelin-contracts/contracts/utils/Base64.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

/// @title AgentNFT
/// @notice On-chain representation of an AI Agent identity and stats.
contract AgentNFT is ERC721Enumerable, AccessControl {
    using Strings for uint256;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant STATUS_ROLE = keccak256("STATUS_ROLE");
    bytes32 public constant BATTLE_ROLE = keccak256("BATTLE_ROLE");

    struct AgentStats {
        uint256 brierScore1e18;
        uint256 winRate1e4;
        uint256 calibration1e4;
        uint256 battleWins;
        uint256 battleLosses;
        uint256 streak;
    }

    struct AgentData {
        string name;
        string archetype;
        bytes32 strategyHash;
        uint64 createdAt;
        AgentStats stats;
    }

    uint256 public nextTokenId = 1;
    mapping(uint256 => AgentData) private _agents;

    event AgentMinted(
        uint256 indexed tokenId,
        address indexed owner,
        string name,
        string archetype,
        bytes32 strategyHash
    );
    event AgentStatsSynced(uint256 indexed tokenId, AgentStats stats);

    constructor() ERC721("Monad ArenaX Agent", "AXAGENT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(STATUS_ROLE, msg.sender);
        _grantRole(BATTLE_ROLE, msg.sender);
    }

    function mintAgent(
        address to,
        string calldata name,
        string calldata archetype,
        bytes32 strategyHash
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        require(to != address(0), "BAD_OWNER");
        require(bytes(name).length > 0, "BAD_NAME");

        tokenId = nextTokenId++;
        AgentData storage agent = _agents[tokenId];
        agent.name = name;
        agent.archetype = archetype;
        agent.strategyHash = strategyHash;
        agent.createdAt = uint64(block.timestamp);
        // Stats are 0 by default

        _safeMint(to, tokenId);
        emit AgentMinted(tokenId, to, name, archetype, strategyHash);
    }

    function syncStats(uint256 tokenId, AgentStats calldata newStats) external onlyRole(STATUS_ROLE) {
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_AGENT");
        _agents[tokenId].stats = newStats;
        emit AgentStatsSynced(tokenId, newStats);
    }

    function recordBattleResult(uint256 tokenId, bool won) external onlyRole(BATTLE_ROLE) {
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_AGENT");
        AgentStats storage stats = _agents[tokenId].stats;
        if (won) {
            stats.battleWins += 1;
            stats.streak += 1;
        } else {
            stats.battleLosses += 1;
            stats.streak = 0;
        }
    }

    function getAgent(uint256 tokenId) external view returns (AgentData memory) {
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_AGENT");
        return _agents[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "UNKNOWN_AGENT");
        AgentData storage agent = _agents[tokenId];
        
        string memory accent = "#8f78bd"; // Purple for AI
        string memory svg = string.concat(
            '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="960" viewBox="0 0 720 960">',
            '<rect width="720" height="960" fill="#f7f8f6"/><rect x="36" y="36" width="648" height="888" rx="28" fill="#ffffff" stroke="',
            accent,
            '" stroke-width="6"/><path d="M36 260H684" stroke="',
            accent,
            '" stroke-width="4"/>',
            '<text x="80" y="128" fill="#25283a" font-family="Arial" font-size="42" font-weight="700">AGENT IDENTITY</text>',
            '<text x="80" y="184" fill="',
            accent,
            '" font-family="Arial" font-size="32" font-weight="700">',
            agent.name,
            '</text><text x="80" y="230" fill="#6d7180" font-family="Arial" font-size="22">Archetype: ',
            agent.archetype,
            '</text><text x="80" y="338" fill="#25283a" font-family="Arial" font-size="30" font-weight="700">Brier Score ',
            (agent.stats.brierScore1e18 / 1e15).toString(), // display as x1000
            '</text><text x="80" y="410" fill="#25283a" font-family="Arial" font-size="30" font-weight="700">Win Rate ',
            (agent.stats.winRate1e4 / 100).toString(),
            '%</text><text x="80" y="482" fill="#25283a" font-family="Arial" font-size="30" font-weight="700">Calibration ',
            (agent.stats.calibration1e4 / 100).toString(),
            '%</text><text x="80" y="554" fill="#25283a" font-family="Arial" font-size="30" font-weight="700">Battle W/L ',
            agent.stats.battleWins.toString(),
            ' - ',
            agent.stats.battleLosses.toString(),
            '</text><path d="M80 624H640" stroke="#e7e5ea" stroke-width="3"/>',
            '<text x="80" y="704" fill="#25283a" font-family="Arial" font-size="30">Streak ',
            agent.stats.streak.toString(),
            '</text><text x="80" y="862" fill="#6d7180" font-family="Arial" font-size="22">Monad ArenaX - Testnet Advisory AI</text></svg>'
        );
        string memory json = string.concat(
            '{"name":"',
            agent.name,
            '","description":"Monad ArenaX Agent NFT Identity","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(svg)),
            '","attributes":[{"trait_type":"Archetype","value":"',
            agent.archetype,
            '"},{"trait_type":"BrierScore","value":',
            (agent.stats.brierScore1e18 / 1e15).toString(),
            '},{"trait_type":"WinRate","value":',
            (agent.stats.winRate1e4 / 100).toString(),
            '},{"trait_type":"BattleWins","value":',
            agent.stats.battleWins.toString(),
            '},{"trait_type":"BattleLosses","value":',
            agent.stats.battleLosses.toString(),
            '},{"trait_type":"Streak","value":',
            agent.stats.streak.toString(),
            '}]}'
        );
        return string.concat("data:application/json;base64,", Base64.encode(bytes(json)));
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
