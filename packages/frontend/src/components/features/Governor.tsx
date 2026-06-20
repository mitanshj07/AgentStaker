import { Brain, Gauge, LineChart, ShieldAlert, Trophy, Wallet } from 'lucide-react'
import { SectionHeader, Metric } from '../ui'
import { useApp } from '../../store/AppContext'
import { formatMON } from '../../lib/format'
import type { RiskMode } from '../../types'
import { CohortBadge } from '../CohortBadge'
import { getAgent, getAllAgents } from '../../state/agentRegistry'

function LayersIcon() {
  return <Trophy size={20} />
}

export function Governor() {
  const {
    hedgeRatio,
    markets,
    netExposure,
    openOrderExposure,
    riskProposals,
    riskMode,
    runRiskGovernor,
    setHedgeRatio,
    setRiskMode,
    setStressShock,
    stressShock,
    setRiskProposals,
  } = useApp()

  const exposure = netExposure + openOrderExposure

  return (
    <div className="two-column">
      <section className="surface-panel governor-panel">
        <SectionHeader eyebrow="Autonomous testnet economy" title="AI Agent Risk Proposals" icon={<ShieldAlert size={20} />} />
        <div className="metric-grid">
          <Metric icon={<Wallet size={18} />} label="Exposure" value={formatMON(exposure)} />
          <Metric icon={<Gauge size={18} />} label="Shock" value={`${stressShock}%`} />
          <Metric icon={<ShieldAlert size={18} />} label="Hedge" value={`${hedgeRatio}%`} />
          <Metric icon={<Brain size={18} />} label="Mode" value={riskMode} />
        </div>
        <div className="governor-controls">
          <label className="field-stack">
            <span>Mode</span>
            <select value={riskMode} onChange={(event) => setRiskMode(event.target.value as RiskMode)}>
              <option>Defensive</option>
              <option>Balanced</option>
              <option>Growth</option>
            </select>
          </label>
          <label className="stake-control">
            <span>Stress shock</span>
            <input min="5" max="45" type="range" value={stressShock} onChange={(event) => setStressShock(Number(event.target.value))} />
            <b>{stressShock}%</b>
          </label>
          <label className="stake-control">
            <span>Hedge ratio</span>
            <input min="0" max="100" step="5" type="range" value={hedgeRatio} onChange={(event) => setHedgeRatio(Number(event.target.value))} />
            <b>{hedgeRatio}%</b>
          </label>
        </div>
        <button className="primary-button" onClick={runRiskGovernor} type="button">
          <Brain size={18} />Run governor simulation
        </button>
      </section>
      <section className="surface-panel">
        <SectionHeader eyebrow="Heatmap" title="Market risk" icon={<LineChart size={20} />} />
        <div className="heatmap-list">
          {markets.map((market) => {
            const risk = Math.round((market.yesProbability * 50 + stressShock) % 100)
            return (
              <div className="heatmap-row" key={market.id}>
                <span>#{market.id} {market.category}</span>
                <b>{risk}%</b>
                <em style={{ width: `${risk}%` }} />
              </div>
            )
          })}
        </div>
      </section>
      <section className="surface-panel full-span">
        <SectionHeader eyebrow="Proposal ledger" title="AI approvals" icon={<LayersIcon />} />
        <div className="proposal-grid">
          {riskProposals.map((proposal, index) => {
            const agent = getAgent(proposal.proposerAgentId ?? '') ?? getAllAgents()[index % Math.max(1, getAllAgents().length)]
            return <article className={`proposal-card proposal-${proposal.status.toLowerCase()}`} key={proposal.id}>
              <span>{proposal.status}</span>
              <h3>{proposal.action}</h3>
              {agent && <div className="agent-attribution"><Brain size={14} /><span>Proposed by <b>{agent.name}</b> · Brier {agent.brierScore.toFixed(3)}</span><CohortBadge cohort={agent.cohort} /></div>}
              <p>Value {formatMON(proposal.value)} | Risk {proposal.riskScore} | VaR {formatMON(proposal.var95)}</p>
              <p>Agent confidence <b>{proposal.agentConfidence ?? Math.max(55, 88 - proposal.riskScore / 2)}%</b></p>
              <small>{proposal.market}</small>
              <div className="button-row">
                <button
                  className="secondary-button compact-button"
                  disabled={proposal.status !== 'NEEDS_SIGNATURE'}
                  onClick={() => setRiskProposals((current) => current.map((item) => item.id === proposal.id ? { ...item, status: 'APPROVED' } : item))}
                  type="button"
                >
                  Approve
                </button>
                <button
                  className="primary-button compact-button"
                  disabled={proposal.status !== 'APPROVED'}
                  onClick={() => setRiskProposals((current) => current.map((item) => item.id === proposal.id ? { ...item, status: 'EXECUTED' } : item))}
                  type="button"
                >
                  Execute
                </button>
              </div>
            </article>
          })}
        </div>
      </section>
    </div>
  )
}
