#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation},
    Address, Env, Symbol,
};

fn setup_escrow(env: &Env) -> (FusionPlusEscrow, Address, Address, Address, Address, BytesN<32>, BytesN<32>, i128, i128) {
    let escrow = FusionPlusEscrow;
    let maker = Address::generate(env);
    let taker = Address::generate(env);
    let token = Address::generate(env);
    let order_hash = BytesN::from_array(env, &[1u8; 32]);
    let hash_lock = BytesN::from_array(env, &[2u8; 32]);
    let amount = 1000000;
    let safety_deposit = 100000;

    let timelocks = TimelockParams {
        finality: 60,
        src_withdrawal: 120,
        src_public_withdrawal: 180,
        src_cancellation: 240,
        src_public_cancellation: 300,
        dst_withdrawal: 360,
        dst_public_withdrawal: 420,
        dst_cancellation: 480,
    };

    let init_params = InitParams {
        order_hash: order_hash.clone(),
        hash_lock: hash_lock.clone(),
        maker: maker.clone(),
        taker: taker.clone(),
        token: token.clone(),
        amount,
        safety_deposit,
        timelocks,
    };

    escrow.initialize(env, init_params).unwrap();

    (escrow, maker, taker, token, order_hash, hash_lock, amount, safety_deposit)
}

#[test]
fn test_initialize() {
    let env = Env::default();
    let escrow = FusionPlusEscrow;
    let maker = Address::generate(&env);
    let taker = Address::generate(&env);
    let token = Address::generate(&env);
    let order_hash = BytesN::from_array(&env, &[1u8; 32]);
    let hash_lock = BytesN::from_array(&env, &[2u8; 32]);
    let amount = 1000000;
    let safety_deposit = 100000;

    let timelocks = TimelockParams {
        finality: 60,
        src_withdrawal: 120,
        src_public_withdrawal: 180,
        src_cancellation: 240,
        src_public_cancellation: 300,
        dst_withdrawal: 360,
        dst_public_withdrawal: 420,
        dst_cancellation: 480,
    };

    let init_params = InitParams {
        order_hash: order_hash.clone(),
        hash_lock: hash_lock.clone(),
        maker: maker.clone(),
        taker: taker.clone(),
        token: token.clone(),
        amount,
        safety_deposit,
        timelocks,
    };

    // Initialize escrow
    escrow.initialize(&env, init_params).unwrap();

    // Verify initialization
    assert!(env.storage().instance().has(&DataKey::Immutables));
    assert!(!escrow.is_withdrawn_status(&env).unwrap());
    assert!(!escrow.is_cancelled_status(&env).unwrap());

    // Verify immutable data
    let immutables = escrow.get_immutables(&env).unwrap();
    assert_eq!(immutables.order_hash, order_hash);
    assert_eq!(immutables.hash_lock, hash_lock);
    assert_eq!(immutables.maker, maker);
    assert_eq!(immutables.taker, taker);
    assert_eq!(immutables.token, token);
    assert_eq!(immutables.amount, amount);
    assert_eq!(immutables.safety_deposit, safety_deposit);

    // Verify event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 1);
    let event = &events[0];
    assert_eq!(event.topics[0], Symbol::new(&env, "EscrowCreated"));
}

#[test]
#[should_panic(expected = "AlreadyInitialized")]
fn test_initialize_twice() {
    let env = Env::default();
    let (escrow, _, _, _, _, _, _, _) = setup_escrow(&env);

    // Try to initialize again - should fail
    let maker = Address::generate(&env);
    let taker = Address::generate(&env);
    let token = Address::generate(&env);
    let order_hash = BytesN::from_array(&env, &[3u8; 32]);
    let hash_lock = BytesN::from_array(&env, &[4u8; 32]);
    let amount = 2000000;
    let safety_deposit = 200000;

    let timelocks = TimelockParams {
        finality: 60,
        src_withdrawal: 120,
        src_public_withdrawal: 180,
        src_cancellation: 240,
        src_public_cancellation: 300,
        dst_withdrawal: 360,
        dst_public_withdrawal: 420,
        dst_cancellation: 480,
    };

    let init_params = InitParams {
        order_hash,
        hash_lock,
        maker,
        taker,
        token,
        amount,
        safety_deposit,
        timelocks,
    };

    escrow.initialize(&env, init_params).unwrap();
}

#[test]
#[should_panic(expected = "InvalidParams")]
fn test_initialize_invalid_amount() {
    let env = Env::default();
    let escrow = FusionPlusEscrow;
    let maker = Address::generate(&env);
    let taker = Address::generate(&env);
    let token = Address::generate(&env);
    let order_hash = BytesN::from_array(&env, &[1u8; 32]);
    let hash_lock = BytesN::from_array(&env, &[2u8; 32]);
    let amount = 0; // Invalid amount
    let safety_deposit = 100000;

    let timelocks = TimelockParams {
        finality: 60,
        src_withdrawal: 120,
        src_public_withdrawal: 180,
        src_cancellation: 240,
        src_public_cancellation: 300,
        dst_withdrawal: 360,
        dst_public_withdrawal: 420,
        dst_cancellation: 480,
    };

    let init_params = InitParams {
        order_hash,
        hash_lock,
        maker,
        taker,
        token,
        amount,
        safety_deposit,
        timelocks,
    };

    escrow.initialize(&env, init_params).unwrap();
}

#[test]
#[should_panic(expected = "InvalidParams")]
fn test_initialize_invalid_timelocks() {
    let env = Env::default();
    let escrow = FusionPlusEscrow;
    let maker = Address::generate(&env);
    let taker = Address::generate(&env);
    let token = Address::generate(&env);
    let order_hash = BytesN::from_array(&env, &[1u8; 32]);
    let hash_lock = BytesN::from_array(&env, &[2u8; 32]);
    let amount = 1000000;
    let safety_deposit = 100000;

    let timelocks = TimelockParams {
        finality: 120,
        src_withdrawal: 60, // Invalid: src_withdrawal <= finality
        src_public_withdrawal: 180,
        src_cancellation: 240,
        src_public_cancellation: 300,
        dst_withdrawal: 360,
        dst_public_withdrawal: 420,
        dst_cancellation: 480,
    };

    let init_params = InitParams {
        order_hash,
        hash_lock,
        maker,
        taker,
        token,
        amount,
        safety_deposit,
        timelocks,
    };

    escrow.initialize(&env, init_params).unwrap();
}

#[test]
fn test_deposit() {
    let env = Env::default();
    let (escrow, maker, _, _, _, _, _, _) = setup_escrow(&env);

    // Mock auth for maker
    env.mock_all_auths();

    // Deposit should succeed
    escrow.deposit(&env).unwrap();
}

#[test]
#[should_panic(expected = "Unauthorized")]
fn test_deposit_unauthorized() {
    let env = Env::default();
    let (escrow, _, taker, _, _, _, _, _) = setup_escrow(&env);

    // Mock auth for taker (not maker) - should fail
    env.mock_auths(&[&taker]);

    escrow.deposit(&env).unwrap();
}

#[test]
fn test_withdraw() {
    let env = Env::default();
    let (escrow, _, taker, _, _, hash_lock, _, _) = setup_escrow(&env);

    // Mock auth for taker
    env.mock_all_auths();

    // Create a valid secret (hash of which equals hash_lock)
    let secret = BytesN::from_array(&env, &[3u8; 32]);
    
    // Mock the keccak256 function to return the expected hash
    env.mock_crypto().keccak256.return_value = hash_lock;

    // Withdraw should succeed
    escrow.withdraw(&env, &secret).unwrap();

    // Verify escrow is withdrawn
    assert!(escrow.is_withdrawn_status(&env).unwrap());
    assert!(!escrow.is_cancelled_status(&env).unwrap());

    // Verify event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 2); // EscrowCreated + Withdrawal
    let event = &events[1];
    assert_eq!(event.topics[0], Symbol::new(&env, "Withdrawal"));
}

#[test]
#[should_panic(expected = "InvalidSecret")]
fn test_withdraw_invalid_secret() {
    let env = Env::default();
    let (escrow, _, _, _, _, _, _, _) = setup_escrow(&env);

    // Mock auth for taker
    env.mock_all_auths();

    // Create an invalid secret
    let secret = BytesN::from_array(&env, &[3u8; 32]);
    
    // Mock the keccak256 function to return a different hash
    env.mock_crypto().keccak256.return_value = BytesN::from_array(&env, &[4u8; 32]);

    escrow.withdraw(&env, &secret).unwrap();
}

#[test]
#[should_panic(expected = "AlreadyWithdrawn")]
fn test_withdraw_twice() {
    let env = Env::default();
    let (escrow, _, _, _, _, hash_lock, _, _) = setup_escrow(&env);

    // Mock auth for taker
    env.mock_all_auths();

    // Create a valid secret
    let secret = BytesN::from_array(&env, &[3u8; 32]);
    
    // Mock the keccak256 function
    env.mock_crypto().keccak256.return_value = hash_lock;

    // First withdrawal should succeed
    escrow.withdraw(&env, &secret).unwrap();

    // Second withdrawal should fail
    escrow.withdraw(&env, &secret).unwrap();
}

#[test]
fn test_public_withdraw() {
    let env = Env::default();
    let (escrow, _, _, _, _, hash_lock, _, _) = setup_escrow(&env);
    let caller = Address::generate(&env);

    // Mock auth for caller
    env.mock_all_auths();

    // Create a valid secret
    let secret = BytesN::from_array(&env, &[3u8; 32]);
    
    // Mock the keccak256 function
    env.mock_crypto().keccak256.return_value = hash_lock;

    // Public withdrawal should succeed
    escrow.public_withdraw(&env, &secret, &caller).unwrap();

    // Verify escrow is withdrawn
    assert!(escrow.is_withdrawn_status(&env).unwrap());
    assert!(!escrow.is_cancelled_status(&env).unwrap());

    // Verify event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 2); // EscrowCreated + Withdrawal
    let event = &events[1];
    assert_eq!(event.topics[0], Symbol::new(&env, "Withdrawal"));
}

#[test]
fn test_cancel() {
    let env = Env::default();
    let (escrow, maker, _, _, _, _, _, _) = setup_escrow(&env);

    // Mock auth for maker
    env.mock_all_auths();

    // Cancel should succeed
    escrow.cancel(&env, &maker).unwrap();

    // Verify escrow is cancelled
    assert!(!escrow.is_withdrawn_status(&env).unwrap());
    assert!(escrow.is_cancelled_status(&env).unwrap());

    // Verify event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 2); // EscrowCreated + EscrowCancelled
    let event = &events[1];
    assert_eq!(event.topics[0], Symbol::new(&env, "EscrowCancelled"));
}

#[test]
fn test_public_cancel() {
    let env = Env::default();
    let (escrow, _, _, _, _, _, _, _) = setup_escrow(&env);
    let caller = Address::generate(&env);

    // Mock auth for caller
    env.mock_all_auths();

    // Public cancel should succeed
    escrow.public_cancel(&env, &caller).unwrap();

    // Verify escrow is cancelled
    assert!(!escrow.is_withdrawn_status(&env).unwrap());
    assert!(escrow.is_cancelled_status(&env).unwrap());

    // Verify event was emitted
    let events = env.events().all();
    assert_eq!(events.len(), 2); // EscrowCreated + EscrowCancelled
    let event = &events[1];
    assert_eq!(event.topics[0], Symbol::new(&env, "EscrowCancelled"));
}

#[test]
#[should_panic(expected = "AlreadyCancelled")]
fn test_cancel_twice() {
    let env = Env::default();
    let (escrow, maker, _, _, _, _, _, _) = setup_escrow(&env);

    // Mock auth for maker
    env.mock_all_auths();

    // First cancellation should succeed
    escrow.cancel(&env, &maker).unwrap();

    // Second cancellation should fail
    escrow.cancel(&env, &maker).unwrap();
}

#[test]
#[should_panic(expected = "AlreadyWithdrawn")]
fn test_cancel_after_withdrawal() {
    let env = Env::default();
    let (escrow, maker, _, _, _, hash_lock, _, _) = setup_escrow(&env);

    // Mock auth for maker and taker
    env.mock_all_auths();

    // First withdraw
    let secret = BytesN::from_array(&env, &[3u8; 32]);
    env.mock_crypto().keccak256.return_value = hash_lock;
    escrow.withdraw(&env, &secret).unwrap();

    // Then try to cancel - should fail
    escrow.cancel(&env, &maker).unwrap();
}

#[test]
fn test_get_revealed_secret() {
    let env = Env::default();
    let (escrow, _, _, _, _, hash_lock, _, _) = setup_escrow(&env);

    // Mock auth for taker
    env.mock_all_auths();

    // Create a valid secret
    let secret = BytesN::from_array(&env, &[3u8; 32]);
    
    // Mock the keccak256 function
    env.mock_crypto().keccak256.return_value = hash_lock;

    // Withdraw to reveal secret
    escrow.withdraw(&env, &secret).unwrap();

    // Get revealed secret should succeed
    let revealed_secret = escrow.get_revealed_secret(&env).unwrap();
    assert_eq!(revealed_secret, secret);
}

#[test]
#[should_panic(expected = "InvalidTime")]
fn test_get_revealed_secret_before_withdrawal() {
    let env = Env::default();
    let (escrow, _, _, _, _, _, _, _) = setup_escrow(&env);

    // Try to get revealed secret before withdrawal - should fail
    escrow.get_revealed_secret(&env).unwrap();
}

#[test]
fn test_keccak256() {
    let env = Env::default();
    let escrow = FusionPlusEscrow;
    let data = BytesN::from_array(&env, &[1u8; 32]);
    let expected_hash = BytesN::from_array(&env, &[2u8; 32]);

    // Mock the keccak256 function
    env.mock_crypto().keccak256.return_value = expected_hash;

    // Test keccak256 function
    let result = escrow.keccak256(&env, &data);
    assert_eq!(result, expected_hash);
}