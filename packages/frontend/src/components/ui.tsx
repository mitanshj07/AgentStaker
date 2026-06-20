import type { ReactNode } from 'react'
import type { TxStep } from '../types'

export function SectionHeader({ eyebrow, icon, title }: { eyebrow: string; icon: ReactNode; title: string }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{icon}</div>
}

export function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return <div className="metric">{icon}<span>{label}</span><b>{value}</b></div>
}

export function Insight({ title, value }: { title: string; value: string }) {
  return <article className="insight-card"><span>{title}</span><b>{value}</b><p>Displayed for hackathon economics only.</p></article>
}

export function Timeline({ steps }: { steps: TxStep[] }) {
  return <div className="tx-timeline">{steps.map((step) => <span className={`tx-step tx-${step.state}`} key={step.label}>{step.label}</span>)}</div>
}

export function Rail({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return <section className="rail-card"><SectionHeader eyebrow="Live ops" title={title} icon={icon} />{children}</section>
}
