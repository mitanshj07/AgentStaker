import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import Fastify from 'fastify'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { verifyTypedData, type Address, type Hex } from 'viem'
import { getAiConfig, callAI, getStructuredPrediction, getCustomStructuredPrediction } from './ai-adapter.js'
import { getAgents, getAgent, runTournamentRound, getLeaderboard, getAgentHistory, getConsensus, createAgentProfile } from './agents.js'
type Side = 'BACK' | 'LAY'
type TIF = 'GTC' | 'GTD' | 'IOC' | 'FOK' | 'FAK' | 'POST_ONLY'
type OrderStatus = 'LIVE' | 'PARTIAL' | 'FILLED' | 'CANCELED' | 'EXPIRED'

type OrderInput = {
  maker: Address
  marketId: string
  outcomeIndex: string
  side: Side
  tif: TIF
  price1e18: string
  size: string
  nonce: string
  expiry: number
  reduceOnly: boolean
  signature: Hex
}

type Order = OrderInput & {
  id: string
  remaining: bigint
  status: OrderStatus
}

type CancelInput = { orderId: string; maker: Address; signature: Hex }
type WsClient = { marketId?: string; socket: import('ws').WebSocket }
type RouteQuote = {
  marketId: string
  outcomeIndex: string
  side: Side
  requestedSize: number
  effectivePrice: number
  depthUsed: number
  priceImpactBps: number
  routeHash: string
  expiry: number
  requiredSignatures: string[]
  legs: Array<{ venue: 'CLOB' | 'AMM'; size: number; price: number; reason: string }>
}

type CryptoFeedMode = 'LIVE_API' | 'CACHE' | 'FALLBACK'
type CryptoRefreshMode = 'DAILY' | 'TWELVE_HOURLY' | 'HOURLY' | 'FINAL_HOURLY' | 'CUSTOM'
type CryptoHighLowSource = 'CMC_OHLCV' | 'QUOTE_ONLY' | 'PLAN_GATED'
type CmcQuoteValue = {
  price?: number
  volume_24h?: number
  volume_change_24h?: number
  percent_change_1h?: number
  percent_change_24h?: number
  percent_change_7d?: number
  market_cap?: number
  last_updated?: string
}
type CmcAsset = {
  id?: number | string
  name?: string
  symbol?: string
  slug?: string
  cmc_rank?: number
  last_updated?: string
  quote?: Record<string, CmcQuoteValue> | CmcQuoteValue[]
}
type CmcOhlcvQuote = {
  open?: number
  high?: number
  low?: number
  close?: number
  volume?: number
  last_updated?: string
}
type CryptoAssetQuote = {
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
  highLowSource: CryptoHighLowSource
  lastUpdated: string
}
type CryptoGeneratedMarket = {
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
type CryptoMarketFeed = {
  mode: CryptoFeedMode
  source: 'COINMARKETCAP' | 'DETERMINISTIC_FALLBACK'
  generatedAt: string
  refreshedAt: string
  nextRefreshAt: string
  stale: boolean
  assets: CryptoAssetQuote[]
  markets: CryptoGeneratedMarket[]
  warnings: string[]
  policy: {
    refreshMode: CryptoRefreshMode
    refreshIntervalMs: number
    callsPerRefresh: number
    quoteEndpoint: string
    ohlcvEndpoint?: string
    ohlcvEnabled: boolean
    quotaNote: string
  }
  error?: string
}

async function loadEnvFile(path: string) {
  try {
    const raw = await readFile(path, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue
      const [key, ...valueParts] = trimmed.split('=')
      if (!key || process.env[key] !== undefined) continue
      const rawValue = valueParts.join('=').trim()
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
    }
  } catch {
    // Local env files are optional. Production should pass secrets through the process environment.
  }
}

async function loadLocalEnv() {
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '../../.env.local'),
  ]
  for (const candidate of candidates) await loadEnvFile(candidate)
}

await loadLocalEnv()

const VALID_SIDES: readonly Side[] = ['BACK', 'LAY']
const VALID_TIFS: readonly TIF[] = ['GTC', 'GTD', 'IOC', 'FOK', 'FAK', 'POST_ONLY']
const MAX_RESERVED_PER_MAKER = BigInt(process.env.MAX_RESERVED_PER_MAKER ?? '1000000000000000000000000')
const TICK_SIZE_1E18 = 10_000_000_000_000_000n
const AI_RATE_LIMIT = Number(process.env.AI_RATE_LIMIT ?? 30)
const app = Fastify({ logger: true })

function corsOrigin() {
  const origins = envList('CORS_ORIGIN')
  if (origins.length === 0 || origins.includes('*')) return '*'
  return origins
}

await app.register(cors, { origin: corsOrigin(), methods: ['GET', 'POST'] })
await app.register(websocket)

const orders = new Map<string, Order>()
const reservedByMaker = new Map<string, bigint>()
const lockedMarkets = new Set<string>()
const wsClients = new Set<WsClient>()
const aiWindows = new Map<string, { count: number; startedAt: number }>()
const activeDuels = new Map<string, {
  id: string
  marketId: string
  agentA: string
  agentB: string
  poolA: number
  poolB: number
  status: 'PENDING' | 'ACTIVE' | 'RESOLVED'
  winner?: string
}>()
const sessionControls = new Map<string, { wallet: string; sessionKey: string; expiresAt: number; dailyCap: number; spentToday: number; paused: boolean }>()
const activity: Array<{ id: string; kind: string; title: string; detail: string; at: number; module: string }> = [
  { id: 'seed-social', kind: 'SOCIAL_MARKET', title: 'Creator milestone opened', detail: 'YouTube views target added with evidence window.', at: Date.now() - 75_000, module: 'SocialMarket' },
  { id: 'seed-signal', kind: 'SIGNAL_UNLOCK', title: 'Alpha signal published', detail: 'Credit-gated bundle is available for Pro pass holders.', at: Date.now() - 130_000, module: 'SignalMarketplace' },
  { id: 'seed-battle', kind: 'BATTLE', title: 'Slip battle resolved', detail: 'Points-only duel awarded the BATTLE_WINNER badge.', at: Date.now() - 205_000, module: 'BattleArena' },
]
const signalFixtures = [
  { id: '1', agent: 'Alpha Ensemble', title: 'BTC Friday close calibration', credits: 8, tier: 'PRO', confidence: 0.72, bundleHash: '0xalpha101', locked: true },
  { id: '2', agent: 'Monad Scout', title: 'Monad block milestone watch', credits: 4, tier: 'FREE', confidence: 0.68, bundleHash: '0xmonad108', locked: true },
]
const DEFAULT_CMC_ASSET_IDS = ['1', '1027', '5426', '1839', '52', '74', '2010', '5805', '1975', '1958', '6636', '2', '1831', '4642', '6535', '21794', '11419', '20947', '7083', '28321']
const CMC_QUOTES_URL = process.env.CMC_QUOTES_URL ?? 'https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest'
const CMC_OHLCV_URL = process.env.CMC_OHLCV_URL ?? 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/latest'
const CMC_CURRENCY = (process.env.CMC_CURRENCY ?? 'USD').toUpperCase()
const CMC_CACHE_PATH = resolve(process.env.CMC_CACHE_PATH ?? 'packages/matcher/.cache/cmc-market-cache.json')
const CMC_OHLCV_ENABLED = process.env.CMC_ENABLE_OHLCV !== 'false'
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
let cryptoFeedRefresh: Promise<CryptoMarketFeed> | null = null

function envList(name: string) {
  return (process.env[name] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

function cryptoAssetIds() {
  return envList('CMC_ASSET_IDS')
}

function cryptoSymbols() {
  return envList('CMC_SYMBOLS').map((symbol) => symbol.toUpperCase())
}

function cryptoRefreshPolicy(): { refreshMode: CryptoRefreshMode; refreshIntervalMs: number } {
  const custom = Number(process.env.CMC_REFRESH_INTERVAL_MS)
  if (Number.isFinite(custom) && custom >= HOUR_MS) return { refreshMode: 'CUSTOM', refreshIntervalMs: custom }

  const configuredMode = (process.env.CMC_REFRESH_MODE ?? 'TWELVE_HOURLY').toUpperCase()
  if (configuredMode === 'DAILY') return { refreshMode: 'DAILY', refreshIntervalMs: DAY_MS }
  if (configuredMode === 'TWELVE_HOURLY' || configuredMode === '12H' || configuredMode === 'EVERY_12_HOURS') return { refreshMode: 'TWELVE_HOURLY', refreshIntervalMs: 12 * HOUR_MS }
  if (configuredMode === 'HOURLY') return { refreshMode: 'HOURLY', refreshIntervalMs: HOUR_MS }

  const finalRefreshFrom = Date.parse(process.env.CMC_FINAL_REFRESH_FROM ?? '')
  if (Number.isFinite(finalRefreshFrom) && Date.now() >= finalRefreshFrom) return { refreshMode: 'FINAL_HOURLY', refreshIntervalMs: HOUR_MS }

  return { refreshMode: 'TWELVE_HOURLY', refreshIntervalMs: 12 * HOUR_MS }
}

function numberFrom(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function optionalNumber(value: unknown) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function quoteRecord(asset: CmcAsset): CmcQuoteValue {
  const quote = asset.quote
  if (Array.isArray(quote)) return quote[0] ?? {}
  if (!quote || typeof quote !== 'object') return {}
  return quote[CMC_CURRENCY] ?? quote.USD ?? Object.values(quote)[0] ?? {}
}

function flattenCmcRecords(value: unknown): CmcAsset[] {
  if (Array.isArray(value)) return value.flatMap((item) => flattenCmcRecords(item))
  if (!value || typeof value !== 'object') return []
  if ('symbol' in value && 'quote' in value) return [value as CmcAsset]
  return Object.values(value as Record<string, unknown>).flatMap((item) => flattenCmcRecords(item))
}

function normalizeSymbol(symbol: string | undefined) {
  return (symbol ?? '').trim().toUpperCase()
}

function roundTarget(value: number) {
  const step = value >= 10_000 ? 100 : value >= 1_000 ? 10 : value >= 100 ? 1 : value >= 1 ? 0.1 : value >= 0.1 ? 0.01 : 0.0001
  return Number((Math.ceil(value / step) * step).toFixed(step < 1 ? 4 : 2))
}

function formatUsdTarget(value: number) {
  if (value >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (value >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 5 })}`
}

function clampProbability(value: number) {
  return Number(Math.max(0.14, Math.min(0.86, value)).toFixed(2))
}

function volumeProxy(asset: CryptoAssetQuote) {
  return Math.round(Math.max(5_000, Math.min(95_000, asset.volume24hUsd / 2_500_000)))
}

function liquidityProxy(asset: CryptoAssetQuote, index: number) {
  return Math.round(Math.max(18_000, Math.min(120_000, asset.marketCapUsd / 28_000_000 + (9 - index) * 1_500)))
}

function cryptoLockLabel(offsetHours: number) {
  const next = new Date(Date.now() + offsetHours * HOUR_MS)
  return `${offsetHours}h · ${next.toISOString().slice(11, 16)} UTC`
}

function cryptoQuality(asset: CryptoAssetQuote, index: number) {
  const rankScore = asset.rank ? Math.max(0, 12 - Math.min(12, asset.rank / 10)) : 6
  return Math.round(Math.max(84, Math.min(98, 86 + rankScore - index * 0.25)))
}

function cryptoForecast(asset: CryptoAssetQuote, extraMomentum = 0) {
  const momentum = asset.percentChange24h / 100 * 1.1 + asset.volumeChange24h / 100 * 0.1 + extraMomentum
  return clampProbability(0.5 + momentum)
}

function parseCmcQuotes(payload: unknown, highLowBySymbol: Map<string, Partial<CryptoAssetQuote>>, highLowSource: CryptoHighLowSource): CryptoAssetQuote[] {
  const records = flattenCmcRecords((payload as { data?: unknown })?.data ?? payload)
  const assets: CryptoAssetQuote[] = []
  for (const asset of records) {
    const symbol = normalizeSymbol(asset.symbol)
    if (!symbol) continue
    const quote = quoteRecord(asset)
    const priceUsd = numberFrom(quote.price)
    if (priceUsd <= 0) continue
    const highLow = highLowBySymbol.get(symbol)
    assets.push({
      id: String(asset.id ?? symbol),
      symbol,
      name: asset.name ?? symbol,
      slug: asset.slug,
      rank: typeof asset.cmc_rank === 'number' ? asset.cmc_rank : undefined,
      priceUsd,
      volume24hUsd: numberFrom(quote.volume_24h),
      volumeChange24h: numberFrom(quote.volume_change_24h),
      marketCapUsd: numberFrom(quote.market_cap),
      percentChange1h: numberFrom(quote.percent_change_1h),
      percentChange24h: numberFrom(quote.percent_change_24h),
      percentChange7d: numberFrom(quote.percent_change_7d),
      dayOpenUsd: highLow?.dayOpenUsd,
      dayHighUsd: highLow?.dayHighUsd,
      dayLowUsd: highLow?.dayLowUsd,
      dayCloseUsd: highLow?.dayCloseUsd,
      highLowSource,
      lastUpdated: quote.last_updated ?? asset.last_updated ?? new Date().toISOString(),
    })
  }
  return assets
}

function parseCmcOhlcv(payload: unknown) {
  const records = flattenCmcRecords((payload as { data?: unknown })?.data ?? payload)
  const highLowBySymbol = new Map<string, Partial<CryptoAssetQuote>>()
  for (const asset of records) {
    const symbol = normalizeSymbol(asset.symbol)
    const quote = quoteRecord(asset) as CmcOhlcvQuote
    if (!symbol) continue
    highLowBySymbol.set(symbol, {
      dayOpenUsd: optionalNumber(quote.open),
      dayHighUsd: optionalNumber(quote.high),
      dayLowUsd: optionalNumber(quote.low),
      dayCloseUsd: optionalNumber(quote.close),
    })
  }
  return highLowBySymbol
}

function predictionMarketsFromAssets(assets: CryptoAssetQuote[]): CryptoGeneratedMarket[] {
  const baseBySymbol: Record<string, number> = { BTC: 120, ETH: 130, SOL: 140, BNB: 150, XRP: 160, DOGE: 170, ADA: 180, AVAX: 190, LINK: 200, TRX: 210, DOT: 220, LTC: 230, BCH: 240, HBAR: 250, NEAR: 260, APT: 270, TON: 280, SUI: 290, UNI: 300, POL: 310 }
  const priceIdBySymbol: Record<string, number> = { BTC: 101, ETH: 107 }
  return assets.flatMap((asset, index) => {
    const base = baseBySymbol[asset.symbol] ?? 240 + index * 10
    const volume = volumeProxy(asset)
    const liquidity = liquidityProxy(asset, index)
    const qualityScore = cryptoQuality(asset, index)
    const priceTarget = roundTarget(asset.priceUsd * (asset.percentChange24h >= 0 ? 1.01 : 1.006))
    const dayHighTarget = roundTarget(Math.max(asset.dayHighUsd ?? asset.priceUsd, asset.priceUsd) * 1.003)
    const dayLowTarget = roundTarget(Math.min(asset.dayLowUsd ?? asset.priceUsd, asset.priceUsd) * 0.997)
    const volumeTarget = roundTarget(Math.max(1, asset.volume24hUsd * 1.06))
    const marketCapTarget = roundTarget(Math.max(1, asset.marketCapUsd * 1.025))
    const closeProbability = cryptoForecast(asset)
    const highProbability = cryptoForecast(asset, asset.dayHighUsd && asset.priceUsd >= asset.dayHighUsd * 0.995 ? 0.08 : -0.04)
    const lowProbability = cryptoForecast(asset, asset.dayLowUsd && asset.priceUsd <= asset.dayLowUsd * 1.005 ? 0.07 : -0.05)
    const volumeProbability = cryptoForecast(asset, asset.volumeChange24h > 0 ? 0.04 : -0.03)
    const capProbability = cryptoForecast(asset, asset.percentChange7d > 0 ? 0.06 : -0.04)
    const highLowLabel = asset.highLowSource === 'CMC_OHLCV' ? 'CMC current UTC OHLCV' : asset.highLowSource === 'PLAN_GATED' ? 'CMC OHLCV plan-gated; quote-backed target' : 'CMC quote-backed target'
    const common = {
      symbol: asset.symbol,
      category: 'Crypto' as const,
      volume,
      liquidity,
      qualityScore,
      tags: ['cmc', 'live price', asset.symbol.toLowerCase(), 'monad testnet'],
      isLive: true,
      trend: Number(asset.percentChange24h.toFixed(1)),
      crypto: asset,
    }
    return [
      {
        ...common,
        id: `${asset.symbol.toLowerCase()}-price-close`,
        uiMarketId: priceIdBySymbol[asset.symbol] ?? base + 1,
        question: `Will ${asset.symbol}/USD close above ${formatUsdTarget(priceTarget)} in the next UTC prediction window?`,
        source: 'CoinMarketCap V3 quotes · Monad testnet oracle',
        lockLabel: cryptoLockLabel(24),
        yesProbability: closeProbability,
        aiProbability: clampProbability(closeProbability + 0.02),
        featured: index < 4,
        eventLabel: 'UTC close',
        metric: 'PRICE_CLOSE' as const,
        target: priceTarget,
        current: asset.priceUsd,
        unit: 'USD' as const,
        rationale: `Latest ${asset.symbol} price is ${formatUsdTarget(asset.priceUsd)} with 24h move ${asset.percentChange24h.toFixed(2)}%.`,
      },
      {
        ...common,
        id: `${asset.symbol.toLowerCase()}-day-high`,
        uiMarketId: base + 2,
        question: `Will ${asset.symbol}/USD trade above ${formatUsdTarget(dayHighTarget)} before the UTC day closes?`,
        source: `${highLowLabel} · Monad testnet oracle`,
        lockLabel: cryptoLockLabel(12),
        yesProbability: highProbability,
        aiProbability: clampProbability(highProbability + 0.01),
        featured: index < 3,
        eventLabel: 'Day high',
        metric: 'DAY_HIGH' as const,
        target: dayHighTarget,
        current: asset.dayHighUsd ?? asset.priceUsd,
        unit: 'USD' as const,
        rationale: asset.dayHighUsd
          ? `Current UTC high is ${formatUsdTarget(asset.dayHighUsd)}; target asks for a fresh high.`
          : 'OHLCV high is unavailable on this key/plan, so the market uses the latest quote as the transparent reference.',
      },
      {
        ...common,
        id: `${asset.symbol.toLowerCase()}-volume-24h`,
        uiMarketId: base + 3,
        question: `Will ${asset.symbol} 24h volume finish above ${formatUsdTarget(volumeTarget)}?`,
        source: 'CoinMarketCap V3 quotes volume · Monad testnet oracle',
        lockLabel: cryptoLockLabel(24),
        yesProbability: volumeProbability,
        aiProbability: clampProbability(volumeProbability + 0.015),
        featured: false,
        eventLabel: '24h volume',
        metric: 'VOLUME_24H' as const,
        target: volumeTarget,
        current: asset.volume24hUsd,
        unit: 'USD_VOLUME' as const,
        rationale: `Current 24h volume is ${formatUsdTarget(asset.volume24hUsd)} with volume change ${asset.volumeChange24h.toFixed(2)}%.`,
      },
      {
        ...common,
        id: `${asset.symbol.toLowerCase()}-market-cap`,
        uiMarketId: base + 4,
        question: `Will ${asset.symbol} market cap finish above ${formatUsdTarget(marketCapTarget)}?`,
        source: 'CoinMarketCap V3 quotes market cap · Monad testnet oracle',
        lockLabel: cryptoLockLabel(12),
        yesProbability: capProbability,
        aiProbability: clampProbability(capProbability + 0.01),
        featured: index < 2,
        eventLabel: 'Market cap',
        metric: 'MARKET_CAP' as const,
        target: marketCapTarget,
        current: asset.marketCapUsd,
        unit: 'USD_MARKET_CAP' as const,
        rationale: `Current market cap is ${formatUsdTarget(asset.marketCapUsd)} with 7d move ${asset.percentChange7d.toFixed(2)}%.`,
      },
      {
        ...common,
        id: `${asset.symbol.toLowerCase()}-day-low`,
        uiMarketId: base + 5,
        question: `Will ${asset.symbol}/USD break below ${formatUsdTarget(dayLowTarget)} before the UTC day closes?`,
        source: `${highLowLabel} · Monad testnet oracle`,
        lockLabel: cryptoLockLabel(12),
        yesProbability: lowProbability,
        aiProbability: clampProbability(lowProbability - 0.01),
        featured: false,
        eventLabel: 'Day low',
        metric: 'DAY_LOW' as const,
        target: dayLowTarget,
        current: asset.dayLowUsd ?? asset.priceUsd,
        unit: 'USD' as const,
        rationale: asset.dayLowUsd
          ? `Current UTC low is ${formatUsdTarget(asset.dayLowUsd)}; target asks for a fresh low.`
          : 'OHLCV low is unavailable on this key/plan, so the market uses the latest quote as the transparent reference.',
      },
    ]
  })
}

function fallbackAssets(): CryptoAssetQuote[] {
  const now = new Date().toISOString()
  return [
    ['1', 'BTC', 'Bitcoin', 103_250, 66_000_000_000, 2_040_000_000_000, 2.4, 7.2, 101_850, 104_120, 100_620],
    ['1027', 'ETH', 'Ethereum', 3_860, 31_500_000_000, 466_000_000_000, 1.6, 4.8, 3_790, 3_920, 3_720],
    ['5426', 'SOL', 'Solana', 174, 8_400_000_000, 90_000_000_000, 3.1, 12.5, 168, 177, 164],
    ['1839', 'BNB', 'BNB', 664, 2_350_000_000, 96_000_000_000, 0.8, -2.1, 658, 671, 650],
    ['52', 'XRP', 'XRP', 2.18, 4_700_000_000, 121_000_000_000, -1.2, 5.7, 2.21, 2.26, 2.12],
  ].map(([id, symbol, name, price, volume, marketCap, change24h, volumeChange24h, open, high, low], index) => ({
    id: String(id),
    symbol: String(symbol),
    name: String(name),
    rank: index + 1,
    priceUsd: Number(price),
    volume24hUsd: Number(volume),
    volumeChange24h: Number(volumeChange24h),
    marketCapUsd: Number(marketCap),
    percentChange1h: Number(change24h) / 5,
    percentChange24h: Number(change24h),
    percentChange7d: Number(change24h) * 1.8,
    dayOpenUsd: Number(open),
    dayHighUsd: Number(high),
    dayLowUsd: Number(low),
    dayCloseUsd: Number(price),
    highLowSource: 'QUOTE_ONLY',
    lastUpdated: now,
  }))
}

function feedPolicy(callsPerRefresh: number) {
  const { refreshMode, refreshIntervalMs } = cryptoRefreshPolicy()
  return {
    refreshMode,
    refreshIntervalMs,
    callsPerRefresh,
    quoteEndpoint: CMC_QUOTES_URL,
    ohlcvEndpoint: CMC_OHLCV_ENABLED ? CMC_OHLCV_URL : undefined,
    ohlcvEnabled: CMC_OHLCV_ENABLED,
    quotaNote: refreshMode === 'TWELVE_HOURLY'
      ? 'Default live mode: one batched CMC refresh every 12 hours.'
      : refreshMode === 'DAILY'
        ? 'Low-quota mode: one batched CMC refresh per 24 hours.'
        : 'Final/demo mode: batched CMC refresh is allowed hourly.',
  }
}

function buildCryptoFeed(mode: CryptoFeedMode, assets: CryptoAssetQuote[], refreshedAt: string, callsPerRefresh: number, warnings: string[], error?: string): CryptoMarketFeed {
  const { refreshIntervalMs } = cryptoRefreshPolicy()
  const nextRefreshAt = new Date(Date.parse(refreshedAt) + refreshIntervalMs).toISOString()
  return {
    mode,
    source: mode === 'FALLBACK' ? 'DETERMINISTIC_FALLBACK' : 'COINMARKETCAP',
    generatedAt: new Date().toISOString(),
    refreshedAt,
    nextRefreshAt,
    stale: Date.now() > Date.parse(nextRefreshAt),
    assets,
    markets: predictionMarketsFromAssets(assets),
    warnings,
    policy: feedPolicy(callsPerRefresh),
    error,
  }
}

async function readCryptoCache() {
  try {
    const raw = await readFile(CMC_CACHE_PATH, 'utf8')
    const parsed = JSON.parse(raw) as CryptoMarketFeed
    if (!Array.isArray(parsed.assets) || !parsed.refreshedAt) return null
    return parsed
  } catch {
    return null
  }
}

async function writeCryptoCache(feed: CryptoMarketFeed) {
  await mkdir(dirname(CMC_CACHE_PATH), { recursive: true })
  await writeFile(CMC_CACHE_PATH, JSON.stringify(feed, null, 2))
}

async function cmcRequest(endpoint: string) {
  const key = process.env.CMC_PRO_API_KEY
  if (!key) throw new Error('CMC_PRO_API_KEY is not configured')
  const url = new URL(endpoint)
  const ids = cryptoAssetIds()
  const symbols = cryptoSymbols()
  if (ids.length > 0) url.searchParams.set('id', ids.join(','))
  else if (symbols.length > 0) url.searchParams.set('symbol', symbols.join(','))
  else url.searchParams.set('id', DEFAULT_CMC_ASSET_IDS.join(','))
  url.searchParams.set('convert', CMC_CURRENCY)
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      'X-CMC_PRO_API_KEY': key,
    },
  })
  const payload = await response.json() as { status?: { error_message?: string; error_code?: number } }
  const cmcErrorCode = Number(payload.status?.error_code ?? 0)
  if (!response.ok || cmcErrorCode !== 0) {
    throw new Error(payload.status?.error_message || `CoinMarketCap returned ${response.status}`)
  }
  return payload
}

async function fetchLiveCryptoFeed() {
  let calls = 0
  let highLowBySymbol = new Map<string, Partial<CryptoAssetQuote>>()
  let highLowSource: CryptoHighLowSource = CMC_OHLCV_ENABLED ? 'PLAN_GATED' : 'QUOTE_ONLY'
  const warnings: string[] = []
  if (CMC_OHLCV_ENABLED) {
    try {
      calls += 1
      highLowBySymbol = parseCmcOhlcv(await cmcRequest(CMC_OHLCV_URL))
      highLowSource = 'CMC_OHLCV'
    } catch (error) {
      warnings.push(`CMC OHLCV unavailable: ${error instanceof Error ? error.message : 'unknown error'}`)
    }
  }
  calls += 1
  const quotePayload = await cmcRequest(CMC_QUOTES_URL)
  const assets = parseCmcQuotes(quotePayload, highLowBySymbol, highLowSource)
  if (assets.length === 0) throw new Error('CoinMarketCap returned no usable crypto quotes')
  return buildCryptoFeed('LIVE_API', assets, new Date().toISOString(), calls, warnings)
}

async function getCryptoFeed(force = false): Promise<CryptoMarketFeed> {
  const { refreshIntervalMs } = cryptoRefreshPolicy()
  const cache = await readCryptoCache()
  if (!force && cache && Date.now() - Date.parse(cache.refreshedAt) < refreshIntervalMs) {
    return buildCryptoFeed('CACHE', cache.assets, cache.refreshedAt, cache.policy?.callsPerRefresh ?? 0, cache.warnings ?? [])
  }
  if (!process.env.CMC_PRO_API_KEY) {
    if (cache) return buildCryptoFeed('CACHE', cache.assets, cache.refreshedAt, 0, ['CMC_PRO_API_KEY is missing; serving last cached market feed.'])
    return buildCryptoFeed('FALLBACK', fallbackAssets(), new Date().toISOString(), 0, ['CMC_PRO_API_KEY is missing; deterministic demo crypto feed is active.'])
  }
  if (!cryptoFeedRefresh) {
    cryptoFeedRefresh = fetchLiveCryptoFeed()
      .then(async (feed) => {
        await writeCryptoCache(feed)
        return feed
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'CMC refresh failed'
        if (cache) return buildCryptoFeed('CACHE', cache.assets, cache.refreshedAt, 0, [`CMC refresh failed; serving cache. ${message}`], message)
        return buildCryptoFeed('FALLBACK', fallbackAssets(), new Date().toISOString(), 0, [`CMC refresh failed; deterministic demo feed active. ${message}`], message)
      })
      .finally(() => {
        cryptoFeedRefresh = null
      })
  }
  return cryptoFeedRefresh
}

function isValidAddress(value: unknown): value is Address {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value)
}

function isValidHex(value: unknown): value is Hex {
  return typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)
}

function isNumericString(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value)
}

function validateOrderInput(body: unknown): { ok: true; order: OrderInput } | { ok: false; error: string } {
  if (body === null || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object' }
  const order = body as Record<string, unknown>
  if (!isValidAddress(order.maker)) return { ok: false, error: '`maker` must be a valid address' }
  for (const field of ['marketId', 'outcomeIndex', 'price1e18', 'size', 'nonce'] as const) {
    if (!isNumericString(order[field])) return { ok: false, error: `\`${field}\` must be a numeric string` }
  }
  if (!VALID_SIDES.includes(order.side as Side)) return { ok: false, error: '`side` must be BACK or LAY' }
  if (!VALID_TIFS.includes(order.tif as TIF)) return { ok: false, error: `\`tif\` must be one of ${VALID_TIFS.join(', ')}` }
  if (typeof order.expiry !== 'number' || !Number.isFinite(order.expiry) || order.expiry <= Math.floor(Date.now() / 1000)) {
    return { ok: false, error: '`expiry` must be a future unix timestamp' }
  }
  if (typeof order.reduceOnly !== 'boolean') return { ok: false, error: '`reduceOnly` must be boolean' }
  if (!isValidHex(order.signature)) return { ok: false, error: '`signature` must be hex' }
  const price = BigInt(order.price1e18 as string)
  const size = BigInt(order.size as string)
  if (price <= 0n || price >= 1_000_000_000_000_000_000n) return { ok: false, error: 'INVALID_PRICE' }
  if (price % TICK_SIZE_1E18 !== 0n) return { ok: false, error: 'INVALID_ORDER_MIN_TICK_SIZE' }
  if (size <= 0n) return { ok: false, error: 'INVALID_ORDER_MIN_SIZE' }
  if (lockedMarkets.has(order.marketId as string)) return { ok: false, error: 'MARKET_LOCKED' }
  return { ok: true, order: order as unknown as OrderInput }
}

function validateCancelInput(body: unknown): { ok: true; input: CancelInput } | { ok: false; error: string } {
  if (body === null || typeof body !== 'object') return { ok: false, error: 'Request body must be a JSON object' }
  const input = body as Record<string, unknown>
  if (typeof input.orderId !== 'string' || input.orderId.length === 0) return { ok: false, error: '`orderId` is required' }
  if (!isValidAddress(input.maker)) return { ok: false, error: '`maker` must be a valid address' }
  if (!isValidHex(input.signature)) return { ok: false, error: '`signature` must be hex' }
  return { ok: true, input: input as unknown as CancelInput }
}

function orderId(order: OrderInput) {
  return `0x${createHash('sha256').update(`${order.maker}:${order.marketId}:${order.outcomeIndex}:${order.nonce}`).digest('hex')}`
}

function routeId(input: unknown) {
  return `0x${createHash('sha256').update(JSON.stringify(input)).digest('hex')}`
}

function tifToIndex(tif: TIF) {
  const index = VALID_TIFS.indexOf(tif)
  if (index === -1) throw new Error(`Invalid tif ${tif}`)
  return index
}

function reservation(order: Pick<OrderInput, 'price1e18' | 'size'>, size = BigInt(order.size)) {
  return (size * BigInt(order.price1e18)) / 1_000_000_000_000_000_000n
}

function reserve(maker: string, amount: bigint) {
  const key = maker.toLowerCase()
  const next = (reservedByMaker.get(key) ?? 0n) + amount
  if (next > MAX_RESERVED_PER_MAKER) throw new Error('RESERVATION_LIMIT')
  reservedByMaker.set(key, next)
}

function release(maker: string, amount: bigint) {
  const key = maker.toLowerCase()
  const next = (reservedByMaker.get(key) ?? 0n) - amount
  reservedByMaker.set(key, next > 0n ? next : 0n)
}

const domain = {
  name: 'Monad ArenaX ExchangeBook',
  version: '1',
  chainId: 10143,
  verifyingContract: (process.env.EXCHANGE_BOOK ?? '0x0000000000000000000000000000000000000000') as Address,
}

const orderTypes = {
  Order: [
    { name: 'maker', type: 'address' },
    { name: 'marketId', type: 'uint256' },
    { name: 'outcomeIndex', type: 'uint256' },
    { name: 'side', type: 'uint8' },
    { name: 'tif', type: 'uint8' },
    { name: 'price1e18', type: 'uint256' },
    { name: 'size', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'expiry', type: 'uint64' },
    { name: 'reduceOnly', type: 'bool' },
  ],
} as const

const cancelTypes = { CancelOrder: [{ name: 'orderId', type: 'string' }, { name: 'maker', type: 'address' }] } as const

function broadcast(event: { type: string; data: unknown }) {
  const message = JSON.stringify(event)
  const marketId = typeof event.data === 'object' && event.data !== null && 'marketId' in event.data
    ? String((event.data as { marketId?: unknown }).marketId)
    : undefined
  for (const client of wsClients) {
    if (client.marketId && marketId && client.marketId !== marketId) continue
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(message)
  }
}

function recordActivity(kind: string, title: string, detail: string, module: string) {
  activity.unshift({ id: `${kind}-${Date.now()}`, kind, title, detail, at: Date.now(), module })
  if (activity.length > 40) activity.length = 40
}

function canCross(incoming: OrderInput, resting: Order) {
  if (incoming.marketId !== resting.marketId || incoming.outcomeIndex !== resting.outcomeIndex || incoming.side === resting.side) return false
  const incomingPrice = BigInt(incoming.price1e18)
  const restingPrice = BigInt(resting.price1e18)
  return incoming.side === 'BACK' ? incomingPrice >= restingPrice : incomingPrice <= restingPrice
}

function matchingOrders(input: OrderInput) {
  return [...orders.values()]
    .filter((order) => (order.status === 'LIVE' || order.status === 'PARTIAL') && canCross(input, order))
    .sort((a, b) => Number(BigInt(a.price1e18) - BigInt(b.price1e18)))
}

function availableDepth(input: OrderInput) {
  return matchingOrders(input).reduce((sum, order) => sum + order.remaining, 0n)
}

async function verifyOrder(order: OrderInput) {
  return verifyTypedData({
    address: order.maker,
    domain,
    types: orderTypes,
    primaryType: 'Order',
    message: {
      maker: order.maker,
      marketId: BigInt(order.marketId),
      outcomeIndex: BigInt(order.outcomeIndex),
      side: order.side === 'BACK' ? 0 : 1,
      tif: tifToIndex(order.tif),
      price1e18: BigInt(order.price1e18),
      size: BigInt(order.size),
      nonce: BigInt(order.nonce),
      expiry: BigInt(order.expiry),
      reduceOnly: order.reduceOnly,
    },
    signature: order.signature,
  })
}

async function acceptOrder(input: OrderInput) {
  const id = orderId(input)
  if (orders.has(id)) throw new Error('DUPLICATE_ORDER')
  if (!(await verifyOrder(input))) throw new Error('BAD_SIGNATURE')
  const depth = availableDepth(input)
  const fullSize = BigInt(input.size)
  if (input.tif === 'POST_ONLY' && depth > 0n) throw new Error('INVALID_POST_ONLY_ORDER')
  if (input.tif === 'FOK' && depth < fullSize) throw new Error('FOK_ORDER_NOT_FILLED')

  let remaining = fullSize
  for (const resting of matchingOrders(input)) {
    if (remaining === 0n) break
    const fill = remaining < resting.remaining ? remaining : resting.remaining
    resting.remaining -= fill
    remaining -= fill
    release(resting.maker, reservation(resting, fill))
    resting.status = resting.remaining === 0n ? 'FILLED' : 'PARTIAL'
    if (resting.remaining === 0n) orders.delete(resting.id)
    broadcast({ type: 'TRADE_MATCHED', data: { marketId: input.marketId, makerOrderId: resting.id, takerOrderId: id, fill: fill.toString() } })
  }

  const immediateOnly = input.tif === 'IOC' || input.tif === 'FOK' || input.tif === 'FAK'
  if (remaining > 0n && !immediateOnly) {
    reserve(input.maker, reservation(input, remaining))
    const stored: Order = { ...input, id, remaining, status: remaining === fullSize ? 'LIVE' : 'PARTIAL' }
    orders.set(id, stored)
    broadcast({ type: 'ORDER_PLACED', data: { ...stored, remaining: stored.remaining.toString() } })
  }
  return { status: remaining === 0n ? 'matched' : immediateOnly ? 'partially_matched' : 'live', orderId: id, remaining: remaining.toString() }
}

app.get('/ws', { websocket: true }, (socket) => {
  const client: WsClient = { socket }
  wsClients.add(client)
  socket.on('close', () => wsClients.delete(client))
})

app.get('/markets/:marketId', { websocket: true }, (socket, request) => {
  const { marketId } = request.params as { marketId: string }
  const client: WsClient = { marketId, socket }
  wsClients.add(client)
  socket.send(JSON.stringify({ type: 'SNAPSHOT', data: orderbook(marketId) }))
  socket.on('close', () => wsClients.delete(client))
})

app.post('/orders', async (request, reply) => {
  const result = validateOrderInput(request.body)
  if (!result.ok) return reply.code(400).send({ error: result.error })
  try {
    return await acceptOrder(result.order)
  } catch (error) {
    return reply.code(400).send({ error: error instanceof Error ? error.message : 'ORDER_REJECTED' })
  }
})

app.post('/orders/batch', async (request, reply) => {
  const body = request.body as { orders?: unknown[] }
  if (!Array.isArray(body?.orders) || body.orders.length === 0 || body.orders.length > 15) {
    return reply.code(400).send({ error: '`orders` must contain 1 to 15 orders' })
  }
  const results = []
  for (const candidate of body.orders) {
    const parsed = validateOrderInput(candidate)
    if (!parsed.ok) results.push({ error: parsed.error })
    else {
      try { results.push(await acceptOrder(parsed.order)) } catch (error) { results.push({ error: error instanceof Error ? error.message : 'ORDER_REJECTED' }) }
    }
  }
  return { results }
})

app.post('/orders/cancel', async (request, reply) => {
  const result = validateCancelInput(request.body)
  if (!result.ok) return reply.code(400).send({ error: result.error })
  const { orderId: id, maker, signature } = result.input
  const order = orders.get(id)
  if (!order) return reply.code(404).send({ error: 'ORDER_NOT_FOUND' })
  if (order.maker.toLowerCase() !== maker.toLowerCase()) return reply.code(403).send({ error: 'NOT_ORDER_OWNER' })
  const valid = await verifyTypedData({ address: maker, domain, types: cancelTypes, primaryType: 'CancelOrder', message: { orderId: id, maker }, signature })
  if (!valid) return reply.code(400).send({ error: 'BAD_CANCEL_SIGNATURE' })
  orders.delete(id)
  release(maker, reservation(order, order.remaining))
  broadcast({ type: 'ORDER_CANCELLED', data: { orderId: id, maker, marketId: order.marketId } })
  return { status: 'canceled', orderId: id }
})

function orderbook(marketId: string) {
  const marketOrders = [...orders.values()].filter((order) => order.marketId === marketId)
  const serialize = (order: Order) => ({ ...order, remaining: order.remaining.toString(), reserved: reservation(order, order.remaining).toString() })
  return { marketId, locked: lockedMarkets.has(marketId), orders: marketOrders.map(serialize) }
}

app.get('/orderbook/:marketId', async (request) => orderbook((request.params as { marketId: string }).marketId))
app.get('/portfolio/:address', async (request) => {
  const { address } = request.params as { address: string }
  return {
    address,
    reserved: (reservedByMaker.get(address.toLowerCase()) ?? 0n).toString(),
    openOrders: [...orders.values()].filter((order) => order.maker.toLowerCase() === address.toLowerCase()).map((order) => ({ ...order, remaining: order.remaining.toString() })),
  }
})

app.post('/markets/:marketId/lock', async (request, reply) => {
  if (process.env.ADMIN_SECRET && request.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return reply.code(401).send({ error: 'UNAUTHORIZED' })
  }
  const { marketId } = request.params as { marketId: string }
  lockedMarkets.add(marketId)
  for (const [id, order] of orders) {
    if (order.marketId !== marketId) continue
    orders.delete(id)
    release(order.maker, reservation(order, order.remaining))
    broadcast({ type: 'ORDER_CANCELLED_FOR_LOCK', data: { marketId, orderId: id } })
  }
  return { status: 'locked', marketId }
})

app.post('/route/quote', async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>
  const marketId = typeof body.marketId === 'number' ? String(body.marketId) : body.marketId
  const outcomeValue = body.outcomeIndex ?? body.outcome
  const outcomeIndex = typeof outcomeValue === 'number' ? String(outcomeValue) : outcomeValue
  const side = body.side === 0 ? 'BACK' : body.side === 1 ? 'LAY' : body.side
  if (!isNumericString(marketId) || !isNumericString(outcomeIndex) || !VALID_SIDES.includes(side as Side)) {
    return reply.code(400).send({ error: 'marketId, outcomeIndex (or outcome), and side are required' })
  }
  const size = Number(body.size)
  const maxSlippageBps = Number(body.maxSlippageBps ?? 300)
  if (!Number.isFinite(size) || size <= 0 || !Number.isFinite(maxSlippageBps)) return reply.code(400).send({ error: 'Invalid size or slippage' })
  const marketOrders = [...orders.values()].filter((order) => order.marketId === marketId && order.outcomeIndex === outcomeIndex && order.side !== side)
  const clobDepth = marketOrders.reduce((sum, order) => sum + Number(order.remaining) / 1e18, 0)
  const clobSize = Number(Math.min(size * 0.62, clobDepth).toFixed(4))
  const ammSize = Number((size - clobSize).toFixed(4))
  const basePrice = marketOrders.length > 0 ? Number(marketOrders[0].price1e18) / 1e18 : 0.55
  const priceImpactBps = Math.min(maxSlippageBps, Math.round(ammSize * 38))
  const ammPrice = Number((basePrice * (1 + priceImpactBps / 10_000)).toFixed(4))
  const effectivePrice = Number((((clobSize * basePrice) + (ammSize * ammPrice)) / size).toFixed(4))
  const quote: RouteQuote = {
    marketId,
    outcomeIndex,
    side: side as Side,
    requestedSize: size,
    effectivePrice,
    depthUsed: clobSize,
    priceImpactBps,
    routeHash: routeId({ ...body, marketId, outcomeIndex, side }),
    expiry: Math.floor(Date.now() / 1000) + 30,
    requiredSignatures: ['EIP-712 order signature', 'wallet transaction approval for AMM leg'],
    legs: [
      ...(clobSize > 0 ? [{ venue: 'CLOB' as const, size: clobSize, price: basePrice, reason: 'Use resting signed liquidity first' }] : []),
      ...(ammSize > 0 ? [{ venue: 'AMM' as const, size: ammSize, price: ammPrice, reason: 'Fill residual size with on-chain AMM liquidity' }] : []),
    ],
  }
  return quote
})

app.get('/api/crypto/markets', async (request, reply) => {
  const query = request.query as { force?: string }
  const force = query.force === '1' || query.force === 'true'
  if (force) {
    if (!process.env.ADMIN_SECRET || request.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
      return reply.code(401).send({ error: 'Force refresh requires ADMIN_SECRET.' })
    }
  }
  return getCryptoFeed(force)
})

app.get('/api/activity', async () => ({ mode: 'DEMO_FALLBACK', items: activity }))

app.post('/api/social/preview', async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>
  const contentUrl = String(body.contentUrl ?? '')
  const handle = String(body.handle ?? '')
  const targetValue = Number(body.targetValue)
  const startValue = Number(body.startValue ?? 0)
  if (!/^https?:\/\//.test(contentUrl) || handle.length < 2 || !Number.isFinite(targetValue) || targetValue <= startValue) {
    return reply.code(400).send({ error: 'Valid URL, handle, and target above the starting value are required' })
  }
  const progress = Math.max(0, Math.min(100, Math.round((startValue / targetValue) * 100)))
  return {
    mode: 'EVIDENCE_PREVIEW',
    platform: contentUrl.includes('youtu') ? 'YOUTUBE' : 'X',
    handle,
    targetValue,
    startValue,
    progress,
    checks: ['Canonical content URL', 'Manual oracle evidence URI required', '30 minute challenge window', 'Test MON only'],
  }
})

app.get('/api/signals', async () => ({ mode: 'DEMO_FALLBACK', signals: signalFixtures }))

app.post('/api/signals/:signalId/unlock', async (request, reply) => {
  const { signalId } = request.params as { signalId: string }
  const signal = signalFixtures.find((item) => item.id === signalId)
  if (!signal) return reply.code(404).send({ error: 'SIGNAL_NOT_FOUND' })
  recordActivity('SIGNAL_UNLOCK', 'Signal unlock requested', `${signal.title} needs an AIPass credit signature.`, 'SignalMarketplace')
  return { ...signal, locked: false, advisoryOnly: true, requiresUserApproval: true, recommendation: 'Review route depth before signing any order.' }
})

app.post('/api/sessions', async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>
  const wallet = String(body.wallet ?? '')
  const sessionKey = String(body.sessionKey ?? '')
  const dailyCap = Number(body.dailyCap)
  const expiresAt = Number(body.expiresAt)
  if (!isValidAddress(wallet) || !isValidAddress(sessionKey) || !Number.isFinite(dailyCap) || dailyCap <= 0 || expiresAt <= Math.floor(Date.now() / 1000)) {
    return reply.code(400).send({ error: 'Valid wallet, session key, future expiry, and positive daily cap are required' })
  }
  const session = { wallet, sessionKey, dailyCap, expiresAt, spentToday: 0, paused: false }
  sessionControls.set(sessionKey.toLowerCase(), session)
  recordActivity('AGENT_SESSION', 'Restricted session prepared', `CLOB-only session cap set to ${dailyCap} test MON.`, 'AgentWallet')
  return { ...session, permissions: ['CLOB_SIGNED_FILL', 'CANCEL_ORDER'], forbidden: ['AMM_SWAP', 'WITHDRAW', 'ARBITRARY_CALL'] }
})

app.post('/api/sessions/:sessionKey/pause', async (request, reply) => {
  const { sessionKey } = request.params as { sessionKey: string }
  const session = sessionControls.get(sessionKey.toLowerCase())
  if (!session) return reply.code(404).send({ error: 'SESSION_NOT_FOUND' })
  session.paused = true
  recordActivity('AGENT_SESSION', 'Agent session paused', 'The restricted CLOB session can no longer authorize fills.', 'AgentWallet')
  return session
})

function enforceAiLimit(key: string) {
  const now = Date.now()
  const window = aiWindows.get(key)
  if (!window || now - window.startedAt > 60_000) {
    aiWindows.set(key, { count: 1, startedAt: now })
    return
  }
  if (window.count >= AI_RATE_LIMIT) throw new Error('AI_RATE_LIMIT')
  window.count += 1
}

function aiFallback(kind: string, body: Record<string, unknown>) {
  const confidence = kind === 'forecast' ? 'MEDIUM' : 'HIGH'
  const common = { mode: process.env.GOOGLE_AI_API_KEY || process.env.OPENAI_API_KEY ? 'MODEL_ADAPTER_READY' : 'DETERMINISTIC_FALLBACK', advisoryOnly: true, requiresUserApproval: true, confidence }
  if (kind === 'parlay-risk') return { ...common, riskLevel: Number(body.legsCount ?? 2) > 3 ? 'HIGH' : 'MEDIUM', warning: 'Combined positions amplify correlated downside.', suggestion: 'Keep stake capped and review the cashout quote before signing.' }
  if (kind === 'hedge') return { ...common, recommendation: 'Lay the highest-correlation leg through the smart router.', hedgeRatio: 35, maxSlippageBps: 250 }
  if (kind === 'forecast') return { ...common, probabilityYes: 0.57, mainRisk: 'Oracle source quality and late market-moving information.', reasoning: 'The market and agent estimate are close; size conservatively.' }
  if (kind === 'lp-rebalance') return { ...common, recommendation: 'Shift 18% of idle depth toward the tighter-spread market.', drawdownBps: 840, requiresVaultSignature: true }
  return { ...common, qualityScore: 91, manipulationRisk: 'LOW', duplicateRisk: 'LOW', oracleChecklist: ['Objective source', 'UTC deadline', 'Binary outcome wording'] }
}

for (const kind of ['parlay-risk', 'hedge', 'forecast', 'lp-rebalance', 'check-market']) {
  app.post(`/ai/${kind}`, async (request, reply) => {
    try {
      const body = (request.body ?? {}) as Record<string, unknown>
      enforceAiLimit(String(body.wallet ?? request.ip))
      
      const config = getAiConfig()
      if (config.provider === 'NONE') {
        return aiFallback(kind, body)
      }

      const common = { mode: 'LIVE_AI_AGENT', advisoryOnly: true, requiresUserApproval: true }
      
      if (kind === 'parlay-risk') {
        const schema = `{ "riskLevel": "LOW" | "MEDIUM" | "HIGH", "warning": "string", "suggestion": "string" }`
        const sys = 'You are a quantitative risk analyst. Evaluate the correlation risk of a multi-leg parlay bet.'
        const result = await getCustomStructuredPrediction(sys, JSON.stringify(body), schema, aiFallback(kind, body))
        return { ...common, ...result }
      }
      if (kind === 'hedge') {
        const schema = `{ "recommendation": "string", "hedgeRatio": "number (0-100)", "maxSlippageBps": "number" }`
        const sys = 'You are a portfolio manager. Suggest the optimal hedge for a given set of positions to minimize exposure.'
        const result = await getCustomStructuredPrediction(sys, JSON.stringify(body), schema, aiFallback(kind, body))
        return { ...common, ...result }
      }
      if (kind === 'lp-rebalance') {
        const schema = `{ "recommendation": "string", "drawdownBps": "number", "requiresVaultSignature": "boolean" }`
        const sys = 'You are an automated market maker strategist. Suggest LP rebalancing given market utilization and order book depth.'
        const result = await getCustomStructuredPrediction(sys, JSON.stringify(body), schema, aiFallback(kind, body))
        return { ...common, ...result }
      }
      if (kind === 'check-market') {
        const schema = `{ "qualityScore": "number (0-100)", "manipulationRisk": "LOW"|"MEDIUM"|"HIGH", "duplicateRisk": "LOW"|"MEDIUM"|"HIGH", "oracleChecklist": ["string", "string"] }`
        const sys = 'You are a prediction market review agent. Evaluate a newly proposed market for clarity, oracle resolvability, and manipulation risk.'
        const result = await getCustomStructuredPrediction(sys, JSON.stringify(body), schema, aiFallback(kind, body))
        return { ...common, ...result }
      }
      
      return aiFallback(kind, body)
    } catch (error) {
      return reply.code(429).send({ error: error instanceof Error ? error.message : 'AI_RATE_LIMIT' })
    }
  })
}

// === NEW AGENT ENDPOINTS ===

type SpawnedAgentDraft = {
  name: string
  systemPrompt: string
  strategyTags: string[]
  shortBio: string
}

type DebateArgument = { argument: string; confidence: number }

function parseAiJson<T>(value: string): T {
  return JSON.parse(value.replace(/```json|```/g, '').trim()) as T
}

function deterministicAgentDraft(personaDescription: string): SpawnedAgentDraft {
  const normalized = personaDescription.toLowerCase()
  const tagMap: Array<[string, string]> = [
    ['macro', 'macro'], ['crypto', 'crypto'], ['monad', 'monad-ecosystem'], ['sport', 'sports'],
    ['trend', 'momentum'], ['momentum', 'momentum'], ['volatil', 'volatility'], ['sentiment', 'sentiment'], ['contrarian', 'contrarian'],
  ]
  const strategyTags = [...new Set(tagMap.filter(([keyword]) => normalized.includes(keyword)).map(([, tag]) => tag))].slice(0, 3)
  const nameWords = personaDescription.trim().split(/\s+/).slice(0, 2).map((word) => word.replace(/[^a-z0-9]/gi, '')).filter(Boolean).map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
  return {
    name: nameWords.length ? nameWords.join(' ') : 'Quant Ghost',
    systemPrompt: `You are an autonomous prediction agent following this strategy: ${personaDescription}. State calibrated confidence between 0.55 and 0.85. Show the prior, evidence, and posterior before concluding, and reduce exposure when evidence is weak.`,
    strategyTags: strategyTags.length ? strategyTags : ['crypto'],
    shortBio: personaDescription.slice(0, 110),
  }
}

app.post('/ai/agent-spawn', async (request, reply) => {
  const body = (request.body ?? {}) as { personaDescription?: unknown }
  if (typeof body.personaDescription !== 'string' || body.personaDescription.trim().length < 8 || body.personaDescription.length > 300) {
    return reply.code(400).send({ error: 'personaDescription must be 8 to 300 characters' })
  }
  const fallback = deterministicAgentDraft(body.personaDescription)
  try {
    enforceAiLimit(String(request.ip))
    const prompt = `Generate only JSON with fields name, systemPrompt, strategyTags, and shortBio for this AI prediction-market agent persona: ${body.personaDescription}. Name must be two words. strategyTags must contain up to three values from crypto, macro, sports, monad-ecosystem, contrarian, momentum, volatility, sentiment. The systemPrompt must define confidence ranges and reasoning style.`
    const result = await callAI('You create distinctive, calibrated AI agent strategies for a prediction economy. Return valid JSON only.', prompt)
    const parsed = parseAiJson<SpawnedAgentDraft>(result)
    if (!parsed.name || !parsed.systemPrompt || !Array.isArray(parsed.strategyTags) || !parsed.shortBio) return fallback
    return parsed
  } catch {
    return fallback
  }
})

app.post('/ai/agent-debate', async (request, reply) => {
  const body = (request.body ?? {}) as {
    marketId?: unknown
    marketTitle?: unknown
    marketDescription?: unknown
    agentAName?: unknown
    agentAPrompt?: unknown
    agentBName?: unknown
    agentBPrompt?: unknown
  }
  if (typeof body.marketTitle !== 'string' || typeof body.agentAName !== 'string' || typeof body.agentBName !== 'string') {
    return reply.code(400).send({ error: 'marketTitle, agentAName, and agentBName are required' })
  }
  const fallback = {
    agentA: { argument: `${body.agentAName} sees the base rate and current market momentum supporting YES while preserving room for uncertainty.`, confidence: 0.68 },
    agentB: { argument: `${body.agentBName} believes consensus is over-pricing the latest narrative and sees NO as the better calibrated side.`, confidence: 0.62 },
  }
  const makePrompt = (name: string, systemPrompt: unknown, side: 'YES' | 'NO') => `${typeof systemPrompt === 'string' ? systemPrompt : ''}\nYou are ${name}. Debate the ${side} side of this prediction market: ${body.marketTitle}. Context: ${typeof body.marketDescription === 'string' ? body.marketDescription : 'No extra context'}. Return only JSON: {"argument":"2-3 specific sentences","confidence":0.55}`
  try {
    enforceAiLimit(String(request.ip))
    const [agentAResult, agentBResult] = await Promise.all([
      callAI('You are a calibrated prediction-market debater. Return valid JSON only.', makePrompt(body.agentAName, body.agentAPrompt, 'YES')),
      callAI('You are a calibrated prediction-market debater. Return valid JSON only.', makePrompt(body.agentBName, body.agentBPrompt, 'NO')),
    ])
    const agentA = parseAiJson<DebateArgument>(agentAResult)
    const agentB = parseAiJson<DebateArgument>(agentBResult)
    if (!agentA.argument || !agentB.argument || !Number.isFinite(agentA.confidence) || !Number.isFinite(agentB.confidence)) return fallback
    return { agentA, agentB }
  } catch {
    return fallback
  }
})

app.get('/agents/leaderboard', async () => ({
  timestamp: Date.now(),
  note: 'Frontend agent state is session-local. This endpoint confirms the matcher is alive.',
  status: 'ok',
}))

app.post('/api/agents/create', async (request, reply) => {
  try {
    const body = (request.body ?? {}) as { prompt: string }
    enforceAiLimit(String(request.ip))
    
    if (!body.prompt) {
      return reply.code(400).send({ error: 'Missing prompt' })
    }

    const newAgent = await createAgentProfile(body.prompt)
    return { agent: newAgent, mode: getAiConfig().provider === 'NONE' ? 'DETERMINISTIC_FALLBACK' : 'AI_LIVE' }
  } catch (error) {
    console.error('Agent creation error:', error)
    return reply.code(500).send({ error: error instanceof Error ? error.message : 'INTERNAL_ERROR' })
  }
})

app.get('/api/agents/leaderboard', async () => {
  return { agents: getLeaderboard(), mode: getAiConfig().provider === 'NONE' ? 'DETERMINISTIC_FALLBACK' : 'AI_LIVE' }
})

app.get('/api/agents/:agentId/history', async (request, reply) => {
  const { agentId } = request.params as { agentId: string }
  const history = getAgentHistory(agentId)
  return { history, mode: getAiConfig().provider === 'NONE' ? 'DETERMINISTIC_FALLBACK' : 'AI_LIVE' }
})

app.post('/api/agents/tournament/run', async (request, reply) => {
  try {
    const body = (request.body ?? {}) as { marketId: number, question: string, context?: Record<string, unknown> }
    enforceAiLimit(String(request.ip))
    
    if (!body.marketId || !body.question) {
      return reply.code(400).send({ error: 'Missing marketId or question' })
    }

    const result = await runTournamentRound(body.marketId, body.question, body.context || {})
    return { ...result, marketId: body.marketId, question: body.question, mode: getAiConfig().provider === 'NONE' ? 'DETERMINISTIC_FALLBACK' : 'AI_LIVE' }
  } catch (error) {
    console.error('Tournament error:', error)
    return reply.code(500).send({ error: error instanceof Error ? error.message : 'INTERNAL_ERROR' })
  }
})

app.get('/api/agents/consensus/:marketId', async (request, reply) => {
  const { marketId } = request.params as { marketId: string }
  const consensus = getConsensus(Number(marketId))
  
  if (!consensus) {
    return { marketId: Number(marketId), consensus: 0.5, spread: 0, agents: [], mode: 'NONE' }
  }
  
  return { ...consensus, mode: getAiConfig().provider === 'NONE' ? 'DETERMINISTIC_FALLBACK' : 'AI_LIVE' }
})

// === DUEL ENDPOINTS ===

app.post('/api/duels/create', async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>
  const id = `duel-${Date.now()}`
  const duel = {
    id,
    marketId: String(body.marketId),
    agentA: String(body.agentA),
    agentB: String(body.agentB),
    poolA: 0,
    poolB: 0,
    status: 'PENDING' as const,
  }
  activeDuels.set(id, duel)
  return duel
})

app.get('/api/duels/:duelId', async (request, reply) => {
  const { duelId } = request.params as { duelId: string }
  const duel = activeDuels.get(duelId)
  if (!duel) return reply.code(404).send({ error: 'DUEL_NOT_FOUND' })
  return duel
})

app.post('/api/duels/:duelId/run', async (request, reply) => {
  const { duelId } = request.params as { duelId: string }
  const duel = activeDuels.get(duelId)
  if (!duel) return reply.code(404).send({ error: 'DUEL_NOT_FOUND' })
  
  duel.status = 'ACTIVE'
  
  // Simulate AI race
  let step = 0
  const timer = setInterval(() => {
    step++
    broadcast({ type: 'DUEL_STEP', data: { marketId: duelId, step, message: `Agent analyzing factor ${step}...` } })
    if (step >= 5) {
      clearInterval(timer)
      duel.status = 'RESOLVED'
      duel.winner = Math.random() > 0.5 ? duel.agentA : duel.agentB
      broadcast({ type: 'DUEL_RESOLVED', data: { ...duel, marketId: duelId } })
    }
  }, 2000)
  
  return duel
})

app.get('/duels/:duelId', { websocket: true }, (socket, request) => {
  const { duelId } = request.params as { duelId: string }
  const client: WsClient = { marketId: duelId, socket }
  wsClients.add(client)
  socket.on('close', () => wsClients.delete(client))
})

// === STRATEGY CLASH ENDPOINTS ===

const activeClashes = new Map<string, any>()

app.post('/api/clash/create', async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>
  const id = `clash-${Date.now()}`
  const clash = {
    id,
    agentA: String(body.agentA),
    agentB: String(body.agentB),
    status: 'PENDING' as const,
  }
  activeClashes.set(id, clash)
  return clash
})

app.get('/api/clash/:clashId', async (request, reply) => {
  const { clashId } = request.params as { clashId: string }
  const clash = activeClashes.get(clashId)
  if (!clash) return reply.code(404).send({ error: 'CLASH_NOT_FOUND' })
  return clash
})

app.post('/api/clash/:clashId/resolve', async (request, reply) => {
  const { clashId } = request.params as { clashId: string }
  const clash = activeClashes.get(clashId)
  if (!clash) return reply.code(404).send({ error: 'CLASH_NOT_FOUND' })
  
  clash.status = 'RESOLVED'
  clash.winner = Math.random() > 0.5 ? clash.agentA : clash.agentB
  return clash
})

// === CARD BATTLE ENDPOINTS ===

const activeCardBattles = new Map<string, any>()

app.post('/api/cards/create', async (request, reply) => {
  const body = (request.body ?? {}) as Record<string, unknown>
  const id = `cards-${Date.now()}`
  const battle = {
    id,
    agentA: String(body.agentA),
    agentB: String(body.agentB),
    status: 'PENDING' as const,
  }
  activeCardBattles.set(id, battle)
  return battle
})

app.get('/api/cards/:battleId', async (request, reply) => {
  const { battleId } = request.params as { battleId: string }
  const battle = activeCardBattles.get(battleId)
  if (!battle) return reply.code(404).send({ error: 'BATTLE_NOT_FOUND' })
  return battle
})

app.post('/api/cards/:battleId/resolve', async (request, reply) => {
  const { battleId } = request.params as { battleId: string }
  const battle = activeCardBattles.get(battleId)
  if (!battle) return reply.code(404).send({ error: 'BATTLE_NOT_FOUND' })
  
  battle.status = 'RESOLVED'
  battle.winner = Math.random() > 0.5 ? battle.agentA : battle.agentB
  return battle
})

// === COPY TRADING ENDPOINTS ===

const copyTradingSessions = new Map<string, {
  id: string
  followerWallet: string
  traderWallet: string
  maxDailySpend: number
  spentToday: number
  status: 'ACTIVE' | 'REVOKED'
  createdAt: number
}>()

app.post('/api/copy-trading/preview', async (request, reply) => {
  const body = (request.body ?? {}) as { traderWallet?: string, maxDailySpend?: number }
  if (!body.traderWallet) return reply.code(400).send({ error: 'traderWallet is required' })
  
  return {
    traderWallet: body.traderWallet,
    estimatedGasCost: '0.005 MON',
    capacityAvailable: true,
    warnings: [
      'Copy trading will mirror the target wallet\'s trades up to your daily spend limit.',
      'Slippage may occur during high volatility.',
      'Ensure you have sufficient test MON balance.'
    ]
  }
})

app.post('/api/copy-trading/follow', async (request, reply) => {
  const body = (request.body ?? {}) as {
    followerWallet?: string
    traderWallet?: string
    maxDailySpend?: number
    signature?: string
  }
  
  if (!body.followerWallet || !body.traderWallet || !body.maxDailySpend || !body.signature) {
    return reply.code(400).send({ error: 'followerWallet, traderWallet, maxDailySpend, and signature are required' })
  }
  
  const id = `copy-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  const session = {
    id,
    followerWallet: body.followerWallet,
    traderWallet: body.traderWallet,
    maxDailySpend: body.maxDailySpend,
    spentToday: 0,
    status: 'ACTIVE' as const,
    createdAt: Date.now()
  }
  
  copyTradingSessions.set(id, session)
  recordActivity('COPY_TRADING', 'Started Copying', `${body.followerWallet.slice(0,6)} is mirroring ${body.traderWallet.slice(0,6)}`, 'ExchangeBook')
  
  return session
})

app.post('/api/copy-trading/revoke', async (request, reply) => {
  const body = (request.body ?? {}) as { sessionId?: string, signature?: string }
  if (!body.sessionId || !body.signature) {
    return reply.code(400).send({ error: 'sessionId and signature are required' })
  }
  
  const session = copyTradingSessions.get(body.sessionId)
  if (!session) return reply.code(404).send({ error: 'SESSION_NOT_FOUND' })
  
  session.status = 'REVOKED'
  recordActivity('COPY_TRADING', 'Stopped Copying', `Mirror trading session ended.`, 'ExchangeBook')
  
  return session
})


app.get('/health', async () => {
  const policy = feedPolicy(process.env.CMC_PRO_API_KEY ? (CMC_OHLCV_ENABLED ? 2 : 1) : 0)
  return {
    ok: true,
    chainId: 10143,
    mode: 'TESTNET_ONLY',
    matcherPrivateKeyConfigured: Boolean(process.env.MATCHER_PRIVATE_KEY),
    aiAdapterConfigured: Boolean(process.env.OPENAI_API_KEY),
    cmcConfigured: Boolean(process.env.CMC_PRO_API_KEY),
    cryptoCachePath: CMC_CACHE_PATH,
    cryptoRefreshMode: policy.refreshMode,
    cryptoRefreshIntervalMs: policy.refreshIntervalMs,
  }
})

const cleanupTimer = setInterval(() => {
  const now = Math.floor(Date.now() / 1000)
  for (const [id, order] of orders) {
    if (order.expiry > now) continue
    orders.delete(id)
    release(order.maker, reservation(order, order.remaining))
    broadcast({ type: 'ORDER_EXPIRED', data: { orderId: id, maker: order.maker, marketId: order.marketId } })
  }
}, 30_000)
cleanupTimer.unref()

await app.listen({ host: '0.0.0.0', port: Number(process.env.PORT ?? 8787) })
