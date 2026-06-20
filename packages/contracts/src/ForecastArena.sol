// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MarketFactory} from "./MarketFactory.sol";
import {Reputation} from "./Reputation.sol";

/// @title ForecastArena
/// @notice Commit-reveal forecasting tournament with on-chain reputation scoring.
contract ForecastArena {
    struct Agent {
        address owner;
        string name;
        string metadataURI;
        bool active;
    }

    struct Forecast {
        bytes32 commitHash;
        uint256 probabilityYes1e18;
        uint64 revealDeadline;
        bool revealed;
        bool scored;
    }

    MarketFactory public immutable MARKET_FACTORY;
    Reputation public immutable REPUTATION;
    mapping(address => Agent) public agents;
    mapping(address => mapping(uint256 => Forecast)) public forecasts;

    event AgentRegistered(address indexed agent, address indexed owner, string name, string metadataURI);
    event ForecastCommitted(address indexed agent, uint256 indexed marketId, bytes32 commitHash, uint64 revealDeadline);
    event ForecastRevealed(address indexed agent, uint256 indexed marketId, uint256 probabilityYes1e18);
    event ForecastScored(address indexed agent, uint256 indexed marketId, uint256 probabilityYes1e18, bool outcomeHappened);

    constructor(MarketFactory marketFactory_, Reputation reputation_) {
        MARKET_FACTORY = marketFactory_;
        REPUTATION = reputation_;
    }

    function registerAgent(string calldata name, string calldata metadataURI) external {
        require(bytes(name).length > 2, "BAD_NAME");
        agents[msg.sender] = Agent({owner: msg.sender, name: name, metadataURI: metadataURI, active: true});
        emit AgentRegistered(msg.sender, msg.sender, name, metadataURI);
    }

    function commitForecast(uint256 marketId, bytes32 commitHash, uint64 revealDeadline) external {
        require(agents[msg.sender].active, "NOT_AGENT");
        require(MARKET_FACTORY.marketState(marketId) == MarketFactory.MarketState.OPEN, "MARKET_NOT_OPEN");
        require(commitHash != bytes32(0), "BAD_COMMIT");
        require(revealDeadline > block.timestamp, "BAD_DEADLINE");
        require(forecasts[msg.sender][marketId].commitHash == bytes32(0), "FORECAST_EXISTS");
        forecasts[msg.sender][marketId] = Forecast({
            commitHash: commitHash,
            probabilityYes1e18: 0,
            revealDeadline: revealDeadline,
            revealed: false,
            scored: false
        });
        emit ForecastCommitted(msg.sender, marketId, commitHash, revealDeadline);
    }

    function revealForecast(uint256 marketId, uint256 probabilityYes1e18, bytes32 salt) external {
        Forecast storage forecast = forecasts[msg.sender][marketId];
        require(forecast.commitHash != bytes32(0), "UNKNOWN_FORECAST");
        require(!forecast.revealed, "ALREADY_REVEALED");
        require(block.timestamp <= forecast.revealDeadline, "REVEAL_CLOSED");
        require(probabilityYes1e18 <= 1e18, "BAD_PROBABILITY");
        require(
            keccak256(abi.encode(msg.sender, marketId, probabilityYes1e18, salt)) == forecast.commitHash,
            "BAD_REVEAL"
        );
        forecast.probabilityYes1e18 = probabilityYes1e18;
        forecast.revealed = true;
        emit ForecastRevealed(msg.sender, marketId, probabilityYes1e18);
    }

    function scoreForecast(address agent, uint256 marketId) external {
        Forecast storage forecast = forecasts[agent][marketId];
        require(forecast.revealed, "NOT_REVEALED");
        require(!forecast.scored, "ALREADY_SCORED");
        MarketFactory.Market memory market = MARKET_FACTORY.getMarket(marketId);
        require(market.state == MarketFactory.MarketState.RESOLVED, "NOT_RESOLVED");

        bool outcomeHappened = market.winningOutcome == 0;
        forecast.scored = true;
        REPUTATION.updateBrierScore(agent, forecast.probabilityYes1e18, outcomeHappened);
        emit ForecastScored(agent, marketId, forecast.probabilityYes1e18, outcomeHappened);
    }
}
