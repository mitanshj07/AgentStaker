import { formatEther, getAddress, isAddress, type Address } from 'viem'
import { publicClient } from './monad'

const betSlipAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tokenOfOwnerByIndex',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'getSlip',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'originContract', type: 'address' },
        { name: 'originId', type: 'uint256' },
        { name: 'marketIds', type: 'uint256[]' },
        { name: 'sides', type: 'bool[]' },
        { name: 'stakeWei', type: 'uint256' },
        { name: 'oddsSnapshot1e18', type: 'uint256' },
        { name: 'createdAt', type: 'uint64' },
        { name: 'slipType', type: 'uint8' },
        { name: 'rarity', type: 'uint8' },
        { name: 'strategyHash', type: 'bytes32' },
        { name: 'status', type: 'uint8' },
      ],
    }],
  },
  {
    type: 'function',
    name: 'cardStats',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{
      name: 'stats',
      type: 'tuple',
      components: [
        { name: 'power', type: 'uint256' },
        { name: 'defense', type: 'uint256' },
        { name: 'speed', type: 'uint256' },
        { name: 'luck', type: 'uint256' },
      ],
    }],
  },
] as const

type SlipTuple = {
  originContract: Address
  originId: bigint
  marketIds: readonly bigint[]
  sides: readonly boolean[]
  stakeWei: bigint
  oddsSnapshot1e18: bigint
  createdAt: bigint
  slipType: number
  rarity: number
  strategyHash: `0x${string}`
  status: number
}

type StatsTuple = {
  power: bigint
  defense: bigint
  speed: bigint
  luck: bigint
}

export type SlipCardView = {
  id: number
  title: string
  legs: number
  odds: number
  rarity: string
  status: string
  origin: string
  tone: 'peach' | 'mint' | 'sky' | 'lavender'
  stakeMON: number
  stats: {
    power: number
    defense: number
    speed: number
    luck: number
  }
}

export type SlipReadResult = {
  cards: SlipCardView[]
  mode: 'ON_CHAIN' | 'DEMO_FALLBACK'
  message: string
}

const rarityLabels = ['Common', 'Rare', 'Epic', 'Legendary']
const statusLabels = ['Open', 'Won', 'Lost', 'Cashed out', 'Claimed', 'Voided']
const typeLabels = ['Market', 'Parlay', 'Social']
const contractLabels = ['AMMPool', 'ParlayEngine', 'SocialMarket']
const tones: SlipCardView['tone'][] = ['peach', 'mint', 'sky', 'lavender']

export const demoSlipCards: SlipCardView[] = [
  { id: 2401, title: 'Friday Crypto Pulse', legs: 3, odds: 4.18, rarity: 'Rare', status: 'Open', origin: 'ParlayEngine', tone: 'peach', stakeMON: 1.4, stats: { power: 88, defense: 72, speed: 74, luck: 91 } },
  { id: 2398, title: 'Monad Momentum', legs: 2, odds: 2.74, rarity: 'Epic', status: 'Won', origin: 'ParlayEngine', tone: 'mint', stakeMON: 1.1, stats: { power: 92, defense: 81, speed: 86, luck: 76 } },
  { id: 2391, title: 'Cricket Quick Pick', legs: 1, odds: 1.52, rarity: 'Common', status: 'Open', origin: 'AMMPool', tone: 'sky', stakeMON: 0.8, stats: { power: 66, defense: 58, speed: 83, luck: 69 } },
]

function resolveBetSlipAddress() {
  const value = import.meta.env.VITE_BET_SLIP_NFT
  return value && isAddress(value) ? getAddress(value) : null
}

function numberFrom1e18(value: bigint) {
  return Number(value) / 1e18
}

function label(labels: string[], index: number, fallback: string) {
  return labels[index] ?? fallback
}

export function getBetSlipContractAddress() {
  return resolveBetSlipAddress()
}

export async function loadWalletSlips(owner: Address | null): Promise<SlipReadResult> {
  const address = resolveBetSlipAddress()
  if (!address || !owner) {
    return { cards: demoSlipCards, mode: 'DEMO_FALLBACK', message: address ? 'Connect a wallet to load owned cards' : 'Add VITE_BET_SLIP_NFT after deployment' }
  }

  try {
    const balance = await publicClient.readContract({ address, abi: betSlipAbi, functionName: 'balanceOf', args: [owner] })
    const tokenIds = await Promise.all(
      Array.from({ length: Math.min(Number(balance), 12) }, (_, index) =>
        publicClient.readContract({ address, abi: betSlipAbi, functionName: 'tokenOfOwnerByIndex', args: [owner, BigInt(index)] }),
      ),
    )
    const cards = await Promise.all(tokenIds.map(async (tokenId) => {
      const [slip, stats] = await Promise.all([
        publicClient.readContract({ address, abi: betSlipAbi, functionName: 'getSlip', args: [tokenId] }) as Promise<SlipTuple>,
        publicClient.readContract({ address, abi: betSlipAbi, functionName: 'cardStats', args: [tokenId] }) as Promise<StatsTuple>,
      ])
      const type = Number(slip.slipType)
      const rarity = Number(slip.rarity)
      return {
        id: Number(tokenId),
        title: `${label(typeLabels, type, 'ArenaX')} slip #${tokenId}`,
        legs: slip.marketIds.length,
        odds: numberFrom1e18(slip.oddsSnapshot1e18),
        rarity: label(rarityLabels, rarity, 'Legendary'),
        status: label(statusLabels, Number(slip.status), 'Open'),
        origin: label(contractLabels, type, `Origin ${slip.originContract.slice(0, 6)}`),
        tone: tones[rarity] ?? 'lavender',
        stakeMON: Number(formatEther(slip.stakeWei)),
        stats: {
          power: Number(stats.power),
          defense: Number(stats.defense),
          speed: Number(stats.speed),
          luck: Number(stats.luck),
        },
      } satisfies SlipCardView
    }))

    return cards.length
      ? { cards, mode: 'ON_CHAIN', message: `${cards.length} owned card${cards.length === 1 ? '' : 's'} read from Monad testnet` }
      : { cards: demoSlipCards, mode: 'DEMO_FALLBACK', message: 'Wallet has no minted cards yet; showing judge-ready samples' }
  } catch {
    return { cards: demoSlipCards, mode: 'DEMO_FALLBACK', message: 'Contract read unavailable; showing local fallback cards' }
  }
}
