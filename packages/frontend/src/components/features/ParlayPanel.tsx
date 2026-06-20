import { Trophy, X } from 'lucide-react'
import { Rail } from '../ui'
import { useApp } from '../../store/AppContext'

export function ParlayPanel() {
  const { canMintParlay, combinedOdds, contractRuntime, impliedProbability, mintParlay, parlayBlockReason, parlayLegs, setParlayLegs, wallet } = useApp()
  const readyToSign = canMintParlay && wallet.connected

  return (
    <Rail title="Parlay NFT" icon={<Trophy size={20} />}>
      <div className="parlay-live-strip" aria-label="Parlay testnet readiness">
        <span>AXPARLAY</span>
        <b>{contractRuntime.configured >= 18 ? 'Deployed' : 'Config needed'}</b>
        <span>AXSLIP</span>
        <b>{readyToSign ? 'Ready to mint' : 'Preflight'}</b>
      </div>
      <div className="leg-stack">
        {parlayLegs.length === 0 && <p className="empty-state">No legs selected.</p>}
        {parlayLegs.map((leg) => (
          <div className="leg-item" key={leg.marketId}>
            <span>{leg.outcome} @ {leg.odds.toFixed(2)}x</span>
            <button aria-label="Remove leg" onClick={() => setParlayLegs((current) => current.filter((item) => item.marketId !== leg.marketId))} type="button">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
      <div className="parlay-summary">
        <span>Combined odds</span>
        <b>{combinedOdds.toFixed(2)}x</b>
        <span>Implied probability</span>
        <b>{Math.round(impliedProbability * 100)}%</b>
      </div>
      <button className="primary-button full" disabled={!canMintParlay} onClick={mintParlay} type="button">
        {readyToSign ? 'Sign & mint parlay NFT' : 'Mint parlay NFT'}
      </button>
      {parlayBlockReason && <p className="warning-line">{parlayBlockReason}</p>}
    </Rail>
  )
}
