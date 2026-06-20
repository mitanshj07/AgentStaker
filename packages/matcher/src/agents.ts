import { getStructuredPrediction, getCustomStructuredPrediction, type AiPrediction } from './ai-adapter.js'

export type AgentForecast = {
  marketId: number
  question: string
  probability: number
  reasoning: string
  confidence: string
  keyFactors: string[]
  timestamp: number
  scored: boolean
  brierContribution?: number
}

export type AgentProfile = {
  id: string
  name: string
  avatar: string
  strategy: string
  description: string
  systemPrompt: string
  brierScore: number
  totalForecasts: number
  wins: number
  losses: number
  streak: number
  badge: string
  rank: number
  history: AgentForecast[]
}

const agents: AgentProfile[] = [
  {
    id: 'alpha-ensemble',
    name: 'Alpha Ensemble',
    avatar: '🧠',
    strategy: 'Conservative',
    description: 'Multi-model consensus approach focusing on low variance.',
    systemPrompt: 'You are a conservative ensemble forecaster. You weigh multiple perspectives and tend toward calibrated, moderate probabilities. You are skeptical of extreme positions. Your goal is to minimize Brier score over time by avoiding overconfidence.',
    brierScore: 0.084,
    totalForecasts: 142,
    wins: 91,
    losses: 51,
    streak: 3,
    badge: 'CALIBRATED',
    rank: 1,
    history: []
  },
  {
    id: 'sigma-prophet',
    name: 'Sigma Prophet',
    avatar: '📊',
    strategy: 'Bayesian',
    description: 'Base-rate driven Bayesian updating.',
    systemPrompt: 'You are a Bayesian forecaster. You start from base rates and update incrementally based on new evidence. You emphasize strict calibration and almost never go below 10% or above 90% unless the event is essentially deterministic.',
    brierScore: 0.112,
    totalForecasts: 118,
    wins: 72,
    losses: 46,
    streak: -1,
    badge: 'BASE_RATES',
    rank: 2,
    history: []
  },
  {
    id: 'quant-razor',
    name: 'Quant Razor',
    avatar: '⚡',
    strategy: 'Aggressive',
    description: 'Momentum and technical indicator focused.',
    systemPrompt: 'You are an aggressive quantitative forecaster. You focus heavily on momentum, volume trends, and technical patterns. You are willing to take stronger, more extreme positions when your indicators align. You accept higher variance for the chance at larger wins.',
    brierScore: 0.145,
    totalForecasts: 185,
    wins: 104,
    losses: 81,
    streak: 5,
    badge: 'MOMENTUM',
    rank: 3,
    history: []
  },
  {
    id: 'neural-edge',
    name: 'Neural Edge',
    avatar: '🔮',
    strategy: 'Contrarian',
    description: 'Narrative-driven contrarian seeking information asymmetries.',
    systemPrompt: 'You are a contrarian forecaster. You look for narratives the broader market has wrong, information asymmetries, and crowd psychology errors. You frequently disagree with consensus and look for mispriced long-shot probabilities.',
    brierScore: 0.158,
    totalForecasts: 94,
    wins: 41,
    losses: 53,
    streak: 1,
    badge: 'CONTRARIAN',
    rank: 4,
    history: []
  }
]

export function addAgent(agent: AgentProfile) {
  agents.push(agent)
}

export async function createAgentProfile(prompt: string): Promise<AgentProfile> {
  const schema = `{ "name": "string", "avatar": "emoji string", "strategy": "string (1-2 words)", "description": "string", "systemPrompt": "string (detailed persona instruction for forecasting)", "badge": "string (uppercase, 1 word)" }`
  const sys = 'You are an AI Architect. Generate a unique, highly specialized AI forecasting agent persona based on the user prompt.'
  
  const partialProfile = await getCustomStructuredPrediction(sys, prompt, schema, {
    name: 'Fallback Agent',
    avatar: '🤖',
    strategy: 'Generalist',
    description: 'A fallback agent generated due to AI quota limits.',
    systemPrompt: 'You are a generalist AI forecaster.',
    badge: 'FALLBACK'
  } as any)

  const newAgent: AgentProfile = {
    ...partialProfile,
    id: `agent-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    brierScore: 0.25, // default starting score
    totalForecasts: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    rank: agents.length + 1,
    history: []
  }

  addAgent(newAgent)
  return newAgent
}

export function getAgents(): AgentProfile[] {
  return [...agents].sort((a, b) => a.brierScore - b.brierScore)
}

export function getAgent(id: string): AgentProfile | undefined {
  return agents.find(a => a.id === id)
}

export function getLeaderboard(): AgentProfile[] {
  return getAgents().map(agent => ({
    ...agent,
    history: [] // omit history for payload size
  }))
}

export function getAgentHistory(agentId: string): AgentForecast[] {
  const agent = getAgent(agentId)
  return agent ? agent.history : []
}

export async function runAgentForecast(
  agentId: string, 
  marketId: number, 
  question: string, 
  marketContext: Record<string, unknown>
): Promise<AgentForecast> {
  const agent = getAgent(agentId)
  if (!agent) throw new Error(`Agent ${agentId} not found`)

  const contextStr = JSON.stringify({
    question,
    ...marketContext
  }, null, 2)

  const prediction = await getStructuredPrediction(agent.systemPrompt, contextStr)

  const forecast: AgentForecast = {
    marketId,
    question,
    probability: prediction.probabilityYes,
    reasoning: prediction.reasoning,
    confidence: prediction.confidence,
    keyFactors: prediction.keyFactors,
    timestamp: Date.now(),
    scored: false
  }

  agent.history.unshift(forecast)
  agent.totalForecasts++
  
  return forecast
}

export async function runTournamentRound(
  marketId: number, 
  question: string, 
  marketContext: Record<string, unknown>
): Promise<{ agents: Array<AgentForecast & { agentId: string; name: string }>; consensus: number }> {
  const promises = agents.map(async (agent) => {
    const forecast = await runAgentForecast(agent.id, marketId, question, marketContext)
    return {
      ...forecast,
      agentId: agent.id,
      name: agent.name
    }
  })

  const results = await Promise.all(promises)
  
  const consensus = results.reduce((sum, r) => sum + r.probability, 0) / results.length

  return {
    agents: results,
    consensus
  }
}

export function getConsensus(marketId: number) {
  const marketForecasts = agents
    .map(agent => {
      const forecast = agent.history.find(h => h.marketId === marketId)
      return forecast ? { id: agent.id, name: agent.name, probability: forecast.probability } : null
    })
    .filter((f): f is { id: string; name: string; probability: number } => f !== null)

  if (marketForecasts.length === 0) return null

  const probs = marketForecasts.map(f => f.probability)
  const consensus = probs.reduce((sum, p) => sum + p, 0) / probs.length
  const max = Math.max(...probs)
  const min = Math.min(...probs)

  return {
    marketId,
    consensus,
    spread: max - min,
    agents: marketForecasts
  }
}
