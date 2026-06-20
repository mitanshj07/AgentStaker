import { ADDRESS_PATTERN, CONTRACTS, getDeploymentBlock, loadDeploymentEnv } from './deployment-config.mjs'

const allowEmpty = process.argv.includes('--allow-empty')
const verifyRpc = process.argv.includes('--rpc')
const { hasLocalEnv, source, values } = loadDeploymentEnv()
const errors = []
const warnings = []

function requireValue(name, expected) {
  if (values[name] !== expected) errors.push(`${name} must be ${expected}; received ${values[name] || '<empty>'}.`)
}

requireValue('VITE_APP_MODE', 'TESTNET_ONLY')
requireValue('VITE_ENABLE_REAL_MONEY', 'false')
requireValue('VITE_MONAD_CHAIN_ID', '10143')

if (!hasLocalEnv) warnings.push('No .env file exists yet. Copy .env.example after deploying contracts.')
if (!values.DEPLOYER_PRIVATE_KEY) warnings.push('DEPLOYER_PRIVATE_KEY is empty. Broadcast remains disabled until a funded testnet deployer is configured.')
if (!values.MATCHER_PRIVATE_KEY) warnings.push('MATCHER_PRIVATE_KEY is empty. Matcher settlement remains advisory-only until a server-side key is configured.')
if (!values.COUNCIL_ADDRESS) warnings.push('COUNCIL_ADDRESS is empty. Deploy.s.sol will default the Oracle Council to the deployer.')
if (!values.MATCHER_ADDRESS) warnings.push('MATCHER_ADDRESS is empty. Deploy.s.sol will default ExchangeBook matching authority to the deployer.')

const deploymentBlock = getDeploymentBlock(values)
if (!Number.isInteger(deploymentBlock) || deploymentBlock <= 0) {
  const message = 'DEPLOYMENT_BLOCK must be the Monad block where Deploy.s.sol broadcast started so Ponder does not scan from genesis.'
  if (allowEmpty) warnings.push(message)
  else errors.push(message)
}

const configuredAddresses = []
for (const [, envName] of CONTRACTS) {
  const address = values[envName]
  const frontendAddress = values[`VITE_${envName}`]
  if (!address) {
    const message = `${envName} is empty.`
    if (allowEmpty) warnings.push(message)
    else errors.push(message)
    continue
  }
  if (!ADDRESS_PATTERN.test(address)) errors.push(`${envName} is not a valid EVM address.`)
  else configuredAddresses.push([envName, address.toLowerCase()])
  if (!frontendAddress) errors.push(`VITE_${envName} is empty while ${envName} is configured.`)
  else if (frontendAddress.toLowerCase() !== address.toLowerCase()) errors.push(`VITE_${envName} does not match ${envName}.`)
}

const addressOwners = new Map()
for (const [envName, address] of configuredAddresses) {
  const existing = addressOwners.get(address)
  if (existing) errors.push(`${envName} duplicates ${existing} at ${address}.`)
  else addressOwners.set(address, envName)
}

async function rpcRequest(method, params = []) {
  const response = await fetch(values.PONDER_RPC_URL || values.VITE_MONAD_RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!response.ok) throw new Error(`${method} returned HTTP ${response.status}`)
  const payload = await response.json()
  if (payload.error) throw new Error(`${method} failed: ${payload.error.message}`)
  return payload.result
}

if (verifyRpc && errors.length === 0) {
  try {
    const chainId = Number.parseInt(await rpcRequest('eth_chainId'), 16)
    if (chainId !== 10143) errors.push(`RPC chain ID is ${chainId}; expected Monad testnet 10143.`)
    for (const [envName, address] of configuredAddresses) {
      const code = await rpcRequest('eth_getCode', [address, 'latest'])
      if (!code || code === '0x') errors.push(`${envName} has no deployed bytecode at ${address}.`)
    }
  } catch (error) {
    errors.push(`RPC validation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

console.log(`ArenaX deployment readiness: ${errors.length === 0 ? 'PASS' : 'FAIL'}`)
console.log(`Environment source: ${source}`)
console.log(`Safety mode: ${values.VITE_APP_MODE || '<empty>'} | Chain ID: ${values.VITE_MONAD_CHAIN_ID || '<empty>'} | Deployment block: ${deploymentBlock || '<empty>'}`)
console.log(`Configured contracts: ${configuredAddresses.length} / ${CONTRACTS.length}`)
if (warnings.length) console.log(`Warnings:\n${warnings.map((item) => `- ${item}`).join('\n')}`)
if (errors.length) console.error(`Errors:\n${errors.map((item) => `- ${item}`).join('\n')}`)
process.exitCode = errors.length === 0 ? 0 : 1
