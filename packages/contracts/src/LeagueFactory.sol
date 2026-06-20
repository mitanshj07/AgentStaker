// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LeagueFactory {
    address public owner;
    mapping(address => bool) public authorizedScorer;

    struct League {
        address creator;
        string name;
        string metadataURI;
        bool pointsOnly;
        uint256 memberCount;
    }

    uint256 public nextLeagueId = 1;
    mapping(uint256 => League) public leagues;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => mapping(address => uint256)) public points;

    event LeagueCreated(uint256 indexed leagueId, address indexed creator, string name, bool pointsOnly);
    event LeagueJoined(uint256 indexed leagueId, address indexed member);
    event PointsRecorded(uint256 indexed leagueId, address indexed member, uint256 points);
    event ScorerSet(address indexed scorer, bool enabled);

    constructor() {
        owner = msg.sender;
    }

    function setScorer(address scorer, bool enabled) external {
        require(msg.sender == owner, "NOT_OWNER");
        require(scorer != address(0), "BAD_SCORER");
        authorizedScorer[scorer] = enabled;
        emit ScorerSet(scorer, enabled);
    }

    function createLeague(string calldata name, string calldata metadataURI, bool pointsOnly) external returns (uint256 leagueId) {
        require(bytes(name).length > 2, "BAD_NAME");

        leagueId = nextLeagueId++;
        leagues[leagueId] = League({
            creator: msg.sender,
            name: name,
            metadataURI: metadataURI,
            pointsOnly: pointsOnly,
            memberCount: 1
        });
        isMember[leagueId][msg.sender] = true;

        emit LeagueCreated(leagueId, msg.sender, name, pointsOnly);
        emit LeagueJoined(leagueId, msg.sender);
    }

    function joinLeague(uint256 leagueId) external {
        League storage league = leagues[leagueId];
        require(league.creator != address(0), "UNKNOWN_LEAGUE");
        require(!isMember[leagueId][msg.sender], "ALREADY_MEMBER");

        isMember[leagueId][msg.sender] = true;
        league.memberCount += 1;
        emit LeagueJoined(leagueId, msg.sender);
    }

    function recordScore(uint256 leagueId, address member, uint256 earnedPoints) external {
        League memory league = leagues[leagueId];
        require(msg.sender == league.creator || authorizedScorer[msg.sender], "NOT_SCORER");
        require(isMember[leagueId][member], "NOT_MEMBER");

        points[leagueId][member] += earnedPoints;
        emit PointsRecorded(leagueId, member, points[leagueId][member]);
    }
}
