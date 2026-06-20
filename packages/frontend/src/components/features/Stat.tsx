import type { ReactNode } from 'react'

export function Stat({ icon, label, tone, value }: { icon: ReactNode; label: string; tone: string; value: string }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      {icon}
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}
