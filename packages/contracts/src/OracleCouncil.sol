// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MarketFactory} from "./MarketFactory.sol";

/// @title OracleCouncil
/// @notice Commit-reveal oracle with challenge/dispute resolution via a council multisig
/// @dev Challenged results are resolved by the council address, with bond slashing for the losing party.
contract OracleCouncil {
    enum ResultState {
        NONE,
        COMMITTED,
        REVEALED,
        CHALLENGED,
        FINALIZED
    }

    struct Result {
        address submitter;
        bytes32 commitHash;
        uint256 outcomeIndex;
        uint64 revealTime;
        uint64 disputeDeadline;
        ResultState state;
        // Challenge fields
        address challenger;
        uint256 challengerProposedOutcome;
        uint256 submitterBond;
        uint256 challengerBond;
    }

    // --- Custom Errors ---
    error ResultExists();
    error NotSubmitter();
    error BadState();
    error BadReveal();
    error DisputeClosed();
    error NoBond();
    error DisputeOpen();
    error NotCouncil();
    error BadOutcome();
    error TransferFailed();

    MarketFactory public immutable MARKET_FACTORY;
    address public council;
    uint64 public constant DISPUTE_WINDOW = 30 minutes;
    uint256 public minChallengeBond = 0.1 ether;
    mapping(uint256 => Result) public results;

    event ResultCommitted(uint256 indexed marketId, address indexed submitter, bytes32 commitHash);
    event ResultRevealed(uint256 indexed marketId, uint256 indexed outcomeIndex, uint64 disputeDeadline);
    event ResultChallenged(uint256 indexed marketId, address indexed challenger, uint256 proposedOutcome, uint256 bond);
    event ResultFinalized(uint256 indexed marketId, uint256 indexed outcomeIndex);
    event ChallengeResolved(uint256 indexed marketId, uint256 finalOutcome, address winner, uint256 totalBond);
    event CouncilUpdated(address indexed oldCouncil, address indexed newCouncil);
    event ChallengeBondUpdated(uint256 minChallengeBond);

    modifier onlyCouncil() {
        if (msg.sender != council) revert NotCouncil();
        _;
    }

    /// @param marketFactory_ The MarketFactory contract
    /// @param council_ The admin/multisig address that can resolve disputes
    constructor(MarketFactory marketFactory_, address council_) {
        MARKET_FACTORY = marketFactory_;
        council = council_ == address(0) ? msg.sender : council_;
    }

    /// @notice Update the council address (only callable by current council)
    /// @param newCouncil The new council address
    function setCouncil(address newCouncil) external onlyCouncil {
        if (newCouncil == address(0)) revert BadOutcome();
        emit CouncilUpdated(council, newCouncil);
        council = newCouncil;
    }

    function setMinChallengeBond(uint256 amount) external onlyCouncil {
        minChallengeBond = amount;
        emit ChallengeBondUpdated(amount);
    }

    /// @notice Submit a commit hash for a market result
    /// @param marketId The market to submit a result for
    /// @param commitHash The keccak256 hash of (marketId, outcomeIndex, salt)
    function commitResult(uint256 marketId, bytes32 commitHash) external payable {
        if (results[marketId].state != ResultState.NONE) revert ResultExists();
        if (msg.value < minChallengeBond) revert NoBond();
        results[marketId] = Result({
            submitter: msg.sender,
            commitHash: commitHash,
            outcomeIndex: type(uint256).max,
            revealTime: 0,
            disputeDeadline: 0,
            state: ResultState.COMMITTED,
            challenger: address(0),
            challengerProposedOutcome: 0,
            submitterBond: msg.value,
            challengerBond: 0
        });
        emit ResultCommitted(marketId, msg.sender, commitHash);
    }

    /// @notice Reveal a previously committed result
    /// @param marketId The market to reveal the result for
    /// @param outcomeIndex The actual outcome index
    /// @param salt The salt used in the commit hash
    function revealResult(uint256 marketId, uint256 outcomeIndex, bytes32 salt) external {
        Result storage result = results[marketId];
        MarketFactory.Market memory market = MARKET_FACTORY.getMarket(marketId);
        if (result.submitter != msg.sender) revert NotSubmitter();
        if (result.state != ResultState.COMMITTED) revert BadState();
        if (outcomeIndex >= market.outcomes.length) revert BadOutcome();
        if (keccak256(abi.encode(marketId, outcomeIndex, salt)) != result.commitHash) revert BadReveal();

        result.outcomeIndex = outcomeIndex;
        result.revealTime = uint64(block.timestamp);
        result.disputeDeadline = uint64(block.timestamp + DISPUTE_WINDOW);
        result.state = ResultState.REVEALED;
        emit ResultRevealed(marketId, outcomeIndex, result.disputeDeadline);
    }

    /// @notice Challenge a revealed result by posting a bond
    /// @param marketId The market whose result is being challenged
    /// @param proposedOutcome The challenger's proposed correct outcome
    function challengeResult(uint256 marketId, uint256 proposedOutcome) external payable {
        Result storage result = results[marketId];
        MarketFactory.Market memory market = MARKET_FACTORY.getMarket(marketId);
        if (result.state != ResultState.REVEALED) revert BadState();
        if (block.timestamp > result.disputeDeadline) revert DisputeClosed();
        if (msg.value < minChallengeBond) revert NoBond();
        if (proposedOutcome >= market.outcomes.length || proposedOutcome == result.outcomeIndex) revert BadOutcome();

        result.state = ResultState.CHALLENGED;
        result.challenger = msg.sender;
        result.challengerProposedOutcome = proposedOutcome;
        result.challengerBond = msg.value;
        MARKET_FACTORY.markDisputed(marketId);
        emit ResultChallenged(marketId, msg.sender, proposedOutcome, msg.value);
    }

    /// @notice Council resolves a challenged result by picking the correct outcome
    /// @dev The winning party gets both bonds. Loser is slashed.
    /// @param marketId The market to resolve
    /// @param finalOutcome The council-determined correct outcome
    function resolveChallenge(uint256 marketId, uint256 finalOutcome) external onlyCouncil {
        Result storage result = results[marketId];
        MarketFactory.Market memory market = MARKET_FACTORY.getMarket(marketId);
        if (result.state != ResultState.CHALLENGED) revert BadState();
        if (finalOutcome >= market.outcomes.length) revert BadOutcome();

        result.outcomeIndex = finalOutcome;
        result.state = ResultState.FINALIZED;

        uint256 totalBond = result.submitterBond + result.challengerBond;
        address winner;

        // Determine winner: if finalOutcome matches challenger's proposal, challenger wins
        if (finalOutcome == result.challengerProposedOutcome) {
            winner = result.challenger;
        } else {
            winner = result.submitter;
        }
        result.submitterBond = 0;
        result.challengerBond = 0;

        // Resolve the market
        MARKET_FACTORY.resolveMarket(marketId, finalOutcome);

        // Pay the winner the total bond
        if (totalBond > 0) {
            (bool success,) = payable(winner).call{value: totalBond}("");
            if (!success) revert TransferFailed();
        }

        emit ChallengeResolved(marketId, finalOutcome, winner, totalBond);
        emit ResultFinalized(marketId, finalOutcome);
    }

    /// @notice Finalize an unchallenged result after the dispute window closes
    /// @param marketId The market to finalize
    function finalizeResult(uint256 marketId) external {
        Result storage result = results[marketId];
        if (result.state != ResultState.REVEALED) revert BadState();
        if (block.timestamp <= result.disputeDeadline) revert DisputeOpen();

        result.state = ResultState.FINALIZED;
        MARKET_FACTORY.resolveMarket(marketId, result.outcomeIndex);

        // Refund submitter bond if any
        if (result.submitterBond > 0) {
            uint256 bond = result.submitterBond;
            result.submitterBond = 0;
            (bool success,) = payable(result.submitter).call{value: bond}("");
            if (!success) revert TransferFailed();
        }

        emit ResultFinalized(marketId, result.outcomeIndex);
    }
}
