import { Radio, TrendingDown, TrendingUp } from 'lucide-react'
import type { Market } from '../types'

function TickerItems({ markets }: { markets: Market[] }) {
  return (
    <>
      {markets.map((market) => {
        const trend = market.trend ?? 0
        return (
          <span className="ticker-item" key={market.id}>
            {market.isLive ? <Radio className="ticker-live-icon" size={13} /> : trend >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            <b>{market.league ?? market.category}</b>
            <em>{Math.round(market.yesProbability * 100)}c YES</em>
            <small className={trend >= 0 ? 'positive' : 'negative'}>{trend >= 0 ? '+' : ''}{trend.toFixed(1)}%</small>
          </span>
        )
      })}
    </>
  )
}

export function MarketTicker({ markets }: { markets: Market[] }) {
  const tickerMarkets = markets.filter((market) => market.featured || market.isLive || Math.abs(market.trend ?? 0) >= 5).slice(0, 7)
  return (
    <section aria-label="Live market pulse" className="market-ticker">
      <strong>Market pulse</strong>
      <div className="ticker-window">
        <div className="ticker-track">
          <TickerItems markets={tickerMarkets} />
          <TickerItems markets={tickerMarkets} />
        </div>
      </div>
    </section>
  )
}
