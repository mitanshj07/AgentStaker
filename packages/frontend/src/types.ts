export type View =
  | 'demo'
  | 'arena'
  | 'exchange'
  | 'governor'
  | 'monad'
  | 'portfolio'
  | 'agents'
  | 'copy'
  | 'agent-studio'
  | 'liquidity'
  | 'creator'
  | 'pricing'
  | 'limits'
  | 'slips'
  | 'social'
  | 'battle'
  | 'dfs'
  | 'profile'
  | 'oracle'

export type Outcome = 'YES' | 'NO'
export type MarketState = 'OPEN' | 'RESOLVED' | 'VOIDED'
export type OrderType = 'GTC' | 'GTD' | 'IOC' | 'FOK' | 'FAK' | 'POST_ONLY'
export type RiskMode = 'Defensive' | 'Balanced' | 'Growth'
export type MarketFeedMode = 'Trending' | 'Live' | 'Closing soon' | 'New'

export type Market = {
  id: number
  onChainId?: number
  question: string
  category: string
  source: string
  lockLabel: string
  state: MarketState
  yesProbability: number
  volume: number
  liquidity: number
  qualityScore: number
  aiProbability: number
  creator: string
  tags: string[]
  league?: string
  eventLabel?: string
  isLive?: boolean
  featured?: boolean
  boosted?: boolean
  closingSoon?: boolean
  trend?: number
  resolvedOutcome?: Outcome
  poolReady?: boolean
  sourceMode?: 'ON_CHAIN' | 'DEMO_FALLBACK' | 'LIVE_API'
  cryptoSymbol?: string
  cryptoMetric?: 'PRICE_CLOSE' | 'DAY_HIGH' | 'DAY_LOW' | 'VOLUME_24H' | 'MARKET_CAP'
  cryptoTarget?: number
  cryptoCurrent?: number
  cryptoUnit?: 'USD' | 'USD_VOLUME' | 'USD_MARKET_CAP'
  cryptoPriceUsd?: number
  cryptoDayHighUsd?: number
  cryptoDayLowUsd?: number
  cryptoVolume24hUsd?: number
  cryptoMarketCapUsd?: number
  cryptoPercentChange24h?: number
  cryptoVolumeChange24h?: number
  cryptoQuoteUpdatedAt?: string
  cryptoNextRefreshAt?: string
  cryptoHighLowSource?: 'CMC_OHLCV' | 'QUOTE_ONLY' | 'PLAN_GATED'
  cryptoRationale?: string
  txHash?: `0x${string}`
  trades: string[]
}

export type Position = {
  id: number
  marketId: number
  outcome: Outcome
  stake: number
  shares: number
  status: 'OPEN' | 'CLAIMABLE' | 'LOST' | 'CLAIMED'
  source?: 'ON_CHAIN' | 'DEMO_FALLBACK'
  txHash?: `0x${string}`
}

export type Order = {
  id: number
  side: 'BACK' | 'LAY'
  type: OrderType
  market: string
  outcome: Outcome
  odds: number
  size: number
  filled: number
  queueAhead: number
  status: 'OPEN' | 'PARTIAL' | 'FILLED' | 'CANCELED'
}

export type ParlayLeg = {
  marketId: number
  outcome: Outcome
  odds: number
  category: string
  question: string
}

export type Parlay = {
  id: number
  onChainId?: number
  legs: ParlayLeg[]
  stake: number
  combinedOdds: number
  status: 'OPEN' | 'WON' | 'LOST' | 'CLAIMED' | 'CASHED_OUT'
  cashoutQuote?: number
  quoteExpiresAt?: number
  source?: 'ON_CHAIN' | 'DEMO_FALLBACK'
  txHash?: `0x${string}`
}

export type AgentTask = {
  id: number
  agent: string
  title: string
  output: string
  status: 'queued' | 'running' | 'done'
}

export type RiskProposal = {
  id: number
  action: string
  market: string
  value: number
  riskScore: number
  drawdown: number
  correlation: number
  var95: number
  status: 'NEEDS_SIGNATURE' | 'APPROVED' | 'EXECUTED' | 'BLOCKED'
  proposerAgentId?: string
  agentConfidence?: number
}

export type TxStep = {
  label: string
  state: 'idle' | 'ready' | 'active' | 'done'
}

export type ForecastEntry = {
  id: number
  agent: string
  marketId?: number
  probability: number
  brierScore: number
  badge: string
  status: 'COMMITTED' | 'REVEALED' | 'SCORED'
  source?: 'ON_CHAIN' | 'DEMO_FALLBACK'
}

export type OracleCase = {
  marketId: number
  state: 'READY' | 'COMMITTED' | 'REVEALED' | 'CHALLENGED' | 'FINALIZED'
  bond: number
  challenger?: string
  outcome?: Outcome
  source?: 'ON_CHAIN' | 'DEMO_FALLBACK'
  txHash?: `0x${string}`
}

export type VaultState = {
  idle: number
  deployed: number
  queued: number
  shares: number
  pendingWithdrawal: number
  allocations: Record<number, number>
}
