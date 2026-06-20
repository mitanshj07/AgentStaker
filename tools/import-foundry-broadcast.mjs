import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ADDRESS_PATTERN, CONTRACTS, buildManifest, parseEnv } from './deployment-config.mjs'

const contractNameToEnv = new Map([
  ['MarketFactory', 'MARKET_FACTORY'],
  ['AMMPool', 'AMM_POOL'],
  ['ParlayEngine', 'PARLAY_ENGINE'],
  ['OracleCouncil', 'ORACLE_COUNCIL'],
  ['ExchangeBook', 'EXCHANGE_BOOK'],
  ['ResponsibleLimits', 'RESPONSIBLE_LIMITS'],
  ['AIPass', 'AI_PASS'],
  ['CreatorVault', 'CREATOR_VAULT'],
  ['RiskGovernor', 'RISK_GOVERNOR'],
  ['SharedLiquidityVault', 'SHARED_LIQUIDITY_VAULT'],
  ['ForecastArena', 'FORECAST_ARENA'],
  ['Reputation', 'REPUTATION'],
  ['LeagueFactory', 'LEAGUE_FACTORY'],
  ['BetSlipNFT', 'BET_SLIP_NFT'],
  ['SocialMarket', 'SOCIAL_MARKET'],
  ['BattleArena', 'BATTLE_ARENA'],
  ['FantasyContest', 'FANTASY_CONTEST'],
  ['SignalMarketplace', 'SIGNAL_MARKETPLACE'],
])

const root = process.cwd()
const broadcastPath = resolve(root, 'packages/contracts/broadcast/Deploy.s.sol/10143/run-latest.json')
if (!existsSync(broadcastPath)) {
  throw new Error(`Missing Foundry broadcast file: ${broadcastPath}`)
}

const broadcast = JSON.parse(readFileSync(broadcastPath, 'utf8'))
const deployed = new Map()
for (const tx of broadcast.transactions ?? []) {
  const envName = contractNameToEnv.get(tx.contractName)
  if (!envName || !ADDRESS_PATTERN.test(tx.contractAddress ?? '')) continue
  deployed.set(envName, tx.contractAddress)
}

const missing = [...contractNameToEnv.values()].filter((envName) => !deployed.has(envName))
if (missing.length) {
  throw new Error(`Broadcast did not include deployed addresses for: ${missing.join(', ')}`)
}

function parseBlock(value) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') return value.startsWith('0x') ? Number.parseInt(value, 16) : Number(value)
  return 0
}

const deploymentBlock = Math.min(
  ...((broadcast.receipts ?? [])
    .map((receipt) => parseBlock(receipt.blockNumber))
    .filter((block) => Number.isInteger(block) && block > 0)),
)

function updateEnvFile(path, updates) {
  let lines = existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : []
  const seen = new Set()
  lines = lines.map((line) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return line
    const key = trimmed.slice(0, trimmed.indexOf('=')).trim()
    if (!updates.has(key)) return line
    seen.add(key)
    return `${key}=${updates.get(key)}`
  })
  for (const [key, value] of updates) {
    if (!seen.has(key)) lines.push(`${key}=${value}`)
  }
  writeFileSync(path, `${lines.join('\n').replace(/\n+$/, '')}\n`)
}

const sharedUpdates = new Map([
  ['VITE_APP_MODE', 'TESTNET_ONLY'],
  ['VITE_ENABLE_REAL_MONEY', 'false'],
  ['VITE_ENABLE_CONTRACT_WRITES', 'true'],
  ['VITE_ENABLE_DEMO_FALLBACK', 'false'],
  ['VITE_MONAD_CHAIN_ID', '10143'],
  ['VITE_MONAD_RPC_URL', process.env.VITE_MONAD_RPC_URL ?? 'https://testnet-rpc.monad.xyz'],
  ['VITE_MARKET_ID_MAP', '101:1,102:2,103:3,109:4'],
])

const rootUpdates = new Map(sharedUpdates)
for (const [, envName] of CONTRACTS) {
  const address = deployed.get(envName)
  rootUpdates.set(envName, address)
  rootUpdates.set(`VITE_${envName}`, address)
}
if (Number.isInteger(deploymentBlock) && deploymentBlock > 0) {
  rootUpdates.set('DEPLOYMENT_BLOCK', String(deploymentBlock))
  rootUpdates.set('START_BLOCK', String(deploymentBlock))
}
if (!rootUpdates.has('ORACLE_SOURCE')) rootUpdates.set('ORACLE_SOURCE', deployed.get('ORACLE_COUNCIL'))

const frontendUpdates = new Map(sharedUpdates)
for (const [, envName] of CONTRACTS) {
  frontendUpdates.set(`VITE_${envName}`, deployed.get(envName))
}

updateEnvFile(resolve(root, '.env'), rootUpdates)
updateEnvFile(resolve(root, 'packages/frontend/.env.local'), frontendUpdates)

const manifestValues = {
  ...parseEnv(readFileSync(resolve(root, '.env'), 'utf8')),
  ...Object.fromEntries(rootUpdates),
}
const manifestPath = resolve(root, 'packages/contracts/deployments/monad-testnet.json')
mkdirSync(dirname(manifestPath), { recursive: true })
writeFileSync(manifestPath, `${JSON.stringify(buildManifest(manifestValues), null, 2)}\n`)

console.log(`Imported ${deployed.size} Monad testnet contract addresses.`)
console.log(`Wrote ${manifestPath}`)
console.log('Restart the frontend dev server so Vite picks up the new VITE_* addresses.')
