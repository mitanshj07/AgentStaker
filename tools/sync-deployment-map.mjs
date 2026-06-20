import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { ADDRESS_PATTERN, CONTRACTS, buildManifest, loadDeploymentEnv } from './deployment-config.mjs'

const { hasLocalEnv, values } = loadDeploymentEnv()
if (!hasLocalEnv) throw new Error('Create .env from .env.example and add the broadcast addresses before generating a deployment map.')

for (const [, envName] of CONTRACTS) {
  if (!ADDRESS_PATTERN.test(values[envName] || '')) throw new Error(`${envName} must contain a deployed Monad testnet contract address.`)
}

const output = resolve(process.cwd(), 'packages/contracts/deployments/monad-testnet.json')
mkdirSync(dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(buildManifest(values), null, 2)}\n`)
console.log(`Wrote ${output}`)
