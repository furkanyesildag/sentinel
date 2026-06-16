# Sentinel

A non-custodial Stellar dApp for monitoring your DeFi positions and sending payments on testnet. Connect your wallet, see your XLM balance, send a transaction, and keep an eye on your [Blend Protocol](https://blend.capital) lending positions — all without giving the app access to your funds.

Built with React, TypeScript, Vite, Stellar SDK, and Stellar Wallets Kit. Supports Freighter, xBull, and Albedo wallets.

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
