// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AIPass
/// @notice NFT-like pass system that grants AI credit tiers
/// @dev Each tier has a price and monthly credit allocation. Overpayment is refunded.
contract AIPass {
    enum Tier {
        FREE,
        PRO,
        CREATOR,
        LP,
        INSTITUTIONAL
    }

    struct TierConfig {
        uint256 price;
        uint256 monthlyCredits;
        bool active;
    }

    // --- Custom Errors ---
    error NotOwner();
    error TierInactive();
    error InsufficientPayment();
    error InsufficientCredits();
    error BadRecipient();
    error TransferFailed();

    address public owner;
    mapping(address => bool) public authorizedConsumer;
    mapping(uint256 => TierConfig) public tierConfig;
    mapping(address => mapping(uint256 => uint256)) public balanceOf;
    mapping(address => uint256) public aiCredits;

    event TierConfigured(uint256 indexed tier, uint256 price, uint256 monthlyCredits, bool active);
    event PassMinted(address indexed user, uint256 indexed tier, uint256 credits);
    event CreditsConsumed(address indexed user, uint256 credits);
    event OverpaymentRefunded(address indexed user, uint256 amount);
    event ConsumerSet(address indexed consumer, bool enabled);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyConsumer() {
        if (!authorizedConsumer[msg.sender]) revert NotOwner();
        _;
    }

    constructor() {
        owner = msg.sender;
        authorizedConsumer[msg.sender] = true;
        _setTier(uint256(Tier.FREE), 0, 25, true);
        _setTier(uint256(Tier.PRO), 1 ether, 750, true);
        _setTier(uint256(Tier.CREATOR), 2 ether, 1_500, true);
        _setTier(uint256(Tier.LP), 3 ether, 2_000, true);
        _setTier(uint256(Tier.INSTITUTIONAL), 8 ether, 10_000, true);
    }

    function setConsumer(address consumer, bool enabled) external onlyOwner {
        if (consumer == address(0)) revert BadRecipient();
        authorizedConsumer[consumer] = enabled;
        emit ConsumerSet(consumer, enabled);
    }

    /// @notice Configure a tier's price and credit allocation
    /// @param tier The tier index
    /// @param price The price in ETH
    /// @param monthlyCredits The credits granted per mint
    /// @param active Whether the tier is available for minting
    function configureTier(uint256 tier, uint256 price, uint256 monthlyCredits, bool active) external onlyOwner {
        _setTier(tier, price, monthlyCredits, active);
    }

    /// @notice Mint a pass for a tier. Overpayment is refunded automatically.
    /// @param tier The tier to mint
    function mintPass(uint256 tier) external payable {
        TierConfig memory config = tierConfig[tier];
        if (!config.active) revert TierInactive();
        if (msg.value < config.price) revert InsufficientPayment();

        balanceOf[msg.sender][tier] += 1;
        aiCredits[msg.sender] += config.monthlyCredits;
        emit PassMinted(msg.sender, tier, config.monthlyCredits);

        // Refund overpayment
        uint256 excess = msg.value - config.price;
        if (excess > 0) {
            (bool success,) = payable(msg.sender).call{value: excess}("");
            if (!success) revert TransferFailed();
            emit OverpaymentRefunded(msg.sender, excess);
        }
    }

    /// @notice Consume AI credits from a user (owner-only)
    /// @param user The user to consume credits from
    /// @param credits The number of credits to consume
    function consumeCredits(address user, uint256 credits) external onlyConsumer {
        if (aiCredits[user] < credits) revert InsufficientCredits();
        aiCredits[user] -= credits;
        emit CreditsConsumed(user, credits);
    }

    /// @notice Get the highest tier a user holds
    /// @param user The user to query
    /// @return The highest tier index
    function bestTier(address user) external view returns (uint256) {
        for (uint256 tier = uint256(Tier.INSTITUTIONAL); tier > 0; tier--) {
            if (balanceOf[user][tier] > 0) return tier;
        }
        return 0;
    }

    /// @notice Withdraw contract ETH balance (owner-only)
    /// @param recipient The address to send funds to
    function withdraw(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert BadRecipient();
        uint256 balance = address(this).balance;
        (bool success,) = recipient.call{value: balance}("");
        if (!success) revert TransferFailed();
    }

    function _setTier(uint256 tier, uint256 price, uint256 monthlyCredits, bool active) internal {
        tierConfig[tier] = TierConfig({price: price, monthlyCredits: monthlyCredits, active: active});
        emit TierConfigured(tier, price, monthlyCredits, active);
    }
}
