# Sentinel

Non-custodial liquidation guard for [Blend Protocol](https://blend.capital) on Stellar Soroban.

**Sentinel** connects to your Stellar wallet, reads your Blend lending positions in real time via Soroban RPC, shows your native XLM balance, and warns you before liquidation — read-only, no custody, no auto-actions.

> Stellar Journey to Mastery — Level 1 submission  
> 🔗 **https://github.com/furkanyesildag/sentinel**

---

## Project description

Sentinel is a React + TypeScript dApp that:

- Connects to **Freighter**, **xBull**, and **Albedo** wallets via Stellar Wallets Kit
- Fetches the connected wallet's **native XLM balance** from Horizon testnet
- Reads the user's **Blend Protocol lending position** (collateral / supplied / borrowed) via Soroban RPC — read-only
- Demonstrates the full **Stellar transaction lifecycle**: build → sign (in wallet) → submit → confirm on-chain
- Runs entirely on **Stellar Testnet** — no mainnet funds required

**Tech stack:** React · TypeScript · Vite · Stellar SDK · Blend SDK · Stellar Wallets Kit · pnpm monorepo

---

## Setup — how to run locally

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) 9+
- [Freighter](https://www.freighter.app/) browser extension → set to **Testnet**

### 1. Clone and install

```bash
git clone https://github.com/furkanyesildag/sentinel.git
cd sentinel
pnpm install
```

### 2. Configure environment

```bash
cp .env.example apps/web/.env
```

The defaults in `.env.example` work out of the box for Stellar Testnet. No changes needed.

| Variable | Default value |
|---|---|
| `VITE_SOROBAN_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `VITE_HORIZON_URL` | `https://horizon-testnet.stellar.org` |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |
| `VITE_BLEND_POOL_ID` | Blend TestnetV2 pool contract |

### 3. Start the dev server

```bash
pnpm dev
```

Open **http://localhost:5173**

### 4. Set up your wallet

1. Open Freighter → switch network to **Testnet**
2. Fund your test account via [Friendbot](https://laboratory.stellar.org/#account-creator?network=test)
3. Click **Connect Wallet** in the app → select Freighter → approve

---

## Screenshots

### Wallet connected state + balance displayed

Freighter connected on Testnet. Address shown in the header and address bar. Native XLM balance fetched from Horizon and displayed in the Wallet Balance card.

![Wallet connected and XLM balance displayed](docs/screenshots/01-wallet-connected-balance.png)

---

### Test transaction — ready to send

The Proof of Transaction panel before signing. A 1-stroop (0.0000001 XLM) self-payment is built and ready to sign.

![Send test transaction button](docs/screenshots/02-tx-before-send.png)

---

### Freighter signing the transaction (Testnet)

Freighter pops up with the transaction details. Network clearly shows **Test Net**.

![Freighter confirm dialog](docs/screenshots/03-freighter-confirm.png)

---

### Successful testnet transaction — result shown to the user

All four pipeline steps complete (Build → Sign → Submit → Confirm). The on-chain transaction hash and a direct StellarExpert explorer link are shown in the UI.

![Transaction confirmed with hash and explorer link](docs/screenshots/04-tx-success.png)

---

## Level 1 requirements

| Requirement | Met |
|---|---|
| Set up Freighter wallet on Stellar Testnet | ✅ |
| Implement wallet connect | ✅ |
| Implement wallet disconnect | ✅ |
| Fetch the connected wallet's XLM balance | ✅ |
| Display the balance clearly in the UI | ✅ |
| Send an XLM transaction on Stellar testnet | ✅ |
| Show success/failure state to the user | ✅ |
| Show transaction hash or confirmation message | ✅ |
