import { Gauge, Shield } from 'lucide-react'
import { SectionHeader } from '../ui'
import { useApp } from '../../store/AppContext'
import { formatMON } from '../../lib/format'

export function Limits() {
  const {
    cooldown,
    dailyLimit,
    limitRemaining,
    pointsOnly,
    selfExcluded,
    setCooldown,
    setDailyLimit,
    setPointsOnly,
    setSelfExcluded,
    spentToday,
  } = useApp()

  return (
    <div className="two-column">
      <section className="surface-panel">
        <SectionHeader eyebrow="Responsible limits" title="Guardrails" icon={<Shield size={20} />} />
        <label className="stake-control">
          <span>Daily testnet limit</span>
          <input min="1" max="20" type="range" value={dailyLimit} onChange={(event) => setDailyLimit(Number(event.target.value))} />
          <b>{formatMON(dailyLimit)}</b>
        </label>
        <label className="toggle-row">
          <input checked={pointsOnly} onChange={(event) => setPointsOnly(event.target.checked)} type="checkbox" />
          Points-only mode
        </label>
        <label className="toggle-row">
          <input checked={cooldown} onChange={(event) => setCooldown(event.target.checked)} type="checkbox" />
          Cooldown
        </label>
        <label className="toggle-row">
          <input checked={selfExcluded} onChange={(event) => setSelfExcluded(event.target.checked)} type="checkbox" />
          Self-exclusion
        </label>
      </section>
      <section className="surface-panel pastel-checker">
        <SectionHeader eyebrow="Usage" title={formatMON(limitRemaining)} icon={<Gauge size={20} />} />
        <p className="large-copy">{formatMON(spentToday)} used today from a {formatMON(dailyLimit)} cap.</p>
        <p className="fine-print">Test MON has no monetary value. AI forecasts are educational and uncertain.</p>
      </section>
    </div>
  )
}
