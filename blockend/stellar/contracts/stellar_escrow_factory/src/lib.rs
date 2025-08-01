//! StellarEscrowFactory: Factory contract for deploying FusionPlusEscrow instances

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, Address, BytesN, Env, String,
};

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

// Storage keys
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    EscrowMapping(BytesN<32>),
    Initialized,
    EscrowWasmHash,
    Admin,
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
}

#[contractimpl]
impl StellarEscrowFactory {
    pub fn initialize(
        env: Env,
        escrow_wasm_hash: BytesN<32>,
        admin: Address,
    ) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::EscrowWasmHash, &escrow_wasm_hash);
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Initialized, &true);

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

        maker.require_auth();

        if env.storage().persistent().has(&DataKey::EscrowMapping(hash_lock.clone())) {
            return Err(Error::EscrowExists);
        }

        if amount <= 0 || safety_deposit <= 0 {
            return Err(Error::InvalidParams);
        }

        // Validate 7-stage timelock ordering
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

        env.storage().persistent().set(
            &DataKey::EscrowMapping(hash_lock.clone()),
            &escrow_address,
        );

        // TODO: Initialize the deployed escrow with all parameters
        // This needs to be called separately after deployment
        // The escrow.initialize() call should be made by the relayer or caller

        let current_time = env.ledger().timestamp();

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
                    deployed_at: current_time,
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
}

#[cfg(test)]
mod test;
