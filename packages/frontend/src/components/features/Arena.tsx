import { Bookmark, BookmarkCheck, Brain, Clock3, Coins, Flame, Gauge, LineChart, Lock, Plus, Radio, Search, TrendingDown, TrendingUp, Zap } from 'lucide-react'
import { SectionHeader, Metric } from '../ui'
import { useApp, odds } from '../../store/AppContext'
import { formatMON } from '../../lib/format'
import type { Market, MarketFeedMode, Outcome } from '../../types'

const feedModes: MarketFeedMode[] = ['Trending', 'Live', 'Closing soon', 'New']
const stakePresets = [0.5, 1, 2, 5]

function compactMON(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}K` : value.toFixed(0)
}

function formatUsd(value?: number, compact = false) {
  if (value === undefined || !Number.isFinite(value)) return 'Unavailable'
  if (compact && Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (compact && Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (Math.abs(value) >= 1000) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
  if (Math.abs(value) >= 1) return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 5 })}`
}

function formatTimestamp(value?: string) {
  if (!value) return 'Waiting for feed'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waiting for feed'
  return date.toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })
}

function highLowSourceLabel(source?: Market['cryptoHighLowSource']) {
  if (source === 'CMC_OHLCV') return 'CMC OHLCV'
  if (source === 'PLAN_GATED') return 'Plan gated'
  return 'Quote only'
}

function Trend({ trend = 0 }: { trend?: number }) {
  const positive = trend >= 0
  return <span className={`market-trend ${positive ? 'positive' : 'negative'}`}>{positive ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{positive ? '+' : ''}{trend.toFixed(1)}%</span>
}

function MarketCard({ market, quickPick, selected, selectMarket }: {
  market: Market
  quickPick: (marketId: number, pick: Outcome) => void
  selected: boolean
  selectMarket: () => void
}) {
  return (
    <article className={`market-card ${selected ? 'is-active' : ''}`}>
      <div className="card-meta">
        <span className="league-label">{market.league ?? market.category}</span>
        <span className="market-card-flags">
          {market.isLive && <b className="live-badge"><Radio size={12} />LIVE</b>}
          {market.boosted && <b className="boost-badge"><Zap size={12} />BOOST</b>}
          <Trend trend={market.trend} />
        </span>
      </div>
      <button className="market-question" onClick={selectMarket} type="button">
        <strong>{market.question}</strong>
        <small>
          <Clock3 size={13} />{market.lockLabel}
          <span>{market.eventLabel}</span>
          {market.cryptoPriceUsd && <span>{market.cryptoSymbol} {formatUsd(market.cryptoPriceUsd)}</span>}
          <span>{compactMON(market.volume)} MON vol.</span>
        </small>
      </button>
      <div className="compact-odds-grid">
        <button aria-label={`Load YES quick pick for market ${market.id}`} onClick={() => quickPick(market.id, 'YES')} type="button"><span>YES</span><b>{Math.round(market.yesProbability * 100)}c</b></button>
        <button aria-label={`Load NO quick pick for market ${market.id}`} onClick={() => quickPick(market.id, 'NO')} type="button"><span>NO</span><b>{Math.round((1 - market.yesProbability) * 100)}c</b></button>
      </div>
    </article>
  )
}

function OutcomeButton({ active, label, onClick, probability }: { active: boolean; label: Outcome; onClick: () => void; probability: number }) {
  return (
    <button className={`outcome-button ${active ? 'is-active' : ''}`} onClick={onClick} type="button">
      <span>{label}</span>
      <b>{Math.round(probability * 100)}%</b>
      <small>{odds(probability).toFixed(2)}x</small>
    </button>
  )
}

export function Arena() {
  const {
    addLeg,
    buyOutcome,
    canTrade,
    filteredMarkets,
    marketFeedMode,
    outcome,
    projectedShares,
    quickPick,
    search,
    selectedId,
    selectedMarket,
    selectedOdds,
    setMarketFeedMode,
    setOutcome,
    setSearch,
    setSelectedId,
    setStake,
    stake,
    toggleWatchlist,
    tradeBlockReason,
    watchlist,
  } = useApp()

  return (
    <div className="arena-grid">
      <section className="market-feed">
        <SectionHeader eyebrow="Sportsbook pulse" title="Testnet market board" icon={<Flame size={20} />} />
        <label className="search-box">
          <Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search markets, leagues, oracles" />
        </label>
        <div className="feed-mode-tabs" aria-label="Market pulse filters">
          {feedModes.map((mode) => <button className={marketFeedMode === mode ? 'active' : ''} key={mode} onClick={() => setMarketFeedMode(mode)} type="button">{mode}</button>)}
        </div>
        <div className="market-list">
          {filteredMarkets.length === 0 && <p className="market-empty">No markets match this pulse. Try another category or filter.</p>}
          {filteredMarkets.map((market) => (
            <MarketCard key={market.id} market={market} quickPick={quickPick} selected={market.id === selectedId} selectMarket={() => setSelectedId(market.id)} />
          ))}
        </div>
      </section>
      <section className="market-detail">
        <div className="detail-header">
          <div>
            <p className="eyebrow">{selectedMarket.league ?? selectedMarket.category} · {selectedMarket.eventLabel ?? 'Prediction market'}</p>
            <h2>{selectedMarket.question}</h2>
            <div className="detail-tape">
              {selectedMarket.isLive && <span className="live-badge"><Radio size={12} />LIVE</span>}
              {selectedMarket.boosted && <span className="boost-badge"><Zap size={12} />BOOSTED</span>}
              <Trend trend={selectedMarket.trend} />
              <span>{compactMON(selectedMarket.volume)} MON volume</span>
              <span>{selectedMarket.source}</span>
            </div>
          </div>
          <div className="detail-actions">
            <span className="state-badge">{selectedMarket.state}</span>
            <button
              aria-label={`${watchlist.includes(selectedMarket.id) ? 'Remove' : 'Add'} market ${selectedMarket.id} ${watchlist.includes(selectedMarket.id) ? 'from' : 'to'} watchlist`}
              className={`soft-icon-button ${watchlist.includes(selectedMarket.id) ? 'is-watched' : ''}`}
              onClick={() => toggleWatchlist(selectedMarket.id)}
              title={watchlist.includes(selectedMarket.id) ? 'Remove from watchlist' : 'Add to watchlist'}
              type="button"
            >
              {watchlist.includes(selectedMarket.id) ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
            </button>
          </div>
        </div>
        <div className="metric-grid">
          <Metric icon={<Lock size={18} />} label="Lock" value={selectedMarket.lockLabel} />
          <Metric icon={<Gauge size={18} />} label="Liquidity" value={formatMON(selectedMarket.liquidity)} />
          <Metric icon={<Brain size={18} />} label="AI quality" value={`${selectedMarket.qualityScore}/100`} />
          <Metric icon={<LineChart size={18} />} label="AI forecast" value={`${Math.round(selectedMarket.aiProbability * 100)}%`} />
        </div>
        {selectedMarket.cryptoSymbol && (
          <section className="crypto-live-panel" aria-label={`${selectedMarket.cryptoSymbol} live CoinMarketCap data`}>
            <div className="crypto-live-head">
              <span><Coins size={15} />{selectedMarket.cryptoSymbol} live market data</span>
              <b>{highLowSourceLabel(selectedMarket.cryptoHighLowSource)}</b>
            </div>
            <div className="crypto-metric-grid">
              <Metric icon={<LineChart size={18} />} label="CMC price" value={formatUsd(selectedMarket.cryptoPriceUsd)} />
              <Metric icon={<TrendingUp size={18} />} label="UTC high" value={formatUsd(selectedMarket.cryptoDayHighUsd)} />
              <Metric icon={<TrendingDown size={18} />} label="UTC low" value={formatUsd(selectedMarket.cryptoDayLowUsd)} />
              <Metric icon={<Coins size={18} />} label="24h volume" value={formatUsd(selectedMarket.cryptoVolume24hUsd, true)} />
              <Metric icon={<Gauge size={18} />} label="Market cap" value={formatUsd(selectedMarket.cryptoMarketCapUsd, true)} />
              <Metric icon={<Clock3 size={18} />} label="Updated" value={formatTimestamp(selectedMarket.cryptoQuoteUpdatedAt)} />
            </div>
            <p>
              {selectedMarket.cryptoRationale}
              {selectedMarket.cryptoNextRefreshAt ? ` Next quota-safe refresh: ${formatTimestamp(selectedMarket.cryptoNextRefreshAt)}.` : ''}
            </p>
          </section>
        )}
        <div className="odds-board">
          <OutcomeButton label="YES" active={outcome === 'YES'} probability={selectedMarket.yesProbability} onClick={() => setOutcome('YES')} />
          <OutcomeButton label="NO" active={outcome === 'NO'} probability={1 - selectedMarket.yesProbability} onClick={() => setOutcome('NO')} />
        </div>
        <div className="trade-surface">
          <div>
            <p className="eyebrow">Testnet ticket</p>
            <h3>{outcome} · {selectedOdds.toFixed(2)}x odds</h3>
            <p>{formatMON(stake)} returns about {projectedShares} shares before demo fees.</p>
          </div>
          <label className="stake-control">
            <span>Stake</span>
            <input min="0.1" max="10" step="0.1" type="range" value={stake} onChange={(event) => setStake(Number(event.target.value))} />
            <b>{formatMON(stake)}</b>
          </label>
          <div className="stake-presets" aria-label="Stake presets">
            {stakePresets.map((preset) => <button className={stake === preset ? 'active' : ''} key={preset} onClick={() => setStake(preset)} type="button">{preset} MON</button>)}
          </div>
          <div className="ticket-receipt">
            <span>Potential payout</span><b>{formatMON(projectedShares)}</b>
            <span>Settlement</span><b>Monad testnet</b>
          </div>
          <div className="button-row">
            <button className="primary-button" disabled={!canTrade} onClick={buyOutcome} type="button">
              <Coins size={18} />Buy {outcome}
            </button>
            <button className="secondary-button" onClick={addLeg} type="button">
              <Plus size={18} />Add to parlay
            </button>
          </div>
          {!canTrade && <p className="warning-line">{tradeBlockReason ?? 'Blocked by testnet responsible limits.'}</p>}
        </div>
        <div className="activity-list">
          {selectedMarket.trades.map((trade, index) => <span key={`${selectedMarket.id}-${index}-${trade}`}>{trade}</span>)}
        </div>
      </section>
    </div>
  )
}
