import { Landmark } from 'lucide-react'
import { SectionHeader, Insight } from '../ui'
import { useApp } from '../../store/AppContext'

export function Pricing() {
  const { aiTier, setAiTier } = useApp()
  const tiers = [
    ['Free', '0 MON', '25 credits'],
    ['Pro', '1 test MON', '750 credits'],
    ['Creator', '2 test MON', '1,500 credits'],
    ['LP', '3 test MON', '2,000 credits'],
    ['Institutional', '8 test MON', '10,000 credits']
  ]
  
  return (
    <section className="surface-panel pricing-panel">
      <SectionHeader eyebrow="Testnet AI passes" title="Business model demo" icon={<Landmark size={20} />} />
      <div className="pricing-grid">
        {tiers.map(([name, price, credits]) => (
          <article className={`pricing-card ${aiTier === name ? 'is-active' : ''}`} key={name}>
            <span>{name}</span>
            <h3>{price}</h3>
            <b>{credits}</b>
            <p>On-chain pass preview for agent credits and premium dashboards.</p>
            <button className={aiTier === name ? 'ghost-button full' : 'primary-button full'} onClick={() => setAiTier(name)} type="button">
              {aiTier === name ? 'Selected' : 'Preview pass'}
            </button>
          </article>
        ))}
      </div>
      <div className="business-grid">
        <Insight title="Creator fee" value="70%" />
        <Insight title="Referral fee" value="15%" />
        <Insight title="Protocol fee" value="15%" />
      </div>
    </section>
  )
}
