# Monad ArenaX Workflow and Architecture Source

This technical companion is the editable source map for the visual architecture pack. ArenaX is a Monad testnet-only prediction exchange: test MON has no monetary value, AI remains advisory, and state-changing actions require explicit wallet approval.

## One Inclusive Workflow

```mermaid
flowchart LR
  subgraph UX["Product experience"]
    Launch["Monad ArenaX launch fade"]
    Agents["Agent Ecosystem dashboard<br/>Active AI Leaderboard & Agent Studio"]
    Arena["Sportsbook Arena<br/>pulse filters, watchlist, quick picks"]
    Ticket["Transparent testnet ticket<br/>stake, payout, responsible limits"]
    Pro["Pro Exchange<br/>depth, router, EIP-712 orders"]
    Portfolio["Portfolio<br/>shares, parlay NFTs, cashout, claims"]
    Court["Oracle Court<br/>commit, reveal, challenge, finalize"]
    LP["LP Dashboard<br/>vault, queues, rebalance"]
    Creator["Creator Studio<br/>quality check, create, revenue"]
    Cockpit["Monad cockpit<br/>RPC, block pulse, wallet, explorer"]
  end

  subgraph Services["Application services"]
    Frontend["React typed store and API clients"]
    Matcher["Non-custodial matcher<br/>REST and WebSocket"]
    Router["Smart router<br/>AMM and CLOB split"]
    AI["Advisory AI adapter<br/>model or deterministic fallback"]
    Indexer["Ponder indexer"]
    DB["Postgres read model"]
    Fixtures["Demo fallback fixtures"]
  end

  subgraph Monad["Monad testnet protocol / chain ID 10143"]
    RPC["Monad RPC"]
    Factory["MarketFactory"]
    AMM["AMMPool"]
    Book["ExchangeBook"]
    Parlay["ParlayEngine ERC-721"]
    Oracle["OracleCouncil"]
    Forecast["ForecastArena"]
    Vault["SharedLiquidityVault"]
    Pass["AIPass"]
    Revenue["CreatorVault"]
    Limits["ResponsibleLimits"]
    Governor["RiskGovernor"]
    Reputation["Reputation"]
    League["LeagueFactory"]
    Events["Contract event stream"]
  end

  Launch --> Arena --> Ticket
  Arena --> Pro
  Ticket --> Portfolio
  Portfolio --> Agents
  Creator --> Frontend
  LP --> Frontend
  Court --> Frontend
  Cockpit --> RPC
  UX --> Frontend
  Frontend --> Matcher
  Frontend --> AI
  Frontend --> DB
  Frontend --> Fixtures
  Matcher --> Router
  Matcher --> Book
  Router --> AMM
  RPC --> Factory
  RPC --> AMM
  RPC --> Book
  RPC --> Parlay
  RPC --> Oracle
  RPC --> Forecast
  RPC --> Vault
  RPC --> Pass
  RPC --> Revenue
  RPC --> Limits
  RPC --> Governor
  RPC --> Reputation
  RPC --> League
  Monad --> Events --> Indexer --> DB
  AI -. "proposal only" .-> Frontend
  Limits -. "cap or block" .-> AMM
  Limits -. "cap or block" .-> Book
  Limits -. "cap or block" .-> Governor
```

## Product Journey

```mermaid
flowchart TD
  A["Open ArenaX<br/>Lands on Agent Ecosystem default view"] --> B["Explore Agent Leaderboard<br/>Inspect ranks, Brier scores, strategy descriptions"]
  B --> C["Open Agent Studio<br/>Type custom persona description"]
  C --> D["Submit Agent Customization<br/>Gemini generates and registers new agent in-memory"]
  D --> E["Select Market & Run Tournament<br/>Active agents forecast in parallel and output consensus"]
  E --> F["Connect wallet to Monad testnet<br/>Chain ID 10143"]
  F --> G["Explore market categories or watchlist"]
  G --> H["Filter Trending, Live, Closing soon, or New markets"]
  H --> I["Load a YES or NO quick pick<br/>Review stake preset and projected return"]
  I --> J["Sign testnet share purchase<br/>AMM quote updates"]
  J --> K["Add legs from two or more markets"]
  K --> L["Mint transferable parlay NFT"]
  L --> M["Request deterministic cashout quote"]
  M --> N["Ask AI for hold-versus-cashout risk explanation"]
  N --> O["Preview advisory hedge route<br/>AMM plus CLOB split"]
  O --> P["Submit signed exchange order if desired"]
  P --> Q["Advance Oracle Court case<br/>commit, reveal, challenge, finalize"]
  Q --> R["Resolve market and update Brier scores"]
  R --> S["Claim winning shares or cash out parlay"]
  S --> T["Confirm proposed, finalized, and indexed states"]
```

## Smart Routing and Settlement

```mermaid
sequenceDiagram
  actor User
  participant UI as Pro Exchange UI
  participant Router as Smart router
  participant Matcher as Non-custodial matcher
  participant Limits as ResponsibleLimits
  participant Book as ExchangeBook
  participant Pool as AMMPool
  participant Revenue as CreatorVault
  participant Monad as Monad testnet
  participant Ponder as Ponder indexer

  User->>UI: Select side, outcome, size, limit, time-in-force
  UI->>Router: Request AMM/CLOB route quote
  Router-->>UI: Split legs, impact, expiry, route hash
  User->>UI: Approve EIP-712 signature
  UI->>Matcher: Submit signed non-custodial order
  Matcher->>Matcher: Validate nonce, expiry, tick, reservation, sports lock
  Matcher->>Limits: Check open order and execution caps
  Limits-->>Matcher: Allow or block
  Matcher->>Book: Submit matched settlement intent
  Book->>Pool: Settle routed AMM leg when present
  Pool->>Revenue: Forward creator, referral, protocol fees
  Book->>Monad: Emit fill or cancellation
  Monad->>Ponder: Stream events
  Ponder-->>UI: Refresh depth, history, portfolio, timeline
```

## Parlay NFT Cashout

```mermaid
flowchart TD
  A["Select 2-5 distinct market legs"] --> B["Check AMM probabilities"]
  B --> C["Reserve liability and prevent insolvency"]
  C --> D["Mint transferable ERC-721 parlay"]
  D --> E{"Early exit?"}
  E -->|"No"| F["Hold until all legs resolve"]
  E -->|"Yes"| G["quoteCashout"]
  G --> H["Apply resolved-leg state, live probabilities, discount bps, liquidity"]
  H --> I["Return quote, expiry, and minPayout protection"]
  I --> J["AI explains hold-versus-cashout risk"]
  J --> K{"User approval"}
  K -->|"Cash out"| L["Sign cashoutParlay"]
  K -->|"Hedge"| M["Sign separate routed hedge order"]
  K -->|"Hold"| F
  F --> N["Pull-based claim after finalized result"]
```

## Oracle Court and Forecast Arena

```mermaid
flowchart LR
  Locked["Locked market"] --> Commit["Council commits result hash"]
  Commit --> Reveal["Council reveals valid outcome"]
  Reveal --> Window["Challenge window"]
  Window -->|"No challenge"| Final["Finalize"]
  Window -->|"Bond posted"| Dispute["Disputed state"]
  Dispute --> Decision["Council decision and slashing simulation"]
  Decision --> Final

  Agents["Active core & custom agents"] --> Tournament["Trigger POST /api/agents/tournament/run"]
  Tournament --> Fetch["Parallel LLM forecasts using system prompts"]
  Fetch --> Consensus["Calculate aggregate probability consensus"]
  Consensus --> Score["Record Brier score & histories in-memory"]
  Final --> Score
  Score --> Board["Dynamic leaderboard and badges"]
```

## Agentic AI Safety Boundary

```mermaid
flowchart TD
  Input["Market, parlay, LP, portfolio, or creator input"] --> Tier["Check AIPass tier and credits"]
  Tier --> Adapter["Run configured model or deterministic fallback"]
  Adapter --> Ledger["Write visible ledger<br/>input, tool, confidence, warning, approval status"]
  Ledger --> Advice["Return recommendation"]
  Advice --> Mutation{"Moves value or changes chain state?"}
  Mutation -->|"No"| Show["Display analysis or simulation"]
  Mutation -->|"Yes"| Caps["Check ResponsibleLimits AI execution cap"]
  Caps -->|"Blocked"| Stop["Show blocked risk warning"]
  Caps -->|"Allowed"| Signature["Require explicit user wallet signature"]
  Signature --> Monad["Submit to Monad testnet"]
```

## Shared Vault and Creator Economy

```mermaid
flowchart LR
  LP["LP deposits test MON"] --> Shares["Mint proportional vault shares"]
  Shares --> Idle["Idle liquidity"]
  Idle --> Allocate["Operator allocation to AMM pools"]
  Allocate --> Proposal["AI rebalance proposal and drawdown simulation"]
  Proposal --> Approval{"Operator approves?"}
  Approval -->|"Yes"| Rebalance["Recall and rebalance with minReceived"]
  Approval -->|"No"| Idle
  Idle --> Withdrawal{"Enough idle liquidity?"}
  Withdrawal -->|"Yes"| Pay["Withdraw"]
  Withdrawal -->|"No"| Queue["Queued withdrawal"]

  Trade["AMM or exchange trade"] --> Fees["Fee calculation"]
  Fees --> Vault["CreatorVault"]
  Vault --> Creator["Creator claimable balance"]
  Vault --> Referral["Referral claimable balance"]
  Vault --> Protocol["Protocol claimable balance"]
```

## Indexer and Runtime Operations

```mermaid
flowchart LR
  Contracts["Monad contracts"] --> Events["Event stream"]
  Events --> Ponder["Ponder handlers"]
  Ponder --> Postgres["Postgres read model"]
  Postgres --> API["Indexed API"]
  API --> Frontend["Typed frontend services"]
  Frontend --> Cockpit["Monad cockpit freshness and timeline"]
  Fixtures["Demo fallback fixtures"] --> Frontend
  Modes["TESTNET_ONLY<br/>POINTS_ONLY<br/>DEMO_FALLBACK<br/>LEGAL_REVIEW_REQUIRED"] --> Frontend
  Verify["lint + build + matcher build<br/>Ponder codegen + Foundry tests<br/>matcher smoke suite"] --> Cockpit
```

## Contract Coverage

| Module | Responsibility | Visible or indexed behavior |
| --- | --- | --- |
| `MarketFactory.sol` | Market registry and lifecycle | Created, locked, disputed, finalized |
| `AMMPool.sol` | Outcome shares and liquidity | Quotes, probability movement, LP accounting, creator fees |
| `ExchangeBook.sol` | EIP-712 settlement | Nonce, fills, partial fills, cancellation |
| `ParlayEngine.sol` | Transferable ERC-721 parlays | Liability reserve, cashout, claim |
| `OracleCouncil.sol` | Result integrity | Commit, reveal, challenge bond, council resolution |
| `ForecastArena.sol` | Agent tournament | Registration, commit, reveal, Brier score |
| `SharedLiquidityVault.sol` | Shared LP capital | Deposit, allocation, queue, rebalance |
| `CreatorVault.sol` | Revenue accounting | Creator, referral, protocol balances |
| `AIPass.sol` | AI access | Tier mint, authorized credit consumption |
| `ResponsibleLimits.sol` | Usage controls | Position, open order, daily loss, AI execution caps |
| `RiskGovernor.sol` | Approval-only risk automation | Proposal, approval, execution, block |
| `Reputation.sol` | Authorized scoring | XP, scores, badges |
| `LeagueFactory.sol` | Community competition | Join, scoring, leaderboard |

