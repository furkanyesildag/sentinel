# DeFi Risk Copilot

Non-custodial liquidation-warning copilot for Blend lending on Stellar/Soroban.

**Phase 1 (White Belt):** read-only position monitoring, multi-wallet connect, and a harmless test transaction on testnet.

## Prerequisites

- Node.js 18+
- pnpm 9+
- Rust 1.84+ with `wasm32v1-none` target (for `contracts/` builds)

## Setup

```bash
pnpm install
cp .env.example apps/web/.env
pnpm dev
```

Open http://localhost:5173

## Environment variables

Copy `.env.example` to `apps/web/.env`:

| Variable | Description |
|---|---|
| `VITE_SOROBAN_RPC_URL` | Soroban RPC (testnet) |
| `VITE_HORIZON_URL` | Horizon API (testnet) |
| `VITE_NETWORK_PASSPHRASE` | Stellar testnet passphrase |
| `VITE_BLEND_POOL_ID` | Blend TestnetV2 pool contract |
| `VITE_BLEND_BACKSTOP_ID` | Blend testnet backstop |
| `VITE_EXPLORER_BASE_URL` | Block explorer base URL |

Pool addresses sourced from [blend-utils/testnet.contracts.json](https://github.com/blend-capital/blend-utils/blob/main/testnet.contracts.json).

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start web dApp (Vite) |
| `pnpm build` | Build all packages |
| `pnpm contracts:build` | Build Soroban contracts (Rust + `wasm32v1-none`) |

## White Belt checklist

- [ ] Connect with **Freighter** and **xBull** (or Albedo)
- [ ] Blend TestnetV2 position renders (or empty state + pool data)
- [ ] One test transaction confirmed on-chain with hash + explorer link
- [ ] `pnpm build` passes
- [ ] `contracts/` workspace compiles (`pnpm contracts:build` with Rust 1.84+)

## Manual test

1. Set Freighter (or xBull) to **Testnet**.
2. Fund your account via [Friendbot](https://laboratory.stellar.org/#account-creator?network=test).
3. Connect wallet → verify address appears.
4. Check position panel: pool reserves always shown; user rows if you have a Blend position.
5. Click **Send test transaction** → sign 1 stroop self-payment → confirm hash link opens StellarExpert.
6. Disconnect and connect with a second wallet provider.

To open a Blend test position: use the [Blend testnet UI](https://app.blend.capital) with the same wallet.

## Repository layout

```
packages/core/   Shared network + Blend read helpers (read-only)
apps/web/        React dApp
contracts/       Soroban workspace placeholder (Yellow Belt: alert registry)
```

## Belt status

| Belt | Status |
|---|---|
| White | In progress — wallets, Blend read, test tx |
| Yellow+ | Not started — risk math, alerts, AI copilot |
