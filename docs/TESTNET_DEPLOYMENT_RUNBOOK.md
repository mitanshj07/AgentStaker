# Monad ArenaX Testnet Deployment And QA Runbook

Last updated: 2026-06-05

## 1. Purpose

This runbook takes ArenaX from local demo mode to a live Monad testnet demo. It is intentionally strict: the final deployment check fails until all required contract addresses and safety flags are configured.

## 2. Prerequisites

Required:

- Node.js and npm.
- Foundry.
- Monad testnet RPC access.
- Funded Monad testnet deployer wallet.
- Optional Postgres database for production-style Ponder indexing.

Recommended:

- Fresh terminal window for frontend.
- Fresh terminal window for matcher.
- Fresh terminal window for indexer.
- Browser opened to `http://127.0.0.1:5173/`.

## 3. Environment Setup

```bash
cp .env.example .env
npm install
```

Keep these safety defaults:

```env
VITE_APP_MODE=TESTNET_ONLY
VITE_ENABLE_DEMO_FALLBACK=true
VITE_ENABLE_REAL_MONEY=false
VITE_ENABLE_CONTRACT_WRITES=false
```

Set deployer only when ready to broadcast:

```env
DEPLOYER_PRIVATE_KEY=...
```

Optional matcher settlement:

```env
MATCHER_PRIVATE_KEY=...
```

Optional AI model adapter:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=...
```

If no model key is present, AI endpoints return deterministic explainable fallback analysis.

Optional live crypto market feed:

```env
VITE_ENABLE_LIVE_CRYPTO=true
CMC_PRO_API_KEY=...
CMC_ASSET_IDS=1,1027,5426,1839,52,74,2010,5805,1975,1958,6636,2,1831,4642,6535,21794,11419,20947,7083,28321
CMC_REFRESH_MODE=TWELVE_HOURLY
CMC_FINAL_REFRESH_FROM=
CMC_ENABLE_OHLCV=false
CMC_CACHE_PATH=packages/matcher/.cache/cmc-market-cache.json
```

Use `CMC_REFRESH_MODE=TWELVE_HOURLY` for the live hackathon board. Use `CMC_REFRESH_MODE=DAILY` for stricter low-quota operation. Keep `CMC_ENABLE_OHLCV=false` on the basic CMC plan so each refresh uses one quotes call. Set `CMC_FINAL_REFRESH_FROM` to the final judging window start time if you want the matcher to switch to hourly refresh only during the final demo. The key must stay server-side; do not create a `VITE_CMC_*` key.

## 4. Local Verification Before Broadcast

```bash
npm run verify
npm run deploy:check:local
```

Expected:

- `npm run verify` passes.
- `deploy:check:local` passes with warnings if addresses are empty.
- `deploy:check` fails before deployment because address map is missing.

That failure is correct.

## 5. Contract Deployment

```bash
cd packages/contracts
forge build
forge test -vvv
forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

After broadcast:

1. Copy every printed contract address into `.env`.
2. Copy frontend-visible addresses into `VITE_*` variables.
3. Set `DEPLOYMENT_BLOCK` to the first broadcast block.
4. Keep `START_BLOCK` for compatibility if needed.

## 6. Required Address Variables

All of these must be configured before strict readiness passes:

```env
MARKET_FACTORY=
AMM_POOL=
PARLAY_ENGINE=
ORACLE_COUNCIL=
RESPONSIBLE_LIMITS=
EXCHANGE_BOOK=
AI_PASS=
CREATOR_VAULT=
RISK_GOVERNOR=
SHARED_LIQUIDITY_VAULT=
FORECAST_ARENA=
REPUTATION=
LEAGUE_FACTORY=
BET_SLIP_NFT=
SOCIAL_MARKET=
BATTLE_ARENA=
FANTASY_CONTEST=
SIGNAL_MARKETPLACE=
```

and matching frontend keys:

```env
VITE_MARKET_FACTORY=
VITE_AMM_POOL=
VITE_PARLAY_ENGINE=
VITE_ORACLE_COUNCIL=
VITE_RESPONSIBLE_LIMITS=
VITE_EXCHANGE_BOOK=
VITE_AI_PASS=
VITE_CREATOR_VAULT=
VITE_RISK_GOVERNOR=
VITE_SHARED_LIQUIDITY_VAULT=
VITE_FORECAST_ARENA=
VITE_REPUTATION=
VITE_LEAGUE_FACTORY=
VITE_BET_SLIP_NFT=
VITE_SOCIAL_MARKET=
VITE_BATTLE_ARENA=
VITE_FANTASY_CONTEST=
VITE_SIGNAL_MARKETPLACE=
```

## 7. Deployment Readiness Checks

After copying addresses:

```bash
npm run deploy:check
npm run deploy:check:rpc
npm run deploy:map
```

What these do:

- Validate `TESTNET_ONLY`.
- Reject real-money mode.
- Validate chain ID `10143`.
- Validate `DEPLOYMENT_BLOCK`.
- Validate all server/frontend address pairs.
- Detect duplicate contract addresses.
- Confirm RPC chain ID.
- Confirm bytecode exists at configured addresses.
- Write `packages/contracts/deployments/monad-testnet.json`.

## 8. Seed Demo Markets

```bash
cd packages/contracts
forge script script/Seed.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

Seed script targets:

- BTC market.
- Cricket market.
- Monad ecosystem market.
- AI Arena market.
- Optional social milestone market.
- Optional points-only league.
- Optional synthetic DFS contest.
- Optional LP vault deposit.

After seeding, confirm:

```env
VITE_MARKET_ID_MAP=101:1,102:2,103:3,109:4
VITE_SEEDED_SOCIAL_MARKET_ID=1
VITE_SEEDED_LEAGUE_ID=1
VITE_SEEDED_CONTEST_ID=1
```

Adjust IDs if the seed output differs.

## 9. Enable Live Writes

Only after deployment checks pass:

```env
VITE_ENABLE_CONTRACT_WRITES=true
```

Keep:

```env
VITE_ENABLE_DEMO_FALLBACK=true
```

This lets judges continue the demo even if wallet funding or RPC latency slows down.

## 10. Start Services

Frontend:

```bash
npm run dev
```

Matcher:

```bash
npm run matcher:dev
```

Indexer:

```bash
npm run indexer:dev
```

Production-like matcher build:

```bash
npm run matcher:build
npm --workspace packages/matcher run start
```

Production-like indexer build:

```bash
npm run indexer:build
npm --workspace packages/indexer run start
```

## 11. Runtime Health Checks

Frontend:

```bash
curl -fsS http://127.0.0.1:5173/
```

Matcher:

```bash
curl -fsS http://127.0.0.1:8787/health
curl -fsS http://127.0.0.1:8787/api/crypto/markets
npm run matcher:smoke
```

Expected crypto feed modes:

- `LIVE_API`: matcher refreshed CoinMarketCap successfully.
- `CACHE`: matcher is inside the daily/hourly cache window or serving previous data after a CMC failure.
- `FALLBACK`: no usable key/cache exists, so deterministic crypto markets are active.

If `warnings` contains an OHLCV plan message, price, market cap, and volume are still live. UTC high/low markets will be labeled quote-backed or `PLAN_GATED`.

Indexer:

```bash
curl -fsS http://127.0.0.1:42069/api/health
curl -fsS "http://127.0.0.1:42069/api/dashboard?address=0x0000000000000000000000000000000000000001"
curl -fsS http://127.0.0.1:42069/api/markets
```

## 12. Browser Acceptance Flow

Use desktop and mobile widths.

Desktop:

- Width: 1440 px.
- Confirm splash fades in 0.3 seconds.
- Confirm no overlay blocks interaction.
- Confirm topbar has menu, search, wallet, block, indexed/fallback badge.
- Open all-sections menu.
- Confirm translucent backdrop and panel.
- Confirm all tabs are reachable.
- Confirm no console errors.

Mobile:

- Width: 390 px.
- Confirm no horizontal overflow.
- Confirm topbar wraps cleanly.
- Confirm market cards and filters fit.
- Confirm menu remains usable.
- Confirm no console errors.

## 13. Judge Script

1. Open app.
2. State: "This is testnet-only. Test MON has no monetary value."
3. Show Monad block and wallet network.
4. Show indexed/fallback badge.
5. Open All Sections menu.
6. Open Arena.
7. Search or select BTC market.
8. Buy YES with 1 MON.
9. Add market to parlay.
10. Add second leg.
11. Mint parlay NFT.
12. Open Portfolio.
13. Quote cashout.
14. Ask AI for hedge.
15. Open Pro Exchange.
16. Preview AMM/CLOB route.
17. Submit/cancel signed order.
18. Open Agents.
19. Submit forecast and show Brier leaderboard.
20. Open Oracle Court.
21. Commit, reveal, challenge, finalize.
22. Open LP Dashboard.
23. Deposit, queue withdrawal, approve rebalance.
24. Open Creator Studio.
25. Run AI market quality review.
26. Open Pricing.
27. Explain AI pass business model.
28. Return to Monad cockpit.
29. Show indexed event freshness or explicit demo fallback.

## 14. Troubleshooting

### Frontend shows fixture fallback

Likely causes:

- `VITE_INDEXER_URL` is absent.
- Ponder is not running.
- No deployed contracts are indexed yet.
- Address map is missing.

This is safe. The app intentionally preserves the demo path.

### Ponder says `/health` is reserved

Use ArenaX health endpoint:

```bash
curl http://127.0.0.1:42069/api/health
```

Ponder's own internal health endpoint remains `/health`.

### Ponder says schema was used by another app

Use a fresh schema:

```bash
DATABASE_SCHEMA=arenax_demo_2 npm run indexer:dev
```

or drop the old local schema.

### Deploy check fails with empty addresses

Correct before deployment. Use:

```bash
npm run deploy:check:local
```

for local fixture validation. Use strict `npm run deploy:check` only after deployment.

### Matcher smoke fails

Confirm matcher is running:

```bash
npm run matcher:dev
curl http://127.0.0.1:8787/health
```

Then:

```bash
npm run matcher:smoke
```

### Wallet is on the wrong chain

Use the Monad cockpit network switch button. Expected chain:

```text
10143
```

### AI is not using a hosted model

Expected if `OPENAI_API_KEY` is missing. The fallback is deterministic and judge-safe.

### CMC OHLCV is plan-gated

Expected on low-cost CMC plans. The app still generates live price-close and 24h-volume markets from quotes. Day-high markets stay visible and disclose that high/low came from quote-backed targets instead of OHLCV.

### CMC quota is limited

Keep `CMC_REFRESH_MODE=TWELVE_HOURLY` for the live board, or switch to `DAILY` if credits are tight. Use `CMC_FINAL_REFRESH_FROM` for the final judging window or temporarily set `CMC_REFRESH_MODE=HOURLY` for one rehearsal. Manual `?force=1` refresh requires `ADMIN_SECRET`.

## 15. Release Checklist

Before final demo:

- `npm install` complete.
- `.env` present.
- `npm run verify` passes.
- `npm run matcher:smoke` passes.
- `npm run deploy:check:rpc` passes after deployment.
- `npm run deploy:map` generated final address map.
- Frontend opens.
- Matcher health is OK.
- `/api/crypto/markets` returns `LIVE_API` or `CACHE`.
- CMC key is present only in server-side `.env`.
- CMC refresh mode is `TWELVE_HOURLY`, `DAILY`, or `FINAL_HOURLY` only during the final window.
- Indexer health is OK.
- Wallet connects to Monad testnet.
- Demo fallback remains enabled.
- Real-money mode remains disabled.
- Browser desktop QA passes.
- Browser mobile QA passes.
- Judge route rehearsed once.
