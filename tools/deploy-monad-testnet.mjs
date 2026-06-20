import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from './deployment-config.mjs'

const root = process.cwd()
const envPath = resolve(root, '.env')
const fileEnv = existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {}
let env = { ...fileEnv, ...process.env }
const rpcUrl = env.VITE_MONAD_RPC_URL || env.PONDER_RPC_URL || 'https://testnet-rpc.monad.xyz'

if (!env.DEPLOYER_PRIVATE_KEY) {
  console.error('DEPLOYER_PRIVATE_KEY is missing. Add a funded Monad testnet deployer key to .env, or deploy manually and run npm run deploy:import.')
  process.exit(1)
}

const deployerKey = env.DEPLOYER_PRIVATE_KEY.startsWith('0x') ? env.DEPLOYER_PRIVATE_KEY : `0x${env.DEPLOYER_PRIVATE_KEY}`

function runForgeScript(script, label) {
  console.log(label)
  const result = spawnSync('forge', [
    'script',
    script,
    '--rpc-url',
    rpcUrl,
    '--private-key',
    deployerKey,
    '--broadcast',
    '-vvvv',
  ], {
    cwd: resolve(root, 'packages/contracts'),
    env,
    stdio: 'inherit',
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

runForgeScript('script/Deploy.s.sol:Deploy', 'Broadcasting Monad ArenaX contracts to Monad testnet...')

console.log('Importing Foundry broadcast addresses into .env and frontend env...')
const imported = spawnSync(process.execPath, [resolve(root, 'tools/import-foundry-broadcast.mjs')], {
  cwd: root,
  env,
  stdio: 'inherit',
})
if (imported.status !== 0) process.exit(imported.status ?? 1)

env = { ...parseEnv(readFileSync(envPath, 'utf8')), ...process.env }
runForgeScript('script/Seed.s.sol:Seed', 'Seeding Monad testnet markets, AMM pools, social market, league, and DFS contest...')

console.log('Deployment complete. Restart the frontend dev server before judging real transactions.')
