export interface AgentEvent {
  id: string
  agentId: string
  agentName: string
  type:
    | 'forecast'
    | 'win'
    | 'loss'
    | 'promoted'
    | 'relegated'
    | 'duel-challenge'
    | 'duel-win'
    | 'earned'
    | 'staked'
    | 'market-created'
  message: string
  timestamp: number
}

type Listener = (event: AgentEvent) => void

const listeners = new Set<Listener>()
const eventLog: AgentEvent[] = []
const MAX_LOG = 50

export function emitAgentEvent(event: Omit<AgentEvent, 'id' | 'timestamp'>): void {
  const full: AgentEvent = {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  }
  eventLog.unshift(full)
  if (eventLog.length > MAX_LOG) eventLog.pop()
  listeners.forEach((listener) => listener(full))
}

export function subscribeToAgentEvents(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getRecentEvents(count = 10): AgentEvent[] {
  return eventLog.slice(0, count)
}

