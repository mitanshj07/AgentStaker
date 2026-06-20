// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC721Receiver} from "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import {BetSlipNFT} from "./BetSlipNFT.sol";
import {AgentNFT} from "./AgentNFT.sol";
import {LeagueFactory} from "./LeagueFactory.sol";
import {Reputation} from "./Reputation.sol";
import {CreatorVault} from "./CreatorVault.sol";
import {ResponsibleLimits} from "./ResponsibleLimits.sol";

/// @title BattleArena
/// @notice Handles NFT-based Agent battles and BetSlip matches.
contract BattleArena is IERC721Receiver {
    enum Move { ATTACK, DEFEND, TRICK }
    enum State { OPEN, JOINED, RESOLVED, CANCELLED }

    struct Battle {
        address challenger;
        address defender;
        uint256 challengerCard;
        uint256 defenderCard;
        uint256 leagueId;
        bytes32 challengerCommit;
        bytes32 defenderCommit;
        uint64 createdAt;
        bool challengerRevealed;
        bool defenderRevealed;
        State state;
        address winner;
    }

    bytes32 public constant BATTLE_WINNER_BADGE = keccak256("BATTLE_WINNER");
    BetSlipNFT public immutable BET_SLIP;
    AgentNFT public immutable AGENT_NFT;
    LeagueFactory public immutable LEAGUES;
    Reputation public immutable REPUTATION;
    CreatorVault public immutable CREATOR_VAULT;
    ResponsibleLimits public immutable RESPONSIBLE_LIMITS;
    
    address public operator;
    
    // Legacy BetSlip Battle state
    uint256 public nextBattleId = 1;
    uint256 public joinWindow = 1 days;
    uint256 public revealWindow = 1 days;
    mapping(uint256 => Battle) public battles;
    mapping(uint256 => uint64) public joinedAt;
    mapping(uint256 => Move[3]) private _challengerMoves;
    mapping(uint256 => Move[3]) private _defenderMoves;

    // --- Events ---
    event BattleCreated(uint256 indexed battleId, address indexed challenger, uint256 indexed challengerCard, uint256 leagueId);
    event BattleJoined(uint256 indexed battleId, address indexed defender, uint256 indexed defenderCard);
    event BattleRevealed(uint256 indexed battleId, address indexed player);
    event BattleResolved(uint256 indexed battleId, address indexed winner, uint256 challengerScore, uint256 defenderScore);
    event BattleCancelled(uint256 indexed battleId);

    event AgentDuelCreated(uint256 indexed duelId, uint256 indexed marketId, uint256 agentA, uint256 agentB);
    event AgentDuelStaked(uint256 indexed duelId, address indexed user, bool supportA, uint256 amount);
    event DuelSettled(uint256 indexed duelId, uint256 winnerAgent, uint256 totalPool, uint256 fee);
    event DuelRewardClaimed(uint256 indexed duelId, address indexed user, uint256 amount);

    event StrategyClashCreated(uint256 indexed clashId, uint256 agentA, uint256 agentB);
    event StrategyClashStaked(uint256 indexed clashId, address indexed user, bool supportA, uint256 amount, bytes32 commitHash);
    event StrategyClashRevealed(uint256 indexed clashId, address indexed user, uint8 modifierChoice);
    event StrategyClashSettled(uint256 indexed clashId, uint256 winnerAgent, uint256 totalPool, uint256 fee);

    event CardBattleCreated(uint256 indexed battleId, uint256 agentA, uint256 agentB);
    event CardBattleStaked(uint256 indexed battleId, address indexed user, bool supportA, uint256 amount);
    event CardBattleSettled(uint256 indexed battleId, uint256 winnerAgent, uint256 totalPool, uint256 fee);

    constructor(
        BetSlipNFT betSlip_, 
        AgentNFT agentNFT_,
        LeagueFactory leagues_, 
        Reputation reputation_,
        CreatorVault creatorVault_,
        ResponsibleLimits limits_,
        address operator_
    ) {
        BET_SLIP = betSlip_;
        AGENT_NFT = agentNFT_;
        LEAGUES = leagues_;
        REPUTATION = reputation_;
        CREATOR_VAULT = creatorVault_;
        RESPONSIBLE_LIMITS = limits_;
        operator = operator_ == address(0) ? msg.sender : operator_;
    }

    function setOperator(address operator_) external {
        require(msg.sender == operator, "NOT_OPERATOR");
        operator = operator_;
    }

    // ==========================================
    // LEGACY BETSLIP BATTLES (UNMODIFIED LOGIC)
    // ==========================================

    function createBattle(uint256 cardId, uint256 leagueId, bytes32 commitment) external returns (uint256 battleId) {
        require(commitment != bytes32(0), "BAD_COMMIT");
        require(BET_SLIP.ownerOf(cardId) == msg.sender, "NOT_CARD_OWNER");
        _requireLeagueMember(leagueId, msg.sender);
        BET_SLIP.setBattleLock(cardId, true);
        BET_SLIP.safeTransferFrom(msg.sender, address(this), cardId);
        battleId = nextBattleId++;
        battles[battleId] = Battle({
            challenger: msg.sender,
            defender: address(0),
            challengerCard: cardId,
            defenderCard: 0,
            leagueId: leagueId,
            challengerCommit: commitment,
            defenderCommit: bytes32(0),
            createdAt: uint64(block.timestamp),
            challengerRevealed: false,
            defenderRevealed: false,
            state: State.OPEN,
            winner: address(0)
        });
        emit BattleCreated(battleId, msg.sender, cardId, leagueId);
    }

    function joinBattle(uint256 battleId, uint256 cardId, bytes32 commitment) external {
        Battle storage battle = battles[battleId];
        require(battle.state == State.OPEN && battle.challenger != address(0), "NOT_OPEN");
        require(msg.sender != battle.challenger && commitment != bytes32(0), "BAD_JOIN");
        require(BET_SLIP.ownerOf(cardId) == msg.sender, "NOT_CARD_OWNER");
        _requireLeagueMember(battle.leagueId, msg.sender);
        BET_SLIP.setBattleLock(cardId, true);
        BET_SLIP.safeTransferFrom(msg.sender, address(this), cardId);
        battle.defender = msg.sender;
        battle.defenderCard = cardId;
        battle.defenderCommit = commitment;
        battle.state = State.JOINED;
        joinedAt[battleId] = uint64(block.timestamp);
        emit BattleJoined(battleId, msg.sender, cardId);
    }

    function reveal(uint256 battleId, Move[3] calldata moves, bytes32 salt) external {
        Battle storage battle = battles[battleId];
        require(battle.state == State.JOINED, "NOT_JOINED");
        bytes32 commitment = keccak256(abi.encode(msg.sender, moves, salt));
        if (msg.sender == battle.challenger) {
            require(!battle.challengerRevealed && commitment == battle.challengerCommit, "BAD_REVEAL");
            _challengerMoves[battleId] = moves;
            battle.challengerRevealed = true;
        } else {
            require(msg.sender == battle.defender && !battle.defenderRevealed && commitment == battle.defenderCommit, "BAD_REVEAL");
            _defenderMoves[battleId] = moves;
            battle.defenderRevealed = true;
        }
        emit BattleRevealed(battleId, msg.sender);
        if (battle.challengerRevealed && battle.defenderRevealed) _resolve(battleId);
    }

    function cancelUnmatched(uint256 battleId) external {
        Battle storage battle = battles[battleId];
        require(battle.state == State.OPEN && block.timestamp > battle.createdAt + joinWindow, "NOT_EXPIRED");
        require(msg.sender == battle.challenger, "NOT_CHALLENGER");
        battle.state = State.CANCELLED;
        _returnCard(battle.challengerCard, battle.challenger);
        emit BattleCancelled(battleId);
    }

    function resolveExpiredJoined(uint256 battleId) external {
        Battle storage battle = battles[battleId];
        require(battle.state == State.JOINED && block.timestamp > joinedAt[battleId] + revealWindow, "NOT_EXPIRED");
        if (!battle.challengerRevealed && !battle.defenderRevealed) {
            battle.state = State.CANCELLED;
            _returnCards(battle);
            emit BattleCancelled(battleId);
            return;
        }
        require(battle.challengerRevealed != battle.defenderRevealed, "ALREADY_REVEALED");
        address winner = battle.challengerRevealed ? battle.challenger : battle.defender;
        _awardWinner(battle, winner);
        emit BattleResolved(battleId, winner, battle.challengerRevealed ? 1 : 0, battle.defenderRevealed ? 1 : 0);
    }

    function getMoves(uint256 battleId) external view returns (Move[3] memory challengerMoves, Move[3] memory defenderMoves) {
        Battle memory battle = battles[battleId];
        require(battle.state == State.RESOLVED, "NOT_RESOLVED");
        return (_challengerMoves[battleId], _defenderMoves[battleId]);
    }

    function _resolve(uint256 battleId) internal {
        Battle storage battle = battles[battleId];
        uint256 challengerScore;
        uint256 defenderScore;
        for (uint256 i = 0; i < 3; i++) {
            Move challengerMove = _challengerMoves[battleId][i];
            Move defenderMove = _defenderMoves[battleId][i];
            if (challengerMove == defenderMove) continue;
            if (_beats(challengerMove, defenderMove)) challengerScore += 1;
            else defenderScore += 1;
        }
        if (challengerScore == defenderScore) {
            (uint256 challengerPower, uint256 challengerLuck) = BET_SLIP.battleStats(battle.challengerCard);
            (uint256 defenderPower, uint256 defenderLuck) = BET_SLIP.battleStats(battle.defenderCard);
            challengerScore += challengerPower + challengerLuck;
            defenderScore += defenderPower + defenderLuck;
        }
        address winner = challengerScore >= defenderScore ? battle.challenger : battle.defender;
        _awardWinner(battle, winner);
        emit BattleResolved(battleId, winner, challengerScore, defenderScore);
    }

    function _awardWinner(Battle storage battle, address winner) private {
        battle.winner = winner;
        battle.state = State.RESOLVED;
        _returnCards(battle);
        REPUTATION.recordOutcome(winner, true, 100);
        REPUTATION.issueBadge(winner, BATTLE_WINNER_BADGE);
        if (battle.leagueId > 0) LEAGUES.recordScore(battle.leagueId, winner, 100);
    }

    function _returnCards(Battle storage battle) private {
        _returnCard(battle.challengerCard, battle.challenger);
        _returnCard(battle.defenderCard, battle.defender);
    }

    function _returnCard(uint256 cardId, address recipient) private {
        BET_SLIP.setBattleLock(cardId, false);
        BET_SLIP.safeTransferFrom(address(this), recipient, cardId);
    }

    function _requireLeagueMember(uint256 leagueId, address member) private view {
        if (leagueId == 0) return;
        (address creator,,,,) = LEAGUES.leagues(leagueId);
        require(creator != address(0), "UNKNOWN_LEAGUE");
        require(LEAGUES.isMember(leagueId, member), "NOT_LEAGUE_MEMBER");
    }

    function _beats(Move left, Move right) private pure returns (bool) {
        return (left == Move.ATTACK && right == Move.TRICK)
            || (left == Move.TRICK && right == Move.DEFEND)
            || (left == Move.DEFEND && right == Move.ATTACK);
    }

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // ==========================================
    // AGENT DUELS (GAME 1)
    // ==========================================

    struct AgentDuel {
        uint256 marketId;
        uint256 agentA;
        uint256 agentB;
        uint256 poolA;
        uint256 poolB;
        State state;
        uint256 winnerAgent;
        uint64 createdAt;
    }

    uint256 public nextDuelId = 1;
    mapping(uint256 => AgentDuel) public agentDuels;
    mapping(uint256 => mapping(address => uint256)) public duelStakeA;
    mapping(uint256 => mapping(address => uint256)) public duelStakeB;

    function createAgentDuel(uint256 marketId, uint256 agentA, uint256 agentB) external returns (uint256 duelId) {
        require(agentA > 0 && agentB > 0 && agentA != agentB, "BAD_AGENTS");
        duelId = nextDuelId++;
        agentDuels[duelId] = AgentDuel({
            marketId: marketId,
            agentA: agentA,
            agentB: agentB,
            poolA: 0,
            poolB: 0,
            state: State.OPEN,
            winnerAgent: 0,
            createdAt: uint64(block.timestamp)
        });
        emit AgentDuelCreated(duelId, marketId, agentA, agentB);
    }

    function stakeOnDuel(uint256 duelId, bool supportA) external payable {
        AgentDuel storage duel = agentDuels[duelId];
        require(duel.state == State.OPEN, "NOT_OPEN");
        require(msg.value > 0, "ZERO_STAKE");
        
        RESPONSIBLE_LIMITS.recordSpend(msg.sender, msg.value);
        RESPONSIBLE_LIMITS.recordExposure(msg.sender, msg.value);

        if (supportA) {
            duel.poolA += msg.value;
            duelStakeA[duelId][msg.sender] += msg.value;
        } else {
            duel.poolB += msg.value;
            duelStakeB[duelId][msg.sender] += msg.value;
        }
        
        emit AgentDuelStaked(duelId, msg.sender, supportA, msg.value);
    }

    function resolveAgentDuel(uint256 duelId, uint256 winnerAgent) external {
        require(msg.sender == operator, "NOT_OPERATOR");
        AgentDuel storage duel = agentDuels[duelId];
        require(duel.state == State.OPEN, "NOT_OPEN");
        require(winnerAgent == duel.agentA || winnerAgent == duel.agentB || winnerAgent == 0, "BAD_WINNER");
        
        duel.state = State.RESOLVED;
        duel.winnerAgent = winnerAgent;

        if (winnerAgent != 0) {
            AGENT_NFT.recordBattleResult(duel.agentA, winnerAgent == duel.agentA);
            AGENT_NFT.recordBattleResult(duel.agentB, winnerAgent == duel.agentB);
        }

        uint256 fee = 0;
        uint256 totalPool = duel.poolA + duel.poolB;
        if (totalPool > 0) {
            fee = (totalPool * 500) / 10_000; // 5% fee
            CREATOR_VAULT.recordFee{value: fee}(address(this), address(0));
        }

        emit DuelSettled(duelId, winnerAgent, totalPool, fee);
    }

    function claimDuelReward(uint256 duelId) external {
        AgentDuel storage duel = agentDuels[duelId];
        require(duel.state == State.RESOLVED, "NOT_RESOLVED");
        
        uint256 userStake;
        uint256 userPool;

        if (duel.winnerAgent == duel.agentA) {
            userStake = duelStakeA[duelId][msg.sender];
            userPool = duel.poolA;
            duelStakeA[duelId][msg.sender] = 0;
        } else if (duel.winnerAgent == duel.agentB) {
            userStake = duelStakeB[duelId][msg.sender];
            userPool = duel.poolB;
            duelStakeB[duelId][msg.sender] = 0;
        } else {
            uint256 stakeA = duelStakeA[duelId][msg.sender];
            uint256 stakeB = duelStakeB[duelId][msg.sender];
            userStake = stakeA + stakeB;
            duelStakeA[duelId][msg.sender] = 0;
            duelStakeB[duelId][msg.sender] = 0;
            if (userStake > 0) {
                RESPONSIBLE_LIMITS.releaseExposure(msg.sender, userStake);
                (bool refundSuccess, ) = payable(msg.sender).call{value: userStake}("");
                require(refundSuccess, "TRANSFER_FAILED");
                emit DuelRewardClaimed(duelId, msg.sender, userStake);
            }
            return;
        }

        require(userStake > 0, "NO_STAKE");
        RESPONSIBLE_LIMITS.releaseExposure(msg.sender, userStake);

        uint256 fee = ((duel.poolA + duel.poolB) * 500) / 10_000;
        uint256 totalRewardPool = duel.poolA + duel.poolB - fee;
        uint256 payout = (userStake * totalRewardPool) / userPool;

        (bool success, ) = payable(msg.sender).call{value: payout}("");
        require(success, "TRANSFER_FAILED");
        emit DuelRewardClaimed(duelId, msg.sender, payout);
    }

    // ==========================================
    // STRATEGY CLASH (GAME 2)
    // ==========================================

    enum TacticalModifier { NONE, PRESS_ADVANTAGE, HEDGE }

    struct StrategyClash {
        uint256 agentA;
        uint256 agentB;
        uint256 poolA;
        uint256 poolB;
        State state;
        uint256 winnerAgent;
    }

    uint256 public nextClashId = 1;
    mapping(uint256 => StrategyClash) public strategyClashes;
    mapping(uint256 => mapping(address => uint256)) public clashStakeA;
    mapping(uint256 => mapping(address => uint256)) public clashStakeB;

    function createStrategyClash(uint256 agentA, uint256 agentB) external returns (uint256 clashId) {
        require(agentA > 0 && agentB > 0 && agentA != agentB, "BAD_AGENTS");
        clashId = nextClashId++;
        strategyClashes[clashId] = StrategyClash({
            agentA: agentA,
            agentB: agentB,
            poolA: 0,
            poolB: 0,
            state: State.OPEN,
            winnerAgent: 0
        });
        emit StrategyClashCreated(clashId, agentA, agentB);
    }

    function stakeOnClash(uint256 clashId, bool supportA, bytes32 commitHash) external payable {
        StrategyClash storage clash = strategyClashes[clashId];
        require(clash.state == State.OPEN, "NOT_OPEN");
        require(msg.value > 0, "ZERO_STAKE");
        
        RESPONSIBLE_LIMITS.recordSpend(msg.sender, msg.value);
        RESPONSIBLE_LIMITS.recordExposure(msg.sender, msg.value);

        if (supportA) {
            clash.poolA += msg.value;
            clashStakeA[clashId][msg.sender] += msg.value;
        } else {
            clash.poolB += msg.value;
            clashStakeB[clashId][msg.sender] += msg.value;
        }
        
        emit StrategyClashStaked(clashId, msg.sender, supportA, msg.value, commitHash);
    }

    function revealClashModifier(uint256 clashId, uint8 modifierChoice, bytes32 salt) external {
        // Modifier reveals are verified by the matcher off-chain during resolution
        // We emit it for the indexer
        bytes32 expected = keccak256(abi.encode(modifierChoice, salt));
        emit StrategyClashRevealed(clashId, msg.sender, modifierChoice);
    }

    function resolveStrategyClash(uint256 clashId, uint256 winnerAgent) external {
        require(msg.sender == operator, "NOT_OPERATOR");
        StrategyClash storage clash = strategyClashes[clashId];
        require(clash.state == State.OPEN, "NOT_OPEN");
        
        clash.state = State.RESOLVED;
        clash.winnerAgent = winnerAgent;

        if (winnerAgent != 0) {
            AGENT_NFT.recordBattleResult(clash.agentA, winnerAgent == clash.agentA);
            AGENT_NFT.recordBattleResult(clash.agentB, winnerAgent == clash.agentB);
        }

        uint256 fee = 0;
        uint256 totalPool = clash.poolA + clash.poolB;
        if (totalPool > 0) {
            fee = (totalPool * 500) / 10_000;
            CREATOR_VAULT.recordFee{value: fee}(address(this), address(0));
        }

        emit StrategyClashSettled(clashId, winnerAgent, totalPool, fee);
    }

    function claimClashReward(uint256 clashId) external {
        StrategyClash storage clash = strategyClashes[clashId];
        require(clash.state == State.RESOLVED, "NOT_RESOLVED");
        
        uint256 userStake;
        uint256 userPool;

        if (clash.winnerAgent == clash.agentA) {
            userStake = clashStakeA[clashId][msg.sender];
            userPool = clash.poolA;
            clashStakeA[clashId][msg.sender] = 0;
        } else if (clash.winnerAgent == clash.agentB) {
            userStake = clashStakeB[clashId][msg.sender];
            userPool = clash.poolB;
            clashStakeB[clashId][msg.sender] = 0;
        } else {
            uint256 stakeA = clashStakeA[clashId][msg.sender];
            uint256 stakeB = clashStakeB[clashId][msg.sender];
            userStake = stakeA + stakeB;
            clashStakeA[clashId][msg.sender] = 0;
            clashStakeB[clashId][msg.sender] = 0;
            if (userStake > 0) {
                RESPONSIBLE_LIMITS.releaseExposure(msg.sender, userStake);
                payable(msg.sender).transfer(userStake);
            }
            return;
        }

        require(userStake > 0, "NO_STAKE");
        RESPONSIBLE_LIMITS.releaseExposure(msg.sender, userStake);

        uint256 fee = ((clash.poolA + clash.poolB) * 500) / 10_000;
        uint256 totalRewardPool = clash.poolA + clash.poolB - fee;
        uint256 payout = (userStake * totalRewardPool) / userPool;

        payable(msg.sender).transfer(payout);
    }

    // ==========================================
    // CARD BATTLE (GAME 3)
    // ==========================================

    struct CardBattleState {
        uint256 agentA;
        uint256 agentB;
        uint256 poolA;
        uint256 poolB;
        State state;
        uint256 winnerAgent;
    }

    uint256 public nextCardBattleId = 1;
    mapping(uint256 => CardBattleState) public cardBattles;
    mapping(uint256 => mapping(address => uint256)) public cardBattleStakeA;
    mapping(uint256 => mapping(address => uint256)) public cardBattleStakeB;

    function createCardBattle(uint256 agentA, uint256 agentB) external returns (uint256 battleId) {
        require(agentA > 0 && agentB > 0 && agentA != agentB, "BAD_AGENTS");
        battleId = nextCardBattleId++;
        cardBattles[battleId] = CardBattleState({
            agentA: agentA,
            agentB: agentB,
            poolA: 0,
            poolB: 0,
            state: State.OPEN,
            winnerAgent: 0
        });
        emit CardBattleCreated(battleId, agentA, agentB);
    }

    function stakeOnCardBattle(uint256 battleId, bool supportA) external payable {
        CardBattleState storage battle = cardBattles[battleId];
        require(battle.state == State.OPEN, "NOT_OPEN");
        require(msg.value > 0, "ZERO_STAKE");
        
        RESPONSIBLE_LIMITS.recordSpend(msg.sender, msg.value);
        RESPONSIBLE_LIMITS.recordExposure(msg.sender, msg.value);

        if (supportA) {
            battle.poolA += msg.value;
            cardBattleStakeA[battleId][msg.sender] += msg.value;
        } else {
            battle.poolB += msg.value;
            cardBattleStakeB[battleId][msg.sender] += msg.value;
        }
        
        emit CardBattleStaked(battleId, msg.sender, supportA, msg.value);
    }

    function resolveCardBattle(uint256 battleId, uint256 winnerAgent) external {
        require(msg.sender == operator, "NOT_OPERATOR");
        CardBattleState storage battle = cardBattles[battleId];
        require(battle.state == State.OPEN, "NOT_OPEN");
        
        battle.state = State.RESOLVED;
        battle.winnerAgent = winnerAgent;

        if (winnerAgent != 0) {
            AGENT_NFT.recordBattleResult(battle.agentA, winnerAgent == battle.agentA);
            AGENT_NFT.recordBattleResult(battle.agentB, winnerAgent == battle.agentB);
        }

        uint256 fee = 0;
        uint256 totalPool = battle.poolA + battle.poolB;
        if (totalPool > 0) {
            fee = (totalPool * 500) / 10_000;
            CREATOR_VAULT.recordFee{value: fee}(address(this), address(0));
        }

        emit CardBattleSettled(battleId, winnerAgent, totalPool, fee);
    }

    function claimCardBattleReward(uint256 battleId) external {
        CardBattleState storage battle = cardBattles[battleId];
        require(battle.state == State.RESOLVED, "NOT_RESOLVED");
        
        uint256 userStake;
        uint256 userPool;

        if (battle.winnerAgent == battle.agentA) {
            userStake = cardBattleStakeA[battleId][msg.sender];
            userPool = battle.poolA;
            cardBattleStakeA[battleId][msg.sender] = 0;
        } else if (battle.winnerAgent == battle.agentB) {
            userStake = cardBattleStakeB[battleId][msg.sender];
            userPool = battle.poolB;
            cardBattleStakeB[battleId][msg.sender] = 0;
        } else {
            uint256 stakeA = cardBattleStakeA[battleId][msg.sender];
            uint256 stakeB = cardBattleStakeB[battleId][msg.sender];
            userStake = stakeA + stakeB;
            cardBattleStakeA[battleId][msg.sender] = 0;
            cardBattleStakeB[battleId][msg.sender] = 0;
            if (userStake > 0) {
                RESPONSIBLE_LIMITS.releaseExposure(msg.sender, userStake);
                payable(msg.sender).transfer(userStake);
            }
            return;
        }

        require(userStake > 0, "NO_STAKE");
        RESPONSIBLE_LIMITS.releaseExposure(msg.sender, userStake);

        uint256 fee = ((battle.poolA + battle.poolB) * 500) / 10_000;
        uint256 totalRewardPool = battle.poolA + battle.poolB - fee;
        uint256 payout = (userStake * totalRewardPool) / userPool;

        payable(msg.sender).transfer(payout);
    }
}
