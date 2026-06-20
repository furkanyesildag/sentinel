# Soroban Contracts — Sentinel Alert Registry

## alert_registry

A Soroban smart contract that stores per-user liquidation alert thresholds on-chain so the Sentinel backend can query them without any off-chain state.

### Functions

| Function | Auth required | Description |
|---|---|---|
| `set_threshold(user, threshold_bps)` | ✓ (`user.require_auth()`) | Register or update a health-factor warning threshold |
| `get_threshold(user)` | — | Read the stored threshold; returns `0` if unset |
| `remove_threshold(user)` | ✓ (`user.require_auth()`) | Delete the threshold entry |

**Threshold unit:** basis points (bps). `12000` = warn when health factor drops below 120%.

### Design

- Persistent storage keyed by `DataKey::Threshold(Address)`
- `require_auth()` on mutating calls prevents one account from modifying another user's settings
- Fully tested — 3 unit tests covering set/get, removal, and multi-user isolation

### Build

Requires Rust 1.84+ with the `wasm32v1-none` target:

```bash
rustup target add wasm32v1-none

# from repo root
cargo build --target wasm32v1-none --release --manifest-path contracts/Cargo.toml

# or run tests
cargo test --manifest-path contracts/Cargo.toml
```

### Layout

```
contracts/
├── Cargo.toml              # workspace root
└── alert_registry/
    ├── Cargo.toml
    └── src/lib.rs          # AlertRegistry contract + tests
```
