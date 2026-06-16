# Soroban Contracts (Placeholder)

This workspace holds future DeFi Risk Copilot smart contracts.

## Current status — White Belt

`alert_registry/` is a minimal hello-world-level crate so the workspace compiles. **No production logic yet.**

## Yellow Belt (planned)

- Alert threshold registry contract
- On-chain storage of user risk preferences
- Events on threshold updates

## Build

Requires Rust 1.84+ with the `wasm32v1-none` target:

```bash
rustup target add wasm32v1-none

# from repo root
pnpm contracts:build

# or directly
cd contracts && cargo build --target wasm32v1-none --release
```

## Layout

```
contracts/
├── Cargo.toml          # workspace root
└── alert_registry/     # placeholder crate
    ├── Cargo.toml
    └── src/lib.rs
```
