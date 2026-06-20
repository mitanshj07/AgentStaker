# Monad ArenaX API And Contract Reference

Last updated: 2026-06-05

## 1. Service Overview

ArenaX has two local services outside the frontend:

| Service | Default URL | Package | Purpose |
| --- | --- | --- | --- |
| Matcher | `http://127.0.0.1:8787` | `packages/matcher` | Signed order intake, router, websocket snapshots, advisory AI. |
| Indexer | `http://127.0.0.1:42069` | `packages/indexer` | Ponder indexed REST and GraphQL read model. |

The frontend consumes both services only when their URLs are configured. If a service is absent, the UI falls back to deterministic fixtures and states that mode visibly.

## 2. Matcher API

### `GET /health`

Returns service mode and configuration flags.

Response:

```json
{
  "ok": true,
  "chainId": 10143,
  "mode": "TESTNET_ONLY",
  "matcherPrivateKeyConfigured": false,
  "aiAdapterConfigured": false,
  "cmcConfigured": true,
  "cryptoCachePath": "packages/matcher/.cache/cmc-market-cache.json",
  "cryptoRefreshMode": "TWELVE_HOURLY",
  "cryptoRefreshIntervalMs": 43200000
}
```

### `GET /api/crypto/markets`

Returns the quota-safe live crypto feed used by the Arena market board.

Behavior:

- Uses CoinMarketCap only from the matcher; no browser-side CMC key exposure.
- Defaults to one batched refresh every 12 hours.
- Supports `CMC_REFRESH_MODE=DAILY` for stricter low-quota operation.
- Switches to hourly when `CMC_REFRESH_MODE=HOURLY` or when `CMC_FINAL_REFRESH_FROM` has passed.
- Serves fresh cache when still inside the refresh window.
- Serves stale cache when CMC fails but a prior cache exists.
- Serves deterministic fallback markets when no key/cache exists.
- Requires `ADMIN_SECRET` for `?force=1` refresh attempts.

CoinMarketCap calls:

| Env | Default | Purpose |
| --- | --- | --- |
| `CMC_QUOTES_URL` | `https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest` | Latest price, market cap, 24h volume, percent changes. |
| `CMC_OHLCV_URL` | `https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/latest` | Current UTC open/high/low/close when the CMC plan supports it. |
| `CMC_ASSET_IDS` | `1,1027,5426,1839,52,74,2010,5805,1975,1958,6636,2,1831,4642,6535,21794,11419,20947,7083,28321` | BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, TRX, DOT, LTC, BCH, HBAR, NEAR, APT, TON, SUI, UNI, POL. |

Response shape:

```json
{
  "mode": "LIVE_API",
  "source": "COINMARKETCAP",
  "refreshedAt": "2026-06-05T00:00:00.000Z",
  "nextRefreshAt": "2026-06-05T12:00:00.000Z",
  "assets": [
    {
      "symbol": "BTC",
      "priceUsd": 63877.06,
      "volume24hUsd": 31000000000,
      "marketCapUsd": 1260000000000,
      "percentChange24h": 2.1,
      "highLowSource": "PLAN_GATED"
    }
  ],
  "markets": [
    {
      "uiMarketId": 101,
      "symbol": "BTC",
      "question": "Will BTC/USD close above $64,300 in the next UTC prediction window?",
      "metric": "PRICE_CLOSE",
      "target": 64300,
      "yesProbability": 0.52
    }
  ],
  "policy": {
    "refreshMode": "TWELVE_HOURLY",
    "refreshIntervalMs": 43200000,
    "callsPerRefresh": 1,
    "quotaNote": "Default live mode: one batched CMC refresh every 12 hours."
  },
  "warnings": [
    "CMC OHLCV unavailable: Your API Key subscription plan doesn't support this endpoint."
  ]
}
```

`highLowSource` values:

| Value | Meaning |
| --- | --- |
| `CMC_OHLCV` | Day high/low came from CMC OHLCV latest. |
| `PLAN_GATED` | Quotes are live, but OHLCV is unavailable on the current key/plan. |
| `QUOTE_ONLY` | OHLCV was disabled and high-breakout markets use quote-backed targets. |

Generated market metrics:

| Metric | Uses CMC fields |
| --- | --- |
| `PRICE_CLOSE` | `price`, `percent_change_24h` |
| `DAY_HIGH` | OHLCV high when available, otherwise quote-backed current price |
| `DAY_LOW` | OHLCV low when available, otherwise quote-backed current price |
| `VOLUME_24H` | `volume_24h`, `volume_change_24h` |
| `MARKET_CAP` | `market_cap`, `percent_change_7d` |

### `POST /orders`

Submits a signed non-custodial order preview.

Main semantics:

- Validates order type.
- Rejects duplicate nonce.
- Rejects expired order.
- Applies tick-size rules.
- Reserves maker exposure in memory for demo mode.
- Applies market lock state.
- Broadcasts orderbook websocket update.

Supported order types:

| Type | Behavior |
| --- | --- |
| `GTC` | Good until canceled. |
| `GTD` | Good until date/expiry. |
| `IOC` | Immediate or cancel. |
| `FOK` | Fill or kill. |
| `FAK` | Fill and kill remainder. |
| `POST_ONLY` | Maker-only; rejected when marketable. |

### `POST /orders/batch`

Submits several signed orders in one request. Useful for institutional or market-maker demos.

### `POST /orders/cancel`

Cancels a live order by maker/nonce/order id. The matcher emits an advisory cancellation state. On-chain cancellation is handled by `ExchangeBook.cancelOrder`.

### `GET /orderbook/:marketId`

Returns current in-memory bids and asks for a market.

Includes:

- Bids.
- Asks.
- Spread.
- Last update.
- Open order count.

### `GET /portfolio/:address`

Returns matcher-side portfolio and reservation state for an address.

Includes:

- Open orders.
- Order history.
- Reserved exposure.
- Advisory balances.

### `POST /markets/:marketId/lock`

Locks a market for sports/settlement cutoff simulation and cancels unsafe open orders.

### `POST /route/quote`

Returns an AMM/CLOB route preview.

Input fields:

| Field | Meaning |
| --- | --- |
| `marketId` | Market id. |
| `outcomeIndex` | Outcome index, usually 0 for YES and 1 for NO. |
| `side` | Buy or sell side. |
| `size` | Desired size. |
| `wallet` | User wallet address. |
| `maxSlippageBps` | Maximum allowed slippage. |

Output fields:

| Field | Meaning |
| --- | --- |
| `legs` | AMM and CLOB split legs. |
| `effectivePrice` | Blended execution price. |
| `priceImpactBps` | Estimated impact. |
| `depthUsed` | Liquidity used. |
| `routeHash` | Deterministic route id. |
| `expiresAt` | Quote expiry. |
| `requiredSignatures` | Required user signatures. |

### Websocket: `GET /ws`

General matcher websocket stream.

### Websocket: `GET /ws`

General websocket for orderbook updates and snapshots.

## 2.5 Agent Ecosystem Matcher Endpoints

These endpoints manage the dynamic, autonomous agent pool:

### `POST /api/agents/create`
Spawns a new custom trading agent persona using Gemini.
- **Request Body**:
  ```json
  {
    "prompt": "Astrology swing trader who trades based on planetary alignment"
  }
  ```
- **Response** (`AgentProfile`):
  ```json
  {
    "id": "agent_1718880000000",
    "name": "AstroTrader",
    "avatar": "🪐",
    "strategy": "Planetary momentum and astrology configurations",
    "description": "Custom agent spawned from natural language operator prompts.",
    "systemPrompt": "You are AstroTrader...",
    "brierScore": 0.5,
    "totalForecasts": 0,
    "wins": 0,
    "losses": 0,
    "streak": 0,
    "badge": "CUSTOM",
    "rank": 5,
    "history": []
  }
  ```

### `GET /api/agents/leaderboard`
Returns the array of all active core and user-spawned agents.
- **Response**: `AgentProfile[]`

### `GET /api/agents/:agentId/history`
Returns the prediction history for a specific agent.
- **Response**: `AgentForecast[]`

### `POST /api/agents/tournament/run`
Triggers all active agents to make parallel forecasts on a specific market, generating consensus.
- **Request Body**:
  ```json
  {
    "marketId": 2,
    "question": "Will Monad testnet average TPS exceed 10,000 today?"
  }
  ```
- **Response** (`TournamentResult`):
  ```json
  {
    "marketId": 2,
    "question": "Will Monad testnet average TPS exceed 10,000 today?",
    "agents": [
      {
        "agentId": "alpha_ensemble",
        "name": "Alpha Ensemble",
        "probability": 0.65,
        "reasoning": "Standard TPS levels indicate...",
        "confidence": "HIGH",
        "keyFactors": ["Network activity", "Load testing"],
        "timestamp": 1718880000000
      }
    ],
    "consensus": 0.65,
    "mode": "LIVE"
  }
  ```

### `GET /api/agents/consensus/:marketId`
Returns consensus statistics for a specific market outcome.
- **Response** (`AgentConsensus`):
  ```json
  {
    "marketId": 2,
    "consensus": 0.65,
    "spread": 0.15,
    "agents": [
      { "id": "alpha_ensemble", "name": "Alpha Ensemble", "probability": 0.65 }
    ],
    "mode": "LIVE"
  }
  ```

## 3. Matcher AI Endpoints

All AI endpoints are advisory only. No endpoint places an order or submits a transaction.

| Endpoint | Purpose |
| --- | --- |
| `POST /ai/parlay-risk` | Explains parlay risk, correlation, and loss paths. |
| `POST /ai/hedge` | Suggests an advisory hedge route. |
| `POST /ai/forecast` | Produces forecast commentary and confidence. |
| `POST /ai/lp-rebalance` | Suggests LP allocation changes. |
| `POST /ai/check-market` | Reviews market quality, ambiguity, duplicate risk, and oracle readiness. |

Every AI response should be displayed as a task ledger:

- Input.
- Tool used.
- Recommendation.
- Confidence.
- Risk warning.
- Requires user approval.

## 4. Consumer/Gameplay Matcher Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /api/activity` | Demo activity feed. |
| `POST /api/social/preview` | Social market preview and manipulation check. |
| `GET /api/signals` | Signal bundle list. |
| `POST /api/signals/:signalId/unlock` | Advisory signal unlock. |
| `POST /api/sessions` | Agent-wallet session preview. |
| `POST /api/sessions/:sessionKey/pause` | Pause an agent session. |

## 5. Indexer API

The Ponder API lives in `packages/indexer/src/api/index.ts`.

### `GET /api/health`

ArenaX indexer health endpoint.

Response fields:

| Field | Meaning |
| --- | --- |
| `ok` | Service status. |
| `mode` | `INDEXED` when Ponder is serving. |
| `chainId` | Monad chain id, `10143`. |
| `indexedAt` | Server timestamp. |
| `freshness` | Latest indexed block and market update. |
| `counts` | Row counts by domain. |

### `GET /api/dashboard?address=0x...`

Main frontend hydration endpoint.

Response includes:

- `mode`
- `indexedAt`
- `chainId`
- `freshness`
- `counts`
- `markets`
- `oracleCases`
- `vault`
- `portfolio`
- `forecasts`
- `creatorRevenue`
- `activity`

### `GET /api/markets`

Returns indexed market rows and freshness.

### `/graphql`

Ponder GraphQL endpoint for direct query inspection.

## 6. Indexed Tables

| Table | Purpose |
| --- | --- |
| `markets` | Market metadata, category, state, volume, liquidity, resolved outcome. |
| `trades` | AMM trade events and new odds. |
| `orders` | Exchange fills. |
| `cancellations` | Exchange cancellations. |
| `riskProposals` | Risk-governor proposal lifecycle. |
| `parlays` | Parlay NFT creation, cashout, settlement, claim state. |
| `forecasts` | Forecast commit, reveal, score state. |
| `oracleCases` | Oracle commit, reveal, challenge, resolution state. |
| `protocolEvents` | General activity ledger across modules. |
| `betSlips` | `BetSlipNFT` cards. |
| `socialMarkets` | Creator/social milestone markets. |
| `battleResults` | Points-only battle outcomes. |
| `signals` | Signal marketplace records. |
| `fantasyEntries` | DFS contest submissions and scores. |

## 7. Contract Reference

### MarketFactory

Purpose:

- Creates binary markets.
- Locks markets at cutoff.
- Marks disputed state.
- Resolves or voids markets.

Key events:

- `MarketCreated`
- `MarketLocked`
- `MarketDisputed`
- `MarketResolved`
- `MarketVoided`

### AMMPool

Purpose:

- Accepts test-MON liquidity.
- Quotes and executes outcome-share trades.
- Moves odds after buys and sells.
- Forwards creator/referral/protocol fees.
- Mints companion bet slip cards.

Key events:

- `LiquidityAdded`
- `LiquidityRemoved`
- `Trade`

### ExchangeBook

Purpose:

- Verifies EIP-712 signed orders.
- Enforces replay protection and partial fills.
- Records cancellations.
- Settles fills on Monad testnet.
- Supports ERC-1271 session-wallet signatures.

Key events:

- `OrderFilled`
- `OrderCanceledEvent`
- `Deposited`
- `Withdrawn`

### ParlayEngine

Purpose:

- Mints transferable ERC-721 parlay positions.
- Reserves house liability.
- Quotes deterministic cashouts.
- Executes slippage-protected cashouts.
- Supports pull-based claims.

Key events:

- `ParlayCreated`
- `ParlayCashedOut`
- `ParlaySettled`
- `ParlayClaimed`

### OracleCouncil

Purpose:

- Commits hidden result hash.
- Reveals final outcome.
- Accepts challenge bonds.
- Resolves disputes.
- Finalizes markets through `MarketFactory`.

Key events:

- `ResultCommitted`
- `ResultRevealed`
- `ResultChallenged`
- `ChallengeResolved`
- `ResultFinalized`

### ForecastArena

Purpose:

- Registers forecast agents.
- Enforces commit-reveal forecasts.
- Scores forecasts after market outcome.
- Updates reputation.

Key events:

- `AgentRegistered`
- `ForecastCommitted`
- `ForecastRevealed`
- `ForecastScored`

### SharedLiquidityVault

Purpose:

- Accepts shared vault deposits.
- Issues vault shares.
- Tracks idle and deployed liquidity.
- Queues withdrawals when idle liquidity is insufficient.
- Supports operator allocation and rebalance.

Key events:

- `Deposited`
- `WithdrawalPaid`
- `WithdrawalQueued`
- `AllocationChanged`
- `Rebalanced`

### AIPass

Purpose:

- Mints AI subscription passes.
- Stores tier and credit balances.
- Allows authorized credit consumers.

Tiers:

- Free.
- Pro.
- Creator.
- LP.
- Institutional.

### CreatorVault

Purpose:

- Splits fees between creator, referrer, and protocol.
- Stores claimable balances.
- Restricts fee recording to authorized callers.

### ResponsibleLimits

Purpose:

- Enforces testnet safety and personal limits.
- Tracks daily spend.
- Tracks exposure.
- Tracks open orders.
- Tracks loss.
- Tracks AI execution cap.
- Supports points-only and self-exclusion.

### RiskGovernor

Purpose:

- Lets authorized agents propose risk actions.
- Enforces policy constraints.
- Requires user approval when configured.
- Tracks execution lifecycle.

### Gameplay And Community Contracts

| Contract | Purpose |
| --- | --- |
| `BetSlipNFT` | On-chain share cards with stats and SVG metadata. |
| `SocialMarket` | Evidence-backed creator/social milestone markets. |
| `BattleArena` | Points-only card battles. |
| `FantasyContest` | Synthetic DFS contest scoring. |
| `LeagueFactory` | Points-only league creation and membership. |
| `SignalMarketplace` | Credit-gated agent signal bundles. |
| `AgentWallet` | ERC-1271 capped session wallet. |
| `Reputation` | XP, badges, and scoring. |

## 8. Contract Address Map

After deployment, every address must be copied into both server and frontend env variables:

| Contract | Server env | Frontend env |
| --- | --- | --- |
| MarketFactory | `MARKET_FACTORY` | `VITE_MARKET_FACTORY` |
| AMMPool | `AMM_POOL` | `VITE_AMM_POOL` |
| ParlayEngine | `PARLAY_ENGINE` | `VITE_PARLAY_ENGINE` |
| OracleCouncil | `ORACLE_COUNCIL` | `VITE_ORACLE_COUNCIL` |
| ResponsibleLimits | `RESPONSIBLE_LIMITS` | `VITE_RESPONSIBLE_LIMITS` |
| ExchangeBook | `EXCHANGE_BOOK` | `VITE_EXCHANGE_BOOK` |
| AIPass | `AI_PASS` | `VITE_AI_PASS` |
| CreatorVault | `CREATOR_VAULT` | `VITE_CREATOR_VAULT` |
| RiskGovernor | `RISK_GOVERNOR` | `VITE_RISK_GOVERNOR` |
| SharedLiquidityVault | `SHARED_LIQUIDITY_VAULT` | `VITE_SHARED_LIQUIDITY_VAULT` |
| ForecastArena | `FORECAST_ARENA` | `VITE_FORECAST_ARENA` |
| Reputation | `REPUTATION` | `VITE_REPUTATION` |
| LeagueFactory | `LEAGUE_FACTORY` | `VITE_LEAGUE_FACTORY` |
| BetSlipNFT | `BET_SLIP_NFT` | `VITE_BET_SLIP_NFT` |
| SocialMarket | `SOCIAL_MARKET` | `VITE_SOCIAL_MARKET` |
| BattleArena | `BATTLE_ARENA` | `VITE_BATTLE_ARENA` |
| FantasyContest | `FANTASY_CONTEST` | `VITE_FANTASY_CONTEST` |
| SignalMarketplace | `SIGNAL_MARKETPLACE` | `VITE_SIGNAL_MARKETPLACE` |

Use:

```bash
npm run deploy:check
npm run deploy:check:rpc
npm run deploy:map
```

to verify and materialize the address map.
