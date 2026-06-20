import { Star } from 'lucide-react'
import type { AgentCohort } from '../state/agentRegistry'

export function CohortBadge({ cohort }: { cohort: AgentCohort }) {
  return (
    <span className={`cohort-badge cohort-${cohort.toLowerCase()}`}>
      {cohort === 'Legend' && <Star aria-hidden="true" size={11} />}
      {cohort}
    </span>
  )
}

