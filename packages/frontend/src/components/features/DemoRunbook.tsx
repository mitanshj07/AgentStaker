import { BadgeCheck, Lock } from 'lucide-react'
import { SectionHeader } from '../ui'

export function DemoRunbook() {
  return (
    <div className="two-column">
      <section className="surface-panel">
        <SectionHeader eyebrow="Hackathon" title="Judge-ready flow" icon={<BadgeCheck size={20} />} />
        <div className="runbook-list">
          <b>1. Monad tab: connect wallet, add/switch Monad testnet, send 0 MON heartbeat.</b>
          <b>2. Arena tab: buy YES/NO shares and watch odds move immediately.</b>
          <b>3. Parlay rail: add 2 legs and mint a testnet parlay NFT.</b>
          <b>4. Portfolio: quote cashout, request an AI hedge, settle completed NFTs, and claim payouts.</b>
          <b>5. Pro Exchange: preview the AMM/CLOB route and signed-order timeline.</b>
          <b>6. Agents: commit a forecast and inspect the Brier-score leaderboard.</b>
          <b>7. Oracle Court: progress a challenge bond and finalize the market.</b>
          <b>8. LP: deposit shares, queue an exit, process available liquidity, and approve a vault-owner rebalance.</b>
          <b>9. Creator Studio: run quality review and create a testnet draft.</b>
        </div>
      </section>
      <section className="surface-panel pastel-checker">
        <SectionHeader eyebrow="Contracts" title="Ready modules" icon={<Lock size={20} />} />
        <p className="large-copy">Factory, AMM, ERC-721 ParlayEngine, OracleCouncil, ExchangeBook, SharedLiquidityVault, ForecastArena, AIPass, CreatorVault, Reputation, ResponsibleLimits, and RiskGovernor compile and test under Foundry.</p>
      </section>
    </div>
  )
}
