import { ponder } from 'ponder:registry'
import { agentDuels, duelStakes, battleResults, betSlips, cancellations, fantasyEntries, forecasts, markets, oracleCases, orders, parlays, protocolEvents, riskProposals, signals, socialMarkets, trades, agentNFTs, strategyClashes, strategyClashStakes, cardBattles, cardBattleStakes, copyTradingSessions } from 'ponder:schema'

ponder.on('MarketFactory:MarketCreated', async ({ event, context }) => {
  await context.db.insert(markets).values({
    id: event.args.marketId,
    creator: event.args.creator,
    question: event.args.question,
    category: event.args.category,
    state: 'OPEN',
    volume: 0n,
    liquidity: 0n,
    resolvedOutcome: null,
    updatedAt: Number(event.block.timestamp),
  })
})

ponder.on('MarketFactory:MarketLocked', async ({ event, context }) => {
  await context.db.update(markets, { id: event.args.marketId }).set({
    state: 'LOCKED',
    updatedAt: Number(event.block.timestamp),
  })
})

ponder.on('MarketFactory:MarketDisputed', async ({ event, context }) => {
  await context.db.update(markets, { id: event.args.marketId }).set({
    state: 'DISPUTED',
    updatedAt: Number(event.block.timestamp),
  })
})

ponder.on('MarketFactory:MarketResolved', async ({ event, context }) => {
  await context.db.update(markets, { id: event.args.marketId }).set({
    state: 'RESOLVED',
    resolvedOutcome: event.args.winningOutcome,
    updatedAt: Number(event.block.timestamp),
  })
})

ponder.on('MarketFactory:MarketVoided', async ({ event, context }) => {
  await context.db.update(markets, { id: event.args.marketId }).set({
    state: 'VOIDED',
    updatedAt: Number(event.block.timestamp),
  })
})

ponder.on('AMMPool:LiquidityAdded', async ({ event, context }) => {
  await context.db.update(markets, { id: event.args.marketId }).set((row) => ({
    liquidity: row.liquidity + event.args.amount,
    updatedAt: Number(event.block.timestamp),
  }))
})

ponder.on('AMMPool:LiquidityRemoved', async ({ event, context }) => {
  await context.db.update(markets, { id: event.args.marketId }).set((row) => ({
    liquidity: row.liquidity - event.args.amount,
    updatedAt: Number(event.block.timestamp),
  }))
})

ponder.on('AMMPool:Trade', async ({ event, context }) => {
  await context.db.insert(trades).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    marketId: event.args.marketId,
    trader: event.args.trader,
    outcomeIndex: event.args.outcomeIndex,
    amountIn: event.args.amountIn,
    sharesOut: event.args.sharesOut,
    newOdds: event.args.newOdds,
    blockNumber: event.block.number,
  })

  await context.db
    .update(markets, { id: event.args.marketId })
    .set((row) => ({
      volume: row.volume + event.args.amountIn,
      updatedAt: Number(event.block.timestamp),
    }))
})

ponder.on('OracleCouncil:ResultFinalized', async ({ event, context }) => {
  await context.db
    .update(markets, { id: event.args.marketId })
    .set({ state: 'RESOLVED', resolvedOutcome: event.args.outcomeIndex, updatedAt: Number(event.block.timestamp) })

  await context.db.insert(oracleCases).values({
    marketId: event.args.marketId,
    state: 'FINALIZED',
    outcomeIndex: event.args.outcomeIndex,
    challenger: '0x0000000000000000000000000000000000000000',
    bond: 0n,
  }).onConflictDoUpdate({
    state: 'FINALIZED',
    outcomeIndex: event.args.outcomeIndex,
  })
})

ponder.on('ExchangeBook:OrderFilled', async ({ event, context }) => {
  await context.db.insert(orders).values({
    orderHash: event.args.orderHash,
    maker: event.args.maker,
    taker: event.args.taker,
    marketId: event.args.marketId,
    outcomeIndex: event.args.outcomeIndex,
    side: event.args.side,
    fillSize: event.args.fillSize,
    price1e18: event.args.price1e18,
    status: 'FILLED_OR_PARTIAL',
  }).onConflictDoUpdate((row) => ({
    fillSize: row.fillSize + event.args.fillSize,
  }))
})

ponder.on('ExchangeBook:OrderCanceledEvent', async ({ event, context }) => {
  await context.db.insert(cancellations).values({
    maker: event.args.maker,
    nonce: event.args.nonce,
    blockNumber: event.block.number,
  })
})

ponder.on('ParlayEngine:ParlayCreated', async ({ event, context }) => {
  await context.db.insert(parlays).values({
    id: event.args.parlayId,
    owner: event.args.user,
    legs: event.args.legs,
    stake: event.args.stake,
    payout: event.args.payout,
    cashoutValue: 0n,
    status: 'OPEN',
  })
})

ponder.on('ParlayEngine:ParlayCashedOut', async ({ event, context }) => {
  await context.db.update(parlays, { id: event.args.parlayId }).set({
    owner: event.args.user,
    cashoutValue: event.args.cashoutValue,
    status: 'CASHED_OUT',
  })
})

ponder.on('ParlayEngine:ParlaySettled', async ({ event, context }) => {
  await context.db.update(parlays, { id: event.args.parlayId }).set({
    payout: event.args.payout,
    status: event.args.status === 2 ? 'LOST' : event.args.status === 3 ? 'PARTIALLY_VOIDED' : 'WON',
  })
})

ponder.on('ParlayEngine:ParlayClaimed', async ({ event, context }) => {
  await context.db.update(parlays, { id: event.args.parlayId }).set({
    owner: event.args.user,
    status: 'CLAIMED',
  })
})

ponder.on('ForecastArena:ForecastCommitted', async ({ event, context }) => {
  await context.db.insert(forecasts).values({
    agent: event.args.agent,
    marketId: event.args.marketId,
    probabilityYes1e18: 0n,
    status: 'COMMITTED',
    commitHash: event.args.commitHash,
  })
})

ponder.on('ForecastArena:ForecastRevealed', async ({ event, context }) => {
  await context.db.update(forecasts, { agent: event.args.agent, marketId: event.args.marketId }).set({
    probabilityYes1e18: event.args.probabilityYes1e18,
    status: 'REVEALED',
  })
})

ponder.on('ForecastArena:ForecastScored', async ({ event, context }) => {
  await context.db.update(forecasts, { agent: event.args.agent, marketId: event.args.marketId }).set({ status: 'SCORED' })
})

ponder.on('OracleCouncil:ResultCommitted', async ({ event, context }) => {
  await context.db.insert(oracleCases).values({
    marketId: event.args.marketId,
    state: 'COMMITTED',
    outcomeIndex: 0n,
    challenger: '0x0000000000000000000000000000000000000000',
    bond: 0n,
  }).onConflictDoUpdate({
    state: 'COMMITTED',
  })
})

ponder.on('OracleCouncil:ResultRevealed', async ({ event, context }) => {
  await context.db.insert(oracleCases).values({
    marketId: event.args.marketId,
    state: 'REVEALED',
    outcomeIndex: event.args.outcomeIndex,
    challenger: '0x0000000000000000000000000000000000000000',
    bond: 0n,
  }).onConflictDoUpdate({
    state: 'REVEALED',
    outcomeIndex: event.args.outcomeIndex,
  })
})

ponder.on('OracleCouncil:ResultChallenged', async ({ event, context }) => {
  await context.db.insert(oracleCases).values({
    marketId: event.args.marketId,
    state: 'CHALLENGED',
    outcomeIndex: event.args.proposedOutcome,
    challenger: event.args.challenger,
    bond: event.args.bond,
  }).onConflictDoUpdate({
    state: 'CHALLENGED',
    outcomeIndex: event.args.proposedOutcome,
    challenger: event.args.challenger,
    bond: event.args.bond,
  })
})

ponder.on('OracleCouncil:ChallengeResolved', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'ORACLE_COUNCIL',
    kind: `CHALLENGE_RESOLVED_${event.args.finalOutcome}`,
    actor: event.args.winner,
    marketId: event.args.marketId,
    value: event.args.totalBond,
    blockNumber: event.block.number,
  })
})

ponder.on('SharedLiquidityVault:Deposited', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'LP_VAULT',
    kind: 'DEPOSITED',
    actor: event.args.user,
    marketId: 0n,
    value: event.args.assets,
    blockNumber: event.block.number,
  })
})

ponder.on('SharedLiquidityVault:WithdrawalQueued', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'LP_VAULT',
    kind: 'WITHDRAWAL_QUEUED',
    actor: event.args.user,
    marketId: 0n,
    value: event.args.assets,
    blockNumber: event.block.number,
  })
})

ponder.on('SharedLiquidityVault:WithdrawalPaid', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'LP_VAULT',
    kind: 'WITHDRAWAL_PAID',
    actor: event.args.user,
    marketId: 0n,
    value: event.args.assets,
    blockNumber: event.block.number,
  })
})

ponder.on('SharedLiquidityVault:AllocationChanged', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'LP_VAULT',
    kind: 'ALLOCATION_CHANGED',
    actor: '0x0000000000000000000000000000000000000000',
    marketId: event.args.marketId,
    value: event.args.deployedAssets,
    blockNumber: event.block.number,
  })
})

ponder.on('SharedLiquidityVault:Rebalanced', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'LP_VAULT',
    kind: `REBALANCED_TO_${event.args.toMarketId}`,
    actor: '0x0000000000000000000000000000000000000000',
    marketId: event.args.fromMarketId,
    value: event.args.assets,
    blockNumber: event.block.number,
  })
})

ponder.on('AIPass:PassMinted', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'AI_PASS',
    kind: `TIER_${event.args.tier}`,
    actor: event.args.user,
    marketId: 0n,
    value: event.args.credits,
    blockNumber: event.block.number,
  })
})

ponder.on('CreatorVault:CreatorFeeRecorded', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'CREATOR_VAULT',
    kind: 'FEE_RECORDED',
    actor: event.args.creator,
    marketId: 0n,
    value: event.args.creatorAmount + event.args.referralAmount + event.args.protocolAmount,
    blockNumber: event.block.number,
  })
})

ponder.on('LeagueFactory:LeagueJoined', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'LEAGUE',
    kind: `JOINED_${event.args.leagueId}`,
    actor: event.args.member,
    marketId: 0n,
    value: 0n,
    blockNumber: event.block.number,
  })
})

ponder.on('Reputation:BadgeIssued', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'REPUTATION',
    kind: `BADGE_${event.args.badge}`,
    actor: event.args.user,
    marketId: 0n,
    value: 0n,
    blockNumber: event.block.number,
  })
})

ponder.on('ResponsibleLimits:SpendRecorded', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'LIMITS',
    kind: 'SPEND_RECORDED',
    actor: event.args.user,
    marketId: 0n,
    value: event.args.amount,
    blockNumber: event.block.number,
  })
})

ponder.on('RiskGovernor:ProposalCreated', async ({ event, context }) => {
  await context.db.insert(riskProposals).values({
    id: event.args.proposalId,
    agent: event.args.agent,
    user: event.args.user,
    kind: event.args.kind,
    marketId: event.args.marketId,
    value: event.args.value,
    riskScoreBps: event.args.riskScoreBps,
    correlationBps: event.args.correlationBps,
    simulationHash: event.args.simulationHash,
    status: 'NEEDS_SIGNATURE',
  })
})

ponder.on('RiskGovernor:ProposalApproved', async ({ event, context }) => {
  await context.db.update(riskProposals, { id: event.args.proposalId }).set({ status: 'APPROVED' })
})

ponder.on('RiskGovernor:ProposalExecuted', async ({ event, context }) => {
  await context.db.update(riskProposals, { id: event.args.proposalId }).set({ status: 'EXECUTED' })
})

ponder.on('BetSlipNFT:SlipMinted', async ({ event, context }) => {
  await context.db.insert(betSlips).values({
    id: event.args.tokenId,
    owner: event.args.owner,
    originContract: event.args.originContract,
    originId: event.args.originId,
    slipType: event.args.slipType,
    rarity: event.args.rarity,
    stakeWei: event.args.stakeWei,
    oddsSnapshot1e18: event.args.oddsSnapshot1e18,
    status: 'OPEN',
  })
})

ponder.on('BetSlipNFT:SlipStatusUpdated', async ({ event, context }) => {
  await context.db.update(betSlips, { id: event.args.tokenId }).set({ status: `STATUS_${event.args.status}` })
})

ponder.on('SocialMarket:SocialMarketCreated', async ({ event, context }) => {
  await context.db.insert(socialMarkets).values({
    id: event.args.marketId,
    creator: event.args.creator,
    platform: event.args.platform,
    metric: event.args.metric,
    targetValue: event.args.targetValue,
    resolveTime: Number(event.args.resolveTime),
    finalValue: 0n,
    state: 'OPEN',
  })
})

ponder.on('SocialMarket:SocialResolutionFinalized', async ({ event, context }) => {
  await context.db.update(socialMarkets, { id: event.args.marketId }).set({
    finalValue: event.args.finalValue,
    state: event.args.hitTarget ? 'RESOLVED_YES' : 'RESOLVED_NO',
  })
})

ponder.on('SocialMarket:SocialVoided', async ({ event, context }) => {
  await context.db.update(socialMarkets, { id: event.args.marketId }).set({ state: 'VOIDED' })
})

ponder.on('SocialMarket:SocialRefunded', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'SOCIAL_MARKET',
    kind: 'BET_REFUNDED',
    actor: event.args.user,
    marketId: event.args.marketId,
    value: event.args.payout,
    blockNumber: event.block.number,
  })
})

ponder.on('SocialMarket:SocialPrizePoolRefunded', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'SOCIAL_MARKET',
    kind: 'PRIZE_POOL_REFUNDED',
    actor: event.args.creator,
    marketId: event.args.marketId,
    value: event.args.payout,
    blockNumber: event.block.number,
  })
})

ponder.on('BattleArena:BattleResolved', async ({ event, context }) => {
  await context.db.insert(battleResults).values({
    id: event.args.battleId,
    winner: event.args.winner,
    challengerScore: event.args.challengerScore,
    defenderScore: event.args.defenderScore,
  })
})

ponder.on('BattleArena:BattleCancelled', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'BATTLE_ARENA',
    kind: 'CANCELLED',
    actor: '0x0000000000000000000000000000000000000000',
    marketId: event.args.battleId,
    value: 0n,
    blockNumber: event.block.number,
  })
})

ponder.on('SignalMarketplace:SignalRegistered', async ({ event, context }) => {
  await context.db.insert(signals).values({
    id: event.args.signalId,
    agent: event.args.agent,
    bundleHash: event.args.bundleHash,
    creditCost: event.args.creditCost,
    requiredTier: event.args.requiredTier,
  })
})

ponder.on('FantasyContest:LineupSubmitted', async ({ event, context }) => {
  await context.db.insert(fantasyEntries).values({
    contestId: event.args.contestId,
    user: event.args.user,
    picksHash: event.args.picksHash,
    points: 0n,
    status: 'SUBMITTED',
  })
})

ponder.on('FantasyContest:LineupScored', async ({ event, context }) => {
  await context.db.update(fantasyEntries, { contestId: event.args.contestId, user: event.args.user }).set({
    points: event.args.points,
    status: 'SCORED',
  })
})

ponder.on('FantasyContest:ContestFinalized', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'FANTASY_CONTEST',
    kind: 'FINALIZED',
    actor: event.args.winner,
    marketId: event.args.contestId,
    value: event.args.points,
    blockNumber: event.block.number,
  })
})

ponder.on('BattleArena:AgentDuelCreated', async ({ event, context }) => {
  await context.db.insert(agentDuels).values({
    id: event.args.duelId,
    marketId: event.args.marketId,
    agentA: event.args.agentA,
    agentB: event.args.agentB,
    poolA: 0n,
    poolB: 0n,
    state: 'OPEN',
    winnerAgent: 0n,
    totalFee: 0n,
  })
})

ponder.on('BattleArena:AgentDuelStaked', async ({ event, context }) => {
  const stakeId = `${event.args.duelId}-${event.args.user}-${event.args.supportA}`
  await context.db.insert(duelStakes).values({
    id: stakeId,
    duelId: event.args.duelId,
    user: event.args.user,
    supportA: event.args.supportA,
    amount: event.args.amount,
  }).onConflictDoUpdate((row) => ({
    amount: row.amount + event.args.amount,
  }))

  if (event.args.supportA) {
    await context.db.update(agentDuels, { id: event.args.duelId }).set((row) => ({
      poolA: row.poolA + event.args.amount,
    }))
  } else {
    await context.db.update(agentDuels, { id: event.args.duelId }).set((row) => ({
      poolB: row.poolB + event.args.amount,
    }))
  }
})

ponder.on('BattleArena:DuelSettled', async ({ event, context }) => {
  await context.db.update(agentDuels, { id: event.args.duelId }).set({
    state: 'RESOLVED',
    winnerAgent: event.args.winnerAgent,
    totalFee: event.args.fee,
  })
})

ponder.on('BattleArena:StrategyClashCreated', async ({ event, context }) => {
  await context.db.insert(strategyClashes).values({
    id: event.args.clashId,
    agentA: event.args.agentA,
    agentB: event.args.agentB,
    poolA: 0n,
    poolB: 0n,
    state: 'OPEN',
    winnerAgent: 0n,
  })
})

ponder.on('BattleArena:StrategyClashStaked', async ({ event, context }) => {
  const stakeId = `${event.args.clashId}-${event.args.user}-${event.args.supportA}`
  await context.db.insert(strategyClashStakes).values({
    id: stakeId,
    clashId: event.args.clashId,
    user: event.args.user,
    supportA: event.args.supportA,
    amount: event.args.amount,
    commitHash: event.args.commitHash,
  }).onConflictDoUpdate((row) => ({
    amount: row.amount + event.args.amount,
  }))

  if (event.args.supportA) {
    await context.db.update(strategyClashes, { id: event.args.clashId }).set((row) => ({
      poolA: row.poolA + event.args.amount,
    }))
  } else {
    await context.db.update(strategyClashes, { id: event.args.clashId }).set((row) => ({
      poolB: row.poolB + event.args.amount,
    }))
  }
})

ponder.on('BattleArena:StrategyClashSettled', async ({ event, context }) => {
  await context.db.update(strategyClashes, { id: event.args.clashId }).set({
    state: 'RESOLVED',
    winnerAgent: event.args.winnerAgent,
  })
})

ponder.on('BattleArena:CardBattleCreated', async ({ event, context }) => {
  await context.db.insert(cardBattles).values({
    id: event.args.battleId,
    agentA: event.args.agentA,
    agentB: event.args.agentB,
    poolA: 0n,
    poolB: 0n,
    state: 'OPEN',
    winnerAgent: 0n,
  })
})

ponder.on('BattleArena:CardBattleStaked', async ({ event, context }) => {
  const stakeId = `${event.args.battleId}-${event.args.user}-${event.args.supportA}`
  await context.db.insert(cardBattleStakes).values({
    id: stakeId,
    battleId: event.args.battleId,
    user: event.args.user,
    supportA: event.args.supportA,
    amount: event.args.amount,
  }).onConflictDoUpdate((row) => ({
    amount: row.amount + event.args.amount,
  }))

  if (event.args.supportA) {
    await context.db.update(cardBattles, { id: event.args.battleId }).set((row) => ({
      poolA: row.poolA + event.args.amount,
    }))
  } else {
    await context.db.update(cardBattles, { id: event.args.battleId }).set((row) => ({
      poolB: row.poolB + event.args.amount,
    }))
  }
})

ponder.on('BattleArena:CardBattleSettled', async ({ event, context }) => {
  await context.db.update(cardBattles, { id: event.args.battleId }).set({
    state: 'RESOLVED',
    winnerAgent: event.args.winnerAgent,
  })
})

ponder.on('AgentNFT:AgentMinted', async ({ event, context }) => {
  await context.db.insert(agentNFTs).values({
    id: event.args.tokenId,
    owner: event.args.owner,
    name: event.args.name,
    archetype: event.args.archetype,
    strategyHash: event.args.strategyHash,
    brierScore1e18: 0n,
    winRate1e4: 0n,
    calibration1e4: 0n,
    battleWins: 0n,
    battleLosses: 0n,
    streak: 0n,
  })
})

ponder.on('AgentNFT:AgentStatsSynced', async ({ event, context }) => {
  await context.db.update(agentNFTs, { id: event.args.tokenId }).set({
    brierScore1e18: event.args.stats.brierScore1e18,
    winRate1e4: event.args.stats.winRate1e4,
    calibration1e4: event.args.stats.calibration1e4,
    battleWins: event.args.stats.battleWins,
    battleLosses: event.args.stats.battleLosses,
    streak: event.args.stats.streak,
  })
})

ponder.on('BattleArena:DuelRewardClaimed', async ({ event, context }) => {
  await context.db.insert(protocolEvents).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    module: 'BATTLE_ARENA_DUEL',
    kind: 'REWARD_CLAIMED',
    actor: event.args.user,
    marketId: event.args.duelId, // using marketId field to store duelId in protocolEvents
    value: event.args.amount,
    blockNumber: event.block.number,
  })
})
