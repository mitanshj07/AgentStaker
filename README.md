# AgentStaker — Monad ArenaX

> An autonomous AI-agent economy for forecasting, staking, reputation, delegation, and governance on Monad testnet.

AgentStaker, powered by Monad ArenaX, is a hackathon-ready, testnet-only Agent-First Ecosystem. It centers around a prediction arena where autonomous AI agents trade and forecast markets, an Agent Studio for dynamically deploying custom agent personas, tournament consensus engines, on-chain bet slip NFT cards, oracle settlement, LP rebalancing, and responsible limits.

## Live demo

- Production app: [agent-staker.vercel.app](https://agent-staker.vercel.app)
- GitHub submission: [mitanshj07/AgentStaker](https://github.com/mitanshj07/AgentStaker)

The build is intentionally locked to Monad testnet. Test MON has no monetary value, no real-money mode is enabled, and the UI keeps legal/safety copy visible during the demo.

See [WORKFLOW.md](./WORKFLOW.md) for the full judge journey, architecture chart, signed exchange route, parlay cashout flow, oracle court, and AI safety boundary.

See [docs/ROADMAP_SYNTHESIS.md](./docs/ROADMAP_SYNTHESIS.md) for the consolidated implementation sequence derived from the final product blueprints.

## Final documentation pack

- [Easy team explanation and hackathon notes](./docs/PROJECT_EXPLAINED_FOR_TEAM.md)
- [Final project documentation](./docs/FINAL_DOCUMENTATION.md)
- [API and contract reference](./docs/API_CONTRACT_REFERENCE.md)
- [Testnet deployment and QA runbook](./docs/TESTNET_DEPLOYMENT_RUNBOOK.md)

## Architecture design pack

- [Polished Word architecture pack](./docs/Monad_ArenaX_Workflows_and_Architecture.docx)
- [Pastel translucent screen-share board](./docs/architecture-pack/index.html)
- [Editable Mermaid workflow companion](./docs/ARENAX_WORKFLOW_ARCHITECTURE.md)

## Monad testnet

- Chain ID: `10143`
- RPC: `https://testnet-rpc.monad.xyz`
- Native token: `MON`
- Explorer: `https://testnet.monadexplorer.com`

The frontend reads live Monad testnet RPC status, can request wallet network setup, and includes a 0 MON heartbeat transaction button for testnet-only wallet verification.

ArenaX is now configured for strict testnet transactions: `VITE_ENABLE_CONTRACT_WRITES=true` and `VITE_ENABLE_DEMO_FALLBACK=false`. Trading, LP, oracle, social, DFS, and parlay actions must either open a wallet-signed Monad testnet transaction or show the exact missing deployed contract/address. Real-money mode remains disabled.

## Final real-testnet deployment

Use a fresh funded Monad testnet deployer wallet. Do not use a wallet that holds anything valuable; test MON has no monetary value, but private keys are still sensitive.

```bash
# Add a funded testnet-only deployer key to .env.
DEPLOYER_PRIVATE_KEY=0x...

# Optional but recommended. If empty, Deploy.s.sol defaults council/matcher roles to the deployer.
COUNCIL_ADDRESS=0x...
MATCHER_ADDRESS=0x...

# Deploy contracts, import addresses into .env + packages/frontend/.env.local,
# then seed BTC/cricket/Monad/AI markets and AMM pools.
npm run deploy:testnet

# Confirm deployed bytecode and safety flags.
npm run deploy:check:rpc

# Restart the frontend so Vite reads the new VITE_* contract addresses.
npm --workspace packages/frontend run dev -- --host 0.0.0.0 --port 5174
```

After this, open `http://localhost:5174/` in Chrome, connect MetaMask on Monad testnet, and the Arena buy button, parlay mint, social bet, LP deposit, oracle court, creator market, and NFT/claim flows use wallet-signed testnet transactions.

## Live CoinMarketCap crypto markets

ArenaX can hydrate the Crypto category from CoinMarketCap without exposing the API key in the browser. The matcher owns the CMC calls, caches the result, and serves UI-ready prediction markets through `GET /api/crypto/markets`.

Key settings:

- `CMC_PRO_API_KEY`: server-side CoinMarketCap key. Never expose this as a `VITE_` variable.
- `CMC_ASSET_IDS`: comma-separated stable CMC ids. Defaults to BTC, ETH, SOL, BNB, XRP, DOGE, ADA, AVAX, LINK, TRX, DOT, LTC, BCH, HBAR, NEAR, APT, TON, SUI, UNI, and POL.
- `CMC_QUOTES_URL`: defaults to `https://pro-api.coinmarketcap.com/v3/cryptocurrency/quotes/latest`.
- `CMC_ENABLE_OHLCV=false`: keeps the live feed to one CMC quotes call. Set it to `true` only if your CMC plan supports `https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/latest` for current UTC high/low.
- `CMC_REFRESH_MODE=TWELVE_HOURLY`: one batched quote refresh every 12 hours for live hackathon operation.
- `CMC_REFRESH_MODE=DAILY`: optional lower-quota mode with one batched quote refresh per 24 hours.
- `CMC_FINAL_REFRESH_FROM=2026-06-06T09:00:00+05:30`: optional final-demo switch; once this timestamp passes, refresh becomes hourly.
- `CMC_REFRESH_MODE=HOURLY`: manual rehearsal override for hourly refresh.

The frontend flag is `VITE_ENABLE_LIVE_CRYPTO=true`. When matcher or CMC is unavailable, the UI keeps deterministic seed markets and clearly shows `CMC fallback` or `CMC cache`.

## Hackathon quick start

```bash
npm install
cp .env.example .env
npm run verify
npm run demo
```

Open the Vite URL printed by the dev server, usually `http://127.0.0.1:5173/`.

Judge demo path:

1. Agents tab (Default view): Explore the **Agent Ecosystem** dashboard. View the AI Leaderboard with active agents, their Brier scores, strategy descriptions, and recent predictions.
2. Agent Studio: Type a custom prompt (e.g., "A macro specialist who only forecasts on interest rates") to dynamically spawn a new AI agent with a custom system prompt and strategy, and watch it deploy onto the leaderboard.
3. Run Tournament: Run a consensus forecast tournament round for a market, watching the progression (Analyzing -> Committing -> Complete) as all active agents (including your custom spawned agent) call Gemini/fallback in parallel to reach an aggregate consensus probability.
4. Monad tab: Connect wallet, switch to Monad testnet, inspect live block and RPC latency, and send a 0 MON heartbeat transaction.
5. Arena tab: Browse prediction markets, preview YES/NO prices, buy outcome shares, and add legs to the parlay rail.
6. Parlay rail: Combine multiple predictions and mint a demo/live parlay NFT slip.
7. My Slips: Inspect shareable `BetSlipNFT` gameplay cards containing on-chain attributes and stats generated from the odds.
8. Portfolio tab: Quote a parlay cashout, request advisory AI hedge details, and claim winning payouts.
9. Pro Exchange tab: Preview AMM/CLOB smart routing and place or cancel signed limit orders.
10. Oracle Court: Commit, reveal, challenge, and finalize outcomes in a multi-stage settlement court.
11. LP tab: Deposit to the shared vault and review AI-driven rebalancing proposals.
12. Creator Studio: Draft markets, run AI quality reviews, and deploy creator-incentivized prediction pools.
13. Risk Governor: Review stress levels and approve AI-generated risk proposals.

## Run locally

```bash
npm install
npm run dev
```

The app runs on the Vite URL printed by the dev server.

## Verify

```bash
npm run verify
```

This runs frontend lint/build, matcher TypeScript build, Ponder codegen, and Foundry contract tests.

For the final hackathon pass, run the stricter one-command check:

```bash
npm run final:check
```

This runs frontend lint/build, matcher build, indexer codegen, Foundry build/tests, and the local deployment-readiness audit. A clean result with empty contract warnings means the app is ready and only the Monad testnet deployment map is still pending.

## Final-day deployment handoff

Keep the local app in strict testnet mode:

- `VITE_APP_MODE=TESTNET_ONLY`
- `VITE_ENABLE_REAL_MONEY=false`
- `VITE_ENABLE_CONTRACT_WRITES=true`
- `VITE_ENABLE_DEMO_FALLBACK=false`

Then choose one deployment path:

1. Fund a fresh Monad testnet deployer and add only its private key to local `.env` as `DEPLOYER_PRIVATE_KEY`.
2. Run `npm run deploy:testnet`.
3. Run `npm run deploy:check:rpc`.
4. Restart frontend on `http://localhost:5174/`.

Or, if contracts are deployed elsewhere, paste the deployed addresses into `.env` and `packages/frontend/.env.local`, set `DEPLOYMENT_BLOCK`, run `npm run deploy:map`, then run `npm run deploy:check:rpc`.

## Hackathon scope

- Seeded demo markets for live cricket, football, esports, crypto, Monad ecosystem, network milestones, and AI arena outcomes.
- Live CMC-backed crypto prediction markets for price close, UTC high breakout, UTC low breakdown, 24h volume, and market-cap thresholds with quota-safe caching.
- Sportsbook-style market board with league labels, live pulses, boosted fixtures, price movement, volume, `Trending`/`Live`/`Closing soon`/`New` filters, and review-first YES/NO quick picks.
- Transparent testnet ticket with stake presets, projected payout, responsible-limit checks, and Monad settlement label before the user signs.
- Logo-led translucent Monad ArenaX splash with a centered brand mark, a 0.3-second auto-fade, interaction-safe cleanup, and an exchange-style live market ticker.
- Buy YES/NO flow with odds movement in local state.
- Parlay slip builder with combined odds, implied probability, and risk warning.
- Pro exchange preview with GTC/GTD/IOC/FOK/FAK/Post-only orders, AMM/CLOB smart routing, cancel flow, depth, slippage, queue estimate, and tx timeline.
- **Agent Studio**: Natural language interface allowing users to dynamically spawn new trading agent personas using Gemini, which then persist in-memory, join the leaderboard, and participate in tournaments.
- **Forecast Arena & Consensus Tournaments**: A tournament engine that coordinates all active core and user-spawned agents to run parallel forecasts on markets, outputting individual predictions, reasoning, and aggregate consensus.
- **Agentic AI dashboards**: Advisory interfaces for parlay hedging, LP rebalancing, compliance copy review, and risk-governor task logs.
- Monad cockpit with live block, RPC latency, finality estimate, explorer/faucet links, wallet switch, and heartbeat tx.
- Search-driven command palette for instant dashboard and live-market navigation.
- Consumer-style market discovery with category filters, a saved-market watchlist, and visible demo-journey progress.
- Pricing/business model page with Free, Pro, Creator, LP, and Institutional AI pass tiers.
- Oracle dispute court with commit, reveal, challenge-bond, and council-finalization states.
- Portfolio ERC-721 parlay cashout, shared LP vault, creator studio, and responsible-limit summaries.
- Companion `BetSlipNFT` share cards, evidence-backed social markets, points-only battles, synthetic DFS contests, capped ERC-1271 CLOB sessions, and AIPass credit-gated signal bundles.
- Testnet/demo disclaimers built into the UI.

## Contract path

`packages/contracts/src` contains the implementation targets:

- `MarketFactory.sol`
- `ResponsibleLimits.sol`
- `AMMPool.sol`
- `ParlayEngine.sol`
- `OracleCouncil.sol`
- `Reputation.sol`
- `LeagueFactory.sol`
- `ExchangeBook.sol`
- `AIPass.sol`
- `CreatorVault.sol`
- `RiskGovernor.sol`
- `ForecastArena.sol`
- `SharedLiquidityVault.sol`
- `BetSlipNFT.sol`
- `SocialMarket.sol`
- `BattleArena.sol`
- `FantasyContest.sol`
- `AgentWallet.sol`
- `SignalMarketplace.sol`

## Contracts

```bash
cd packages/contracts
forge build
forge test -vvv
```

Deploy to Monad testnet:

```bash
npm run deploy:testnet
```

The wrapper broadcasts `Deploy.s.sol`, imports the Foundry broadcast addresses, writes `packages/contracts/deployments/monad-testnet.json`, and runs `Seed.s.sol` so mapped frontend markets have real on-chain markets and AMM pools.

## Production services

```bash
npm run matcher:build
npm run matcher:smoke
npm run indexer:build
npm run indexer:dev
npm run matcher:dev
```

The indexer is a Ponder/Postgres scaffold for Monad testnet events, including forecasts, oracle challenges, LP-vault accounting, cashouts, and risk-governor proposals. The matcher accepts EIP-712 signed orders, verifies signatures, exposes orderbook/portfolio, router, websocket, quota-safe CMC crypto market feeds, and advisory AI APIs, and never custodies user funds. Run `npm run matcher:smoke` while the matcher is live to verify signed order types, CMC feed mode/cache, cancelation, lock cleanup, router aliases, websocket snapshots, advisory-only AI, and rate limiting.

Ponder exposes:

- `GET /api/health`
- `GET /api/dashboard?address=0x...`
- `GET /api/markets`
- `/graphql`

The frontend polls `/api/dashboard` every 12 seconds. It visibly reports `Ponder live` when indexed data is available and keeps the fixture catalog active when Postgres, Ponder, or deployment addresses are not configured.

### Indexer dependency note

The indexer uses Ponder `0.16.6` with compatible patched overrides for Hono, Drizzle, and Vite. Ponder still imports Kysely `0.26.3`; newer patched Kysely releases remove an export Ponder currently requires. `npm audit --omit=dev` therefore reports the known upstream Kysely advisory through Ponder. ArenaX only builds indexed queries from static server-owned schema identifiers, never from request-provided SQL fragments. Keep Ponder behind the application API boundary and re-run the compatibility check when Ponder publishes a Kysely-compatible upgrade.

## Deployment readiness

```bash
cp .env.example .env
npm run deploy:check:local
npm run deploy:testnet
npm run deploy:check
npm run deploy:check:rpc
npm run deploy:map
```

`deploy:testnet` imports the address map automatically. `deploy:check` validates safety flags, chain ID, deployment block, all server/frontend address pairs, and duplicate addresses. `deploy:check:rpc` also confirms Monad testnet chain ID and deployed bytecode. `deploy:map` writes or refreshes the versioned `packages/contracts/deployments/monad-testnet.json` manifest used for the final handoff.

## Testnet safety flags

`.env.example` sets:

- `VITE_APP_MODE=TESTNET_ONLY`
- `VITE_ENABLE_DEMO_FALLBACK=false`
- `VITE_ENABLE_REAL_MONEY=false`
- `VITE_ENABLE_CONTRACT_WRITES=true`

Keep those defaults for the final testnet build. Re-enable `VITE_ENABLE_DEMO_FALLBACK=true` only for offline screenshots or non-transactional walkthroughs.
