import { useEffect, useState, type ReactNode } from 'react'
import {
  Activity,
  BadgeCheck,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  Gauge,
  LoaderCircle,
  LockKeyhole,
  Play,
  Share2,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Video,
} from 'lucide-react'
import { demoSlipCards, loadWalletSlips, type SlipReadResult } from '../lib/contracts'
import { writeCreateSocialMarket, writeJoinPointsLeague, writeSocialBet, writeSubmitFantasyLineup, type ContractWriteResult } from '../lib/contractWrites'
import { humanizeTransactionError } from '../lib/errorCopy'
import { createAgentSession, fetchActivity, fetchSignals, previewSocialMarket, unlockSignal, type ActivityItem, type SignalBundle } from '../services/api'
import { useApp } from '../store/AppContext'

export function Slips() {
  const { wallet } = useApp()
  const [shared, setShared] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [readResult, setReadResult] = useState<SlipReadResult>({ cards: demoSlipCards, mode: 'DEMO_FALLBACK', message: 'Loading Monad slip locker' })
  useEffect(() => {
    let active = true
    void loadWalletSlips(wallet.address).then((result) => {
      if (!active) return
      setReadResult(result)
      setLoading(false)
    })
    return () => {
      active = false
    }
  }, [wallet.address])

  return (
    <FeatureShell eyebrow="BetSlipNFT.sol" title="Your on-chain slip locker" support="Shareable gameplay cards linked to authoritative ArenaX positions. Financial ownership and card gameplay stay separate.">
      <div className="contract-read-banner">
        <span className={`contract-mode ${readResult.mode === 'ON_CHAIN' ? 'live' : ''}`}>{loading ? <LoaderCircle className="spin" size={14} /> : <Database size={14} />} {loading ? 'Reading Monad' : readResult.mode === 'ON_CHAIN' ? 'Monad contract live' : 'Read fallback'}</span>
        <small>{readResult.message}</small>
      </div>
      <div className="consumer-grid three">
        {readResult.cards.map((slip) => (
          <article className={`slip-card ${slip.tone}`} key={slip.id}>
            <div className="card-topline"><span>#{slip.id}</span><b>{slip.rarity}</b></div>
            <h3>{slip.title}</h3>
            <div className="slip-odds">{slip.odds.toFixed(2)}x</div>
            <p>{slip.legs} leg{slip.legs === 1 ? '' : 's'} · {slip.origin} · {slip.stakeMON.toFixed(2)} MON</p>
            <div className="slip-stats">
              <span><small>Power</small><b>{slip.stats.power}</b></span>
              <span><small>Defense</small><b>{slip.stats.defense}</b></span>
              <span><small>Speed</small><b>{slip.stats.speed}</b></span>
              <span><small>Luck</small><b>{slip.stats.luck}</b></span>
            </div>
            <div className="button-row">
              <button className="primary-button compact" onClick={() => setShared(slip.id)} type="button"><Share2 size={15} /> {shared === slip.id ? 'Shared' : 'Share'}</button>
              <span className="status-chip"><CheckCircle2 size={14} /> {slip.status}</span>
            </div>
          </article>
        ))}
      </div>
    </FeatureShell>
  )
}

export function SocialMarkets() {
  const { notify, wallet } = useApp()
  const [url, setUrl] = useState('https://youtube.com/watch?v=arenax-demo')
  const [handle, setHandle] = useState('@monadarenax')
  const [preview, setPreview] = useState<{ platform: string; progress: number; checks: string[] } | null>(null)
  const [writeResult, setWriteResult] = useState<ContractWriteResult | null>(null)
  async function createMarket() {
    try {
      const result = await writeCreateSocialMarket({ owner: wallet.address, contentUrl: url, handle, startValue: 42000, targetValue: 50000, resolveTime: Math.floor(Date.now() / 1000) + 3 * 24 * 60 * 60 })
      setWriteResult(result)
      notify(result.message)
    } catch (error) {
      notify(humanizeTransactionError('Social market', error))
    }
  }
  async function betYes() {
    try {
      const result = await writeSocialBet({ owner: wallet.address, side: true, stakeMON: 0.5 })
      setWriteResult(result)
      notify(result.message)
    } catch (error) {
      notify(humanizeTransactionError('Social slip', error))
    }
  }
  return (
    <FeatureShell eyebrow="SocialMarket.sol" title="Social milestone markets" support="Evidence-backed X and YouTube prediction markets with a manual oracle challenge window.">
      <div className="consumer-split">
        <section className="operator-panel">
          <div className="section-heading"><Video size={19} /><div><h3>Create social milestone</h3><p>Testnet-only creator flow</p></div></div>
          <label>Content URL<input value={url} onChange={(event) => setUrl(event.target.value)} /></label>
          <label>Handle<input value={handle} onChange={(event) => setHandle(event.target.value)} /></label>
          <div className="form-grid two"><label>Start<input defaultValue="42000" /></label><label>Target<input defaultValue="50000" /></label></div>
          <div className="button-row">
            <button className="secondary-button" onClick={async () => setPreview(await previewSocialMarket({ contentUrl: url, handle, startValue: 42000, targetValue: 50000 }))} type="button"><Sparkles size={16} /> Preview evidence flow</button>
            <button className="primary-button" disabled={!preview} onClick={() => void createMarket()} type="button">Create on Monad</button>
          </div>
          {writeResult && <small className={`contract-mode ${writeResult.mode === 'ON_CHAIN' ? 'live' : ''}`}><Database size={14} />{writeResult.mode === 'ON_CHAIN' ? 'Contract finalized' : 'Local preview'}</small>}
        </section>
        <section className="operator-panel soft">
          <div className="section-heading"><ShieldCheck size={19} /><div><h3>Oracle evidence</h3><p>Manual review with challenge period</p></div></div>
          <div className="progress-track"><i style={{ width: `${preview?.progress ?? 84}%` }} /></div>
          <strong>{preview?.progress ?? 84}% toward milestone</strong>
          {(preview?.checks ?? ['Canonical source URL', 'Evidence URI required', '30 minute challenge window', 'Test MON only']).map((check) => <span className="check-line" key={check}><CheckCircle2 size={14} /> {check}</span>)}
        </section>
      </div>
      <div className="consumer-grid two">
        <CompactMarket action="Bet 0.50 MON YES" onAction={() => void betYes()} title="Will @monadarenax reach 50k YouTube views before Sunday?" meta="42k / 50k views · evidence window" yes="64%" />
        <CompactMarket title="Will the ArenaX launch thread cross 2,000 likes in 24h?" meta="X milestone · manual oracle" yes="57%" />
      </div>
    </FeatureShell>
  )
}

export function Battles() {
  const { awardXP } = useApp()
  const [activeTab, setActiveTab] = useState<'Duel' | 'Clash' | 'Card'>('Duel')
  
  // State for all games
  const [stage, setStage] = useState<'Idle' | 'Staking' | 'Racing' | 'Resolved'>('Idle')
  const [gameId, setGameId] = useState<string | null>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [raceMessage, setRaceMessage] = useState('Agents warming up...')
  
  // Strategy Clash specific
  const [clashMove, setClashMove] = useState<'PRESS' | 'HEDGE' | null>(null)
  
  async function createGame() {
    setStage('Staking')
    let endpoint = 'api/duels/create'
    if (activeTab === 'Clash') endpoint = 'api/clash/create'
    if (activeTab === 'Card') endpoint = 'api/cards/create'
    
    const res = await fetch(`http://localhost:3000/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketId: '101', agentA: 'Alpha Ensemble', agentB: 'Quant Razor' })
    }).catch(() => null)
    
    if (res?.ok) {
      const data = await res.json()
      setGameId(data.id)
    } else {
      setGameId(`game-${Date.now()}`)
    }
  }

  async function runGame() {
    setStage('Racing')
    let endpoint = `api/duels/${gameId}/run`
    if (activeTab === 'Clash') endpoint = `api/clash/${gameId}/resolve`
    if (activeTab === 'Card') endpoint = `api/cards/${gameId}/resolve`
    
    if (gameId) {
      await fetch(`http://localhost:3000/${endpoint}`, { method: 'POST' }).catch(() => null)
    }
    
    let step = 0
    const timer = setInterval(() => {
      step++
      if (activeTab === 'Duel') setRaceMessage(`Agent processing factor ${step}...`)
      if (activeTab === 'Clash') setRaceMessage(`Agents revealing strategies...`)
      if (activeTab === 'Card') setRaceMessage(`Drawing cards...`)
      
      if (step >= 5) {
        clearInterval(timer)
        setStage('Resolved')
        setWinner('Alpha Ensemble')
        awardXP(50, `${activeTab} Won`)
      }
    }, 2000)
  }

  return (
    <FeatureShell eyebrow="BattleArena.sol" title="Agent Battle Arena" support="Put your AI agents to the test in head-to-head on-chain games. Winners take the XP and stake pools.">
      
      <div className="segmented-control" style={{ marginBottom: '1.5rem', justifyContent: 'center' }}>
        <button className={activeTab === 'Duel' ? 'active' : ''} onClick={() => { setActiveTab('Duel'); setStage('Idle') }} type="button"><Swords size={16} /> Stat Duel</button>
        <button className={activeTab === 'Clash' ? 'active' : ''} onClick={() => { setActiveTab('Clash'); setStage('Idle') }} type="button"><ShieldCheck size={16} /> Strategy Clash</button>
        <button className={activeTab === 'Card' ? 'active' : ''} onClick={() => { setActiveTab('Card'); setStage('Idle') }} type="button"><Trophy size={16} /> Card Battle</button>
      </div>

      <section className="battle-stage">
        <SlipFighter name="Alpha Ensemble" score={activeTab === 'Duel' ? "🧠 88 PWR" : activeTab === 'Clash' ? "♟️ Alpha" : "🃏 Hand"} rarity="Favorite" />
        <div className="battle-core">
           <Swords size={30} className={stage === 'Racing' ? 'spin' : ''} />
           <b>{stage}</b>
           {stage === 'Racing' && <span className="race-message" style={{fontSize: '0.8rem', opacity: 0.8, marginTop: '8px'}}>{raceMessage}</span>}
           {stage === 'Resolved' && <span className="winner-message" style={{color: 'var(--success-color)', fontWeight: 'bold', marginTop: '8px'}}>Winner: {winner}</span>}
        </div>
        <SlipFighter name="Quant Razor" score={activeTab === 'Duel' ? "⚡ 81 PWR" : activeTab === 'Clash' ? "♟️ Quant" : "🃏 Hand"} rarity="Underdog" />
      </section>
      
      {activeTab === 'Clash' && stage === 'Staking' && (
        <div className="clash-moves" style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1rem' }}>
          <button className={`secondary-button ${clashMove === 'PRESS' ? 'active' : ''}`} onClick={() => setClashMove('PRESS')}><Gauge size={16}/> Press Advantage</button>
          <button className={`secondary-button ${clashMove === 'HEDGE' ? 'active' : ''}`} onClick={() => setClashMove('HEDGE')}><ShieldCheck size={16}/> Hedge Risk</button>
        </div>
      )}

      <div className="timeline-row">
        {['Select Agents', 'Stake XP', activeTab === 'Duel' ? 'Reasoning Race' : activeTab === 'Clash' ? 'Reveal Tactics' : 'Play Cards', 'Winner Takes All'].map((item, index) => <span className={index <= (stage === 'Idle' ? 0 : stage === 'Staking' ? 1 : stage === 'Racing' ? 2 : 3) ? 'done' : ''} key={item}>{index + 1}. {item}</span>)}
      </div>
      
      <div className="button-row" style={{ marginTop: '16px', display: 'flex', gap: '12px', justifyContent: 'center' }}>
        {stage === 'Idle' && <button className="primary-button" onClick={() => void createGame()} type="button"><Play size={16} /> Create {activeTab}</button>}
        {stage === 'Staking' && <button className="primary-button" onClick={() => void runGame()} type="button" disabled={activeTab === 'Clash' && !clashMove}><LockKeyhole size={16} /> Lock Stakes & Play</button>}
        {stage === 'Resolved' && <button className="secondary-button" onClick={() => { setStage('Idle'); setClashMove(null); }} type="button">New Game</button>}
      </div>
    </FeatureShell>
  )
}

export function Fantasy() {
  const { notify, wallet } = useApp()
  const picks = ['Alpha Ensemble', 'Monad Scout', 'Cricket Closer']
  const [stage, setStage] = useState<'READY' | 'JOINED' | 'SUBMITTED'>('READY')
  const [writeResult, setWriteResult] = useState<ContractWriteResult | null>(null)
  async function joinLeague() {
    try {
      const result = await writeJoinPointsLeague({ owner: wallet.address })
      setWriteResult(result)
      setStage('JOINED')
      notify(result.message)
    } catch (error) {
      notify(humanizeTransactionError('League join', error))
    }
  }
  async function lockLineup() {
    try {
      const result = await writeSubmitFantasyLineup({ owner: wallet.address, picks })
      setWriteResult(result)
      setStage('SUBMITTED')
      notify(result.message)
    } catch (error) {
      notify(humanizeTransactionError('Lineup signing', error))
    }
  }
  return (
    <FeatureShell eyebrow="FantasyContest.sol" title="Synthetic DFS arena" support="Build a points-only lineup for the Monad Weekend Cup. Lineups lock on-chain and score through the authorized contest reporter.">
      <div className="consumer-split">
        <section className="operator-panel">
          <div className="section-heading"><Trophy size={19} /><div><h3>Monad Weekend Cup</h3><p>Locks in 42m · 1,248 entries</p></div></div>
          {picks.map((pick, index) => <div className="lineup-row" key={pick}><b>C{index + 1}</b><span>{pick}</span><strong>{88 - index * 7} pts</strong></div>)}
          <div className="button-row">
            <button className="secondary-button" disabled={stage !== 'READY'} onClick={() => void joinLeague()} type="button">{stage === 'READY' ? 'Join points league' : 'League joined'}</button>
            <button className="primary-button" disabled={stage !== 'JOINED'} onClick={() => void lockLineup()} type="button"><LockKeyhole size={16} /> {stage === 'SUBMITTED' ? 'Lineup locked' : 'Lock lineup on Monad'}</button>
          </div>
          {writeResult && <small className={`contract-mode ${writeResult.mode === 'ON_CHAIN' ? 'live' : ''}`}><Database size={14} />{writeResult.mode === 'ON_CHAIN' ? 'Contract finalized' : 'Local preview'}</small>}
        </section>
        <section className="operator-panel soft">
          <div className="section-heading"><Gauge size={19} /><div><h3>Scoring model</h3><p>Transparent synthetic points</p></div></div>
          <div className="metric-list"><span>Calibration bonus <b>+25</b></span><span>Oracle accuracy <b>+18</b></span><span>Risk discipline <b>+12</b></span><span>Battle XP <b>+10</b></span></div>
        </section>
      </div>
    </FeatureShell>
  )
}

export function Profile() {
  const { xp, level, streak } = useApp()
  const [items, setItems] = useState<ActivityItem[]>([])
  const [signals, setSignals] = useState<SignalBundle[]>([])
  const [session, setSession] = useState<{ dailyCap: number; paused: boolean; permissions: string[]; forbidden: string[] } | null>(null)
  useEffect(() => {
    void fetchActivity().then((result) => setItems(result.items))
    void fetchSignals().then((result) => setSignals(result.signals))
  }, [])
  async function openSignal(id: string) {
    const next = await unlockSignal(id)
    setSignals((current) => current.map((signal) => signal.id === id ? { ...signal, ...next, locked: false } : signal))
  }
  return (
    <FeatureShell eyebrow="Player cockpit" title="Profile, signals, and activity" support="A single operational view for credits, badges, restricted agent sessions, and indexed protocol actions.">
      <div className="profile-summary">
        <div><BadgeCheck size={20} /><span>Level {level}</span><b>{xp} XP (Streak: {streak})</b></div>
        <div><Sparkles size={20} /><span>AI credits</span><b>25 free</b></div>
        <div><Trophy size={20} /><span>Badges</span><b>4 earned</b></div>
      </div>
      <div className="consumer-split">
        <section className="operator-panel">
          <div className="section-heading"><Bot size={19} /><div><h3>Restricted AI session</h3><p>CLOB fills and cancellation only</p></div></div>
          {session ? <><span className="check-line"><CheckCircle2 size={14} /> {session.dailyCap} MON daily cap</span>{session.permissions.map((item) => <span className="check-line" key={item}><CheckCircle2 size={14} /> {item}</span>)}<small>Blocked: {session.forbidden.join(', ')}</small></> : <p className="muted-copy">Prepare a one-hour ERC-1271 session with a hard cap. AMM swaps, withdrawals, and arbitrary calls stay blocked.</p>}
          <button className="primary-button" onClick={async () => setSession(await createAgentSession())} type="button"><LockKeyhole size={16} /> {session ? 'Session prepared' : 'Prepare capped session'}</button>
        </section>
        <section className="operator-panel">
          <div className="section-heading"><Sparkles size={19} /><div><h3>Signal bundles</h3><p>AIPass credit-gated analysis</p></div></div>
          {signals.map((signal) => <div className="signal-row" key={signal.id}><div><b>{signal.title}</b><span>{signal.agent} · {(signal.confidence * 100).toFixed(0)}% confidence</span></div><button onClick={() => void openSignal(signal.id)} type="button">{signal.locked ? `${signal.credits} credits` : 'Unlocked'}</button></div>)}
        </section>
      </div>
      <section className="operator-panel">
        <div className="section-heading"><Activity size={19} /><div><h3>Indexed activity</h3><p>Ponder-ready protocol event feed</p></div></div>
        {items.map((item) => <div className="activity-row" key={item.id}><Clock3 size={14} /><div><b>{item.title}</b><span>{item.detail}</span></div><em>{item.module}</em></div>)}
      </section>
    </FeatureShell>
  )
}

function FeatureShell({ eyebrow, title, support, children }: { eyebrow: string; title: string; support: string; children: ReactNode }) {
  return <section className="consumer-view"><div className="consumer-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{support}</p></div><a href="https://testnet.monadexplorer.com" rel="noreferrer" target="_blank">Explorer <ExternalLink size={14} /></a></div>{children}</section>
}

function CompactMarket({ action, onAction, title, meta, yes }: { action?: string; onAction?: () => void; title: string; meta: string; yes: string }) {
  return <article className="compact-market"><div><p>{meta}</p><h3>{title}</h3></div><button onClick={onAction} type="button">{action ?? `YES ${yes}`}</button></article>
}

function SlipFighter({ name, score, rarity }: { name: string; score: string; rarity: string }) {
  return <article><Bot size={22} /><h3>{name}</h3><p>{rarity}</p><b>{score}</b></article>
}
