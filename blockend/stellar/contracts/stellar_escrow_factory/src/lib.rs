//! StellarEscrowFactory: Factory contract for deploying FusionPlusEscrow instances

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, Address, BytesN, Env, String,
};

// Storage keys
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    EscrowMapping(BytesN<32>),
    Initialized,
    EscrowWasmHash,
    Admin,
}

// Events matching EVM factory exactly
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
    pub withdrawal_time: u64,
    pub cancellation_time: u64,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct DstEscrowCreatedEvent {
    pub escrow_address: Address,
    pub hash_lock: BytesN<32>,
    pub taker: Address,
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
        finality_delay: u32,
        withdrawal_delay: u32,
        cancellation_delay: u32,
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

        if withdrawal_delay <= finality_delay {
            return Err(Error::InvalidParams);
        }
        if cancellation_delay <= withdrawal_delay {
            return Err(Error::InvalidParams);
        }

        let escrow_address = Self::deploy_escrow_instance(&env, hash_lock.clone())?;

        env.storage().persistent().set(
            &DataKey::EscrowMapping(hash_lock.clone()),
            &escrow_address,
        );

        let current_time = env.ledger().timestamp();
        let withdrawal_time = current_time + withdrawal_delay as u64;
        let cancellation_time = current_time + cancellation_delay as u64;

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
                withdrawal_time,
                cancellation_time,
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

        let escrow_address = Self::deploy_escrow_instance(&env, hash_lock.clone())?;

        env.storage().persistent().set(
            &DataKey::EscrowMapping(hash_lock.clone()),
            &escrow_address,
        );

        env.events().publish(
            (String::from_str(&env, "DstEscrowCreated"),),
            DstEscrowCreatedEvent {
                escrow_address: escrow_address.clone(),
                hash_lock,
                taker,
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
