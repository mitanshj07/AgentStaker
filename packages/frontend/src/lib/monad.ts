import { createPublicClient, createWalletClient, custom, defineChain, formatEther, getAddress, http, isAddress, parseEther, type EIP1193Provider, type Hash } from 'viem'

export const ARENAX_APP_MODE = import.meta.env.VITE_APP_MODE ?? 'TESTNET_ONLY'
export const REAL_MONEY_ENABLED = import.meta.env.VITE_ENABLE_REAL_MONEY === 'true'
export const CONTRACT_WRITES_ENABLED = import.meta.env.VITE_ENABLE_CONTRACT_WRITES === 'true'
export const MONAD_RPC_URL = import.meta.env.VITE_MONAD_RPC_URL ?? 'https://testnet-rpc.monad.xyz'

export const MONAD_TESTNET = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'MON',
    symbol: 'MON',
  },
  rpcUrls: {
    default: { http: [MONAD_RPC_URL] },
    public: { http: [MONAD_RPC_URL] },
  },
  blockExplorers: {
    default: {
      name: 'Monad Explorer',
      url: 'https://testnet.monadexplorer.com',
    },
    monadscan: {
      name: 'Monadscan',
      url: 'https://testnet.monadscan.com',
    },
  },
  testnet: true,
})

export const MONAD_BLOCK_TIME_MS = 400
export const MONAD_FINALITY_BLOCKS = 2
export const MONAD_FINALITY_MS = MONAD_BLOCK_TIME_MS * MONAD_FINALITY_BLOCKS

export const publicClient = createPublicClient({
  chain: MONAD_TESTNET,
  transport: http(MONAD_RPC_URL),
})

export type MonadStatus = {
  blockNumber: bigint
  chainId: number
  gasPriceWei: bigint
  latencyMs: number
  ok: boolean
  updatedAt: number
}

export type WalletState = {
  address: `0x${string}` | null
  balanceMON: string
  chainId: number | null
  connected: boolean
  error: string | null
}

type WalletProvider = EIP1193Provider & {
  isMetaMask?: boolean
  providers?: WalletProvider[]
  on?: (event: 'accountsChanged' | 'chainChanged' | 'connect' | 'disconnect', listener: (...args: unknown[]) => void) => void
  removeListener?: (event: 'accountsChanged' | 'chainChanged' | 'connect' | 'disconnect', listener: (...args: unknown[]) => void) => void
}

declare global {
  interface Window {
    ethereum?: WalletProvider
  }
}

const MONAD_CHAIN_HEX = `0x${MONAD_TESTNET.id.toString(16)}`

function getWalletProvider() {
  const provider = window.ethereum
  if (!provider?.providers?.length) return provider
  return provider.providers.find((candidate) => candidate.isMetaMask) ?? provider.providers[0] ?? provider
}

function errorCode(error: unknown) {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'number' || typeof code === 'string' ? String(code) : null
  }
  return null
}

function errorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return null
}

function isUnknownChainError(error: unknown) {
  const code = errorCode(error)
  const message = errorMessage(error)?.toLowerCase() ?? ''
  return code === '4902' || message.includes('unrecognized chain') || message.includes('not added') || message.includes('unknown chain')
}

function normalizeAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== 'string' || !isAddress(value)) return null
  return getAddress(value) as `0x${string}`
}

function normalizeChainId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'string') {
    const parsed = value.startsWith('0x') ? Number.parseInt(value, 16) : Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

async function getProviderChainId(provider: WalletProvider) {
  const chainId = await provider.request({ method: 'eth_chainId' })
  return normalizeChainId(chainId)
}

async function addMonadTestnet(provider: WalletProvider) {
  await provider.request({
    method: 'wallet_addEthereumChain',
    params: [
      {
        blockExplorerUrls: [MONAD_TESTNET.blockExplorers.default.url, MONAD_TESTNET.blockExplorers.monadscan.url],
        chainId: MONAD_CHAIN_HEX,
        chainName: MONAD_TESTNET.name,
        nativeCurrency: MONAD_TESTNET.nativeCurrency,
        rpcUrls: MONAD_TESTNET.rpcUrls.default.http,
      },
    ],
  })
}

export function hasInjectedWallet() {
  return Boolean(getWalletProvider())
}

export async function ensureMonadTestnet() {
  const provider = getWalletProvider()
  if (!provider) throw new Error('No injected wallet found. Install MetaMask, Rabby, OKX, Backpack, or another EVM wallet.')

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_CHAIN_HEX }],
    })
  } catch (error) {
    if (!isUnknownChainError(error)) throw error
    await addMonadTestnet(provider)
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_CHAIN_HEX }],
    })
  }

  return provider
}

export async function readConnectedMonadWallet(): Promise<WalletState> {
  const provider = getWalletProvider()
  if (!provider) {
    return {
      address: null,
      balanceMON: '0',
      chainId: null,
      connected: false,
      error: null,
    }
  }

  const [chainId, accounts] = await Promise.all([
    getProviderChainId(provider),
    provider.request({ method: 'eth_accounts' }) as Promise<unknown>,
  ])
  const address = Array.isArray(accounts) ? normalizeAddress(accounts[0]) : null

  if (!address) {
    return {
      address: null,
      balanceMON: '0',
      chainId,
      connected: false,
      error: null,
    }
  }

  const balance = await publicClient.getBalance({ address })
  const connected = chainId === MONAD_TESTNET.id
  return {
    address,
    balanceMON: Number(formatEther(balance)).toFixed(4),
    chainId,
    connected,
    error: connected ? null : `Wrong network. Expected Monad Testnet ${MONAD_TESTNET.id}.`,
  }
}

export async function fetchMonadStatus(): Promise<MonadStatus> {
  const started = performance.now()
  const [blockNumber, chainId, gasPriceWei] = await Promise.all([
    publicClient.getBlockNumber(),
    publicClient.getChainId(),
    publicClient.getGasPrice(),
  ])

  return {
    blockNumber,
    chainId,
    gasPriceWei,
    latencyMs: Math.round(performance.now() - started),
    ok: chainId === MONAD_TESTNET.id,
    updatedAt: Date.now(),
  }
}

export async function requestMonadWallet(): Promise<WalletState> {
  const provider = getWalletProvider()
  if (!provider) {
    return {
      address: null,
      balanceMON: '0',
      chainId: null,
      connected: false,
      error: 'No injected wallet found. Install MetaMask, Rabby, OKX, Backpack, or another EVM wallet.',
    }
  }

  const accounts = (await provider.request({
    method: 'eth_requestAccounts',
  })) as unknown
  const address = Array.isArray(accounts) ? normalizeAddress(accounts[0]) : null
  if (!address) throw new Error('Wallet did not return an EVM account.')

  await ensureMonadTestnet()
  const chainId = await getProviderChainId(provider)
  const balance = await publicClient.getBalance({ address })

  return {
    address,
    balanceMON: Number(formatEther(balance)).toFixed(4),
    chainId,
    connected: chainId === MONAD_TESTNET.id,
    error: chainId === MONAD_TESTNET.id ? null : `Wrong network. Expected Monad Testnet ${MONAD_TESTNET.id}.`,
  }
}

export function getInjectedWalletClient() {
  const provider = getWalletProvider()
  if (!provider) throw new Error('No injected wallet found. Connect an EVM wallet before signing.')
  return createWalletClient({
    chain: MONAD_TESTNET,
    transport: custom(provider),
  })
}

export async function waitForMonadFinality(hash: Hash) {
  return publicClient.waitForTransactionReceipt({
    confirmations: MONAD_FINALITY_BLOCKS,
    hash,
  })
}

export async function sendZeroValueHeartbeat(address: `0x${string}`) {
  const provider = await ensureMonadTestnet()
  return provider.request({
    method: 'eth_sendTransaction',
    params: [
      {
        chainId: MONAD_CHAIN_HEX,
        from: address,
        to: address,
        value: `0x${parseEther('0').toString(16)}`,
      },
    ],
  }) as Promise<`0x${string}`>
}
