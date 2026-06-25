//! Risk Monitor — Sentinel's risk-assessment contract.
//!
//! This is the "advanced" contract for Level 3: it does **inter-contract
//! communication**. Given a user's current Blend health factor, it performs a
//! cross-contract call into the deployed `alert_registry` to read that user's
//! configured warning threshold, classifies the resulting risk, and publishes
//! events so the frontend can stream real-time alerts.
//!
//! # Lifecycle
//! 1. `init(admin, registry)` — one-time setup binding this monitor to an
//!    `alert_registry` instance and an admin.
//! 2. `assess(user, current_hf_bps)` — cross-contract read + classify + emit.
//! 3. `set_registry(registry)` — admin-gated re-pointing to another registry.
//!
//! # Risk levels (health factor vs. threshold, both in bps)
//! - `Unconfigured` — the user has not set a threshold (registry returns 0)
//! - `Breached`     — current HF is below the threshold
//! - `Warning`      — current HF is within +5% of the threshold
//! - `Safe`         — current HF is comfortably above the threshold
//!
//! # Events
//! - `RiskAssessed`  — every assessment, topics `["risk", "assessed", user]`
//! - `AlertTriggered`— only on Warning / Breached, topics `["risk", "alert", user]`

#![no_std]
use soroban_sdk::{
    contract, contractevent, contractimpl, contracttype, vec, Address, Env, IntoVal, Symbol, Val,
    Vec,
};

// ── Risk classification ──────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum RiskLevel {
    Unconfigured,
    Safe,
    Warning,
    Breached,
}

impl RiskLevel {
    /// Stable numeric code used in events (cheap to decode off-chain).
    pub fn code(self) -> u32 {
        match self {
            RiskLevel::Unconfigured => 0,
            RiskLevel::Safe => 1,
            RiskLevel::Warning => 2,
            RiskLevel::Breached => 3,
        }
    }
}

/// Pure classification — extracted so it is trivially unit-testable.
fn classify(threshold_bps: u32, current_hf_bps: u32) -> RiskLevel {
    if threshold_bps == 0 {
        return RiskLevel::Unconfigured;
    }
    if current_hf_bps < threshold_bps {
        return RiskLevel::Breached;
    }
    // Warning band: within +5% of the threshold. u64 math avoids overflow.
    let warn_ceiling = threshold_bps as u64 + (threshold_bps as u64) / 20;
    if (current_hf_bps as u64) < warn_ceiling {
        return RiskLevel::Warning;
    }
    RiskLevel::Safe
}

// ── Storage ──────────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    Registry,
}

// ── Events ───────────────────────────────────────────────────────────────────

#[contractevent(topics = ["risk", "assessed"])]
#[derive(Clone)]
pub struct RiskAssessed {
    #[topic]
    pub user: Address,
    pub level: u32,
    pub current_hf_bps: u32,
    pub threshold_bps: u32,
}

#[contractevent(topics = ["risk", "alert"])]
#[derive(Clone)]
pub struct AlertTriggered {
    #[topic]
    pub user: Address,
    pub level: u32,
    pub current_hf_bps: u32,
    pub threshold_bps: u32,
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct RiskMonitor;

#[contractimpl]
impl RiskMonitor {
    /// One-time initialisation. Binds this monitor to an `alert_registry`
    /// instance and records an admin who may later re-point it.
    ///
    /// Panics if already initialised.
    pub fn init(env: Env, admin: Address, registry: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Registry, &registry);
    }

    /// Assess a user's risk by reading their threshold from the bound
    /// `alert_registry` via a cross-contract call, then classifying it against
    /// the supplied current health factor. Publishes a `RiskAssessed` event
    /// always, plus an `AlertTriggered` event when the level is Warning/Breached.
    pub fn assess(env: Env, user: Address, current_hf_bps: u32) -> RiskLevel {
        let registry = Self::get_registry(env.clone());

        // ── Inter-contract communication ──
        // Invoke alert_registry.get_threshold(user) and read its u32 result.
        let args: Vec<Val> = vec![&env, user.clone().into_val(&env)];
        let threshold_bps: u32 =
            env.invoke_contract(&registry, &Symbol::new(&env, "get_threshold"), args);

        let level = classify(threshold_bps, current_hf_bps);

        RiskAssessed {
            user: user.clone(),
            level: level.code(),
            current_hf_bps,
            threshold_bps,
        }
        .publish(&env);

        if level == RiskLevel::Warning || level == RiskLevel::Breached {
            AlertTriggered {
                user,
                level: level.code(),
                current_hf_bps,
                threshold_bps,
            }
            .publish(&env);
        }

        level
    }

    /// Admin-gated update of the bound registry address.
    pub fn set_registry(env: Env, registry: Address) {
        let admin = Self::get_admin(env.clone());
        admin.require_auth();
        env.storage().instance().set(&DataKey::Registry, &registry);
    }

    /// Address of the `alert_registry` this monitor reads from.
    pub fn get_registry(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Registry)
            .expect("not initialized")
    }

    /// Configured admin address.
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized")
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use alert_registry::{AlertRegistry, AlertRegistryClient};
    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        Address, Env,
    };

    struct Harness {
        env: Env,
        monitor: RiskMonitorClient<'static>,
        registry: AlertRegistryClient<'static>,
        monitor_id: Address,
        user: Address,
    }

    fn setup() -> Harness {
        let env = Env::default();
        env.mock_all_auths();

        // Deploy a real alert_registry and bind the monitor to it.
        let registry_id = env.register(AlertRegistry, ());
        let registry = AlertRegistryClient::new(&env, &registry_id);

        let monitor_id = env.register(RiskMonitor, ());
        let monitor = RiskMonitorClient::new(&env, &monitor_id);

        let admin = Address::generate(&env);
        monitor.init(&admin, &registry_id);

        let user = Address::generate(&env);
        Harness {
            env,
            monitor,
            registry,
            monitor_id,
            user,
        }
    }

    #[test]
    fn unconfigured_when_no_threshold() {
        let h = setup();
        // No threshold set in the registry → cross-contract read returns 0.
        assert_eq!(h.monitor.assess(&h.user, &15_000), RiskLevel::Unconfigured);
    }

    #[test]
    fn reads_threshold_across_contracts_and_breaches() {
        let h = setup();
        h.registry.set_threshold(&h.user, &12_000); // 120%

        // current 110% < 120% threshold → Breached
        assert_eq!(h.monitor.assess(&h.user, &11_000), RiskLevel::Breached);
    }

    #[test]
    fn warning_band_within_five_percent() {
        let h = setup();
        h.registry.set_threshold(&h.user, &12_000);

        // 12300 bps is within +5% of 12000 (ceiling 12600) → Warning
        assert_eq!(h.monitor.assess(&h.user, &12_300), RiskLevel::Warning);
    }

    #[test]
    fn safe_when_comfortably_above() {
        let h = setup();
        h.registry.set_threshold(&h.user, &12_000);
        assert_eq!(h.monitor.assess(&h.user, &20_000), RiskLevel::Safe);
    }

    #[test]
    fn breach_emits_two_events_from_monitor() {
        let h = setup();
        h.registry.set_threshold(&h.user, &12_000);
        let before = h
            .env
            .events()
            .all()
            .filter_by_contract(&h.monitor_id)
            .events()
            .len();

        h.monitor.assess(&h.user, &10_000); // Breached

        let after = h
            .env
            .events()
            .all()
            .filter_by_contract(&h.monitor_id)
            .events()
            .len();
        // RiskAssessed + AlertTriggered
        assert_eq!(after - before, 2);
    }

    #[test]
    fn classify_is_pure_and_correct() {
        assert_eq!(classify(0, 99_999), RiskLevel::Unconfigured);
        assert_eq!(classify(12_000, 11_999), RiskLevel::Breached);
        assert_eq!(classify(12_000, 12_000), RiskLevel::Warning);
        assert_eq!(classify(12_000, 12_599), RiskLevel::Warning);
        assert_eq!(classify(12_000, 12_600), RiskLevel::Safe);
    }
}
