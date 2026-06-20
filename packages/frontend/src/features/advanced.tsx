import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { fetchAgentDebate, fetchAgentLeaderboard, fetchAgentConsensus, requestAi, runTournament as apiRunTournament, createAgent, type AgentProfile, type TournamentResult, type AgentConsensus, type AgentDebateResult } from '../services/api'
import {
  Activity,
  BadgeCheck,
  Bot,
  Brain,
  CircleDollarSign,
  CheckCircle2,
  Coins,
  Gavel,
  Gauge,
  Landmark,
  LineChart,
  Network,
  ReceiptText,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Trophy,
  WandSparkles,
  Sparkles,
  ArrowUpRight,
  Users,
  X,
  Eye,
  LockKeyhole,
  Swords,
} from 'lucide-react'
import { Insight, Metric, SectionHeader, Timeline } from '../components/ui'
import { formatMON } from '../lib/format'
import type { AiAdvice, SmartRouteQuote } from '../services/api'
import type { AgentTask, ForecastEntry, Market, OracleCase, Order, OrderType, Outcome, Parlay, Position, TxStep, VaultState } from '../types'
import { CohortBadge } from '../components/CohortBadge'
import { delegateTo, getAgent, getAllAgents, getDelegations, getRegistryVersion, subscribeToAgentRegistry, withdrawDelegation } from '../state/agentRegistry'
import { creditHumanWallet, debitHumanWallet, getHumanWalletBalance, getHumanWalletVersion, subscribeToHumanWallet } from '../state/humanWallet'

function agentForContext(context: string) {
  const agents = getAllAgents()
  const index = [...context].reduce((sum, character) => sum + character.charCodeAt(0), 0) % Math.max(1, agents.length)
  return agents[index]
}

export function Exchange({ cancelOrder, limitPrice, orderType, orders, outcome, placeOrder, previewSmartRoute, routeQuote, selectedMarket, setLimitPrice, setOrderType, stake, txTimeline }: {
  cancelOrder: (id: number) => void
  limitPrice: number
  orderType: OrderType
  orders: Order[]
  outcome: Outcome
  placeOrder: (side: 'BACK' | 'LAY') => void
  previewSmartRoute: (side: 'BACK' | 'LAY') => void
  routeQuote: SmartRouteQuote | null
  selectedMarket: Market
  setLimitPrice: (value: number) => void
  setOrderType: (value: OrderType) => void
  stake: number
  txTimeline: TxStep[]
}) {
  const bestBid = Number((selectedMarket.yesProbability - 0.03).toFixed(2))
  const bestAsk = Number((selectedMarket.yesProbability + 0.03).toFixed(2))
  return (
    <div className="two-column">
      <section className="surface-panel pro-exchange-panel">
        <SectionHeader eyebrow="Hybrid CLOB" title="Pro Exchange" icon={<SlidersHorizontal size={20} />} />
        <div className="metric-grid"><Metric icon={<LineChart size={18} />} label="Best bid" value={bestBid.toFixed(2)} /><Metric icon={<LineChart size={18} />} label="Best ask" value={bestAsk.toFixed(2)} /><Metric icon={<Gauge size={18} />} label="Spread" value="6 cents" /><Metric icon={<ShieldAlert size={18} />} label="Custody" value="Never" /></div>
        <div className="exchange-ticket">
          <label className="field-stack"><span>Type</span><select value={orderType} onChange={(event) => setOrderType(event.target.value as OrderType)}><option>GTC</option><option>GTD</option><option>IOC</option><option>FOK</option><option>FAK</option><option>POST_ONLY</option></select></label>
          <label className="field-stack"><span>Limit price</span><input min="0.01" max="0.99" step="0.01" type="number" value={limitPrice} onChange={(event) => setLimitPrice(Number(event.target.value))} /></label>
        </div>
        <p className="pro-preview"><b>{selectedMarket.question}</b><span>{outcome} | {formatMON(stake)} | signed EIP-712, matched offchain, settled on Monad testnet.</span></p>
        <div className="button-row"><button className="primary-button" onClick={() => placeOrder('BACK')} type="button">Back {outcome}</button><button className="secondary-button" onClick={() => placeOrder('LAY')} type="button">Lay {outcome}</button><button className="ghost-button" onClick={() => previewSmartRoute('BACK')} type="button"><Network size={17} />Preview smart route</button></div>
        {routeQuote && <div className="router-card"><span>Smart router | expires in 30s</span><h3>{routeQuote.effectivePrice.toFixed(2)} effective price</h3><p>{routeQuote.depthUsed.toFixed(2)} MON CLOB depth | {routeQuote.priceImpactBps} bps impact</p>{routeQuote.legs.map((leg) => <div className="route-leg" key={`${leg.venue}-${leg.size}`}><b>{leg.venue}</b><span>{formatMON(leg.size)} @ {leg.price.toFixed(2)}</span><small>{leg.reason}</small></div>)}</div>}
      </section>
      <section className="surface-panel">
        <SectionHeader eyebrow="Settlement" title="Monad timeline" icon={<Activity size={20} />} />
        <Timeline steps={txTimeline} />
        <div className="table-list">{orders.map((order) => <div className="table-row pro-order-row" key={order.id}><span>{order.side} {order.outcome}</span><b>{order.type} @ {order.odds.toFixed(2)}x</b><span>{formatMON(order.filled)} / {formatMON(order.size)}</span><em>{order.status}</em><button className="ghost-button compact-button" disabled={order.status === 'CANCELED' || order.status === 'FILLED'} onClick={() => cancelOrder(order.id)} type="button">Cancel</button></div>)}</div>
      </section>
    </div>
  )
}

function AgentDelegations({ openAgents }: { openAgents: () => void }) {
  useSyncExternalStore(subscribeToAgentRegistry, getRegistryVersion, getRegistryVersion)
  useSyncExternalStore(subscribeToHumanWallet, getHumanWalletVersion, getHumanWalletVersion)
  const [topUpAgentId, setTopUpAgentId] = useState<string | null>(null)
  const [topUpAmount, setTopUpAmount] = useState(25)
  const delegations = getDelegations()
  const humanBalance = getHumanWalletBalance()

  function withdraw(agentId: string) {
    const delegation = withdrawDelegation(agentId)
    if (delegation) creditHumanWallet(delegation.delegatedAmount + delegation.cumulativeReturn)
  }

  function topUp() {
    if (!topUpAgentId || !debitHumanWallet(topUpAmount)) return
    delegateTo(topUpAgentId, topUpAmount)
    setTopUpAgentId(null)
  }

  return <section className="surface-panel full-span agent-delegations-panel"><div className="delegations-heading"><SectionHeader eyebrow="Human sponsor wallet" title="My Agent Delegations" icon={<Users size={20} />} /><div><span>Human wallet</span><b>{humanBalance.toFixed(2)} test MON</b></div></div>{delegations.length === 0 ? <div className="delegation-empty"><Bot size={26} /><h3>Put your test capital behind proven agents</h3><p>Delegate test MON to an agent and earn a simulated share of its tournament winnings.</p><button className="primary-button" onClick={openAgents} type="button">Browse Agents <ArrowUpRight size={16} /></button></div> : <div className="delegation-card-grid">{delegations.map((delegation) => { const agent = getAgent(delegation.agentId); if (!agent) return null; return <article key={delegation.agentId}><div className="delegation-agent"><div className="economy-avatar">{agent.avatarSeed}</div><div><h3>{agent.name}</h3><CohortBadge cohort={agent.cohort} /></div></div><div className="delegation-numbers"><span><small>Delegated</small><b>{delegation.delegatedAmount.toFixed(2)} test MON</b></span><span><small>Cumulative return</small><b className="positive">+{delegation.cumulativeReturn.toFixed(2)} MON</b></span></div><div className="button-row"><button className="secondary-button compact-button" onClick={() => setTopUpAgentId(agent.id)} type="button">Top Up</button><button className="ghost-button compact-button" onClick={() => withdraw(agent.id)} type="button">Withdraw Delegation</button></div></article> })}</div>}{topUpAgentId && <div className="economy-modal-backdrop" onClick={() => setTopUpAgentId(null)} role="presentation"><section aria-label="Top up delegation" aria-modal="true" className="economy-modal small" onClick={(event) => event.stopPropagation()} role="dialog"><button className="modal-close" onClick={() => setTopUpAgentId(null)} type="button"><X size={18} /></button><p className="eyebrow">Add delegated capital</p><h2>Top up {getAgent(topUpAgentId)?.name}</h2><p>Available human wallet: {humanBalance.toFixed(2)} test MON</p><div className="segmented-control">{[10, 25, 50].map((amount) => <button className={topUpAmount === amount ? 'active' : ''} key={amount} onClick={() => setTopUpAmount(amount)} type="button">{amount} MON</button>)}</div><button className="primary-button modal-submit" disabled={humanBalance < topUpAmount} onClick={topUp} type="button">Top up {topUpAmount} test MON</button></section></div>}</section>
}

export function Portfolio(props: { cashoutAdvice: AiAdvice | null; cashoutParlay: (id: number) => void; claimAllPositions: () => void; claimParlay: (id: number) => void; claimable: Position[]; hedgeAdvice: AiAdvice | null; markets: Market[]; openAgents: () => void; parlays: Parlay[]; positions: Position[]; proposeHedge: (id: number) => void; quoteParlayCashout: (id: number) => void; settleParlay: (id: number) => void }) {
  const advisor = getAgent('agent-alpha-macro')
  return <div className="two-column">
    <section className="surface-panel"><SectionHeader eyebrow="Wallet" title="Positions" icon={<ReceiptText size={20} />} /><div className="table-list">{props.positions.length === 0 && <p className="empty-state">No positions yet.</p>}{props.positions.map((position) => <div className="table-row" key={position.id}><span>{props.markets.find((market) => market.id === position.marketId)?.category ?? 'Market'} #{position.marketId}</span><b>{position.outcome}</b><span>{formatMON(position.stake)}</span><em>{position.source === 'ON_CHAIN' ? `MONAD ${position.status}` : position.status}</em></div>)}</div><button className="primary-button" disabled={props.claimable.length === 0} onClick={props.claimAllPositions} type="button">Claim winning positions</button></section>
    <section className="surface-panel"><SectionHeader eyebrow="ERC-721" title="Parlay NFT cashout" icon={<Trophy size={20} />} /><div className="parlay-nft-grid">{props.parlays.length === 0 && <p className="empty-state">Mint a parlay slip to unlock deterministic cashout quotes.</p>}{props.parlays.map((parlay) => <article className="parlay-nft" key={parlay.id}><span>NFT #{parlay.id} | {parlay.source === 'ON_CHAIN' ? 'MONAD LIVE' : 'DEMO FALLBACK'} | TRANSFERABLE</span><h3>{parlay.legs.length} legs at {parlay.combinedOdds.toFixed(2)}x</h3><p>{formatMON(parlay.stake)} stake | {parlay.status}</p>{parlay.cashoutQuote && <b>Cashout {formatMON(parlay.cashoutQuote)}</b>}<div className="button-row"><button className="secondary-button compact-button" disabled={parlay.status !== 'OPEN'} onClick={() => props.quoteParlayCashout(parlay.id)} type="button">Quote cashout</button><button className="secondary-button compact-button" disabled={parlay.status !== 'OPEN'} onClick={() => props.proposeHedge(parlay.id)} type="button">AI hedge</button><button className="secondary-button compact-button" disabled={parlay.status !== 'OPEN'} onClick={() => props.settleParlay(parlay.id)} type="button">Settle NFT</button><button className="primary-button compact-button" disabled={!parlay.cashoutQuote || parlay.status !== 'OPEN'} onClick={() => props.cashoutParlay(parlay.id)} type="button">Sign cashout</button><button className="primary-button compact-button" disabled={parlay.status !== 'WON'} onClick={() => props.claimParlay(parlay.id)} type="button">Claim NFT payout</button></div></article>)}</div></section>
    <AgentDelegations openAgents={props.openAgents} />
    {(props.cashoutAdvice || props.hedgeAdvice) && <section className="surface-panel full-span"><SectionHeader eyebrow="Advisory only" title="AI hold versus cashout ledger" icon={<Brain size={20} />} /><div className="agent-attribution"><Bot size={14} /><span>Advisory from <b>{advisor?.name}</b> · Rep {advisor?.reputationScore} · AI Advisory</span></div><div className="insight-grid"><Insight title="Cashout risk" value={String(props.cashoutAdvice?.riskLevel ?? 'MEDIUM')} /><Insight title="Hedge ratio" value={`${String(props.hedgeAdvice?.hedgeRatio ?? 35)}%`} /><Insight title="Approval" value="User signature required" /></div><p className="fine-print">{String(props.cashoutAdvice?.warning ?? props.hedgeAdvice?.recommendation ?? 'Review the deterministic quote before signing.')}</p></section>}
  </div>
}

function oracleActionLabel(state: OracleCase['state'] | undefined) {
  if (state === 'READY') return 'Commit YES + bond'
  if (state === 'COMMITTED') return 'Reveal YES'
  if (state === 'REVEALED') return 'Challenge with NO'
  if (state === 'CHALLENGED') return 'Council resolve YES'
  return 'Finalized'
}

export function Oracle({ advanceOracleCase, markets, oracleCases }: { advanceOracleCase: (marketId: number) => void; markets: Market[]; oracleCases: OracleCase[] }) {
  const registryVersion = useSyncExternalStore(subscribeToAgentRegistry, getRegistryVersion, getRegistryVersion)
  const council = useMemo(() => {
    void registryVersion
    return [...getAllAgents()].sort((a, b) => b.reputationScore - a.reputationScore).slice(0, 5)
  }, [registryVersion])
  const councilMarket = markets.find((market) => market.state === 'OPEN') ?? markets[0]
  const court = oracleCases.find((item) => item.marketId === councilMarket?.id)
  const [committedIds, setCommittedIds] = useState<string[]>([])
  const [votes, setVotes] = useState<Record<string, { outcome: Outcome; probability: number }>>({})
  const [dispute, setDispute] = useState<AgentDebateResult | null>(null)

  useEffect(() => {
    const timers = council.map((agent, index) => window.setTimeout(() => setCommittedIds((current) => current.includes(agent.id) ? current : [...current, agent.id]), 650 + index * 280))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [council])

  useEffect(() => {
    if (!court || !['REVEALED', 'CHALLENGED', 'FINALIZED'].includes(court.state) || Object.keys(votes).length) return
    let active = true
    void Promise.all(council.map(async (agent, index) => {
      const advice = await requestAi('forecast', { marketId: councilMarket.id, question: councilMarket.question, systemPrompt: agent.systemPrompt })
      const probability = Number(advice.probabilityYes ?? Math.max(0.18, Math.min(0.86, councilMarket.aiProbability + (index - 2) * 0.045)))
      return [agent.id, { outcome: probability >= 0.5 ? 'YES' as const : 'NO' as const, probability }] as const
    })).then((entries) => { if (active) setVotes(Object.fromEntries(entries)) })
    return () => { active = false }
  }, [council, councilMarket, court, votes])

  useEffect(() => {
    if (court?.state !== 'CHALLENGED' || dispute || council.length < 2) return
    const [agentA, agentB] = council
    void fetchAgentDebate({ marketId: String(councilMarket.id), marketTitle: councilMarket.question, marketDescription: councilMarket.source, agentAName: agentA.name, agentAPrompt: agentA.systemPrompt, agentBName: agentB.name, agentBPrompt: agentB.systemPrompt }).then(setDispute)
  }, [council, councilMarket, court?.state, dispute])

  const consensus = Object.values(votes).length ? Object.values(votes).reduce((sum, vote) => sum + vote.probability, 0) / Object.values(votes).length : councilMarket?.aiProbability ?? 0.5

  return <div className="oracle-economy-view"><section className="surface-panel agent-council-panel"><SectionHeader eyebrow="Oracle Council — Agent Consensus" title={`Council for market #${councilMarket?.id ?? '—'}`} icon={<Users size={20} />} /><p className="fine-print">The five highest-reputation agents commit independently, reveal calibrated votes, and put their protocol reputation behind the outcome.</p><div className="council-consensus"><span>Agent consensus</span><div><i style={{ width: `${consensus * 100}%` }} /></div><b>{Math.round(consensus * 100)}% YES</b><small>{committedIds.length}/5 committed · {Object.keys(votes).length}/5 revealed</small></div><div className="agent-council-grid">{council.map((agent) => { const vote = votes[agent.id]; const committed = committedIds.includes(agent.id); return <article className={committed ? 'committed' : ''} key={agent.id}><div className="economy-avatar">{agent.avatarSeed}</div><div><h3>{agent.name}</h3><CohortBadge cohort={agent.cohort} /></div><span>Rep {agent.reputationScore} · stake {Math.min(25, agent.stakedBalance)} MON</span><b>{vote ? `${vote.outcome} · ${Math.round(vote.probability * 100)}%` : committed ? <><LockKeyhole size={13} />Committed</> : 'Assigning…'}</b></article> })}</div>{Object.keys(votes).length > 0 && <div className="council-reveal-note"><Eye size={16} />All council recommendations are AI Advisory outputs; finalization remains wallet-signed.</div>}{court?.state === 'CHALLENGED' && <div className="council-dispute"><Swords size={18} /><div><b>Council dispute active</b><p>{dispute ? `${dispute.agentA.argument} Counterpoint: ${dispute.agentB.argument}` : 'Agents are debating the challenge evidence…'}</p></div></div>}</section><section className="surface-panel"><SectionHeader eyebrow="Wallet-signed commit-reveal + challenge bonds" title="Oracle Dispute Court" icon={<Gavel size={20} />} /><p className="fine-print">The guided testnet scenario commits YES, reveals it, challenges with NO, then asks the council wallet to resolve YES. Each stage records a Monad receipt when contract writes are enabled.</p><div className="oracle-grid">{markets.map((market) => { const marketCourt = oracleCases.find((item) => item.marketId === market.id); return <article className="oracle-card" key={market.id}><span className="state-badge">{marketCourt?.state ?? market.state}</span><h3>#{market.id}</h3><p>{market.question}</p><small>{market.source}</small><div className="court-timeline"><span>Commit</span><span>Reveal</span><span>Challenge {formatMON(marketCourt?.bond ?? 0.1)}</span><span>Council finalize</span></div>{market.state === 'OPEN' ? <button className="secondary-button compact-button" disabled={marketCourt?.state === 'FINALIZED'} onClick={() => advanceOracleCase(market.id)} type="button">{oracleActionLabel(marketCourt?.state)}</button> : <b>{market.resolvedOutcome ?? 'VOIDED'} | {marketCourt?.source ?? 'DEMO_FALLBACK'}</b>}</article> })}</div></section></div>
}

export function Agents({ agentTasks, runForecastTournament, selectedMarket }: { agentTasks: AgentTask[]; forecasts: ForecastEntry[]; runForecastTournament: () => void; setAgentTasks: Dispatch<SetStateAction<AgentTask[]>>; selectedMarket: Market }) {
  const [loading, setLoading] = useState(false)
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [consensus, setConsensus] = useState<AgentConsensus | null>(null)
  const [tournamentResult, setTournamentResult] = useState<TournamentResult | null>(null)
  const [phase, setPhase] = useState<'IDLE' | 'ANALYZING' | 'COMMITTING' | 'COMPLETE'>('IDLE')

  useEffect(() => {
    fetchAgentLeaderboard().then(res => setAgents(res.agents))
    fetchAgentConsensus(selectedMarket.id).then(res => setConsensus(res))
  }, [selectedMarket.id])

  const handleRunTournament = async () => {
    setLoading(true)
    setPhase('ANALYZING')
    setTournamentResult(null)
    
    // Simulate phases for visual effect
    setTimeout(() => setPhase('COMMITTING'), 1500)
    
    try {
      const result = await apiRunTournament(selectedMarket.id, selectedMarket.question)
      setTournamentResult(result)
      
      // Update consensus and leaderboard after run
      fetchAgentConsensus(selectedMarket.id).then(res => setConsensus(res))
      fetchAgentLeaderboard().then(res => setAgents(res.agents))
      
      // Call existing prop function to keep legacy state updated
      runForecastTournament()
    } finally {
      setPhase('COMPLETE')
      setLoading(false)
    }
  }

  const marketProb = selectedMarket.yesProbability
  const aiProb = consensus ? consensus.consensus : selectedMarket.aiProbability
  const divergence = Math.abs(marketProb - aiProb)
  const divergenceColor = divergence > 0.1 ? 'divergence-high' : 'divergence-low'

  return (
    <div className="agents-dashboard">
      <section className="tournament-hero surface-panel">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <Trophy size={16} />
            <span>Autonomous Agent Arena</span>
          </div>
          <h2>{selectedMarket.question}</h2>
          <div className="hero-stats">
            <span className="mode-badge">{tournamentResult?.mode === 'DETERMINISTIC_FALLBACK' ? 'DEMO MODE' : 'AI LIVE'}</span>
            <span className="market-id">Market #{selectedMarket.id}</span>
          </div>
        </div>
        <div className="hero-action">
          <button 
            className={`tournament-button ${loading ? 'loading' : ''}`}
            onClick={handleRunTournament} 
            disabled={loading}
          >
            {loading ? <WandSparkles className="spinner" size={20} /> : <Bot size={20} />}
            <span>{loading ? 'Simulating Tournament...' : 'Run Tournament Round'}</span>
          </button>
        </div>
      </section>

      {phase !== 'IDLE' && (
        <section className="tournament-timeline surface-panel">
          <div className={`phase-step ${phase === 'ANALYZING' ? 'active' : ''} ${['COMMITTING', 'COMPLETE'].includes(phase) ? 'done' : ''}`}>
            <Brain size={18} />
            <span>Analyzing Context</span>
          </div>
          <div className={`phase-step ${phase === 'COMMITTING' ? 'active' : ''} ${phase === 'COMPLETE' ? 'done' : ''}`}>
            <Shield size={18} />
            <span>Committing Forecasts</span>
          </div>
          <div className={`phase-step ${phase === 'COMPLETE' ? 'active done' : ''}`}>
            <Trophy size={18} />
            <span>Scoring & Consensus</span>
          </div>
        </section>
      )}

      {tournamentResult && (
        <section className="tournament-results surface-panel">
          <SectionHeader eyebrow="Latest Results" title="Tournament Round Output" icon={<ReceiptText size={20} />} />
          <div className="results-grid">
            {tournamentResult.agents.map((agent) => (
              <article className="result-card" key={agent.agentId}>
                <div className="result-header">
                  <h3>{agent.name}</h3>
                  <b className="result-prob">{Math.round(agent.probability * 100)}%</b>
                </div>
                <div className={`confidence-badge ${agent.confidence.toLowerCase()}`}>
                  {agent.confidence} Confidence
                </div>
                <p className="agent-reasoning">{agent.reasoning}</p>
                <div className="key-factors">
                  {agent.keyFactors.map(f => <span key={f} className="factor-tag">{f}</span>)}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <div className="two-column">
        <section className="surface-panel consensus-panel">
          <SectionHeader eyebrow="Alpha" title="Consensus vs Market" icon={<Network size={20} />} />
          <div className="consensus-comparison">
            <div className="prob-column">
              <span className="prob-label">AMM Market</span>
              <div className="probability-bar market">
                <div className="probability-fill" style={{ height: `${marketProb * 100}%` }}>
                  <span>{Math.round(marketProb * 100)}%</span>
                </div>
              </div>
            </div>
            
            <div className={`divergence-highlight ${divergenceColor}`}>
              <LineChart size={24} />
              <span>{Math.round(divergence * 100)}% Spread</span>
            </div>

            <div className="prob-column">
              <span className="prob-label">Agent Consensus</span>
              <div className="probability-bar ai">
                <div className="probability-fill" style={{ height: `${aiProb * 100}%` }}>
                  <span>{Math.round(aiProb * 100)}%</span>
                </div>
              </div>
            </div>
          </div>
          
          {consensus && (
            <div className="consensus-list">
              {consensus.agents.map(a => (
                <div className="consensus-list-item" key={a.id}>
                  <span>{a.name}</span>
                  <b>{Math.round(a.probability * 100)}%</b>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="surface-panel agent-leaderboard-section">
          <SectionHeader eyebrow="On-chain Score" title="Agent Leaderboard" icon={<BadgeCheck size={20} />} />
          <div className="agent-leaderboard">
            {agents.map((agent) => (
              <article className={`agent-profile-card rank-${agent.rank}`} key={agent.id}>
                <div className="rank-badge">#{agent.rank}</div>
                <div className="agent-card-header">
                  <div className="agent-avatar">{agent.avatar}</div>
                  <div className="agent-title">
                    <h3>{agent.name}</h3>
                    <span className="strategy-label">{agent.strategy}</span>
                  </div>
                </div>
                
                <div className="agent-metrics">
                  <div className="primary-metric">
                    <span>Brier Score</span>
                    <b>{agent.brierScore.toFixed(3)}</b>
                  </div>
                  <div className="secondary-metrics">
                    <div className="metric-mini"><span>Win Rate</span><b>{agent.winRate}%</b></div>
                    <div className="metric-mini"><span>Forecasts</span><b>{agent.totalForecasts}</b></div>
                    <div className="metric-mini"><span>Streak</span><b className={agent.streak > 0 ? 'positive' : 'negative'}>{agent.streak > 0 ? '+' : ''}{agent.streak}</b></div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="surface-panel full-span">
        <SectionHeader eyebrow="Ledger" title="Agent Task Log" icon={<Activity size={20} />} />
        <div className="task-grid">
          {agentTasks.map((task) => (
            <article className="task-card" key={task.id}>
              <span>{task.agent}</span>
              <h3>{task.title}</h3>
              <p>{task.output}</p>
              <b>{task.status}</b>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export function Liquidity({ depositLpVault, executeLpRebalance, markets, processLpWithdrawal, protocolLiquidity, rebalanceAdvice, requestLpWithdrawal, runLpRebalance, selectedMarket, stake, vaultState }: { depositLpVault: () => void; executeLpRebalance: () => void; markets: Market[]; processLpWithdrawal: () => void; protocolLiquidity: number; rebalanceAdvice: AiAdvice | null; requestLpWithdrawal: () => void; runLpRebalance: () => void; selectedMarket: Market; stake: number; vaultState: VaultState }) {
  const agent = agentForContext(`lp-${selectedMarket.id}`)
  return <div className="two-column"><section className="surface-panel"><SectionHeader eyebrow="SharedLiquidityVault" title="LP control room" icon={<CircleDollarSign size={20} />} /><div className="agent-attribution"><Brain size={14} /><span>Proposed by <b>{agent?.name}</b> · Brier {agent?.brierScore.toFixed(3)} · AI Advisory</span>{agent && <CohortBadge cohort={agent.cohort} />}</div><div className="metric-grid"><Metric icon={<Coins size={18} />} label="Your vault shares" value={formatMON(vaultState.shares)} /><Metric icon={<Gauge size={18} />} label="Vault idle" value={formatMON(vaultState.idle)} /><Metric icon={<ShieldAlert size={18} />} label="Deployed" value={formatMON(vaultState.deployed)} /><Metric icon={<Activity size={18} />} label="Queued exit" value={formatMON(vaultState.queued)} /></div><div className="button-row"><button className="primary-button" onClick={depositLpVault} type="button">Deposit 2 MON</button><button className="secondary-button" disabled={vaultState.shares < 1} onClick={requestLpWithdrawal} type="button">Queue 1 share exit</button><button className="secondary-button" disabled={vaultState.pendingWithdrawal < 1} onClick={processLpWithdrawal} type="button">Process queued exit</button></div><div className="button-row"><button className="primary-button" onClick={runLpRebalance} type="button"><Brain size={18} />Run LP agent</button><button className="secondary-button" disabled={!rebalanceAdvice} onClick={executeLpRebalance} type="button">Approve owner rebalance</button></div>{rebalanceAdvice && <p className="fine-print">{String(rebalanceAdvice.recommendation)} The connected vault owner must sign live rebalances.</p>}<p className="fine-print">{formatMON(protocolLiquidity)} protocol depth across all markets. Withdrawal queue requests remain pull-based when idle vault funds are insufficient.</p></section><section className="surface-panel"><SectionHeader eyebrow="Allocations" title="Depth by market" icon={<LineChart size={20} />} /><div className="table-list">{markets.map((market) => <div className="table-row" key={market.id}><span>#{market.id} {market.category}</span><b>{formatMON(vaultState.allocations[market.id] ?? 0)}</b><span>{formatMON(market.volume)}</span><em>{market.id === selectedMarket.id ? `Stress +${formatMON(stake)}` : market.state}</em></div>)}</div></section></div>
}

export function CreatorStudio({ createCreatorMarket, creatorQuality, creatorQuestion, creatorRevenueMON, latestCreatorMarket, reviewCreatorMarket, seedCreatorPool, setCreatorQuestion }: { createCreatorMarket: () => void; creatorQuality: AiAdvice | null; creatorQuestion: string; creatorRevenueMON: number; latestCreatorMarket: Market | null; reviewCreatorMarket: () => void; seedCreatorPool: (marketId: number) => void; setCreatorQuestion: (value: string) => void }) {
  const agent = agentForContext(creatorQuestion)
  return <div className="two-column"><section className="surface-panel"><SectionHeader eyebrow="Creator API" title="AI-reviewed market studio" icon={<WandSparkles size={20} />} /><div className="agent-attribution"><Bot size={14} /><span>Reviewed by <b>{agent?.name}</b> · Rep {agent?.reputationScore} · AI Advisory</span>{agent && <CohortBadge cohort={agent.cohort} />}</div><label className="field-stack"><span>Resolution-ready question</span><textarea value={creatorQuestion} onChange={(event) => setCreatorQuestion(event.target.value)} /></label><div className="button-row"><button className="secondary-button" onClick={reviewCreatorMarket} type="button">Run quality review</button><button className="primary-button" disabled={!creatorQuality} onClick={createCreatorMarket} type="button">Create testnet market</button></div>{latestCreatorMarket && <div className="router-card"><span>{latestCreatorMarket.sourceMode === 'ON_CHAIN' ? `MarketFactory #${latestCreatorMarket.onChainId}` : 'Demo fallback market'} | {latestCreatorMarket.poolReady ? 'POOL LIVE' : 'AWAITING LIQUIDITY'}</span><h3>{latestCreatorMarket.question}</h3><p>{formatMON(latestCreatorMarket.liquidity)} seeded depth | creator fee routing ready</p><button className="primary-button compact-button" disabled={latestCreatorMarket.poolReady} onClick={() => seedCreatorPool(latestCreatorMarket.id)} type="button">{latestCreatorMarket.poolReady ? 'AMM pool seeded' : 'Seed 5 MON AMM pool'}</button></div>}</section><section className="surface-panel pastel-checker"><SectionHeader eyebrow="CreatorVault" title="Review and economics" icon={<Landmark size={20} />} />{creatorQuality ? <><div className="metric-grid"><Metric icon={<BadgeCheck size={18} />} label="Quality" value={`${String(creatorQuality.qualityScore ?? 91)}/100`} /><Metric icon={<Shield size={18} />} label="Manipulation" value={String(creatorQuality.manipulationRisk ?? 'LOW')} /><Metric icon={<Search size={18} />} label="Duplicate" value={String(creatorQuality.duplicateRisk ?? 'LOW')} /><Metric icon={<Coins size={18} />} label="Indexed revenue" value={formatMON(creatorRevenueMON)} /></div><p className="fine-print">Objective source, UTC deadline, binary wording, creator fee, referral share, and protocol split are ready for user signature.</p></> : <p className="empty-state">Run the Market Quality Agent to unlock testnet creation.</p>}</section></div>
}

export function AgentStudio() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [agent, setAgent] = useState<AgentProfile | null>(null)

  const handleGenerate = async () => {
    if (!prompt) return
    setGenerating(true)
    setAgent(null)
    try {
      const res = await createAgent(prompt)
      setAgent(res.agent)
      setPrompt('')
    } catch (e) {
      console.error(e)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <section className="surface-panel agent-studio" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <SectionHeader eyebrow="Gemini 2.0 Generator" title="Agent Studio" icon={<WandSparkles size={20} />} />
      <p className="fine-print" style={{ marginBottom: '2rem' }}>Dynamically generate and deploy a custom autonomous trading agent into the live ecosystem. Be creative with their forecasting strategy and persona.</p>
      
      <div className="studio-prompt-area" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <textarea 
          placeholder="e.g. A cynical crypto veteran who only trades based on moon phases and inside jokes..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          disabled={generating}
          style={{ width: '100%', padding: '1rem', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', fontSize: '1rem' }}
        />
        <button 
          className="primary-button" 
          onClick={handleGenerate} 
          disabled={generating || !prompt.trim()}
          style={{ alignSelf: 'flex-end', padding: '0.75rem 1.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}
        >
          {generating ? <span className="spinner" /> : <><Sparkles size={18} /> Spawn Agent to Leaderboard</>}
        </button>
      </div>

      {agent && (
        <div className="studio-result" style={{ marginTop: '3rem', animation: 'card-enter 0.5s ease', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>Agent Deployed:</h3>
          <article className="agent-profile-card">
            <div className="agent-avatar" style={{ fontSize: '3rem' }}>{agent.avatar}</div>
            <div className="agent-info">
              <h3>{agent.name} <span className="rank-badge">NEW</span></h3>
              <p className="strategy-label"><Bot size={14} /> {agent.strategy}</p>
              <p className="agent-description" style={{ marginTop: '0.5rem', color: 'var(--text-secondary)' }}>{agent.description}</p>
              <div className="agent-reasoning" style={{ marginTop: '1rem', fontStyle: 'italic', background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem', fontStyle: 'normal' }}>System Prompt:</strong>
                {agent.systemPrompt}
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}

export function CopyTrading() {
  const [traderWallet, setTraderWallet] = useState('')
  const [maxDailySpend, setMaxDailySpend] = useState<number>(100)
  const [preview, setPreview] = useState<{ traderWallet: string; estimatedGasCost: string; warnings: string[] } | null>(null)
  const [session, setSession] = useState<{ id: string; traderWallet: string; spentToday: number; maxDailySpend: number } | null>(null)
  const [loading, setLoading] = useState(false)

  const handlePreview = async () => {
    if (!traderWallet) return
    setLoading(true)
    const res = await fetch('http://localhost:3000/api/copy-trading/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ traderWallet, maxDailySpend })
    }).catch(() => null)
    
    if (res?.ok) {
      setPreview(await res.json())
    }
    setLoading(false)
  }

  const handleFollow = async () => {
    if (!preview) return
    setLoading(true)
    const res = await fetch('http://localhost:3000/api/copy-trading/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        followerWallet: '0x123...abc', // Mock
        traderWallet: preview.traderWallet, 
        maxDailySpend,
        signature: '0xmock_signature'
      })
    }).catch(() => null)
    
    if (res?.ok) {
      setSession(await res.json())
      setPreview(null)
      setTraderWallet('')
    }
    setLoading(false)
  }

  const handleRevoke = async () => {
    if (!session) return
    setLoading(true)
    const res = await fetch('http://localhost:3000/api/copy-trading/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, signature: '0xmock' })
    }).catch(() => null)
    
    if (res?.ok) {
      setSession(null)
    }
    setLoading(false)
  }

  return (
    <div className="two-column">
      <section className="surface-panel">
        <SectionHeader eyebrow="ExchangeBook.sol" title="Copy Trading setup" icon={<Network size={20} />} />
        <p className="fine-print">Follow top performing agents or human traders. Auto-mirror their trades up to your daily cap.</p>
        
        {!session && (
          <>
            <label className="field-stack">
              <span>Target Trader Address</span>
              <input value={traderWallet} onChange={(e) => setTraderWallet(e.target.value)} placeholder="0x..." />
            </label>
            <label className="field-stack" style={{ marginTop: '1rem' }}>
              <span>Max Daily Spend (MON)</span>
              <input type="number" value={maxDailySpend} onChange={(e) => setMaxDailySpend(Number(e.target.value))} min="10" />
            </label>
            
            <div className="button-row" style={{ marginTop: '1rem' }}>
              <button className="secondary-button" onClick={handlePreview} disabled={loading || !traderWallet} type="button">
                {loading ? 'Simulating...' : 'Preview Limits & Gas'}
              </button>
            </div>
          </>
        )}

        {preview && (
          <div className="router-card" style={{ marginTop: '1.5rem' }}>
            <span>Preview Quote</span>
            <h3>Copying {preview.traderWallet.slice(0, 8)}...</h3>
            <p>Est. Gas: {preview.estimatedGasCost} / trade</p>
            {preview.warnings.map((w: string, i: number) => <small key={i} style={{ display: 'block', color: 'var(--text-secondary)' }}>• {w}</small>)}
            <button className="primary-button" style={{ marginTop: '1rem', width: '100%' }} onClick={handleFollow} disabled={loading}>
              Sign Capped Authorization
            </button>
          </div>
        )}

        {session && (
          <div className="router-card" style={{ marginTop: '1.5rem', background: 'rgba(0,255,0,0.05)', border: '1px solid rgba(0,255,0,0.2)' }}>
            <span style={{ color: 'var(--success-color)' }}><CheckCircle2 size={14} style={{ display: 'inline', verticalAlign: 'text-bottom' }}/> Active Session</span>
            <h3>Following {session.traderWallet.slice(0, 8)}...</h3>
            <p>Spent today: {session.spentToday} / {session.maxDailySpend} MON</p>
            <button className="secondary-button" style={{ marginTop: '1rem', width: '100%', borderColor: 'var(--error-color)', color: 'var(--error-color)' }} onClick={handleRevoke} disabled={loading}>
              Revoke Authorization
            </button>
          </div>
        )}
      </section>
      
      <section className="surface-panel pastel-checker">
        <SectionHeader eyebrow="Leaderboard" title="Top Traders to Copy" icon={<Trophy size={20} />} />
        <div className="agent-council-grid">
          <article>
            <div className="economy-avatar">🧠</div>
            <div>
              <h3>Alpha Ensemble</h3>
              <span className="strategy-label">Consensus Agent</span>
            </div>
            <b>+14.2% Return</b>
            <button className="ghost-button compact-button" onClick={() => setTraderWallet('0xAlphaEnsemble1234')} type="button">Select</button>
          </article>
          <article>
            <div className="economy-avatar">⚡</div>
            <div>
              <h3>Quant Razor</h3>
              <span className="strategy-label">Momentum Agent</span>
            </div>
            <b>+11.8% Return</b>
            <button className="ghost-button compact-button" onClick={() => setTraderWallet('0xQuantRazor5678')} type="button">Select</button>
          </article>
        </div>
      </section>
    </div>
  )
}
