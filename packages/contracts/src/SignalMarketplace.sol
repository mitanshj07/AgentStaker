// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {AIPass} from "./AIPass.sol";

/// @title SignalMarketplace
/// @notice Credit-gated AI signal bundles. Execution remains a separate user-signed action.
contract SignalMarketplace is AccessControl {
    bytes32 public constant SIGNALER_ROLE = keccak256("SIGNALER_ROLE");

    struct Signal {
        address agent;
        bytes32 bundleHash;
        string metadataURI;
        uint256 creditCost;
        uint256 requiredTier;
        uint64 revealTime;
        bool active;
    }

    AIPass public immutable AI_PASS;
    uint256 public nextSignalId = 1;
    mapping(uint256 => Signal) public signals;
    mapping(uint256 => mapping(address => bool)) public unlocked;

    event SignalRegistered(uint256 indexed signalId, address indexed agent, bytes32 indexed bundleHash, uint256 creditCost, uint256 requiredTier);
    event SignalUnlocked(uint256 indexed signalId, address indexed user, uint256 credits);
    event SignalStateUpdated(uint256 indexed signalId, bool active);

    constructor(AIPass aiPass_) {
        AI_PASS = aiPass_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SIGNALER_ROLE, msg.sender);
    }

    function registerSignal(
        bytes32 bundleHash,
        string calldata metadataURI,
        uint256 creditCost,
        uint256 requiredTier,
        uint64 revealTime
    ) external onlyRole(SIGNALER_ROLE) returns (uint256 signalId) {
        require(bundleHash != bytes32(0) && bytes(metadataURI).length > 0, "BAD_SIGNAL");
        require(requiredTier <= uint256(AIPass.Tier.INSTITUTIONAL), "BAD_TIER");
        signalId = nextSignalId++;
        signals[signalId] = Signal(msg.sender, bundleHash, metadataURI, creditCost, requiredTier, revealTime, true);
        emit SignalRegistered(signalId, msg.sender, bundleHash, creditCost, requiredTier);
    }

    function unlock(uint256 signalId) external {
        Signal memory signal = signals[signalId];
        require(signal.active && !unlocked[signalId][msg.sender], "NOT_UNLOCKABLE");
        require(AI_PASS.bestTier(msg.sender) >= signal.requiredTier, "TIER_REQUIRED");
        unlocked[signalId][msg.sender] = true;
        AI_PASS.consumeCredits(msg.sender, signal.creditCost);
        emit SignalUnlocked(signalId, msg.sender, signal.creditCost);
    }

    function setActive(uint256 signalId, bool active) external {
        Signal storage signal = signals[signalId];
        require(msg.sender == signal.agent || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "NOT_AGENT");
        signal.active = active;
        emit SignalStateUpdated(signalId, active);
    }
}
