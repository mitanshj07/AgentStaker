// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MarketFactory {
    enum MarketType {
        BINARY,
        MULTI_OUTCOME,
        SPORTS,
        SCALAR
    }

    enum MarketState {
        PENDING,
        OPEN,
        LOCKED,
        DISPUTED,
        RESOLVED,
        SETTLED,
        VOIDED
    }

    struct Market {
        uint256 id;
        address creator;
        string question;
        string category;
        string[] outcomes;
        MarketType marketType;
        MarketState state;
        uint64 lockTime;
        uint64 resolveTime;
        uint64 disputeWindow;
        address resolutionSource;
        uint256 creatorFeeRate;
        uint256 winningOutcome;
    }

    address public operator;
    uint256 public nextMarketId = 1;
    mapping(uint256 => Market) private markets;

    event MarketCreated(uint256 indexed marketId, address indexed creator, string question, string category);
    event MarketLocked(uint256 indexed marketId);
    event MarketDisputed(uint256 indexed marketId);
    event MarketResolved(uint256 indexed marketId, uint256 indexed winningOutcome);
    event MarketVoided(uint256 indexed marketId, string reason);

    modifier onlyOperator() {
        _onlyOperator();
        _;
    }

    constructor(address operator_) {
        operator = operator_ == address(0) ? msg.sender : operator_;
    }

    function _onlyOperator() internal view {
        require(msg.sender == operator, "NOT_OPERATOR");
    }

    function setOperator(address nextOperator) external onlyOperator {
        require(nextOperator != address(0), "BAD_OPERATOR");
        operator = nextOperator;
    }

    function createBinaryMarket(
        string calldata question,
        string calldata category,
        uint64 lockTime,
        uint64 resolveTime,
        address resolutionSource
    ) external returns (uint256 marketId) {
        require(bytes(question).length > 12, "QUESTION_TOO_SHORT");
        require(lockTime > block.timestamp, "LOCK_IN_PAST");
        require(resolveTime > lockTime, "BAD_RESOLVE_TIME");
        require(resolutionSource != address(0), "BAD_SOURCE");

        marketId = nextMarketId++;
        string[] memory outcomes = new string[](2);
        outcomes[0] = "YES";
        outcomes[1] = "NO";

        markets[marketId] = Market({
            id: marketId,
            creator: msg.sender,
            question: question,
            category: category,
            outcomes: outcomes,
            marketType: MarketType.BINARY,
            state: MarketState.OPEN,
            lockTime: lockTime,
            resolveTime: resolveTime,
            disputeWindow: 30 minutes,
            resolutionSource: resolutionSource,
            creatorFeeRate: 50,
            winningOutcome: type(uint256).max
        });

        emit MarketCreated(marketId, msg.sender, question, category);
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        require(markets[marketId].id != 0, "UNKNOWN_MARKET");
        return markets[marketId];
    }

    function marketState(uint256 marketId) external view returns (MarketState) {
        require(markets[marketId].id != 0, "UNKNOWN_MARKET");
        return markets[marketId].state;
    }

    function lockMarket(uint256 marketId) external {
        Market storage market = markets[marketId];
        require(market.id != 0, "UNKNOWN_MARKET");
        require(market.state == MarketState.OPEN, "NOT_OPEN");
        require(block.timestamp >= market.lockTime, "TOO_EARLY");
        market.state = MarketState.LOCKED;
        emit MarketLocked(marketId);
    }

    function resolveMarket(uint256 marketId, uint256 winningOutcome) external onlyOperator {
        Market storage market = markets[marketId];
        require(market.id != 0, "UNKNOWN_MARKET");
        require(
            market.state == MarketState.OPEN || market.state == MarketState.LOCKED || market.state == MarketState.DISPUTED,
            "BAD_STATE"
        );
        require(winningOutcome < market.outcomes.length, "BAD_OUTCOME");
        market.state = MarketState.RESOLVED;
        market.winningOutcome = winningOutcome;
        emit MarketResolved(marketId, winningOutcome);
    }

    function markDisputed(uint256 marketId) external onlyOperator {
        Market storage market = markets[marketId];
        require(market.id != 0, "UNKNOWN_MARKET");
        require(market.state == MarketState.OPEN || market.state == MarketState.LOCKED, "BAD_STATE");
        market.state = MarketState.DISPUTED;
        emit MarketDisputed(marketId);
    }

    function voidMarket(uint256 marketId, string calldata reason) external onlyOperator {
        Market storage market = markets[marketId];
        require(market.id != 0, "UNKNOWN_MARKET");
        require(market.state != MarketState.SETTLED, "SETTLED");
        market.state = MarketState.VOIDED;
        emit MarketVoided(marketId, reason);
    }
}
