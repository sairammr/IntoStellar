#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, Symbol,
};

#[test]
fn test_initialize() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let wasm_hash = BytesN::from_array(&env, &[1u8; 32]);

    // Initialize factory
    StellarEscrowFactory::initialize(env, wasm_hash, admin).unwrap();
}

#[test]
fn test_escrow_exists_before_creation() {
    let env = Env::default();
    let hash_lock = BytesN::from_array(&env, &[3u8; 32]);

    // Check escrow doesn't exist before creation
    assert!(!StellarEscrowFactory::escrow_exists(env, hash_lock));
}

#[test]
fn test_get_escrow_address_not_found() {
    let env = Env::default();
    let hash_lock = BytesN::from_array(&env, &[3u8; 32]);

    // Try to get escrow address for non-existent escrow - should fail
    let result = StellarEscrowFactory::get_escrow_address(env, hash_lock);
    assert!(result.is_err());
    assert_eq!(result.unwrap_err(), Error::EscrowNotFound);
}