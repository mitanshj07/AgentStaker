export type AgentCohort = 'Rookie' | 'Pro' | 'Elite' | 'Legend'

export type AgentSpecialty =
  | 'crypto'
  | 'macro'
  | 'sports'
  | 'monad-ecosystem'
  | 'contrarian'
  | 'momentum'
  | 'volatility'
  | 'sentiment'

export interface AgentPredictionRecord {
  marketId: string
  marketTitle: string
  predictedOutcome: 'YES' | 'NO'
  confidence: number
  brierContribution: number
  resolvedCorrectly: boolean | null
  timestamp: number
  roundNumber: number
  earningsFromThis: number
}

export interface AgentDuel {
  id: string
  challengerAgentId: string
  challengedAgentId: string
  marketId: string
  marketTitle: string
  challengerSide: 'YES' | 'NO'
  stakedAmountEach: number
  spectatorPool: number
  status: 'open' | 'active' | 'resolved'
  winnerId: string | null
  createdAt: number
  resolvedAt: number | null
}

export interface AgentPassport {
  id: string
  name: string
  systemPrompt: string
  strategyTags: AgentSpecialty[]
  shortBio: string
  avatarSeed: string
  walletBalance: number
  stakedBalance: number
  lifetimeEarnings: number
  delegatedCapital: number
  brierScore: number
  brierHistory: AgentPredictionRecord[]
  winCount: number
  lossCount: number
  totalPredictions: number
  currentStreak: number
  calibrationScore: number
  cohort: AgentCohort
  badgeIds: string[]
  reputationScore: number
  passportNftTokenId: string | null
  isUserSpawned: boolean
  createdAt: number
  activeMarketIds: string[]
  duelHistory: string[]
  lpPositionUSD: number
  marketCreationCount: number
}

export interface DelegationRecord {
  agentId: string
  delegatedAmount: number
  delegatedAt: number
  cumulativeReturn: number
}

type SeedAgent = Omit<AgentPassport, 'cohort' | 'reputationScore' | 'brierHistory'>
type RegistryListener = () => void

const DAY = 86_400_000
const registry = new Map<string, AgentPassport>()
const delegations = new Map<string, DelegationRecord>()
const duels = new Map<string, AgentDuel>()
const registryListeners = new Set<RegistryListener>()
let registryVersion = 0

const SEED_AGENTS: SeedAgent[] = [
  {
    id: 'agent-alpha-macro',
    name: 'Alpha Macro',
    systemPrompt: 'You are a conservative macro-specialist AI trading agent. Analyse monetary policy, interest-rate cycles, and cross-asset flows. Never over-fit recent price action and shade toward 0.50 when evidence is weak.',
    strategyTags: ['macro', 'crypto'],
    shortBio: 'Macro rates specialist with cross-asset conviction',
    avatarSeed: 'AM', walletBalance: 240, stakedBalance: 60, lifetimeEarnings: 340, delegatedCapital: 500,
    brierScore: 0.14, winCount: 31, lossCount: 9, totalPredictions: 40, currentStreak: 4, calibrationScore: 0.88,
    badgeIds: ['first-win', 'calibration-master', 'top-10'], passportNftTokenId: '101', isUserSpawned: false,
    createdAt: Date.now() - DAY * 14, activeMarketIds: ['101', '103'], duelHistory: [], lpPositionUSD: 1200, marketCreationCount: 3,
  },
  {
    id: 'agent-contrarian-cx',
    name: 'Contrarian CX',
    systemPrompt: 'You are a contrarian trading agent. Fade consensus when either side exceeds 75%, prioritise mean reversion, and quote confidence only between 0.55 and 0.80.',
    strategyTags: ['contrarian', 'sentiment'],
    shortBio: 'Fades overcrowded consensus positions ruthlessly',
    avatarSeed: 'CC', walletBalance: 180, stakedBalance: 80, lifetimeEarnings: 290, delegatedCapital: 350,
    brierScore: 0.19, winCount: 24, lossCount: 11, totalPredictions: 35, currentStreak: 2, calibrationScore: 0.82,
    badgeIds: ['contrarian-badge', 'streak-5'], passportNftTokenId: '102', isUserSpawned: false,
    createdAt: Date.now() - DAY * 10, activeMarketIds: ['102', '105'], duelHistory: [], lpPositionUSD: 800, marketCreationCount: 1,
  },
  {
    id: 'agent-momentum-mx',
    name: 'Momentum MX',
    systemPrompt: 'You are a momentum-trading AI agent. Identify trends sustained for more than 48 hours, cut exposure when momentum stalls, and keep confidence between 0.60 and 0.85.',
    strategyTags: ['momentum', 'crypto'],
    shortBio: 'Rides trends hard, exits before they break',
    avatarSeed: 'MM', walletBalance: 310, stakedBalance: 40, lifetimeEarnings: 410, delegatedCapital: 620,
    brierScore: 0.17, winCount: 28, lossCount: 8, totalPredictions: 36, currentStreak: 6, calibrationScore: 0.85,
    badgeIds: ['streak-5', 'top-10', 'momentum-king'], passportNftTokenId: '103', isUserSpawned: false,
    createdAt: Date.now() - DAY * 12, activeMarketIds: ['101', '104'], duelHistory: [], lpPositionUSD: 1500, marketCreationCount: 2,
  },
  {
    id: 'agent-vol-vortex',
    name: 'Vol Vortex',
    systemPrompt: 'You are a volatility specialist. Compare implied and realised volatility, hunt underpriced tail risk, and take low-probability YES positions only with explicit evidence.',
    strategyTags: ['volatility', 'crypto'],
    shortBio: 'Hunts mispriced tail risk in volatile markets',
    avatarSeed: 'VV', walletBalance: 150, stakedBalance: 100, lifetimeEarnings: 200, delegatedCapital: 280,
    brierScore: 0.22, winCount: 19, lossCount: 12, totalPredictions: 31, currentStreak: -1, calibrationScore: 0.79,
    badgeIds: ['first-win'], passportNftTokenId: '104', isUserSpawned: false,
    createdAt: Date.now() - DAY * 8, activeMarketIds: ['101', '106'], duelHistory: [], lpPositionUSD: 600, marketCreationCount: 0,
  },
  {
    id: 'agent-monad-native',
    name: 'Monad Native',
    systemPrompt: 'You specialise exclusively in Monad ecosystem markets. Track official announcements, GitHub activity, validators, testnet upgrades, and project launches. Use 0.65–0.90 confidence only on Monad topics.',
    strategyTags: ['monad-ecosystem'],
    shortBio: 'Deep Monad ecosystem analyst and builder tracker',
    avatarSeed: 'MN', walletBalance: 200, stakedBalance: 50, lifetimeEarnings: 260, delegatedCapital: 400,
    brierScore: 0.16, winCount: 22, lossCount: 6, totalPredictions: 28, currentStreak: 3, calibrationScore: 0.87,
    badgeIds: ['monad-specialist', 'top-10'], passportNftTokenId: '105', isUserSpawned: false,
    createdAt: Date.now() - DAY * 7, activeMarketIds: ['103'], duelHistory: [], lpPositionUSD: 900, marketCreationCount: 5,
  },
  {
    id: 'agent-sentiment-sage',
    name: 'Sentiment Sage',
    systemPrompt: 'You are a sentiment-analysis AI agent. Interpret crowd psychology, social signals, and news tone for sports and social markets. State confidence between 0.55 and 0.80.',
    strategyTags: ['sentiment', 'sports'],
    shortBio: 'Reads crowd psychology before markets price it in',
    avatarSeed: 'SS', walletBalance: 170, stakedBalance: 30, lifetimeEarnings: 180, delegatedCapital: 220,
    brierScore: 0.25, winCount: 17, lossCount: 13, totalPredictions: 30, currentStreak: 1, calibrationScore: 0.75,
    badgeIds: ['social-butterfly'], passportNftTokenId: '106', isUserSpawned: false,
    createdAt: Date.now() - DAY * 6, activeMarketIds: ['102', '104'], duelHistory: [], lpPositionUSD: 400, marketCreationCount: 1,
  },
  {
    id: 'agent-quant-q7',
    name: 'Quant Q7',
    systemPrompt: 'You are a Bayesian quantitative agent. Use priors, evidence, posteriors, Kelly sizing, and ELO-style scoring. Never exceed 0.85 confidence and always show your working.',
    strategyTags: ['macro', 'crypto', 'momentum'],
    shortBio: 'Pure Bayesian quant; Kelly-sized and stat-justified',
    avatarSeed: 'QQ', walletBalance: 280, stakedBalance: 70, lifetimeEarnings: 380, delegatedCapital: 550,
    brierScore: 0.13, winCount: 33, lossCount: 7, totalPredictions: 40, currentStreak: 5, calibrationScore: 0.91,
    badgeIds: ['calibration-master', 'top-10', 'quant-elite', 'streak-5'], passportNftTokenId: '107', isUserSpawned: false,
    createdAt: Date.now() - DAY * 15, activeMarketIds: ['101', '103'], duelHistory: [], lpPositionUSD: 2000, marketCreationCount: 4,
  },
  {
    id: 'agent-dark-horse',
    name: 'Dark Horse',
    systemPrompt: 'You are a low-probability specialist. Seek YES markets priced below 25% where tail risk is underestimated. State your true confidence without hedging.',
    strategyTags: ['contrarian', 'volatility'],
    shortBio: 'Hunts long-shot outcomes the market ignores',
    avatarSeed: 'DH', walletBalance: 90, stakedBalance: 110, lifetimeEarnings: 140, delegatedCapital: 160,
    brierScore: 0.31, winCount: 12, lossCount: 18, totalPredictions: 30, currentStreak: -3, calibrationScore: 0.68,
    badgeIds: ['dark-horse-badge'], passportNftTokenId: '108', isUserSpawned: false,
    createdAt: Date.now() - DAY * 5, activeMarketIds: ['103', '106'], duelHistory: [], lpPositionUSD: 200, marketCreationCount: 0,
  },
]

const HISTORY_MARKETS = [
  ['101', 'Will BTC close above the Friday target?'],
  ['102', 'Will India win the next demo cricket match?'],
  ['103', 'Will a Monad app announce its testnet launch?'],
  ['104', 'Will Bengaluru complete the live chase?'],
  ['105', 'Will the home side win in regulation?'],
] as const

function seedHistory(agent: SeedAgent, agentIndex: number): AgentPredictionRecord[] {
  return HISTORY_MARKETS.map(([marketId, marketTitle], index) => {
    const correct = (agentIndex + index) % 4 !== 0
    const confidence = Number(Math.min(0.86, 0.57 + ((agentIndex * 5 + index * 7) % 24) / 100).toFixed(2))
    return {
      marketId,
      marketTitle,
      predictedOutcome: (agentIndex + index) % 2 === 0 ? 'YES' : 'NO',
      confidence,
      brierContribution: Number(Math.max(0.04, agent.brierScore + (index - 2) * 0.018).toFixed(3)),
      resolvedCorrectly: correct,
      timestamp: Date.now() - DAY * (5 - index),
      roundNumber: 18 + index,
      earningsFromThis: correct ? 6 + index * 2 : 0,
    }
  })
}

export function assignCohort(brierScore: number): AgentCohort {
  if (brierScore <= 0.12) return 'Legend'
  if (brierScore <= 0.18) return 'Elite'
  if (brierScore <= 0.26) return 'Pro'
  return 'Rookie'
}

export function computeReputation(agent: Pick<AgentPassport, 'brierScore' | 'calibrationScore' | 'totalPredictions' | 'lifetimeEarnings'>): number {
  const brierFactor = Math.max(0, 1 - agent.brierScore * 3)
  const activityFactor = Math.min(1, agent.totalPredictions / 50)
  const earningFactor = Math.min(1, agent.lifetimeEarnings / 500)
  return Math.round((brierFactor * 0.4 + agent.calibrationScore * 0.3 + activityFactor * 0.15 + earningFactor * 0.15) * 100)
}

function notifyRegistry() {
  registryVersion += 1
  registryListeners.forEach((listener) => listener())
}

function seedRegistry() {
  SEED_AGENTS.forEach((raw, index) => {
    const withHistory = { ...raw, brierHistory: seedHistory(raw, index) }
    registry.set(raw.id, {
      ...withHistory,
      cohort: assignCohort(raw.brierScore),
      reputationScore: computeReputation(withHistory),
    })
  })
}

seedRegistry()

export function getRegistryVersion(): number {
  return registryVersion
}

export function subscribeToAgentRegistry(listener: RegistryListener): () => void {
  registryListeners.add(listener)
  return () => registryListeners.delete(listener)
}

export function getAllAgents(): AgentPassport[] {
  return Array.from(registry.values()).sort((a, b) => a.brierScore - b.brierScore)
}

export function getAgent(id: string): AgentPassport | undefined {
  return registry.get(id)
}

export function registerAgent(agent: Omit<AgentPassport, 'cohort' | 'reputationScore'>): AgentPassport {
  const full: AgentPassport = { ...agent, cohort: assignCohort(agent.brierScore), reputationScore: computeReputation(agent) }
  registry.set(full.id, full)
  notifyRegistry()
  return full
}

export function updateAgent(id: string, patch: Partial<AgentPassport>): AgentPassport | null {
  const existing = registry.get(id)
  if (!existing) return null
  const merged = { ...existing, ...patch }
  const updated: AgentPassport = {
    ...merged,
    cohort: assignCohort(merged.brierScore),
    reputationScore: computeReputation(merged),
  }
  registry.set(id, updated)
  notifyRegistry()
  return updated
}

export function agentEarn(id: string, amount: number, reason: string): void {
  void reason
  const agent = registry.get(id)
  if (!agent) return
  updateAgent(id, { walletBalance: agent.walletBalance + amount, lifetimeEarnings: agent.lifetimeEarnings + amount })
}

export function agentStake(id: string, amount: number): boolean {
  const agent = registry.get(id)
  if (!agent || agent.walletBalance < amount) return false
  updateAgent(id, { walletBalance: agent.walletBalance - amount, stakedBalance: agent.stakedBalance + amount })
  return true
}

export function agentUnstake(id: string, amount: number): void {
  const agent = registry.get(id)
  if (!agent) return
  const unlocked = Math.min(amount, agent.stakedBalance)
  updateAgent(id, { walletBalance: agent.walletBalance + unlocked, stakedBalance: agent.stakedBalance - unlocked })
}

export function agentSlash(id: string, amount: number): void {
  const agent = registry.get(id)
  if (!agent) return
  updateAgent(id, { stakedBalance: Math.max(0, agent.stakedBalance - amount) })
}

export function recordPrediction(agentId: string, record: AgentPredictionRecord): void {
  const agent = registry.get(agentId)
  if (!agent) return
  const resolved = record.resolvedCorrectly !== null
  const nextTotal = agent.totalPredictions + 1
  const nextBrier = resolved
    ? (agent.brierScore * agent.totalPredictions + record.brierContribution) / nextTotal
    : agent.brierScore
  const won = record.resolvedCorrectly === true
  const lost = record.resolvedCorrectly === false
  updateAgent(agentId, {
    brierHistory: [...agent.brierHistory, record],
    brierScore: Number(nextBrier.toFixed(4)),
    totalPredictions: nextTotal,
    winCount: agent.winCount + (won ? 1 : 0),
    lossCount: agent.lossCount + (lost ? 1 : 0),
    currentStreak: won ? Math.max(1, agent.currentStreak + 1) : lost ? Math.min(-1, agent.currentStreak - 1) : agent.currentStreak,
  })
}

export function delegateTo(agentId: string, amount: number): boolean {
  const agent = registry.get(agentId)
  if (!agent || amount <= 0) return false
  const existing = delegations.get(agentId)
  delegations.set(agentId, {
    agentId,
    delegatedAmount: (existing?.delegatedAmount ?? 0) + amount,
    delegatedAt: existing?.delegatedAt ?? Date.now(),
    cumulativeReturn: existing?.cumulativeReturn ?? 0,
  })
  updateAgent(agentId, { delegatedCapital: agent.delegatedCapital + amount })
  return true
}

export function withdrawDelegation(agentId: string): DelegationRecord | null {
  const delegation = delegations.get(agentId)
  const agent = registry.get(agentId)
  if (!delegation || !agent) return null
  delegations.delete(agentId)
  updateAgent(agentId, { delegatedCapital: Math.max(0, agent.delegatedCapital - delegation.delegatedAmount) })
  return delegation
}

export function applyDelegationReturns(rate = 0.08): void {
  delegations.forEach((delegation, agentId) => {
    delegations.set(agentId, {
      ...delegation,
      cumulativeReturn: Number((delegation.cumulativeReturn + delegation.delegatedAmount * rate).toFixed(2)),
    })
  })
  notifyRegistry()
}

export function getDelegations(): DelegationRecord[] {
  return Array.from(delegations.values())
}

export function getDelegation(agentId: string): DelegationRecord | undefined {
  return delegations.get(agentId)
}

export function createDuel(duel: Omit<AgentDuel, 'id' | 'status' | 'winnerId' | 'createdAt' | 'resolvedAt'>): AgentDuel {
  const id = `duel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const full: AgentDuel = { ...duel, id, status: 'open', winnerId: null, createdAt: Date.now(), resolvedAt: null }
  duels.set(id, full)
  for (const agentId of [duel.challengerAgentId, duel.challengedAgentId]) {
    const agent = registry.get(agentId)
    if (agent) updateAgent(agentId, { duelHistory: [id, ...agent.duelHistory] })
  }
  notifyRegistry()
  return full
}

export function addSpectatorBet(duelId: string, amount: number): AgentDuel | null {
  const duel = duels.get(duelId)
  if (!duel || duel.status === 'resolved') return null
  const updated = { ...duel, spectatorPool: duel.spectatorPool + amount, status: 'active' as const }
  duels.set(duelId, updated)
  notifyRegistry()
  return updated
}

export function getAllDuels(): AgentDuel[] {
  return Array.from(duels.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export function resolveDuel(duelId: string, winnerId: string): void {
  const duel = duels.get(duelId)
  if (!duel || duel.status === 'resolved') return
  duels.set(duelId, { ...duel, status: 'resolved', winnerId, resolvedAt: Date.now() })
  const loserId = winnerId === duel.challengerAgentId ? duel.challengedAgentId : duel.challengerAgentId
  agentEarn(winnerId, duel.stakedAmountEach * 2 + duel.spectatorPool * 0.1, `Duel victory in ${duel.marketTitle}`)
  agentSlash(loserId, duel.stakedAmountEach)
  notifyRegistry()
}

function seedDuels() {
  const seeded: AgentDuel[] = [
    {
      id: 'duel-seed-macro-vs-contrarian', challengerAgentId: 'agent-alpha-macro', challengedAgentId: 'agent-contrarian-cx',
      marketId: '101', marketTitle: 'Will BTC close above the Friday target?', challengerSide: 'YES', stakedAmountEach: 25,
      spectatorPool: 65, status: 'active', winnerId: null, createdAt: Date.now() - 14 * 60_000, resolvedAt: null,
    },
    {
      id: 'duel-seed-monad-vs-quant', challengerAgentId: 'agent-monad-native', challengedAgentId: 'agent-quant-q7',
      marketId: '103', marketTitle: 'Will a Monad app announce its testnet launch?', challengerSide: 'YES', stakedAmountEach: 50,
      spectatorPool: 120, status: 'open', winnerId: null, createdAt: Date.now() - 34 * 60_000, resolvedAt: null,
    },
    {
      id: 'duel-seed-momentum-vs-vol', challengerAgentId: 'agent-momentum-mx', challengedAgentId: 'agent-vol-vortex',
      marketId: '104', marketTitle: 'Will Bengaluru complete the live chase?', challengerSide: 'NO', stakedAmountEach: 10,
      spectatorPool: 40, status: 'resolved', winnerId: 'agent-momentum-mx', createdAt: Date.now() - DAY, resolvedAt: Date.now() - DAY + 3_600_000,
    },
  ]
  seeded.forEach((duel) => duels.set(duel.id, duel))
  seeded.forEach((duel) => {
    for (const agentId of [duel.challengerAgentId, duel.challengedAgentId]) {
      const agent = registry.get(agentId)
      if (agent) registry.set(agentId, { ...agent, duelHistory: [duel.id, ...agent.duelHistory] })
    }
  })
}

seedDuels()
