// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {BetSlipNFT} from "./BetSlipNFT.sol";
import {CreatorVault} from "./CreatorVault.sol";
import {ResponsibleLimits} from "./ResponsibleLimits.sol";

/// @title SocialMarket
/// @notice Evidence-backed X and YouTube milestone markets settled by a manual oracle.
contract SocialMarket is AccessControl, ReentrancyGuard {
    bytes32 public constant ORACLE_ROLE = keccak256("ORACLE_ROLE");

    enum Platform { X, YOUTUBE }
    enum Metric { VIEWS, LIKES, COMMENTS, FOLLOWERS }
    enum State { OPEN, PROPOSED, CHALLENGED, RESOLVED, VOIDED }

    struct Market {
        address creator;
        string contentUrl;
        string handle;
        Platform platform;
        Metric metric;
        uint256 startValue;
        uint256 targetValue;
        uint256 finalValue;
        uint64 resolveTime;
        uint64 challengeDeadline;
        uint256 yesPool;
        uint256 noPool;
        uint256 prizePool;
        bool hitTarget;
        State state;
        string evidenceURI;
    }

    BetSlipNFT public immutable BET_SLIP;
    ResponsibleLimits public immutable RESPONSIBLE_LIMITS;
    CreatorVault public creatorVault;
    uint256 public nextMarketId = 1;
    uint256 public challengeWindow = 30 minutes;
    uint256 public feeBps = 100;
    mapping(uint256 => Market) private _markets;
    mapping(uint256 => mapping(address => mapping(bool => uint256))) public stakeOf;
    mapping(uint256 => mapping(address => bool)) public claimed;
    mapping(uint256 => mapping(address => bool)) public refunded;
    mapping(uint256 => bool) public prizePoolRefunded;

    event SocialMarketCreated(uint256 indexed marketId, address indexed creator, uint8 platform, uint8 metric, uint256 targetValue, uint64 resolveTime);
    event SocialBet(uint256 indexed marketId, address indexed user, bool side, uint256 amount, uint256 slipTokenId);
    event SocialResolutionProposed(uint256 indexed marketId, uint256 finalValue, string evidenceURI, uint64 challengeDeadline);
    event SocialResolutionChallenged(uint256 indexed marketId, address indexed challenger, string evidenceURI);
    event SocialResolutionFinalized(uint256 indexed marketId, uint256 finalValue, bool hitTarget, string evidenceURI);
    event SocialClaimed(uint256 indexed marketId, address indexed user, uint256 payout);
    event SocialRefunded(uint256 indexed marketId, address indexed user, uint256 payout);
    event SocialPrizePoolRefunded(uint256 indexed marketId, address indexed creator, uint256 payout);
    event SocialVoided(uint256 indexed marketId);

    constructor(BetSlipNFT betSlip_, ResponsibleLimits responsibleLimits_) {
        BET_SLIP = betSlip_;
        RESPONSIBLE_LIMITS = responsibleLimits_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, msg.sender);
    }

    function setCreatorVault(CreatorVault vault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        creatorVault = vault;
    }

    function createMarket(
        string calldata contentUrl,
        string calldata handle,
        Platform platform,
        Metric metric,
        uint256 startValue,
        uint256 targetValue,
        uint64 resolveTime
    ) external payable returns (uint256 marketId) {
        require(bytes(contentUrl).length > 8 && bytes(handle).length > 0, "BAD_SOURCE");
        require(targetValue > startValue && resolveTime > block.timestamp, "BAD_TARGET");
        marketId = nextMarketId++;
        _markets[marketId] = Market({
            creator: msg.sender,
            contentUrl: contentUrl,
            handle: handle,
            platform: platform,
            metric: metric,
            startValue: startValue,
            targetValue: targetValue,
            finalValue: 0,
            resolveTime: resolveTime,
            challengeDeadline: 0,
            yesPool: 0,
            noPool: 0,
            prizePool: msg.value,
            hitTarget: false,
            state: State.OPEN,
            evidenceURI: ""
        });
        emit SocialMarketCreated(marketId, msg.sender, uint8(platform), uint8(metric), targetValue, resolveTime);
    }

    function fundPrizePool(uint256 marketId) external payable {
        Market storage market = _markets[marketId];
        require(market.creator != address(0) && market.state == State.OPEN, "NOT_OPEN");
        market.prizePool += msg.value;
    }

    function bet(uint256 marketId, bool side) external payable nonReentrant returns (uint256 slipTokenId) {
        Market storage market = _markets[marketId];
        require(market.state == State.OPEN && block.timestamp < market.resolveTime, "NOT_OPEN");
        require(msg.value > 0 && RESPONSIBLE_LIMITS.checkCanTrade(msg.sender, msg.value), "LIMIT_BLOCKED");
        stakeOf[marketId][msg.sender][side] += msg.value;
        if (side) market.yesPool += msg.value;
        else market.noPool += msg.value;
        RESPONSIBLE_LIMITS.recordSpend(msg.sender, msg.value);

        uint256[] memory ids = new uint256[](1);
        bool[] memory sides = new bool[](1);
        ids[0] = marketId;
        sides[0] = side;
        slipTokenId = BET_SLIP.mintSlip(msg.sender, address(this), marketId, ids, sides, msg.value, 2e18, 2, 1, keccak256(bytes(market.contentUrl)));
        emit SocialBet(marketId, msg.sender, side, msg.value, slipTokenId);
    }

    function proposeResolution(uint256 marketId, uint256 finalValue, string calldata evidenceURI) external onlyRole(ORACLE_ROLE) {
        Market storage market = _markets[marketId];
        require(market.state == State.OPEN && block.timestamp >= market.resolveTime, "NOT_SETTLEABLE");
        require(bytes(evidenceURI).length > 0, "NO_EVIDENCE");
        market.finalValue = finalValue;
        market.evidenceURI = evidenceURI;
        market.challengeDeadline = uint64(block.timestamp + challengeWindow);
        market.state = State.PROPOSED;
        emit SocialResolutionProposed(marketId, finalValue, evidenceURI, market.challengeDeadline);
    }

    function challenge(uint256 marketId, string calldata evidenceURI) external {
        Market storage market = _markets[marketId];
        require(market.state == State.PROPOSED && block.timestamp < market.challengeDeadline, "NO_CHALLENGE");
        require(bytes(evidenceURI).length > 0, "NO_EVIDENCE");
        market.state = State.CHALLENGED;
        emit SocialResolutionChallenged(marketId, msg.sender, evidenceURI);
    }

    function finalize(uint256 marketId, uint256 finalValue, string calldata evidenceURI) external onlyRole(ORACLE_ROLE) {
        Market storage market = _markets[marketId];
        require(market.state == State.PROPOSED || market.state == State.CHALLENGED, "NOT_PROPOSED");
        require(block.timestamp >= market.challengeDeadline && bytes(evidenceURI).length > 0, "WAIT_CHALLENGE");
        market.finalValue = finalValue;
        market.hitTarget = finalValue >= market.targetValue;
        market.evidenceURI = evidenceURI;
        uint256 winningPool = market.hitTarget ? market.yesPool : market.noPool;
        if (winningPool == 0) {
            market.state = State.VOIDED;
            emit SocialVoided(marketId);
            return;
        }
        market.state = State.RESOLVED;
        emit SocialResolutionFinalized(marketId, finalValue, market.hitTarget, evidenceURI);
    }

    function voidMarket(uint256 marketId) external onlyRole(ORACLE_ROLE) {
        Market storage market = _markets[marketId];
        require(market.creator != address(0), "UNKNOWN_MARKET");
        require(market.state != State.RESOLVED, "ALREADY_RESOLVED");
        market.state = State.VOIDED;
        emit SocialVoided(marketId);
    }

    function claim(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage market = _markets[marketId];
        require(market.state == State.RESOLVED && !claimed[marketId][msg.sender], "NOT_CLAIMABLE");
        uint256 winningStake = stakeOf[marketId][msg.sender][market.hitTarget];
        require(winningStake > 0, "NO_WIN");
        claimed[marketId][msg.sender] = true;
        uint256 winningPool = market.hitTarget ? market.yesPool : market.noPool;
        payout = (winningStake * (market.yesPool + market.noPool + market.prizePool)) / winningPool;
        if (address(creatorVault) != address(0)) {
            uint256 fee = (payout * feeBps) / 10_000;
            payout -= fee;
            if (fee > 0) creatorVault.recordFee{value: fee}(market.creator, address(0));
        }
        (bool success,) = payable(msg.sender).call{value: payout}("");
        require(success, "TRANSFER_FAILED");
        emit SocialClaimed(marketId, msg.sender, payout);
    }

    function refund(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage market = _markets[marketId];
        require(market.state == State.VOIDED && !refunded[marketId][msg.sender], "NOT_REFUNDABLE");
        payout = stakeOf[marketId][msg.sender][true] + stakeOf[marketId][msg.sender][false];
        require(payout > 0, "NO_STAKE");
        refunded[marketId][msg.sender] = true;
        (bool success,) = payable(msg.sender).call{value: payout}("");
        require(success, "TRANSFER_FAILED");
        emit SocialRefunded(marketId, msg.sender, payout);
    }

    function refundVoidedPrizePool(uint256 marketId) external nonReentrant returns (uint256 payout) {
        Market storage market = _markets[marketId];
        require(market.state == State.VOIDED && market.creator == msg.sender && !prizePoolRefunded[marketId], "NOT_REFUNDABLE");
        prizePoolRefunded[marketId] = true;
        payout = market.prizePool;
        require(payout > 0, "NO_PRIZE_POOL");
        (bool success,) = payable(msg.sender).call{value: payout}("");
        require(success, "TRANSFER_FAILED");
        emit SocialPrizePoolRefunded(marketId, msg.sender, payout);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        require(_markets[marketId].creator != address(0), "UNKNOWN_MARKET");
        return _markets[marketId];
    }
}
