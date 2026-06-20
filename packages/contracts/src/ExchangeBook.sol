// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MarketFactory} from "./MarketFactory.sol";
import {ResponsibleLimits} from "./ResponsibleLimits.sol";
import {CreatorVault} from "./CreatorVault.sol";
import {IERC1271} from "openzeppelin-contracts/contracts/interfaces/IERC1271.sol";

interface IAgentSessionWallet {
    function consumeSessionFill(bytes32 digest, bytes calldata signature, uint256 amount) external;
}

/// @title ExchangeBook
/// @notice On-chain order book exchange with EIP-712 signed orders and escrow
/// @dev Orders are signed off-chain, matched on-chain by the matcher. Funds held in escrow.
contract ExchangeBook {
    enum Side {
        BACK,
        LAY
    }

    enum TimeInForce {
        GTC,
        GTD,
        IOC,
        FOK,
        FAK,
        POST_ONLY
    }

    struct Order {
        address maker;
        uint256 marketId;
        uint256 outcomeIndex;
        Side side;
        TimeInForce tif;
        uint256 price1e18;
        uint256 size;
        uint256 nonce;
        uint64 expiry;
        bool reduceOnly;
    }

    // --- Custom Errors ---
    error NoFill();
    error OrderExpired();
    error BadPrice();
    error BadOutcome();
    error OrderCanceled();
    error MarketNotOpen();
    error BadSignature();
    error Overfill();
    error BadSigLength();
    error BadSigV();
    error BadSigS();
    error RecoveredZeroAddress();
    error NotMatcher();
    error BadMatcher();
    error InsufficientEscrow();
    error NothingToWithdraw();
    error TransferFailed();
    error BadContractSignature();

    /// @dev Upper bound of s for signature malleability check (secp256k1n / 2)
    bytes32 private constant _S_UPPER_BOUND = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    bytes32 public constant ORDER_TYPEHASH = keccak256(
        "Order(address maker,uint256 marketId,uint256 outcomeIndex,uint8 side,uint8 tif,uint256 price1e18,uint256 size,uint256 nonce,uint64 expiry,bool reduceOnly)"
    );
    bytes32 public immutable DOMAIN_SEPARATOR;

    MarketFactory public immutable MARKET_FACTORY;
    ResponsibleLimits public immutable RESPONSIBLE_LIMITS;
    address public matcher;
    CreatorVault public creatorVault;
    uint256 public exchangeFeeBps = 20;

    mapping(address => mapping(uint256 => bool)) public canceledNonce;
    mapping(bytes32 => uint256) public filledSize;

    /// @notice ETH escrow balances for makers
    mapping(address => uint256) public escrow;

    event MatcherSet(address indexed matcher);
    event OrderCanceledEvent(address indexed maker, uint256 indexed nonce);
    event OrderFilled(
        bytes32 indexed orderHash,
        address indexed maker,
        address indexed taker,
        uint256 marketId,
        uint256 outcomeIndex,
        uint8 side,
        uint256 fillSize,
        uint256 price1e18
    );
    event Deposited(address indexed user, uint256 amount, uint256 newBalance);
    event Withdrawn(address indexed user, uint256 amount, uint256 newBalance);
    event CreatorVaultSet(address indexed vault);

    modifier onlyMatcher() {
        if (msg.sender != matcher) revert NotMatcher();
        _;
    }

    constructor(MarketFactory marketFactory_, ResponsibleLimits responsibleLimits_, address matcher_) {
        MARKET_FACTORY = marketFactory_;
        RESPONSIBLE_LIMITS = responsibleLimits_;
        matcher = matcher_ == address(0) ? msg.sender : matcher_;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("Monad ArenaX ExchangeBook")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
        emit MatcherSet(matcher);
    }

    /// @notice Deposit ETH into escrow for order matching
    function deposit() external payable {
        escrow[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value, escrow[msg.sender]);
    }

    /// @notice Withdraw ETH from escrow
    /// @param amount The amount to withdraw
    function withdraw(uint256 amount) external {
        if (escrow[msg.sender] < amount) revert InsufficientEscrow();
        escrow[msg.sender] -= amount;
        (bool success,) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Withdrawn(msg.sender, amount, escrow[msg.sender]);
    }

    /// @notice Update the matcher address
    /// @param nextMatcher The new matcher address
    function setMatcher(address nextMatcher) external onlyMatcher {
        if (nextMatcher == address(0)) revert BadMatcher();
        matcher = nextMatcher;
        emit MatcherSet(nextMatcher);
    }

    function setCreatorVault(CreatorVault vault) external onlyMatcher {
        creatorVault = vault;
        emit CreatorVaultSet(address(vault));
    }

    /// @notice Cancel an order by nonce
    /// @param nonce The order nonce to cancel
    function cancelOrder(uint256 nonce) external {
        canceledNonce[msg.sender][nonce] = true;
        emit OrderCanceledEvent(msg.sender, nonce);
    }

    /// @notice Fill a signed order, moving funds between maker and taker escrow
    /// @param order The order details
    /// @param fillSize The number of shares/units to fill
    /// @param taker The taker address
    /// @param signature The maker's EIP-712 signature
    function fillOrder(Order calldata order, uint256 fillSize, address taker, bytes calldata signature) external payable onlyMatcher {
        if (fillSize == 0) revert NoFill();
        if (block.timestamp > order.expiry) revert OrderExpired();
        if (order.price1e18 == 0 || order.price1e18 >= 1e18) revert BadPrice();
        if (order.outcomeIndex > 1) revert BadOutcome();
        if (canceledNonce[order.maker][order.nonce]) revert OrderCanceled();
        if (MARKET_FACTORY.marketState(order.marketId) != MarketFactory.MarketState.OPEN) revert MarketNotOpen();

        bytes32 orderHash = hashOrder(order);
        if (!_isValidMakerSignature(order.maker, orderHash, signature)) revert BadSignature();
        if (filledSize[orderHash] + fillSize > order.size) revert Overfill();
        if (order.maker.code.length > 0) {
            try IAgentSessionWallet(order.maker).consumeSessionFill(orderHash, signature, fillSize) {}
            catch {
                revert BadContractSignature();
            }
        }

        // Calculate the implied price values
        uint256 baseCost = (fillSize * order.price1e18) / 1e18;
        uint256 makerCost = order.side == Side.BACK ? baseCost : fillSize - baseCost;
        uint256 takerCost = order.side == Side.BACK ? fillSize - baseCost : baseCost;

        uint256 fee = address(creatorVault) == address(0) ? 0 : (fillSize * exchangeFeeBps) / 10_000;

        // Transfer escrow: maker pays makerCost and protocol fee, taker deposits via msg.value.
        if (escrow[order.maker] < makerCost + fee) revert InsufficientEscrow();
        escrow[order.maker] -= makerCost + fee;
        escrow[taker] += msg.value;

        // Taker pays the complementary side
        if (escrow[taker] < takerCost) revert InsufficientEscrow();
        escrow[taker] -= takerCost;

        RESPONSIBLE_LIMITS.recordOpenOrder(order.maker, fillSize);
        RESPONSIBLE_LIMITS.recordExposure(order.maker, fillSize);
        if (fee > 0) {
            MarketFactory.Market memory market = MARKET_FACTORY.getMarket(order.marketId);
            creatorVault.recordFee{value: fee}(market.creator, address(0));
        }

        filledSize[orderHash] += fillSize;
        emit OrderFilled(
            orderHash,
            order.maker,
            taker,
            order.marketId,
            order.outcomeIndex,
            uint8(order.side),
            fillSize,
            order.price1e18
        );
    }

    /// @notice Hash an order for EIP-712 signing
    /// @param order The order to hash
    /// @return The EIP-712 typed data hash
    function hashOrder(Order calldata order) public view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                ORDER_TYPEHASH,
                order.maker,
                order.marketId,
                order.outcomeIndex,
                order.side,
                order.tif,
                order.price1e18,
                order.size,
                order.nonce,
                order.expiry,
                order.reduceOnly
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }

    /// @notice Recover the signer from an EIP-712 signature
    /// @dev Includes s-value malleability check and zero-address check
    function _recover(bytes32 digest, bytes calldata signature) internal pure returns (address) {
        if (signature.length != 65) revert BadSigLength();
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(signature.offset)
            s := calldataload(add(signature.offset, 32))
            v := byte(0, calldataload(add(signature.offset, 64)))
        }
        if (v < 27) v += 27;
        if (v != 27 && v != 28) revert BadSigV();

        // Signature malleability check: s must be in lower half
        if (uint256(s) > uint256(_S_UPPER_BOUND)) revert BadSigS();

        address recovered = ecrecover(digest, v, r, s);
        if (recovered == address(0)) revert RecoveredZeroAddress();
        return recovered;
    }

    function _isValidMakerSignature(address maker, bytes32 digest, bytes calldata signature) private view returns (bool) {
        if (maker.code.length == 0) return _recover(digest, signature) == maker;
        try IERC1271(maker).isValidSignature(digest, signature) returns (bytes4 magicValue) {
            return magicValue == IERC1271.isValidSignature.selector;
        } catch {
            return false;
        }
    }
}
