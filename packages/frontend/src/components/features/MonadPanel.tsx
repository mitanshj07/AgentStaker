import { Activity, BadgeCheck, Coins, Database, Gauge, RefreshCcw, Sparkles, Wallet } from 'lucide-react'
import { SectionHeader, Metric } from '../ui'
import { useApp, shortAddress } from '../../store/AppContext'
import { MONAD_FINALITY_MS, MONAD_TESTNET } from '../../lib/monad'

export function MonadPanel() {
  const {
    connectMonadWallet,
    contractRuntime,
    disconnectMonadWallet,
    heartbeatTx,
    indexedActivity,
    indexedStatus,
    lastContractTx,
    monadError,
    monadStatus,
    refreshIndexedData,
    sendHeartbeat,
    wallet,
  } = useApp()

  return (
    <div className="two-column">
      <section className="surface-panel monad-panel">
        <SectionHeader eyebrow="Monad testnet" title="Live chain cockpit" icon={<Sparkles size={20} />} />
        <div className="metric-grid">
          <Metric icon={<BadgeCheck size={18} />} label="Chain ID" value={`${monadStatus?.chainId ?? MONAD_TESTNET.id}`} />
          <Metric icon={<Activity size={18} />} label="Latest block" value={monadStatus ? `#${monadStatus.blockNumber.toString()}` : 'Loading'} />
          <Metric icon={<Gauge size={18} />} label="RPC latency" value={monadStatus ? `${monadStatus.latencyMs} ms` : 'Loading'} />
          <Metric icon={<Coins size={18} />} label="Finality" value={`~${MONAD_FINALITY_MS} ms`} />
        </div>
        {monadError && <p className="warning-line">{monadError}</p>}
        <div className="button-row">
          <button className="primary-button" onClick={connectMonadWallet} type="button">
            <Wallet size={18} />{wallet.connected ? 'Refresh wallet' : wallet.address ? 'Switch Monad testnet' : 'Connect Monad wallet'}
          </button>
          <a className="link-button" href="https://faucet.monad.xyz/" target="_blank" rel="noreferrer">Get test MON</a>
          <a className="link-button" href={MONAD_TESTNET.blockExplorers.default.url} target="_blank" rel="noreferrer">Explorer</a>
        </div>
      </section>
      <section className="surface-panel">
        <SectionHeader eyebrow="Wallet" title={wallet.connected ? 'Connected' : 'Not connected'} icon={<Wallet size={20} />} />
        <div className="chain-card">
          <span>Address</span><b>{wallet.address ? shortAddress(wallet.address) : 'No wallet connected'}</b>
          <span>Balance</span><b>{wallet.balanceMON} MON</b>
          <span>Network</span><b>{wallet.connected ? `Monad Testnet ${wallet.chainId}` : wallet.chainId ? `Wrong chain ${wallet.chainId}` : 'Unknown'}</b>
        </div>
        {wallet.error && <p className="warning-line">{wallet.error}</p>}
        {wallet.address && (
          <button className="ghost-button full" onClick={disconnectMonadWallet} type="button">
            Disconnect locally
          </button>
        )}
        <button className="secondary-button full" disabled={!wallet.address} onClick={sendHeartbeat} type="button">
          Send 0 MON heartbeat
        </button>
        {heartbeatTx && (
          <a className="tx-link" href={`${MONAD_TESTNET.blockExplorers.default.url}/tx/${heartbeatTx}`} target="_blank" rel="noreferrer">
            View heartbeat tx
          </a>
        )}
        {lastContractTx && (
          <a className="tx-link" href={`${MONAD_TESTNET.blockExplorers.default.url}/tx/${lastContractTx}`} target="_blank" rel="noreferrer">
            View latest protocol tx
          </a>
        )}
      </section>
      <section className="surface-panel full-span">
        <SectionHeader eyebrow="Deployment map" title="Contract write readiness" icon={<Database size={20} />} />
        <div className="contract-readiness-grid">
          <span className={`contract-mode ${contractRuntime.mode === 'CONTRACT_READY' ? 'live' : ''}`}>
            <Database size={14} />
            {contractRuntime.realTransactionsRequired
              ? contractRuntime.mode === 'CONTRACT_READY' ? 'Real Monad tx mode' : 'Waiting for contract addresses'
              : contractRuntime.mode === 'CONTRACT_READY' ? 'Monad writes enabled' : 'Demo fallback active'}
          </span>
          <b>{contractRuntime.configured} / {contractRuntime.contracts.length} core modules configured</b>
          <small>{contractRuntime.marketMappings} seeded market mappings · demo fallback {contractRuntime.demoFallbackEnabled ? 'available' : 'disabled'} · signatures stay wallet-controlled · two-block finality tracked</small>
        </div>
      </section>
      <section className="surface-panel full-span">
        <SectionHeader eyebrow="Ponder + Postgres" title="Indexed data freshness" icon={<Database size={20} />} />
        <div className="metric-grid">
          <Metric icon={<BadgeCheck size={18} />} label="Read mode" value={indexedStatus.mode === 'INDEXED' ? 'Ponder live' : 'Fixture fallback'} />
          <Metric icon={<Activity size={18} />} label="Indexed block" value={indexedStatus.latestBlock ? `#${indexedStatus.latestBlock}` : 'Waiting'} />
          <Metric icon={<Database size={18} />} label="Events cached" value={`${indexedStatus.counts.protocolEvents}`} />
          <Metric icon={<Gauge size={18} />} label="Activity rows" value={`${indexedActivity.length}`} />
        </div>
        <p className="fine-print">{indexedStatus.message}</p>
        <button className="secondary-button" onClick={() => void refreshIndexedData()} type="button"><RefreshCcw size={17} />Refresh indexed state</button>
      </section>
    </div>
  )
}
