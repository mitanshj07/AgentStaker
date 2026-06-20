# Monad ArenaX: Easy Team Explanation And Hackathon Notes

Last updated: 2026-06-17

## 1. One Line Explanation

Monad ArenaX is a testnet-only prediction market app built on Monad where users can discover markets, buy YES or NO shares, create parlay NFT slips, use AI for advice, settle results through an oracle flow, and track everything through frontend, backend, indexer, and smart contracts.

In very simple words:

> ArenaX is like a sports and crypto prediction app, but built for Monad testnet with smart contracts, AI helpers, NFT slips, and safety limits.

## 2. The Main Idea

People like predicting outcomes:

- Will BTC close above a price?
- Will a team win?
- Will a Monad project launch before a deadline?
- Will an AI agent rank in the top three?
- Will a creator hit a social media milestone?

Monad ArenaX turns these questions into markets.

For every market, the user can choose:

- `YES`: I think the event will happen.
- `NO`: I think the event will not happen.

The app then shows:

- The current probability.
- The odds.
- The stake in test MON.
- The possible payout.
- The risk warning.
- The settlement path.

The project is not a real-money app. It is made for Monad testnet and hackathon demo use.

## 3. Why This Project Exists

The project shows how Monad can support a fast prediction exchange experience.

It combines many things in one product:

- A consumer-style market board.
- AMM-based YES/NO trading.
- A pro exchange with signed orders.
- Parlay NFTs.
- AI forecast and risk tools.
- Oracle settlement and disputes.
- LP liquidity tools.
- Creator market creation.
- Responsible usage limits.
- Indexing through Ponder.
- Testnet wallet and RPC integration.

The hackathon story is:

1. A user opens the app.
2. They discover a prediction market.
3. They buy YES or NO.
4. They add markets into a parlay.
5. The parlay becomes an NFT slip.
6. AI explains risk and hedge options.
7. The market result goes through Oracle Court.
8. The user can cash out, claim, or inspect the indexed event trail.

## 4. Important Safety Point

ArenaX is testnet-only.

- It uses Monad testnet.
- Test MON has no real-world value.
- Real-money mode is disabled.
- Contract writes are disabled by default.
- Demo fallback mode is enabled.
- AI only gives advice.
- The matcher does not custody funds.
- Wallet signatures are required for value-moving actions.

This is important for judging because it shows that the project is serious about safety and compliance.

## 5. Chain Information

| Item | Value |
| --- | --- |
| Network | Monad testnet |
| Chain ID | `10143` |
| RPC | `https://testnet-rpc.monad.xyz` |
| Token | `MON` |
| Explorer | `https://testnet.monadexplorer.com` |
| App mode | `TESTNET_ONLY` |

## 6. Repository Structure

```text
.
+-- packages
|   +-- frontend      React and Vite user interface
|   +-- matcher       Backend service for signed orders, routing, AI, and crypto feed
|   +-- indexer       Ponder indexer with REST and GraphQL APIs
|   +-- contracts     Solidity smart contracts written for Foundry
+-- docs              Documentation, architecture files, and runbooks
+-- tools             Deployment and address checking scripts
+-- README.md         Main project overview
+-- HACKATHON_DEMO.md Judge demo guide
+-- WORKFLOW.md       Workflow and architecture companion
```

## 7. Main Technologies Used

| Layer | Technology | Why It Is Used |
| --- | --- | --- |
| Frontend | React | Builds the interactive app screens. |
| Frontend tooling | Vite | Fast local development and production build. |
| Language | TypeScript | Safer frontend and backend code. |
| UI icons | Lucide React | Clean icons for app controls. |
| Smart contracts | Solidity | On-chain logic for markets, parlays, oracle, vaults, and more. |
| Contract framework | Foundry | Build, test, and deploy Solidity contracts. |
| Backend matcher | Fastify style Node service | Handles signed orders, routing, AI endpoints, and crypto feed. |
| Indexer | Ponder | Reads Monad contract events and creates API-ready data. |
| Database | Postgres or PGlite through Ponder | Stores indexed contract events and read models. |
| Wallet/RPC | Monad testnet RPC | Reads blocks, sends transactions, checks chain state. |
| Crypto data | CoinMarketCap API | Optional live crypto market generation. |
| AI | Advisory endpoints | Gives forecast, risk, hedge, and market quality suggestions. |

## 8. User Journey In Simple Words

### Step 1: Open The App (Default landing page)

The user lands in the ArenaX Agent Ecosystem view. The app shows the live block status, indexer sync, and safety disclaimers, while defaulting to the AI Agents view rather than manual trading.

What works:
- Splash screen auto-fade.
- Leaderboard displaying active core and custom agents.
- Agent rank badges (🥇🥈🥉 #4), strategy summaries, Brier scores, win rates, and streaks.
- Last prediction reasoning tooltips.
- API provider status badge (AI LIVE / DETERMINISTIC FALLBACK).

### Step 2: Deploy a Custom Agent (Agent Studio)

The user can dynamically customize and spawn their own prediction AI agent using a natural language description.

Example:
- User prompt: "A cautious macro economist who only forecasts when volatility is extremely low."
- Backend routes to Gemini, generating a creative name, descriptive emoji, strategy description, and specialized system prompt.
- The custom agent immediately deploys onto the live leaderboard and joins consensus tournaments.

What works:
- Natural language input form.
- Live Gemini 2.0 dynamic persona generation or robust fallback layout.
- Leaderboard auto-wrapping to scale for custom agents.

### Step 3: Run Consensus Forecast Tournament

The operator triggers a parallel consensus forecast across all active agents.

What works:
- Selecting a market and clicking "Run Tournament Round".
- Step-by-step state animations: IDLE -> ANALYZING -> COMMITTING -> COMPLETE.
- Parallel calling of the Gemini API or fallback using each agent's system prompt.
- Outputting predictions, detailed reasonings, key factors, risk warnings, and consensus probabilities.
- Logging the history of each agent for post-settlement Brier score tracking.

### Step 4: Browse Markets

The user switches to the Explore Markets tab to inspect available categories.

What works:
- Category filters: Crypto, Sports, Cricket, Esports, AI Arena.
- Search and sorting (Trending, Live, Closing, New).
- Probability metrics, odds, volume, and AI quality scores.
- Live CMC price quotes, 24h volume, and quota-safe caching.

### Step 5: Buy YES Or NO Outcome Shares

The user buys YES/NO shares for a selected market outcome.

What works:
- Transparent purchase ticket (stake slider, presets, return estimate, limits check).
- Transaction timeline (Wallet signing -> Proposed -> Finalized).
- Local state odds movement (fallback) or live testnet transactions.

### Step 6: Create A Parlay NFT

A parlay combines multiple predictions into one position to leverage the odds.

What works:
- Adding 2-5 legs to the parlay rail.
- Combined odds and implied probability calculations.
- Minting the parlay as a transferable ERC-721 NFT (demo or on-chain `ParlayEngine.sol`).

### Step 7: View My Slips

The user inspects shareable slip NFT cards displaying gameplay stats.

What works:
- Reading owned slip cards from the wallet (`BetSlipNFT.sol`).
- Generating on-chain SVG graphics, stats (Power, Defense, Speed, Luck), leg listings, and rarity (based on the entry odds).

### Step 8: Use Portfolio

The user monitors active positions and claims resolved payouts.

What works:
- Open shares and parlay NFTs.
- Early cashout quotes with slippage protection.
- AI risk commentary (explanation of holding vs. cashing out) and advisory hedge routes.
- Pull-based claims for finalized winnings.

### Step 9: Use Pro Exchange

Advanced traders place limit orders on a central limit order book.

What works:
- Limit bids and asks (BACK and LAY).
- Signed EIP-712 orders (`GTC`, `GTD`, `IOC`, `FOK`, `FAK`, `POST_ONLY`).
- Matcher validation and reservation matching (non-custodial).
- On-chain signature verification and settlement in `ExchangeBook.sol`.
- Smart routing showing AMM/CLOB liquidity splits.

### Step 10: Use Oracle Court

Completed prediction markets are resolved through a multi-stage oracle.

What works:
- Commit-reveal cycle (Council commits outcome hash, then reveals result and salt).
- Challenge window with challenge bonds to dispute results.
- Council resolution and slashing simulation.
- Event tracking via Ponder indexer.

### Step 11: Use LP Dashboard

LP means liquidity provider.

In simple words:

> LPs provide test MON liquidity so markets can have smoother trading.

What works:

- Deposit 2 MON into the vault.
- Queue withdrawal.
- Process withdrawal.
- View idle liquidity.
- View deployed liquidity.
- View queued exit.
- Run LP AI rebalance.
- Approve owner rebalance.

### Step 12: Use Creator Studio

Creator Studio lets a creator create a new prediction market.

What works:

- Enter a market question.
- Run AI quality review.
- Check duplicate risk.
- Check manipulation risk.
- Create a testnet market.
- Seed AMM pool.
- Track creator revenue.

### Step 13: Use Risk Governor

Risk Governor shows how AI-generated risk actions can be controlled.

What works:

- Simulate risk.
- Create risk proposal.
- Review drawdown, correlation, and VaR.
- Require user approval.
- Execute only after approval.

### Step 14: Use Responsible Limits

This is the safety section.

What works:

- Daily usage limit.
- Points-only mode.
- Cooldown.
- Self-exclusion.
- Spend tracking.
- Limit remaining.

This is important because prediction markets can be risky. ArenaX shows responsible design from the start.

### Step 15: Use Monad Testnet Cockpit

This screen proves the app is connected to Monad testnet.

What works:

- Live block number.
- RPC latency.
- Chain ID.
- Wallet connect.
- Add or switch Monad testnet.
- Faucet link.
- Explorer link.
- 0 MON heartbeat transaction.
- Contract address summary.

## 9. Feature List With Simple Explanations

| Feature | Simple Meaning | What It Demonstrates |
| --- | --- | --- |
| Arena | Easy market board | Users can browse and trade prediction markets. |
| Market ticker | Moving market summary | App feels live and exchange-like. |
| Command palette | Fast navigation | Judges can jump to any module quickly. |
| Wallet pill | Wallet state | Shows demo wallet or connected address. |
| Monad badge | Chain status | Shows live Monad block status. |
| Indexer badge | Data sync status | Shows Ponder live or fallback mode. |
| CMC badge | Crypto data status | Shows live, cache, disabled, or fallback crypto feed. |
| Parlay rail | Multi-market slip | Combines predictions into one NFT slip. |
| My Slips | NFT card locker | Shows shareable `BetSlipNFT` cards. |
| Social markets | Creator milestones | Predict YouTube or X-style milestones. |
| Battles | Points-only card battles | Uses slip cards for non-monetary gameplay. |
| DFS | Synthetic fantasy contest | Points-only lineup locking and scoring. |
| Pro Exchange | Advanced orderbook | Signed order trading with CLOB-style controls. |
| Portfolio | User positions | Cashout, claim, hedge, and settle positions. |
| Oracle Court | Result settlement | Commit, reveal, challenge, and finalize results. |
| Agent Ecosystem | Autonomous AI Arena | Leaderboard, custom Agent Studio, consensus tournaments. |
| LP Dashboard | Liquidity management | Vault deposits, withdrawals, and rebalancing. |
| Creator Studio | Market creation | AI-reviewed market drafting and creator economics. |
| AI Passes | Business model | Free, Pro, Creator, LP, and Institutional tiers. |
| Limits | Responsible use | Caps, cooldowns, and points-only mode. |
| Profile | User cockpit | Activity, credits, signals, badges, and agent session. |

## 10. What Works In Demo Mode

Demo mode is important because hackathon judging can be unpredictable. Wallets, faucets, RPCs, and testnet deployments can fail at the worst time.

ArenaX keeps the full journey usable through deterministic fallback data.

Works without live deployment:

- Browse markets.
- Search and filter markets.
- Buy demo YES/NO shares.
- Add parlay legs.
- Mint demo parlay NFT.
- Quote cashout.
- Use AI fallback advice.
- Preview Pro Exchange route.
- Place demo orders.
- Cancel demo orders.
- Advance Oracle Court state.
- Deposit and withdraw in LP demo state.
- Run creator market quality review.
- Create demo creator market.
- Use responsible limits.
- Show pricing tiers.
- Show profile, signals, and activity.

Works when live services are configured:

- Monad RPC status.
- Wallet connection.
- 0 MON heartbeat.
- Contract writes.
- Ponder indexed data.
- Matcher signed orders.
- Websocket snapshots.
- CoinMarketCap live crypto market feed.
- On-chain slip reads.

## 11. Frontend Architecture

Frontend path:

```text
packages/frontend
```

Main files:

| File | Purpose |
| --- | --- |
| `src/App.tsx` | Main app layout, navigation, and screen routing. |
| `src/store/AppContext.tsx` | Main state store and feature actions. |
| `src/types.ts` | Shared TypeScript types for markets, orders, parlays, forecasts, and more. |
| `src/services/api.ts` | Talks to matcher service and AI endpoints. |
| `src/services/indexer.ts` | Talks to Ponder indexer. |
| `src/lib/monad.ts` | Monad testnet configuration, wallet helpers, RPC checks. |
| `src/lib/contractWrites.ts` | Contract write helpers. |
| `src/features/advanced.tsx` | Pro Exchange, Portfolio, Oracle, Agents, Liquidity, Creator Studio. |
| `src/features/consumer.tsx` | Slips, Social, Battles, DFS, Profile. |
| `src/components/features` | Core UI panels like Arena, Limits, Pricing, Governor, MonadPanel. |

Main frontend idea:

- React renders the product screens.
- `AppContext` stores the app state.
- The UI can use local demo state.
- If services are configured, it hydrates from matcher, indexer, and contracts.
- If services fail, the demo still works.

## 12. Backend Matcher

Matcher path:

```text
packages/matcher
```

The matcher is a backend service.

Simple explanation:

> The matcher helps with advanced trading. It accepts signed orders, checks them, gives route quotes, streams orderbook updates, serves AI advice, and provides live crypto markets.

Main responsibilities:

- Accept EIP-712 signed orders.
- Validate order fields.
- Reject expired orders.
- Reject duplicate nonces.
- Enforce order types.
- Keep in-memory demo reservations.
- Cancel unsafe orders.
- Return orderbook snapshots.
- Give smart route quotes.
- Serve AI advisory endpoints.
- Serve CoinMarketCap crypto market feed.
- Keep CMC API key on the server only.

Important matcher endpoints:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Checks service health and config. |
| `GET /api/crypto/markets` | Returns live, cached, or fallback crypto markets. |
| `POST /orders` | Accepts a signed order preview. |
| `POST /orders/cancel` | Cancels a demo/signed order. |
| `GET /orderbook/:marketId` | Returns orderbook data for a market. |
| `GET /portfolio/:address` | Returns matcher-side portfolio state. |
| `POST /route/quote` | Returns AMM/CLOB route preview. |
| `POST /ai/parlay-risk` | Gives parlay risk advice. |
| `POST /ai/hedge` | Gives hedge advice. |
| `POST /ai/forecast` | Gives forecast advice. |
| `POST /ai/lp-rebalance` | Gives LP rebalance advice. |
| `POST /ai/check-market` | Reviews creator market quality. |

## 13. Indexer

Indexer path:

```text
packages/indexer
```

Simple explanation:

> The indexer listens to smart contract events and turns them into easy API data for the frontend.

Why it is needed:

- Smart contract events are raw blockchain data.
- The frontend needs clean data.
- Ponder reads events and builds a dashboard-ready view.

Indexer APIs:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Indexer health check. |
| `GET /api/dashboard?address=0x...` | Main dashboard data for frontend. |
| `GET /api/markets` | Indexed market list. |
| `/graphql` | GraphQL access for deeper queries. |

The frontend polls dashboard data every 12 seconds when indexer URL is configured.

## 14. Smart Contracts

Contracts path:

```text
packages/contracts/src
```

The contracts are the on-chain rules of ArenaX.

| Contract | Easy Explanation |
| --- | --- |
| `MarketFactory.sol` | Creates and manages prediction markets. |
| `AMMPool.sol` | Lets users buy and sell YES/NO outcome shares using AMM liquidity. |
| `ExchangeBook.sol` | Handles signed order settlement, deposits, withdrawals, fills, and cancels. |
| `ParlayEngine.sol` | Creates parlay positions as ERC-721 NFTs and handles cashout/claim logic. |
| `OracleCouncil.sol` | Handles result commit, reveal, challenge, and finalization. |
| `ForecastArena.sol` | Lets agents commit/reveal forecasts and get scored. |
| `SharedLiquidityVault.sol` | Lets LPs deposit test MON and allocate liquidity to markets. |
| `CreatorVault.sol` | Tracks creator fees, referral fees, and protocol fees. |
| `AIPass.sol` | Manages AI subscription tiers and credits. |
| `ResponsibleLimits.sol` | Stores daily limits, exposure limits, points-only mode, and self-exclusion. |
| `RiskGovernor.sol` | Controls AI-style risk proposals with approval before execution. |
| `Reputation.sol` | Tracks XP, badges, and reputation signals. |
| `LeagueFactory.sol` | Creates points-only leagues. |
| `BetSlipNFT.sol` | Creates shareable NFT-style slip cards. |
| `SocialMarket.sol` | Creates social milestone markets. |
| `BattleArena.sol` | Runs points-only slip card battles. |
| `FantasyContest.sol` | Runs synthetic DFS contests. |
| `AgentWallet.sol` | Provides capped ERC-1271 agent sessions. |
| `SignalMarketplace.sol` | Unlocks AI signal bundles using credits. |

## 15. Contract Flow: Basic To Advanced

### Basic Market Flow

1. `MarketFactory` creates a market.
2. `AMMPool` receives liquidity.
3. User buys YES or NO.
4. Trade event is emitted.
5. `OracleCouncil` settles final result.
6. Winner claims payout.
7. Ponder indexes the events.
8. Frontend shows updated data.

### Parlay Flow

1. User selects multiple market legs.
2. `ParlayEngine` mints an ERC-721 parlay NFT.
3. Each leg has outcome and odds.
4. The parlay has reserved liability.
5. User can request deterministic cashout.
6. If cashed out, payout is recorded.
7. If market settles, user can claim if parlay wins.

### Pro Exchange Flow

1. User prepares order in frontend.
2. User signs EIP-712 order.
3. Matcher verifies and accepts order.
4. Matcher can match against other orders.
5. `ExchangeBook` verifies signature on-chain.
6. Order fill event is emitted.
7. Ponder indexes the event.

### Oracle Flow

1. Oracle commits a hidden result hash.
2. Oracle reveals result and salt.
3. Anyone can challenge with a bond.
4. Council resolves if challenged.
5. Final result becomes official.
6. Markets and claims use the final result.

### AI Governance Flow

1. AI suggests a risk action.
2. Action becomes a proposal.
3. Policy checks drawdown, correlation, and value.
4. User approval is required.
5. Proposal can be executed after approval.

## 16. AI In The Project

The platform runs a dynamic **Agent-First Ecosystem** powered by Google Gemini (with deterministic fallbacks). AI agents act as autonomous predictors on the platform.

Key AI features include:

- **Agent Studio**: Spawns customized trading agents dynamically from natural language prompts (e.g. "astrology-based swing trader"). Gemini defines their strategy descriptions and custom system prompts.
- **Consensus Tournaments**: Coordinates parallel forecasting across all active core and user-spawned agents to output individual probabilities and an aggregate consensus.
- **Accuracy Tracking (Brier Scores)**: Ranks agents dynamically based on their actual forecasting precision over time.
- **Advisory Helpers**: Explains parlay correlation/drawdown risks, suggests portfolio hedge positions, checks creator market quality for duplicates/manipulation, and reviews LP vault rebalancings.

AI cannot:

- Move user funds or wallet balances without explicit signatures.
- Mutate smart contract state on Monad without operator signatures.
- Bypass responsible daily usage, exposure, or execution limits.

Presentation line:

> Our AI layer is advisory-first. It explains, recommends, and records reasoning, but the user signs every important action.

## 17. CoinMarketCap Crypto Feed

The matcher can create live crypto prediction markets using CoinMarketCap data.

Examples:

- Will BTC close above a generated target?
- Will ETH break today's high?
- Will SOL volume cross a threshold?
- Will a crypto asset's market cap stay above a target?

Important design:

- CMC key stays in backend `.env`.
- Browser never receives the key.
- Matcher caches results.
- Default refresh is every 12 hours.
- If CMC fails, cached or fallback markets are used.

Feed modes:

| Mode | Meaning |
| --- | --- |
| `LIVE_API` | Fresh CMC data was loaded. |
| `CACHE` | Cached CMC data is being used. |
| `FALLBACK` | Demo crypto data is being used. |
| `DISABLED` | Live crypto feed is off. |

## 18. Demo Fallback System

The fallback system is one of the strongest hackathon features.

Why:

- Judges may not have funded wallets.
- Testnet faucets may be slow.
- RPC may be unstable.
- Deployment addresses may be missing.
- API keys may be unavailable.

ArenaX still lets the judge see the full product.

The app clearly labels fallback mode so it does not pretend fake data is live.

Presentation line:

> The product is resilient. If live contracts or services are unavailable, the demo still shows the complete user journey while clearly marking fallback state.

## 19. Business Model

ArenaX includes AI Pass tiers.

| Tier | Target User | Value |
| --- | --- | --- |
| Free | Casual users | Basic explanations and simple AI help. |
| Pro | Active traders | Better forecasts, alerts, portfolio risk, backtesting. |
| Creator | Market creators | Market quality review, audience analytics, creator revenue tools. |
| LP | Liquidity providers | Pool risk, drawdown simulation, rebalance suggestions. |
| Institutional | Advanced teams | API access, monitoring, batch order tools, deeper risk controls. |

Other possible revenue sources:

- Creator fees.
- Referral fees.
- LP fees.
- Protocol fee split.
- Institutional API access.

All of this is represented in testnet mode only.

## 20. Commands For Team Members

Install dependencies:

```bash
npm install
```

Create local environment file:

```bash
cp .env.example .env
```

Start frontend demo:

```bash
npm run demo
```

Start frontend directly:

```bash
npm run dev
```

Run full verification:

```bash
npm run verify
```

Run contract tests:

```bash
npm run contracts:test
```

Start matcher:

```bash
npm run matcher:dev
```

Run matcher smoke test:

```bash
npm run matcher:smoke
```

Start indexer:

```bash
npm run indexer:dev
```

Check deployment config locally:

```bash
npm run deploy:check:local
```

Check live RPC deployment:

```bash
npm run deploy:check:rpc
```

## 21. Environment Variables To Know

| Variable | Meaning |
| --- | --- |
| `VITE_APP_MODE=TESTNET_ONLY` | App is locked to testnet mode. |
| `VITE_ENABLE_DEMO_FALLBACK=true` | Allows demo fallback flows. |
| `VITE_ENABLE_REAL_MONEY=false` | Real-money mode is disabled. |
| `VITE_ENABLE_CONTRACT_WRITES=false` | Contract writes are off by default. |
| `VITE_MONAD_RPC_URL` | Monad testnet RPC used by frontend. |
| `VITE_MATCHER_URL` | Matcher service URL. |
| `VITE_INDEXER_URL` | Ponder indexer URL. |
| `VITE_ENABLE_LIVE_CRYPTO=true` | Enables CMC crypto feed if matcher is ready. |
| `CMC_PRO_API_KEY` | Server-side CoinMarketCap API key. |
| `OPENAI_API_KEY` | Optional AI provider key. |
| `MATCHER_PRIVATE_KEY` | Optional matcher signing key. |
| `DEPLOYER_PRIVATE_KEY` | Used only for contract deployment. |
| `DEPLOYMENT_BLOCK` | First block to index after deployment. |

Important:

- Do not expose `CMC_PRO_API_KEY` as a `VITE_` variable.
- Do not commit private keys.
- Keep real-money mode disabled for hackathon.

## 22. Testing And Verification

The main verification command is:

```bash
npm run verify
```

It checks:

- Frontend lint.
- Frontend production build.
- Matcher TypeScript build.
- Ponder indexer build/codegen.
- Foundry smart contract tests.

Contract tests live in:

```text
packages/contracts/test/ArenaX.t.sol
```

Deployment scripts live in:

```text
packages/contracts/script/Deploy.s.sol
packages/contracts/script/Seed.s.sol
```

## 23. Hackathon Demo Flow

Use this flow when presenting:

1. Start at Demo Runbook.
2. Show testnet-only safety banner.
3. Show Monad live block and RPC status.
4. Open Arena.
5. Pick a market.
6. Buy YES or NO with test MON.
7. Add two legs into parlay rail.
8. Mint parlay NFT.
9. Open My Slips and show NFT card.
10. Open Portfolio.
11. Quote cashout and show AI hedge advice.
12. Open Pro Exchange.
13. Preview smart route across AMM and CLOB.
14. Place or cancel an order.
15. Open AI Agents.
16. Run forecast tournament.
17. Open Oracle Court.
18. Commit, reveal, challenge, finalize.
19. Open LP Dashboard.
20. Deposit, queue withdrawal, run AI rebalance.
21. Open Creator Studio.
22. Run quality review and create market.
23. Open Limits and explain responsible design.
24. Open AI Passes and explain business model.

## 24. Short Presentation Notes

Use these as slide or speaking points.

### Problem

- Prediction markets are powerful but often feel complex.
- Users need simple discovery, transparent risk, and trustworthy settlement.
- On-chain apps also need good fallback UX for demos and real-world reliability.

### Solution

- ArenaX provides a testnet prediction exchange on Monad.
- Users can trade YES/NO markets, build parlay NFTs, and use AI risk tools.
- Oracle Court provides transparent settlement.
- Ponder indexing makes contract activity easy to read.

### Why Monad

- Fast user experience matters for markets.
- Prediction trading needs low-latency updates.
- Monad testnet lets us show wallet, transaction, and indexed event flows.

### Key Innovation

- One app combines AMM markets, pro exchange orders, parlay NFTs, AI advisors, oracle disputes, LP vaults, and responsible limits.
- AI is advisory and approval-based.
- Fallback mode keeps the hackathon demo complete even without live infrastructure.

### Safety

- Testnet-only.
- No real-money mode.
- No matcher custody.
- Wallet signatures required.
- Responsible limits built in.
- Points-only gameplay modules.

### Technical Depth

- React/Vite frontend.
- Solidity contracts with Foundry.
- Matcher for EIP-712 orders and AI APIs.
- Ponder indexer for REST and GraphQL.
- CoinMarketCap feed with server-side key and caching.
- Monad testnet RPC and wallet integration.

### Business Model

- AI Pass subscriptions.
- Creator fees.
- Referral fees.
- LP tools.
- Institutional APIs.

### Closing Line

> Monad ArenaX is a full-stack testnet prediction arena that shows trading, AI, NFTs, settlement, liquidity, and safety working together in one Monad-native experience.

## 25. Judge Questions And Simple Answers

### Is this real money?

No. It is testnet-only. Test MON has no real-world value, and real-money mode is disabled.

### What happens if contracts are not deployed?

The app uses demo fallback mode. The UI clearly labels fallback state while preserving the full product journey.

### Does AI place trades?

No. AI gives advice only. The user must approve and sign important actions.

### Why use NFTs?

Parlay positions and slip cards are easy to display, transfer, and use in game-like experiences. The NFT makes the position visible and shareable.

### Why have both AMM and Pro Exchange?

AMM is simple for normal users. Pro Exchange is better for advanced users who want limit orders, order types, and routing.

### Why have an indexer?

Smart contract events are hard for frontend users to read directly. Ponder turns those events into clean API data.

### What is Oracle Court?

It is the result settlement system. It commits, reveals, allows challenges, and finalizes market outcomes.

### What makes this more than a frontend demo?

The repo includes Solidity contracts, Foundry tests, matcher service, indexer service, deployment tools, live Monad RPC integration, and a frontend that can switch between fallback and configured live flows.

## 26. Simple Glossary

| Word | Meaning |
| --- | --- |
| Prediction market | A market where users predict whether an event will happen. |
| YES share | A position that wins if the event happens. |
| NO share | A position that wins if the event does not happen. |
| Odds | How much payout is possible compared to stake. |
| Probability | The market's estimated chance of an event. |
| Stake | The amount of test MON used in a position. |
| AMM | Automated market maker. It gives prices using pool liquidity. |
| CLOB | Central limit order book. Users place limit orders. |
| Parlay | A combined bet/prediction with multiple legs. |
| Leg | One market inside a parlay. |
| Oracle | A system that reports the final result. |
| Challenge bond | Amount posted to challenge a result. |
| LP | Liquidity provider. |
| Vault | Contract where LP liquidity is pooled. |
| Indexer | Service that reads blockchain events and makes them easy to query. |
| EIP-712 | A standard for readable wallet signatures. |
| ERC-721 | NFT token standard. |
| ERC-1271 | Smart contract signature validation standard. |
| Brier score | A score for forecast accuracy. Lower is better. |
| Fallback mode | Demo mode used when live services are missing. |

## 27. What To Emphasize During Demo

- This is not just UI. It has contracts, backend, indexer, and deployment checks.
- The app is built around a complete user journey.
- The safety model is visible in the product.
- AI is useful but controlled.
- Monad testnet is part of the actual UX.
- The fallback system protects the demo from infrastructure issues.
- The project has a path from hackathon demo to production architecture.

## 28. Final Team Summary

Monad ArenaX is a full-stack Monad testnet prediction arena.

At the simple level, users predict outcomes and trade YES/NO.

At the medium level, users can create parlay NFTs, get AI risk help, settle markets through Oracle Court, and manage liquidity.

At the advanced level, the system includes EIP-712 signed orders, AMM/CLOB routing, Ponder indexing, AI task ledgers, smart contract modules, responsible limits, and deployment validation.

The best way to explain it in a hackathon:

> We built a Monad-native prediction exchange where a user can go from market discovery to trading, parlay NFT creation, AI risk advice, oracle settlement, and indexed claim flow, all in one testnet-safe product.
