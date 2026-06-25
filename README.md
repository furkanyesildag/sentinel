# Sentinel — DeFi Risk Copilot for Stellar

Borrowers on Blend Protocol can lose their collateral to liquidation without any warning. Sentinel fixes that.

It watches your lending positions on Blend, tells you how close you are to liquidation, and explains the risk in plain language so you actually understand what is happening and why. When you are ready for it, it can act on your behalf to protect you, but only with your explicit permission and only after a security audit. For now it reads, monitors, and explains.

This is not a yield vault. It is a risk layer for people who already have open borrow positions and want to stay informed before it is too late.

---

## Level 2 — requirements checklist

| Requirement | Where |
|---|---|
| Multi-wallet (Stellar Wallets Kit) | Freighter · xBull · Albedo — [`kit.ts`](apps/web/src/wallet/kit.ts), [screenshot](docs/screenshots/05-wallet-options.png) |
| Contract deployed on testnet | [`CAMPKYYY…PFNWV`](https://stellar.expert/explorer/testnet/contract/CAMPKYYYATXAZQDIPVDGVMPCP53A5BEQYXI3KIP3XO6S5AOUIB3PFNWV) |
| Contract called from the frontend | `set_threshold` / `get_threshold` / `remove_threshold` — [`AlertRegistryPanel`](apps/web/src/components/AlertRegistryPanel.tsx) |
| Read & write contract data | [`readThreshold` / `buildSetThresholdTx`](packages/core/src/contract.ts) |
| Transaction status visible | Build → Sign → Submit → Confirm + Pending/Success/Failed — [`TxProgress`](apps/web/src/components/TxProgress.tsx) |
| Event listening & state sync | `ThresholdSet` / `ThresholdRemoved` live feed — [`fetchThresholdEvents`](packages/core/src/contract.ts) |
| 3 error types handled | wallet-not-found · user-rejected · insufficient-balance — [`errors.ts`](packages/core/src/errors.ts) |
| Contract-call tx hash | [`c67251c0…727a`](https://stellar.expert/explorer/testnet/tx/c67251c00f47796851b382e2091aa306e64f80fa3e299b3b989856c6f826727a) |

---

## What it does

**Position monitoring.** Connects to your Stellar wallet and reads your Blend lending position via Soroban RPC. Collateral, borrowed amounts, supplied assets, pool market rates, all pulled directly from the chain without any custody.

**XLM balance display.** Fetches your native XLM balance from Horizon so you always know what you are working with.

**Transaction flow.** Full sign and submit pipeline: build a transaction, send it to your wallet for signing, broadcast it to the network, and confirm it on-chain. The transaction hash and a StellarExpert link are shown once confirmed.

**AI Risk Copilot (in progress).** The plan is to pair the raw position data with an LLM and a RAG layer built on Blend's documentation and live oracle prices. Instead of showing a health factor number and leaving you to figure it out, the copilot explains it: "If XLM drops 12% from here, your position gets liquidated." That is the part that makes this different from a data dashboard.

**Alert threshold registry (live on testnet).** A deployed Soroban contract (`alert_registry`) stores per-user liquidation warning thresholds on-chain. Straight from the dashboard you can **read** your stored threshold (`get_threshold`, a free read-only simulation), **write** a new one (`set_threshold`, signed by your wallet with a live Build → Sign → Submit → Confirm tracker), and **remove** it. Every mutating call emits a typed `ThresholdSet` / `ThresholdRemoved` contract event, which the UI streams into a live activity feed and re-reads after each write so the on-screen state always matches the chain. See [On-chain contract](#on-chain-contract-level-2) below for the deployed address and verifiable transactions.

**Liquidation protection (later, opt-in only).** Once the risk engine is solid and the contracts are audited, the guardian layer will offer one-click or automated protective actions like adding collateral or partial repayment before the liquidation threshold is hit. Strictly opt-in. The default product never moves your funds.

---

## Why Blend

Blend is the largest lending protocol on Stellar, over $80M TVL as of early 2026, running on immutable Soroban contracts. Borrowers post collateral and take loans, and when their position deteriorates they get liquidated at a market premium, a direct loss. There is no friendly early-warning layer sitting on top of it today. That is the gap Sentinel fills.

---

## On-chain contract (Level 2)

The `alert_registry` Soroban contract is built, tested, and **deployed live on Stellar Testnet**. The frontend reads from it, writes to it, and listens to its events.

| | |
|---|---|
| **Contract address** | [`CAMPKYYYATXAZQDIPVDGVMPCP53A5BEQYXI3KIP3XO6S5AOUIB3PFNWV`](https://stellar.expert/explorer/testnet/contract/CAMPKYYYATXAZQDIPVDGVMPCP53A5BEQYXI3KIP3XO6S5AOUIB3PFNWV) |
| **Contract-call tx** (`set_threshold`) | [`c67251c00f47796851b382e2091aa306e64f80fa3e299b3b989856c6f826727a`](https://stellar.expert/explorer/testnet/tx/c67251c00f47796851b382e2091aa306e64f80fa3e299b3b989856c6f826727a) |
| **Deploy tx** | [`77b80136df7f768b6a6e21fe7395fe5cd1add904731a92651ab7c18e92c3ab42`](https://stellar.expert/explorer/testnet/tx/77b80136df7f768b6a6e21fe7395fe5cd1add904731a92651ab7c18e92c3ab42) |
| **Wasm hash** | `1edbb50f5727e75f9ef76f29cae641f9cdb8a814988a5406ead56e4ecd0b6a95` |

Full deployment record: [`contracts/deployments.json`](contracts/deployments.json).

### Contract interface

| Function | Auth | Kind | Description |
|---|---|---|---|
| `set_threshold(user, threshold_bps)` | ✓ wallet sig | write | Register / update a warning threshold; emits `ThresholdSet` |
| `get_threshold(user) → u32` | — | read | Stored threshold in bps (`0` if unset) |
| `remove_threshold(user)` | ✓ wallet sig | write | Delete the threshold; emits `ThresholdRemoved` |

Thresholds are basis points — `12000` bps = warn when health factor drops below **120%**.

### Reading, writing, events & status — from the browser

- **Read** — [`readThreshold`](packages/core/src/contract.ts) simulates `get_threshold`. No signature, no fee, works even for an unfunded account.
- **Write** — [`buildSetThresholdTx` / `buildRemoveThresholdTx`](packages/core/src/contract.ts) build + simulate + assemble the invocation; the wallet signs it and [`submitSignedTransaction`](apps/web/src/lib/transactions.ts) broadcasts and polls to confirmation.
- **Transaction status** — a Build → Sign → Submit → Confirm stepper plus a Pending / Success / Failed pill ([`TxProgress`](apps/web/src/components/TxProgress.tsx)).
- **Events & state sync** — [`fetchThresholdEvents`](packages/core/src/contract.ts) decodes `ThresholdSet` / `ThresholdRemoved` events into a live feed that polls every 20s and refreshes after each write.

### Error handling

Three error classes are detected and surfaced with distinct, actionable messages ([`errors.ts`](packages/core/src/errors.ts) → [`ErrorBanner`](apps/web/src/components/ErrorBanner.tsx)):

1. **Wallet not found** — no wallet installed / selected / reachable.
2. **User rejected** — the signature was declined or the modal was closed.
3. **Insufficient balance** — the account is unfunded or can't cover the network fee (also caught proactively when the source account 404s).

### Build, test & deploy the contract

Requires Rust 1.84+ and the `wasm32v1-none` target, plus the [Stellar CLI](https://developers.stellar.org/docs/tools/cli/install-cli).

```bash
rustup target add wasm32v1-none

# test + build
cargo test --manifest-path contracts/Cargo.toml
stellar contract build                 # → contracts/target/wasm32v1-none/release/alert_registry.wasm

# deploy to testnet (one-time funded identity)
stellar keys generate sentinel-deployer --network testnet --fund
stellar contract deploy \
  --wasm contracts/target/wasm32v1-none/release/alert_registry.wasm \
  --source sentinel-deployer --network testnet

# call it
stellar contract invoke --id <CONTRACT_ID> --source sentinel-deployer --network testnet \
  -- set_threshold --user <YOUR_G_ADDRESS> --threshold_bps 12000
```

Set `VITE_ALERT_REGISTRY_ID` in `apps/web/.env` to your contract id (the deployed one is the default).

---

## Tech stack

React, TypeScript, Vite on the frontend. Stellar SDK and Blend SDK for on-chain reads. Stellar Wallets Kit for multi-wallet support (Freighter, xBull, Albedo). Rust and Soroban SDK for the alert registry contract. The AI layer will be built on an LLM with retrieval-augmented generation over live position data and Blend protocol docs.

---

## How to run locally

**Requirements:** Node.js 18+, pnpm, [Freighter](https://www.freighter.app/) browser extension

```bash
git clone https://github.com/furkanyesildag/sentinel.git
cd sentinel
pnpm install
cp .env.example apps/web/.env
pnpm dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

Open Freighter and switch the network to **Testnet**. If your account has no balance, fund it at [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test).

---

## Screenshots

### Wallet options available (multi-wallet via Stellar Wallets Kit)

Freighter, xBull and Albedo are all selectable from the connect modal.

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

---

## Environment variables

Defaults in `.env.example` work out of the box for testnet:

```
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
VITE_BLEND_POOL_ID=CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF
VITE_ALERT_REGISTRY_ID=CAMPKYYYATXAZQDIPVDGVMPCP53A5BEQYXI3KIP3XO6S5AOUIB3PFNWV
```
