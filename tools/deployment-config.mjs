import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const CONTRACTS = [
  ['marketFactory', 'MARKET_FACTORY'],
  ['ammPool', 'AMM_POOL'],
  ['parlayEngine', 'PARLAY_ENGINE'],
  ['oracleCouncil', 'ORACLE_COUNCIL'],
  ['exchangeBook', 'EXCHANGE_BOOK'],
  ['responsibleLimits', 'RESPONSIBLE_LIMITS'],
  ['aiPass', 'AI_PASS'],
  ['creatorVault', 'CREATOR_VAULT'],
  ['reputation', 'REPUTATION'],
  ['leagueFactory', 'LEAGUE_FACTORY'],
  ['riskGovernor', 'RISK_GOVERNOR'],
  ['sharedLiquidityVault', 'SHARED_LIQUIDITY_VAULT'],
  ['forecastArena', 'FORECAST_ARENA'],
  ['betSlipNFT', 'BET_SLIP_NFT'],
  ['socialMarket', 'SOCIAL_MARKET'],
  ['battleArena', 'BATTLE_ARENA'],
  ['fantasyContest', 'FANTASY_CONTEST'],
  ['signalMarketplace', 'SIGNAL_MARKETPLACE'],
]

export const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

export function parseEnv(contents) {
  const values = {}
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim()
  }
  return values
}

export function loadDeploymentEnv() {
  const envPath = resolve(process.cwd(), '.env')
  const fallbackPath = resolve(process.cwd(), '.env.example')
  const source = existsSync(envPath) ? envPath : fallbackPath
  return {
    source,
    hasLocalEnv: existsSync(envPath),
    values: { ...parseEnv(readFileSync(source, 'utf8')), ...process.env },
  }
}

export function getDeploymentBlock(values) {
  return Number(values.DEPLOYMENT_BLOCK || values.START_BLOCK || 0)
}

export function buildManifest(values) {
  return {
    chainId: Number(values.VITE_MONAD_CHAIN_ID || 10143),
    network: 'monad-testnet',
    rpc: values.VITE_MONAD_RPC_URL || values.PONDER_RPC_URL || 'https://testnet-rpc.monad.xyz',
    explorer: 'https://testnet.monadexplorer.com',
    deploymentBlock: getDeploymentBlock(values),
    generatedAt: new Date().toISOString(),
    contracts: Object.fromEntries(CONTRACTS.map(([key, envName]) => [key, values[envName] || ''])),
  }
}
