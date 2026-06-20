import { desc } from 'drizzle-orm'
import { Hono } from 'hono'
import { graphql } from 'ponder'
import { db } from 'ponder:api'
import schema, {
  forecasts,
  markets,
  oracleCases,
  parlays,
  protocolEvents,
  trades,
} from 'ponder:schema'

const app = new Hono()
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

app.use('*', async (context, next) => {
  await next()
  context.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*')
  context.header('Access-Control-Allow-Headers', 'content-type')
  context.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  context.header('Cache-Control', 'no-store')
})

app.options('*', (context) => context.body(null, 204))
app.use('/graphql', graphql({ db, schema }))

function stringify(value: bigint | null | undefined) {
  return value?.toString() ?? null
}

function maxBlock(values: Array<{ blockNumber: bigint }>) {
  return values.reduce<bigint | null>((highest, item) => highest === null || item.blockNumber > highest ? item.blockNumber : highest, null)
}

function serializeProtocolEvent(event: typeof protocolEvents.$inferSelect) {
  return {
    id: event.id,
    module: event.module,
    kind: event.kind,
    actor: event.actor,
    marketId: stringify(event.marketId),
    valueWei: stringify(event.value),
    blockNumber: stringify(event.blockNumber),
  }
}

async function loadDashboard(address?: string) {
  const normalizedAddress = address?.toLowerCase()
  const [marketRows, tradeRows, oracleRows, parlayRows, forecastRows, eventRows] = await Promise.all([
    db.select().from(markets).orderBy(desc(markets.updatedAt)).limit(150),
    db.select().from(trades).orderBy(desc(trades.blockNumber)).limit(750),
    db.select().from(oracleCases).limit(150),
    db.select().from(parlays).orderBy(desc(parlays.id)).limit(150),
    db.select().from(forecasts).limit(150),
    db.select().from(protocolEvents).orderBy(desc(protocolEvents.blockNumber)).limit(750),
  ])

  const latestTradeByMarket = new Map<string, typeof tradeRows[number]>()
  for (const trade of tradeRows) {
    const marketId = trade.marketId.toString()
    if (!latestTradeByMarket.has(marketId)) latestTradeByMarket.set(marketId, trade)
  }

  const latestAllocationByMarket = new Map<string, typeof eventRows[number]>()
  for (const event of eventRows) {
    const marketId = event.marketId.toString()
    if (event.module === 'LP_VAULT' && event.kind === 'ALLOCATION_CHANGED' && !latestAllocationByMarket.has(marketId)) {
      latestAllocationByMarket.set(marketId, event)
    }
  }

  const lpDeposits = eventRows.filter((event) => event.module === 'LP_VAULT' && event.kind === 'DEPOSITED')
  const lpPaid = eventRows.filter((event) => event.module === 'LP_VAULT' && event.kind === 'WITHDRAWAL_PAID')
  const lpQueued = eventRows.filter((event) => event.module === 'LP_VAULT' && event.kind === 'WITHDRAWAL_QUEUED')
  const sum = (items: Array<typeof eventRows[number]>) => items.reduce((total, item) => total + item.value, 0n)
  const queuedOutstanding = sum(lpQueued) > sum(lpPaid) ? sum(lpQueued) - sum(lpPaid) : 0n
  const portfolioEvents = normalizedAddress
    ? eventRows.filter((event) => event.actor.toLowerCase() === normalizedAddress)
    : []
  const creatorFeeEvents = eventRows.filter((event) => event.module === 'CREATOR_VAULT')
  const creatorRevenue = normalizedAddress
    ? sum(creatorFeeEvents.filter((event) => event.actor.toLowerCase() === normalizedAddress))
    : sum(creatorFeeEvents)

  return {
    mode: 'INDEXED',
    indexedAt: Date.now(),
    chainId: 10143,
    freshness: {
      latestBlock: stringify(maxBlock([...tradeRows, ...eventRows])),
      latestMarketUpdate: marketRows.reduce<number | null>((latest, market) => latest === null || market.updatedAt > latest ? market.updatedAt : latest, null),
    },
    counts: {
      markets: marketRows.length,
      trades: tradeRows.length,
      oracleCases: oracleRows.length,
      parlays: parlayRows.length,
      forecasts: forecastRows.length,
      protocolEvents: eventRows.length,
    },
    markets: marketRows.map((market) => {
      const latestTrade = latestTradeByMarket.get(market.id.toString())
      return {
        id: market.id.toString(),
        creator: market.creator,
        question: market.question,
        category: market.category,
        state: market.state,
        resolvedOutcome: stringify(market.resolvedOutcome),
        volumeWei: market.volume.toString(),
        liquidityWei: market.liquidity.toString(),
        updatedAt: market.updatedAt,
        latestTrade: latestTrade ? {
          outcomeIndex: latestTrade.outcomeIndex.toString(),
          amountInWei: latestTrade.amountIn.toString(),
          sharesOutWei: latestTrade.sharesOut.toString(),
          newOdds1e18: latestTrade.newOdds.toString(),
          blockNumber: latestTrade.blockNumber.toString(),
        } : null,
      }
    }),
    oracleCases: oracleRows.map((item) => ({
      marketId: item.marketId.toString(),
      state: item.state,
      outcomeIndex: item.outcomeIndex.toString(),
      challenger: item.challenger,
      bondWei: item.bond.toString(),
    })),
    vault: {
      depositedWei: sum(lpDeposits).toString(),
      paidWei: sum(lpPaid).toString(),
      queuedOutstandingWei: queuedOutstanding.toString(),
      allocations: [...latestAllocationByMarket.values()].map((event) => ({
        marketId: event.marketId.toString(),
        deployedAssetsWei: event.value.toString(),
      })),
    },
    portfolio: {
      address: normalizedAddress ?? null,
      parlays: parlayRows
        .filter((parlay) => !normalizedAddress || parlay.owner.toLowerCase() === normalizedAddress)
        .map((parlay) => ({
          id: parlay.id.toString(),
          owner: parlay.owner,
          legs: parlay.legs.toString(),
          stakeWei: parlay.stake.toString(),
          payoutWei: parlay.payout.toString(),
          cashoutValueWei: parlay.cashoutValue.toString(),
          status: parlay.status,
        })),
      events: portfolioEvents.slice(0, 50).map(serializeProtocolEvent),
    },
    forecasts: forecastRows.map((forecast) => ({
      agent: forecast.agent,
      marketId: forecast.marketId.toString(),
      probabilityYes1e18: forecast.probabilityYes1e18.toString(),
      status: forecast.status,
    })),
    creatorRevenue: {
      address: normalizedAddress ?? ZERO_ADDRESS,
      claimableWei: creatorRevenue.toString(),
      events: creatorFeeEvents.slice(0, 50).map(serializeProtocolEvent),
    },
    activity: eventRows.slice(0, 60).map(serializeProtocolEvent),
  }
}

app.get('/api/health', async (context) => {
  const dashboard = await loadDashboard()
  return context.json({
    ok: true,
    mode: dashboard.mode,
    chainId: dashboard.chainId,
    indexedAt: dashboard.indexedAt,
    freshness: dashboard.freshness,
    counts: dashboard.counts,
  })
})

app.get('/api/dashboard', async (context) => context.json(await loadDashboard(context.req.query('address'))))
app.get('/api/markets', async (context) => {
  const dashboard = await loadDashboard()
  return context.json({ mode: dashboard.mode, indexedAt: dashboard.indexedAt, freshness: dashboard.freshness, markets: dashboard.markets })
})

export default app
