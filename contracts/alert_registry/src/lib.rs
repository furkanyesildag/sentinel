#![no_std]
use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct AlertRegistry;

#[contractimpl]
impl AlertRegistry {
    /// Placeholder entrypoint for Yellow Belt alert registry work.
    pub fn hello(env: Env, to: Symbol) -> Symbol {
        let greeting = Symbol::new(&env, "hello");
        let _ = to;
        greeting
    }
}

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{Env, Symbol};

    #[test]
    fn hello_returns_greeting() {
        let env = Env::default();
        let contract_id = env.register(AlertRegistry, ());
        let client = AlertRegistryClient::new(&env, &contract_id);
        let result = client.hello(&Symbol::new(&env, "world"));
        assert_eq!(result, Symbol::new(&env, "hello"));
    }
}
