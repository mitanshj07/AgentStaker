# Monad ArenaX — Comprehensive System Audit

This document is a complete, line-by-line architectural and security audit of the Monad ArenaX prediction market platform, covering the Smart Contracts, Backend Services, and Frontend Application.

---

## 1. Smart Contract Audit (`packages/contracts`)

The system comprises 13 Solidity contracts deployed on the Monad testnet (chainId 10143) using Foundry. 

### Critical Security Vulnerabilities
- **AMMPool Reentrancy:** `sell()` and `removeLiquidity()` transfer ETH without reentrancy guards before/after updating state. A malicious contract could reenter and drain funds.
- **AMMPool Insolvency Risk:** `redeem()` pays 1:1 shares-to-ETH but does not verify if the pool holds sufficient balance. Late redeemers could be left with nothing if the pool math leaks value.
- **ExchangeBook Underflow:** The calculation `uint256 takerCost = fillSize - cost` in `fillOrder` reverts on underflow when prices are > 0.5e18. This effectively breaks matching for half the order book.
- **OracleCouncil Sybil Risk:** `commitResult` requires no bond. Malicious actors can commit bogus results at zero cost, forcing legitimate users to challenge and lock up capital.
- **ParlayEngine Odds Spoofing:** `createParlay` accepts user-supplied `oddsAtTime` without verifying them against the actual `AMMPool`. Users can inflate odds to guarantee massive payouts.

### Architectural Flaws & Missing Features
- **Centralization Risks:** The `MarketFactory` operator, `OracleCouncil` council, and `ExchangeBook` matcher are all single addresses with absolute power. No multisig or decentralized governance is implemented.
- **Upgradeability:** All contracts are deployed immutably. There is no UUPS or Transparent Proxy pattern to allow for bug fixes or iterative upgrades.
- **Responsible Limits:** By default, all limits are zero (which the contract interprets as "no limit"). Meaning users have zero protection unless they actively opt-in to set limits.
- **Gas Inefficiencies:** Widespread use of dynamic strings (`string[] outcomes` in `Market`), un-packed structs (booleans and uint64s taking full 256-bit slots), and expensive O(n²) loops (duplicate leg check in `ParlayEngine`).

---

## 2. Backend Services Audit (`packages/matcher` & `packages/indexer`)

### Matcher Service (`server.ts`)
The Matcher is a monolithic Fastify service handling REST and WebSocket connections.

**Critical Issues:**
- **Zero Persistence:** All orders, capital reservations, and locked markets are stored in an in-memory `Map`. A server restart results in total data loss.
- **No Auth on Admin Routes:** The `/markets/:marketId/lock` endpoint has no authentication. Any user can lock any market and mass-cancel all orders.
- **Performance Bottleneck (O(n)):** The `matchingOrders()` function scans the *entire* in-memory order map, filters, and sorts. For a busy market, this O(n log n) operation per incoming order will severely lag the event loop.
- **Wide-Open CORS & Rate Limiting:** Only AI endpoints have rate limiting. The core order placement and cancellation endpoints are open to DoS attacks.

### Indexer Service (Ponder)
The Indexer uses Ponder to read on-chain events and expose a GraphQL API.

**Critical Issues:**
- **Configuration Bug:** In `ponder.config.ts`, `OracleCourt` uses `process.env.ORACLE_COUNCIL`. This copy-paste bug will cause it to index the wrong contract.
- **Unbounded Table Growth:** The `protocolEvents` table mixes 7+ different event types into one massive catch-all table. Query performance will degrade linearly over time.
- **Missing Deployment Block Optimization:** `startBlock` is not configured for production. Indexing will attempt to scan from genesis (or block 1), causing massive delays on fresh deployments.

---

## 3. Frontend Audit (`packages/frontend`)

The frontend is a Vite SPA built with React 19 and viem.

### Architectural & State Issues
- **God Component Monolith:** `App.tsx` is an unmaintainable 700+ line component managing 30+ `useState` hooks, 15+ handlers, and 7 inline sub-components. Every state change triggers a full re-render of the entire application.
- **No Smart Contract Integration:** Zero `readContract` or `writeContract` calls exist. The frontend is entirely a local-state prototype acting on hardcoded JSON seed data.
- **No Routing:** There is no URL router (like `react-router`). Navigation is handled via local state, meaning deep links, bookmarking, and browser back/forward buttons do not work.

### User Experience & Web3 UX
- **Raw EIP-1193 Injection:** Wallet connections rely on raw `window.ethereum` instead of a robust library like `wagmi`. It misses account change events, chain switching listeners, and support for modern wallets (WalletConnect, Coinbase Wallet).
- **Silent Failures:** The API wrapper (`services/api.ts`) catches errors and returns deterministic mock data silently. Users are never informed if an API request actually failed.
- **Missing Loading States:** There are no skeleton loaders, spinners, or pending transaction UI elements. Actions block the UI with zero feedback.

### Code Quality & Security
- **Loose TypeScript:** `strict: true` is disabled. Unsafe type assertions (`as T`) are used for network responses instead of runtime validation (like Zod).
- **Monolithic CSS:** `App.css` is over 1500 lines without CSS custom properties (variables) or standard design tokens.
- **SEO & Socials:** Missing Open Graph tags (`og:title`, `og:image`). Sharing markets on Twitter or Discord will not generate link previews. Since it's a client-side SPA, migrating to Next.js (SSR) is recommended for production.
