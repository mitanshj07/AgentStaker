import {
  Activity,
  BadgeCheck,
  Coins,
  Database,
  ExternalLink,
  Rocket,
  ShieldCheck,
  Wallet,
} from 'lucide-react'
import { MONAD_TESTNET, REAL_MONEY_ENABLED } from '../lib/monad'
import { shortAddress, useApp } from '../store/AppContext'

function statusTone(ready: boolean, blocked = false) {
  if (blocked) return 'blocked'
  return ready ? 'ready' : 'pending'
}

export function BlitzControl() {
  const store = useApp()
  const contractsReady = store.contractRuntime.mode === 'CONTRACT_READY'
  const deploymentPending = store.contractRuntime.realTransactionsRequired && !contractsReady
  const marketMapReady = store.contractRuntime.marketMappings > 0
  const indexedReady = store.indexedStatus.mode === 'INDEXED'
  const cryptoReady = store.cryptoStatus.mode === 'LIVE_API' || store.cryptoStatus.mode === 'CACHE'
  const walletLabel = store.wallet.connected && store.wallet.address ? shortAddress(store.wallet.address) : store.wallet.address ? 'Switch chain' : 'Connect'

  const checks = [
    {
      icon: <Wallet size={18} />,
      label: 'Wallet',
      value: walletLabel,
      detail: store.wallet.connected ? `${store.wallet.balanceMON} MON ready` : 'MetaMask signs every tx',
      tone: statusTone(Boolean(store.wallet.connected)),
    },
    {
      icon: <Activity size={18} />,
      label: 'Monad RPC',
      value: store.monadStatus ? `Block ${store.monadStatus.blockNumber.toString()}` : 'Syncing',
      detail: `Chain ${MONAD_TESTNET.id} with two-block finality`,
      tone: statusTone(Boolean(store.monadStatus)),
    },
    {
      icon: <Rocket size={18} />,
      label: 'Contracts',
      value: `${store.contractRuntime.configured}/${store.contractRuntime.contracts.length}`,
      detail: contractsReady ? 'Writes unlocked' : 'Waiting for deployment map',
      tone: statusTone(contractsReady, deploymentPending),
    },
    {
      icon: <BadgeCheck size={18} />,
      label: 'Market map',
      value: `${store.contractRuntime.marketMappings} linked`,
      detail: marketMapReady ? 'UI markets map to chain IDs' : 'Paste VITE_MARKET_ID_MAP',
      tone: statusTone(marketMapReady, deploymentPending),
    },
    {
      icon: <Coins size={18} />,
      label: 'Crypto feed',
      value: cryptoReady ? store.cryptoStatus.mode.replace('_', ' ') : 'Fallback',
      detail: store.cryptoStatus.message,
      tone: statusTone(cryptoReady),
    },
    {
      icon: <Database size={18} />,
      label: 'Indexer',
      value: indexedReady ? 'Ponder live' : 'Read fallback',
      detail: indexedReady ? `${store.indexedStatus.counts.protocolEvents} events cached` : 'Local fixtures until indexer is online',
      tone: statusTone(indexedReady),
    },
    {
      icon: <ShieldCheck size={18} />,
      label: 'Safety',
      value: REAL_MONEY_ENABLED ? 'Review' : 'Testnet only',
      detail: store.contractRuntime.demoFallbackEnabled ? 'Demo fallback allowed' : 'Fallback disabled for final mode',
      tone: statusTone(!REAL_MONEY_ENABLED, REAL_MONEY_ENABLED),
    },
  ]

  return (
    <section className={`blitz-control ${deploymentPending ? 'pending' : 'ready'}`}>
      <div className="blitz-copy">
        <p className="eyebrow">Monad Blitz cockpit</p>
        <h2>{deploymentPending ? 'Final app is ready. Deployment map is the last switch.' : 'Testnet rails are live.'}</h2>
        <p>
          Live crypto markets, wallet-gated MON trades, ERC-721 parlay flow, AI hedge/risk agents,
          Oracle Court, LP vault, creator fees, matcher APIs, and Ponder hooks are wired for Monad Testnet.
        </p>
        <div className="blitz-actions">
          <button className="primary-button compact" onClick={() => store.setView('monad')} type="button">
            Deployment cockpit
          </button>
          <button className="secondary-button compact" onClick={() => store.setView('arena')} type="button">
            Run judge flow
          </button>
          <a className="ghost-link" href={MONAD_TESTNET.blockExplorers.default.url} rel="noreferrer" target="_blank">
            Explorer <ExternalLink size={14} />
          </a>
        </div>
      </div>
      <div className="blitz-grid">
        {checks.map((check) => (
          <article className={`blitz-check ${check.tone}`} key={check.label}>
            {check.icon}
            <span>{check.label}</span>
            <b>{check.value}</b>
            <small>{check.detail}</small>
          </article>
        ))}
      </div>
    </section>
  )
}
