import { formatEther } from 'viem'

const INDEXER_URL = import.meta.env.VITE_INDEXER_URL?.trim() ?? ''

export type IndexedStatus = {
  mode: 'SYNCING' | 'INDEXED' | 'DEMO_FALLBACK'
  reachable: boolean
  indexedAt: number | null
  latestBlock: string | null
  counts: IndexedDashboard['counts']
  message: string
}

export type IndexedMarket = {
  id: string
  creator: string
  question: string
  category: string
  state: string
  resolvedOutcome: string | null
  volumeWei: string
  liquidityWei: string
  updatedAt: number
  latestTrade: null | {
    outcomeIndex: string
    amountInWei: string
    sharesOutWei: string
    newOdds1e18: string
    blockNumber: string
  }
}

export type IndexedOracleCase = {
  marketId: string
  state: string
  outcomeIndex: string
  challenger: string
  bondWei: string
}

export type IndexedDashboard = {
  mode: 'INDEXED'
  indexedAt: number
  chainId: number
  freshness: {
    latestBlock: string | null
    latestMarketUpdate: number | null
  }
  counts: {
    markets: number
    trades: number
    oracleCases: number
    parlays: number
    forecasts: number
    protocolEvents: number
  }
  markets: IndexedMarket[]
  oracleCases: IndexedOracleCase[]
  vault: {
    depositedWei: string
    paidWei: string
    queuedOutstandingWei: string
    allocations: Array<{ marketId: string; deployedAssetsWei: string }>
  }
  portfolio: {
    address: string | null
    parlays: Array<{
      id: string
      owner: string
      legs: string
      stakeWei: string
      payoutWei: string
      cashoutValueWei: string
      status: string
    }>
    events: IndexedProtocolEvent[]
  }
  forecasts: Array<{
    agent: string
    marketId: string
    probabilityYes1e18: string
    status: string
  }>
  creatorRevenue: {
    address: string
    claimableWei: string
    events: IndexedProtocolEvent[]
  }
  activity: IndexedProtocolEvent[]
}

export type IndexedProtocolEvent = {
  id: string
  module: string
  kind: string
  actor: string
  marketId: string | null
  valueWei: string | null
  blockNumber: string | null
}

const emptyCounts: IndexedDashboard['counts'] = {
  markets: 0,
  trades: 0,
  oracleCases: 0,
  parlays: 0,
  forecasts: 0,
  protocolEvents: 0,
}

export const initialIndexedStatus: IndexedStatus = {
  mode: 'SYNCING',
  reachable: false,
  indexedAt: null,
  latestBlock: null,
  counts: emptyCounts,
  message: 'Checking Ponder indexed data...',
}

function isIndexedDashboard(value: unknown): value is IndexedDashboard {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<IndexedDashboard>
  return candidate.mode === 'INDEXED'
    && typeof candidate.indexedAt === 'number'
    && candidate.chainId === 10143
    && Array.isArray(candidate.markets)
    && Array.isArray(candidate.oracleCases)
    && Array.isArray(candidate.activity)
    && Boolean(candidate.vault)
    && Boolean(candidate.counts)
}

export function indexedWeiToMON(value: string | null | undefined) {
  if (!value) return 0
  try {
    return Number(formatEther(BigInt(value)))
  } catch {
    return 0
  }
}

export async function fetchIndexedDashboard(address?: string | null): Promise<{ status: IndexedStatus; dashboard: IndexedDashboard | null }> {
  if (!INDEXER_URL) {
    return {
      dashboard: null,
      status: {
        mode: 'DEMO_FALLBACK',
        reachable: false,
        indexedAt: null,
        latestBlock: null,
        counts: emptyCounts,
        message: 'Ponder sync is not configured. Demo fixtures remain active.',
      },
    }
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 1800)
  const query = address ? `?address=${encodeURIComponent(address)}` : ''
  try {
    const response = await fetch(`${INDEXER_URL}/api/dashboard${query}`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Indexer returned ${response.status}`)
    const payload: unknown = await response.json()
    if (!isIndexedDashboard(payload)) throw new Error('Indexer payload did not match the ArenaX dashboard contract')
    return {
      dashboard: payload,
      status: {
        mode: 'INDEXED',
        reachable: true,
        indexedAt: payload.indexedAt,
        latestBlock: payload.freshness.latestBlock,
        counts: payload.counts,
        message: payload.counts.markets > 0 ? 'Ponder index is live and hydrating deployed data.' : 'Ponder is live and waiting for seeded contract events.',
      },
    }
  } catch {
    return {
      dashboard: null,
      status: {
        mode: 'DEMO_FALLBACK',
        reachable: false,
        indexedAt: null,
        latestBlock: null,
        counts: emptyCounts,
        message: 'Ponder API is offline or unseeded. Demo fixtures remain active.',
      },
    }
  } finally {
    window.clearTimeout(timeout)
  }
}
