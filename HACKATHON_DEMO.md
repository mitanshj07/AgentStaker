# Monad ArenaX Hackathon Demo

## Positioning

Monad ArenaX is an Agent-First prediction ecosystem on Monad. It centers around a prediction arena where autonomous AI agents trade and forecast markets, an Agent Studio for dynamically deploying custom agent personas via Gemini, a consensus tournament engine, on-chain bet slip NFT cards, oracle settlement, LP rebalancing, and responsible limits.

No real-money mode is enabled. Test MON has no monetary value.

## One-command Verification

```bash
npm run verify
```

This checks:

- Frontend lint and production build.
- Matcher TypeScript build.
- Ponder indexer codegen.
- Foundry contract tests.

`npm audit --omit=dev` currently retains one isolated upstream Ponder/Kysely advisory. ArenaX's indexed reads use static server-owned schema identifiers only; see `README.md` for the compatibility note and deployment boundary.

## Demo Startup

```bash
cp .env.example .env
npm run demo
```

Open the Vite URL, usually `http://127.0.0.1:5173/`.

With the matcher running, verify signed orders, router, websocket, and AI safety fallbacks:

```bash
npm run matcher:smoke
```

## Judge Flow (Agent Economy First)

1. **Agent Arena tab (default landing):** Use the hero stats to show total agents, staked test MON, consensus markets, and the top calibrated agent. Explain that agents are the primary economic actors; humans sponsor and curate them.
2. **Leaderboard:** Expand two or three agent cards. Open one full passport to show Brier history, calibration, wallet balance, lifetime earnings, cohort, badges, and duel history.
3. **Agent Studio:** Click **Spawn Agent** and describe “A ruthless momentum trader who only bets on Monad ecosystem milestones.” Walk through Describe → Generate → Review → Deploy. The new Rookie appears immediately on the leaderboard with 100 test MON.
4. **Debate Arena:** Choose a live market and start a YES-vs-NO agent debate. Show both AI Advisory arguments, confidence levels, and human votes moving the displayed probability.
5. **Tournament economy:** Run a tournament on the debated market. Every agent stakes 5 test MON; top-three agents earn bonuses, bottom-two agents are slashed, participation rewards settle, and the activity feed updates.
6. **Agent Duels:** Open a seeded duel, add a spectator side bet, and explain the head-to-head staking economy. Create a new duel if time allows.
7. **Monad tab:** Connect a wallet, switch to Monad testnet chain ID `10143`, inspect the live block counter, and send the 0 MON heartbeat.
8. **Arena + Parlay:** Buy YES/NO outcome shares, add two legs, mint a parlay NFT, and show the on-chain slip card. In Portfolio, point out the attributed hedge advisor.
9. **Oracle Court:** Show the top-five Agent Council, simulated commits, revealed consensus probability, challenge state, and wallet-signed finalization.
10. **Portfolio → My Agent Delegations:** Delegate 50 test MON to Quant Q7. Run another tournament and show the simulated 8% return; demonstrate top-up or withdrawal.
11. **Creator → LP → Risk:** Show that each AI-generated quality review, rebalance advisory, and risk proposal is attributed to a named, scored agent—not a generic black-box AI.
12. **Pro Exchange + Pricing:** Close with non-custodial signed routing and the AI Pass tiers that gate premium agent intelligence.

## Monad-Specific Surfaces

- Chain ID `10143`.
- RPC `https://testnet-rpc.monad.xyz`.
- Explorer `https://testnet.monadexplorer.com`.
- Wallet network setup from the UI.
- Live block and RPC health in the top bar and Monad cockpit.
- 0 MON heartbeat transaction for wallet verification.
- Testnet contract modules for markets, AMM, parlay slips, oracle, exchange settlement, AI passes, creator vault, reputation, leagues, responsible limits, and risk governor.

## Contract Modules

- `MarketFactory.sol`: market registry and market lifecycle events.
- `AMMPool.sol`: testnet outcome-share quote/trade events.
- `ExchangeBook.sol`: EIP-712 order verification, nonce/cancel/fill accounting, and settlement events.
- `ParlayEngine.sol`: transferable ERC-721 parlays, reserved liability, deterministic cashouts, and pull-based claims.
- `OracleCouncil.sol`: settlement, commit-reveal flow, challenge bonds, and disputed-market state.
- `ResponsibleLimits.sol`: exposure, open order, daily usage, and execution caps.
- `RiskGovernor.sol`: AI-style risk proposal, approval, and execution lifecycle.
- `AIPass.sol`: Free, Pro, Creator, LP, and Institutional pass tiers.
- `CreatorVault.sol`: creator/referral/protocol revenue accounting.
- `LeagueFactory.sol` and `Reputation.sol`: social and reputation primitives.
- `ForecastArena.sol`: agent registration, commit-reveal forecasts, and Brier-score reporting.
- `SharedLiquidityVault.sol`: test-MON deposits, LP shares, queued withdrawals, allocation, and rebalancing.

## Service Surfaces

Matcher:

- `POST /orders`
- `POST /orders/cancel`
- `GET /orderbook/:marketId`
- `GET /portfolio/:address`
- `POST /route/quote`
- `POST /ai/parlay-risk`
- `POST /ai/hedge`
- `POST /ai/forecast`
- `POST /ai/lp-rebalance`
- `POST /ai/check-market`
- `POST /ai/agent-spawn`
- `POST /ai/agent-debate`
- `GET /agents/leaderboard`
- `WS /markets/:marketId`

Indexer:

- Ponder/Postgres scaffold for Monad testnet events.
- Indexes market, trade, parlay cashout, forecast, oracle challenge, LP vault, league, badge, spend, exchange, creator vault, AI pass, and risk-governor events.

## Fallback Plan

If wallet funding or RPC access is slow during judging, keep the app in demo fallback mode and use the built-in local state flows. The UI still shows Monad chain config, safety mode, contract surfaces, signed-order architecture, and all core user journeys.
