// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {AMMPool} from "./AMMPool.sol";

/// @title SharedLiquidityVault
/// @notice Shared test-MON LP vault with queued withdrawals and operator rebalancing.
contract SharedLiquidityVault is ReentrancyGuard {
    AMMPool public immutable AMM_POOL;
    address public owner;
    uint256 public totalShares;
    uint256 public idleBalance;
    uint256 public totalDeployed;
    uint256 public queuedAssets;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public pendingWithdrawal;
    mapping(uint256 => uint256) public deployedByMarket;
    mapping(uint256 => uint256) public lpUnitsByMarket;

    event Deposited(address indexed user, uint256 assets, uint256 shares);
    event WithdrawalPaid(address indexed user, uint256 assets, uint256 shares);
    event WithdrawalQueued(address indexed user, uint256 assets, uint256 shares);
    event AllocationChanged(uint256 indexed marketId, uint256 deployedAssets, uint256 lpUnits);
    event Rebalanced(uint256 indexed fromMarketId, uint256 indexed toMarketId, uint256 assets);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    constructor(AMMPool ammPool_) {
        AMM_POOL = ammPool_;
        owner = msg.sender;
    }

    receive() external payable {}

    function totalAssets() public view returns (uint256) {
        return idleBalance + totalDeployed - queuedAssets;
    }

    function availableIdle() public view returns (uint256) {
        return idleBalance > queuedAssets ? idleBalance - queuedAssets : 0;
    }

    function deposit() external payable returns (uint256 shares) {
        require(msg.value > 0, "NO_DEPOSIT");
        uint256 assetsBefore = totalAssets();
        shares = totalShares == 0 || assetsBefore == 0 ? msg.value : (msg.value * totalShares) / assetsBefore;
        require(shares > 0, "NO_SHARES");
        totalShares += shares;
        balanceOf[msg.sender] += shares;
        idleBalance += msg.value;
        emit Deposited(msg.sender, msg.value, shares);
    }

    function requestWithdraw(uint256 shares, uint256 minAssets) external nonReentrant returns (uint256 assets) {
        require(shares > 0 && balanceOf[msg.sender] >= shares, "BAD_SHARES");
        assets = (shares * totalAssets()) / totalShares;
        require(assets >= minAssets, "SLIPPAGE");
        balanceOf[msg.sender] -= shares;
        totalShares -= shares;

        if (availableIdle() >= assets) {
            idleBalance -= assets;
            _send(msg.sender, assets);
            emit WithdrawalPaid(msg.sender, assets, shares);
        } else {
            pendingWithdrawal[msg.sender] += assets;
            queuedAssets += assets;
            emit WithdrawalQueued(msg.sender, assets, shares);
        }
    }

    function processWithdrawal(address user) external nonReentrant {
        uint256 assets = pendingWithdrawal[user];
        require(assets > 0 && idleBalance >= assets, "NOT_READY");
        pendingWithdrawal[user] = 0;
        queuedAssets -= assets;
        idleBalance -= assets;
        _send(user, assets);
        emit WithdrawalPaid(user, assets, 0);
    }

    function allocate(uint256 marketId, uint256 amount) external onlyOwner returns (uint256 units) {
        units = _allocate(marketId, amount);
    }

    function recall(uint256 marketId, uint256 amount, uint256 minAmountOut) external onlyOwner returns (uint256 assets) {
        assets = _recall(marketId, amount, minAmountOut);
    }

    function rebalance(uint256 fromMarketId, uint256 toMarketId, uint256 amount, uint256 minReceived)
        external
        onlyOwner
        returns (uint256 assets)
    {
        assets = _recall(fromMarketId, amount, minReceived);
        _allocate(toMarketId, assets);
        emit Rebalanced(fromMarketId, toMarketId, assets);
    }

    function _allocate(uint256 marketId, uint256 amount) internal returns (uint256 units) {
        require(amount > 0 && availableIdle() >= amount, "INSUFFICIENT_IDLE");
        idleBalance -= amount;
        units = AMM_POOL.addLiquidity{value: amount}(marketId);
        deployedByMarket[marketId] += amount;
        totalDeployed += amount;
        lpUnitsByMarket[marketId] += units;
        emit AllocationChanged(marketId, deployedByMarket[marketId], lpUnitsByMarket[marketId]);
    }

    function _recall(uint256 marketId, uint256 amount, uint256 minAmountOut) internal returns (uint256 assets) {
        uint256 deployed = deployedByMarket[marketId];
        require(amount > 0 && amount <= deployed, "BAD_AMOUNT");
        uint256 units = (lpUnitsByMarket[marketId] * amount) / deployed;
        assets = AMM_POOL.removeLiquidity(marketId, units, minAmountOut);
        deployedByMarket[marketId] -= amount;
        totalDeployed -= amount;
        lpUnitsByMarket[marketId] -= units;
        idleBalance += assets;
        emit AllocationChanged(marketId, deployedByMarket[marketId], lpUnitsByMarket[marketId]);
    }

    function _send(address user, uint256 amount) internal {
        (bool success,) = payable(user).call{value: amount}("");
        require(success, "TRANSFER_FAILED");
    }
}
