import { useState } from 'react'
import { Coins, Plus, Swords, Trophy, X } from 'lucide-react'
import { CohortBadge } from './CohortBadge'
import {
  addSpectatorBet,
  agentStake,
  createDuel,
  getAgent,
  getAllAgents,
  getAllDuels,
  resolveDuel,
  type AgentPassport,
} from '../state/agentRegistry'
import { emitAgentEvent } from '../state/agentEvents'
import type { Market } from '../types'

export function AgentDuels({ markets, version }: { markets: Market[]; version: number }) {
  void version
  const agents = getAllAgents()
  const openMarkets = markets.filter((market) => market.state === 'OPEN')
  const [showCreate, setShowCreate] = useState(false)
  const [challengerId, setChallengerId] = useState(agents[0]?.id ?? '')
  const [challengedId, setChallengedId] = useState(agents[1]?.id ?? '')
  const [marketId, setMarketId] = useState(String(openMarkets[0]?.id ?? 101))
  const [side, setSide] = useState<'YES' | 'NO'>('YES')
  const [stake, setStake] = useState(25)
  const duels = getAllDuels()
  const active = duels.filter((duel) => duel.status !== 'resolved')
  const resolved = duels.filter((duel) => duel.status === 'resolved').slice(0, 5)

  function handleCreate() {
    const challenger = getAgent(challengerId)
    const challenged = getAgent(challengedId)
    const market = openMarkets.find((item) => String(item.id) === marketId)
    if (!challenger || !challenged || !market || challenger.id === challenged.id) return
    if (!agentStake(challenger.id, stake) || !agentStake(challenged.id, stake)) return
    createDuel({
      challengerAgentId: challenger.id, challengedAgentId: challenged.id, marketId: String(market.id), marketTitle: market.question,
      challengerSide: side, stakedAmountEach: stake, spectatorPool: 0,
    })
    emitAgentEvent({ agentId: challenger.id, agentName: challenger.name, type: 'duel-challenge', message: `challenged ${challenged.name} for ${stake} test MON` })
    setShowCreate(false)
  }

  function sideBet(duelId: string, amount: number, agent: AgentPassport | undefined) {
    const duel = addSpectatorBet(duelId, amount)
    if (duel && agent) emitAgentEvent({ agentId: agent.id, agentName: agent.name, type: 'staked', message: `attracted a ${amount} test MON spectator bet` })
  }

  return (
    <div className="duels-view">
      <div className="subview-heading"><div><p className="eyebrow">Head-to-head economy</p><h3>Agent Duels</h3><p>Agents stake against each other; spectators back the stronger forecasting strategy.</p></div><button className="primary-button" onClick={() => setShowCreate(true)} type="button"><Plus size={17} />Create Duel</button></div>
      <div className="duel-grid">
        {active.map((duel) => {
          const challenger = getAgent(duel.challengerAgentId)
          const challenged = getAgent(duel.challengedAgentId)
          const otherSide = duel.challengerSide === 'YES' ? 'NO' : 'YES'
          return <article className="duel-card" key={duel.id}>
            <div className="duel-card-top"><span className={`duel-status ${duel.status}`}>{duel.status}</span><b>{duel.stakedAmountEach} test MON each</b></div>
            <h3>{challenger?.name} <Swords size={18} /> {challenged?.name}</h3>
            <p>{duel.marketTitle}</p>
            <div className="duel-sides"><span><i>{challenger?.avatarSeed}</i>{challenger?.name}<b>{duel.challengerSide}</b></span><span><i>{challenged?.avatarSeed}</i>{challenged?.name}<b>{otherSide}</b></span></div>
            <div className="spectator-pool"><Coins size={16} /><span>Spectator pool</span><b>{duel.spectatorPool} test MON</b></div>
            <div className="button-row"><select aria-label="Spectator stake" defaultValue="10" id={`sidebet-${duel.id}`}><option value="5">5 test MON</option><option value="10">10 test MON</option><option value="20">20 test MON</option></select><button className="secondary-button compact-button" onClick={() => { const field = document.getElementById(`sidebet-${duel.id}`) as HTMLSelectElement | null; sideBet(duel.id, Number(field?.value ?? 10), challenger) }} type="button">Side Bet</button><button className="ghost-button compact-button" onClick={() => { const winner = (challenger?.reputationScore ?? 0) >= (challenged?.reputationScore ?? 0) ? challenger : challenged; if (winner) { resolveDuel(duel.id, winner.id); emitAgentEvent({ agentId: winner.id, agentName: winner.name, type: 'duel-win', message: `won duel +${duel.stakedAmountEach * 2} test MON` }) } }} type="button">Resolve demo</button></div>
          </article>
        })}
      </div>
      <details className="resolved-duels"><summary>Resolved Duels · {resolved.length}</summary>{resolved.map((duel) => { const winner = duel.winnerId ? getAgent(duel.winnerId) : undefined; return <div key={duel.id}><Trophy size={16} /><span>{duel.marketTitle}</span><b>{winner?.name ?? 'Pending winner'}</b><em>{duel.stakedAmountEach * 2 + duel.spectatorPool * 0.1} test MON prize</em></div> })}</details>

      {showCreate && <div className="economy-modal-backdrop" onClick={() => setShowCreate(false)} role="presentation"><section aria-label="Create agent duel" aria-modal="true" className="economy-modal small" onClick={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close" className="modal-close" onClick={() => setShowCreate(false)} type="button"><X size={18} /></button><p className="eyebrow">Stake-based challenge</p><h2>Create Agent Duel</h2><div className="modal-form-grid"><label>Challenger<select value={challengerId} onChange={(event) => { setChallengerId(event.target.value); if (event.target.value === challengedId) setChallengedId(agents.find((agent) => agent.id !== event.target.value)?.id ?? '') }}>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.walletBalance} MON</option>)}</select></label><label>Challenged<select value={challengedId} onChange={(event) => setChallengedId(event.target.value)}>{agents.filter((agent) => agent.id !== challengerId).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label><label>Market<select value={marketId} onChange={(event) => setMarketId(event.target.value)}>{openMarkets.map((market) => <option key={market.id} value={market.id}>#{market.id} · {market.question}</option>)}</select></label><label>Challenger side<select value={side} onChange={(event) => setSide(event.target.value as 'YES' | 'NO')}><option>YES</option><option>NO</option></select></label><label>Stake per agent<div className="segmented-control">{[10, 25, 50].map((amount) => <button className={stake === amount ? 'active' : ''} key={amount} onClick={() => setStake(amount)} type="button">{amount} MON</button>)}</div></label></div><div className="duel-preview"><CohortBadge cohort={getAgent(challengerId)?.cohort ?? 'Rookie'} /><span>Both agents lock {stake} test MON until resolution.</span></div><button className="primary-button modal-submit" onClick={handleCreate} type="button">Create Duel</button></section></div>}
    </div>
  )
}

