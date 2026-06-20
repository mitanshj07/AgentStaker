import { encodeAbiParameters, formatEther, getAddress, isAddress, keccak256, parseEther, stringToHex, type Address, type Hash } from 'viem'
import type { Outcome, ParlayLeg } from '../types'
import { formatMON } from './format'
import { CONTRACT_WRITES_ENABLED, getInjectedWalletClient, publicClient, waitForMonadFinality } from './monad'

const ammPoolAbi = [{
  type: 'function',
  name: 'buy',
  stateMutability: 'payable',
  inputs: [
    { name: 'marketId', type: 'uint256' },
    { name: 'outcomeIndex', type: 'uint256' },
    { name: 'minSharesOut', type: 'uint256' },
  ],
  outputs: [{ name: 'sharesOut', type: 'uint256' }],
}, {
  type: 'function',
  name: 'redeem',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'marketId', type: 'uint256' }],
  outputs: [],
}] as const

const marketFactoryAbi = [
  {
    type: 'function',
    name: 'nextMarketId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'createBinaryMarket',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'question', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'lockTime', type: 'uint64' },
      { name: 'resolveTime', type: 'uint64' },
      { name: 'resolutionSource', type: 'address' },
    ],
    outputs: [{ name: 'marketId', type: 'uint256' }],
  },
] as const

const ammPoolCreateAbi = [{
  type: 'function',
  name: 'createPool',
  stateMutability: 'payable',
  inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'feeRateBps', type: 'uint256' }],
  outputs: [],
}] as const

const parlayEngineAbi = [
  {
    type: 'function',
    name: 'nextParlayId',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'createParlay',
    stateMutability: 'payable',
    inputs: [
      {
        name: 'legs',
        type: 'tuple[]',
        components: [
          { name: 'marketId', type: 'uint256' },
          { name: 'outcomeIndex', type: 'uint256' },
          { name: 'oddsAtTime', type: 'uint256' },
        ],
      },
      { name: 'maxPayout', type: 'uint256' },
    ],
    outputs: [{ name: 'parlayId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'quoteCashout',
    stateMutability: 'view',
    inputs: [{ name: 'parlayId', type: 'uint256' }],
    outputs: [{ name: 'cashoutValue', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'cashoutParlay',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'parlayId', type: 'uint256' }, { name: 'minPayout', type: 'uint256' }],
    outputs: [{ name: 'payout', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'settleParlay',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'parlayId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'parlayId', type: 'uint256' }],
    outputs: [],
  },
] as const

const socialMarketAbi = [
  {
    type: 'function',
    name: 'createMarket',
    stateMutability: 'payable',
    inputs: [
      { name: 'contentUrl', type: 'string' },
      { name: 'handle', type: 'string' },
      { name: 'platform', type: 'uint8' },
      { name: 'metric', type: 'uint8' },
      { name: 'startValue', type: 'uint256' },
      { name: 'targetValue', type: 'uint256' },
      { name: 'resolveTime', type: 'uint64' },
    ],
    outputs: [{ name: 'marketId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'bet',
    stateMutability: 'payable',
    inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'side', type: 'bool' }],
    outputs: [{ name: 'slipTokenId', type: 'uint256' }],
  },
] as const

const leagueFactoryAbi = [{
  type: 'function',
  name: 'joinLeague',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'leagueId', type: 'uint256' }],
  outputs: [],
}] as const

const fantasyContestAbi = [{
  type: 'function',
  name: 'submitLineup',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'contestId', type: 'uint256' }, { name: 'picksHash', type: 'bytes32' }],
  outputs: [],
}] as const

const oracleCouncilAbi = [{
  type: 'function',
  name: 'commitResult',
  stateMutability: 'payable',
  inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'commitHash', type: 'bytes32' }],
  outputs: [],
}, {
  type: 'function',
  name: 'revealResult',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'outcomeIndex', type: 'uint256' }, { name: 'salt', type: 'bytes32' }],
  outputs: [],
}, {
  type: 'function',
  name: 'challengeResult',
  stateMutability: 'payable',
  inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'proposedOutcome', type: 'uint256' }],
  outputs: [],
}, {
  type: 'function',
  name: 'resolveChallenge',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'marketId', type: 'uint256' }, { name: 'finalOutcome', type: 'uint256' }],
  outputs: [],
}, {
  type: 'function',
  name: 'finalizeResult',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'marketId', type: 'uint256' }],
  outputs: [],
}] as const

const sharedLiquidityVaultAbi = [{
  type: 'function',
  name: 'deposit',
  stateMutability: 'payable',
  inputs: [],
  outputs: [{ name: 'shares', type: 'uint256' }],
}, {
  type: 'function',
  name: 'pendingWithdrawal',
  stateMutability: 'view',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }],
}, {
  type: 'function',
  name: 'requestWithdraw',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'shares', type: 'uint256' }, { name: 'minAssets', type: 'uint256' }],
  outputs: [],
}, {
  type: 'function',
  name: 'processWithdrawal',
  stateMutability: 'nonpayable',
  inputs: [{ name: 'user', type: 'address' }],
  outputs: [],
}, {
  type: 'function',
  name: 'rebalance',
  stateMutability: 'nonpayable',
  inputs: [
    { name: 'fromMarket', type: 'uint256' },
    { name: 'toMarket', type: 'uint256' },
    { name: 'amount', type: 'uint256' },
    { name: 'minReceived', type: 'uint256' },
  ],
  outputs: [],
}] as const

export type ContractProgress = 'AWAITING_SIGNATURE' | 'PROPOSED' | 'FINALIZED'

export type ContractWriteResult = {
  mode: 'ON_CHAIN' | 'DEMO_FALLBACK'
  message: string
  hash?: Hash
  onChainId?: number
  withdrawalQueued?: boolean
}

type ProgressHandler = (stage: ContractProgress, hash?: Hash) => void

export const DEMO_FALLBACK_ENABLED = import.meta.env.VITE_ENABLE_DEMO_FALLBACK !== 'false'
export const REAL_TESTNET_TRANSACTIONS_REQUIRED = CONTRACT_WRITES_ENABLED && !DEMO_FALLBACK_ENABLED
const MARKET_FACTORY = addressOrNull(import.meta.env.VITE_MARKET_FACTORY)
const AMM_POOL = addressOrNull(import.meta.env.VITE_AMM_POOL)
const PARLAY_ENGINE = addressOrNull(import.meta.env.VITE_PARLAY_ENGINE)
const SOCIAL_MARKET = addressOrNull(import.meta.env.VITE_SOCIAL_MARKET)
const LEAGUE_FACTORY = addressOrNull(import.meta.env.VITE_LEAGUE_FACTORY)
const FANTASY_CONTEST = addressOrNull(import.meta.env.VITE_FANTASY_CONTEST)
const ORACLE_COUNCIL = addressOrNull(import.meta.env.VITE_ORACLE_COUNCIL)
const SHARED_LIQUIDITY_VAULT = addressOrNull(import.meta.env.VITE_SHARED_LIQUIDITY_VAULT)
const EXCHANGE_BOOK = addressOrNull(import.meta.env.VITE_EXCHANGE_BOOK)
const RESPONSIBLE_LIMITS = addressOrNull(import.meta.env.VITE_RESPONSIBLE_LIMITS)
const AI_PASS = addressOrNull(import.meta.env.VITE_AI_PASS)
const CREATOR_VAULT = addressOrNull(import.meta.env.VITE_CREATOR_VAULT)
const REPUTATION = addressOrNull(import.meta.env.VITE_REPUTATION)
const RISK_GOVERNOR = addressOrNull(import.meta.env.VITE_RISK_GOVERNOR)
const FORECAST_ARENA = addressOrNull(import.meta.env.VITE_FORECAST_ARENA)
const BET_SLIP_NFT = addressOrNull(import.meta.env.VITE_BET_SLIP_NFT)
const BATTLE_ARENA = addressOrNull(import.meta.env.VITE_BATTLE_ARENA)
const SIGNAL_MARKETPLACE = addressOrNull(import.meta.env.VITE_SIGNAL_MARKETPLACE)
const ORACLE_DEMO_SALT = keccak256(stringToHex('arenax-oracle-demo-salt'))
const defaultMarketMap = '101:1,102:2,103:3,109:4'
const marketIdMap = parseMarketIdMap(import.meta.env.VITE_MARKET_ID_MAP ?? defaultMarketMap)
const SEEDED_SOCIAL_MARKET_ID = positiveInteger(import.meta.env.VITE_SEEDED_SOCIAL_MARKET_ID, 1)
const SEEDED_LEAGUE_ID = positiveInteger(import.meta.env.VITE_SEEDED_LEAGUE_ID, 1)
const SEEDED_CONTEST_ID = positiveInteger(import.meta.env.VITE_SEEDED_CONTEST_ID, 1)

function addressOrNull(value: string | undefined) {
  return value && isAddress(value) ? getAddress(value) : null
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseMarketIdMap(value: string) {
  const entries = value.split(',').map((item) => item.trim()).filter(Boolean).flatMap((item) => {
    const [uiId, chainId] = item.split(':').map(Number)
    return Number.isInteger(uiId) && Number.isInteger(chainId) && uiId > 0 && chainId > 0 ? [[uiId, chainId] as const] : []
  })
  return new Map(entries)
}

function asWei(value: number) {
  return parseEther(Math.max(0, value).toFixed(6))
}

function outcomeIndex(outcome: Outcome) {
  return outcome === 'YES' ? 0n : 1n
}

function realTestnetError(message: string) {
  return message.replace(/^Demo fallback:\s*/i, 'Real testnet setup required: ')
}

export function localFallbackResult(message: string): ContractWriteResult {
  if (!DEMO_FALLBACK_ENABLED) throw new Error(realTestnetError(message))
  return { mode: 'DEMO_FALLBACK', message }
}

function fallback(message: string): ContractWriteResult {
  if (!DEMO_FALLBACK_ENABLED) throw new Error(realTestnetError(message))
  return { mode: 'DEMO_FALLBACK', message }
}

function preflight(owner: Address | null, address: Address | null, module: string) {
  if (!CONTRACT_WRITES_ENABLED) return `Demo fallback: enable VITE_ENABLE_CONTRACT_WRITES after deploying ${module}.`
  if (!address) return `Demo fallback: add the deployed ${module} address.`
  if (!owner) return `Demo fallback: connect a Monad testnet wallet before signing ${module}.`
  return null
}

async function finalize(hash: Hash, message: string, onProgress?: ProgressHandler, onChainId?: number): Promise<ContractWriteResult> {
  onProgress?.('PROPOSED', hash)
  await waitForMonadFinality(hash)
  onProgress?.('FINALIZED', hash)
  return { mode: 'ON_CHAIN', hash, message, onChainId }
}

export function getContractRuntimeSummary() {
  const contracts = [
    ['Factory', MARKET_FACTORY],
    ['AMM', AMM_POOL],
    ['Parlay', PARLAY_ENGINE],
    ['Oracle', ORACLE_COUNCIL],
    ['Exchange', EXCHANGE_BOOK],
    ['Responsible Limits', RESPONSIBLE_LIMITS],
    ['AI Pass', AI_PASS],
    ['Creator Vault', CREATOR_VAULT],
    ['Reputation', REPUTATION],
    ['League', LEAGUE_FACTORY],
    ['Risk Governor', RISK_GOVERNOR],
    ['LP Vault', SHARED_LIQUIDITY_VAULT],
    ['Forecast Arena', FORECAST_ARENA],
    ['BetSlip NFT', BET_SLIP_NFT],
    ['Social', SOCIAL_MARKET],
    ['Battle Arena', BATTLE_ARENA],
    ['DFS', FANTASY_CONTEST],
    ['Signal Marketplace', SIGNAL_MARKETPLACE],
  ] as const
  const configured = contracts.filter(([, address]) => address).length
  return {
    configured,
    contracts,
    marketMappings: marketIdMap.size,
    mode: CONTRACT_WRITES_ENABLED && configured > 0 ? 'CONTRACT_READY' : 'DEMO_FALLBACK',
    demoFallbackEnabled: DEMO_FALLBACK_ENABLED,
    realTransactionsRequired: REAL_TESTNET_TRANSACTIONS_REQUIRED,
    writesEnabled: CONTRACT_WRITES_ENABLED,
  } as const
}

export function resolveOnChainMarketId(uiMarketId: number) {
  return marketIdMap.get(uiMarketId) ?? null
}

export function resolveUiMarketId(onChainMarketId: number) {
  for (const [uiMarketId, mappedOnChainId] of marketIdMap.entries()) {
    if (mappedOnChainId === onChainMarketId) return uiMarketId
  }
  return null
}

export async function writeAmmBuy(params: { owner: Address | null; uiMarketId: number; onChainMarketId?: number; outcome: Outcome; stakeMON: number; minSharesOut: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, AMM_POOL, 'AMM_POOL')
  const marketId = params.onChainMarketId ?? resolveOnChainMarketId(params.uiMarketId)
  if (blocked) return fallback(blocked)
  if (!marketId) return fallback(`Demo fallback: map UI market #${params.uiMarketId} in VITE_MARKET_ID_MAP before AMM signing.`)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: AMM_POOL!,
    abi: ammPoolAbi,
    functionName: 'buy',
    args: [BigInt(marketId), outcomeIndex(params.outcome), asWei(params.minSharesOut)],
    value: asWei(params.stakeMON),
  })
  return finalize(hash, `AMM buy finalized on Monad testnet for market #${marketId}.`, params.onProgress)
}

export async function writeCreateBinaryMarket(params: { owner: Address | null; question: string; category: string; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, MARKET_FACTORY, 'MARKET_FACTORY')
  if (blocked) return fallback(blocked)
  const nextId = await publicClient.readContract({ address: MARKET_FACTORY!, abi: marketFactoryAbi, functionName: 'nextMarketId' })
  const now = Math.floor(Date.now() / 1000)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: MARKET_FACTORY!,
    abi: marketFactoryAbi,
    functionName: 'createBinaryMarket',
    args: [params.question, params.category, BigInt(now + 2 * 24 * 60 * 60), BigInt(now + 3 * 24 * 60 * 60), params.owner!],
  })
  return finalize(hash, `Creator market #${nextId} finalized on Monad testnet.`, params.onProgress, Number(nextId))
}

export async function writeCreateAmmPool(params: { owner: Address | null; marketId: number; liquidityMON: number; feeRateBps?: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, AMM_POOL, 'AMM_POOL')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: AMM_POOL!,
    abi: ammPoolCreateAbi,
    functionName: 'createPool',
    args: [BigInt(params.marketId), BigInt(params.feeRateBps ?? 200)],
    value: asWei(params.liquidityMON),
  })
  return finalize(hash, `AMM pool for market #${params.marketId} seeded with ${params.liquidityMON.toFixed(2)} MON.`, params.onProgress)
}

export async function writeCreateParlay(params: { owner: Address | null; legs: ParlayLeg[]; stakeMON: number; maxPayoutMON: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, PARLAY_ENGINE, 'PARLAY_ENGINE')
  if (blocked) return fallback(blocked)
  const mappedLegs = params.legs.map((leg) => ({ ...leg, onChainMarketId: resolveOnChainMarketId(leg.marketId) }))
  if (mappedLegs.some((leg) => !leg.onChainMarketId)) return fallback('Demo fallback: map every selected parlay leg in VITE_MARKET_ID_MAP before signing.')
  const nextId = await publicClient.readContract({ address: PARLAY_ENGINE!, abi: parlayEngineAbi, functionName: 'nextParlayId' })
  const contractLegs = mappedLegs.map((leg) => ({ marketId: BigInt(leg.onChainMarketId!), outcomeIndex: outcomeIndex(leg.outcome), oddsAtTime: 0n }))
  const maxPayout = asWei(params.maxPayoutMON)
  const stakeValue = asWei(params.stakeMON)
  await publicClient.simulateContract({
    account: params.owner!,
    address: PARLAY_ENGINE!,
    abi: parlayEngineAbi,
    functionName: 'createParlay',
    args: [contractLegs, maxPayout],
    value: stakeValue,
  })
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: PARLAY_ENGINE!,
    abi: parlayEngineAbi,
    functionName: 'createParlay',
    args: [contractLegs, maxPayout],
    value: stakeValue,
  })
  return finalize(hash, `Parlay NFT #${nextId} finalized on Monad testnet.`, params.onProgress, Number(nextId))
}

export async function readParlayCashout(parlayId: number) {
  if (!PARLAY_ENGINE || !CONTRACT_WRITES_ENABLED) return null
  const quote = await publicClient.readContract({ address: PARLAY_ENGINE, abi: parlayEngineAbi, functionName: 'quoteCashout', args: [BigInt(parlayId)] })
  return Number(formatEther(quote))
}

export async function writeParlayCashout(params: { owner: Address | null; parlayId: number; minPayoutMON: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, PARLAY_ENGINE, 'PARLAY_ENGINE')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: PARLAY_ENGINE!,
    abi: parlayEngineAbi,
    functionName: 'cashoutParlay',
    args: [BigInt(params.parlayId), asWei(params.minPayoutMON)],
  })
  return finalize(hash, `Parlay #${params.parlayId} cashout finalized on Monad testnet.`, params.onProgress)
}

export async function writeCreateSocialMarket(params: { owner: Address | null; contentUrl: string; handle: string; startValue: number; targetValue: number; resolveTime: number; prizePoolMON?: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, SOCIAL_MARKET, 'SOCIAL_MARKET')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: SOCIAL_MARKET!,
    abi: socialMarketAbi,
    functionName: 'createMarket',
    args: [params.contentUrl, params.handle, 1, 0, BigInt(params.startValue), BigInt(params.targetValue), BigInt(params.resolveTime)],
    value: asWei(params.prizePoolMON ?? 0),
  })
  return finalize(hash, 'Social milestone market finalized on Monad testnet.', params.onProgress)
}

export async function writeSocialBet(params: { owner: Address | null; side: boolean; stakeMON: number; marketId?: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, SOCIAL_MARKET, 'SOCIAL_MARKET')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const marketId = params.marketId ?? SEEDED_SOCIAL_MARKET_ID
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: SOCIAL_MARKET!,
    abi: socialMarketAbi,
    functionName: 'bet',
    args: [BigInt(marketId), params.side],
    value: asWei(params.stakeMON),
  })
  return finalize(hash, `Social ${params.side ? 'YES' : 'NO'} slip finalized on Monad testnet.`, params.onProgress)
}

export async function writeJoinPointsLeague(params: { owner: Address | null; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, LEAGUE_FACTORY, 'LEAGUE_FACTORY')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: LEAGUE_FACTORY!,
    abi: leagueFactoryAbi,
    functionName: 'joinLeague',
    args: [BigInt(SEEDED_LEAGUE_ID)],
  })
  return finalize(hash, `Joined points-only league #${SEEDED_LEAGUE_ID} on Monad testnet.`, params.onProgress)
}

export async function writeSubmitFantasyLineup(params: { owner: Address | null; picks: string[]; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, FANTASY_CONTEST, 'FANTASY_CONTEST')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: FANTASY_CONTEST!,
    abi: fantasyContestAbi,
    functionName: 'submitLineup',
    args: [BigInt(SEEDED_CONTEST_ID), keccak256(stringToHex(params.picks.join('|')))],
  })
  return finalize(hash, `DFS lineup locked in contest #${SEEDED_CONTEST_ID} on Monad testnet.`, params.onProgress)
}

export async function writeAmmRedeem(params: { owner: Address | null; uiMarketId: number; onChainMarketId?: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, AMM_POOL, 'AMM_POOL')
  const marketId = params.onChainMarketId ?? resolveOnChainMarketId(params.uiMarketId)
  if (blocked) return fallback(blocked)
  if (!marketId) return fallback(`Demo fallback: map UI market #${params.uiMarketId} in VITE_MARKET_ID_MAP before redeeming.`)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: AMM_POOL!,
    abi: ammPoolAbi,
    functionName: 'redeem',
    args: [BigInt(marketId)],
  })
  return finalize(hash, `AMM payout for market #${marketId} finalized on Monad testnet.`, params.onProgress)
}

export async function writeSettleParlay(params: { owner: Address | null; parlayId: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, PARLAY_ENGINE, 'PARLAY_ENGINE')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: PARLAY_ENGINE!,
    abi: parlayEngineAbi,
    functionName: 'settleParlay',
    args: [BigInt(params.parlayId)],
  })
  return finalize(hash, `Parlay #${params.parlayId} settlement finalized on Monad testnet.`, params.onProgress)
}

export async function writeClaimParlay(params: { owner: Address | null; parlayId: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, PARLAY_ENGINE, 'PARLAY_ENGINE')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: PARLAY_ENGINE!,
    abi: parlayEngineAbi,
    functionName: 'claim',
    args: [BigInt(params.parlayId)],
  })
  return finalize(hash, `Parlay NFT #${params.parlayId} payout finalized on Monad testnet.`, params.onProgress)
}

function oracleCommitHash(marketId: number, outcome: Outcome) {
  return keccak256(encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'bytes32' }],
    [BigInt(marketId), outcomeIndex(outcome), ORACLE_DEMO_SALT],
  ))
}

export async function writeOracleCommit(params: { owner: Address | null; uiMarketId: number; onChainMarketId?: number; outcome: Outcome; bondMON?: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, ORACLE_COUNCIL, 'ORACLE_COUNCIL')
  const marketId = params.onChainMarketId ?? resolveOnChainMarketId(params.uiMarketId)
  if (blocked) return fallback(blocked)
  if (!marketId) return fallback(`Demo fallback: map UI market #${params.uiMarketId} before Oracle Court signing.`)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: ORACLE_COUNCIL!,
    abi: oracleCouncilAbi,
    functionName: 'commitResult',
    args: [BigInt(marketId), oracleCommitHash(marketId, params.outcome)],
    value: asWei(params.bondMON ?? 0.1),
  })
  return finalize(hash, `Oracle result commitment for market #${marketId} finalized on Monad testnet.`, params.onProgress)
}

export async function writeOracleReveal(params: { owner: Address | null; uiMarketId: number; onChainMarketId?: number; outcome: Outcome; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, ORACLE_COUNCIL, 'ORACLE_COUNCIL')
  const marketId = params.onChainMarketId ?? resolveOnChainMarketId(params.uiMarketId)
  if (blocked) return fallback(blocked)
  if (!marketId) return fallback(`Demo fallback: map UI market #${params.uiMarketId} before Oracle Court signing.`)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: ORACLE_COUNCIL!,
    abi: oracleCouncilAbi,
    functionName: 'revealResult',
    args: [BigInt(marketId), outcomeIndex(params.outcome), ORACLE_DEMO_SALT],
  })
  return finalize(hash, `Oracle result reveal for market #${marketId} finalized on Monad testnet.`, params.onProgress)
}

export async function writeOracleChallenge(params: { owner: Address | null; uiMarketId: number; onChainMarketId?: number; outcome: Outcome; bondMON?: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, ORACLE_COUNCIL, 'ORACLE_COUNCIL')
  const marketId = params.onChainMarketId ?? resolveOnChainMarketId(params.uiMarketId)
  if (blocked) return fallback(blocked)
  if (!marketId) return fallback(`Demo fallback: map UI market #${params.uiMarketId} before Oracle Court signing.`)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: ORACLE_COUNCIL!,
    abi: oracleCouncilAbi,
    functionName: 'challengeResult',
    args: [BigInt(marketId), outcomeIndex(params.outcome)],
    value: asWei(params.bondMON ?? 0.1),
  })
  return finalize(hash, `Oracle challenge for market #${marketId} finalized on Monad testnet.`, params.onProgress)
}

export async function writeOracleFinalize(params: { owner: Address | null; uiMarketId: number; onChainMarketId?: number; outcome: Outcome; challenged: boolean; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, ORACLE_COUNCIL, 'ORACLE_COUNCIL')
  const marketId = params.onChainMarketId ?? resolveOnChainMarketId(params.uiMarketId)
  if (blocked) return fallback(blocked)
  if (!marketId) return fallback(`Demo fallback: map UI market #${params.uiMarketId} before Oracle Court signing.`)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: ORACLE_COUNCIL!,
    abi: oracleCouncilAbi,
    functionName: params.challenged ? 'resolveChallenge' : 'finalizeResult',
    args: params.challenged ? [BigInt(marketId), outcomeIndex(params.outcome)] : [BigInt(marketId)],
  })
  return finalize(hash, `Oracle finalization for market #${marketId} finalized on Monad testnet.`, params.onProgress)
}

export async function writeVaultDeposit(params: { owner: Address | null; assetsMON: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, SHARED_LIQUIDITY_VAULT, 'SHARED_LIQUIDITY_VAULT')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: SHARED_LIQUIDITY_VAULT!,
    abi: sharedLiquidityVaultAbi,
    functionName: 'deposit',
    value: asWei(params.assetsMON),
  })
  return finalize(hash, `${formatMON(params.assetsMON)} deposited into SharedLiquidityVault on Monad testnet.`, params.onProgress)
}

export async function writeVaultWithdraw(params: { owner: Address | null; sharesMON: number; minAssetsMON?: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, SHARED_LIQUIDITY_VAULT, 'SHARED_LIQUIDITY_VAULT')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: SHARED_LIQUIDITY_VAULT!,
    abi: sharedLiquidityVaultAbi,
    functionName: 'requestWithdraw',
    args: [asWei(params.sharesMON), asWei(params.minAssetsMON ?? params.sharesMON * 0.98)],
  })
  const result = await finalize(hash, `${formatMON(params.sharesMON)} LP shares submitted for withdrawal on Monad testnet.`, params.onProgress)
  const pendingAssets = await publicClient.readContract({
    address: SHARED_LIQUIDITY_VAULT!,
    abi: sharedLiquidityVaultAbi,
    functionName: 'pendingWithdrawal',
    args: [params.owner!],
  })
  return {
    ...result,
    withdrawalQueued: pendingAssets > 0n,
    message: pendingAssets > 0n
      ? `${formatMON(params.sharesMON)} LP shares entered the pull-based Monad withdrawal queue.`
      : `${formatMON(params.sharesMON)} LP shares were paid immediately from idle vault liquidity.`,
  }
}

export async function writeVaultProcessWithdrawal(params: { owner: Address | null; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, SHARED_LIQUIDITY_VAULT, 'SHARED_LIQUIDITY_VAULT')
  if (blocked) return fallback(blocked)
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: SHARED_LIQUIDITY_VAULT!,
    abi: sharedLiquidityVaultAbi,
    functionName: 'processWithdrawal',
    args: [params.owner!],
  })
  return finalize(hash, 'Queued LP withdrawal processed on Monad testnet.', params.onProgress)
}

export async function writeVaultRebalance(params: { owner: Address | null; fromUiMarketId: number; toUiMarketId: number; amountMON: number; minReceivedMON?: number; onProgress?: ProgressHandler }) {
  const blocked = preflight(params.owner, SHARED_LIQUIDITY_VAULT, 'SHARED_LIQUIDITY_VAULT')
  const fromMarket = resolveOnChainMarketId(params.fromUiMarketId)
  const toMarket = resolveOnChainMarketId(params.toUiMarketId)
  if (blocked) return fallback(blocked)
  if (!fromMarket || !toMarket) return fallback('Demo fallback: map both rebalance markets before vault signing.')
  params.onProgress?.('AWAITING_SIGNATURE')
  const hash = await getInjectedWalletClient().writeContract({
    account: params.owner!,
    address: SHARED_LIQUIDITY_VAULT!,
    abi: sharedLiquidityVaultAbi,
    functionName: 'rebalance',
    args: [BigInt(fromMarket), BigInt(toMarket), asWei(params.amountMON), asWei(params.minReceivedMON ?? params.amountMON * 0.98)],
  })
  return finalize(hash, `${formatMON(params.amountMON)} rebalanced through SharedLiquidityVault on Monad testnet.`, params.onProgress)
}
