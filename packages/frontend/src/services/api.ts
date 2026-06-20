const MATCHER_URL = import.meta.env.VITE_MATCHER_URL || ''

export type SmartRouteQuote = {
  marketId: string
  outcomeIndex: string
  side: 'BACK' | 'LAY'
  requestedSize: number
  effectivePrice: number
  depthUsed: number
  priceImpactBps: number
  routeHash: string
  expiry: number
  requiredSignatures: string[]
  legs: Array<{ venue: 'CLOB' | 'AMM'; size: number; price: number; reason: string }>
}

export type AiAdvice = {
  mode: string
  advisoryOnly: boolean
  requiresUserApproval: boolean
  confidence: string
  [key: string]: unknown
}

export type CryptoAssetQuote = {
  id: string
  symbol: string
  name: string
  slug?: string
  rank?: number
  priceUsd: number
  volume24hUsd: number
  volumeChange24h: number
  marketCapUsd: number
  percentChange1h: number
  percentChange24h: number
  percentChange7d: number
  dayOpenUsd?: number
  dayHighUsd?: number
  dayLowUsd?: number
  dayCloseUsd?: number
  highLowSource: 'CMC_OHLCV' | 'QUOTE_ONLY' | 'PLAN_GATED'
  lastUpdated: string
}

export type CryptoGeneratedMarket = {
  id: string
  uiMarketId: number
  symbol: string
  question: string
  category: 'Crypto'
  source: string
  lockLabel: string
  yesProbability: number
  volume: number
  liquidity: number
  qualityScore: number
  aiProbability: number
  tags: string[]
  eventLabel: string
  isLive: boolean
  featured: boolean
  trend: number
  metric: 'PRICE_CLOSE' | 'DAY_HIGH' | 'DAY_LOW' | 'VOLUME_24H' | 'MARKET_CAP'
  target: number
  current: number
  unit: 'USD' | 'USD_VOLUME' | 'USD_MARKET_CAP'
  rationale: string
  crypto: CryptoAssetQuote
}

export type CryptoMarketFeed = {
  mode: 'LIVE_API' | 'CACHE' | 'FALLBACK'
  source: 'COINMARKETCAP' | 'DETERMINISTIC_FALLBACK'
  generatedAt: string
  refreshedAt: string
  nextRefreshAt: string
  stale: boolean
  assets: CryptoAssetQuote[]
  markets: CryptoGeneratedMarket[]
  warnings: string[]
  policy: {
    refreshMode: 'DAILY' | 'TWELVE_HOURLY' | 'HOURLY' | 'FINAL_HOURLY' | 'CUSTOM'
    refreshIntervalMs: number
    callsPerRefresh: number
    quoteEndpoint: string
    ohlcvEndpoint?: string
    ohlcvEnabled: boolean
    quotaNote: string
  }
  error?: string
}

async function post<T>(path: string, body: Record<string, unknown>, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${MATCHER_URL}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`${path} returned ${response.status}`)
    return await response.json() as T
  } catch {
    return fallback
  }
}

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${MATCHER_URL}${path}`)
    if (!response.ok) throw new Error(`${path} returned ${response.status}`)
    return await response.json() as T
  } catch {
    return fallback
  }
}

export function quoteSmartRoute(input: {
  marketId: number
  outcomeIndex: number
  side: 'BACK' | 'LAY'
  size: number
  maxSlippageBps?: number
}) {
  const clobSize = Number((input.size * 0.62).toFixed(2))
  const ammSize = Number((input.size - clobSize).toFixed(2))
  const fallback: SmartRouteQuote = {
    marketId: String(input.marketId),
    outcomeIndex: String(input.outcomeIndex),
    side: input.side,
    requestedSize: input.size,
    effectivePrice: 0.56,
    depthUsed: clobSize,
    priceImpactBps: 84,
    routeHash: '0xdemo-route-hash',
    expiry: Math.floor(Date.now() / 1000) + 30,
    requiredSignatures: ['EIP-712 order signature', 'wallet transaction approval for AMM leg'],
    legs: [
      { venue: 'CLOB', size: clobSize, price: 0.55, reason: 'Use signed resting liquidity first' },
      { venue: 'AMM', size: ammSize, price: 0.57, reason: 'Fill residual size with AMM liquidity' },
    ],
  }
  return post('/route/quote', input, fallback)
}

export function requestAi(kind: 'parlay-risk' | 'hedge' | 'forecast' | 'lp-rebalance' | 'check-market', body: Record<string, unknown>) {
  const fallback: AiAdvice = {
    mode: 'DETERMINISTIC_FALLBACK',
    advisoryOnly: true,
    requiresUserApproval: true,
    confidence: kind === 'forecast' ? 'MEDIUM' : 'HIGH',
    recommendation: kind === 'lp-rebalance'
      ? 'Shift 18% of idle depth toward the tighter-spread market.'
      : 'Review correlated exposure and sign only after checking the route preview.',
    warning: 'Agent output is advisory and testnet-only.',
    qualityScore: 91,
  }
  return post(`/ai/${kind}`, body, fallback)
}

export function fetchCryptoMarketFeed() {
  const fallback: CryptoMarketFeed = {
    mode: 'FALLBACK',
    source: 'DETERMINISTIC_FALLBACK',
    generatedAt: new Date().toISOString(),
    refreshedAt: new Date().toISOString(),
    nextRefreshAt: new Date(Date.now() + 43_200_000).toISOString(),
    stale: false,
    assets: [],
    markets: [],
    warnings: ['Matcher crypto feed is unavailable; local seed markets remain active.'],
    policy: {
      refreshMode: 'TWELVE_HOURLY',
      refreshIntervalMs: 43_200_000,
      callsPerRefresh: 0,
      quoteEndpoint: 'https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest',
      ohlcvEnabled: false,
      quotaNote: 'Frontend fallback made no CoinMarketCap calls.',
    },
  }
  return get('/api/crypto/markets', fallback)
}

export type ActivityItem = { id: string; kind: string; title: string; detail: string; at: number; module: string }
export type SignalBundle = { id: string; agent: string; title: string; credits: number; tier: string; confidence: number; bundleHash: string; locked: boolean; recommendation?: string }

export function fetchActivity() {
  return get('/api/activity', {
    mode: 'DEMO_FALLBACK',
    items: [{ id: 'fallback-activity', kind: 'SLIP', title: 'Slip card minted', detail: 'Your testnet gameplay card is ready to share.', at: Date.now(), module: 'BetSlipNFT' }],
  })
}

export function previewSocialMarket(input: { contentUrl: string; handle: string; startValue: number; targetValue: number }) {
  return post('/api/social/preview', input, {
    mode: 'DEMO_FALLBACK',
    platform: input.contentUrl.includes('youtu') ? 'YOUTUBE' : 'X',
    handle: input.handle,
    startValue: input.startValue,
    targetValue: input.targetValue,
    progress: Math.round((input.startValue / input.targetValue) * 100),
    checks: ['Canonical content URL', 'Manual oracle evidence URI required', '30 minute challenge window', 'Test MON only'],
  })
}

export function fetchSignals() {
  return get('/api/signals', {
    mode: 'DEMO_FALLBACK',
    signals: [{ id: '1', agent: 'Alpha Ensemble', title: 'BTC Friday close calibration', credits: 8, tier: 'PRO', confidence: 0.72, bundleHash: '0xalpha101', locked: true }],
  })
}

export function unlockSignal(signalId: string) {
  return post(`/api/signals/${signalId}/unlock`, {}, {
    id: signalId,
    agent: 'Alpha Ensemble',
    title: 'BTC Friday close calibration',
    credits: 8,
    tier: 'PRO',
    confidence: 0.72,
    bundleHash: '0xalpha101',
    locked: false,
    recommendation: 'Review route depth before signing any order.',
  })
}

export function createAgentSession() {
  return post('/api/sessions', {
    wallet: '0x1111111111111111111111111111111111111111',
    sessionKey: '0x2222222222222222222222222222222222222222',
    dailyCap: 1.5,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  }, {
    wallet: '0x1111111111111111111111111111111111111111',
    sessionKey: '0x2222222222222222222222222222222222222222',
    dailyCap: 1.5,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    spentToday: 0,
    paused: false,
    permissions: ['CLOB_SIGNED_FILL', 'CANCEL_ORDER'],
    forbidden: ['AMM_SWAP', 'WITHDRAW', 'ARBITRARY_CALL'],
  })
}

// --- Agent Tournament API ---

export type AgentProfile = {
  id: string
  name: string
  strategy: string
  description: string
  avatar: string
  brierScore: number
  totalForecasts: number
  winRate: number
  streak: number
  badge: string
  rank: number
  systemPrompt?: string
  lastForecast?: {
    marketId: number
    probability: number
    reasoning: string
    confidence: string
    timestamp: number
  }
}

export type TournamentResult = {
  marketId: number
  question: string
  agents: Array<{
    agentId: string
    name: string
    probability: number
    reasoning: string
    confidence: string
    keyFactors: string[]
    timestamp: number
  }>
  consensus: number
  mode: string
}

export type AgentConsensus = {
  marketId: number
  consensus: number
  spread: number
  agents: Array<{ id: string; name: string; probability: number }>
  mode: string
}

export type SpawnedAgentDraft = {
  name: string
  systemPrompt: string
  strategyTags: string[]
  shortBio: string
}

export type AgentDebateResult = {
  agentA: { argument: string; confidence: number }
  agentB: { argument: string; confidence: number }
}

function tagsFromDescription(description: string) {
  const normalized = description.toLowerCase()
  const tags = [
    ['monad', 'monad-ecosystem'], ['sport', 'sports'], ['macro', 'macro'], ['trend', 'momentum'],
    ['momentum', 'momentum'], ['volatile', 'volatility'], ['sentiment', 'sentiment'], ['contrarian', 'contrarian'], ['crypto', 'crypto'],
  ].filter(([keyword]) => normalized.includes(keyword)).map(([, tag]) => tag)
  return [...new Set(tags)].slice(0, 3)
}

export function spawnAgent(personaDescription: string) {
  const words = personaDescription.trim().split(/\s+/).filter(Boolean)
  const nameWords = words.slice(0, 2).map((word) => word.replace(/[^a-z0-9]/gi, '')).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
  const fallback: SpawnedAgentDraft = {
    name: nameWords.length ? nameWords.join(' ') : 'Quant Ghost',
    systemPrompt: `You are an autonomous prediction agent following this strategy: ${personaDescription}. State a calibrated confidence between 0.55 and 0.85. Explain the prior, evidence, and final probability briefly, and reduce exposure whenever evidence is weak.`,
    strategyTags: tagsFromDescription(personaDescription).length ? tagsFromDescription(personaDescription) : ['crypto'],
    shortBio: personaDescription.slice(0, 110),
  }
  return post<SpawnedAgentDraft>('/ai/agent-spawn', { personaDescription }, fallback)
}

export function fetchAgentDebate(input: {
  marketId: string
  marketTitle: string
  marketDescription: string
  agentAName: string
  agentAPrompt: string
  agentBName: string
  agentBPrompt: string
}) {
  const fallback: AgentDebateResult = {
    agentA: { argument: `${input.agentAName} sees the current base rate and market momentum supporting YES. The quoted probability still leaves room for uncertainty, but the evidence direction is positive.`, confidence: 0.68 },
    agentB: { argument: `${input.agentBName} believes consensus is over-pricing the latest narrative. Resolution risk and missing confirmation make NO the better calibrated side.`, confidence: 0.62 },
  }
  return post<AgentDebateResult>('/ai/agent-debate', input, fallback)
}

export function createAgent(prompt: string) {
  return post('/api/agents/create', { prompt }, {
    mode: 'DETERMINISTIC_FALLBACK',
    agent: {
      id: `agent-fallback-${Date.now()}`,
      name: 'Custom Fallback Agent',
      avatar: '🤖',
      strategy: 'Generalist',
      description: 'A fallback agent created in offline mode.',
      brierScore: 0.25,
      totalForecasts: 0,
      winRate: 0,
      streak: 0,
      badge: 'NEW',
      rank: 99
    }
  })
}

export function fetchAgentLeaderboard() {
  const fallback = {
    mode: 'DETERMINISTIC_FALLBACK',
    agents: [
      { id: 'alpha', name: 'Alpha Ensemble', avatar: '🧠', strategy: 'Conservative', description: 'Multi-model consensus', brierScore: 0.084, totalForecasts: 142, winRate: 64.1, streak: 3, badge: 'CALIBRATED', rank: 1 },
      { id: 'sigma', name: 'Sigma Prophet', avatar: '📊', strategy: 'Bayesian', description: 'Base-rate driven updating', brierScore: 0.112, totalForecasts: 118, winRate: 61.0, streak: -1, badge: 'BASE_RATES', rank: 2 },
      { id: 'quant', name: 'Quant Razor', avatar: '⚡', strategy: 'Aggressive', description: 'Momentum focused', brierScore: 0.145, totalForecasts: 185, winRate: 56.2, streak: 5, badge: 'MOMENTUM', rank: 3 },
      { id: 'neural', name: 'Neural Edge', avatar: '🔮', strategy: 'Contrarian', description: 'Narrative-driven', brierScore: 0.158, totalForecasts: 94, winRate: 43.6, streak: 1, badge: 'CONTRARIAN', rank: 4 }
    ]
  }
  return get<{ agents: AgentProfile[]; mode: string }>('/api/agents/leaderboard', fallback)
}

export type AgentForecast = {
  marketId: number
  question: string
  probability: number
  reasoning: string
  confidence: string
  keyFactors: string[]
  timestamp: number
  scored: boolean
  brierContribution?: number
}

export function fetchAgentHistory(agentId: string) {
  const fallback = {
    mode: 'DETERMINISTIC_FALLBACK',
    history: []
  }
  return get<{ history: AgentForecast[]; mode: string }>(`/api/agents/${agentId}/history`, fallback)
}

export function runTournament(marketId: number, question: string) {
  const fallback: TournamentResult = {
    mode: 'DETERMINISTIC_FALLBACK',
    marketId,
    question,
    consensus: 0.55,
    agents: [
      { agentId: 'alpha', name: 'Alpha Ensemble', probability: 0.57, reasoning: 'Market trend supports slight edge', confidence: 'MEDIUM', keyFactors: ['Volume profile', 'Historical resistance'], timestamp: Date.now() },
      { agentId: 'sigma', name: 'Sigma Prophet', probability: 0.52, reasoning: 'Base rates suggest closer to 50/50', confidence: 'HIGH', keyFactors: ['Base category rate'], timestamp: Date.now() },
      { agentId: 'quant', name: 'Quant Razor', probability: 0.65, reasoning: 'Momentum is accelerating', confidence: 'LOW', keyFactors: ['Tick speed', 'Spread tightening'], timestamp: Date.now() },
      { agentId: 'neural', name: 'Neural Edge', probability: 0.45, reasoning: 'Crowd is overestimating immediate impact', confidence: 'MEDIUM', keyFactors: ['Sentiment divergence'], timestamp: Date.now() }
    ]
  }
  return post<TournamentResult>('/api/agents/tournament/run', { marketId, question }, fallback)
}

export function fetchAgentConsensus(marketId: number) {
  const fallback: AgentConsensus = {
    mode: 'DETERMINISTIC_FALLBACK',
    marketId,
    consensus: 0.55,
    spread: 0.20,
    agents: [
      { id: 'alpha', name: 'Alpha Ensemble', probability: 0.57 },
      { id: 'sigma', name: 'Sigma Prophet', probability: 0.52 },
      { id: 'quant', name: 'Quant Razor', probability: 0.65 },
      { id: 'neural', name: 'Neural Edge', probability: 0.45 }
    ]
  }
  return get<AgentConsensus>(`/api/agents/consensus/${marketId}`, fallback)
}
