// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "openzeppelin-contracts/contracts/access/AccessControl.sol";
import {LeagueFactory} from "./LeagueFactory.sol";
import {Reputation} from "./Reputation.sol";

/// @title FantasyContest
/// @notice Synthetic points-only DFS contests for hackathon gameplay.
contract FantasyContest is AccessControl {
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");
    bytes32 public constant DFS_WINNER_BADGE = keccak256("DFS_WINNER");

    struct Contest {
        string name;
        string metadataURI;
        uint256 leagueId;
        uint64 lockTime;
        uint64 resolveTime;
        bool finalized;
        uint256 entryCount;
        address winner;
        uint256 winningPoints;
    }

    struct Lineup {
        bytes32 picksHash;
        uint256 points;
        bool submitted;
        bool scored;
    }

    LeagueFactory public immutable LEAGUES;
    Reputation public immutable REPUTATION;
    uint256 public nextContestId = 1;
    mapping(uint256 => Contest) public contests;
    mapping(uint256 => mapping(address => Lineup)) public lineups;

    event ContestCreated(uint256 indexed contestId, uint256 indexed leagueId, string name, uint64 lockTime, uint64 resolveTime);
    event LineupSubmitted(uint256 indexed contestId, address indexed user, bytes32 picksHash);
    event LineupScored(uint256 indexed contestId, address indexed user, uint256 points);
    event ContestFinalized(uint256 indexed contestId, address indexed winner, uint256 points);

    constructor(LeagueFactory leagues_, Reputation reputation_) {
        LEAGUES = leagues_;
        REPUTATION = reputation_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SCORER_ROLE, msg.sender);
    }

    function createContest(string calldata name, string calldata metadataURI, uint256 leagueId, uint64 lockTime, uint64 resolveTime)
        external
        onlyRole(SCORER_ROLE)
        returns (uint256 contestId)
    {
        require(bytes(name).length > 2 && lockTime > block.timestamp && resolveTime > lockTime, "BAD_CONTEST");
        _requirePointsLeague(leagueId);
        contestId = nextContestId++;
        contests[contestId] = Contest({
            name: name,
            metadataURI: metadataURI,
            leagueId: leagueId,
            lockTime: lockTime,
            resolveTime: resolveTime,
            finalized: false,
            entryCount: 0,
            winner: address(0),
            winningPoints: 0
        });
        emit ContestCreated(contestId, leagueId, name, lockTime, resolveTime);
    }

    function submitLineup(uint256 contestId, bytes32 picksHash) external {
        Contest storage contest = contests[contestId];
        require(contest.lockTime > block.timestamp && picksHash != bytes32(0), "LOCKED");
        if (contest.leagueId > 0) require(LEAGUES.isMember(contest.leagueId, msg.sender), "NOT_LEAGUE_MEMBER");
        require(!lineups[contestId][msg.sender].submitted, "ALREADY_SUBMITTED");
        lineups[contestId][msg.sender] = Lineup({picksHash: picksHash, points: 0, submitted: true, scored: false});
        contest.entryCount += 1;
        emit LineupSubmitted(contestId, msg.sender, picksHash);
    }

    function scoreLineup(uint256 contestId, address user, uint256 points) external onlyRole(SCORER_ROLE) {
        Contest storage contest = contests[contestId];
        Lineup storage lineup = lineups[contestId][user];
        require(!contest.finalized && block.timestamp >= contest.lockTime && lineup.submitted && !lineup.scored, "NOT_SCORABLE");
        lineup.points = points;
        lineup.scored = true;
        if (points > contest.winningPoints) {
            contest.winningPoints = points;
            contest.winner = user;
        }
        emit LineupScored(contestId, user, points);
    }

    function finalize(uint256 contestId) external onlyRole(SCORER_ROLE) {
        Contest storage contest = contests[contestId];
        require(block.timestamp >= contest.resolveTime && !contest.finalized && contest.winner != address(0), "NOT_FINAL");
        contest.finalized = true;
        REPUTATION.recordOutcome(contest.winner, true, 150);
        REPUTATION.issueBadge(contest.winner, DFS_WINNER_BADGE);
        if (contest.leagueId > 0) LEAGUES.recordScore(contest.leagueId, contest.winner, 150);
        emit ContestFinalized(contestId, contest.winner, contest.winningPoints);
    }

    function _requirePointsLeague(uint256 leagueId) private view {
        if (leagueId == 0) return;
        (address creator,,, bool pointsOnly,) = LEAGUES.leagues(leagueId);
        require(creator != address(0), "UNKNOWN_LEAGUE");
        require(pointsOnly, "NOT_POINTS_ONLY");
    }
}
