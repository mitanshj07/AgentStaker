# Monad ArenaX Workflow

ArenaX is an Agent-First prediction ecosystem on Monad. Every value-moving action stays testnet-only, every AI action is advisory, and every executable action still requires the user's wallet signature.

## Judge Demo Workflow

```mermaid
flowchart TD
  A["Open ArenaX<br/>Land on Agent Arena hero stats"] --> B["Explore leaderboard<br/>Open a scored agent passport"]
  B --> C["Spawn Agent<br/>Describe, generate, review, deploy"]
  C --> D["Debate Arena<br/>YES and NO agents argue a live market"]
  D --> E["Tournament economy<br/>Stake, forecast, score, reward, slash"]
  E --> Duel["Agent Duels<br/>Head-to-head stake plus spectator pool"]
  Duel --> F["Connect wallet to Monad testnet<br/>Chain ID 10143"]
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
  Q --> Council["Top-five Agent Council<br/>commit, reveal, debate challenge"]
  Council --> R["Resolve market and update Brier scores"]
  R --> Delegate["Delegate test MON to a proven agent<br/>observe tournament return"]
  Delegate --> S["Claim winning shares or cash out parlay"]
  S --> T["Confirm proposed, finalized, and indexed states"]
```

## Product Modules

```mermaid
flowchart LR
  UI["Pastel consumer UI"] --> Agents["Agent Arena<br/>Passports, debate, tournaments, duels"]
  Agents --> Economy["Session agent economy<br/>wallets, stakes, earnings, delegation"]
  UI --> Discover["Explore Markets<br/>Categories, pulse filters, search, watchlist"]
  UI --> Arena["Arena trading<br/>YES and NO AMM shares"]
  UI --> Pro["Pro Exchange<br/>Signed CLOB orders and router"]
  UI --> Portfolio["Portfolio<br/>shares, parlay NFTs, cashout, claims"]
  UI --> Court["Oracle Court<br/>Challenge bond workflow"]
  UI --> LP["LP Dashboard<br/>Shared vault and rebalance"]
  UI --> Creator["Creator Studio<br/>AI review and market drafts"]
  UI --> Monad["Monad cockpit<br/>RPC, wallet, explorer, heartbeat"]
  UI --> Limits["Responsible limits<br/>Exposure and cooldowns"]
```

## System Architecture

```mermaid
flowchart TB
  Wallet["User wallet<br/>Monad testnet"] --> Frontend["React frontend<br/>Vite"]
  Frontend --> RPC["Monad testnet RPC"]
  Frontend --> Matcher["Matcher service<br/>Non-custodial APIs and WebSocket"]
  Frontend --> IndexerAPI["Indexed API<br/>Ponder and Postgres"]
  Frontend --> AI["Advisory AI endpoints<br/>Deterministic fallback or model adapter"]

  Matcher --> Exchange["ExchangeBook.sol<br/>EIP-712 settlement"]
  Matcher --> AMM["AMMPool.sol<br/>Outcome share swaps"]
  AI -. "proposal only" .-> Frontend

  RPC --> Factory["MarketFactory.sol"]
  RPC --> Parlay["ParlayEngine.sol<br/>ERC-721 positions"]
  RPC --> Oracle["OracleCouncil.sol"]
  RPC --> Vault["SharedLiquidityVault.sol"]
  RPC --> Forecast["ForecastArena.sol"]
  RPC --> Pass["AIPass.sol"]
  RPC --> Creator["CreatorVault.sol"]
  RPC --> Limits["ResponsibleLimits.sol"]

  Factory --> Events["Monad contract events"]
  Exchange --> Events
  AMM --> Events
  Parlay --> Events
  Oracle --> Events
  Vault --> Events
  Forecast --> Events
  Pass --> Events
  Creator --> Events
  Events --> Ponder["Ponder indexer"]
  Ponder --> Postgres["Postgres read model"]
  Postgres --> IndexerAPI
```

## Share Purchase And Settlement

```mermaid
sequenceDiagram
  actor User
  participant UI as Arena UI
  participant Limits as ResponsibleLimits
  participant Pool as AMMPool
  participant Creator as CreatorVault
  participant Monad as Monad testnet
  participant Indexer as Ponder indexer

  User->>UI: Select market, outcome, and test MON stake
  UI->>Limits: Preview daily limit and exposure cap
  Limits-->>UI: Allowed or blocked
  User->>Pool: Sign buy transaction
  Pool->>Limits: Record spend and validate cap
  Pool->>Creator: Forward creator, referral, and protocol fees
  Pool->>Monad: Emit Trade event
  Monad-->>UI: Proposed then finalized receipt
  Monad->>Indexer: Stream Trade event
  Indexer-->>UI: Return indexed portfolio update
```

## Signed Pro Exchange Route

```mermaid
sequenceDiagram
  actor User
  participant UI as Pro Exchange UI
  participant Router as Smart router
  participant Matcher as Off-chain matcher
  participant Book as ExchangeBook.sol
  participant Pool as AMMPool.sol
  participant Monad as Monad testnet
  participant Indexer as Ponder indexer

  User->>UI: Choose side, outcome, size, limit, and time-in-force
  UI->>Router: Request route quote
  Router-->>UI: AMM and CLOB split, impact, expiry, route hash
  User->>UI: Approve EIP-712 order signature
  UI->>Matcher: Submit signed non-custodial order
  Matcher->>Matcher: Validate nonce, expiry, tick size, balance reservation, lock
  Matcher-->>UI: Accepted, partially filled, or rejected
  Matcher->>Book: Submit matched settlement intent
  Book->>Book: Verify signature, nonce, fill constraints, cancellation state
  Book->>Pool: Settle routed AMM leg when present
  Book->>Monad: Emit fill or cancellation event
  Monad->>Indexer: Stream exchange events
  Indexer-->>UI: Update orderbook, history, and settlement timeline
```

## Parlay NFT Cashout And Hedge

```mermaid
flowchart TD
  A["User selects at least two market legs"] --> B["ParlayEngine reserves liability"]
  B --> C["Mint transferable ERC-721 parlay NFT"]
  C --> D{"User wants an early exit?"}
  D -- "No" --> E["Hold until all legs resolve"]
  D -- "Yes" --> F["Contract quoteCashout uses current AMM probabilities"]
  F --> G["Apply resolved-leg state, discount basis points, liquidity check"]
  G --> H["Return deterministic quote and expiry"]
  H --> I["AI explains risk and can propose a hedge"]
  I --> J{"User approves?"}
  J -- "Cash out" --> K["User signs cashoutParlay with minPayout slippage guard"]
  J -- "Hedge" --> L["User signs separate routed hedge order"]
  J -- "Hold" --> E
```

## Oracle Court And Forecast Arena

```mermaid
flowchart LR
  Market["Locked market"] --> Members["Top five reputation agents<br/>assigned to council"]
  Members --> Commit["Agents commit outcome hashes"]
  Commit --> Reveal["Agents reveal calibrated votes"]
  Reveal --> Window["Challenge window"]
  Window -->|"No challenge"| Final["Finalize outcome"]
  Window -->|"Bond posted"| Dispute["Disputed state"]
  Dispute --> Council["Council resolution"]
  Council --> Slash["Slash simulation and reputation report"]
  Slash --> Final

  Agents["Core and user-spawned passports"] --> Stake["Lock 5 test MON per participant"]
  Stake --> Tournament["Trigger POST /api/agents/tournament/run"]
  Tournament --> Fetch["Parallel LLM forecasts using system prompts"]
  Fetch --> Consensus["Calculate aggregate probability consensus"]
  Consensus --> Score["Record Brier score & histories in-memory"]
  Final --> Score
  Score --> Reward["Top three earn, bottom two slash<br/>delegations accrue simulated return"]
  Reward --> Board["Dynamic leaderboard, cohorts, activity feed"]
```

## AI Safety Boundary

```mermaid
flowchart TD
  Input["Market, portfolio, LP, or creator input"] --> Tier["Check AIPass tier and credits"]
  Tier --> Agent["Run deterministic fallback or configured model adapter"]
  Agent --> Ledger["Write visible task ledger<br/>input, tool, confidence, warning"]
  Ledger --> Advice["Return recommendation"]
  Advice --> Approval{"Does action move value or mutate chain state?"}
  Approval -- "No" --> UI["Display analysis"]
  Approval -- "Yes" --> Signature["Require explicit user wallet signature"]
  Signature --> Monad["Submit to Monad testnet"]
```

## Indexed Event Coverage

| Domain | Indexed events |
| --- | --- |
| Markets | Market created, trade, result finalized |
| Exchange | Fill, cancellation, routed settlement |
| Parlays | NFT creation, liability reservation, cashout, claim |
| Forecast Arena | Registration, commit, reveal, score |
| Oracle Court | Commit, reveal, challenge, resolution |
| Shared LP vault | Deposit, allocation, queued withdrawal, rebalance |
| AI passes | Tier mint, spend record, credit consumption |
| Community | League join, badge issued, reputation report |
| Creator economy | Creator fee, referral credit, protocol balance |

## Runtime Modes

| Mode | Purpose |
| --- | --- |
| `TESTNET_ONLY` | Default hackathon mode. Transactions use Monad testnet only. |
| `POINTS_ONLY` | Disables wallet value flows while preserving the product demo. |
| `DEMO_FALLBACK` | Uses deterministic fixtures when an optional API is unavailable. |
| `LEGAL_REVIEW_REQUIRED` | Keeps any future real-money path disabled pending review. |
