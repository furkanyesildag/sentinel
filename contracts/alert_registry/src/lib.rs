//! Alert Registry — Soroban smart contract for Sentinel DeFi Risk Copilot
//!
//! Stores per-user liquidation alert thresholds on-chain so the Sentinel
//! backend can query them without relying on off-chain state.
//!
//! # Functions
//! - `set_threshold(user, threshold_bps)` — register / update a threshold
//! - `get_threshold(user)` — read the stored threshold (0 if not set)
//! - `remove_threshold(user)` — delete the threshold entry
//!
//! # Events
//! Mutating calls publish a typed contract event so off-chain listeners (the
//! Sentinel frontend / backend) can synchronise state in real time without
//! polling storage:
//! - `ThresholdSet`     — topics `["threshold", "set", user]`,     data `bps: u32`
//! - `ThresholdRemoved` — topics `["threshold", "removed", user]`, data `()`
//!
//! Threshold values are in basis points (bps):
//!   12000 bps = 120% health factor warning level

#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env};

// ── Storage key ─────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Threshold(Address),
}

// ── Events ───────────────────────────────────────────────────────────────────

/// Published whenever a user registers or updates their alert threshold.
/// `data_format = "single-value"` keeps the payload a bare `u32` so listeners
/// can decode it without unwrapping a map.
#[contractevent(topics = ["threshold", "set"], data_format = "single-value")]
#[derive(Clone)]
pub struct ThresholdSet {
    #[topic]
    pub user: Address,
    pub bps: u32,
}

/// Published whenever a user deletes their alert threshold.
#[contractevent(topics = ["threshold", "removed"])]
#[derive(Clone)]
pub struct ThresholdRemoved {
    #[topic]
    pub user: Address,
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct AlertRegistry;

#[contractimpl]
impl AlertRegistry {
    /// Register or update a liquidation alert threshold for `user`.
    ///
    /// `threshold_bps` — health-factor warning level in basis points.
    ///   Example: 12000 = warn when health factor drops below 120%.
    ///
    /// Requires authorisation from `user` (wallet signature) and emits a
    /// `ThresholdSet` event.
    pub fn set_threshold(env: Env, user: Address, threshold_bps: u32) {
        // require_auth() verifies the caller has signed for this address,
        // preventing any other account from modifying someone else's threshold.
        user.require_auth();

        env.storage()
            .persistent()
            .set(&DataKey::Threshold(user.clone()), &threshold_bps);

        // Publish an event so listeners can synchronise state in real time.
        ThresholdSet {
            user,
            bps: threshold_bps,
        }
        .publish(&env);
    }

    /// Return the stored alert threshold for `user` in basis points.
    ///
    /// Returns `0` when no threshold has been registered.
    pub fn get_threshold(env: Env, user: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Threshold(user))
            .unwrap_or(0)
    }

    /// Delete the alert threshold entry for `user`.
    ///
    /// Requires authorisation from `user` (wallet signature) and emits a
    /// `ThresholdRemoved` event.
    pub fn remove_threshold(env: Env, user: Address) {
        user.require_auth();

        env.storage()
            .persistent()
            .remove(&DataKey::Threshold(user.clone()));

        ThresholdRemoved { user }.publish(&env);
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        Address, Env,
    };

    #[test]
    fn set_and_get_threshold() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AlertRegistry, ());
        let client = AlertRegistryClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        // Initially no threshold is set → returns 0
        assert_eq!(client.get_threshold(&user), 0);

        // Set a threshold of 120% (12000 bps)
        client.set_threshold(&user, &12_000);
        assert_eq!(client.get_threshold(&user), 12_000);

        // Update to 110%
        client.set_threshold(&user, &11_000);
        assert_eq!(client.get_threshold(&user), 11_000);
    }

    #[test]
    fn remove_threshold() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AlertRegistry, ());
        let client = AlertRegistryClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        client.set_threshold(&user, &12_000);
        assert_eq!(client.get_threshold(&user), 12_000);

        client.remove_threshold(&user);
        assert_eq!(client.get_threshold(&user), 0);
    }

    #[test]
    fn set_threshold_emits_event() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AlertRegistry, ());
        let client = AlertRegistryClient::new(&env, &contract_id);

        let user = Address::generate(&env);

        client.set_threshold(&user, &12_000);

        // Exactly one contract event should have been published by the call.
        let events = env.events().all();
        assert_eq!(events.events().len(), 1);
    }

    #[test]
    fn multiple_users_are_independent() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(AlertRegistry, ());
        let client = AlertRegistryClient::new(&env, &contract_id);

        let alice = Address::generate(&env);
        let bob = Address::generate(&env);

        client.set_threshold(&alice, &12_000);
        client.set_threshold(&bob, &11_500);

        assert_eq!(client.get_threshold(&alice), 12_000);
        assert_eq!(client.get_threshold(&bob), 11_500);

        // Removing Alice's entry does not affect Bob
        client.remove_threshold(&alice);
        assert_eq!(client.get_threshold(&alice), 0);
        assert_eq!(client.get_threshold(&bob), 11_500);
    }
}
