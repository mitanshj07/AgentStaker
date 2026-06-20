// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CreatorVault
/// @notice Splits fees between creators, referrers, and the protocol
/// @dev Only authorized callers (e.g. AMMPool, ExchangeBook) can record fees.
contract CreatorVault {
    // --- Custom Errors ---
    error NotOwner();
    error NotAuthorized();
    error BadCreator();
    error NoFee();
    error NothingToClaim();
    error BadRecipient();
    error TransferFailed();

    address public owner;
    mapping(address => uint256) public creatorBalance;
    mapping(address => mapping(address => uint256)) public referralBalance;
    uint256 public protocolFees;

    /// @notice Authorized callers that can record fees
    mapping(address => bool) public authorizedCaller;

    event CreatorFeeRecorded(address indexed creator, address indexed referrer, uint256 creatorAmount, uint256 referralAmount, uint256 protocolAmount);
    event CreatorClaimed(address indexed creator, uint256 amount);
    event ReferralClaimed(address indexed creator, address indexed referrer, uint256 amount);
    event ProtocolClaimed(address indexed recipient, uint256 amount);
    event AuthorizedCallerSet(address indexed caller, bool enabled);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAuthorized() {
        if (!authorizedCaller[msg.sender]) revert NotAuthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
        // Owner is authorized by default
        authorizedCaller[msg.sender] = true;
        emit AuthorizedCallerSet(msg.sender, true);
    }

    /// @notice Set or revoke authorized caller status
    /// @param caller The address to authorize/deauthorize
    /// @param enabled Whether the caller is authorized
    function setAuthorized(address caller, bool enabled) external onlyOwner {
        authorizedCaller[caller] = enabled;
        emit AuthorizedCallerSet(caller, enabled);
    }

    /// @notice Record a fee split between creator, referrer, and protocol
    /// @dev Only callable by authorized contracts
    /// @param creator The market creator
    /// @param referrer The referrer (address(0) if none)
    function recordFee(address creator, address referrer) external payable onlyAuthorized {
        if (creator == address(0)) revert BadCreator();
        if (msg.value == 0) revert NoFee();

        uint256 creatorAmount = (msg.value * 7000) / 10_000;
        uint256 referralAmount = referrer == address(0) ? 0 : (msg.value * 1500) / 10_000;
        uint256 protocolAmount = msg.value - creatorAmount - referralAmount;

        creatorBalance[creator] += creatorAmount;
        if (referralAmount > 0) referralBalance[creator][referrer] += referralAmount;
        protocolFees += protocolAmount;

        emit CreatorFeeRecorded(creator, referrer, creatorAmount, referralAmount, protocolAmount);
    }

    /// @notice Creator claims their accumulated fees
    function claimCreator() external {
        uint256 amount = creatorBalance[msg.sender];
        if (amount == 0) revert NothingToClaim();
        creatorBalance[msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit CreatorClaimed(msg.sender, amount);
    }

    /// @notice Referrer claims fees earned from a specific creator
    /// @param creator The creator whose referral fees to claim
    function claimReferral(address creator) external {
        uint256 amount = referralBalance[creator][msg.sender];
        if (amount == 0) revert NothingToClaim();
        referralBalance[creator][msg.sender] = 0;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit ReferralClaimed(creator, msg.sender, amount);
    }

    /// @notice Owner claims accumulated protocol fees
    /// @param recipient The address to send protocol fees to
    function claimProtocol(address payable recipient) external onlyOwner {
        if (recipient == address(0)) revert BadRecipient();
        uint256 amount = protocolFees;
        if (amount == 0) revert NothingToClaim();
        protocolFees = 0;
        (bool success,) = recipient.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit ProtocolClaimed(recipient, amount);
    }
}
