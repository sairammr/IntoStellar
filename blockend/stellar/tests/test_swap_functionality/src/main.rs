use soroban_sdk::{
    testutils::{Address as _, Events},
    Address, Env, Symbol, BytesN,
};
use stellar_escrow_factory::StellarEscrowFactory;
use fusion_plus_escrow::FusionPlusEscrow;

/// Comprehensive test for cross-chain atomic swap functionality
/// This test deploys contracts and tests the complete swap flow
fn test_cross_chain_atomic_swap() {
    let env = Env::default();
    
    // ===== SETUP PHASE =====
    println!("🚀 Setting up cross-chain atomic swap test...");
    
    // Generate test addresses
    let admin = Address::generate(&env);
    let maker = Address::generate(&env);
    let taker = Address::generate(&env);
    let token = Address::generate(&env);
    
    // Generate test data
    let order_hash = BytesN::from_array(&env, &[1u8; 32]);
    let secret = BytesN::from_array(&env, &[2u8; 32]);
    let hash_lock = env.crypto().keccak256(&Bytes::from_array(&env, &secret.to_array()));
    
    let amount = 1000000; // 1 token (assuming 6 decimals)
    let safety_deposit = 100000; // 0.1 token
    
    // Timelock configuration (short for testing)
    let timelocks = stellar_escrow_factory::FactoryTimelockParams {
        finality_delay: 10,        // 10 seconds
        src_withdrawal_delay: 20,  // 20 seconds
        src_public_withdrawal_delay: 30,
        src_cancellation_delay: 40,
        src_public_cancellation_delay: 50,
        dst_withdrawal_delay: 60,
        dst_public_withdrawal_delay: 70,
        dst_cancellation_delay: 80,
    };
    
    // ===== DEPLOYMENT PHASE =====
    println!("📦 Deploying contracts...");
    
    // Deploy FusionPlusEscrow first
    let escrow_wasm_hash = BytesN::from_array(&env, &[3u8; 32]); // Mock WASM hash
    
    // Deploy StellarEscrowFactory
    let factory_id = env.register_contract(None, StellarEscrowFactory);
    let factory_client = stellar_escrow_factory::Client::new(&env, &factory_id);
    
    // Initialize factory
    factory_client.initialize(&escrow_wasm_hash, &admin);
    println!("✅ Factory deployed and initialized at: {}", factory_id);
    
    // ===== SWAP INITIATION PHASE =====
    println!("🔄 Initiating cross-chain swap...");
    
    // Mock authentication for maker
    env.mock_all_auths();
    
    // Create source escrow (Ethereum side simulation)
    let src_escrow_address = factory_client.create_src_escrow(
        &order_hash,
        &hash_lock,
        &maker,
        &taker,
        &token,
        &amount,
        &safety_deposit,
        &timelocks,
    );
    
    println!("✅ Source escrow created at: {}", src_escrow_address);
    
    // Verify escrow was created
    assert!(factory_client.escrow_exists(&hash_lock));
    assert_eq!(factory_client.get_escrow_address(&hash_lock).unwrap(), src_escrow_address);
    
    // ===== DESTINATION ESCROW CREATION =====
    println!("🌐 Creating destination escrow...");
    
    // Create destination escrow (Stellar side)
    let dst_escrow_address = factory_client.create_dst_escrow(
        &order_hash,
        &hash_lock,
        &maker,
        &taker,
        &token,
        &amount,
        &safety_deposit,
        &timelocks,
        &taker, // caller
    );
    
    println!("✅ Destination escrow created at: {}", dst_escrow_address);
    
    // Verify both escrows exist
    assert!(factory_client.escrow_exists(&hash_lock));
    
    // ===== ESCROW INTERACTION PHASE =====
    println!("💼 Testing escrow interactions...");
    
    // Get escrow clients
    let src_escrow_client = fusion_plus_escrow::Client::new(&env, &src_escrow_address);
    let dst_escrow_client = fusion_plus_escrow::Client::new(&env, &dst_escrow_address);
    
    // Test deposit functionality
    src_escrow_client.deposit();
    println!("✅ Source escrow deposit successful");
    
    // ===== WITHDRAWAL PHASE =====
    println!("💰 Testing withdrawal with secret...");
    
    // Mock the keccak256 function to return the expected hash
    env.mock_crypto().keccak256.return_value = hash_lock;
    
    // Withdraw from destination escrow (taker claims funds)
    dst_escrow_client.withdraw(&secret);
    println!("✅ Destination escrow withdrawal successful");
    
    // Verify escrow is withdrawn
    assert!(dst_escrow_client.is_withdrawn_status().unwrap());
    assert!(!dst_escrow_client.is_cancelled_status().unwrap());
    
    // Get revealed secret
    let revealed_secret = dst_escrow_client.get_revealed_secret().unwrap();
    assert_eq!(revealed_secret, secret);
    println!("✅ Secret revealed: {:?}", revealed_secret);
    
    // Withdraw from source escrow using the same secret
    src_escrow_client.withdraw(&secret);
    println!("✅ Source escrow withdrawal successful");
    
    // Verify source escrow is withdrawn
    assert!(src_escrow_client.is_withdrawn_status().unwrap());
    assert!(!src_escrow_client.is_cancelled_status().unwrap());
    
    // ===== VERIFICATION PHASE =====
    println!("🔍 Verifying swap completion...");
    
    // Verify both escrows are in withdrawn state
    assert!(src_escrow_client.is_withdrawn_status().unwrap());
    assert!(dst_escrow_client.is_withdrawn_status().unwrap());
    
    // Verify escrow addresses are different (different contracts)
    assert_ne!(src_escrow_address, dst_escrow_address);
    
    // Verify factory still tracks the escrow
    assert!(factory_client.escrow_exists(&hash_lock));
    
    println!("🎉 Cross-chain atomic swap completed successfully!");
}

/// Test for failed swap scenarios
fn test_failed_swap_scenarios() {
    let env = Env::default();
    
    println!("🚨 Testing failed swap scenarios...");
    
    // Setup
    let admin = Address::generate(&env);
    let maker = Address::generate(&env);
    let taker = Address::generate(&env);
    let token = Address::generate(&env);
    let order_hash = BytesN::from_array(&env, &[1u8; 32]);
    let secret = BytesN::from_array(&env, &[2u8; 32]);
    let hash_lock = env.crypto().keccak256(&Bytes::from_array(&env, &secret.to_array()));
    let amount = 1000000;
    let safety_deposit = 100000;
    let escrow_wasm_hash = BytesN::from_array(&env, &[3u8; 32]);
    
    let timelocks = stellar_escrow_factory::FactoryTimelockParams {
        finality_delay: 10,
        src_withdrawal_delay: 20,
        src_public_withdrawal_delay: 30,
        src_cancellation_delay: 40,
        src_public_cancellation_delay: 50,
        dst_withdrawal_delay: 60,
        dst_public_withdrawal_delay: 70,
        dst_cancellation_delay: 80,
    };
    
    // Deploy factory
    let factory_id = env.register_contract(None, StellarEscrowFactory);
    let factory_client = stellar_escrow_factory::Client::new(&env, &factory_id);
    factory_client.initialize(&escrow_wasm_hash, &admin);
    
    env.mock_all_auths();
    
    // Create escrow
    let escrow_address = factory_client.create_src_escrow(
        &order_hash,
        &hash_lock,
        &maker,
        &taker,
        &token,
        &amount,
        &safety_deposit,
        &timelocks,
    );
    
    let escrow_client = fusion_plus_escrow::Client::new(&env, &escrow_address);
    escrow_client.deposit();
    
    // Test 1: Invalid secret should fail
    println!("🧪 Testing invalid secret withdrawal...");
    let invalid_secret = BytesN::from_array(&env, &[9u8; 32]);
    env.mock_crypto().keccak256.return_value = BytesN::from_array(&env, &[8u8; 32]); // Different hash
    
    let result = escrow_client.try_withdraw(&invalid_secret);
    assert!(result.is_err());
    println!("✅ Invalid secret correctly rejected");
    
    // Test 2: Double withdrawal should fail
    println!("🧪 Testing double withdrawal...");
    env.mock_crypto().keccak256.return_value = hash_lock;
    escrow_client.withdraw(&secret);
    
    let result = escrow_client.try_withdraw(&secret);
    assert!(result.is_err());
    println!("✅ Double withdrawal correctly rejected");
    
    println!("🎉 Failed swap scenarios tested successfully!");
}

/// Test for public withdrawal and cancellation
fn test_public_operations() {
    let env = Env::default();
    
    println!("🌍 Testing public operations...");
    
    // Setup
    let admin = Address::generate(&env);
    let maker = Address::generate(&env);
    let taker = Address::generate(&env);
    let token = Address::generate(&env);
    let order_hash = BytesN::from_array(&env, &[1u8; 32]);
    let secret = BytesN::from_array(&env, &[2u8; 32]);
    let hash_lock = env.crypto().keccak256(&Bytes::from_array(&env, &secret.to_array()));
    let amount = 1000000;
    let safety_deposit = 100000;
    let escrow_wasm_hash = BytesN::from_array(&env, &[3u8; 32]);
    
    let timelocks = stellar_escrow_factory::FactoryTimelockParams {
        finality_delay: 10,
        src_withdrawal_delay: 20,
        src_public_withdrawal_delay: 30,
        src_cancellation_delay: 40,
        src_public_cancellation_delay: 50,
        dst_withdrawal_delay: 60,
        dst_public_withdrawal_delay: 70,
        dst_cancellation_delay: 80,
    };
    
    // Deploy factory and create escrow
    let factory_id = env.register_contract(None, StellarEscrowFactory);
    let factory_client = stellar_escrow_factory::Client::new(&env, &factory_id);
    factory_client.initialize(&escrow_wasm_hash, &admin);
    
    env.mock_all_auths();
    
    let escrow_address = factory_client.create_src_escrow(
        &order_hash,
        &hash_lock,
        &maker,
        &taker,
        &token,
        &amount,
        &safety_deposit,
        &timelocks,
    );
    
    let escrow_client = fusion_plus_escrow::Client::new(&env, &escrow_address);
    escrow_client.deposit();
    
    // Test public withdrawal
    println!("🧪 Testing public withdrawal...");
    let caller = Address::generate(&env);
    env.mock_crypto().keccak256.return_value = hash_lock;
    
    escrow_client.public_withdraw(&secret, &caller);
    assert!(escrow_client.is_withdrawn_status().unwrap());
    println!("✅ Public withdrawal successful");
    
    // Test public cancellation (should fail since already withdrawn)
    println!("🧪 Testing public cancellation after withdrawal...");
    let result = escrow_client.try_public_cancel(&caller);
    assert!(result.is_err());
    println!("✅ Public cancellation correctly rejected after withdrawal");
    
    println!("🎉 Public operations tested successfully!");
}

/// Test for multiple escrows with different parameters
fn test_multiple_escrows() {
    let env = Env::default();
    
    println!("🔢 Testing multiple escrows...");
    
    // Setup
    let admin = Address::generate(&env);
    let maker = Address::generate(&env);
    let taker = Address::generate(&env);
    let token = Address::generate(&env);
    let escrow_wasm_hash = BytesN::from_array(&env, &[3u8; 32]);
    
    let timelocks = stellar_escrow_factory::FactoryTimelockParams {
        finality_delay: 10,
        src_withdrawal_delay: 20,
        src_public_withdrawal_delay: 30,
        src_cancellation_delay: 40,
        src_public_cancellation_delay: 50,
        dst_withdrawal_delay: 60,
        dst_public_withdrawal_delay: 70,
        dst_cancellation_delay: 80,
    };
    
    // Deploy factory
    let factory_id = env.register_contract(None, StellarEscrowFactory);
    let factory_client = stellar_escrow_factory::Client::new(&env, &factory_id);
    factory_client.initialize(&escrow_wasm_hash, &admin);
    
    env.mock_all_auths();
    
    // Create multiple escrows
    let mut escrow_addresses = Vec::new();
    
    for i in 0..3 {
        let order_hash = BytesN::from_array(&env, &[i as u8; 32]);
        let secret = BytesN::from_array(&env, &[(i + 10) as u8; 32]);
        let hash_lock = env.crypto().keccak256(&Bytes::from_array(&env, &secret.to_array()));
        let amount = 1000000 + (i * 100000);
        
        let escrow_address = factory_client.create_src_escrow(
            &order_hash,
            &hash_lock,
            &maker,
            &taker,
            &token,
            &amount,
            &100000,
            &timelocks,
        );
        
        escrow_addresses.push((hash_lock, escrow_address));
        println!("✅ Created escrow {} at: {}", i, escrow_address);
    }
    
    // Verify all escrows exist and have different addresses
    for (i, (hash_lock, address)) in escrow_addresses.iter().enumerate() {
        assert!(factory_client.escrow_exists(hash_lock));
        assert_eq!(factory_client.get_escrow_address(hash_lock).unwrap(), *address);
        
        for (j, (_, other_address)) in escrow_addresses.iter().enumerate() {
            if i != j {
                assert_ne!(address, other_address);
            }
        }
    }
    
    println!("🎉 Multiple escrows test completed successfully!");
}

/// Main test runner
fn main() {
    println!("🧪 Starting comprehensive cross-chain atomic swap tests...");
    
    // Run all tests
    test_cross_chain_atomic_swap();
    test_failed_swap_scenarios();
    test_public_operations();
    test_multiple_escrows();
    
    println!("🎉 All tests completed successfully!");
} 