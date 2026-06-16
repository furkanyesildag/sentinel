# Sentinel

**Repository:** [github.com/furkanyesildag/sentinel](https://github.com/furkanyesildag/sentinel)

Non-custodial liquidation guard for [Blend Protocol](https://blend.capital) on Stellar Soroban. **Sentinel** watches your lending positions in real time and warns you before liquidation — read-only, no custody, no auto-actions.

Built for **Stellar Journey to Mastery — Level 1 (White Belt)**.

---

## Project description

Sentinel is a React dApp that connects to Stellar wallets (Freighter, xBull, Albedo), reads a user's Blend testnet position via Soroban RPC, fetches native XLM balance from Horizon, and demonstrates a full testnet transaction lifecycle (build → sign → submit → confirm).

| Feature | Description |
|---|---|
| Multi-wallet connect | Stellar Wallets Kit — Freighter, xBull, Albedo |
| XLM balance | Fetched from Horizon testnet after connect |
| Blend positions | Read-only collateral / supplied / borrowed + pool rates |
| Test transaction | Harmless 1-stroop self-payment on testnet |
| Network | Stellar **Testnet** only |

---

## Setup (run locally)

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- [Freighter](https://www.freighter.app/) wallet extension (set to **Testnet**)
- *(Optional)* Rust 1.84+ + `wasm32v1-none` for `contracts/` builds

### 1. Install dependencies

```bash
git clone https://github.com/furkanyesildag/sentinel.git
cd sentinel
pnpm install
```

### 2. Configure environment

```bash
cp .env.example apps/web/.env
```

| Variable | Description |
|---|---|
| `VITE_SOROBAN_RPC_URL` | Soroban RPC (testnet) |
| `VITE_HORIZON_URL` | Horizon API (testnet) |
| `VITE_NETWORK_PASSPHRASE` | Stellar testnet passphrase |
| `VITE_BLEND_POOL_ID` | Blend TestnetV2 pool contract |
| `VITE_BLEND_BACKSTOP_ID` | Blend testnet backstop |
| `VITE_EXPLORER_BASE_URL` | Block explorer base URL |

Defaults in `.env.example` work out of the box for testnet.

### 3. Start the dev server

```bash
pnpm dev
```

Open **http://localhost:5173**

### 4. Prepare your wallet

1. Open Freighter → switch network to **Testnet**
2. Fund your account via [Friendbot / Stellar Laboratory](https://laboratory.stellar.org/#account-creator?network=test)
3. Click **Connect Wallet** → choose Freighter → approve

---

## Screenshots

### Wallet connected + balance displayed

Connected wallet address (header + address bar) and native XLM balance fetched from Horizon testnet.

![Wallet connected and XLM balance displayed](docs/screenshots/01-wallet-connected-balance.png)

### Test transaction — ready to send

Proof of Transaction panel before signing. Sends `0.0000001 XLM` to yourself (1 stroop self-payment).

![Test transaction ready to send](docs/screenshots/02-tx-before-send.png)

### Freighter confirmation (Testnet)

User signs the transaction in Freighter. Network shows **Test Net**.

![Freighter confirm transaction on testnet](docs/screenshots/03-freighter-confirm.png)

### Successful testnet transaction + result

All pipeline steps completed (Build → Sign → Submit → Confirm). Transaction hash and StellarExpert explorer link shown to the user.

![Successful testnet transaction with hash](docs/screenshots/04-tx-success.png)

---

## Level 1 checklist

| Requirement | Status |
|---|---|
| Freighter wallet + Stellar Testnet | ✅ |
| Wallet connect / disconnect | ✅ |
| Fetch & display XLM balance | ✅ |
| Send XLM transaction on testnet | ✅ |
| Show success/failure + tx hash | ✅ |

---

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start web dApp (Vite) |
| `pnpm build` | Build all packages |
| `pnpm contracts:build` | Build Soroban contracts (Rust + `wasm32v1-none`) |

---

## Manual test walkthrough

1. Set Freighter to **Testnet** and fund via Friendbot.
2. **Connect wallet** → address appears in header and address bar.
3. Verify **XLM balance** loads in the Wallet Balance card.
4. Click **Send test transaction** → confirm in Freighter.
5. Verify green success box with **transaction hash** and explorer link.
6. **Disconnect** and reconnect with a second provider (xBull or Albedo).

---

## Repository layout

```
packages/core/   Shared network, balance, and Blend read helpers
apps/web/        React + Vite dApp (Sentinel UI)
contracts/       Soroban workspace placeholder (Yellow Belt)
docs/screenshots/ README screenshots
```

---

## License

Private / educational — Stellar Journey to Mastery submission.
