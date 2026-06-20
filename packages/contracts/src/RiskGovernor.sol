// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ResponsibleLimits} from "./ResponsibleLimits.sol";

contract RiskGovernor {
    enum ProposalKind {
        ADD_LIQUIDITY,
        REMOVE_LIQUIDITY,
        PLACE_ORDER,
        CANCEL_ORDER,
        HEDGE,
        PAUSE_MARKET
    }

    struct Policy {
        uint256 maxDrawdownBps;
        uint256 maxCorrelationBps;
        uint256 maxProposalValue;
        bool requireUserApproval;
    }

    struct Proposal {
        address agent;
        address user;
        ProposalKind kind;
        uint256 marketId;
        uint256 value;
        uint256 riskScoreBps;
        uint256 correlationBps;
        bytes32 simulationHash;
        string rationaleURI;
        bool approved;
        bool executed;
        uint64 createdAt;
    }

    ResponsibleLimits public immutable RESPONSIBLE_LIMITS;
    address public owner;
    uint256 public nextProposalId = 1;
    Policy public policy;

    mapping(address => bool) public authorizedAgent;
    mapping(uint256 => Proposal) public proposals;

    event AgentAuthorized(address indexed agent, bool enabled);
    event PolicyUpdated(uint256 maxDrawdownBps, uint256 maxCorrelationBps, uint256 maxProposalValue, bool requireUserApproval);
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed agent,
        address indexed user,
        uint8 kind,
        uint256 marketId,
        uint256 value,
        uint256 riskScoreBps,
        uint256 correlationBps,
        bytes32 simulationHash
    );
    event ProposalApproved(uint256 indexed proposalId, address indexed user);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyAgent() {
        require(authorizedAgent[msg.sender], "NOT_AGENT");
        _;
    }

    constructor(ResponsibleLimits responsibleLimits_) {
        RESPONSIBLE_LIMITS = responsibleLimits_;
        owner = msg.sender;
        authorizedAgent[msg.sender] = true;
        policy = Policy({
            maxDrawdownBps: 2500,
            maxCorrelationBps: 7000,
            maxProposalValue: 5 ether,
            requireUserApproval: true
        });
        emit AgentAuthorized(msg.sender, true);
        emit PolicyUpdated(policy.maxDrawdownBps, policy.maxCorrelationBps, policy.maxProposalValue, policy.requireUserApproval);
    }

    function setAgent(address agent, bool enabled) external onlyOwner {
        require(agent != address(0), "BAD_AGENT");
        authorizedAgent[agent] = enabled;
        emit AgentAuthorized(agent, enabled);
    }

    function setPolicy(
        uint256 maxDrawdownBps,
        uint256 maxCorrelationBps,
        uint256 maxProposalValue,
        bool requireUserApproval
    ) external onlyOwner {
        require(maxDrawdownBps <= 10_000 && maxCorrelationBps <= 10_000, "BAD_BPS");
        policy = Policy({
            maxDrawdownBps: maxDrawdownBps,
            maxCorrelationBps: maxCorrelationBps,
            maxProposalValue: maxProposalValue,
            requireUserApproval: requireUserApproval
        });
        emit PolicyUpdated(maxDrawdownBps, maxCorrelationBps, maxProposalValue, requireUserApproval);
    }

    function propose(
        address user,
        ProposalKind kind,
        uint256 marketId,
        uint256 value,
        uint256 riskScoreBps,
        uint256 correlationBps,
        bytes32 simulationHash,
        string calldata rationaleURI
    ) external onlyAgent returns (uint256 proposalId) {
        require(user != address(0), "BAD_USER");
        require(riskScoreBps <= policy.maxDrawdownBps, "DRAWDOWN_LIMIT");
        require(correlationBps <= policy.maxCorrelationBps, "CORRELATION_LIMIT");
        require(policy.maxProposalValue == 0 || value <= policy.maxProposalValue, "VALUE_LIMIT");

        RESPONSIBLE_LIMITS.recordAiExecution(user, value);

        proposalId = nextProposalId++;
        proposals[proposalId] = Proposal({
            agent: msg.sender,
            user: user,
            kind: kind,
            marketId: marketId,
            value: value,
            riskScoreBps: riskScoreBps,
            correlationBps: correlationBps,
            simulationHash: simulationHash,
            rationaleURI: rationaleURI,
            approved: !policy.requireUserApproval,
            executed: false,
            createdAt: uint64(block.timestamp)
        });

        emit ProposalCreated(
            proposalId,
            msg.sender,
            user,
            uint8(kind),
            marketId,
            value,
            riskScoreBps,
            correlationBps,
            simulationHash
        );
    }

    function approve(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.user == msg.sender, "NOT_USER");
        require(!proposal.executed, "EXECUTED");
        proposal.approved = true;
        emit ProposalApproved(proposalId, msg.sender);
    }

    function markExecuted(uint256 proposalId) external {
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.agent || msg.sender == owner, "NOT_EXECUTOR");
        require(proposal.approved, "NOT_APPROVED");
        require(!proposal.executed, "EXECUTED");
        proposal.executed = true;
        emit ProposalExecuted(proposalId, msg.sender);
    }
}
