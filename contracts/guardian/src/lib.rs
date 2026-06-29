//! Guardian — Sentinel's opt-in, non-custodial liquidation protection contract.
//!
//! This is the Level 4 MVP of the approved idea: instead of only *warning* a
//! borrower, the guardian can *act*. A user signs a protection policy and funds
//! a reserve. When their health factor breaches the policy threshold, a
//! permissionless `protect` call releases the reserve to the user's beneficiary
//! so the position can be defended before liquidation.
//!
//! # Non-custodial guarantees (enforced on-chain)
//! - Only the user can set their policy or fund / withdraw their reserve
//!   (`require_auth`).
//! - A reserve can only ever move to the beneficiary the user fixed at policy
//!   time, or back to the user via `withdraw_reserve`. The permissionless
//!   `protect` caller (a keeper) can trigger protection but can never redirect
//!   funds.
//!
//! # Lifecycle
//! 1. `init(admin, token)` — bind the reserve asset (e.g. the native XLM SAC).
//! 2. `set_policy(user, threshold_bps)` — user signs their protection rule.
//! 3. `fund_reserve(user, amount)` — user deposits the protection reserve.
//! 4. `protect(user, current_hf_bps)` — permissionless; releases the reserve
//!    when `current_hf_bps < threshold_bps`.
//! 5. `withdraw_reserve(user, amount)` — user pulls funds back any time.

#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, token, Address, Env};

// ── Storage ──────────────────────────────────────────────────────────────────

#[contracttype]
pub enum DataKey {
    Admin,
    Token,
    Policy(Address),
    Reserve(Address),
}

#[contracttype]
#[derive(Clone)]
pub struct Policy {
    pub threshold_bps: u32,
    pub beneficiary: Address,
    pub active: bool,
}

// ── Events ───────────────────────────────────────────────────────────────────

#[contractevent(topics = ["guardian", "policy"])]
#[derive(Clone)]
pub struct PolicySet {
    #[topic]
    pub user: Address,
    pub threshold_bps: u32,
}

#[contractevent(topics = ["guardian", "funded"])]
#[derive(Clone)]
pub struct ReserveFunded {
    #[topic]
    pub user: Address,
    pub amount: i128,
    pub total: i128,
}

#[contractevent(topics = ["guardian", "withdrawn"])]
#[derive(Clone)]
pub struct ReserveWithdrawn {
    #[topic]
    pub user: Address,
    pub amount: i128,
}

#[contractevent(topics = ["guardian", "protected"])]
#[derive(Clone)]
pub struct Protected {
    #[topic]
    pub user: Address,
    pub amount: i128,
    pub current_hf_bps: u32,
    pub threshold_bps: u32,
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct Guardian;

#[contractimpl]
impl Guardian {
    /// One-time setup. `token` is the reserve asset contract (the native XLM
    /// Stellar Asset Contract in the deployed configuration).
    pub fn init(env: Env, admin: Address, token: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
    }

    /// Register or update the caller's protection policy. The beneficiary is
    /// fixed to the caller so released funds can never be redirected elsewhere.
    pub fn set_policy(env: Env, user: Address, threshold_bps: u32) {
        user.require_auth();
        let policy = Policy {
            threshold_bps,
            beneficiary: user.clone(),
            active: true,
        };
        env.storage()
            .persistent()
            .set(&DataKey::Policy(user.clone()), &policy);
        PolicySet {
            user,
            threshold_bps,
        }
        .publish(&env);
    }

    /// Deactivate the caller's policy without touching their reserve.
    pub fn cancel_policy(env: Env, user: Address) {
        user.require_auth();
        let mut policy = Self::get_policy(env.clone(), user.clone());
        policy.active = false;
        env.storage()
            .persistent()
            .set(&DataKey::Policy(user.clone()), &policy);
        PolicySet {
            user,
            threshold_bps: 0,
        }
        .publish(&env);
    }

    /// Deposit `amount` of the reserve asset into the caller's protection
    /// reserve. Pulls the tokens from the caller (requires their signature).
    pub fn fund_reserve(env: Env, user: Address, amount: i128) {
        user.require_auth();
        assert!(amount > 0, "amount must be positive");

        let token = Self::token_client(&env);
        token.transfer(&user, env.current_contract_address(), &amount);

        let total = Self::reserve_of(&env, &user) + amount;
        env.storage()
            .persistent()
            .set(&DataKey::Reserve(user.clone()), &total);
        ReserveFunded {
            user,
            amount,
            total,
        }
        .publish(&env);
    }

    /// Withdraw `amount` from the caller's reserve back to the caller.
    pub fn withdraw_reserve(env: Env, user: Address, amount: i128) {
        user.require_auth();
        assert!(amount > 0, "amount must be positive");

        let balance = Self::reserve_of(&env, &user);
        assert!(amount <= balance, "insufficient reserve");

        let token = Self::token_client(&env);
        token.transfer(&env.current_contract_address(), &user, &amount);

        env.storage()
            .persistent()
            .set(&DataKey::Reserve(user.clone()), &(balance - amount));
        ReserveWithdrawn { user, amount }.publish(&env);
    }

    /// Permissionless protection trigger. When `current_hf_bps` is below the
    /// user's policy threshold and a reserve exists, the full reserve is
    /// released to the policy beneficiary and a `Protected` event is emitted.
    /// Returns the released amount (0 when no action was taken).
    ///
    /// In production `current_hf_bps` is supplied by an oracle-backed keeper
    /// reacting to `risk_monitor`'s `AlertTriggered` events.
    pub fn protect(env: Env, user: Address, current_hf_bps: u32) -> i128 {
        let policy = Self::get_policy(env.clone(), user.clone());
        if !policy.active {
            return 0;
        }
        if current_hf_bps >= policy.threshold_bps {
            return 0;
        }

        let amount = Self::reserve_of(&env, &user);
        if amount <= 0 {
            return 0;
        }

        let token = Self::token_client(&env);
        token.transfer(
            &env.current_contract_address(),
            &policy.beneficiary,
            &amount,
        );
        env.storage()
            .persistent()
            .set(&DataKey::Reserve(user.clone()), &0i128);

        Protected {
            user,
            amount,
            current_hf_bps,
            threshold_bps: policy.threshold_bps,
        }
        .publish(&env);

        amount
    }

    // ── Views ────────────────────────────────────────────────────────────────

    pub fn get_policy(env: Env, user: Address) -> Policy {
        env.storage()
            .persistent()
            .get(&DataKey::Policy(user))
            .expect("no policy")
    }

    pub fn has_policy(env: Env, user: Address) -> bool {
        env.storage().persistent().has(&DataKey::Policy(user))
    }

    pub fn get_reserve(env: Env, user: Address) -> i128 {
        Self::reserve_of(&env, &user)
    }

    pub fn get_token(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized")
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    fn reserve_of(env: &Env, user: &Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Reserve(user.clone()))
            .unwrap_or(0)
    }

    fn token_client(env: &Env) -> token::TokenClient<'_> {
        let token: Address = env
            .storage()
            .instance()
            .get(&DataKey::Token)
            .expect("not initialized");
        token::TokenClient::new(env, &token)
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{
        testutils::{Address as _, Events as _},
        token::StellarAssetClient,
        Address, Env,
    };

    struct Harness {
        env: Env,
        guardian: GuardianClient<'static>,
        guardian_id: Address,
        token: token::TokenClient<'static>,
        user: Address,
    }

    fn setup() -> Harness {
        let env = Env::default();
        env.mock_all_auths();

        let admin = Address::generate(&env);
        let issuer = Address::generate(&env);
        let asset = env.register_stellar_asset_contract_v2(issuer);
        let token_id = asset.address();

        let user = Address::generate(&env);
        // Mint the user some reserve asset to deposit.
        StellarAssetClient::new(&env, &token_id).mint(&user, &1_000);

        let guardian_id = env.register(Guardian, ());
        let guardian = GuardianClient::new(&env, &guardian_id);
        guardian.init(&admin, &token_id);

        let token = token::TokenClient::new(&env, &token_id);
        Harness {
            env,
            guardian,
            guardian_id,
            token,
            user,
        }
    }

    #[test]
    fn set_policy_and_fund_reserve() {
        let h = setup();
        h.guardian.set_policy(&h.user, &12_000);
        assert!(h.guardian.has_policy(&h.user));
        assert_eq!(h.guardian.get_policy(&h.user).threshold_bps, 12_000);

        h.guardian.fund_reserve(&h.user, &400);
        assert_eq!(h.guardian.get_reserve(&h.user), 400);
        // Tokens actually moved into the guardian.
        assert_eq!(h.token.balance(&h.guardian_id), 400);
        assert_eq!(h.token.balance(&h.user), 600);
    }

    #[test]
    fn protect_releases_reserve_when_breached() {
        let h = setup();
        h.guardian.set_policy(&h.user, &12_000);
        h.guardian.fund_reserve(&h.user, &400);

        // current HF 110% < 120% threshold → protection fires.
        let released = h.guardian.protect(&h.user, &11_000);
        assert_eq!(released, 400);
        assert_eq!(h.guardian.get_reserve(&h.user), 0);
        // Reserve returned to the user (the beneficiary).
        assert_eq!(h.token.balance(&h.user), 1_000);
        assert_eq!(h.token.balance(&h.guardian_id), 0);
    }

    #[test]
    fn set_policy_emits_event() {
        let h = setup();
        h.guardian.set_policy(&h.user, &12_000);
        let count = h
            .env
            .events()
            .all()
            .filter_by_contract(&h.guardian_id)
            .events()
            .len();
        assert_eq!(count, 1);
    }

    #[test]
    fn protect_noop_when_safe() {
        let h = setup();
        h.guardian.set_policy(&h.user, &12_000);
        h.guardian.fund_reserve(&h.user, &400);

        // current HF 130% >= 120% → nothing happens.
        let released = h.guardian.protect(&h.user, &13_000);
        assert_eq!(released, 0);
        assert_eq!(h.guardian.get_reserve(&h.user), 400);
    }

    #[test]
    fn protect_noop_when_inactive() {
        let h = setup();
        h.guardian.set_policy(&h.user, &12_000);
        h.guardian.fund_reserve(&h.user, &400);
        h.guardian.cancel_policy(&h.user);

        assert_eq!(h.guardian.protect(&h.user, &11_000), 0);
        assert_eq!(h.guardian.get_reserve(&h.user), 400);
    }

    #[test]
    fn withdraw_reserve_returns_funds() {
        let h = setup();
        h.guardian.set_policy(&h.user, &12_000);
        h.guardian.fund_reserve(&h.user, &400);

        h.guardian.withdraw_reserve(&h.user, &150);
        assert_eq!(h.guardian.get_reserve(&h.user), 250);
        assert_eq!(h.token.balance(&h.user), 750);
    }
}
