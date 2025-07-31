#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env, BytesN};

#[test]
fn test_initialize_factory() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarEscrowFactory);
    let client = StellarEscrowFactoryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let escrow_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);

    // Initialize should succeed
    client.initialize(&escrow_wasm_hash, &admin);

    // Verify configuration
    assert_eq!(client.get_admin(), admin);
    assert_eq!(client.get_escrow_wasm_hash(), escrow_wasm_hash);

    // Second initialization should fail
    let result = client.try_initialize(&escrow_wasm_hash, &admin);
    assert!(result.is_err());
}

#[test]
fn test_compute_escrow_address() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, StellarEscrowFactory);
    let client = StellarEscrowFactoryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let escrow_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
    let maker = Address::generate(&env);
    let hash_lock = BytesN::from_array(&env, &[2u8; 32]);

    client.initialize(&escrow_wasm_hash, &admin);

    // Compute address should work
    let predicted_address = client.compute_escrow_address(&hash_lock, &maker);
    assert!(predicted_address.is_ok());

    // Same parameters should give same address
    let predicted_address_2 = client.compute_escrow_address(&hash_lock, &maker);
    assert_eq!(predicted_address, predicted_address_2);
}

#[test]
fn test_escrow_exists() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarEscrowFactory);
    let client = StellarEscrowFactoryClient::new(&env, &contract_id);

    let hash_lock = BytesN::from_array(&env, &[1u8; 32]);

    // Initially should not exist
    assert!(!client.escrow_exists(&hash_lock));

    // After creation should exist (this test would need actual escrow deployment)
    // For now, just test the lookup function
    let result = client.try_get_escrow_id(&hash_lock);
    assert!(result.is_err()); // Should be EscrowNotFound
}

#[test]
fn test_admin_functions() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, StellarEscrowFactory);
    let client = StellarEscrowFactoryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let escrow_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
    let new_wasm_hash = BytesN::from_array(&env, &[2u8; 32]);

    client.initialize(&escrow_wasm_hash, &admin);

    // Update WASM hash
    client.update_escrow_wasm_hash(&new_wasm_hash);
    assert_eq!(client.get_escrow_wasm_hash(), new_wasm_hash);

    // Transfer admin
    client.transfer_admin(&new_admin);
    assert_eq!(client.get_admin(), new_admin);
}

#[test]
fn test_unauthorized_access() {
    let env = Env::default();
    
    let contract_id = env.register_contract(None, StellarEscrowFactory);
    let client = StellarEscrowFactoryClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let non_admin = Address::generate(&env);
    let escrow_wasm_hash = BytesN::from_array(&env, &[1u8; 32]);
    let new_wasm_hash = BytesN::from_array(&env, &[2u8; 32]);

    // Mock auth for admin
    env.mock_auths(&[&admin]);
    client.initialize(&escrow_wasm_hash, &admin);

    // Try to update as non-admin (should fail)
    env.mock_auths(&[&non_admin]);
    let result = client.try_update_escrow_wasm_hash(&new_wasm_hash);
    assert!(result.is_err());

    // Try to transfer admin as non-admin (should fail)
    let result = client.try_transfer_admin(&non_admin);
    assert!(result.is_err());
}