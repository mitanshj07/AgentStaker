// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC1271} from "openzeppelin-contracts/contracts/interfaces/IERC1271.sol";
import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

interface IExchangeEscrow {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function cancelOrder(uint256 nonce) external;
}

/// @title AgentWallet
/// @notice Restricted ERC-1271 wallet for capped CLOB sessions. It cannot call arbitrary targets.
contract AgentWallet is IERC1271 {
    bytes4 internal constant MAGIC_VALUE = IERC1271.isValidSignature.selector;

    struct Session {
        uint64 expiry;
        uint64 dayBucket;
        uint256 dailyCap;
        uint256 spentToday;
        bool paused;
    }

    address public immutable owner;
    address public immutable exchange;
    mapping(address => Session) public sessions;

    event SessionAuthorized(address indexed sessionKey, uint64 expiry, uint256 dailyCap);
    event SessionPaused(address indexed sessionKey, bool paused);
    event SessionRevoked(address indexed sessionKey);
    event SessionConsumed(address indexed sessionKey, uint256 amount, uint256 spentToday);
    event ExchangeFunded(uint256 amount);
    event ExchangeWithdrawn(uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyExchange() {
        require(msg.sender == exchange, "NOT_EXCHANGE");
        _;
    }

    constructor(address owner_, address exchange_) {
        require(owner_ != address(0) && exchange_ != address(0), "BAD_ADDRESS");
        owner = owner_;
        exchange = exchange_;
    }

    function authorizeSession(address sessionKey, uint64 expiry, uint256 dailyCap) external onlyOwner {
        require(sessionKey != address(0) && expiry > block.timestamp && dailyCap > 0, "BAD_SESSION");
        sessions[sessionKey] = Session(expiry, uint64(block.timestamp / 1 days), dailyCap, 0, false);
        emit SessionAuthorized(sessionKey, expiry, dailyCap);
    }

    function pauseSession(address sessionKey, bool paused) external onlyOwner {
        require(sessions[sessionKey].expiry != 0, "UNKNOWN_SESSION");
        sessions[sessionKey].paused = paused;
        emit SessionPaused(sessionKey, paused);
    }

    function revokeSession(address sessionKey) external onlyOwner {
        delete sessions[sessionKey];
        emit SessionRevoked(sessionKey);
    }

    function fundExchange() external payable onlyOwner {
        require(msg.value > 0, "NO_VALUE");
        IExchangeEscrow(exchange).deposit{value: msg.value}();
        emit ExchangeFunded(msg.value);
    }

    function withdrawExchange(uint256 amount) external onlyOwner {
        IExchangeEscrow(exchange).withdraw(amount);
        (bool success,) = payable(owner).call{value: amount}("");
        require(success, "TRANSFER_FAILED");
        emit ExchangeWithdrawn(amount);
    }

    function cancelOrder(uint256 nonce) external {
        _requireActive(msg.sender);
        IExchangeEscrow(exchange).cancelOrder(nonce);
    }

    function consumeSessionFill(bytes32 digest, bytes calldata signature, uint256 amount) external onlyExchange {
        address sessionKey = ECDSA.recover(digest, signature);
        Session storage session = sessions[sessionKey];
        _rollDay(session);
        _requireActive(sessionKey);
        require(session.spentToday + amount <= session.dailyCap, "SESSION_CAP");
        session.spentToday += amount;
        emit SessionConsumed(sessionKey, amount, session.spentToday);
    }

    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4) {
        (address sessionKey, ECDSA.RecoverError error,) = ECDSA.tryRecover(hash, signature);
        if (error != ECDSA.RecoverError.NoError) return bytes4(0);
        Session memory session = sessions[sessionKey];
        if (session.expiry >= block.timestamp && !session.paused && session.dailyCap > 0) return MAGIC_VALUE;
        return bytes4(0);
    }

    function _requireActive(address sessionKey) private view {
        Session memory session = sessions[sessionKey];
        require(session.expiry >= block.timestamp && !session.paused && session.dailyCap > 0, "SESSION_INACTIVE");
    }

    function _rollDay(Session storage session) private {
        uint64 bucket = uint64(block.timestamp / 1 days);
        if (session.dayBucket != bucket) {
            session.dayBucket = bucket;
            session.spentToday = 0;
        }
    }

    receive() external payable {}
}
