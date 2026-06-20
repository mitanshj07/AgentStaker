// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Reputation {
    struct Profile {
        uint256 wins;
        uint256 losses;
        uint256 xp;
        uint256 forecasts;
        uint256 brierScoreSum1e18;
    }

    address public owner;
    mapping(address => bool) public authorizedReporter;
    mapping(address => Profile) public profiles;
    mapping(address => mapping(bytes32 => bool)) public badges;

    event OutcomeRecorded(address indexed user, bool won, uint256 xp);
    event BrierScoreUpdated(address indexed agent, uint256 score1e18, uint256 forecastCount);
    event BadgeIssued(address indexed user, bytes32 indexed badge);
    event ReporterSet(address indexed reporter, bool enabled);

    modifier onlyOwner() {
        require(msg.sender == owner, "NOT_OWNER");
        _;
    }

    modifier onlyReporter() {
        require(authorizedReporter[msg.sender], "NOT_REPORTER");
        _;
    }

    constructor(address operator_) {
        owner = msg.sender;
        authorizedReporter[operator_ == address(0) ? msg.sender : operator_] = true;
    }

    function setReporter(address reporter, bool enabled) external onlyOwner {
        require(reporter != address(0), "BAD_REPORTER");
        authorizedReporter[reporter] = enabled;
        emit ReporterSet(reporter, enabled);
    }

    function recordOutcome(address user, bool won, uint256 xp) external onlyReporter {
        Profile storage profile = profiles[user];
        if (won) profile.wins += 1;
        else profile.losses += 1;
        profile.xp += xp;
        emit OutcomeRecorded(user, won, xp);
    }

    function updateBrierScore(address agent, uint256 probability1e18, bool outcomeHappened) external onlyReporter {
        require(probability1e18 <= 1e18, "BAD_PROBABILITY");
        uint256 target = outcomeHappened ? 1e18 : 0;
        uint256 diff = probability1e18 > target ? probability1e18 - target : target - probability1e18;
        uint256 score = (diff * diff) / 1e18;

        Profile storage profile = profiles[agent];
        profile.forecasts += 1;
        profile.brierScoreSum1e18 += score;
        emit BrierScoreUpdated(agent, score, profile.forecasts);
    }

    function issueBadge(address user, bytes32 badge) external onlyReporter {
        badges[user][badge] = true;
        emit BadgeIssued(user, badge);
    }

    function averageBrierScore(address agent) external view returns (uint256) {
        Profile memory profile = profiles[agent];
        if (profile.forecasts == 0) return 0;
        return profile.brierScoreSum1e18 / profile.forecasts;
    }
}
