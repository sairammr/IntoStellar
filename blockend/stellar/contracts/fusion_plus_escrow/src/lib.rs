//! FusionPlusEscrow: A Hash Time Locked Contract (HTLC) for cross-chain atomic swaps

#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, contracterror, token, Address, Bytes, BytesN, Env,
};

// Storage keys
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Escrow(BytesN<32>),
    Initialized,
}

// Escrow data structure
#[derive(Clone, Debug)]
#[contracttype]
pub struct EscrowData {
    pub hash_lock: BytesN<32>,
    pub withdrawal_time: u64,
    pub cancellation_time: u64,
    pub maker: Address,
    pub resolver: Address,
    pub token: Address,
    pub amount: i128,
    pub safety_deposit: i128,
    pub withdrawn: bool,
    pub cancelled: bool,
}

#[contract]
pub struct FusionPlusEscrow;

#[derive(Clone, Debug, Copy, PartialEq, Eq, PartialOrd, Ord)]
#[contracterror]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    EscrowExists = 3,
    EscrowNotFound = 4,
    InvalidSecret = 5,
    InvalidTime = 6,
    Unauthorized = 7,
    InvalidParams = 8,
    AlreadyWithdrawn = 9,
    AlreadyCancelled = 10,
}

#[contractimpl]
impl FusionPlusEscrow {
    pub fn initialize(env: Env) -> Result<(), Error> {
        if env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::AlreadyInitialized);
        }
        env.storage().instance().set(&DataKey::Initialized, &true);
        Ok(())
    }

    pub fn deposit(
        env: Env,
        hash_lock: BytesN<32>,
        maker: Address,
        resolver: Address,
        token: Address,
        amount: i128,
        withdrawal_delay: u64,
        cancellation_delay: u64,
        safety_deposit: i128,
    ) -> Result<(), Error> {
        if !env.storage().instance().has(&DataKey::Initialized) {
            return Err(Error::NotInitialized);
        }

        maker.require_auth();

        if env.storage().persistent().has(&DataKey::Escrow(hash_lock.clone())) {
            return Err(Error::EscrowExists);
        }

        if amount <= 0 || safety_deposit <= 0 {
            return Err(Error::InvalidParams);
        }

        let current_time = env.ledger().timestamp();
        let withdrawal_time = current_time + withdrawal_delay;
        let cancellation_time = current_time + cancellation_delay;

        if withdrawal_time >= cancellation_time {
            return Err(Error::InvalidParams);
        }

        let escrow = EscrowData {
            hash_lock: hash_lock.clone(),
            withdrawal_time,
            cancellation_time,
            maker: maker.clone(),
            resolver: resolver.clone(),
            token: token.clone(),
            amount,
            safety_deposit,
            withdrawn: false,
            cancelled: false,
        };

        env.storage().persistent().set(&DataKey::Escrow(hash_lock.clone()), &escrow);

        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&maker, &env.current_contract_address(), &amount);

        Ok(())
    }

    pub fn withdraw(
        env: Env,
        hash_lock: BytesN<32>,
        secret: BytesN<32>,
        caller: Address,
    ) -> Result<(), Error> {
        caller.require_auth();

        let mut escrow = Self::get_escrow(&env, &hash_lock)?;

        if escrow.withdrawn {
            return Err(Error::AlreadyWithdrawn);
        }
        if escrow.cancelled {
            return Err(Error::AlreadyCancelled);
        }

        let computed_hash = Self::keccak256(&env, &secret);
        if computed_hash != hash_lock {
            return Err(Error::InvalidSecret);
        }

        let current_time = env.ledger().timestamp();

        if caller != escrow.resolver {
            return Err(Error::Unauthorized);
        }

        if current_time < escrow.withdrawal_time {
            return Err(Error::InvalidTime);
        }

        if current_time >= escrow.cancellation_time {
            return Err(Error::InvalidTime);
        }

        escrow.withdrawn = true;
        env.storage().persistent().set(&DataKey::Escrow(hash_lock.clone()), &escrow);

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &escrow.maker, &escrow.amount);

        Ok(())
    }

    pub fn cancel(env: Env, hash_lock: BytesN<32>, caller: Address) -> Result<(), Error> {
        caller.require_auth();

        let mut escrow = Self::get_escrow(&env, &hash_lock)?;

        if escrow.withdrawn {
            return Err(Error::AlreadyWithdrawn);
        }
        if escrow.cancelled {
            return Err(Error::AlreadyCancelled);
        }

        let current_time = env.ledger().timestamp();

        if current_time < escrow.cancellation_time {
            return Err(Error::InvalidTime);
        }

        if caller != escrow.maker && caller != escrow.resolver {
            return Err(Error::Unauthorized);
        }

        escrow.cancelled = true;
        env.storage().persistent().set(&DataKey::Escrow(hash_lock.clone()), &escrow);

        let token_client = token::Client::new(&env, &escrow.token);
        token_client.transfer(&env.current_contract_address(), &escrow.maker, &escrow.amount);

        Ok(())
    }

    pub fn get_escrow_data(env: Env, hash_lock: BytesN<32>) -> Result<EscrowData, Error> {
        Self::get_escrow(&env, &hash_lock)
    }

    pub fn escrow_exists(env: Env, hash_lock: BytesN<32>) -> bool {
        env.storage().persistent().has(&DataKey::Escrow(hash_lock))
    }

    fn get_escrow(env: &Env, hash_lock: &BytesN<32>) -> Result<EscrowData, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Escrow(hash_lock.clone()))
            .ok_or(Error::EscrowNotFound)
    }

    fn keccak256(env: &Env, data: &BytesN<32>) -> BytesN<32> {
        let bytes = Bytes::from_array(env, &data.to_array());
        env.crypto().keccak256(&bytes)
    }
}
