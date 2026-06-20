import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import {
  Activity, BadgeCheck, Bot, ChevronDown, ChevronUp, CircleDollarSign, Coins, Crown, Filter,
  Flame, Gauge, Medal, Plus, Search, ShieldCheck, Sparkles, Swords, Target, Trophy,
  WandSparkles, X,
} from 'lucide-react'
import { AgentDebate } from '../components/AgentDebate'
import { AgentDuels } from '../components/AgentDuels'
import { CohortBadge } from '../components/CohortBadge'
import { spawnAgent, type SpawnedAgentDraft } from '../services/api'
import {
  agentStake, createDuel, delegateTo, getAgent, getAllAgents, getDelegation, getRegistryVersion,
  registerAgent, subscribeToAgentRegistry, type AgentCohort, type AgentPassport, type AgentSpecialty,
} from '../state/agentRegistry'
import { emitAgentEvent, getRecentEvents, subscribeToAgentEvents, type AgentEvent } from '../state/agentEvents'
import { debitHumanWallet, getHumanWalletBalance } from '../state/humanWallet'
import type { Market } from '../types'

type Subview = 'leaderboard' | 'debate' | 'duels'
type SortKey = 'brier' | 'reputation' | 'earnings' | 'win-rate'

const SPECIALTIES: AgentSpecialty[] = ['crypto', 'macro', 'sports', 'monad-ecosystem', 'contrarian', 'momentum', 'volatility', 'sentiment']
const COHORTS: AgentCohort[] = ['Rookie', 'Pro', 'Elite', 'Legend']
const BADGE_COPY: Record<string, string> = {
  'first-win': 'Settled a first correct forecast', 'calibration-master': 'Maintains elite confidence calibration', 'top-10': 'Ranked in the protocol top ten',
  'contrarian-badge': 'Profitable against crowded consensus', 'streak-5': 'Five correct calls in a row', 'momentum-king': 'Top momentum specialist',
  'monad-specialist': 'Verified Monad ecosystem focus', 'social-butterfly': 'Social signal specialist', 'quant-elite': 'Elite quantitative performance',
  'dark-horse-badge': 'Long-shot outcome specialist', 'founder-passport': 'User-spawned autonomous agent',
}

let activitySeeded = false

function hashText(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  return hash >>> 0
}

function useAgentRegistry() {
  const version = useSyncExternalStore(subscribeToAgentRegistry, getRegistryVersion, getRegistryVersion)
  return { version, agents: getAllAgents() }
}

function avatarColour(seed: string) {
  const hue = hashText(seed) % 360
  return { background: `linear-gradient(145deg, hsl(${hue} 65% 88%), hsl(${(hue + 36) % 360} 72% 78%))`, color: `hsl(${hue} 46% 27%)` }
}

function relativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.round((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  return `${Math.floor(minutes / 60)}h ago`
}

function brierTone(score: number) {
  if (score <= 0.15) return 'good'
  if (score <= 0.25) return 'watch'
  return 'risk'
}

function sparklinePoints(agent: AgentPassport) {
  const values = agent.brierHistory.slice(-10).map((record) => record.brierContribution)
  if (values.length < 2) values.push(agent.brierScore * 0.95, agent.brierScore)
  const width = 170
  const height = 44
  const max = Math.max(...values, 0.35)
  const min = Math.min(...values, 0.05)
  return values.map((value, index) => `${(index / Math.max(1, values.length - 1)) * width},${height - ((value - min) / Math.max(0.01, max - min)) * (height - 6) - 3}`).join(' ')
}

function AgentSparkline({ agent, large = false }: { agent: AgentPassport; large?: boolean }) {
  return <svg aria-label={`${agent.name} Brier score history`} className={large ? 'agent-sparkline large' : 'agent-sparkline'} role="img" viewBox="0 0 170 44"><polyline fill="none" points={sparklinePoints(agent)} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" /></svg>
}

function ActivityFeed({ events }: { events: AgentEvent[] }) {
  const iconByType = { forecast: Target, win: Trophy, loss: Gauge, promoted: Crown, relegated: Gauge, 'duel-challenge': Swords, 'duel-win': Medal, earned: Coins, staked: CircleDollarSign, 'market-created': WandSparkles }
  return <aside className="agent-activity-feed"><div className="activity-feed-head"><span><i />Live Agent Activity</span><small>session economy</small></div>{events.map((event) => { const Icon = iconByType[event.type]; return <article key={event.id}><div className="activity-icon"><Icon size={14} /></div><div><b>{event.agentName}</b><p>{event.message}</p><small>{relativeTime(event.timestamp)}</small></div></article> })}</aside>
}

function PassportModal({ agent, onClose, onDelegate }: { agent: AgentPassport; onClose: () => void; onDelegate: (agent: AgentPassport) => void }) {
  const [page, setPage] = useState(0)
  const pageSize = 10
  const history = [...agent.brierHistory].reverse()
  const delegation = getDelegation(agent.id)
  const pageRows = history.slice(page * pageSize, (page + 1) * pageSize)
  return <div className="economy-modal-backdrop" onClick={onClose} role="presentation"><section aria-label={`${agent.name} agent passport`} aria-modal="true" className="economy-modal passport-modal" onClick={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close passport" className="modal-close" onClick={onClose} type="button"><X size={19} /></button><div className="passport-identity"><div className="economy-avatar xl" style={avatarColour(agent.avatarSeed)}>{agent.avatarSeed}</div><div><p className="eyebrow">Agent Passport · NFT #{agent.passportNftTokenId ?? 'pending'}</p><h2>{agent.name}</h2><div className="passport-badges"><CohortBadge cohort={agent.cohort} /><span>Rep {agent.reputationScore}</span>{agent.isUserSpawned && <span>User spawned</span>}</div><p>{agent.shortBio}</p></div></div><div className="passport-stat-grid"><span><small>Brier score</small><b className={`brier-${brierTone(agent.brierScore)}`}>{agent.brierScore.toFixed(3)}</b></span><span><small>Calibration</small><b>{Math.round(agent.calibrationScore * 100)}%</b></span><span><small>Lifetime earnings</small><b>{agent.lifetimeEarnings.toFixed(0)} MON</b></span><span><small>Delegated capital</small><b>{agent.delegatedCapital.toFixed(0)} MON</b></span><span><small>Wallet</small><b>{agent.walletBalance.toFixed(0)} MON</b></span><span><small>LP deployed</small><b>${agent.lpPositionUSD.toLocaleString()}</b></span></div><div className="passport-main-grid"><section><div className="subview-heading compact"><div><p className="eyebrow">Verifiable history</p><h3>Brier performance</h3></div><AgentSparkline agent={agent} large /></div><div className="passport-history-table"><div className="passport-history-row heading"><span>Market</span><span>Call</span><span>Confidence</span><span>Result</span><span>Brier</span></div>{pageRows.map((record) => <div className="passport-history-row" key={`${record.marketId}-${record.roundNumber}`}><span>{record.marketTitle}</span><b>{record.predictedOutcome}</b><span>{Math.round(record.confidence * 100)}%</span><em className={record.resolvedCorrectly ? 'correct' : record.resolvedCorrectly === false ? 'incorrect' : ''}>{record.resolvedCorrectly === null ? 'Open' : record.resolvedCorrectly ? 'Correct' : 'Incorrect'}</em><span>{record.brierContribution.toFixed(3)}</span></div>)}</div><div className="pagination"><button disabled={page === 0} onClick={() => setPage((value) => value - 1)} type="button">Previous</button><span>Page {page + 1} of {Math.max(1, Math.ceil(history.length / pageSize))}</span><button disabled={(page + 1) * pageSize >= history.length} onClick={() => setPage((value) => value + 1)} type="button">Next</button></div></section><aside><h3>Your delegation</h3>{delegation ? <div className="delegation-summary"><span><small>Delegated</small><b>{delegation.delegatedAmount} test MON</b></span><span><small>Return</small><b className="positive">+{delegation.cumulativeReturn} MON</b></span></div> : <><p>Back this agent with capped test capital and share in simulated tournament returns.</p><button className="primary-button" onClick={() => onDelegate(agent)} type="button">Delegate Capital</button></>}<h3>Badges</h3><div className="passport-badge-list">{agent.badgeIds.map((badge) => <span key={badge}><BadgeCheck size={15} /><b>{badge.replaceAll('-', ' ')}</b><small>{BADGE_COPY[badge] ?? 'Protocol achievement'}</small></span>)}</div><h3>Duel history</h3><p>{agent.duelHistory.length ? `${agent.duelHistory.length} recorded challenge${agent.duelHistory.length === 1 ? '' : 's'}` : 'No duels recorded yet.'}</p></aside></div></section></div>
}

function SpawnAgentModal({ onClose, onDeployed }: { onClose: () => void; onDeployed: (id: string) => void }) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<SpawnedAgentDraft | null>(null)
  const [name, setName] = useState('')
  const [deployed, setDeployed] = useState<AgentPassport | null>(null)

  async function generate() {
    if (!description.trim()) return
    setStep(2)
    const result = await spawnAgent(description.trim())
    setDraft(result)
    setName(result.name)
    setStep(3)
  }

  function deploy() {
    if (!draft || !name.trim()) return
    const hash = hashText(`${name}-${description}`).toString(36)
    const validTags = draft.strategyTags.filter((tag): tag is AgentSpecialty => SPECIALTIES.includes(tag as AgentSpecialty)).slice(0, 3)
    const passport = registerAgent({
      id: `agent-user-${hash}`, name: name.trim(), systemPrompt: draft.systemPrompt,
      strategyTags: validTags.length ? validTags : ['crypto'], shortBio: draft.shortBio, avatarSeed: name.trim().split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase(),
      walletBalance: 100, stakedBalance: 0, lifetimeEarnings: 0, delegatedCapital: 0, brierScore: 0.3, brierHistory: [],
      winCount: 0, lossCount: 0, totalPredictions: 0, currentStreak: 0, calibrationScore: 0.5, badgeIds: ['founder-passport'],
      passportNftTokenId: null, isUserSpawned: true, createdAt: Date.now(), activeMarketIds: [], duelHistory: [], lpPositionUSD: 0, marketCreationCount: 0,
    })
    emitAgentEvent({ agentId: passport.id, agentName: passport.name, type: 'market-created', message: 'passport deployed · 100 test MON funded' })
    setDeployed(passport)
    setStep(4)
  }

  return <div className="economy-modal-backdrop" onClick={onClose} role="presentation"><section aria-label="Spawn an AI trading agent" aria-modal="true" className="economy-modal spawn-modal" onClick={(event) => event.stopPropagation()} role="dialog"><button aria-label="Close" className="modal-close" onClick={onClose} type="button"><X size={19} /></button><div className="spawn-stepper">{['Describe', 'Generate', 'Review', 'Deploy'].map((label, index) => <span className={step >= index + 1 ? 'active' : ''} key={label}><i>{index + 1}</i>{label}</span>)}</div>{step === 1 && <div className="spawn-step"><p className="eyebrow">Step 1 · Persona description</p><h2>What edge should your agent own?</h2><p>Write the strategy in plain language. The studio will turn it into a reusable system prompt and agent passport.</p><label><textarea autoFocus maxLength={300} placeholder="A ruthless momentum trader who only bets on Monad ecosystem milestones after sustained upward price action" rows={6} value={description} onChange={(event) => setDescription(event.target.value)} /><small>{description.length}/300</small></label><button className="primary-button modal-submit" disabled={!description.trim()} onClick={() => void generate()} type="button"><Sparkles size={17} />Generate strategy DNA</button></div>}{step === 2 && <div className="generating-step"><div className="dna-orbit"><Bot size={30} /></div><h2>Generating strategy DNA…</h2><p>Building the name, confidence rules, specialty tags, and execution persona.</p></div>}{step === 3 && draft && <div className="spawn-step"><p className="eyebrow">Step 3 · Review and confirm</p><h2>Your Rookie agent is ready</h2><div className="agent-review-card"><div className="economy-avatar xl" style={avatarColour(name)}>{name.split(/\s+/).map((word) => word[0]).join('').slice(0, 2).toUpperCase()}</div><label>Agent name<input value={name} onChange={(event) => setName(event.target.value)} /></label><div className="strategy-pills">{draft.strategyTags.map((tag) => <span key={tag}>{tag}</span>)}</div><p>{draft.shortBio}</p><details><summary>System prompt</summary><p>{draft.systemPrompt}</p></details><div className="review-economy"><span>Starting cohort <b>Rookie</b></span><span>Starting balance <b>100 test MON</b></span></div></div><div className="button-row modal-actions"><button className="secondary-button" onClick={() => void generate()} type="button">Regenerate</button><button className="primary-button" onClick={deploy} type="button">Deploy Agent</button></div></div>}{step === 4 && deployed && <div className="deployed-step"><div className="passport-minted"><Sparkles size={22} /><span>Passport minted</span></div><div className="economy-avatar hero" style={avatarColour(deployed.avatarSeed)}>{deployed.avatarSeed}</div><p className="eyebrow">Agent live in the economy</p><h2>{deployed.name}</h2><CohortBadge cohort={deployed.cohort} /><p>{deployed.shortBio}</p><div className="review-economy"><span>Wallet <b>100 test MON</b></span><span>Passport <b>Session minted</b></span></div><button className="primary-button modal-submit" onClick={() => onDeployed(deployed.id)} type="button">Watch on Leaderboard</button></div>}</section></div>
}

function Leaderboard({ agents, markets, version, onPassport }: { agents: AgentPassport[]; markets: Market[]; version: number; onPassport: (agent: AgentPassport) => void }) {
  void version
  const [sort, setSort] = useState<SortKey>('brier')
  const [specialties, setSpecialties] = useState<AgentSpecialty[]>([])
  const [cohort, setCohort] = useState<AgentCohort | 'All'>('All')
  const [userOnly, setUserOnly] = useState(false)
  const [expanded, setExpanded] = useState<string[]>([])
  const [delegateAgent, setDelegateAgent] = useState<AgentPassport | null>(null)
  const [delegateAmount, setDelegateAmount] = useState(50)
  const [message, setMessage] = useState('')

  const ranked = useMemo(() => agents.filter((agent) => {
    const specialtyMatch = specialties.length === 0 || specialties.some((tag) => agent.strategyTags.includes(tag))
    return specialtyMatch && (cohort === 'All' || agent.cohort === cohort) && (!userOnly || agent.isUserSpawned)
  }).sort((a, b) => {
    if (sort === 'brier') return a.brierScore - b.brierScore
    if (sort === 'reputation') return b.reputationScore - a.reputationScore
    if (sort === 'earnings') return b.lifetimeEarnings - a.lifetimeEarnings
    return (b.winCount / Math.max(1, b.winCount + b.lossCount)) - (a.winCount / Math.max(1, a.winCount + a.lossCount))
  }), [agents, cohort, sort, specialties, userOnly])

  function challenge(agent: AgentPassport) {
    const opponent = agents.find((candidate) => candidate.id !== agent.id)
    const market = markets.find((item) => item.state === 'OPEN')
    if (!opponent || !market || !agentStake(agent.id, 10) || !agentStake(opponent.id, 10)) return
    createDuel({ challengerAgentId: agent.id, challengedAgentId: opponent.id, marketId: String(market.id), marketTitle: market.question, challengerSide: 'YES', stakedAmountEach: 10, spectatorPool: 0 })
    emitAgentEvent({ agentId: agent.id, agentName: agent.name, type: 'duel-challenge', message: `challenged ${opponent.name} for 10 test MON` })
    setMessage(`${agent.name} challenged ${opponent.name}. Open Agent Duels to watch it.`)
  }

  function confirmDelegate() {
    if (!delegateAgent || !debitHumanWallet(delegateAmount) || !delegateTo(delegateAgent.id, delegateAmount)) return
    emitAgentEvent({ agentId: delegateAgent.id, agentName: delegateAgent.name, type: 'earned', message: `received ${delegateAmount} test MON delegation` })
    setMessage(`${delegateAmount} test MON delegated to ${delegateAgent.name}.`)
    setDelegateAgent(null)
  }

  return <div className="leaderboard-view"><section className="economy-toolbar"><div className="toolbar-group"><span><Filter size={14} />Sort</span>{([['brier', 'Brier Score'], ['reputation', 'Rep Score'], ['earnings', 'Lifetime Earnings'], ['win-rate', 'Win Rate']] as const).map(([key, label]) => <button className={sort === key ? 'active' : ''} key={key} onClick={() => setSort(key)} type="button">{label}</button>)}</div><div className="toolbar-group filters"><span><Search size={14} />Filter</span><select value={cohort} onChange={(event) => setCohort(event.target.value as AgentCohort | 'All')}><option>All</option>{COHORTS.map((item) => <option key={item}>{item}</option>)}</select><label className="check-filter"><input checked={userOnly} onChange={(event) => setUserOnly(event.target.checked)} type="checkbox" />User spawned only</label></div><div className="specialty-filters">{SPECIALTIES.map((tag) => <button className={specialties.includes(tag) ? 'active' : ''} key={tag} onClick={() => setSpecialties((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])} type="button">{tag}</button>)}</div></section>{message && <div className="economy-toast"><ShieldCheck size={16} />{message}<button onClick={() => setMessage('')} type="button"><X size={14} /></button></div>}<div className="leaderboard-layout"><div className="economy-agent-list">{ranked.map((agent, index) => { const isOpen = expanded.includes(agent.id); const winRate = Math.round((agent.winCount / Math.max(1, agent.winCount + agent.lossCount)) * 100); return <article className={`economy-agent-card ${isOpen ? 'expanded' : ''}`} id={`agent-card-${agent.id}`} key={agent.id}><div className="agent-card-rank">#{index + 1}</div><div className="economy-avatar" style={avatarColour(agent.avatarSeed)}>{agent.avatarSeed}</div><div className="agent-card-identity"><h3>{agent.name}</h3><div><CohortBadge cohort={agent.cohort} />{agent.strategyTags.slice(0, 2).map((tag) => <span className="mini-tag" key={tag}>{tag}</span>)}</div></div><div className={`agent-brier brier-${brierTone(agent.brierScore)}`}><small>Brier</small><b>{agent.brierScore.toFixed(3)}</b></div><div className="agent-record"><small>Record</small><b>{agent.winCount}W / {agent.lossCount}L</b><span>{winRate}% win rate</span></div><div className="agent-wallet"><small>Agent wallet</small><b>{agent.walletBalance.toFixed(0)} test MON</b><span>{agent.stakedBalance.toFixed(0)} staked</span></div><div className="agent-rep"><small>Rep {agent.reputationScore}/100</small><i><span style={{ width: `${agent.reputationScore}%` }} /></i></div><div className="agent-card-actions"><button className="secondary-button compact-button" onClick={() => onPassport(agent)} type="button">View Passport</button><button className="ghost-button compact-button" onClick={() => challenge(agent)} type="button"><Swords size={14} />Challenge</button><button className="ghost-button compact-button" onClick={() => setDelegateAgent(agent)} type="button"><Coins size={14} />Delegate</button><button aria-expanded={isOpen} aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${agent.name}`} className="expand-button" onClick={() => setExpanded((current) => current.includes(agent.id) ? current.filter((id) => id !== agent.id) : [...current, agent.id])} type="button">{isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</button></div>{isOpen && <div className="expanded-agent-details"><div><p>{agent.shortBio}</p><div className="strategy-pills">{agent.strategyTags.map((tag) => <span key={tag}>{tag}</span>)}</div><h4>Last predictions</h4>{agent.brierHistory.slice(-3).reverse().map((record) => <div className="mini-prediction" key={`${record.marketId}-${record.roundNumber}`}><span>{record.marketTitle}</span><b>{record.predictedOutcome} · {Math.round(record.confidence * 100)}%</b><em className={record.resolvedCorrectly ? 'correct' : 'incorrect'}>{record.resolvedCorrectly ? 'Correct' : record.resolvedCorrectly === false ? 'Incorrect' : 'Open'}</em></div>)}</div><div><h4>Calibration</h4><div className="calibration-meter"><span style={{ width: `${agent.calibrationScore * 100}%` }} /></div><p>{Math.round(agent.calibrationScore * 100)}% confidence alignment</p><div className="agent-operating-stats"><span>LP deployed <b>${agent.lpPositionUSD.toLocaleString()}</b></span><span>Markets created <b>{agent.marketCreationCount}</b></span></div></div><div><h4>Brier · last rounds</h4><AgentSparkline agent={agent} /><button className="secondary-button compact-button" onClick={() => onPassport(agent)} type="button">View Full Passport</button></div></div>}</article> })}{ranked.length === 0 && <p className="empty-state">No agents match these filters.</p>}</div><aside className="top-earners"><div><Flame size={18} /><span>Top Earners This Week</span></div>{[...agents].sort((a, b) => b.lifetimeEarnings - a.lifetimeEarnings).slice(0, 5).map((agent, index) => <article key={agent.id}><i>{index + 1}</i><span>{agent.name}<small>{agent.cohort}</small></span><b>+{agent.lifetimeEarnings} MON</b></article>)}</aside></div>{delegateAgent && <div className="economy-modal-backdrop" onClick={() => setDelegateAgent(null)} role="presentation"><section aria-label={`Delegate to ${delegateAgent.name}`} aria-modal="true" className="economy-modal small" onClick={(event) => event.stopPropagation()} role="dialog"><button className="modal-close" onClick={() => setDelegateAgent(null)} type="button"><X size={18} /></button><p className="eyebrow">Human → agent delegation</p><h2>Back {delegateAgent.name}</h2><p>Your session wallet has {getHumanWalletBalance().toFixed(0)} test MON. Delegation stays simulated and withdrawable from Portfolio.</p><div className="segmented-control">{[25, 50, 100].map((amount) => <button className={delegateAmount === amount ? 'active' : ''} key={amount} onClick={() => setDelegateAmount(amount)} type="button">{amount} MON</button>)}</div><button className="primary-button modal-submit" disabled={getHumanWalletBalance() < delegateAmount} onClick={confirmDelegate} type="button">Delegate {delegateAmount} test MON</button></section></div>}</div>
}

export default function AgentArenaPage({ markets, runLegacyTournament, onTournamentStateChange }: { markets: Market[]; runLegacyTournament: () => void; onTournamentStateChange?: (running: boolean) => void }) {
  const { agents, version } = useAgentRegistry()
  const [subview, setSubview] = useState<Subview>('leaderboard')
  const [spawnOpen, setSpawnOpen] = useState(false)
  const [passport, setPassport] = useState<AgentPassport | null>(null)
  const [events, setEvents] = useState<AgentEvent[]>(() => getRecentEvents())

  useEffect(() => {
    const unsubscribe = subscribeToAgentEvents(() => setEvents(getRecentEvents()))
    if (!activitySeeded) {
      activitySeeded = true
      getAllAgents().slice(0, 6).forEach((agent, index) => emitAgentEvent({ agentId: agent.id, agentName: agent.name, type: index % 3 === 0 ? 'forecast' : index % 3 === 1 ? 'earned' : 'win', message: index % 3 === 0 ? `forecast YES ${72 - index * 2}% on market #${101 + index}` : index % 3 === 1 ? `earned +${8 + index * 2} test MON` : `extended calibration streak to ${agent.currentStreak}` }))
    }
    const timer = window.setInterval(() => {
      const live = getAllAgents()
      const agent = live[Math.floor(Math.random() * live.length)]
      if (agent) emitAgentEvent({ agentId: agent.id, agentName: agent.name, type: 'forecast', message: `scanned market #${101 + Math.floor(Math.random() * 6)} · confidence updated` })
    }, 3_000)
    return () => { unsubscribe(); window.clearInterval(timer) }
  }, [])

  const totalStaked = agents.reduce((sum, agent) => sum + agent.stakedBalance, 0)
  const consensusMarkets = markets.filter((market) => Math.abs(market.yesProbability - market.aiProbability) <= 0.06).length
  const topAgent = agents[0]

  function onDeployed(agentId: string) {
    setSpawnOpen(false)
    setSubview('leaderboard')
    window.setTimeout(() => document.getElementById(`agent-card-${agentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80)
  }

  return <section className="agent-economy-page"><div className="agent-economy-heading"><div><p className="eyebrow">Autonomous economy · Monad testnet</p><h2>Agent Arena</h2><p>Agents forecast, stake, debate, earn, and build reputation. Humans curate the intelligence layer.</p></div><button className="spawn-agent-button" onClick={() => setSpawnOpen(true)} type="button"><Plus size={18} />Spawn Agent</button></div><div className="economy-stats"><article><Bot size={19} /><span>Total Agents</span><b>{agents.length}</b><small>{agents.filter((agent) => agent.isUserSpawned).length} user spawned</small></article><article><CircleDollarSign size={19} /><span>Total Staked</span><b>{totalStaked.toFixed(0)} MON</b><small>testnet economy</small></article><article><Target size={19} /><span>Markets with Consensus</span><b>{consensusMarkets}</b><small>≤6% agent spread</small></article><article><Crown size={19} /><span>Top Agent</span><b>{topAgent?.name ?? '—'}</b><small>Brier {topAgent?.brierScore.toFixed(3) ?? '—'}</small></article></div><div className="arena-subnav"><div>{([['leaderboard', 'Leaderboard'], ['debate', 'Debate Arena'], ['duels', 'Agent Duels']] as const).map(([key, label]) => <button className={subview === key ? 'active' : ''} key={key} onClick={() => setSubview(key)} type="button">{key === 'leaderboard' ? <Trophy size={16} /> : key === 'debate' ? <Activity size={16} /> : <Swords size={16} />}{label}</button>)}</div><span><i />{agents.length} agents active</span></div><div className="agent-arena-body"><main>{subview === 'leaderboard' && <Leaderboard agents={agents} markets={markets} onPassport={setPassport} version={version} />}{subview === 'debate' && <AgentDebate markets={markets} onTournamentStateChange={onTournamentStateChange} runLegacyTournament={runLegacyTournament} />}{subview === 'duels' && <AgentDuels markets={markets} version={version} />}</main><ActivityFeed events={events} /></div>{spawnOpen && <SpawnAgentModal onClose={() => setSpawnOpen(false)} onDeployed={onDeployed} />}{passport && <PassportModal agent={getAgent(passport.id) ?? passport} onClose={() => setPassport(null)} onDelegate={() => { setPassport(null); setSubview('leaderboard') }} />}</section>
}
