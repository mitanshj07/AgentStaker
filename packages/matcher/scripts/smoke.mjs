import assert from 'node:assert/strict'
import { privateKeyToAccount } from 'viem/accounts'

for (const candidate of ['.env', '.env.local', '../../.env', '../../.env.local']) {
  try { process.loadEnvFile(candidate) } catch { /* optional local env */ }
}

const baseUrl = process.env.MATCHER_URL ?? 'http://127.0.0.1:8787'
const websocketBaseUrl = baseUrl.replace(/^http/, 'ws')
const account = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const marketBase = Math.floor(Date.now() / 1000) * 100
const domain = {
  name: 'Monad ArenaX ExchangeBook',
  version: '1',
  chainId: 10143,
  verifyingContract: process.env.EXCHANGE_BOOK ?? '0x0000000000000000000000000000000000000000',
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
}
const cancelTypes = { CancelOrder: [{ name: 'orderId', type: 'string' }, { name: 'maker', type: 'address' }] }
const tifIndex = { GTC: 0, GTD: 1, IOC: 2, FOK: 3, FAK: 4, POST_ONLY: 5 }

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options)
  const body = await response.json()
  return { status: response.status, body }
}

async function post(path, body) {
  return request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

async function signedOrder({ marketId, nonce, side, size = '1000000000000000000', tif }) {
  const order = {
    maker: account.address,
    marketId: String(marketId),
    outcomeIndex: '0',
    side,
    tif,
    price1e18: '500000000000000000',
    size,
    nonce: String(nonce),
    expiry: Math.floor(Date.now() / 1000) + 3600,
    reduceOnly: false,
  }
  const signature = await account.signTypedData({
    domain,
    types: orderTypes,
    primaryType: 'Order',
    message: {
      ...order,
      marketId: BigInt(order.marketId),
      outcomeIndex: 0n,
      side: side === 'BACK' ? 0 : 1,
      tif: tifIndex[tif],
      price1e18: BigInt(order.price1e18),
      size: BigInt(order.size),
      nonce: BigInt(order.nonce),
      expiry: BigInt(order.expiry),
    },
  })
  const body = { ...order, signature }
  return { body, response: await post('/orders', body) }
}

async function cancel(orderId) {
  const signature = await account.signTypedData({ domain, types: cancelTypes, primaryType: 'CancelOrder', message: { orderId, maker: account.address } })
  return post('/orders/cancel', { orderId, maker: account.address, signature })
}

async function marketSnapshot(marketId) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`${websocketBaseUrl}/markets/${marketId}`)
    const timeout = setTimeout(() => reject(new Error('Websocket snapshot timeout')), 2000)
    socket.onmessage = (event) => {
      clearTimeout(timeout)
      socket.close()
      resolve(JSON.parse(event.data))
    }
    socket.onerror = () => reject(new Error('Websocket snapshot failed'))
  })
}

const health = await request('/health')
assert.equal(health.status, 200)
assert.equal(health.body.chainId, 10143)
assert.equal(health.body.mode, 'TESTNET_ONLY')

const route = await post('/route/quote', { marketId: marketBase, outcome: 0, side: 0, size: '2', maxSlippageBps: 120 })
assert.equal(route.status, 200)
assert.equal(route.body.side, 'BACK')
assert.equal(route.body.legs.at(-1).venue, 'AMM')

const hedge = await post('/ai/hedge', { wallet: `smoke-${marketBase}`, marketId: marketBase })
assert.equal(hedge.status, 200)
assert.equal(hedge.body.advisoryOnly, true)
assert.equal(hedge.body.requiresUserApproval, true)

const cryptoFeed = await request('/api/crypto/markets')
assert.equal(cryptoFeed.status, 200)
assert.ok(['LIVE_API', 'CACHE', 'FALLBACK'].includes(cryptoFeed.body.mode))
assert.ok(cryptoFeed.body.markets.length >= 1)
assert.ok(cryptoFeed.body.policy.refreshIntervalMs >= 3_600_000)

const spawnedAgent = await post('/ai/agent-spawn', { personaDescription: 'A contrarian Monad specialist who fades crowded ecosystem narratives' })
assert.equal(spawnedAgent.status, 200)
assert.equal(typeof spawnedAgent.body.name, 'string')
assert.ok(Array.isArray(spawnedAgent.body.strategyTags))

const debate = await post('/ai/agent-debate', {
  marketId: String(marketBase),
  marketTitle: 'Will Monad process the demo milestone?',
  marketDescription: 'Testnet milestone market',
  agentAName: 'Quant Q7',
  agentAPrompt: 'Use Bayesian evidence.',
  agentBName: 'Contrarian CX',
  agentBPrompt: 'Fade crowded consensus.',
})
assert.equal(debate.status, 200)
assert.equal(typeof debate.body.agentA.argument, 'string')
assert.equal(typeof debate.body.agentB.confidence, 'number')

const agentHealth = await request('/agents/leaderboard')
assert.equal(agentHealth.status, 200)
assert.equal(agentHealth.body.status, 'ok')

const resting = await signedOrder({ marketId: marketBase + 1, side: 'LAY', tif: 'GTC', nonce: marketBase + 1, size: '2000000000000000000' })
assert.equal(resting.response.body.status, 'live', JSON.stringify(resting.response.body))
const fok = await signedOrder({ marketId: marketBase + 1, side: 'BACK', tif: 'FOK', nonce: marketBase + 2 })
assert.equal(fok.response.body.status, 'matched')
const fak = await signedOrder({ marketId: marketBase + 1, side: 'BACK', tif: 'FAK', nonce: marketBase + 3, size: '2000000000000000000' })
assert.equal(fak.response.body.status, 'partially_matched')
const ioc = await signedOrder({ marketId: marketBase + 2, side: 'BACK', tif: 'IOC', nonce: marketBase + 4 })
assert.equal(ioc.response.body.status, 'partially_matched')

const postOnly = await signedOrder({ marketId: marketBase + 3, side: 'LAY', tif: 'POST_ONLY', nonce: marketBase + 5 })
assert.equal(postOnly.response.body.status, 'live')
const duplicate = await post('/orders', postOnly.body)
assert.equal(duplicate.body.error, 'DUPLICATE_ORDER')
const postOnlyReject = await signedOrder({ marketId: marketBase + 3, side: 'BACK', tif: 'POST_ONLY', nonce: marketBase + 6 })
assert.equal(postOnlyReject.response.body.error, 'INVALID_POST_ONLY_ORDER')

const gtd = await signedOrder({ marketId: marketBase + 4, side: 'LAY', tif: 'GTD', nonce: marketBase + 7 })
assert.equal(gtd.response.body.status, 'live')
assert.equal((await cancel(gtd.response.body.orderId)).body.status, 'canceled')
assert.equal((await cancel(postOnly.response.body.orderId)).body.status, 'canceled')

const lockResting = await signedOrder({ marketId: marketBase + 5, side: 'LAY', tif: 'GTC', nonce: marketBase + 8 })
assert.equal(lockResting.response.body.status, 'live')
assert.equal((await post(`/markets/${marketBase + 5}/lock`, {})).body.status, 'locked')
const lockedReject = await signedOrder({ marketId: marketBase + 5, side: 'LAY', tif: 'GTC', nonce: marketBase + 9 })
assert.equal(lockedReject.response.body.error, 'MARKET_LOCKED')

const portfolio = await request(`/portfolio/${account.address}`)
assert.equal(portfolio.body.reserved, '0')
assert.equal((await marketSnapshot(marketBase + 1)).type, 'SNAPSHOT')

const rateStatuses = []
for (let index = 0; index < 31; index += 1) {
  rateStatuses.push((await post('/ai/forecast', { wallet: `rate-${marketBase}`, marketId: marketBase })).status)
}
assert.equal(rateStatuses.filter((status) => status === 200).length, 30)
assert.equal(rateStatuses.at(-1), 429)

console.log(JSON.stringify({ ok: true, chainId: health.body.chainId, checks: ['health', 'crypto-feed', 'router', 'ai-advisory', 'agent-spawn', 'agent-debate', 'agent-leaderboard', 'GTC', 'GTD', 'IOC', 'FOK', 'FAK', 'POST_ONLY', 'duplicate-nonce', 'signed-cancel', 'sports-lock', 'websocket', 'rate-limit'] }))
