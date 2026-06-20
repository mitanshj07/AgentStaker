// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MarketFactory} from "./MarketFactory.sol";
import {ResponsibleLimits} from "./ResponsibleLimits.sol";
import {CreatorVault} from "./CreatorVault.sol";
import {BetSlipNFT} from "./BetSlipNFT.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";

/// @title AMMPool
/// @notice Constant-product AMM for binary prediction market outcome shares
/// @dev Uses x*y=k invariant for pricing. Each pool is seeded with equal YES/NO reserves.
contract AMMPool is ReentrancyGuard {
    struct Pool {
        uint256 yesReserve;
        uint256 noReserve;
        uint256 feeRateBps;
        address lpProvider;
        uint256 lpDeposit;
        uint256 totalLPUnits;
        bool exists;
    }

    // --- Custom Errors ---
    error NoLiquidity();
    error InsufficientLiquidity();
    error PoolExists();
    error FeeTooHigh();
    error PoolNotFound();
    error BadOutcome();
    error LimitBlocked();
    error MarketNotOpen();
    error SlippageExceeded();
    error InsufficientShares();
    error MarketNotResolved();
    error NothingToRedeem();
    error NotLPProvider();
    error MarketStillOpen();
    error TransferFailed();
    error NotOwner();
    error BadVault();
    error BadLPUnits();

    MarketFactory public immutable MARKET_FACTORY;
    ResponsibleLimits public immutable RESPONSIBLE_LIMITS;
    address public owner;
    CreatorVault public creatorVault;
    BetSlipNFT public betSlipNFT;
    uint256 public nextTradeSlipOrigin = 1;
    mapping(uint256 => Pool) public pools;
    mapping(uint256 => mapping(address => uint256)) public lpUnits;

    /// @notice Tracks share balances: marketId => user => outcomeIndex => shares
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public shares;

    event PoolCreated(uint256 indexed marketId, uint256 liquidity, uint256 feeRateBps);
    event Trade(
        uint256 indexed marketId,
        address indexed trader,
        uint256 outcomeIndex,
        uint256 amountIn,
        uint256 sharesOut,
        uint256 newOdds
    );
    event SharesSold(
        uint256 indexed marketId,
        address indexed trader,
        uint256 outcomeIndex,
        uint256 sharesIn,
        uint256 amountOut
    );
    event SharesRedeemed(
        uint256 indexed marketId,
        address indexed user,
        uint256 sharesRedeemed,
        uint256 payout
    );
    event LPWithdrawn(uint256 indexed marketId, address indexed lp, uint256 amount);
    event LiquidityAdded(uint256 indexed marketId, address indexed lp, uint256 amount, uint256 units);
    event LiquidityRemoved(uint256 indexed marketId, address indexed lp, uint256 amount, uint256 units);
    event CreatorVaultSet(address indexed vault);
    event BetSlipNFTSet(address indexed betSlipNFT);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(MarketFactory _marketFactory, ResponsibleLimits _responsibleLimits) {
        MARKET_FACTORY = _marketFactory;
        RESPONSIBLE_LIMITS = _responsibleLimits;
        owner = msg.sender;
    }

    function setCreatorVault(CreatorVault vault) external onlyOwner {
        if (address(vault) == address(0)) revert BadVault();
        creatorVault = vault;
        emit CreatorVaultSet(address(vault));
    }

    function setBetSlipNFT(BetSlipNFT betSlipNFT_) external onlyOwner {
        if (address(betSlipNFT_) == address(0)) revert BadVault();
        betSlipNFT = betSlipNFT_;
        emit BetSlipNFTSet(address(betSlipNFT_));
    }

    /// @notice Create a new AMM pool for a binary market
    /// @param marketId The market to create a pool for
    /// @param feeRateBps Fee in basis points (max 500 = 5%)
    function createPool(uint256 marketId, uint256 feeRateBps) external payable {
        if (msg.value == 0) revert NoLiquidity();
        if (pools[marketId].exists) revert PoolExists();
        if (feeRateBps > 500) revert FeeTooHigh();

        pools[marketId] = Pool({
            yesReserve: msg.value / 2,
            noReserve: msg.value - (msg.value / 2),
            feeRateBps: feeRateBps,
            lpProvider: msg.sender,
            lpDeposit: msg.value,
            totalLPUnits: msg.value,
            exists: true
        });
        lpUnits[marketId][msg.sender] = msg.value;

        emit PoolCreated(marketId, msg.value, feeRateBps);
        emit LiquidityAdded(marketId, msg.sender, msg.value, msg.value);
    }

    function addLiquidity(uint256 marketId) external payable returns (uint256 units) {
        if (msg.value == 0) revert NoLiquidity();
        Pool storage pool = pools[marketId];
        if (!pool.exists) revert PoolNotFound();

        uint256 reserveTotal = pool.yesReserve + pool.noReserve;
        units = (msg.value * pool.totalLPUnits) / reserveTotal;
        if (units == 0) revert BadLPUnits();

        uint256 yesAmount = (msg.value * pool.yesReserve) / reserveTotal;
        pool.yesReserve += yesAmount;
        pool.noReserve += msg.value - yesAmount;
        pool.totalLPUnits += units;
        lpUnits[marketId][msg.sender] += units;
        emit LiquidityAdded(marketId, msg.sender, msg.value, units);
    }

    function removeLiquidity(uint256 marketId, uint256 units, uint256 minAmountOut) public nonReentrant returns (uint256 amountOut) {
        Pool storage pool = pools[marketId];
        if (!pool.exists) revert PoolNotFound();
        if (units == 0 || lpUnits[marketId][msg.sender] < units) revert BadLPUnits();

        uint256 totalUnits = pool.totalLPUnits;
        uint256 yesAmount = (pool.yesReserve * units) / totalUnits;
        uint256 noAmount = (pool.noReserve * units) / totalUnits;
        amountOut = yesAmount + noAmount;
        if (amountOut < minAmountOut) revert SlippageExceeded();

        lpUnits[marketId][msg.sender] -= units;
        pool.totalLPUnits -= units;
        pool.yesReserve -= yesAmount;
        pool.noReserve -= noAmount;
        (bool success,) = payable(msg.sender).call{value: amountOut}("");
        if (!success) revert TransferFailed();
        emit LiquidityRemoved(marketId, msg.sender, amountOut, units);
    }

    /// @notice Quote the number of shares received for a given ETH input using constant-product math
    /// @param marketId The market pool to quote against
    /// @param outcomeIndex 0 = YES, 1 = NO
    /// @param amountIn The ETH amount to spend
    /// @return sharesOut Number of outcome shares received
    /// @return priceAfter The price of the outcome after the trade (1e18 scale)
    function quoteShares(
        uint256 marketId,
        uint256 outcomeIndex,
        uint256 amountIn
    ) public view returns (uint256 sharesOut, uint256 priceAfter) {
        Pool memory pool = pools[marketId];
        if (!pool.exists) revert PoolNotFound();
        if (outcomeIndex > 1) revert BadOutcome();

        uint256 fee = (amountIn * pool.feeRateBps) / 10_000;
        uint256 amountAfterFee = amountIn - fee;

        // Constant-product formula: sharesOut = reserveOut - k / (reserveIn + amountAfterFee)
        // where reserveIn is the reserve of the outcome being bought (goes up),
        // and reserveOut is the opposite reserve (shares come from here).
        uint256 reserveIn;
        uint256 reserveOut;
        if (outcomeIndex == 0) {
            // Buying YES: ETH goes into yesReserve side, shares come from noReserve
            reserveIn = pool.yesReserve;
            reserveOut = pool.noReserve;
        } else {
            // Buying NO: ETH goes into noReserve side, shares come from yesReserve
            reserveIn = pool.noReserve;
            reserveOut = pool.yesReserve;
        }

        uint256 k = reserveIn * reserveOut;
        uint256 newReserveIn = reserveIn + amountAfterFee;
        uint256 newReserveOut = k / newReserveIn;
        sharesOut = reserveOut - newReserveOut;

        // Price after = newReserveIn / (newReserveIn + newReserveOut)
        priceAfter = (newReserveIn * 1e18) / (newReserveIn + newReserveOut);
    }

    /// @notice Quote ETH returned for selling shares back to the pool
    /// @param marketId The market pool
    /// @param outcomeIndex 0 = YES, 1 = NO
    /// @param sharesIn Number of shares to sell
    /// @return amountOut ETH returned after fees
    function quoteSell(
        uint256 marketId,
        uint256 outcomeIndex,
        uint256 sharesIn
    ) public view returns (uint256 amountOut) {
        Pool memory pool = pools[marketId];
        if (!pool.exists) revert PoolNotFound();
        if (outcomeIndex > 1) revert BadOutcome();

        // Selling shares is the reverse: shares go back into the reserve they came from,
        // ETH comes out of the other reserve.
        uint256 reserveShares; // reserve that receives shares back
        uint256 reserveETH;    // reserve that releases ETH
        if (outcomeIndex == 0) {
            // Selling YES shares: shares go back to noReserve, ETH from yesReserve
            reserveShares = pool.noReserve;
            reserveETH = pool.yesReserve;
        } else {
            // Selling NO shares: shares go back to yesReserve, ETH from noReserve
            reserveShares = pool.yesReserve;
            reserveETH = pool.noReserve;
        }

        uint256 k = reserveShares * reserveETH;
        uint256 newReserveShares = reserveShares + sharesIn;
        uint256 newReserveETH = k / newReserveShares;
        uint256 grossOut = reserveETH - newReserveETH;
        uint256 fee = (grossOut * pool.feeRateBps) / 10_000;
        amountOut = grossOut - fee;
    }

    /// @notice Buy outcome shares with ETH
    /// @param marketId The market to trade on
    /// @param outcomeIndex 0 = YES, 1 = NO
    /// @param minSharesOut Minimum shares to accept (slippage protection)
    /// @return sharesOut The number of shares purchased
    function buy(uint256 marketId, uint256 outcomeIndex, uint256 minSharesOut) external payable returns (uint256 sharesOut) {
        return _buy(marketId, outcomeIndex, minSharesOut, address(0));
    }

    function buyWithReferrer(
        uint256 marketId,
        uint256 outcomeIndex,
        uint256 minSharesOut,
        address referrer
    ) external payable returns (uint256 sharesOut) {
        return _buy(marketId, outcomeIndex, minSharesOut, referrer);
    }

    function _buy(
        uint256 marketId,
        uint256 outcomeIndex,
        uint256 minSharesOut,
        address referrer
    ) internal returns (uint256 sharesOut) {
        if (!RESPONSIBLE_LIMITS.checkCanTrade(msg.sender, msg.value)) revert LimitBlocked();
        if (MARKET_FACTORY.marketState(marketId) != MarketFactory.MarketState.OPEN) revert MarketNotOpen();

        Pool storage pool = pools[marketId];
        if (!pool.exists) revert PoolNotFound();
        if (outcomeIndex > 1) revert BadOutcome();

        uint256 priceAfter;
        (sharesOut, priceAfter) = quoteShares(marketId, outcomeIndex, msg.value);
        if (sharesOut < minSharesOut) revert SlippageExceeded();

        // Update reserves using constant-product
        uint256 fee = (msg.value * pool.feeRateBps) / 10_000;
        uint256 amountAfterFee = msg.value - fee;

        if (outcomeIndex == 0) {
            uint256 k = pool.yesReserve * pool.noReserve;
            pool.yesReserve += amountAfterFee;
            pool.noReserve = k / pool.yesReserve;
        } else {
            uint256 k = pool.yesReserve * pool.noReserve;
            pool.noReserve += amountAfterFee;
            pool.yesReserve = k / pool.noReserve;
        }

        // Record shares for the buyer
        shares[marketId][msg.sender][uint8(outcomeIndex)] += sharesOut;

        if (address(creatorVault) != address(0) && fee > 0) {
            MarketFactory.Market memory market = MARKET_FACTORY.getMarket(marketId);
            creatorVault.recordFee{value: fee}(market.creator, referrer);
        }
        RESPONSIBLE_LIMITS.recordSpend(msg.sender, msg.value);
        if (address(betSlipNFT) != address(0)) {
            uint256[] memory marketIds = new uint256[](1);
            bool[] memory sides = new bool[](1);
            uint256 oddsSnapshot = priceAfter == 0 ? 0 : 1e36 / priceAfter;
            marketIds[0] = marketId;
            sides[0] = outcomeIndex == 0;
            betSlipNFT.mintSlip(
                msg.sender,
                address(this),
                nextTradeSlipOrigin++,
                marketIds,
                sides,
                msg.value,
                oddsSnapshot,
                0,
                _rarityForOdds(oddsSnapshot),
                keccak256(abi.encode(marketId, outcomeIndex, msg.sender, block.number))
            );
        }
        emit Trade(marketId, msg.sender, outcomeIndex, msg.value, sharesOut, priceAfter);
    }

    function _rarityForOdds(uint256 oddsSnapshot) private pure returns (uint8) {
        if (oddsSnapshot >= 10e18) return 3;
        if (oddsSnapshot >= 5e18) return 2;
        if (oddsSnapshot >= 2e18) return 1;
        return 0;
    }

    /// @notice Sell outcome shares back to the pool for ETH
    /// @param marketId The market to sell on
    /// @param outcomeIndex 0 = YES, 1 = NO
    /// @param sharesIn Number of shares to sell
    /// @param minAmountOut Minimum ETH to accept (slippage protection)
    /// @return amountOut The ETH returned
    function sell(uint256 marketId, uint256 outcomeIndex, uint256 sharesIn, uint256 minAmountOut) external nonReentrant returns (uint256 amountOut) {
        if (MARKET_FACTORY.marketState(marketId) != MarketFactory.MarketState.OPEN) revert MarketNotOpen();

        Pool storage pool = pools[marketId];
        if (!pool.exists) revert PoolNotFound();
        if (outcomeIndex > 1) revert BadOutcome();
        if (shares[marketId][msg.sender][uint8(outcomeIndex)] < sharesIn) revert InsufficientShares();

        amountOut = quoteSell(marketId, outcomeIndex, sharesIn);
        if (amountOut < minAmountOut) revert SlippageExceeded();

        // Burn shares first (checks-effects-interactions)
        shares[marketId][msg.sender][uint8(outcomeIndex)] -= sharesIn;

        // Update reserves
        if (outcomeIndex == 0) {
            uint256 k = pool.yesReserve * pool.noReserve;
            pool.noReserve += sharesIn;
            pool.yesReserve = k / pool.noReserve;
        } else {
            uint256 k = pool.yesReserve * pool.noReserve;
            pool.yesReserve += sharesIn;
            pool.noReserve = k / pool.yesReserve;
        }

        // Transfer ETH
        (bool success,) = payable(msg.sender).call{value: amountOut}("");
        if (!success) revert TransferFailed();

        emit SharesSold(marketId, msg.sender, outcomeIndex, sharesIn, amountOut);
    }

    /// @notice Redeem winning shares after market resolution for 1 ETH each
    /// @param marketId The resolved market
    function redeem(uint256 marketId) external {
        MarketFactory.Market memory market = MARKET_FACTORY.getMarket(marketId);
        if (market.state != MarketFactory.MarketState.RESOLVED) revert MarketNotResolved();

        uint8 winningOutcome = uint8(market.winningOutcome);
        uint256 userShares = shares[marketId][msg.sender][winningOutcome];
        if (userShares == 0) revert NothingToRedeem();

        // Burn shares first (checks-effects-interactions)
        shares[marketId][msg.sender][winningOutcome] = 0;

        // Payout = shares (1:1 with the ETH value locked)
        uint256 payout = userShares;
        
        if (address(this).balance < payout) revert InsufficientLiquidity();

        (bool success,) = payable(msg.sender).call{value: payout}("");
        if (!success) revert TransferFailed();

        emit SharesRedeemed(marketId, msg.sender, userShares, payout);
    }

    /// @notice LP can withdraw remaining pool liquidity after market resolution
    /// @param marketId The resolved market
    function withdrawLP(uint256 marketId) external {
        Pool storage pool = pools[marketId];
        if (!pool.exists) revert PoolNotFound();
        if (msg.sender != pool.lpProvider) revert NotLPProvider();

        MarketFactory.MarketState state = MARKET_FACTORY.marketState(marketId);
        if (state != MarketFactory.MarketState.RESOLVED && state != MarketFactory.MarketState.VOIDED) {
            revert MarketStillOpen();
        }

        uint256 units = lpUnits[marketId][msg.sender];
        uint256 remaining = units == 0 ? 0 : removeLiquidity(marketId, units, 0);
        emit LPWithdrawn(marketId, msg.sender, remaining);
    }

    /// @notice Get the current price/odds for an outcome
    /// @param marketId The market to query
    /// @param outcomeIndex 0 = YES, 1 = NO
    /// @return odds1e18 The odds scaled by 1e18
    function getOutcomeOdds(uint256 marketId, uint256 outcomeIndex) public view returns (uint256 odds1e18) {
        Pool memory pool = pools[marketId];
        if (!pool.exists) revert PoolNotFound();
        uint256 total = pool.yesReserve + pool.noReserve;
        if (outcomeIndex == 0) return (pool.yesReserve * 1e18) / total;
        if (outcomeIndex == 1) return (pool.noReserve * 1e18) / total;
        revert BadOutcome();
    }
}
