import { useMemo, useState } from 'react'
import { Brain, CheckCircle2, LoaderCircle, Play, Shield, Sparkles, ThumbsUp, Trophy } from 'lucide-react'
import { CohortBadge } from './CohortBadge'
import { fetchAgentDebate, runTournament as apiRunTournament, type AgentDebateResult } from '../services/api'
import {
  agentEarn,
  agentSlash,
  agentStake,
  agentUnstake,
  applyDelegationReturns,
  getAllAgents,
  recordPrediction,
  type AgentPassport,
} from '../state/agentRegistry'
import { emitAgentEvent } from '../state/agentEvents'
import type { Market } from '../types'

type TournamentPhase = 'IDLE' | 'ANALYZING' | 'COMMITTING' | 'COMPLETE'

function pickDebaters(agents: AgentPassport[]): [AgentPassport, AgentPassport] {
  const withHistory = agents.map((agent) => {
    const recent = agent.brierHistory.slice(-3)
    const yesConfidence = recent
      .filter((record) => record.predictedOutcome === 'YES')
      .reduce((sum, record) => sum + record.confidence, 0) / Math.max(1, recent.filter((record) => record.predictedOutcome === 'YES').length)
    const noConfidence = recent
      .filter((record) => record.predictedOutcome === 'NO')
      .reduce((sum, record) => sum + record.confidence, 0) / Math.max(1, recent.filter((record) => record.predictedOutcome === 'NO').length)
    return { agent, yesConfidence, noConfidence }
  })
  const yes = [...withHistory].sort((a, b) => b.yesConfidence - a.yesConfidence || a.agent.brierScore - b.agent.brierScore)[0]?.agent ?? agents[0]
  const no = [...withHistory].filter((item) => item.agent.id !== yes.id).sort((a, b) => b.noConfidence - a.noConfidence || a.agent.brierScore - b.agent.brierScore)[0]?.agent ?? agents[1]
  return [yes, no]
}

export function AgentDebate({ markets, onTournamentStateChange, runLegacyTournament }: {
  markets: Market[]
  onTournamentStateChange?: (running: boolean) => void
  runLegacyTournament: () => void
}) {
  const activeMarkets = useMemo(() => markets.filter((market) => market.state === 'OPEN'), [markets])
  const [marketId, setMarketId] = useState(activeMarkets[0]?.id ?? 101)
  const [debate, setDebate] = useState<AgentDebateResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<TournamentPhase>('IDLE')
  const [yesVotes, setYesVotes] = useState(18)
  const [noVotes, setNoVotes] = useState(12)
  const market = activeMarkets.find((item) => item.id === marketId) ?? activeMarkets[0]
  const [yesAgent, noAgent] = pickDebaters(getAllAgents())

  const baseYes = debate ? debate.agentA.confidence : market?.yesProbability ?? 0.5
  const voteShift = Math.max(-0.05, Math.min(0.05, ((yesVotes - noVotes) / 10) * 0.03))
  const displayYes = Math.max(0.05, Math.min(0.95, baseYes + voteShift))

  async function startDebate() {
    if (!market) return
    setLoading(true)
    setDebate(null)
    const result = await fetchAgentDebate({
      marketId: String(market.id),
      marketTitle: market.question,
      marketDescription: `${market.category} market resolved from ${market.source}`,
      agentAName: yesAgent.name,
      agentAPrompt: yesAgent.systemPrompt,
      agentBName: noAgent.name,
      agentBPrompt: noAgent.systemPrompt,
    })
    setDebate(result)
    setLoading(false)
  }

  async function runTournamentRound() {
    if (!market || phase === 'ANALYZING' || phase === 'COMMITTING') return
    const agents = getAllAgents()
    setPhase('ANALYZING')
    onTournamentStateChange?.(true)
    agents.forEach((agent) => {
      if (agentStake(agent.id, 5)) {
        emitAgentEvent({ agentId: agent.id, agentName: agent.name, type: 'staked', message: `staked 5 test MON on market #${market.id}` })
      }
    })

    await new Promise((resolve) => window.setTimeout(resolve, 700))
    setPhase('COMMITTING')
    await apiRunTournament(market.id, market.question)
    await new Promise((resolve) => window.setTimeout(resolve, 700))

    const simulatedOutcomeYes = market.yesProbability >= 0.5
    const scored = agents.map((agent, index) => {
      const probability = Math.max(0.08, Math.min(0.92, market.aiProbability + ((index % 5) - 2) * 0.055))
      const contribution = (probability - (simulatedOutcomeYes ? 1 : 0)) ** 2
      const outcome = probability >= 0.5 ? 'YES' as const : 'NO' as const
      recordPrediction(agent.id, {
        marketId: String(market.id), marketTitle: market.question, predictedOutcome: outcome,
        confidence: outcome === 'YES' ? probability : 1 - probability,
        brierContribution: contribution, resolvedCorrectly: (outcome === 'YES') === simulatedOutcomeYes,
        timestamp: Date.now(), roundNumber: agent.totalPredictions + 1, earningsFromThis: 2,
      })
      return { agent, contribution, outcome, probability }
    }).sort((a, b) => a.contribution - b.contribution)

    scored.forEach(({ agent, outcome, probability }) => {
      agentEarn(agent.id, 2, 'tournament participation')
      agentUnstake(agent.id, 5)
      emitAgentEvent({
        agentId: agent.id, agentName: agent.name, type: 'forecast',
        message: `forecast ${outcome} ${Math.round((outcome === 'YES' ? probability : 1 - probability) * 100)}% on #${market.id}`,
      })
    })
    scored.slice(0, 3).forEach(({ agent }) => {
      agentEarn(agent.id, 20, 'tournament top-3 bonus')
      emitAgentEvent({ agentId: agent.id, agentName: agent.name, type: 'earned', message: 'earned +20 test MON · top-3 finish' })
    })
    scored.slice(-2).forEach(({ agent }) => {
      agentSlash(agent.id, 3)
      emitAgentEvent({ agentId: agent.id, agentName: agent.name, type: 'loss', message: 'slashed 3 test MON for bottom-2 calibration' })
    })
    applyDelegationReturns()
    runLegacyTournament()
    setPhase('COMPLETE')
    onTournamentStateChange?.(false)
  }

  if (!market) return <p className="empty-state">No open markets are available for debate.</p>

  return (
    <div className="debate-view">
      <section className="economy-toolbar debate-toolbar">
        <label>
          <span>Market under debate</span>
          <select value={market.id} onChange={(event) => { setMarketId(Number(event.target.value)); setDebate(null) }}>
            {activeMarkets.map((item) => <option key={item.id} value={item.id}>#{item.id} · {item.question}</option>)}
          </select>
        </label>
        <button className="primary-button" disabled={loading} onClick={() => void startDebate()} type="button">
          {loading ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />}
          {loading ? 'Agents are preparing arguments…' : 'Start Debate'}
        </button>
      </section>

      {(debate || loading) && (
        <section className="debate-card">
          <div className="debate-title"><span>AI Advisory</span><h3>{market.question}</h3></div>
          <div className="debate-panels">
            <article className="debater yes-debater">
              <div className="debater-head"><div className="economy-avatar">{yesAgent.avatarSeed}</div><div><h3>{yesAgent.name}</h3><CohortBadge cohort={yesAgent.cohort} /></div></div>
              <strong>YES — {Math.round((debate?.agentA.confidence ?? 0.68) * 100)}% confidence</strong>
              <p>{loading ? 'Reviewing price action, base rates, and resolution evidence…' : debate?.agentA.argument}</p>
            </article>
            <div className="debate-dial"><span>VS</span><b>{Math.round(displayYes * 100)}%</b><small>YES consensus</small></div>
            <article className="debater no-debater">
              <div className="debater-head"><div className="economy-avatar">{noAgent.avatarSeed}</div><div><h3>{noAgent.name}</h3><CohortBadge cohort={noAgent.cohort} /></div></div>
              <strong>NO — {Math.round((debate?.agentB.confidence ?? 0.62) * 100)}% confidence</strong>
              <p>{loading ? 'Stress-testing consensus and looking for disconfirming evidence…' : debate?.agentB.argument}</p>
            </article>
          </div>
          <div className="debate-split" aria-label={`${Math.round(displayYes * 100)}% yes and ${Math.round((1 - displayYes) * 100)}% no`}>
            <i style={{ width: `${displayYes * 100}%` }} /><span>{Math.round(displayYes * 100)}% YES</span><span>{Math.round((1 - displayYes) * 100)}% NO</span>
          </div>
          {!loading && <div className="human-vote"><span>Vote on the stronger argument:</span><button onClick={() => setYesVotes((value) => value + 1)} type="button"><ThumbsUp size={15} /> YES argument · {yesVotes}</button><button onClick={() => setNoVotes((value) => value + 1)} type="button"><ThumbsUp size={15} /> NO argument · {noVotes}</button><small>Community shifted: {voteShift >= 0 ? '+' : ''}{Math.round(voteShift * 100)}% YES</small></div>}
        </section>
      )}

      {debate && <button className="tournament-launch" disabled={phase === 'ANALYZING' || phase === 'COMMITTING'} onClick={() => void runTournamentRound()} type="button"><Play size={18} />{phase === 'IDLE' ? 'Run Tournament on this market' : phase === 'COMPLETE' ? 'Run another tournament round' : 'Tournament in progress…'}</button>}
      {phase !== 'IDLE' && <section className="economy-phase-row">
        <span className="done"><Brain size={17} />Analyzing</span>
        <span className={phase === 'COMMITTING' || phase === 'COMPLETE' ? 'done' : ''}><Shield size={17} />Committing + staking</span>
        <span className={phase === 'COMPLETE' ? 'done' : ''}>{phase === 'COMPLETE' ? <CheckCircle2 size={17} /> : <Trophy size={17} />}Scoring + rewards</span>
      </section>}
    </div>
  )
}
