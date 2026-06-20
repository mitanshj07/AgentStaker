import { lazy, Suspense, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import {
  Activity,
  BadgeCheck,
  Bookmark,
  Bot,
  Brain,
  CheckCircle2,
  CircleDollarSign,
  Coins,
  Database,
  Gavel,
  Gauge,
  Landmark,
  LineChart,
  Menu,
  Search,
  Shield,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  ReceiptText,
  WandSparkles,
  Wallet,
  Badge,
  Swords,
  Trophy,
  UserRound,
  Video,
  X,
  Network,
} from 'lucide-react'
import './App.css'
import { CommandPalette } from './components/CommandPalette'
import { BlitzControl } from './components/BlitzControl'
import { DiscoveryBar, JourneyStrip, WatchlistRail, type JourneyStep } from './components/ProductDiscovery'
import { MarketTicker } from './components/MarketTicker'
import { MonadSplash } from './components/MonadSplash'
import { Rail } from './components/ui'
import { MONAD_TESTNET, REAL_MONEY_ENABLED } from './lib/monad'
import { formatMON } from './lib/format'
import type { View } from './types'
import { AppProvider, useApp, shortAddress } from './store/AppContext'
import { DemoRunbook } from './components/features/DemoRunbook'
import { Arena } from './components/features/Arena'
import { Governor } from './components/features/Governor'
import { MonadPanel } from './components/features/MonadPanel'
import { Pricing } from './components/features/Pricing'
import { Limits } from './components/features/Limits'
import { ParlayPanel } from './components/features/ParlayPanel'
import { Stat } from './components/features/Stat'
import { getAllAgents, getRegistryVersion, subscribeToAgentRegistry } from './state/agentRegistry'

const AgentArenaPage = lazy(() => import('./pages/AgentArenaPage'))
const AgentStudio = lazy(() => import('./features/advanced').then((module) => ({ default: module.AgentStudio })))
const CreatorStudio = lazy(() => import('./features/advanced').then((module) => ({ default: module.CreatorStudio })))
const Exchange = lazy(() => import('./features/advanced').then((module) => ({ default: module.Exchange })))
const Liquidity = lazy(() => import('./features/advanced').then((module) => ({ default: module.Liquidity })))
const Oracle = lazy(() => import('./features/advanced').then((module) => ({ default: module.Oracle })))
const Portfolio = lazy(() => import('./features/advanced').then((module) => ({ default: module.Portfolio })))
const CopyTrading = lazy(() => import('./features/advanced').then((module) => ({ default: module.CopyTrading })))
const Slips = lazy(() => import('./features/consumer').then((module) => ({ default: module.Slips })))
const SocialMarkets = lazy(() => import('./features/consumer').then((module) => ({ default: module.SocialMarkets })))
const Battles = lazy(() => import('./features/consumer').then((module) => ({ default: module.Battles })))
const Fantasy = lazy(() => import('./features/consumer').then((module) => ({ default: module.Fantasy })))
const Profile = lazy(() => import('./features/consumer').then((module) => ({ default: module.Profile })))

const navItems: Array<{ id: View; label: string; icon: ReactNode }> = [
  { id: 'agents', label: 'Agent Arena', icon: <Bot size={18} /> },
  { id: 'copy', label: 'Copy Trading', icon: <Network size={18} /> },
  { id: 'demo', label: 'Discover', icon: <BadgeCheck size={18} /> },
  { id: 'arena', label: 'Arena', icon: <LineChart size={18} /> },
  { id: 'exchange', label: 'Pro Exchange', icon: <SlidersHorizontal size={18} /> },
  { id: 'portfolio', label: 'Portfolio', icon: <ReceiptText size={18} /> },
  { id: 'oracle', label: 'Oracle Court', icon: <Gavel size={18} /> },
  { id: 'liquidity', label: 'LP', icon: <CircleDollarSign size={18} /> },
  { id: 'creator', label: 'Creator', icon: <WandSparkles size={18} /> },
  { id: 'governor', label: 'Risk', icon: <ShieldAlert size={18} /> },
  { id: 'pricing', label: 'Pricing', icon: <Landmark size={18} /> },
  { id: 'monad', label: 'Monad Testnet', icon: <Sparkles size={18} /> },
  { id: 'slips', label: 'My Slips', icon: <Badge size={18} /> },
  { id: 'social', label: 'Social', icon: <Video size={18} /> },
  { id: 'battle', label: 'Battles', icon: <Swords size={18} /> },
  { id: 'dfs', label: 'DFS', icon: <Trophy size={18} /> },
  { id: 'limits', label: 'Limits', icon: <Shield size={18} /> },
  { id: 'profile', label: 'Profile', icon: <UserRound size={18} /> },
  { id: 'agent-studio', label: 'Legacy Agent Studio', icon: <WandSparkles size={18} /> },
]

const primaryNavItems = navItems.slice(0, 11)

const navSections = [
  { title: 'Agent economy', ids: ['agents', 'copy', 'agent-studio', 'portfolio'] as View[] },
  { title: 'Explore markets', ids: ['demo', 'arena', 'slips', 'social', 'battle', 'dfs'] as View[] },
  { title: 'Trade and settle', ids: ['exchange', 'oracle', 'governor', 'monad'] as View[] },
  { title: 'Build and manage', ids: ['liquidity', 'creator', 'pricing', 'limits', 'profile'] as View[] },
]

function AppLayout() {
  const store = useApp()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [tournamentRunning, setTournamentRunning] = useState(false)
  useSyncExternalStore(subscribeToAgentRegistry, getRegistryVersion, getRegistryVersion)
  const economyAgents = getAllAgents()
  const economyStaked = economyAgents.reduce((sum, agent) => sum + agent.stakedBalance, 0)
  const resolvedMarket = store.markets.some((market) => market.state === 'RESOLVED')
  const claimedPosition = store.positions.some((position) => position.status === 'CLAIMED')
  const journeySteps: JourneyStep[] = [
    { label: 'Discover', detail: `#${store.selectedMarket.id} selected`, done: true },
    { label: 'Trade', detail: store.positions.length ? `${store.positions.length} position${store.positions.length === 1 ? '' : 's'}` : 'Buy YES or NO', done: store.positions.length > 0 },
    { label: 'Parlay', detail: store.parlays.length ? `${store.parlays.length} NFT minted` : 'Add two legs', done: store.parlays.length > 0 },
    { label: 'Resolve', detail: resolvedMarket ? 'Oracle finalized' : 'Use Oracle Court', done: resolvedMarket },
    { label: 'Claim', detail: claimedPosition ? 'Payout claimed' : 'Claim winnings', done: claimedPosition },
  ]

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setNavigationOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function openNavigationView(nextView: View) {
    store.setView(nextView)
    setNavigationOpen(false)
  }
  
  const content = {
    demo: <DemoRunbook />,
    arena: <Arena />,
    slips: <Slips />,
    social: <SocialMarkets />,
    battle: <Battles />,
    dfs: <Fantasy />,
    exchange: (
      <Exchange
        cancelOrder={store.cancelOrder}
        limitPrice={store.limitPrice}
        orderType={store.orderType}
        orders={store.orders}
        outcome={store.outcome}
        placeOrder={store.placeOrder}
        previewSmartRoute={store.previewSmartRoute}
        routeQuote={store.routeQuote}
        selectedMarket={store.selectedMarket}
        setLimitPrice={store.setLimitPrice}
        setOrderType={store.setOrderType}
        stake={store.stake}
        txTimeline={store.txTimeline}
      />
    ),
    governor: <Governor />,
    monad: <MonadPanel />,
    portfolio: (
      <Portfolio
        cashoutAdvice={store.cashoutAdvice}
        cashoutParlay={store.cashoutParlay}
        claimAllPositions={store.claimAllPositions}
        claimParlay={store.claimParlay}
        claimable={store.claimable}
        hedgeAdvice={store.hedgeAdvice}
        markets={store.markets}
        openAgents={() => store.setView('agents')}
        parlays={store.parlays}
        positions={store.positions}
        proposeHedge={store.proposeHedge}
        quoteParlayCashout={store.quoteParlayCashout}
        settleParlay={store.settleParlay}
      />
    ),
    oracle: (
      <Oracle
        advanceOracleCase={store.advanceOracleCase}
        markets={store.markets}
        oracleCases={store.oracleCases}
      />
    ),
    agents: <AgentArenaPage markets={store.markets} onTournamentStateChange={setTournamentRunning} runLegacyTournament={store.runForecastTournament} />,
    copy: <CopyTrading />,
    'agent-studio': <AgentStudio />,
    liquidity: (
      <Liquidity
        depositLpVault={store.depositLpVault}
        executeLpRebalance={store.executeLpRebalance}
        markets={store.markets}
        processLpWithdrawal={store.processLpWithdrawal}
        protocolLiquidity={store.protocolLiquidity}
        rebalanceAdvice={store.rebalanceAdvice}
        requestLpWithdrawal={store.requestLpWithdrawal}
        runLpRebalance={store.runLpRebalance}
        selectedMarket={store.selectedMarket}
        stake={store.stake}
        vaultState={store.vaultState}
      />
    ),
    creator: (
      <CreatorStudio
        createCreatorMarket={store.createCreatorMarket}
        creatorQuality={store.creatorQuality}
        creatorQuestion={store.creatorQuestion}
        creatorRevenueMON={store.creatorRevenueMON}
        latestCreatorMarket={store.latestCreatorMarket}
        reviewCreatorMarket={store.reviewCreatorMarket}
        seedCreatorPool={store.seedCreatorPool}
        setCreatorQuestion={store.setCreatorQuestion}
      />
    ),
    pricing: <Pricing />,
    limits: <Limits />,
    profile: <Profile />,
  }[store.view]

  return (
    <main className="app-shell">
      <div aria-hidden="true" className="ambient-backdrop"><span /><span /><span /><span /></div>
      <MonadSplash />
      <header className="topbar">
        <div className="brand-lockup">
          <div aria-hidden="true" className="brand-pulse">
            <span />
            <span />
            <span />
            <i />
          </div>
          <div className="brand-copy">
            <p className="brand-kicker"><i /> Monad testnet <span>Agent Ecosystem</span></p>
            <div className="brand-title-row">
              <h1>Monad <b>ArenaX</b></h1>
              <span className="brand-chip">Testnet live</span>
            </div>
          </div>
        </div>
        <div className="top-actions">
          <div className="agent-economy-inline"><Bot size={15} /><span>{economyAgents.length} agents</span><i /> <span>{economyStaked.toFixed(0)} MON staked</span></div>
          <button aria-controls="all-sections-menu" aria-expanded={navigationOpen} aria-label="Open all sections menu" className="soft-icon-button" onClick={() => setNavigationOpen(true)} title="All sections" type="button">
            <Menu size={18} />
          </button>
          <button aria-label="Open command palette" className="soft-icon-button" onClick={() => store.setPaletteOpen(true)} title="Open quick navigation" type="button">
            <Search size={17} />
          </button>
          <button
            className={`wallet-pill ${store.wallet.connected ? 'connected' : store.wallet.error ? 'warning' : ''}`}
            onClick={store.connectMonadWallet}
            title={store.wallet.connected ? 'Refresh Monad wallet connection' : 'Connect Monad testnet wallet'}
            type="button"
          >
            <Wallet size={16} />
            {store.wallet.connected && store.wallet.address ? shortAddress(store.wallet.address) : store.wallet.address ? 'Switch Monad' : 'Connect wallet'}
          </button>
          <div className="network-pill">
            <CheckCircle2 size={16} />
            {store.monadStatus ? `Block ${store.monadStatus.blockNumber.toString()}` : 'Syncing Monad'}
          </div>
          <div className={`indexer-pill ${store.indexedStatus.mode === 'INDEXED' ? 'live' : ''}`} title={store.indexedStatus.message}>
            <Database size={15} />
            {store.indexedStatus.mode === 'INDEXED' ? 'Ponder live' : store.indexedStatus.mode === 'SYNCING' ? 'Indexing...' : 'Read fallback'}
          </div>
          <div className={`indexer-pill ${store.cryptoStatus.mode === 'LIVE_API' ? 'live' : ''}`} title={store.cryptoStatus.message}>
            <Coins size={15} />
            {store.cryptoStatus.mode === 'LIVE_API' ? 'CMC live' : store.cryptoStatus.mode === 'CACHE' ? 'CMC cache' : store.cryptoStatus.mode === 'DISABLED' ? 'CMC off' : 'CMC fallback'}
          </div>
        </div>
      </header>

      {navigationOpen && (
        <div className="nav-menu-backdrop" onClick={() => setNavigationOpen(false)} role="presentation">
          <section aria-label="All ArenaX sections" className="all-sections-menu" id="all-sections-menu" onClick={(event) => event.stopPropagation()}>
            <div className="all-sections-header">
              <div>
                <p className="eyebrow">Monad ArenaX</p>
                <h2>All sections</h2>
              </div>
              <button aria-label="Close all sections menu" className="soft-icon-button" onClick={() => setNavigationOpen(false)} title="Close menu" type="button"><X size={18} /></button>
            </div>
            <div className="all-sections-groups">
              {navSections.map((section) => (
                <div className="all-sections-group" key={section.title}>
                  <span>{section.title}</span>
                  <div>
                    {section.ids.map((id) => {
                      const item = navItems.find((candidate) => candidate.id === id)
                      if (!item) return null
                      return <button className={store.view === item.id ? 'active' : ''} key={item.id} onClick={() => openNavigationView(item.id)} type="button">{item.icon}<b>{item.label}</b></button>
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <section className="hackathon-banner">
        <ShieldAlert size={18} />
        <span>{REAL_MONEY_ENABLED ? 'Configuration warning: disable real-money mode before judging.' : 'Testnet-only mode is enforced. Test MON has no monetary value. No guaranteed outcomes, no real-money mode.'}</span>
      </section>

      <MarketTicker markets={store.markets} />

      <nav className="view-tabs" aria-label="Arena sections">
        {primaryNavItems.map((item) => (
          <button className={store.view === item.id ? 'active' : ''} key={item.id} onClick={() => store.setView(item.id)} type="button">
            {item.id === 'agents' && <i className={`agent-live-dot ${tournamentRunning ? 'running' : ''}`} />}
            {item.icon}
            {item.label}
            {item.id === 'agents' && <span className="nav-agent-count">{economyAgents.length}</span>}
          </button>
        ))}
      </nav>

      {store.view !== 'agents' && <><section className="hero-band">
        <div className="hero-copy">
          <p className="eyebrow">Sunday market desk · Monad testnet</p>
          <h2>Markets, clearly priced.</h2>
          <p className="hero-support">{store.markets.length} active markets · {store.indexedStatus.mode === 'INDEXED' ? `${store.indexedStatus.counts.protocolEvents} indexed events · Ponder live` : 'fixture catalog · Ponder fallback'} · {store.cryptoStatus.mode === 'LIVE_API' ? 'CMC live crypto markets' : store.cryptoStatus.mode === 'CACHE' ? 'CMC cached crypto markets' : 'crypto fallback ready'} · settlement health normal</p>
        </div>
        <div className="hero-metrics">
          <Stat icon={<Activity size={18} />} label="Chain" value={`Monad ${MONAD_TESTNET.id}`} tone="mint" />
          <Stat icon={<Coins size={18} />} label="Liquidity" value={formatMON(store.protocolLiquidity)} tone="peach" />
          <Stat icon={<Gauge size={18} />} label="Limit left" value={formatMON(store.limitRemaining)} tone="sky" />
          <Stat icon={<Brain size={18} />} label="AI tier" value={store.aiTier} tone="lilac" />
        </div>
      </section>

      <BlitzControl />

      <DiscoveryBar activeCategory={store.activeCategory} categories={store.categories} marketCount={store.markets.length} setActiveCategory={store.setActiveCategory} watchedCount={store.watchlist.length} />

      <JourneyStrip steps={journeySteps} /></>}

      <section className={`workspace ${store.view === 'agents' ? 'agent-workspace' : ''}`}>
        <div className="main-panel">
          <Suspense fallback={<FeatureSkeleton />}>{content}</Suspense>
        </div>
        {store.view !== 'agents' && <aside className="side-rail">
          <Rail title="Watchlist" icon={<Bookmark size={20} />}>
            <WatchlistRail markets={store.watchedMarkets} openMarket={store.openWatchedMarket} toggleWatchlist={store.toggleWatchlist} />
          </Rail>
          <ParlayPanel />
          <Rail title="Live feed" icon={<Activity size={20} />}>
            {store.notifications.map((item, index) => <span className="feed-item" key={`${item}-${index}`}>{item}</span>)}
          </Rail>
          <Rail title="Safety" icon={<Shield size={20} />}>
            <div className="status-pills">
              <span>{formatMON(store.spentToday)} / {formatMON(store.dailyLimit)}</span>
              <span>{store.pointsOnly ? 'Points only' : 'Test MON demo'}</span>
              <span>{store.selfExcluded ? 'Excluded' : 'Active'}</span>
            </div>
          </Rail>
        </aside>}
      </section>
      
      {store.paletteOpen && (
        <CommandPalette 
          close={store.closePalette} 
          markets={store.markets} 
          openMarket={store.openPaletteMarket} 
          openView={store.openPaletteView} 
          query={store.paletteQuery} 
          setQuery={store.setPaletteQuery} 
          views={navItems}
        />
      )}
    </main>
  )
}

function FeatureSkeleton() {
  return (
    <section aria-label="Loading dashboard" aria-live="polite" className="feature-skeleton" role="status">
      <span />
      <span />
      <span />
      <span />
    </section>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppLayout />
    </AppProvider>
  )
}
