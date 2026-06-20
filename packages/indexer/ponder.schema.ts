import { index, onchainTable, primaryKey } from 'ponder'

export const markets = onchainTable('markets', (t) => ({
  id: t.bigint().primaryKey(),
  creator: t.hex().notNull(),
  question: t.text().notNull(),
  category: t.text().notNull(),
  state: t.text().notNull(),
  volume: t.bigint().notNull(),
  liquidity: t.bigint().notNull(),
  resolvedOutcome: t.bigint(),
  updatedAt: t.integer().notNull(),
}), (table) => ({
  creatorIdx: index().on(table.creator),
  stateIdx: index().on(table.state),
}))

export const trades = onchainTable('trades', (t) => ({
  id: t.text().primaryKey(),
  marketId: t.bigint().notNull(),
  trader: t.hex().notNull(),
  outcomeIndex: t.bigint().notNull(),
  amountIn: t.bigint().notNull(),
  sharesOut: t.bigint().notNull(),
  newOdds: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
}), (table) => ({
  marketIdIdx: index().on(table.marketId),
  traderIdx: index().on(table.trader),
}))

export const orders = onchainTable('orders', (t) => ({
  orderHash: t.hex().primaryKey(),
  maker: t.hex().notNull(),
  taker: t.hex().notNull(),
  marketId: t.bigint().notNull(),
  outcomeIndex: t.bigint().notNull(),
  side: t.integer().notNull(),
  fillSize: t.bigint().notNull(),
  price1e18: t.bigint().notNull(),
  status: t.text().notNull(),
}), (table) => ({
  makerIdx: index().on(table.maker),
  marketIdIdx: index().on(table.marketId),
}))

export const cancellations = onchainTable(
  'cancellations',
  (t) => ({
    maker: t.hex().notNull(),
    nonce: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.maker, table.nonce] }) }),
)

export const riskProposals = onchainTable('risk_proposals', (t) => ({
  id: t.bigint().primaryKey(),
  agent: t.hex().notNull(),
  user: t.hex().notNull(),
  kind: t.integer().notNull(),
  marketId: t.bigint().notNull(),
  value: t.bigint().notNull(),
  riskScoreBps: t.bigint().notNull(),
  correlationBps: t.bigint().notNull(),
  simulationHash: t.hex().notNull(),
  status: t.text().notNull(),
}), (table) => ({
  userIdx: index().on(table.user),
  agentIdx: index().on(table.agent),
}))

export const parlays = onchainTable('parlays', (t) => ({
  id: t.bigint().primaryKey(),
  owner: t.hex().notNull(),
  legs: t.bigint().notNull(),
  stake: t.bigint().notNull(),
  payout: t.bigint().notNull(),
  cashoutValue: t.bigint().notNull(),
  status: t.text().notNull(),
}), (table) => ({ ownerIdx: index().on(table.owner) }))

export const forecasts = onchainTable(
  'forecasts',
  (t) => ({
    agent: t.hex().notNull(),
    marketId: t.bigint().notNull(),
    probabilityYes1e18: t.bigint().notNull(),
    status: t.text().notNull(),
    commitHash: t.hex().notNull(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.agent, table.marketId] }) }),
)

export const oracleCases = onchainTable('oracle_cases', (t) => ({
  marketId: t.bigint().primaryKey(),
  state: t.text().notNull(),
  outcomeIndex: t.bigint().notNull(),
  challenger: t.hex().notNull(),
  bond: t.bigint().notNull(),
}))

export const protocolEvents = onchainTable('protocol_events', (t) => ({
  id: t.text().primaryKey(),
  module: t.text().notNull(),
  kind: t.text().notNull(),
  actor: t.hex().notNull(),
  marketId: t.bigint().notNull(),
  value: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
}), (table) => ({
  moduleIdx: index().on(table.module),
  actorIdx: index().on(table.actor),
}))

export const betSlips = onchainTable('bet_slips', (t) => ({
  id: t.bigint().primaryKey(),
  owner: t.hex().notNull(),
  originContract: t.hex().notNull(),
  originId: t.bigint().notNull(),
  slipType: t.integer().notNull(),
  rarity: t.integer().notNull(),
  stakeWei: t.bigint().notNull(),
  oddsSnapshot1e18: t.bigint().notNull(),
  status: t.text().notNull(),
}), (table) => ({
  ownerIdx: index().on(table.owner),
  originIdx: index().on(table.originContract),
}))

export const socialMarkets = onchainTable('social_markets', (t) => ({
  id: t.bigint().primaryKey(),
  creator: t.hex().notNull(),
  platform: t.integer().notNull(),
  metric: t.integer().notNull(),
  targetValue: t.bigint().notNull(),
  resolveTime: t.integer().notNull(),
  finalValue: t.bigint().notNull(),
  state: t.text().notNull(),
}), (table) => ({ creatorIdx: index().on(table.creator) }))

export const battleResults = onchainTable('battle_results', (t) => ({
  id: t.bigint().primaryKey(),
  winner: t.hex().notNull(),
  challengerScore: t.bigint().notNull(),
  defenderScore: t.bigint().notNull(),
}), (table) => ({ winnerIdx: index().on(table.winner) }))

export const signals = onchainTable('signals', (t) => ({
  id: t.bigint().primaryKey(),
  agent: t.hex().notNull(),
  bundleHash: t.hex().notNull(),
  creditCost: t.bigint().notNull(),
  requiredTier: t.bigint().notNull(),
}), (table) => ({ agentIdx: index().on(table.agent) }))

export const fantasyEntries = onchainTable(
  'fantasy_entries',
  (t) => ({
    contestId: t.bigint().notNull(),
    user: t.hex().notNull(),
    picksHash: t.hex().notNull(),
    points: t.bigint().notNull(),
    status: t.text().notNull(),
  }),
  (table) => ({ pk: primaryKey({ columns: [table.contestId, table.user] }) }),
)

export const agentDuels = onchainTable('agent_duels', (t) => ({
  id: t.bigint().primaryKey(),
  marketId: t.bigint().notNull(),
  agentA: t.hex().notNull(),
  agentB: t.hex().notNull(),
  poolA: t.bigint().notNull(),
  poolB: t.bigint().notNull(),
  state: t.text().notNull(),
  winner: t.hex().notNull(),
  totalFee: t.bigint().notNull(),
}), (table) => ({
  marketIdIdx: index().on(table.marketId),
}))

export const duelStakes = onchainTable('duel_stakes', (t) => ({
  id: t.text().primaryKey(),
  duelId: t.bigint().notNull(),
  user: t.hex().notNull(),
  supportA: t.boolean().notNull(),
  amount: t.bigint().notNull(),
}), (table) => ({
  duelIdIdx: index().on(table.duelId),
  userIdx: index().on(table.user),
}))

export const agentNFTs = onchainTable('agent_nfts', (t) => ({
  id: t.bigint().primaryKey(),
  owner: t.hex().notNull(),
  name: t.text().notNull(),
  archetype: t.text().notNull(),
  strategyHash: t.hex().notNull(),
  brierScore1e18: t.bigint().notNull(),
  winRate1e4: t.bigint().notNull(),
  calibration1e4: t.bigint().notNull(),
  battleWins: t.bigint().notNull(),
  battleLosses: t.bigint().notNull(),
  streak: t.bigint().notNull(),
}), (table) => ({
  ownerIdx: index().on(table.owner),
}))

export const strategyClashes = onchainTable('strategy_clashes', (t) => ({
  id: t.bigint().primaryKey(),
  agentA: t.bigint().notNull(),
  agentB: t.bigint().notNull(),
  poolA: t.bigint().notNull(),
  poolB: t.bigint().notNull(),
  state: t.text().notNull(),
  winnerAgent: t.bigint().notNull(),
}))

export const strategyClashStakes = onchainTable('strategy_clash_stakes', (t) => ({
  id: t.text().primaryKey(),
  clashId: t.bigint().notNull(),
  user: t.hex().notNull(),
  supportA: t.boolean().notNull(),
  amount: t.bigint().notNull(),
  commitHash: t.hex().notNull(),
}), (table) => ({
  clashIdIdx: index().on(table.clashId),
  userIdx: index().on(table.user),
}))

export const cardBattles = onchainTable('card_battles', (t) => ({
  id: t.bigint().primaryKey(),
  agentA: t.bigint().notNull(),
  agentB: t.bigint().notNull(),
  poolA: t.bigint().notNull(),
  poolB: t.bigint().notNull(),
  state: t.text().notNull(),
  winnerAgent: t.bigint().notNull(),
}))

export const cardBattleStakes = onchainTable('card_battle_stakes', (t) => ({
  id: t.text().primaryKey(),
  battleId: t.bigint().notNull(),
  user: t.hex().notNull(),
  supportA: t.boolean().notNull(),
  amount: t.bigint().notNull(),
}), (table) => ({
  battleIdIdx: index().on(table.battleId),
  userIdx: index().on(table.user),
}))

export const copyTradingSessions = onchainTable('copy_trading_sessions', (t) => ({
  id: t.text().primaryKey(),
  follower: t.hex().notNull(),
  target: t.hex().notNull(),
  sessionKey: t.hex().notNull(),
  dailyCap: t.bigint().notNull(),
  active: t.boolean().notNull(),
}), (table) => ({
  followerIdx: index().on(table.follower),
  targetIdx: index().on(table.target),
}))
