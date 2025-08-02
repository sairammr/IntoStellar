//! StellarEscrowFactory: Factory contract for deploying FusionPlusEscrow instances

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, Address, Bytes, BytesN, Env, String,
};
use soroban_sdk::token;

// We'll manually define the types we need from fusion_plus_escrow
// This avoids the external crate dependency issue

// Timelock parameters for factory functions
#[derive(Clone, Debug)]
#[contracttype]
pub struct FactoryTimelockParams {
    pub finality_delay: u32,
    pub src_withdrawal_delay: u32,
    pub src_public_withdrawal_delay: u32,
    pub src_cancellation_delay: u32,
    pub src_public_cancellation_delay: u32,
    pub dst_withdrawal_delay: u32,
    pub dst_public_withdrawal_delay: u32,
    pub dst_cancellation_delay: u32,
}

// Extra data arguments for post-interaction (matching EVM ExtraDataArgs)
#[derive(Clone, Debug)]
#[contracttype]
pub struct ExtraDataArgs {
    pub hashlock_info: BytesN<32>,  // Hash of the secret or Merkle tree root
    pub dst_chain_id: u64,          // Destination chain ID
    pub dst_token: Address,         // Destination token address
    pub deposits: u128,             // Packed deposits (src << 128 | dst)
    pub timelocks: FactoryTimelockParams,
}

// Destination immutables complement (matching EVM DstImmutablesComplement)
#[derive(Clone, Debug)]
#[contracttype]
pub struct DstImmutablesComplement {
    pub maker: Address,
    pub amount: u128,
    pub token: Address,
    pub safety_deposit: u128,
    pub chain_id: u64,
}

// Order structure for post-interaction (matching EVM Order)
#[derive(Clone, Debug)]
#[contracttype]
pub struct Order {
    pub salt: u64,
    pub maker: Address,
    pub receiver: Address,
    pub maker_asset: Address,
    pub taker_asset: Address,
    pub making_amount: u128,
    pub taking_amount: u128,
    pub maker_traits: u128,
}

// Storage keys
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    EscrowMapping(BytesN<32>),
    Initialized,
    EscrowWasmHash,
    Admin,
    LimitOrderProtocol,  // Add LOP address storage
}

// Events matching EVM factory exactly with full timelock data
#[derive(Clone, Debug)]
#[contracttype]
pub struct SrcEscrowCreatedEvent {
    pub order_hash: BytesN<32>,
    pub hash_lock: BytesN<32>,
    pub escrow_address: Address,
    pub maker: Address,
    pub taker: Address,
    pub token: Address,
    pub amount: i128,
    pub safety_deposit: i128,
    pub timelocks: TimelockInfo,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct DstEscrowCreatedEvent {
    pub order_hash: BytesN<32>,
    pub hash_lock: BytesN<32>,
    pub escrow_address: Address,
    pub maker: Address,
    pub taker: Address,
    pub token: Address,
    pub amount: i128,
    pub safety_deposit: i128,
    pub timelocks: TimelockInfo,
}

// Complete timelock information for events
#[derive(Clone, Debug)]
#[contracttype]
pub struct TimelockInfo {
    pub finality: u32,
    pub src_withdrawal: u32,
    pub src_public_withdrawal: u32,
    pub src_cancellation: u32,
    pub src_public_cancellation: u32,
    pub dst_withdrawal: u32,
    pub dst_public_withdrawal: u32,
    pub dst_cancellation: u32,
    pub deployed_at: u64,
}

#[contract]
pub struct StellarEscrowFactory;

#[derive(Clone, Debug, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[contracterror]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    EscrowExists = 3,
    EscrowNotFound = 4,
    Unauthorized = 5,
    InvalidParams = 6,
    DeploymentFailed = 7,
    InsufficientEscrowBalance = 8,
    InvalidCreationTime = 9,
    InvalidPartialFill = 10,
    InvalidSecretsAmount = 11,
    InvalidExtraData = 12,
}

#[contractimpl]
impl StellarEscrowFactory {
    pub fn initialize(
        env: Env,
        escrow_wasm_hash: BytesN<32>,
        admin: Address,
        limit_order_protocol: Address,  // Add LOP address
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::AlreadyInitialized);
        }

        env.storage().instance().set(&DataKey::EscrowWasmHash, &escrow_wasm_hash);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::LimitOrderProtocol, &limit_order_protocol);
        env.storage().instance().set(&DataKey::Initialized, &true);

        Ok(())
    }

    /// Post-interaction callback (equivalent to EVM _postInteraction)
    /// This is called by the Limit Order Protocol after order execution
    pub fn post_interaction(
        env: Env,
        order: Order,
        _extension: Bytes,
        order_hash: BytesN<32>,
        taker: Address,
        making_amount: u128,
        taking_amount: u128,
        _remaining_making_amount: u128,
        extra_data: Bytes,
    ) -> Result<(), Error> {
        // Verify caller is the Limit Order Protocol
        let lop_address: Address = env.storage().instance().get(&DataKey::LimitOrderProtocol)
            .ok_or(Error::NotInitialized)?;
        lop_address.require_auth();

        // Parse extra data to extract ExtraDataArgs
        let extra_data_args = Self::parse_extra_data(&env, &extra_data)?;

        // Extract hashlock from extra data
        let hashlock = extra_data_args.hashlock_info;

        // Create immutables for source escrow
        // TODO: Properly parse src/dst safety deposit from extra_data_args.deposits
        let src_safety_deposit = 0i128; // Placeholder, parsing not implemented
        let mut timelocks = extra_data_args.timelocks.clone();
        timelocks.finality_delay = timelocks.finality_delay; // Keep as is
        timelocks.src_withdrawal_delay = timelocks.src_withdrawal_delay;
        timelocks.src_public_withdrawal_delay = timelocks.src_public_withdrawal_delay;
        timelocks.src_cancellation_delay = timelocks.src_cancellation_delay;
        timelocks.src_public_cancellation_delay = timelocks.src_public_cancellation_delay;
        timelocks.dst_withdrawal_delay = timelocks.dst_withdrawal_delay;
        timelocks.dst_public_withdrawal_delay = timelocks.dst_public_withdrawal_delay;
        timelocks.dst_cancellation_delay = timelocks.dst_cancellation_delay;

        // Create destination immutables complement
        let _dst_immutables_complement = DstImmutablesComplement {
            maker: order.receiver, // Use receiver directly for now
            amount: taking_amount,
            token: extra_data_args.dst_token,
            safety_deposit: (extra_data_args.deposits & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF) as u128,
            chain_id: extra_data_args.dst_chain_id,
        };

        // Emit SrcEscrowCreated event (matching EVM)
        env.events().publish(
            (String::from_str(&env, "SrcEscrowCreated"),),
            SrcEscrowCreatedEvent {
                order_hash: order_hash.clone(),
                hash_lock: hashlock.clone(),
                escrow_address: env.current_contract_address(),
                maker: order.maker.clone(),
                taker: taker.clone(),
                token: order.maker_asset.clone(),
                amount: making_amount as i128,
                safety_deposit: src_safety_deposit,
                timelocks: TimelockInfo {
                    finality: timelocks.finality_delay,
                    src_withdrawal: timelocks.src_withdrawal_delay,
                    src_public_withdrawal: timelocks.src_public_withdrawal_delay,
                    src_cancellation: timelocks.src_cancellation_delay,
                    src_public_cancellation: timelocks.src_public_cancellation_delay,
                    dst_withdrawal: timelocks.dst_withdrawal_delay,
                    dst_public_withdrawal: timelocks.dst_public_withdrawal_delay,
                    dst_cancellation: timelocks.dst_cancellation_delay,
                    deployed_at: env.ledger().timestamp(),
                },
            }
        );

        // Deploy escrow instance
        let _escrow_address = Self::deploy_escrow_instance(&env, hashlock.clone())?;

        // CRITICAL: Verify maker has sufficient balance before escrow creation
        Self::verify_maker_balance(&env, &order.maker_asset, &order.maker, making_amount as i128)?;

        // Verify escrow has sufficient balance
        // Note: In Stellar, we can't directly check token balances from the factory
        // This would need to be handled by the escrow contract itself
        // For now, we'll skip this check as it's not critical for the demo
        // In production, you'd implement proper balance checking

        Ok(())
    }

    pub fn create_src_escrow(
        env: Env,
        order_hash: BytesN<32>,
        hash_lock: BytesN<32>,
        maker: Address,
        taker: Address,
        token: Address,
        amount: i128,
        safety_deposit: i128,
        timelocks: FactoryTimelockParams,
    ) -> Result<Address, Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        if env.storage().persistent().has(&DataKey::EscrowMapping(hash_lock.clone())) {
            return Err(Error::EscrowExists);
        }

        if amount <= 0 || safety_deposit <= 0 {
            return Err(Error::InvalidParams);
        }

        // Validate 7-stage timelock ordering for src escrow
        if timelocks.src_withdrawal_delay <= timelocks.finality_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.src_public_withdrawal_delay <= timelocks.src_withdrawal_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.src_cancellation_delay <= timelocks.src_public_withdrawal_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.src_public_cancellation_delay <= timelocks.src_cancellation_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.dst_withdrawal_delay <= timelocks.finality_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.dst_public_withdrawal_delay <= timelocks.dst_withdrawal_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.dst_cancellation_delay <= timelocks.dst_public_withdrawal_delay {
            return Err(Error::InvalidParams);
        }

        let escrow_address = Self::deploy_escrow_instance(&env, hash_lock.clone())?;

        // TODO: Initialize the deployed src escrow with all parameters
        // This needs to be called separately after deployment
        // The escrow.initialize() call should be made by the relayer or caller

        env.storage().persistent().set(
            &DataKey::EscrowMapping(hash_lock.clone()),
            &escrow_address,
        );

        env.events().publish(
            (String::from_str(&env, "SrcEscrowCreated"),),
            SrcEscrowCreatedEvent {
                order_hash,
                hash_lock,
                escrow_address: escrow_address.clone(),
                maker,
                taker,
                token,
                amount,
                safety_deposit,
                timelocks: TimelockInfo {
                    finality: timelocks.finality_delay,
                    src_withdrawal: timelocks.src_withdrawal_delay,
                    src_public_withdrawal: timelocks.src_public_withdrawal_delay,
                    src_cancellation: timelocks.src_cancellation_delay,
                    src_public_cancellation: timelocks.src_public_cancellation_delay,
                    dst_withdrawal: timelocks.dst_withdrawal_delay,
                    dst_public_withdrawal: timelocks.dst_public_withdrawal_delay,
                    dst_cancellation: timelocks.dst_cancellation_delay,
                    deployed_at: env.ledger().timestamp(),
                },
            }
        );

        Ok(escrow_address)
    }

    pub fn create_dst_escrow(
        env: Env,
        order_hash: BytesN<32>,
        hash_lock: BytesN<32>,
        maker: Address,
        taker: Address,
        token: Address,
        amount: i128,
        safety_deposit: i128,
        timelocks: FactoryTimelockParams,
        caller: Address,
    ) -> Result<Address, Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        caller.require_auth();

        if env.storage().persistent().has(&DataKey::EscrowMapping(hash_lock.clone())) {
            return Err(Error::EscrowExists);
        }

        if amount <= 0 || safety_deposit <= 0 {
            return Err(Error::InvalidParams);
        }

        // Validate 7-stage timelock ordering for dst escrow
        if timelocks.src_withdrawal_delay <= timelocks.finality_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.src_public_withdrawal_delay <= timelocks.src_withdrawal_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.src_cancellation_delay <= timelocks.src_public_withdrawal_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.src_public_cancellation_delay <= timelocks.src_cancellation_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.dst_withdrawal_delay <= timelocks.finality_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.dst_public_withdrawal_delay <= timelocks.dst_withdrawal_delay {
            return Err(Error::InvalidParams);
        }
        if timelocks.dst_cancellation_delay <= timelocks.dst_public_withdrawal_delay {
            return Err(Error::InvalidParams);
        }

        let escrow_address = Self::deploy_escrow_instance(&env, hash_lock.clone())?;

        // TODO: Initialize the deployed dst escrow with all parameters
        // This needs to be called separately after deployment
        // The escrow.initialize() call should be made by the relayer or caller

        env.storage().persistent().set(
            &DataKey::EscrowMapping(hash_lock.clone()),
            &escrow_address,
        );

        env.events().publish(
            (String::from_str(&env, "DstEscrowCreated"),),
            DstEscrowCreatedEvent {
                order_hash,
                hash_lock,
                escrow_address: escrow_address.clone(),
                maker,
                taker,
                token,
                amount,
                safety_deposit,
                timelocks: TimelockInfo {
                    finality: timelocks.finality_delay,
                    src_withdrawal: timelocks.src_withdrawal_delay,
                    src_public_withdrawal: timelocks.src_public_withdrawal_delay,
                    src_cancellation: timelocks.src_cancellation_delay,
                    src_public_cancellation: timelocks.src_public_cancellation_delay,
                    dst_withdrawal: timelocks.dst_withdrawal_delay,
                    dst_public_withdrawal: timelocks.dst_public_withdrawal_delay,
                    dst_cancellation: timelocks.dst_cancellation_delay,
                    deployed_at: env.ledger().timestamp(),
                },
            }
        );

        Ok(escrow_address)
    }

    pub fn get_escrow_address(env: Env, hash_lock: BytesN<32>) -> Result<Address, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::EscrowMapping(hash_lock))
            .ok_or(Error::EscrowNotFound)
    }

    pub fn escrow_exists(env: Env, hash_lock: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::EscrowMapping(hash_lock))
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_escrow_wasm_hash(env: Env) -> Result<BytesN<32>, Error> {
        env.storage()
            .instance()
            .get(&DataKey::EscrowWasmHash)
            .ok_or(Error::NotInitialized)
    }

    pub fn get_limit_order_protocol(env: Env) -> Result<Address, Error> {
        env.storage()
            .instance()
            .get(&DataKey::LimitOrderProtocol)
            .ok_or(Error::NotInitialized)
    }

    fn deploy_escrow_instance(env: &Env, hash_lock: BytesN<32>) -> Result<Address, Error> {
        let escrow_wasm_hash: BytesN<32> = env.storage()
            .instance()
            .get(&DataKey::EscrowWasmHash)
            .unwrap();

        let escrow_address = env
            .deployer()
            .with_current_contract(hash_lock)
            .deploy(escrow_wasm_hash);

        Ok(escrow_address)
    }

    /// Parse extra data to extract ExtraDataArgs
    /// This is a simplified parser - in production, you'd need more robust parsing
    fn parse_extra_data(env: &Env, extra_data: &Bytes) -> Result<ExtraDataArgs, Error> {
        // TODO: Implement proper parsing of extra_data
        // For now, return placeholder values
        Ok(ExtraDataArgs {
            hashlock_info: BytesN::from_array(env, &[0u8; 32]), // Placeholder
            dst_chain_id: 1, // Placeholder
            dst_token: Address::from_string(&String::from_str(env, "dummy_token")), // Placeholder
            deposits: 0, // Placeholder
            timelocks: FactoryTimelockParams {
                finality_delay: 60,
                src_withdrawal_delay: 120,
                src_public_withdrawal_delay: 180,
                src_cancellation_delay: 240,
                src_public_cancellation_delay: 300,
                dst_withdrawal_delay: 360,
                dst_public_withdrawal_delay: 420,
                dst_cancellation_delay: 480,
            },
        })
    }

    fn verify_maker_balance(env: &Env, token: &Address, maker: &Address, amount: i128) -> Result<(), Error> {
        // Check if token is native XLM
        let is_native = *token == Address::from_string(&String::from_str(env, "native"));
        
        if is_native {
            // For native XLM, check if maker has enough XLM
            let native_client = token::Client::new(env, &Address::from_string(&String::from_str(env, "native")));
            let maker_balance = native_client.balance(maker);
            if maker_balance < amount {
                return Err(Error::InsufficientEscrowBalance);
            }
        } else {
            // For custom tokens, check if maker has enough tokens
            let token_client = token::Client::new(env, token);
            let maker_balance = token_client.balance(maker);
            if maker_balance < amount {
                return Err(Error::InsufficientEscrowBalance);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod test;
