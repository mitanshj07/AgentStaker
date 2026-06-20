import { Bookmark, Check, Flame, Search, Trophy } from 'lucide-react'
import type { Market } from '../types'

export type JourneyStep = {
  label: string
  detail: string
  done: boolean
}

export function DiscoveryBar({ activeCategory, categories, marketCount, setActiveCategory, watchedCount }: {
  activeCategory: string
  categories: string[]
  marketCount: number
  setActiveCategory: (category: string) => void
  watchedCount: number
}) {
  return (
    <section className="discovery-bar">
      <div className="discovery-title"><Flame size={17} /><b>Explore markets</b></div>
      <div className="category-chips">
        {categories.map((category) => <button className={activeCategory === category ? 'active' : ''} key={category} onClick={() => setActiveCategory(category)} type="button">{category}</button>)}
      </div>
      <span className="market-count">{marketCount} active</span>
      <span className="watch-count"><Bookmark size={15} />{watchedCount} watched</span>
    </section>
  )
}

export function JourneyStrip({ steps }: { steps: JourneyStep[] }) {
  return (
    <section className="journey-strip" aria-label="Demo journey progress">
      <div className="journey-heading"><Trophy size={17} /><b>Your ArenaX journey</b></div>
      <div className="journey-steps">
        {steps.map((step, index) => <div className={`journey-step ${step.done ? 'done' : ''}`} key={step.label}><span>{step.done ? <Check size={14} /> : index + 1}</span><div><b>{step.label}</b><small>{step.detail}</small></div></div>)}
      </div>
    </section>
  )
}

export function WatchlistRail({ markets, openMarket, toggleWatchlist }: { markets: Market[]; openMarket: (marketId: number) => void; toggleWatchlist: (marketId: number) => void }) {
  return (
    <div className="watchlist-stack">
      {markets.length === 0 && <p className="empty-state">Save a market to track its odds here.</p>}
      {markets.map((market) => <div className="watchlist-item" key={market.id}><button onClick={() => openMarket(market.id)} type="button"><Search size={15} /><span><b>#{market.id} {market.category}</b><small>{Math.round(market.yesProbability * 100)}% YES</small></span></button><button aria-label={`Remove ${market.question} from watchlist`} onClick={() => toggleWatchlist(market.id)} title="Remove from watchlist" type="button"><Bookmark size={15} /></button></div>)}
    </div>
  )
}
