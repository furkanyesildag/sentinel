# Sentinel — DeFi Risk Copilot for Stellar

[![CI](https://github.com/furkanyesildag/sentinel/actions/workflows/ci.yml/badge.svg)](https://github.com/furkanyesildag/sentinel/actions/workflows/ci.yml)
![Network](https://img.shields.io/badge/network-Stellar%20Testnet-7b61ff)
![Contracts](https://img.shields.io/badge/Soroban-3%20contracts-05a2c2)
![Tests](https://img.shields.io/badge/tests-44%20passing-3fd07f)

Borrowers on Blend Protocol can lose their collateral to liquidation without any warning. Sentinel fixes that.

It watches your lending positions on Blend, tells you how close you are to liquidation, and explains the risk in plain language so you actually understand what is happening and why. When you are ready for it, it can act on your behalf to protect you, but only with your explicit permission and only after a security audit. For now it reads, monitors, and explains.

This is not a yield vault. It is a risk layer for people who already have open borrow positions and want to stay informed before it is too late.

- **Live demo:** **https://son-fawn.vercel.app**
- **Demo video (1–2 min):** **▶️ https://youtu.be/gLwm4kT7ldg**

---

## Requirements checklist

### Level 4 — Production MVP + real users

| Requirement | Where |
|---|---|
| Production-ready MVP | 3 contracts + polished dashboard, live on Vercel |
| New on-chain functionality | `guardian` — opt-in, non-custodial liquidation protection ([`guardian/src/lib.rs`](contracts/guardian/src/lib.rs)) |
| Mobile responsive UI | [mobile screenshot](docs/screenshots/14-mobile-l4.png) |
| Loading + error states | skeletons · `classifyError` + `ErrorBanner` · `ErrorBoundary` |
| User onboarding | first-run guided overlay ([`Onboarding`](apps/web/src/components/Onboarding.tsx)) |
| Feedback collection | in-app feedback widget ([`FeedbackButton`](apps/web/src/components/FeedbackButton.tsx)) |
| Monitoring + analytics | Vercel Web Analytics + `/api/track` ([`api/track.ts`](api/track.ts)) + on-chain Network Activity dashboard ([screenshot](docs/screenshots/12-analytics.png)) |
| Proof of user wallet interactions | unique-wallet count read live from contract events ([`fetchActivityStats`](packages/core/src/contract.ts), [`ActivityPanel`](apps/web/src/components/ActivityPanel.tsx)) |
| Tests (contracts + frontend) | 16 Rust + 28 Vitest = **44** ([test output](docs/screenshots/09-test-output.png)) |
| Contract deployment address | `guardian` [`CCBOH4QO…MGTK`](https://stellar.expert/explorer/testnet/contract/CCBOH4QO4UQ5MR4EJV2VOWOGP3S5J2T5ZPXQHNXSJJKDTVYO7UKQMGTK) |
| Tx hash for contract interaction | `protect` [`ceb5b5e2…0bbf1`](https://stellar.expert/explorer/testnet/tx/ceb5b5e2a151207c8a690371bde61edbb6fc6678978114ace628532f2ef0bbf1) — released a 2 XLM reserve |

<details>
<summary><b>Level 3 — Advanced contracts + production-ready dApp</b></summary>

| Requirement | Where |
|---|---|
| Advanced smart contract | `risk_monitor` with risk classification + admin access control — [`risk_monitor/src/lib.rs`](contracts/risk_monitor/src/lib.rs) |
| **Inter-contract communication** | `risk_monitor.assess` → `alert_registry.get_threshold` via `env.invoke_contract` ([code](contracts/risk_monitor/src/lib.rs)) |
| Event streaming & real-time updates | `RiskAssessed` / `AlertTriggered` live feed — [`fetchRiskEvents`](packages/core/src/contract.ts), [`RiskMonitorPanel`](apps/web/src/components/RiskMonitorPanel.tsx) |
| CI/CD pipeline | GitHub Actions: fmt · clippy · cargo test · wasm build + pnpm test · build — [`ci.yml`](.github/workflows/ci.yml) |
| Smart-contract deployment workflow | [Deployment](#deployment) + [`contracts/deployments.json`](contracts/deployments.json) |
| Mobile responsive frontend | [mobile screenshot](docs/screenshots/06-mobile-dashboard.png) |
| Error handling & loading states | typed `classifyError` + `ErrorBanner` + `ErrorBoundary` + skeletons |
| Tests for contracts and frontend | 10 Rust + 24 Vitest = **34** ([test output](docs/screenshots/09-test-output.png)) |
| Production-ready architecture | pnpm monorepo · shared core package · config validation · error boundary |
| Documentation & demo | this README + screenshots + video |
| Contract deployment address | [`CCLHYNH4…GA5R`](https://stellar.expert/explorer/testnet/contract/CCLHYNH4GA6IDBNYHSZNKTXIVOPUIFBP3FP43UCCNRHR5RHDSLIQGA5R) |
| Tx hash for contract interaction | [`2d442bbf…cb438`](https://stellar.expert/explorer/testnet/tx/2d442bbfc26d539e039659084b95d9b39edf0efc93cb3144bb77d4cf893cb438) (cross-contract `assess`) |

</details>

<details>
<summary><b>Level 2 — multi-wallet, deployed contract, events</b></summary>

| Requirement | Where |
|---|---|
| Multi-wallet (Stellar Wallets Kit) | Freighter · xBull · Albedo — [`kit.ts`](apps/web/src/wallet/kit.ts), [screenshot](docs/screenshots/05-wallet-options.png) |
| Contract deployed on testnet | [`CAMPKYYY…PFNWV`](https://stellar.expert/explorer/testnet/contract/CAMPKYYYATXAZQDIPVDGVMPCP53A5BEQYXI3KIP3XO6S5AOUIB3PFNWV) |
| Contract called from the frontend | [`AlertRegistryPanel`](apps/web/src/components/AlertRegistryPanel.tsx) |
| Read & write contract data | [`readThreshold` / `buildSetThresholdTx`](packages/core/src/contract.ts) |
| Transaction status visible | [`TxProgress`](apps/web/src/components/TxProgress.tsx) |
| 3 error types handled | [`errors.ts`](packages/core/src/errors.ts) |
| Contract-call tx hash | [`c67251c0…727a`](https://stellar.expert/explorer/testnet/tx/c67251c00f47796851b382e2091aa306e64f80fa3e299b3b989856c6f826727a) |

</details>

---

## What it does

**Position monitoring.** Connects to your Stellar wallet and reads your Blend lending position via Soroban RPC. Collateral, borrowed amounts, supplied assets, pool market rates, all pulled directly from the chain without any custody.

**XLM balance display.** Fetches your native XLM balance from Horizon so you always know what you are working with.

**Transaction flow.** Full sign and submit pipeline: build a transaction, send it to your wallet for signing, broadcast it to the network, and confirm it on-chain. The transaction hash and a StellarExpert link are shown once confirmed.

**Alert threshold registry (live on testnet).** A deployed Soroban contract (`alert_registry`) stores per-user liquidation warning thresholds on-chain. Straight from the dashboard you can **read** your stored threshold (`get_threshold`, a free read-only simulation), **write** a new one (`set_threshold`, signed by your wallet with a live Build → Sign → Submit → Confirm tracker), and **remove** it. Every mutating call emits a typed `ThresholdSet` / `ThresholdRemoved` event that the UI streams into a live activity feed and re-reads after each write.

**Risk monitor (inter-contract).** A second deployed contract (`risk_monitor`) reads your threshold from `alert_registry` **cross-contract** and classifies your current health factor as Safe / Warning / Breached. Move the health-factor slider for a live, free, read-only assessment, or publish it on-chain to stream `RiskAssessed` / `AlertTriggered` events.

**AI Risk Copilot (in progress).** The plan is to pair the raw position data with an LLM and a RAG layer built on Blend's documentation and live oracle prices. Instead of showing a health factor number and leaving you to figure it out, the copilot explains it: "If XLM drops 12% from here, your position gets liquidated." That is the part that makes this different from a data dashboard.

**Liquidation guardian (live on testnet, opt-in).** A third deployed contract (`guardian`) turns the warning into action. You sign a protection policy and fund an XLM reserve held by the contract. When your health factor breaches the policy threshold, a permissionless `protect` call releases the reserve back to you so you can defend the position before liquidation. It is non-custodial by construction: the reserve can only ever move to you, never anywhere else, and a keeper can trigger protection but cannot redirect funds. (In production the trigger is oracle-backed and the protective action repays Blend directly; the MVP releases the reserve and proves the full policy / reserve / release cycle on-chain.)

**Network activity + analytics.** A built-in dashboard reads events from all three contracts and shows live on-chain usage: unique wallets, transactions, protections and a recent-interactions feed. The unique-wallet count is verifiable proof of real user interactions, straight from the chain.

---

## Why Blend

Blend is the largest lending protocol on Stellar, over $80M TVL as of early 2026, running on immutable Soroban contracts. Borrowers post collateral and take loans, and when their position deteriorates they get liquidated at a market premium, a direct loss. There is no friendly early-warning layer sitting on top of it today. That is the gap Sentinel fills.

---

## Architecture

A pnpm monorepo with a shared TypeScript core, a React frontend, three Soroban
contracts that compose on-chain, and a serverless analytics endpoint.

```
sentinel/
├── contracts/                 # Rust / Soroban workspace
│   ├── alert_registry/        # stores per-user warning thresholds + events
│   ├── risk_monitor/          # reads alert_registry (inter-contract) + classifies risk
│   └── guardian/              # opt-in, non-custodial liquidation protection
├── packages/core/             # framework-agnostic TS: RPC, contract clients, errors
├── apps/web/                  # React + Vite dashboard (+ onboarding, feedback, analytics)
├── api/track.ts               # Vercel Edge analytics/monitoring sink
└── .github/workflows/ci.yml   # CI: contracts + web
```

**On-chain data flow (inter-contract):**

```
 Browser ──assess(user, hf)──▶  risk_monitor  ──get_threshold(user)──▶  alert_registry
   ▲                               │                                        │
   │        RiskLevel  ◀───────────┘ classify(threshold, hf)                │ persistent
   └──── stream RiskAssessed / AlertTriggered events ◀── emit               └── storage
```

The frontend never holds custody or private keys: reads are RPC simulations,
writes are built locally and signed by the user's wallet.

---

## Smart contracts (Stellar Testnet)

| Contract | Address | Role |
|---|---|---|
| `alert_registry` | [`CAMPKYYY…PFNWV`](https://stellar.expert/explorer/testnet/contract/CAMPKYYYATXAZQDIPVDGVMPCP53A5BEQYXI3KIP3XO6S5AOUIB3PFNWV) | Stores per-user thresholds; emits `ThresholdSet` / `ThresholdRemoved` |
| `risk_monitor` | [`CCLHYNH4…GA5R`](https://stellar.expert/explorer/testnet/contract/CCLHYNH4GA6IDBNYHSZNKTXIVOPUIFBP3FP43UCCNRHR5RHDSLIQGA5R) | Reads the registry **cross-contract**, classifies risk; emits `RiskAssessed` / `AlertTriggered` |
| `guardian` | [`CCBOH4QO…MGTK`](https://stellar.expert/explorer/testnet/contract/CCBOH4QO4UQ5MR4EJV2VOWOGP3S5J2T5ZPXQHNXSJJKDTVYO7UKQMGTK) | Opt-in protection: holds an XLM reserve, releases it on breach; emits `PolicySet` / `ReserveFunded` / `Protected` |

Verifiable transactions:

| Tx | Hash |
|---|---|
| `guardian` `protect` (released a 2 XLM reserve) | [`ceb5b5e2…0bbf1`](https://stellar.expert/explorer/testnet/tx/ceb5b5e2a151207c8a690371bde61edbb6fc6678978114ace628532f2ef0bbf1) |
| Cross-contract `assess` (risk_monitor → alert_registry) | [`2d442bbf…cb438`](https://stellar.expert/explorer/testnet/tx/2d442bbfc26d539e039659084b95d9b39edf0efc93cb3144bb77d4cf893cb438) |
| `guardian` `fund_reserve` + `set_policy` | [`f5663bb9…0bbb`](https://stellar.expert/explorer/testnet/tx/f5663bb98f937348b941fd221b190201f39a8fa6623946eadad0469d345f0bbb) |
| `set_threshold` call | [`c67251c0…727a`](https://stellar.expert/explorer/testnet/tx/c67251c00f47796851b382e2091aa306e64f80fa3e299b3b989856c6f826727a) |

Full record: [`contracts/deployments.json`](contracts/deployments.json).

### Inter-contract communication

`risk_monitor.assess(user, current_hf_bps)` invokes the registry directly:

```rust
let threshold_bps: u32 =
    env.invoke_contract(&registry, &Symbol::new(&env, "get_threshold"), args);
```

It then classifies the health factor against that threshold (`Unconfigured` /
`Safe` / `Warning` within +5% / `Breached`) and publishes events. The registry
address is bound at `init` and is updatable only by the admin (`require_auth`).

### Interfaces

**alert_registry**

| Function | Auth | Event |
|---|---|---|
| `set_threshold(user, bps)` | wallet sig | `ThresholdSet` |
| `get_threshold(user) → u32` | — | — |
| `remove_threshold(user)` | wallet sig | `ThresholdRemoved` |

**risk_monitor**

| Function | Auth | Notes |
|---|---|---|
| `init(admin, registry)` | once | binds the registry + admin |
| `assess(user, hf_bps) → RiskLevel` | — | cross-contract read + emits events |
| `set_registry(registry)` | admin | re-point the bound registry |
| `get_registry() → Address` / `get_admin() → Address` | — | views |

**guardian**

| Function | Auth | Notes |
|---|---|---|
| `init(admin, token)` | once | binds the reserve asset (native XLM SAC) |
| `set_policy(user, threshold_bps)` | wallet sig | beneficiary fixed to the caller |
| `fund_reserve(user, amount)` / `withdraw_reserve(user, amount)` | wallet sig | real SAC token transfers |
| `protect(user, current_hf_bps) → i128` | — (permissionless) | releases the reserve when below threshold; emits `Protected` |
| `get_policy` / `get_reserve` / `has_policy` | — | views |

**Non-custodial guarantee.** The reserve can only ever move to the beneficiary the user fixed at policy time, or back via `withdraw_reserve`. `protect` is permissionless so a keeper can trigger it, but the contract enforces that funds never go anywhere the user did not sign for.

---

## CI/CD

[GitHub Actions](.github/workflows/ci.yml) runs on every push / PR to `main`, in two parallel jobs:

- **contracts** — `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`, release `wasm32v1-none` build
- **web** — `pnpm install --frozen-lockfile`, core build, `vitest`, production `tsc + vite build`

![CI pipeline](docs/screenshots/10-ci-pipeline.png)

---

## Testing

```bash
pnpm test            # frontend — Vitest (core + web)
pnpm test:contracts  # contracts — cargo test
```

- **Contracts (16):** `alert_registry` set/get/remove + events; `risk_monitor` cross-contract integration harness + classification; `guardian` policy / reserve / protect / withdraw with a mock Stellar Asset Contract.
- **Frontend (28):** `classifyError` across all three error kinds + heuristics, config validation, bps/percent + risk-level + stroops helpers, and `ErrorBanner` / `TxStatusPill` render tests (jsdom + Testing Library).

![Test output](docs/screenshots/09-test-output.png)

---

## Analytics & monitoring

Three layers, no third-party account required to run it:

- **On-chain Network Activity dashboard** — reads events from all three contracts and shows unique wallets, transactions, protections and a live interaction feed. The unique-wallet count is verifiable, on-chain **proof of real user interactions**.
- **Vercel Web Analytics** — pageviews / visitors via `@vercel/analytics`.
- **Event + error sink** — a fire-and-forget [`track()`](apps/web/src/lib/analytics.ts) sends product events (wallet connects, threshold sets, protections, errors) to the [`/api/track`](api/track.ts) Vercel Edge function, logged in Vercel Observability.

![Network activity analytics](docs/screenshots/12-analytics.png)

### User onboarding & feedback

A first-run [onboarding overlay](docs/screenshots/13-onboarding.png) walks new users through the four-step flow, and an always-available feedback widget (`VITE_FEEDBACK_URL`) collects responses.

---

## Run locally

**Requirements:** Node.js 18+, pnpm, and [Freighter](https://www.freighter.app/) (or xBull / Albedo).

```bash
git clone https://github.com/furkanyesildag/sentinel.git
cd sentinel
pnpm install
cp .env.example apps/web/.env
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173), switch your wallet to **Testnet**, and fund the account at [Friendbot](https://laboratory.stellar.org/#account-creator?network=test) if needed.

---

## Deployment

### Frontend (Vercel)

Deployed at **https://son-fawn.vercel.app**. The repo ships a
[`vercel.json`](vercel.json) configured for the pnpm monorepo (build the core
package, then the web app; output `apps/web/dist`). Deploy with:

```bash
vercel --prod        # or import the GitHub repo in the Vercel dashboard
```

No env vars are required — testnet defaults are baked in.

### Contracts (Stellar CLI)

Requires Rust 1.84+, the `wasm32v1-none` target, and the [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli).

```bash
rustup target add wasm32v1-none
cargo test --manifest-path contracts/Cargo.toml
stellar contract build

stellar keys generate sentinel-deployer --network testnet --fund
DEPLOYER=$(stellar keys address sentinel-deployer)

# 1) alert_registry
REGISTRY=$(stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/alert_registry.wasm \
  --source sentinel-deployer --network testnet)

# 2) risk_monitor — bound to the registry (inter-contract)
MONITOR=$(stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/risk_monitor.wasm \
  --source sentinel-deployer --network testnet)
stellar contract invoke --id $MONITOR --source sentinel-deployer --network testnet \
  -- init --admin $DEPLOYER --registry $REGISTRY

# 3) cross-contract call
stellar contract invoke --id $MONITOR --source sentinel-deployer --network testnet \
  -- assess --user $DEPLOYER --current_hf_bps 11000

# 4) guardian — bound to the native XLM Stellar Asset Contract
SAC=$(stellar contract id asset --asset native --network testnet)
GUARDIAN=$(stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/guardian.wasm \
  --source sentinel-deployer --network testnet)
stellar contract invoke --id $GUARDIAN --source sentinel-deployer --network testnet \
  -- init --admin $DEPLOYER --token $SAC
```

Then set `VITE_ALERT_REGISTRY_ID`, `VITE_RISK_MONITOR_ID`, `VITE_GUARDIAN_ID`
and `VITE_RESERVE_TOKEN_ID` in `apps/web/.env` (the deployed ids are the defaults).

---

## Screenshots

### Liquidation Guardian (Level 4)

Set a policy, fund a reserve, and trigger non-custodial protection. Guardian activity streams live.

![Liquidation Guardian](docs/screenshots/11-guardian.png)

### Network Activity (on-chain analytics + user-interaction proof)

![Network activity](docs/screenshots/12-analytics.png)

### Onboarding & mobile responsive

| First-run onboarding | Mobile dashboard |
|---|---|
| ![Onboarding](docs/screenshots/13-onboarding.png) | ![Mobile](docs/screenshots/14-mobile-l4.png) |

Full stacked mobile view (all panels): [`07-mobile-full.png`](docs/screenshots/07-mobile-full.png) · earlier desktop dashboard: [`08-dashboard-desktop.png`](docs/screenshots/08-dashboard-desktop.png).

### Multi-wallet picker (Freighter · xBull · Albedo)

![Wallet options available](docs/screenshots/05-wallet-options.png)

### Wallet connected and XLM balance displayed

![Wallet connected and balance displayed](docs/screenshots/01-wallet-connected-balance.png)

### Test transaction ready to send

![Send test transaction](docs/screenshots/02-tx-before-send.png)

### Freighter signing the transaction on Testnet

![Freighter confirm](docs/screenshots/03-freighter-confirm.png)

### Transaction confirmed on Stellar Testnet

Build, Sign, Submit, Confirm all completed. Transaction hash and StellarExpert link shown after confirmation.

![Transaction confirmed](docs/screenshots/04-tx-success.png)

### CI pipeline & test output

| CI/CD passing | Test suite |
|---|---|
| ![CI](docs/screenshots/10-ci-pipeline.png) | ![Tests](docs/screenshots/09-test-output.png) |

---

## Demo video

[![Watch the Sentinel demo](https://img.youtube.com/vi/gLwm4kT7ldg/mqdefault.jpg)](https://youtu.be/gLwm4kT7ldg)

A ~1–2 minute walkthrough: connect a wallet → set an on-chain warning threshold →
watch the Risk Monitor read it **cross-contract** and classify risk in real time →
publish an assessment and stream `RiskAssessed` / `AlertTriggered` events,
verifiable on Stellar Expert.

▶️ **Watch on YouTube: https://youtu.be/gLwm4kT7ldg**

---

## Environment variables

Defaults in `.env.example` work out of the box for testnet:

```
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_BLEND_POOL_ID=CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF
VITE_ALERT_REGISTRY_ID=CAMPKYYYATXAZQDIPVDGVMPCP53A5BEQYXI3KIP3XO6S5AOUIB3PFNWV
VITE_RISK_MONITOR_ID=CCLHYNH4GA6IDBNYHSZNKTXIVOPUIFBP3FP43UCCNRHR5RHDSLIQGA5R
VITE_GUARDIAN_ID=CCBOH4QO4UQ5MR4EJV2VOWOGP3S5J2T5ZPXQHNXSJJKDTVYO7UKQMGTK
VITE_RESERVE_TOKEN_ID=CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
# VITE_FEEDBACK_URL=https://tally.so/r/your-form-id   # embed your feedback form
```

---

## Tech stack

React 19 · TypeScript · Vite · Tailwind on the frontend. `@stellar/stellar-sdk`
and `@blend-capital/blend-sdk` for on-chain reads. Stellar Wallets Kit for
multi-wallet support. Rust + Soroban SDK 26 for the two contracts. Vitest +
Testing Library for frontend tests, `cargo test` for contracts, GitHub Actions
for CI. The AI Risk Copilot layer (LLM + RAG over positions and Blend docs) is
the next milestone.
