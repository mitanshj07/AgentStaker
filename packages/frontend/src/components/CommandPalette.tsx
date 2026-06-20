import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Market, View } from '../types'

type PaletteView = {
  id: View
  label: string
  icon: ReactNode
}

export function CommandPalette({ close, markets, openMarket, openView, query, setQuery, views }: {
  close: () => void
  markets: Market[]
  openMarket: (marketId: number) => void
  openView: (view: View) => void
  query: string
  setQuery: (query: string) => void
  views: PaletteView[]
}) {
  const normalizedQuery = query.trim().toLowerCase()
  const visibleViews = views.filter((item) => `${item.label} ${item.id}`.toLowerCase().includes(normalizedQuery))
  const visibleMarkets = markets.filter((market) =>
    `${market.question} ${market.category} ${market.tags.join(' ')}`.toLowerCase().includes(normalizedQuery),
  )

  return (
    <div className="palette-backdrop" onMouseDown={close} role="presentation">
      <section aria-label="Arena quick navigation" aria-modal="true" className="command-palette" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <div className="palette-search">
          <Search size={18} />
          <input autoFocus onChange={(event) => setQuery(event.target.value)} placeholder="Find views or live markets" value={query} />
          <button aria-label="Close command palette" className="soft-icon-button" onClick={close} title="Close" type="button"><X size={17} /></button>
        </div>
        <div className="palette-results">
          {visibleViews.length > 0 && <div className="palette-group"><span>Workspace</span>{visibleViews.map((item) => <button key={item.id} onClick={() => openView(item.id)} type="button">{item.icon}<b>{item.label}</b><small>Open dashboard</small></button>)}</div>}
          {visibleMarkets.length > 0 && <div className="palette-group"><span>Live markets</span>{visibleMarkets.map((market) => <button key={market.id} onClick={() => openMarket(market.id)} type="button"><Search size={17} /><b>#{market.id} {market.category}</b><small>{market.question}</small></button>)}</div>}
          {visibleViews.length === 0 && visibleMarkets.length === 0 && <p className="empty-state">No matching view or market.</p>}
        </div>
      </section>
    </div>
  )
}
