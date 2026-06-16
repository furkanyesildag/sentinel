# Sentinel

Sentinel is a Stellar testnet dApp that lets you connect your Freighter wallet, check your XLM balance, and send a payment on the Stellar testnet. It also reads your Blend lending positions via Soroban RPC in read-only mode.

Built with React, TypeScript, Vite, and Stellar Wallets Kit.

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

Before using the app, open Freighter and switch the network to **Testnet**. If your account has no balance yet, fund it at [Stellar Laboratory Friendbot](https://laboratory.stellar.org/#account-creator?network=test).

---

## Screenshots

### Wallet connected + XLM balance

![Wallet connected and balance displayed](docs/screenshots/01-wallet-connected-balance.png)

### Sending the test transaction

![Send test transaction button](docs/screenshots/02-tx-before-send.png)

### Freighter signing screen

![Freighter confirm transaction on testnet](docs/screenshots/03-freighter-confirm.png)

### Transaction confirmed on Stellar testnet

All steps completed (Build → Sign → Submit → Confirm). The transaction hash and a link to StellarExpert are shown after confirmation.

![Transaction confirmed with hash and explorer link](docs/screenshots/04-tx-success.png)

---

## Environment variables

The defaults in `.env.example` work out of the box for testnet, so you don't need to change anything:

```
VITE_SOROBAN_RPC_URL=https://soroban-testnet.stellar.org
VITE_HORIZON_URL=https://horizon-testnet.stellar.org
VITE_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```
