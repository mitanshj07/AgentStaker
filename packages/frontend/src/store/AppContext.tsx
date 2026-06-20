/* eslint-disable react-refresh/only-export-components -- context store exports are intentionally colocated with the provider */
import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import {
  ARENAX_APP_MODE,
  fetchMonadStatus,
  MONAD_FINALITY_MS,
  MONAD_TESTNET,
  REAL_MONEY_ENABLED,
  readConnectedMonadWallet,
  requestMonadWallet,
  sendZeroValueHeartbeat,
  type MonadStatus,
  type WalletState,
} from '../lib/monad'
import {
  getContractRuntimeSummary,
  localFallbackResult,
  readParlayCashout,
  resolveOnChainMarketId,
  resolveUiMarketId,
  writeAmmBuy,
  writeAmmRedeem,
  writeClaimParlay,
  writeCreateAmmPool,
  writeCreateBinaryMarket,
  writeCreateParlay,
  writeOracleChallenge,
  writeOracleCommit,
  writeOracleFinalize,
  writeOracleReveal,
  writeParlayCashout,
  writeSettleParlay,
  writeVaultDeposit,
  writeVaultProcessWithdrawal,
  writeVaultRebalance,
  writeVaultWithdraw,
  REAL_TESTNET_TRANSACTIONS_REQUIRED,
  type ContractProgress,
} from '../lib/contractWrites'
import { fetchCryptoMarketFeed, quoteSmartRoute, requestAi, type AiAdvice, type CryptoGeneratedMarket, type CryptoMarketFeed, type SmartRouteQuote } from '../services/api'
import { fetchIndexedDashboard, indexedWeiToMON, initialIndexedStatus, type IndexedMarket, type IndexedProtocolEvent } from '../services/indexer'
import { humanizeTransactionError, readErrorDetail } from '../lib/errorCopy'
import { formatMON } from '../lib/format'
import type { AgentTask, ForecastEntry, Market, MarketFeedMode, OracleCase, Order, OrderType, Outcome, Parlay, ParlayLeg, Position, RiskMode, RiskProposal, TxStep, VaultState, View } from '../types'
import { getAllAgents } from '../state/agentRegistry'
import { emitAgentEvent } from '../state/agentEvents'

export const initialMarkets: Market[] = [
  {
    id: 101,
    question: 'Will BTC/USD close above $100,000 this Friday at 23:59 UTC?',
    category: 'Crypto',
    source: 'Price oracle/admin MVP',
    lockLabel: '18h',
    state: 'OPEN',
    yesProbability: 0.58,
    volume: 12840,
    liquidity: 42000,
    qualityScore: 94,
    aiProbability: 0.55,
    creator: '0x8d2',
    tags: ['price feed', 'crypto', 'oracle'],
    league: 'Crypto',
    eventLabel: 'Friday close',
    featured: true,
    trend: 3.8,
    trades: ['0x8d2 bought YES for 1.2 MON', 'AI Alpha forecasted 55% YES'],
  },
  {
    id: 102,
    question: 'Will India win the next cricket match listed by the demo oracle?',
    category: 'Sports',
    source: 'Admin oracle for MVP',
    lockLabel: '4h',
    state: 'OPEN',
    yesProbability: 0.66,
    volume: 21310,
    liquidity: 52000,
    qualityScore: 88,
    aiProbability: 0.62,
    creator: '0x1ef',
    tags: ['sports', 'manual oracle', 'live'],
    league: 'Cricket',
    eventLabel: 'Match winner',
    isLive: true,
    featured: true,
    boosted: true,
    trend: 7.2,
    trades: ['0x1ef bought YES for 2 MON', 'Creator seeded pool with 10 MON'],
  },
  {
    id: 103,
    question: 'Will a Monad ecosystem app announce public testnet deployment before Sunday 20:00 UTC?',
    category: 'Monad',
    source: 'Council/admin MVP',
    lockLabel: '2d',
    state: 'OPEN',
    yesProbability: 0.31,
    volume: 6930,
    liquidity: 25000,
    qualityScore: 91,
    aiProbability: 0.35,
    creator: '0xff0',
    tags: ['ecosystem', 'builder', 'testnet'],
    league: 'Monad ecosystem',
    eventLabel: 'Builder watch',
    featured: true,
    trend: -1.4,
    trades: ['0xff0 bought NO for 1 MON', 'Oracle Scout attached source checklist'],
  },
  {
    id: 104,
    question: 'Will Bengaluru chase the demo cricket target before the final over?',
    category: 'Sports',
    source: 'Demo sports oracle',
    lockLabel: 'LIVE 18.2 ov',
    state: 'OPEN',
    yesProbability: 0.72,
    volume: 48720,
    liquidity: 56000,
    qualityScore: 92,
    aiProbability: 0.69,
    creator: '0xipl',
    tags: ['cricket', 'live', 'innings', 'demo oracle'],
    league: 'Cricket',
    eventLabel: 'Live chase',
    isLive: true,
    featured: true,
    trend: 9.6,
    trades: ['Crowd pulse moved YES +4 points', 'Oracle Scout verified innings state'],
  },
  {
    id: 105,
    question: 'Will the home side win the featured demo football fixture in regulation?',
    category: 'Sports',
    source: 'Demo sports oracle',
    lockLabel: '42m',
    state: 'OPEN',
    yesProbability: 0.47,
    volume: 18240,
    liquidity: 33000,
    qualityScore: 89,
    aiProbability: 0.51,
    creator: '0xgoal',
    tags: ['football', 'match winner', 'closing soon', 'demo oracle'],
    league: 'Football',
    eventLabel: 'Match winner',
    closingSoon: true,
    boosted: true,
    trend: 2.3,
    trades: ['Maker depth improved by 3.4 MON', 'Forecast Agent moved to 51% YES'],
  },
  {
    id: 106,
    question: 'Will Team Monad win the best-of-three demo esports final?',
    category: 'Esports',
    source: 'Demo esports oracle',
    lockLabel: '1h',
    state: 'OPEN',
    yesProbability: 0.54,
    volume: 14180,
    liquidity: 27000,
    qualityScore: 90,
    aiProbability: 0.57,
    creator: '0xgame',
    tags: ['esports', 'best of three', 'arena'],
    league: 'Esports',
    eventLabel: 'BO3 final',
    featured: true,
    trend: 4.1,
    trades: ['LP Rebalancer added 2 MON depth', 'Alpha Ensemble forecasted 57% YES'],
  },
  {
    id: 107,
    question: 'Will ETH/USD close above $4,000 in the next demo oracle window?',
    category: 'Crypto',
    source: 'Price oracle/admin MVP',
    lockLabel: '3h',
    state: 'OPEN',
    yesProbability: 0.44,
    volume: 9620,
    liquidity: 31000,
    qualityScore: 93,
    aiProbability: 0.46,
    creator: '0xeth',
    tags: ['price feed', 'crypto', 'closing soon'],
    league: 'Crypto',
    eventLabel: 'Price milestone',
    closingSoon: true,
    trend: -2.7,
    trades: ['0xeth bought NO for 0.8 MON', 'Price oracle heartbeat confirmed'],
  },
  {
    id: 108,
    question: 'Will Monad testnet produce 500,000 more blocks before the demo deadline?',
    category: 'Monad',
    source: 'Monad testnet RPC block oracle',
    lockLabel: '2d',
    state: 'OPEN',
    yesProbability: 0.63,
    volume: 7350,
    liquidity: 22000,
    qualityScore: 96,
    aiProbability: 0.66,
    creator: '0xmon',
    tags: ['monad', 'rpc', 'block oracle', 'testnet'],
    league: 'Monad network',
    eventLabel: 'Chain milestone',
    trend: 5.4,
    trades: ['Monad Tx Monitor recorded live block pulse', 'Forecast Agent committed 66% YES'],
  },
  {
    id: 109,
    question: 'Will Alpha Ensemble finish top three in the next Forecast Arena round?',
    category: 'AI',
    source: 'ForecastArena.sol leaderboard',
    lockLabel: '6h',
    state: 'OPEN',
    yesProbability: 0.59,
    volume: 5820,
    liquidity: 18000,
    qualityScore: 91,
    aiProbability: 0.61,
    creator: '0xagent',
    tags: ['ai', 'forecast arena', 'reputation'],
    league: 'AI Arena',
    eventLabel: 'Agent leaderboard',
    trend: 6.8,
    trades: ['Alpha Ensemble earned CALIBRATED badge', 'Forecast Arena opened round 12'],
  },
]

export const initialOrders: Order[] = [
  { id: 1, side: 'BACK', type: 'GTC', market: 'BTC > $100k', outcome: 'YES', odds: 1.74, size: 3.2, filled: 0.8, queueAhead: 4.1, status: 'PARTIAL' },
  { id: 2, side: 'LAY', type: 'POST_ONLY', market: 'India wins', outcome: 'YES', odds: 1.52, size: 1.8, filled: 0, queueAhead: 1.7, status: 'OPEN' },
]

export const odds = (probability: number) => Number((1 / probability).toFixed(2))
export const shortAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`

function indexedUiMarketId(onChainMarketId: number) {
  return resolveUiMarketId(onChainMarketId) ?? onChainMarketId
}

function indexedMarketProbability(market: IndexedMarket, fallback = 0.5) {
  if (!market.latestTrade) return fallback
  const latestOdds = Number(market.latestTrade.newOdds1e18) / 1e18
  if (!Number.isFinite(latestOdds) || latestOdds <= 0 || latestOdds >= 1) return fallback
  return market.latestTrade.outcomeIndex === '0' ? latestOdds : 1 - latestOdds
}

type AppContextType = ReturnType<typeof useAppStore>
type CryptoFeedStatus = {
  mode: 'DISABLED' | CryptoMarketFeed['mode']
  message: string
  refreshedAt?: string
  nextRefreshAt?: string
  refreshMode?: CryptoMarketFeed['policy']['refreshMode']
  callsPerRefresh?: number
  warnings: string[]
}

const LIVE_CRYPTO_ENABLED = import.meta.env.VITE_ENABLE_LIVE_CRYPTO === 'true'
const DAY_MS = 86_400_000

function cryptoApiMarketToMarket(apiMarket: CryptoGeneratedMarket, feed: CryptoMarketFeed, existing?: Market): Market {
  const mappedOnChainId = existing?.onChainId ?? resolveOnChainMarketId(apiMarket.uiMarketId) ?? undefined
  return {
    id: apiMarket.uiMarketId,
    onChainId: mappedOnChainId,
    question: apiMarket.question,
    category: 'Crypto',
    source: apiMarket.source,
    lockLabel: apiMarket.lockLabel,
    state: existing?.state ?? 'OPEN',
    yesProbability: apiMarket.yesProbability,
    volume: apiMarket.volume,
    liquidity: apiMarket.liquidity,
    qualityScore: apiMarket.qualityScore,
    aiProbability: apiMarket.aiProbability,
    creator: existing?.creator ?? 'CMC price feed',
    tags: Array.from(new Set([...(apiMarket.tags ?? []), ...(existing?.tags ?? [])])).slice(0, 8),
    league: 'Crypto',
    eventLabel: apiMarket.eventLabel,
    isLive: true,
    featured: apiMarket.featured,
    boosted: existing?.boosted,
    closingSoon: apiMarket.metric === 'DAY_HIGH' || apiMarket.metric === 'DAY_LOW' || apiMarket.metric === 'MARKET_CAP' || existing?.closingSoon,
    trend: apiMarket.trend,
    resolvedOutcome: existing?.resolvedOutcome,
    poolReady: existing?.poolReady ?? Boolean(mappedOnChainId),
    sourceMode: mappedOnChainId || existing?.sourceMode === 'ON_CHAIN' ? 'ON_CHAIN' : 'LIVE_API',
    txHash: existing?.txHash,
    cryptoSymbol: apiMarket.symbol,
    cryptoMetric: apiMarket.metric,
    cryptoTarget: apiMarket.target,
    cryptoCurrent: apiMarket.current,
    cryptoUnit: apiMarket.unit,
    cryptoPriceUsd: apiMarket.crypto.priceUsd,
    cryptoDayHighUsd: apiMarket.crypto.dayHighUsd,
    cryptoDayLowUsd: apiMarket.crypto.dayLowUsd,
    cryptoVolume24hUsd: apiMarket.crypto.volume24hUsd,
    cryptoMarketCapUsd: apiMarket.crypto.marketCapUsd,
    cryptoPercentChange24h: apiMarket.crypto.percentChange24h,
    cryptoVolumeChange24h: apiMarket.crypto.volumeChange24h,
    cryptoQuoteUpdatedAt: apiMarket.crypto.lastUpdated,
    cryptoNextRefreshAt: feed.nextRefreshAt,
    cryptoHighLowSource: apiMarket.crypto.highLowSource,
    cryptoRationale: apiMarket.rationale,
    trades: [
      `${feed.mode === 'LIVE_API' ? 'CMC live' : feed.mode === 'CACHE' ? 'CMC cache' : 'Demo feed'} refreshed ${apiMarket.symbol} ${apiMarket.metric.replaceAll('_', ' ').toLowerCase()}`,
      apiMarket.rationale,
      ...(existing?.trades ?? []),
    ].slice(0, 5),
  }
}

function conservativeAmmMinShares(stakeMON: number, projectedShareEstimate: number) {
  const uiQuoteGuard = projectedShareEstimate * 0.95
  const constantProductGuard = stakeMON * 0.15
  return Number(Math.max(0.000001, Math.min(uiQuoteGuard, constantProductGuard)).toFixed(6))
}

const AppContext = createContext<AppContextType | null>(null)

export function useAppStore() {
  const [view, setView] = useState<View>('agents')
  const [xp, setXp] = useState(0)
  const [level, setLevel] = useState(1)
  const [streak, setStreak] = useState(0)
  const [markets, setMarkets] = useState(initialMarkets)
  const [selectedId, setSelectedId] = useState(101)
  const [outcome, setOutcome] = useState<Outcome>('YES')
  const [stake, setStake] = useState(1)
  const [search, setSearch] = useState('')
  const [positions, setPositions] = useState<Position[]>([])
  const [parlayLegs, setParlayLegs] = useState<ParlayLeg[]>([])
  const [parlays, setParlays] = useState<Parlay[]>([])
  const [orders, setOrders] = useState<Order[]>(initialOrders)
  const [orderType, setOrderType] = useState<OrderType>('GTC')
  const [limitPrice, setLimitPrice] = useState(0.55)
  const [riskMode, setRiskMode] = useState<RiskMode>('Balanced')
  const [stressShock, setStressShock] = useState(18)
  const [hedgeRatio, setHedgeRatio] = useState(35)
  const [riskProposals, setRiskProposals] = useState<RiskProposal[]>([
    { id: 1, action: 'Reduce correlated sports exposure', market: 'India wins / runs over', value: 1.2, riskScore: 42, drawdown: 8.4, correlation: 68, var95: 2.6, status: 'NEEDS_SIGNATURE' },
  ])
  const [dailyLimit, setDailyLimit] = useState(8)
  const [spentToday, setSpentToday] = useState(0)
  const [pointsOnly, setPointsOnly] = useState(false)
  const [cooldown, setCooldown] = useState(false)
  const [selfExcluded, setSelfExcluded] = useState(false)
  const [aiTier, setAiTier] = useState('Free')
  const [routeQuote, setRouteQuote] = useState<SmartRouteQuote | null>(null)
  const [cashoutAdvice, setCashoutAdvice] = useState<AiAdvice | null>(null)
  const [hedgeAdvice, setHedgeAdvice] = useState<AiAdvice | null>(null)
  const [forecasts, setForecasts] = useState<ForecastEntry[]>([
    { id: 1, agent: 'Alpha Ensemble', probability: 0.57, brierScore: 0.084, badge: 'CALIBRATED', status: 'SCORED' },
    { id: 2, agent: 'Monad Scout', probability: 0.61, brierScore: 0.112, badge: 'ORACLE_AWARE', status: 'REVEALED' },
    { id: 3, agent: 'Risk Lens', probability: 0.54, brierScore: 0.091, badge: 'LOW_VARIANCE', status: 'COMMITTED' },
  ])
  const [oracleCases, setOracleCases] = useState<OracleCase[]>(markets.map((market) => ({ marketId: market.id, state: 'READY', bond: 0.1 })))
  const [vaultState, setVaultState] = useState<VaultState>({ idle: 16, deployed: 84, queued: 4, shares: 20, pendingWithdrawal: 4, allocations: { 101: 36, 102: 30, 103: 18 } })
  const [rebalanceAdvice, setRebalanceAdvice] = useState<AiAdvice | null>(null)
  const [creatorQuestion, setCreatorQuestion] = useState('Will Monad testnet process more than 1,000 ArenaX demo actions before Sunday 20:00 UTC?')
  const [creatorQuality, setCreatorQuality] = useState<AiAdvice | null>(null)
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([
    { id: 1, agent: 'Market Quality Agent', title: 'Seed market audit', output: 'All demo markets are objective, time-bound, and testnet-only.', status: 'done' },
    { id: 2, agent: 'Monad Tx Monitor', title: 'Finality policy', output: `Receipts show as proposed, then final after about ${MONAD_FINALITY_MS} ms.`, status: 'done' },
  ])
  const [txTimeline, setTxTimeline] = useState<TxStep[]>([
    { label: 'Ready', state: 'ready' },
    { label: 'Wallet signature', state: 'idle' },
    { label: 'Monad proposed', state: 'idle' },
    { label: 'Finalized', state: 'idle' },
  ])
  const [monadStatus, setMonadStatus] = useState<MonadStatus | null>(null)
  const [monadError, setMonadError] = useState<string | null>(null)
  const [wallet, setWallet] = useState<WalletState>({ address: null, balanceMON: '0', chainId: null, connected: false, error: null })
  const [heartbeatTx, setHeartbeatTx] = useState<`0x${string}` | null>(null)
  const [lastContractTx, setLastContractTx] = useState<`0x${string}` | null>(null)
  const [indexedStatus, setIndexedStatus] = useState(initialIndexedStatus)
  const [indexedActivity, setIndexedActivity] = useState<IndexedProtocolEvent[]>([])
  const [cryptoStatus, setCryptoStatus] = useState<CryptoFeedStatus>({
    mode: LIVE_CRYPTO_ENABLED ? 'FALLBACK' : 'DISABLED',
    message: LIVE_CRYPTO_ENABLED ? 'Waiting for CoinMarketCap market feed.' : 'Live CMC feed disabled. Set VITE_ENABLE_LIVE_CRYPTO=true to enable.',
    warnings: [],
  })
  const [creatorRevenueMON, setCreatorRevenueMON] = useState(0)
  const [notifications, setNotifications] = useState([`Mode: ${ARENAX_APP_MODE}`, REAL_MONEY_ENABLED ? 'Configuration warning: real-money flag is true' : 'No real-money mode is enabled'])
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [paletteQuery, setPaletteQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [watchlist, setWatchlist] = useState<number[]>([101])
  const [marketFeedMode, setMarketFeedMode] = useState<MarketFeedMode>('Trending')
  const contractRuntime = getContractRuntimeSummary()

  const refreshIndexedData = useCallback(async () => {
    const { dashboard, status } = await fetchIndexedDashboard(wallet.address)
    setIndexedStatus(status)
    if (!dashboard) return

    setMarkets((current) => {
      const next = [...current]
      for (const indexedMarket of dashboard.markets) {
        const onChainId = Number(indexedMarket.id)
        const uiId = indexedUiMarketId(onChainId)
        const existingIndex = next.findIndex((market) => market.id === uiId || market.onChainId === onChainId)
        const existing = existingIndex >= 0 ? next[existingIndex] : null
        const yesProbability = Number(indexedMarketProbability(indexedMarket, existing?.yesProbability ?? 0.5).toFixed(4))
        const normalizedState = indexedMarket.state === 'RESOLVED' ? 'RESOLVED' : indexedMarket.state === 'VOIDED' ? 'VOIDED' : 'OPEN'
        const resolvedOutcome = indexedMarket.resolvedOutcome === '0' ? 'YES' : indexedMarket.resolvedOutcome === '1' ? 'NO' : undefined
        const hydrated: Market = {
          id: uiId,
          onChainId,
          question: indexedMarket.question,
          category: indexedMarket.category,
          source: 'Ponder indexed · Monad testnet',
          lockLabel: existing?.lockLabel ?? 'Indexed',
          state: normalizedState,
          yesProbability,
          volume: indexedWeiToMON(indexedMarket.volumeWei),
          liquidity: indexedWeiToMON(indexedMarket.liquidityWei),
          qualityScore: existing?.qualityScore ?? 92,
          aiProbability: existing?.aiProbability ?? yesProbability,
          creator: indexedMarket.creator,
          tags: existing?.tags ?? ['on-chain', 'ponder indexed', 'monad'],
          league: existing?.league,
          eventLabel: existing?.eventLabel ?? 'Monad indexed',
          isLive: existing?.isLive,
          featured: existing?.featured ?? true,
          boosted: existing?.boosted,
          closingSoon: existing?.closingSoon,
          trend: existing?.trend ?? 0,
          resolvedOutcome,
          poolReady: indexedWeiToMON(indexedMarket.liquidityWei) > 0,
          sourceMode: 'ON_CHAIN',
          trades: [`Ponder synced market #${onChainId}`, ...(existing?.trades ?? [])].slice(0, 5),
        }
        if (existingIndex >= 0) next[existingIndex] = hydrated
        else next.push(hydrated)
      }
      return next
    })

    if (dashboard.oracleCases.length > 0) {
      setOracleCases((current) => {
        const next = [...current]
        for (const indexedCase of dashboard.oracleCases) {
          const marketId = indexedUiMarketId(Number(indexedCase.marketId))
          const existingIndex = next.findIndex((item) => item.marketId === marketId)
          const state = ['READY', 'COMMITTED', 'REVEALED', 'CHALLENGED', 'FINALIZED'].includes(indexedCase.state)
            ? indexedCase.state as OracleCase['state']
            : 'READY'
          const hydrated: OracleCase = {
            marketId,
            state,
            outcome: indexedCase.outcomeIndex === '1' ? 'NO' : 'YES',
            bond: indexedWeiToMON(indexedCase.bondWei),
            challenger: indexedCase.challenger,
            source: 'ON_CHAIN',
          }
          if (existingIndex >= 0) next[existingIndex] = { ...next[existingIndex], ...hydrated }
          else next.push(hydrated)
        }
        return next
      })
    }

    const indexedAllocations = Object.fromEntries(dashboard.vault.allocations.map((allocation) => [
      indexedUiMarketId(Number(allocation.marketId)),
      indexedWeiToMON(allocation.deployedAssetsWei),
    ]))
    if (dashboard.vault.allocations.length > 0 || dashboard.vault.depositedWei !== '0') {
      const deposited = indexedWeiToMON(dashboard.vault.depositedWei)
      const paid = indexedWeiToMON(dashboard.vault.paidWei)
      const queued = indexedWeiToMON(dashboard.vault.queuedOutstandingWei)
      const deployed = Object.values(indexedAllocations).reduce((total, value) => total + value, 0)
      setVaultState((current) => ({
        ...current,
        idle: Math.max(0, deposited - paid - deployed),
        deployed,
        queued,
        pendingWithdrawal: queued,
        allocations: { ...current.allocations, ...indexedAllocations },
      }))
    }

    if (dashboard.portfolio.parlays.length > 0) {
      setParlays((current) => current.map((parlay) => {
        const indexedParlay = dashboard.portfolio.parlays.find((item) => Number(item.id) === parlay.onChainId)
        if (!indexedParlay) return parlay
        const status = indexedParlay.status === 'CASHED_OUT' || indexedParlay.status === 'CLAIMED' || indexedParlay.status === 'LOST'
          ? indexedParlay.status
          : indexedParlay.status === 'WON' || indexedParlay.status === 'PARTIALLY_VOIDED'
            ? 'WON'
            : 'OPEN'
        return { ...parlay, status, source: 'ON_CHAIN' }
      }))
    }

    if (dashboard.forecasts.length > 0) {
      const indexedForecasts: ForecastEntry[] = dashboard.forecasts.map((forecast, index) => ({
        id: 10_000 + index,
        agent: shortAddress(forecast.agent),
        marketId: indexedUiMarketId(Number(forecast.marketId)),
        probability: Number(forecast.probabilityYes1e18) / 1e18,
        brierScore: 0,
        badge: 'PONDER_INDEXED',
        status: forecast.status === 'SCORED' || forecast.status === 'REVEALED' ? forecast.status : 'COMMITTED',
        source: 'ON_CHAIN',
      }))
      setForecasts((current) => [...indexedForecasts, ...current.filter((forecast) => forecast.source !== 'ON_CHAIN')].slice(0, 16))
    }

    setCreatorRevenueMON(indexedWeiToMON(dashboard.creatorRevenue.claimableWei))
    setIndexedActivity(dashboard.activity)
  }, [wallet.address])

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const status = await fetchMonadStatus()
        if (!cancelled) {
          setMonadStatus(status)
          setMonadError(null)
        }
      } catch (error) {
        if (!cancelled) setMonadError(error instanceof Error ? error.message : 'Unable to reach Monad RPC')
      }
    }
    refresh()
    const interval = window.setInterval(refresh, 4000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(refreshIndexedData, 0)
    const interval = window.setInterval(refreshIndexedData, 12_000)
    return () => {
      window.clearTimeout(initialRefresh)
      window.clearInterval(interval)
    }
  }, [refreshIndexedData])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((current) => !current)
      }
      if (event.key === 'Escape') setPaletteOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectedMarket = markets.find((market) => market.id === selectedId) ?? markets[0]
  const selectedOnChainMarketId = selectedMarket.onChainId ?? resolveOnChainMarketId(selectedMarket.id)
  const selectedProbability = outcome === 'YES' ? selectedMarket.yesProbability : 1 - selectedMarket.yesProbability
  const selectedOdds = odds(selectedProbability)
  const projectedShares = Number((stake / selectedProbability).toFixed(2))
  const categories = ['All', ...new Set(markets.map((market) => market.category))]
  const filteredMarkets = markets.filter((market) =>
    (activeCategory === 'All' || market.category === activeCategory)
    && ((marketFeedMode === 'Trending' && (market.featured || Math.abs(market.trend ?? 0) >= 5))
      || (marketFeedMode === 'Live' && market.isLive)
      || (marketFeedMode === 'Closing soon' && market.closingSoon)
      || (marketFeedMode === 'New' && market.id >= 106))
    && `${market.question} ${market.category} ${market.tags.join(' ')}`.toLowerCase().includes(search.toLowerCase()),
  )
  const watchedMarkets = markets.filter((market) => watchlist.includes(market.id))
  const combinedOdds = parlayLegs.reduce((total, leg) => Number((total * leg.odds).toFixed(2)), 1)
  const impliedProbability = combinedOdds > 1 ? 1 / combinedOdds : 0
  const claimable = positions.filter((position) => position.status === 'CLAIMABLE')
  const netExposure = positions.reduce((sum, position) => sum + (position.status === 'LOST' ? 0 : position.stake), 0)
  const openOrderExposure = orders.filter((order) => order.status === 'OPEN' || order.status === 'PARTIAL').reduce((sum, order) => sum + order.size - order.filled, 0)
  const protocolLiquidity = markets.reduce((sum, market) => sum + market.liquidity, 0)
  const latestCreatorMarket = [...markets].reverse().find((market) => market.category === 'Creator') ?? null
  const limitRemaining = Math.max(0, dailyLimit - spentToday)
  const unmappedParlayLeg = parlayLegs.find((leg) => !resolveOnChainMarketId(leg.marketId))
  const tradeBlockReason = selectedMarket.state !== 'OPEN'
    ? 'Market is not open for trading.'
    : pointsOnly
      ? 'Points-only mode blocks MON transactions.'
      : cooldown
        ? 'Responsible limit cooldown is active.'
        : selfExcluded
          ? 'Self-exclusion is active.'
          : spentToday + stake > dailyLimit
            ? 'Daily responsible limit reached.'
            : REAL_TESTNET_TRANSACTIONS_REQUIRED && !wallet.connected
              ? 'Connect a Monad testnet wallet before placing real MON transactions.'
              : REAL_TESTNET_TRANSACTIONS_REQUIRED && !selectedOnChainMarketId
                ? `Market #${selectedMarket.id} is not mapped to a deployed Monad market yet. Create or seed it on-chain first.`
                : null
  const canTrade = !tradeBlockReason
  const parlayBlockReason = parlayLegs.length < 2
    ? 'Add at least two live legs before minting a parlay NFT.'
    : pointsOnly
      ? 'Points-only mode blocks MON parlay minting.'
      : cooldown
        ? 'Responsible limit cooldown is active.'
        : selfExcluded
          ? 'Self-exclusion is active.'
          : spentToday + stake > dailyLimit
            ? 'Daily responsible limit reached.'
            : REAL_TESTNET_TRANSACTIONS_REQUIRED && !wallet.connected
              ? 'Connect a Monad testnet wallet before minting the parlay NFT.'
              : REAL_TESTNET_TRANSACTIONS_REQUIRED && contractRuntime.configured < 18
                ? 'Monad testnet contracts are not fully configured in the frontend.'
                : REAL_TESTNET_TRANSACTIONS_REQUIRED && unmappedParlayLeg
                  ? `Leg #${unmappedParlayLeg.marketId} is not mapped to a deployed Monad market yet.`
                  : null
  const canMintParlay = !parlayBlockReason

  const notify = useCallback((message: string) => {
    setNotifications((current) => [message, ...current].slice(0, 5))
  }, [])

  const awardXP = useCallback((amount: number, reason: string) => {
    setXp((currentXp) => {
      const nextXp = currentXp + amount
      const nextLevel = Math.floor(nextXp / 1000) + 1
      if (nextLevel > Math.floor(currentXp / 1000) + 1) {
        setLevel(nextLevel)
        notify(`🎉 Level Up! You are now Level ${nextLevel}`)
      }
      return nextXp
    })
    notify(`+${amount} XP: ${reason}`)
  }, [notify])

  useEffect(() => {
    const provider = window.ethereum
    if (!provider?.on) return undefined

    let cancelled = false

    async function syncWallet(reason?: string) {
      try {
        const nextWallet = await readConnectedMonadWallet()
        if (cancelled) return
        setWallet(nextWallet)
        if (!reason) return
        if (nextWallet.address && nextWallet.connected) {
          notify(`${reason}: ${shortAddress(nextWallet.address)} is on Monad Testnet`)
        } else if (nextWallet.address) {
          notify(`${reason}: switch wallet to Monad Testnet ${MONAD_TESTNET.id}`)
        } else {
          notify('Wallet disconnected from ArenaX')
        }
      } catch (error) {
        if (cancelled) return
        const detail = readErrorDetail(error)
        setWallet((current) => ({ ...current, connected: false, error: detail }))
        notify(humanizeTransactionError('Wallet sync', error))
      }
    }

    const onAccountsChanged = () => void syncWallet('Wallet account changed')
    const onChainChanged = () => void syncWallet('Wallet network changed')
    const onDisconnect = () => {
      setWallet({ address: null, balanceMON: '0', chainId: null, connected: false, error: null })
      notify('Wallet disconnected from ArenaX')
    }

    void syncWallet()
    provider.on('accountsChanged', onAccountsChanged)
    provider.on('chainChanged', onChainChanged)
    provider.on('disconnect', onDisconnect)

    return () => {
      cancelled = true
      provider.removeListener?.('accountsChanged', onAccountsChanged)
      provider.removeListener?.('chainChanged', onChainChanged)
      provider.removeListener?.('disconnect', onDisconnect)
    }
  }, [notify])

  const refreshCryptoMarkets = useCallback(async () => {
    if (!LIVE_CRYPTO_ENABLED) return null
    const feed = await fetchCryptoMarketFeed()
    const summary = feed.mode === 'LIVE_API'
      ? `CMC live feed refreshed ${feed.markets.length} crypto markets.`
      : feed.mode === 'CACHE'
        ? `CMC cache active. Next refresh ${new Date(feed.nextRefreshAt).toLocaleString()}.`
        : 'CMC fallback active. Configure the matcher CMC key for live crypto markets.'

    setCryptoStatus({
      mode: feed.mode,
      message: summary,
      refreshedAt: feed.refreshedAt,
      nextRefreshAt: feed.nextRefreshAt,
      refreshMode: feed.policy.refreshMode,
      callsPerRefresh: feed.policy.callsPerRefresh,
      warnings: feed.warnings,
    })

    if (feed.markets.length > 0) {
      const hydratedIds = new Set(feed.markets.map((market) => market.uiMarketId))
      setMarkets((current) => {
        const next = current.filter((market) => market.sourceMode !== 'LIVE_API' || hydratedIds.has(market.id))
        for (const apiMarket of feed.markets) {
          const existingIndex = next.findIndex((market) => market.id === apiMarket.uiMarketId)
          const existing = existingIndex >= 0 ? next[existingIndex] : undefined
          const hydrated = cryptoApiMarketToMarket(apiMarket, feed, existing)
          if (existingIndex >= 0) next[existingIndex] = hydrated
          else next.push(hydrated)
        }
        return next
      })
      setNotifications((current) => {
        const nextMessage = feed.mode === 'LIVE_API' ? 'CMC live crypto feed refreshed.' : feed.mode === 'CACHE' ? 'CMC cached crypto feed loaded.' : 'CMC demo crypto feed loaded.'
        if (current[0] === nextMessage) return current
        return [nextMessage, ...current].slice(0, 5)
      })
    }
    return feed
  }, [])

  useEffect(() => {
    if (!LIVE_CRYPTO_ENABLED) return undefined
    let cancelled = false
    let timer: number | undefined

    async function refreshAndSchedule() {
      const feed = await refreshCryptoMarkets()
      if (cancelled) return
      const nextRefreshAt = feed?.nextRefreshAt ? Date.parse(feed.nextRefreshAt) : Date.now() + DAY_MS
      const delay = Math.max(60_000, Math.min(DAY_MS, nextRefreshAt - Date.now() + 5_000))
      timer = window.setTimeout(refreshAndSchedule, delay)
    }

    refreshAndSchedule()
    return () => {
      cancelled = true
      if (timer) window.clearTimeout(timer)
    }
  }, [refreshCryptoMarkets])

  function transactionProgress(action: string) {
    return (stage: ContractProgress, hash?: `0x${string}`) => {
      if (hash) setLastContractTx(hash)
      setTxTimeline([
        { label: 'Wallet signature', state: stage === 'AWAITING_SIGNATURE' ? 'active' : 'done' },
        { label: `${action} proposed`, state: stage === 'PROPOSED' ? 'active' : stage === 'FINALIZED' ? 'done' : 'idle' },
        { label: 'Two-block finality', state: stage === 'FINALIZED' ? 'done' : 'idle' },
        { label: 'Indexer ready', state: stage === 'FINALIZED' ? 'active' : 'idle' },
      ])
    }
  }

  function demoTimeline(action: string) {
    setTxTimeline([
      { label: 'Demo fallback', state: 'done' },
      { label: `${action} simulated`, state: 'done' },
      { label: 'Monad signing optional', state: 'idle' },
      { label: 'Configure deployment map', state: 'idle' },
    ])
  }

  function notifyWriteError(action: string, error: unknown) {
    notify(humanizeTransactionError(action, error))
    setTxTimeline([
      { label: 'Wallet signature', state: 'done' },
      { label: `${action} blocked safely`, state: 'active' },
      { label: 'No local mutation', state: 'ready' },
      { label: 'Review guidance', state: 'idle' },
    ])
  }

  function closePalette() {
    setPaletteOpen(false)
    setPaletteQuery('')
  }

  function openPaletteView(nextView: View) {
    setView(nextView)
    closePalette()
  }

  function openPaletteMarket(marketId: number) {
    setSelectedId(marketId)
    setView('arena')
    closePalette()
  }

  function toggleWatchlist(marketId: number) {
    const isWatched = watchlist.includes(marketId)
    setWatchlist((current) => current.includes(marketId)
      ? current.filter((id) => id !== marketId)
      : [marketId, ...current])
    notify(`${isWatched ? 'Removed' : 'Added'} market #${marketId} ${isWatched ? 'from' : 'to'} watchlist`)
  }

  function openWatchedMarket(marketId: number) {
    setSelectedId(marketId)
    setView('arena')
  }

  function quickPick(marketId: number, pick: Outcome) {
    setSelectedId(marketId)
    setOutcome(pick)
    setView('arena')
    notify(`Loaded ${pick} quick pick for #${marketId}. Review the testnet ticket before signing.`)
  }

  async function buyOutcome() {
    if (!canTrade) return
    try {
      const result = await writeAmmBuy({
        owner: wallet.address,
        uiMarketId: selectedMarket.id,
        onChainMarketId: selectedMarket.onChainId,
        outcome,
        stakeMON: stake,
        minSharesOut: conservativeAmmMinShares(stake, projectedShares),
        onProgress: transactionProgress('AMM buy'),
      })
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('AMM buy')
      const pressure = Math.min(0.11, stake * 0.018)
      setMarkets((current) =>
        current.map((market) => {
          if (market.id !== selectedMarket.id) return market
          const yesProbability = outcome === 'YES' ? Math.min(0.88, market.yesProbability + pressure) : Math.max(0.12, market.yesProbability - pressure)
          return {
            ...market,
            yesProbability: Number(yesProbability.toFixed(2)),
            volume: market.volume + stake,
            trades: [`${result.mode === 'ON_CHAIN' ? 'Monad wallet' : 'Demo wallet'} bought ${outcome} for ${formatMON(stake)}`, ...market.trades].slice(0, 5),
          }
        }),
      )
      setPositions((current) => [{ id: current.length + 1, marketId: selectedMarket.id, outcome, stake, shares: projectedShares, status: 'OPEN', source: result.mode, txHash: result.hash }, ...current])
      setSpentToday((current) => Number((current + stake).toFixed(2)))
      notify(result.message)
    } catch (error) {
      notifyWriteError('AMM buy', error)
    }
  }

  function addLeg() {
    if (parlayLegs.some((leg) => leg.marketId === selectedMarket.id) || parlayLegs.length >= 5) return
    setParlayLegs((current) => [
      ...current,
      { marketId: selectedMarket.id, outcome, odds: selectedOdds, category: selectedMarket.category, question: selectedMarket.question },
    ])
    notify(`Added ${outcome} leg from #${selectedMarket.id}`)
  }

  async function mintParlay() {
    if (!canMintParlay) {
      if (parlayBlockReason) notify(parlayBlockReason)
      return
    }
    const legs = parlayLegs
    try {
      const result = await writeCreateParlay({
        owner: wallet.address,
        legs,
        stakeMON: stake,
        maxPayoutMON: stake * combinedOdds * 1.2,
        onProgress: transactionProgress('Parlay mint'),
      })
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('Parlay mint')
      setParlays((current) => [{ id: result.onChainId ?? current.length + 1, onChainId: result.onChainId, legs, stake, combinedOdds, status: 'OPEN', source: result.mode, txHash: result.hash }, ...current])
      setSpentToday((current) => Number((current + stake).toFixed(2)))
      setParlayLegs([])
      notify(result.message)
    } catch (error) {
      notifyWriteError('Parlay mint', error)
    }
  }

  async function quoteParlayCashout(parlayId: number) {
    const parlay = parlays.find((item) => item.id === parlayId)
    if (!parlay || parlay.status !== 'OPEN') return
    if (REAL_TESTNET_TRANSACTIONS_REQUIRED && !parlay.onChainId) {
      notify(`Parlay #${parlayId} is local-only. Mint a real Monad parlay before requesting cashout.`)
      return
    }
    const liveProbability = parlay.legs.reduce((total, leg) => {
      const market = markets.find((item) => item.id === leg.marketId)
      if (!market) return total
      const probability = leg.outcome === 'YES' ? market.yesProbability : 1 - market.yesProbability
      return total * probability
    }, 1)
    let cashoutQuote = Number((parlay.stake * parlay.combinedOdds * liveProbability * 0.94).toFixed(2))
    if (parlay.onChainId) {
      try {
        cashoutQuote = await readParlayCashout(parlay.onChainId) ?? cashoutQuote
      } catch (error) {
        notify(error instanceof Error ? `Contract quote unavailable: ${error.message.split('\n')[0]}` : 'Contract quote unavailable; using deterministic preview.')
      }
    }
    setParlays((current) => current.map((item) => item.id === parlayId ? { ...item, cashoutQuote, quoteExpiresAt: Date.now() + 30_000 } : item))
    setCashoutAdvice(await requestAi('parlay-risk', { legsCount: parlay.legs.length, liveProbability, stake: parlay.stake }))
    notify(`Cashout quote ready for parlay #${parlayId}`)
  }

  async function proposeHedge(parlayId: number) {
    const parlay = parlays.find((item) => item.id === parlayId)
    if (!parlay) return
    setHedgeAdvice(await requestAi('hedge', { parlayId, legsCount: parlay.legs.length, stake: parlay.stake }))
    notify(`AI hedge proposal ready for parlay #${parlayId}`)
  }

  async function cashoutParlay(parlayId: number) {
    const parlay = parlays.find((item) => item.id === parlayId)
    if (!parlay?.cashoutQuote) return
    try {
      const result = parlay.onChainId
        ? await writeParlayCashout({ owner: wallet.address, parlayId: parlay.onChainId, minPayoutMON: parlay.cashoutQuote * 0.98, onProgress: transactionProgress('Parlay cashout') })
        : localFallbackResult(`Demo fallback: parlay #${parlayId} has no on-chain ID. Mint a real Monad parlay before cashout.`)
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('Parlay cashout')
      setParlays((current) => current.map((item) => item.id === parlayId ? { ...item, status: 'CASHED_OUT', txHash: result.hash ?? item.txHash } : item))
      notify(result.message)
    } catch (error) {
      notifyWriteError('Parlay cashout', error)
    }
  }

  async function claimAllPositions() {
    for (const position of claimable) {
      const market = markets.find((item) => item.id === position.marketId)
      try {
        const result = position.source === 'ON_CHAIN'
          ? await writeAmmRedeem({ owner: wallet.address, uiMarketId: position.marketId, onChainMarketId: market?.onChainId, onProgress: transactionProgress('AMM payout') })
          : localFallbackResult(`Demo fallback: market #${position.marketId} position was not created on-chain, so payout is local only.`)
        if (result.mode === 'DEMO_FALLBACK') demoTimeline('AMM payout')
        setPositions((current) => current.map((item) => item.id === position.id ? { ...item, status: 'CLAIMED', txHash: result.hash ?? item.txHash } : item))
        notify(result.message)
      } catch (error) {
        notifyWriteError(`Market #${position.marketId} payout`, error)
      }
    }
  }

  async function settleParlay(parlayId: number) {
    const parlay = parlays.find((item) => item.id === parlayId)
    if (!parlay || parlay.status !== 'OPEN') return
    const legMarkets = parlay.legs.map((leg) => markets.find((market) => market.id === leg.marketId))
    if (legMarkets.some((market) => market?.state !== 'RESOLVED')) {
      notify(`Parlay #${parlayId} cannot settle until every leg is resolved.`)
      return
    }
    try {
      const result = parlay.onChainId
        ? await writeSettleParlay({ owner: wallet.address, parlayId: parlay.onChainId, onProgress: transactionProgress('Parlay settle') })
        : localFallbackResult(`Demo fallback: parlay #${parlayId} has no on-chain ID. Mint a real Monad parlay before settlement.`)
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('Parlay settle')
      const won = parlay.legs.every((leg) => markets.find((market) => market.id === leg.marketId)?.resolvedOutcome === leg.outcome)
      setParlays((current) => current.map((item) => item.id === parlayId ? { ...item, status: won ? 'WON' : 'LOST', txHash: result.hash ?? item.txHash } : item))
      notify(result.message)
    } catch (error) {
      notifyWriteError('Parlay settle', error)
    }
  }

  async function claimParlay(parlayId: number) {
    const parlay = parlays.find((item) => item.id === parlayId)
    if (!parlay || parlay.status !== 'WON') return
    try {
      const result = parlay.onChainId
        ? await writeClaimParlay({ owner: wallet.address, parlayId: parlay.onChainId, onProgress: transactionProgress('Parlay payout') })
        : localFallbackResult(`Demo fallback: parlay NFT #${parlayId} has no on-chain ID. Claim a real Monad parlay only.`)
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('Parlay payout')
      setParlays((current) => current.map((item) => item.id === parlayId ? { ...item, status: 'CLAIMED', txHash: result.hash ?? item.txHash } : item))
      notify(result.message)
    } catch (error) {
      notifyWriteError('Parlay payout', error)
    }
  }

  async function previewSmartRoute(side: 'BACK' | 'LAY') {
    setRouteQuote(await quoteSmartRoute({ marketId: selectedMarket.id, outcomeIndex: outcome === 'YES' ? 0 : 1, side, size: stake, maxSlippageBps: 300 }))
    notify(`Smart router preview ready for ${side} ${outcome}`)
  }

  function placeOrder(side: 'BACK' | 'LAY') {
    const nextOrder: Order = {
      id: orders.length + 1,
      side,
      type: orderType,
      market: selectedMarket.question.slice(0, 28),
      outcome,
      odds: Number((1 / limitPrice).toFixed(2)),
      size: stake,
      filled: orderType === 'IOC' ? stake : 0,
      queueAhead: orderType === 'POST_ONLY' ? 2.4 : 0.8,
      status: orderType === 'IOC' ? 'FILLED' : 'OPEN',
    }
    setOrders((current) => [nextOrder, ...current])
    setTxTimeline([
      { label: 'EIP-712 signed', state: 'done' },
      { label: 'Matcher accepted', state: 'done' },
      { label: 'Monad settlement', state: orderType === 'IOC' ? 'active' : 'idle' },
      { label: 'Finalized', state: 'idle' },
    ])
    notify(`Signed ${side} ${orderType} order`)
  }

  function cancelOrder(orderId: number) {
    setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status: 'CANCELED' } : order)))
    notify(`Canceled order #${orderId}`)
  }

  function resolveMarket(marketId: number, result: Outcome) {
    setMarkets((current) =>
      current.map((market) => (market.id === marketId ? { ...market, state: 'RESOLVED', resolvedOutcome: result, trades: [`Oracle resolved ${result}`, ...market.trades].slice(0, 5) } : market)),
    )
    setPositions((current) =>
      current.map((position) => (position.marketId === marketId && position.status === 'OPEN' ? { ...position, status: position.outcome === result ? 'CLAIMABLE' : 'LOST' } : position)),
    )
    notify(`Oracle finalized #${marketId} as ${result}`)
  }

  function runRiskGovernor() {
    const exposure = Math.max(1, netExposure + openOrderExposure)
    const drawdown = Number(Math.min(32, exposure * (18 / 12)).toFixed(1))
    const correlation = Number(Math.min(94, 28 + stressShock * 1.4).toFixed(1))
    const var95 = Number(Math.max(0.4, exposure * stressShock * 0.055).toFixed(2))
    const riskScore = Math.round(Math.min(100, drawdown * 1.8 + correlation * 0.55))
    const status: RiskProposal['status'] = riskScore > 78 ? 'BLOCKED' : 'NEEDS_SIGNATURE'
    const action = riskMode === 'Defensive' ? 'Withdraw LP depth and hedge' : riskMode === 'Growth' ? 'Add capped maker depth' : 'Rebalance maker orders'
    const rankedAgents = [...getAllAgents()].sort((a, b) => b.reputationScore - a.reputationScore)
    const proposer = rankedAgents[riskProposals.length % Math.max(1, Math.min(4, rankedAgents.length))]
    setRiskProposals((current) => [
      { id: current.length + 1, action, market: selectedMarket.question.slice(0, 34), value: Number((Math.max(0.5, exposure * hedgeRatio * 0.01)).toFixed(2)), riskScore, drawdown, correlation, var95, status, proposerAgentId: proposer?.id, agentConfidence: Math.max(52, Math.min(94, Math.round(100 - riskScore * 0.42))) },
      ...current,
    ])
    if (proposer) emitAgentEvent({ agentId: proposer.id, agentName: proposer.name, type: 'market-created', message: `submitted risk proposal · confidence ${Math.max(52, Math.min(94, Math.round(100 - riskScore * 0.42)))}%` })
    setAgentTasks((current) => [
      { id: current.length + 1, agent: 'Autonomous Risk Governor', title: `${action} simulation`, output: `Stress ${stressShock}% | VaR ${formatMON(var95)} | status ${status}`, status: 'done' as const },
      ...current,
    ].slice(0, 10))
    notify(status === 'BLOCKED' ? 'Risk Governor blocked unsafe action' : 'Risk Governor proposal ready for approval')
  }

  async function runForecastTournament() {
    const advice = await requestAi('forecast', { marketId: selectedMarket.id, question: selectedMarket.question })
    setForecasts((current) => [
      { id: current.length + 1, agent: 'Forecast Agent', probability: Number(advice.probabilityYes ?? 0.57), brierScore: 0.078, badge: 'NEW_COMMIT', status: 'COMMITTED' },
      ...current,
    ])
    setAgentTasks((current) => [{ id: current.length + 1, agent: 'Forecast Agent', title: `Commit-reveal #${selectedMarket.id}`, output: 'Forecast commitment submitted. Reveal remains auditable and scoreable.', status: 'done' as const }, ...current].slice(0, 10))
    notify('Forecast tournament commitment submitted')
  }

  async function advanceOracleCase(marketId: number) {
    const court = oracleCases.find((item) => item.marketId === marketId)
    const market = markets.find((item) => item.id === marketId)
    if (!court || !market || market.state !== 'OPEN' || court.state === 'FINALIZED') return
    const proposedOutcome: Outcome = 'YES'
    try {
      const result = court.state === 'READY'
        ? await writeOracleCommit({ owner: wallet.address, uiMarketId: marketId, onChainMarketId: market.onChainId, outcome: proposedOutcome, bondMON: court.bond, onProgress: transactionProgress('Oracle commit') })
        : court.state === 'COMMITTED'
          ? await writeOracleReveal({ owner: wallet.address, uiMarketId: marketId, onChainMarketId: market.onChainId, outcome: proposedOutcome, onProgress: transactionProgress('Oracle reveal') })
          : court.state === 'REVEALED'
            ? await writeOracleChallenge({ owner: wallet.address, uiMarketId: marketId, onChainMarketId: market.onChainId, outcome: 'NO', bondMON: court.bond, onProgress: transactionProgress('Oracle challenge') })
            : await writeOracleFinalize({ owner: wallet.address, uiMarketId: marketId, onChainMarketId: market.onChainId, outcome: proposedOutcome, challenged: true, onProgress: transactionProgress('Council resolve') })
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('Oracle Court')
      const nextState = court.state === 'READY' ? 'COMMITTED' : court.state === 'COMMITTED' ? 'REVEALED' : court.state === 'REVEALED' ? 'CHALLENGED' : 'FINALIZED'
      setOracleCases((current) => current.map((item) => item.marketId === marketId
        ? { ...item, state: nextState, outcome: proposedOutcome, challenger: nextState === 'CHALLENGED' ? '0xDemoChallenger' : item.challenger, source: result.mode, txHash: result.hash ?? item.txHash }
        : item))
      if (nextState === 'FINALIZED') resolveMarket(marketId, proposedOutcome)
      notify(result.message)
    } catch (error) {
      notifyWriteError('Oracle Court', error)
    }
  }

  async function runLpRebalance() {
    setRebalanceAdvice(await requestAi('lp-rebalance', { idle: vaultState.idle, deployed: vaultState.deployed }))
    notify('LP Rebalancer proposal ready for approval')
  }

  async function depositLpVault() {
    try {
      const result = await writeVaultDeposit({ owner: wallet.address, assetsMON: 2, onProgress: transactionProgress('LP deposit') })
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('LP deposit')
      setVaultState((current) => ({ ...current, idle: current.idle + 2, shares: current.shares + 2 }))
      notify(result.message)
    } catch (error) {
      notifyWriteError('LP deposit', error)
    }
  }

  async function requestLpWithdrawal() {
    if (vaultState.shares < 1) return
    try {
      const result = await writeVaultWithdraw({ owner: wallet.address, sharesMON: 1, onProgress: transactionProgress('LP withdrawal') })
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('LP withdrawal')
      const queued = result.mode === 'DEMO_FALLBACK' || result.withdrawalQueued
      setVaultState((current) => ({
        ...current,
        idle: queued ? current.idle : Math.max(0, current.idle - 1),
        queued: queued ? current.queued + 1 : current.queued,
        shares: current.shares - 1,
        pendingWithdrawal: queued ? current.pendingWithdrawal + 1 : current.pendingWithdrawal,
      }))
      notify(result.message)
    } catch (error) {
      notifyWriteError('LP withdrawal', error)
    }
  }

  async function processLpWithdrawal() {
    if (vaultState.pendingWithdrawal < 1) return
    try {
      const result = await writeVaultProcessWithdrawal({ owner: wallet.address, onProgress: transactionProgress('LP exit') })
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('LP exit')
      setVaultState((current) => ({ ...current, queued: Math.max(0, current.queued - 1), pendingWithdrawal: Math.max(0, current.pendingWithdrawal - 1) }))
      notify(result.message)
    } catch (error) {
      notifyWriteError('LP exit', error)
    }
  }

  async function executeLpRebalance() {
    try {
      const result = await writeVaultRebalance({ owner: wallet.address, fromUiMarketId: 102, toUiMarketId: 101, amountMON: 2, onProgress: transactionProgress('LP rebalance') })
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('LP rebalance')
      setVaultState((current) => ({ ...current, allocations: { ...current.allocations, 101: (current.allocations[101] ?? 0) + 2, 102: Math.max(0, (current.allocations[102] ?? 0) - 2) } }))
      notify(`${result.message} Owner approval is required in live mode.`)
    } catch (error) {
      notifyWriteError('LP rebalance', error)
    }
  }

  async function reviewCreatorMarket() {
    setCreatorQuality(await requestAi('check-market', { question: creatorQuestion, wallet: wallet.address ?? 'demo-wallet' }))
    notify('Creator market quality review complete')
  }

  async function createCreatorMarket() {
    try {
      const result = await writeCreateBinaryMarket({ owner: wallet.address, question: creatorQuestion, category: 'Creator', onProgress: transactionProgress('Creator market') })
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('Creator market')
      setMarkets((current) => [
        ...current,
        {
          id: Math.max(...current.map((market) => market.id)) + 1,
          onChainId: result.onChainId,
          question: creatorQuestion,
          category: 'Creator',
          source: result.mode === 'ON_CHAIN' ? 'MarketFactory.sol · Monad testnet' : 'Creator Studio + Oracle checklist',
          lockLabel: '2d',
          state: 'OPEN',
          yesProbability: 0.5,
          volume: 0,
          liquidity: 0,
          qualityScore: Number(creatorQuality?.qualityScore ?? 91),
          aiProbability: 0.52,
          creator: wallet.address ?? '0xCreator',
          tags: ['creator', 'quality checked', 'testnet'],
          trades: ['Creator Studio drafted market rules', 'Compliance Guard approved testnet wording'],
          poolReady: false,
          sourceMode: result.mode,
          txHash: result.hash,
        },
      ])
      notify(result.message)
    } catch (error) {
      notifyWriteError('Creator market', error)
    }
  }

  async function seedCreatorPool(marketId: number) {
    const market = markets.find((item) => item.id === marketId)
    if (!market || market.poolReady) return
    try {
      const result = market.onChainId
        ? await writeCreateAmmPool({ owner: wallet.address, marketId: market.onChainId, liquidityMON: 5, onProgress: transactionProgress('AMM pool') })
        : localFallbackResult('Demo fallback: creator market has no on-chain ID. Create the market on Monad before seeding its AMM pool.')
      if (result.mode === 'DEMO_FALLBACK') demoTimeline('AMM pool')
      setMarkets((current) => current.map((item) => item.id === marketId ? { ...item, liquidity: item.liquidity + 5, poolReady: true, txHash: result.hash ?? item.txHash } : item))
      notify(result.message)
    } catch (error) {
      notifyWriteError('AMM pool', error)
    }
  }

  async function connectMonadWallet() {
    setTxTimeline([
      { label: 'Wallet permission', state: 'active' },
      { label: 'Switch Monad testnet', state: 'idle' },
      { label: 'Read MON balance', state: 'idle' },
      { label: 'Ready for signatures', state: 'idle' },
    ])
    try {
      const nextWallet = await requestMonadWallet()
      setWallet(nextWallet)
      setTxTimeline([
        { label: 'Wallet permission', state: 'done' },
        { label: 'Monad testnet selected', state: nextWallet.connected ? 'done' : 'active' },
        { label: 'MON balance loaded', state: nextWallet.address ? 'done' : 'idle' },
        { label: 'Ready for signatures', state: nextWallet.connected ? 'ready' : 'idle' },
      ])
      notify(nextWallet.connected ? 'Wallet connected to Monad Testnet' : nextWallet.error ?? 'Wallet needs Monad Testnet')
    } catch (error) {
      const detail = humanizeTransactionError('Wallet connection', error)
      setWallet((current) => ({ ...current, connected: false, error: detail }))
      setTxTimeline([
        { label: 'Wallet permission', state: 'done' },
        { label: 'Connection blocked', state: 'active' },
        { label: 'No wallet mutation', state: 'ready' },
        { label: 'Try again from header', state: 'idle' },
      ])
      notify(detail)
    }
  }

  function disconnectMonadWallet() {
    setWallet({ address: null, balanceMON: '0', chainId: null, connected: false, error: null })
    setTxTimeline([
      { label: 'Wallet disconnected', state: 'done' },
      { label: 'Real signatures paused', state: 'ready' },
      { label: 'Connect again to sign', state: 'idle' },
      { label: 'Monad testnet preserved in wallet', state: 'idle' },
    ])
    notify('Disconnected ArenaX locally. Your wallet extension remains unchanged.')
  }

  async function sendHeartbeat() {
    if (!wallet.address) return
    const txHash = await sendZeroValueHeartbeat(wallet.address)
    setHeartbeatTx(txHash)
    notify('Submitted 0 MON heartbeat on Monad testnet')
  }

  return {
    view, setView,
    xp, setXp,
    level, setLevel,
    streak, setStreak,
    markets, setMarkets,
    selectedId, setSelectedId,
    outcome, setOutcome,
    stake, setStake,
    search, setSearch,
    positions, setPositions,
    parlayLegs, setParlayLegs,
    parlays, setParlays,
    orders, setOrders,
    orderType, setOrderType,
    limitPrice, setLimitPrice,
    riskMode, setRiskMode,
    stressShock, setStressShock,
    hedgeRatio, setHedgeRatio,
    riskProposals, setRiskProposals,
    dailyLimit, setDailyLimit,
    spentToday, setSpentToday,
    pointsOnly, setPointsOnly,
    cooldown, setCooldown,
    selfExcluded, setSelfExcluded,
    aiTier, setAiTier,
    routeQuote, setRouteQuote,
    cashoutAdvice, setCashoutAdvice,
    hedgeAdvice, setHedgeAdvice,
    forecasts, setForecasts,
    oracleCases, setOracleCases,
    vaultState, setVaultState,
    rebalanceAdvice, setRebalanceAdvice,
    creatorQuestion, setCreatorQuestion,
    creatorQuality, setCreatorQuality,
    agentTasks, setAgentTasks,
    txTimeline, setTxTimeline,
    monadStatus, setMonadStatus,
    monadError, setMonadError,
    wallet, setWallet,
    heartbeatTx, setHeartbeatTx,
    lastContractTx, setLastContractTx,
    indexedStatus, setIndexedStatus,
    indexedActivity, setIndexedActivity,
    cryptoStatus, setCryptoStatus,
    creatorRevenueMON, setCreatorRevenueMON,
    contractRuntime,
    notifications, setNotifications,
    paletteOpen, setPaletteOpen,
    paletteQuery, setPaletteQuery,
    activeCategory, setActiveCategory,
    watchlist, setWatchlist,
    marketFeedMode, setMarketFeedMode,
    selectedMarket,
    selectedProbability,
    selectedOdds,
    projectedShares,
    categories,
    filteredMarkets,
    watchedMarkets,
    combinedOdds,
    impliedProbability,
    claimable,
    netExposure,
    openOrderExposure,
    protocolLiquidity,
    latestCreatorMarket,
    limitRemaining,
    canTrade,
    tradeBlockReason,
    canMintParlay,
    parlayBlockReason,
    notify,
    closePalette,
    openPaletteView,
    openPaletteMarket,
    toggleWatchlist,
    openWatchedMarket,
    quickPick,
    buyOutcome,
    addLeg,
    mintParlay,
    quoteParlayCashout,
    proposeHedge,
    cashoutParlay,
    claimAllPositions,
    settleParlay,
    claimParlay,
    previewSmartRoute,
    placeOrder,
    cancelOrder,
    resolveMarket,
    runRiskGovernor,
    runForecastTournament,
    advanceOracleCase,
    runLpRebalance,
    depositLpVault,
    requestLpWithdrawal,
    processLpWithdrawal,
    executeLpRebalance,
    reviewCreatorMarket,
    createCreatorMarket,
    seedCreatorPool,
    connectMonadWallet,
    disconnectMonadWallet,
    sendHeartbeat,
    refreshIndexedData,
    refreshCryptoMarkets,
    awardXP,
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const store = useAppStore()
  return <AppContext.Provider value={store}>{children}</AppContext.Provider>
}

export function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('useApp must be used within AppProvider')
  return context
}
