#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env, BytesN};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, FusionPlusEscrow);
    let client = FusionPlusEscrowClient::new(&env, &contract_id);

    // Initialize should succeed
    client.initialize();

    // Second initialization should fail
    let result = client.try_initialize();
    assert!(result.is_err());
}

#[test]
fn test_deposit_and_withdraw() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, FusionPlusEscrow);
    let client = FusionPlusEscrowClient::new(&env, &contract_id);

    // Initialize contract
    client.initialize();

    let maker = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token = Address::generate(&env); // Using a mock token address
    
    // Create a test secret and its hash
    let secret = BytesN::from_array(&env, &[1u8; 32]);
    let hash_lock = env.crypto().keccak256(&secret.to_array()).into();

    // Set current time
    env.ledger().with_mut(|li| li.timestamp = 1000);

    // Deposit
    client.deposit(
        &hash_lock,
        &resolver,
        &token,
        &1000i128,      // amount
        &3600u64,       // withdrawal_delay (1 hour)
        &7200u64,       // cancellation_delay (2 hours)
        &100i128,       // safety_deposit
    );

    // Verify escrow was created
    assert!(client.escrow_exists(&hash_lock));
    
    let escrow_data = client.get_escrow_data(&hash_lock);
    assert_eq!(escrow_data.maker, maker);
    assert_eq!(escrow_data.resolver, resolver);
    assert_eq!(escrow_data.amount, 1000i128);
    assert_eq!(escrow_data.safety_deposit, 100i128);
    assert!(!escrow_data.withdrawn);
    assert!(!escrow_data.cancelled);

    // Fast forward to withdrawal time
    env.ledger().with_mut(|li| li.timestamp = 4700); // 1000 + 3600 + 100

    // Withdraw with correct secret
    client.withdraw(&hash_lock, &secret);

    // Verify withdrawal
    let escrow_data = client.get_escrow_data(&hash_lock);
    assert!(escrow_data.withdrawn);
    assert!(!escrow_data.cancelled);
}

#[test]
fn test_invalid_secret() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, FusionPlusEscrow);
    let client = FusionPlusEscrowClient::new(&env, &contract_id);

    client.initialize();

    let resolver = Address::generate(&env);
    let token = Address::generate(&env);
    
    let secret = BytesN::from_array(&env, &[1u8; 32]);
    let wrong_secret = BytesN::from_array(&env, &[2u8; 32]);
    let hash_lock = env.crypto().keccak256(&secret.to_array()).into();

    env.ledger().with_mut(|li| li.timestamp = 1000);

    client.deposit(
        &hash_lock,
        &resolver,
        &token,
        &1000i128,
        &3600u64,
        &7200u64,
        &100i128,
    );

    // Fast forward to withdrawal time
    env.ledger().with_mut(|li| li.timestamp = 4700);

    // Try to withdraw with wrong secret
    let result = client.try_withdraw(&hash_lock, &wrong_secret);
    assert!(result.is_err());
}

#[test]
fn test_cancel_escrow() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, FusionPlusEscrow);
    let client = FusionPlusEscrowClient::new(&env, &contract_id);

    client.initialize();

    let maker = Address::generate(&env);
    let resolver = Address::generate(&env);
    let token = Address::generate(&env);
    
    let secret = BytesN::from_array(&env, &[1u8; 32]);
    let hash_lock = env.crypto().keccak256(&secret.to_array()).into();

    env.ledger().with_mut(|li| li.timestamp = 1000);

    client.deposit(
        &hash_lock,
        &resolver,
        &token,
        &1000i128,
        &3600u64,
        &7200u64,
        &100i128,
    );

    // Fast forward past cancellation time
    env.ledger().with_mut(|li| li.timestamp = 8300); // 1000 + 7200 + 100

    // Cancel escrow
    client.cancel(&hash_lock);

    // Verify cancellation
    let escrow_data = client.get_escrow_data(&hash_lock);
    assert!(!escrow_data.withdrawn);
    assert!(escrow_data.cancelled);
}

#[test]
fn test_timing_constraints() {
    let env = Env::default();
    env.mock_all_auths();
    
    let contract_id = env.register_contract(None, FusionPlusEscrow);
    let client = FusionPlusEscrowClient::new(&env, &contract_id);

    client.initialize();

    let resolver = Address::generate(&env);
    let token = Address::generate(&env);
    
    let secret = BytesN::from_array(&env, &[1u8; 32]);
    let hash_lock = env.crypto().keccak256(&secret.to_array()).into();

    env.ledger().with_mut(|li| li.timestamp = 1000);

    client.deposit(
        &hash_lock,
        &resolver,
        &token,
        &1000i128,
        &3600u64,
        &7200u64,
        &100i128,
    );

    // Try to withdraw before withdrawal time
    env.ledger().with_mut(|li| li.timestamp = 2000); // Before withdrawal time

    let result = client.try_withdraw(&hash_lock, &secret);
    assert!(result.is_err());

    // Try to cancel before cancellation time
    let result = client.try_cancel(&hash_lock);
    assert!(result.is_err());
}