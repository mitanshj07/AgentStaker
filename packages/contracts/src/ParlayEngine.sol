// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {MarketFactory} from "./MarketFactory.sol";
import {ResponsibleLimits} from "./ResponsibleLimits.sol";
import {AMMPool} from "./AMMPool.sol";
import {BetSlipNFT} from "./BetSlipNFT.sol";

/// @title ParlayEngine
/// @notice Transferable parlay NFTs with reserved liabilities and deterministic early cashout.
contract ParlayEngine is ERC721, ReentrancyGuard {
    struct ParlayLeg {
        uint256 marketId;
        uint256 outcomeIndex;
        uint256 oddsAtTime;
    }

    enum ParlayStatus {
        OPEN,
        WON,
        LOST,
        PARTIALLY_VOIDED,
        CLAIMED,
        CASHED_OUT
    }

    struct Parlay {
        address creator;
        ParlayLeg[] legs;
        uint256 stake;
        uint256 payout;
        ParlayStatus status;
    }

    error BadLegCount();
    error NoStake();
    error LimitBlocked();
    error MarketNotOpen();
    error BadOutcome();
    error DuplicateMarket();
    error PayoutTooHigh();
    error UnknownParlay();
    error NotOpen();
    error UnresolvedLegs();
    error NotOwner();
    error NotClaimable();
    error InsufficientHouseBalance();
    error TransferFailed();
    error NotHouseOwner();
    error NoDeposit();
    error SlippageExceeded();
    error NoCashoutValue();
    error BadDiscount();

    MarketFactory public immutable MARKET_FACTORY;
    ResponsibleLimits public immutable RESPONSIBLE_LIMITS;
    AMMPool public immutable AMM_POOL;
    BetSlipNFT public betSlipNFT;
    address public owner;
    uint256 public nextParlayId = 1;
    uint256 public houseBalance;
    uint256 public reservedLiability;
    uint256 public cashoutDiscountBps = 600;
    mapping(uint256 => Parlay) private parlays;
    mapping(uint256 => uint256) public parlaySlipTokenId;

    event ParlayCreated(uint256 indexed parlayId, address indexed user, uint256 legs, uint256 stake, uint256 payout);
    event ParlaySettled(uint256 indexed parlayId, uint8 status, uint256 payout);
    event ParlayClaimed(uint256 indexed parlayId, address indexed user, uint256 payout);
    event ParlayCashedOut(uint256 indexed parlayId, address indexed user, uint256 cashoutValue, uint256 releasedLiability);
    event HouseFunded(address indexed funder, uint256 amount, uint256 newBalance);
    event HouseWithdrawn(address indexed recipient, uint256 amount, uint256 newBalance);
    event CashoutDiscountSet(uint256 discountBps);
    event BetSlipNFTSet(address indexed betSlipNFT);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotHouseOwner();
        _;
    }

    constructor(MarketFactory marketFactory_, ResponsibleLimits responsibleLimits_, AMMPool ammPool_)
        ERC721("Monad ArenaX Parlay", "AXPARLAY")
    {
        MARKET_FACTORY = marketFactory_;
        RESPONSIBLE_LIMITS = responsibleLimits_;
        AMM_POOL = ammPool_;
        owner = msg.sender;
    }

    function fundHouse() external payable {
        if (msg.value == 0) revert NoDeposit();
        houseBalance += msg.value;
        emit HouseFunded(msg.sender, msg.value, houseBalance);
    }

    function setCashoutDiscount(uint256 discountBps) external onlyOwner {
        if (discountBps > 3_000) revert BadDiscount();
        cashoutDiscountBps = discountBps;
        emit CashoutDiscountSet(discountBps);
    }

    function setBetSlipNFT(BetSlipNFT betSlipNFT_) external onlyOwner {
        betSlipNFT = betSlipNFT_;
        emit BetSlipNFTSet(address(betSlipNFT_));
    }

    function withdrawHouse(uint256 amount, address payable recipient) external onlyOwner nonReentrant {
        if (amount > availableHouseBalance()) revert InsufficientHouseBalance();
        houseBalance -= amount;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit HouseWithdrawn(recipient, amount, houseBalance);
    }

    function availableHouseBalance() public view returns (uint256) {
        return houseBalance > reservedLiability ? houseBalance - reservedLiability : 0;
    }

    function createParlay(ParlayLeg[] calldata legs, uint256 maxPayout)
        external
        payable
        returns (uint256 parlayId)
    {
        if (legs.length < 2 || legs.length > 12) revert BadLegCount();
        if (msg.value == 0) revert NoStake();
        if (!RESPONSIBLE_LIMITS.checkCanTrade(msg.sender, msg.value)) revert LimitBlocked();

        uint256 combinedOdds = 1e18;
        for (uint256 i = 0; i < legs.length; i++) {
            if (MARKET_FACTORY.marketState(legs[i].marketId) != MarketFactory.MarketState.OPEN) revert MarketNotOpen();
            if (legs[i].outcomeIndex > 1) revert BadOutcome();
            for (uint256 j = i + 1; j < legs.length; j++) {
                if (legs[i].marketId == legs[j].marketId) revert DuplicateMarket();
            }
            uint256 actualProbability = AMM_POOL.getOutcomeOdds(legs[i].marketId, legs[i].outcomeIndex);
            uint256 actualMultiplier = (1e18 * 1e18) / actualProbability;
            combinedOdds = (combinedOdds * actualMultiplier) / 1e18;
        }

        uint256 payout = (msg.value * combinedOdds) / 1e18;
        if (payout > maxPayout) revert PayoutTooHigh();
        houseBalance += msg.value;
        if (reservedLiability + payout > houseBalance) revert InsufficientHouseBalance();
        reservedLiability += payout;

        parlayId = nextParlayId++;
        Parlay storage parlay = parlays[parlayId];
        parlay.creator = msg.sender;
        parlay.stake = msg.value;
        parlay.payout = payout;
        parlay.status = ParlayStatus.OPEN;
        for (uint256 i = 0; i < legs.length; i++) {
            uint256 actualProbability = AMM_POOL.getOutcomeOdds(legs[i].marketId, legs[i].outcomeIndex);
            parlay.legs.push(
                ParlayLeg({
                    marketId: legs[i].marketId,
                    outcomeIndex: legs[i].outcomeIndex,
                    oddsAtTime: (1e18 * 1e18) / actualProbability
                })
            );
        }

        _mint(msg.sender, parlayId);
        if (address(betSlipNFT) != address(0)) {
            uint256[] memory marketIds = new uint256[](legs.length);
            bool[] memory sides = new bool[](legs.length);
            for (uint256 i = 0; i < legs.length; i++) {
                marketIds[i] = legs[i].marketId;
                sides[i] = legs[i].outcomeIndex == 0;
            }
            parlaySlipTokenId[parlayId] = betSlipNFT.mintSlip(
                msg.sender,
                address(this),
                parlayId,
                marketIds,
                sides,
                msg.value,
                combinedOdds,
                1,
                legs.length >= 5 ? 2 : 1,
                keccak256(abi.encode(marketIds, sides, msg.sender))
            );
        }
        RESPONSIBLE_LIMITS.recordSpend(msg.sender, msg.value);
        emit ParlayCreated(parlayId, msg.sender, legs.length, msg.value, payout);
    }

    function getParlay(uint256 parlayId) external view returns (Parlay memory) {
        if (parlays[parlayId].creator == address(0)) revert UnknownParlay();
        return parlays[parlayId];
    }

    function quoteCashout(uint256 parlayId) public view returns (uint256 cashoutValue) {
        Parlay storage parlay = parlays[parlayId];
        if (parlay.creator == address(0)) revert UnknownParlay();
        if (parlay.status != ParlayStatus.OPEN) return 0;

        uint256 liveProbability = 1e18;
        uint256 livePayout = parlay.payout;
        for (uint256 i = 0; i < parlay.legs.length; i++) {
            MarketFactory.Market memory market = MARKET_FACTORY.getMarket(parlay.legs[i].marketId);
            if (market.state == MarketFactory.MarketState.RESOLVED) {
                if (market.winningOutcome != parlay.legs[i].outcomeIndex) return 0;
                continue;
            }
            if (market.state == MarketFactory.MarketState.VOIDED) {
                livePayout = (livePayout * 1e18) / parlay.legs[i].oddsAtTime;
                continue;
            }
            uint256 legProbability = AMM_POOL.getOutcomeOdds(parlay.legs[i].marketId, parlay.legs[i].outcomeIndex);
            liveProbability = (liveProbability * legProbability) / 1e18;
        }

        uint256 fairValue = (livePayout * liveProbability) / 1e18;
        cashoutValue = (fairValue * (10_000 - cashoutDiscountBps)) / 10_000;
        if (cashoutValue > livePayout) cashoutValue = livePayout;
    }

    function cashoutParlay(uint256 parlayId, uint256 minPayout) external nonReentrant returns (uint256 payout) {
        Parlay storage parlay = parlays[parlayId];
        if (parlay.creator == address(0)) revert UnknownParlay();
        if (parlay.status != ParlayStatus.OPEN) revert NotOpen();
        if (ownerOf(parlayId) != msg.sender) revert NotOwner();

        payout = quoteCashout(parlayId);
        if (payout == 0) revert NoCashoutValue();
        if (payout < minPayout) revert SlippageExceeded();
        if (houseBalance < payout) revert InsufficientHouseBalance();

        parlay.status = ParlayStatus.CASHED_OUT;
        if (parlaySlipTokenId[parlayId] != 0) betSlipNFT.updateStatus(parlaySlipTokenId[parlayId], BetSlipNFT.SlipStatus.CASHED_OUT);
        reservedLiability -= parlay.payout;
        houseBalance -= payout;
        _burn(parlayId);
        (bool success,) = payable(msg.sender).call{value: payout}("");
        if (!success) revert TransferFailed();
        emit ParlayCashedOut(parlayId, msg.sender, payout, parlay.payout);
    }

    function settleParlay(uint256 parlayId) external {
        Parlay storage parlay = parlays[parlayId];
        if (parlay.creator == address(0)) revert UnknownParlay();
        if (parlay.status != ParlayStatus.OPEN) revert NotOpen();

        bool allResolved = true;
        bool partiallyVoided;
        uint256 adjustedPayout = parlay.payout;
        for (uint256 i = 0; i < parlay.legs.length; i++) {
            MarketFactory.Market memory market = MARKET_FACTORY.getMarket(parlay.legs[i].marketId);
            if (market.state == MarketFactory.MarketState.VOIDED) {
                partiallyVoided = true;
                adjustedPayout = (adjustedPayout * 1e18) / parlay.legs[i].oddsAtTime;
                continue;
            }
            if (market.state != MarketFactory.MarketState.RESOLVED) {
                allResolved = false;
                continue;
            }
            if (market.winningOutcome != parlay.legs[i].outcomeIndex) {
                parlay.status = ParlayStatus.LOST;
                if (parlaySlipTokenId[parlayId] != 0) betSlipNFT.updateStatus(parlaySlipTokenId[parlayId], BetSlipNFT.SlipStatus.LOST);
                reservedLiability -= parlay.payout;
                emit ParlaySettled(parlayId, uint8(parlay.status), 0);
                return;
            }
        }

        if (!allResolved) revert UnresolvedLegs();
        if (adjustedPayout < parlay.payout) {
            reservedLiability -= parlay.payout - adjustedPayout;
            parlay.payout = adjustedPayout;
        }
        parlay.status = partiallyVoided ? ParlayStatus.PARTIALLY_VOIDED : ParlayStatus.WON;
        if (parlaySlipTokenId[parlayId] != 0) betSlipNFT.updateStatus(parlaySlipTokenId[parlayId], BetSlipNFT.SlipStatus.WON);
        emit ParlaySettled(parlayId, uint8(parlay.status), parlay.payout);
    }

    function claim(uint256 parlayId) external nonReentrant {
        Parlay storage parlay = parlays[parlayId];
        if (parlay.creator == address(0)) revert UnknownParlay();
        if (ownerOf(parlayId) != msg.sender) revert NotOwner();
        if (parlay.status != ParlayStatus.WON && parlay.status != ParlayStatus.PARTIALLY_VOIDED) revert NotClaimable();
        if (houseBalance < parlay.payout) revert InsufficientHouseBalance();

        uint256 payout = parlay.payout;
        parlay.status = ParlayStatus.CLAIMED;
        if (parlaySlipTokenId[parlayId] != 0) betSlipNFT.updateStatus(parlaySlipTokenId[parlayId], BetSlipNFT.SlipStatus.CLAIMED);
        reservedLiability -= payout;
        houseBalance -= payout;
        _burn(parlayId);

        (bool success,) = payable(msg.sender).call{value: payout}("");
        if (!success) revert TransferFailed();
        emit ParlayClaimed(parlayId, msg.sender, payout);
    }
}
