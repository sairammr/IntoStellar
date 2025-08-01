#![cfg(test)]

use super::*;
use soroban_sdk::{
    symbol_short, vec, Address, Bytes, BytesN, Env, Symbol,
};

#[test]
fn test_initialize() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarLimitOrderProtocol);
    let client = StellarLimitOrderProtocolClient::new(&env, &contract_id);

    client.initialize();
    
    // Verify storage is initialized
    assert!(env.storage().instance().has(&StellarLimitOrderProtocol::BIT_INVALIDATOR));
    assert!(env.storage().instance().has(&StellarLimitOrderProtocol::REMAINING_INVALIDATOR));
    assert!(env.storage().instance().has(&StellarLimitOrderProtocol::ORDERS));
}

#[test]
fn test_hash_order() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarLimitOrderProtocol);
    let client = StellarLimitOrderProtocolClient::new(&env, &contract_id);

    let maker = Address::generate(&env);
    let receiver = Address::generate(&env);
    let maker_asset = Address::generate(&env);
    let taker_asset = Address::generate(&env);

    let order = Order {
        salt: 12345,
        maker: maker.clone(),
        receiver: receiver.clone(),
        maker_asset: maker_asset.clone(),
        taker_asset: taker_asset.clone(),
        making_amount: 1000,
        taking_amount: 500,
        maker_traits: 0,
    };

    let hash1 = client.hash_order(&order);
    let hash2 = client.hash_order(&order);
    
    // Same order should produce same hash
    assert_eq!(hash1, hash2);
}

#[test]
fn test_fill_order_basic() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarLimitOrderProtocol);
    let client = StellarLimitOrderProtocolClient::new(&env, &contract_id);

    client.initialize();

    let maker = Address::generate(&env);
    let receiver = Address::generate(&env);
    let maker_asset = Address::generate(&env);
    let taker_asset = Address::generate(&env);
    let taker = Address::generate(&env);

    let order = Order {
        salt: env.ledger().timestamp() + 3600, // Future timestamp
        maker: maker.clone(),
        receiver: receiver.clone(),
        maker_asset: maker_asset.clone(),
        taker_asset: taker_asset.clone(),
        making_amount: 1000,
        taking_amount: 500,
        maker_traits: 0,
    };

    let signature = Bytes::from_slice(&env, &[0u8; 64]); // Mock signature
    let taker_traits = TakerTraits {
        threshold: 1000,
        skip_maker_permit: false,
    };

    let result = client.fill_order(&order, &signature, &taker, &100, &taker_traits);
    
    // Should succeed (though signature verification is mocked)
    assert!(result.is_ok());
    
    let (making_amount, taking_amount, order_hash) = result.unwrap();
    assert_eq!(making_amount, 200); // (100 * 1000) / 500
    assert_eq!(taking_amount, 100);
    assert_eq!(order_hash.len(), 32);
}

#[test]
fn test_cancel_order() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarLimitOrderProtocol);
    let client = StellarLimitOrderProtocolClient::new(&env, &contract_id);

    client.initialize();

    let maker = Address::generate(&env);
    let order_hash = BytesN::from_array(&env, &[1u8; 32]);

    // Mock auth for maker
    env.mock_all_auths();

    let result = client.cancel_order(&maker, &order_hash);
    assert!(result.is_ok());

    // Check remaining amount is 0 (cancelled)
    let remaining = client.remaining_invalidator_for_order(&maker, &order_hash);
    assert_eq!(remaining, 0);
}

#[test]
fn test_order_expired() {
    let env = Env::default();
    let contract_id = env.register_contract(None, StellarLimitOrderProtocol);
    let client = StellarLimitOrderProtocolClient::new(&env, &contract_id);

    client.initialize();

    let maker = Address::generate(&env);
    let receiver = Address::generate(&env);
    let maker_asset = Address::generate(&env);
    let taker_asset = Address::generate(&env);
    let taker = Address::generate(&env);

    let order = Order {
        salt: env.ledger().timestamp() - 3600, // Past timestamp (expired)
        maker: maker.clone(),
        receiver: receiver.clone(),
        maker_asset: maker_asset.clone(),
        taker_asset: taker_asset.clone(),
        making_amount: 1000,
        taking_amount: 500,
        maker_traits: 0,
    };

    let signature = Bytes::from_slice(&env, &[0u8; 64]);
    let taker_traits = TakerTraits {
        threshold: 1000,
        skip_maker_permit: false,
    };

    let result = client.fill_order(&order, &signature, &taker, &100, &taker_traits);
    
    // Should fail due to expired order
    assert!(result.is_err());
} 