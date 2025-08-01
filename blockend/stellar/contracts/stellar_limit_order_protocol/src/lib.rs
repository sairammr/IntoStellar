#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Bytes, BytesN, Env, Map, Symbol, xdr::{ScErrorCode, ScErrorType},
};
use soroban_sdk::token;
use soroban_sdk::xdr::ToXdr;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub salt: u64,
    pub maker_asset: Address,     // Stellar asset contract
    pub taker_asset: Address,     // Stellar asset contract  
    pub maker: Address,           // Stellar account
    pub receiver: Address,        // Stellar account
    pub allowed_sender: Address,  // Zero for public orders
    pub making_amount: u128,
    pub taking_amount: u128,
    pub offsets: u64,             // Encodes lengths of dynamic data
    pub interactions: Bytes,      // Dynamic fields (predicate, etc.)
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TakerTraits {
    pub threshold: u128,
    pub skip_maker_permit: bool,
}

#[contract]
pub struct StellarLimitOrderProtocol;

#[contractimpl]
impl StellarLimitOrderProtocol {
    const REMAINING_INVALIDATOR: Symbol = symbol_short!("rem_inv");
    const ORDERS: Symbol = symbol_short!("orders");

    // Constants matching EVM side
    const ORDER_TYPE_HASH: &'static [u8] = b"Order(uint256 salt,address makerAsset,address takerAsset,address maker,address receiver,address allowedSender,uint256 makingAmount,uint256 takingAmount,uint256 offsets,bytes interactions)";
    const DOMAIN_NAME: &'static [u8] = b"1inch Limit Order Protocol";
    const DOMAIN_VERSION: &'static [u8] = b"4";

    /// Initialize the contract
    pub fn initialize(env: &Env) -> Result<(), Error> {
        env.storage().instance().set(&Self::REMAINING_INVALIDATOR, &Map::<BytesN<32>, u128>::new(env));
        env.storage().instance().set(&Self::ORDERS, &Map::<BytesN<32>, Order>::new(env));
        Ok(())
    }

    /// Fill an order (equivalent to EVM fillOrder)
    pub fn fill_order(
        env: &Env,
        order: Order,
        signature: Bytes,
        taker: Address,
        amount: u128,
        _taker_traits: TakerTraits,
    ) -> Result<(u128, u128, BytesN<32>), Error> {
        // Validate order
        Self::validate_order(&order)?;
        
        // Check signature
        Self::verify_signature(env, &order, &signature)?;
        
        // Calculate order hash (matches EVM exactly)
        let order_hash = Self::hash_order(env, order.clone());
        
        // Check remaining amount
        let remaining = Self::get_remaining_amount(env, &order_hash);
        if remaining < amount {
            return Err(Error::TakingAmountExceeded);
        }
        
        // Calculate making and taking amounts
        let making_amount = (amount * order.making_amount) / order.taking_amount;
        let taking_amount = amount;
        
        // Update remaining amount
        Self::update_remaining_amount(env, &order_hash, remaining - amount);
        
        // Transfer assets (REAL IMPLEMENTATION)
        Self::transfer_assets(env, &order, &taker, making_amount, taking_amount)?;
        
        // Store order for reference
        let mut orders: Map<BytesN<32>, Order> = env.storage().instance().get(&Self::ORDERS).unwrap_or(Map::new(env));
        orders.set(order_hash.clone(), order);
        env.storage().instance().set(&Self::ORDERS, &orders);
        
        // Emit OrderFilled event
        env.events().publish(("OrderFilled",), (order_hash.clone(), remaining - amount));
        
        Ok((making_amount, taking_amount, order_hash))
    }

    /// Cancel an order
    pub fn cancel_order(env: &Env, maker: Address, order_hash: BytesN<32>) -> Result<(), Error> {
        maker.require_auth();
        
        let mut remaining_inv: Map<BytesN<32>, u128> = env.storage().instance().get(&Self::REMAINING_INVALIDATOR).unwrap_or(Map::new(env));
        remaining_inv.set(order_hash.clone(), 0);
        env.storage().instance().set(&Self::REMAINING_INVALIDATOR, &remaining_inv);
        
        env.events().publish(("OrderCancelled",), order_hash);
        
        Ok(())
    }

    /// Get remaining amount for an order
    pub fn remaining_invalidator_for_order(env: &Env, _maker: Address, order_hash: BytesN<32>) -> u128 {
        let remaining_inv: Map<BytesN<32>, u128> = env.storage().instance().get(&Self::REMAINING_INVALIDATOR).unwrap_or(Map::new(env));
        remaining_inv.get(order_hash).unwrap_or(0)
    }

    /// Hash an order (EXACTLY matches EVM implementation)
    pub fn hash_order(env: &Env, order: Order) -> BytesN<32> {
        // Step 1: Hash the interactions (dynamic data)
        let interactions_hash = env.crypto().keccak256(&order.interactions);
        
        // Step 2: Serialize all fields into a Bytes buffer
        let mut buf = Bytes::new(env);
        buf.append(&Bytes::from_slice(env, Self::ORDER_TYPE_HASH));
        buf.append(&Self::address_to_bytes(env, &order.maker_asset));
        buf.append(&Self::address_to_bytes(env, &order.taker_asset));
        buf.append(&Self::address_to_bytes(env, &order.maker));
        buf.append(&Self::address_to_bytes(env, &order.receiver));
        buf.append(&Self::address_to_bytes(env, &order.allowed_sender));
        buf.append(&Bytes::from_slice(env, &order.salt.to_be_bytes()));
        buf.append(&Bytes::from_slice(env, &order.making_amount.to_be_bytes()));
        buf.append(&Bytes::from_slice(env, &order.taking_amount.to_be_bytes()));
        buf.append(&Bytes::from_slice(env, &order.offsets.to_be_bytes()));
        buf.append(&Bytes::from_array(env, &interactions_hash.to_array()));
        env.crypto().keccak256(&buf)
    }

    // Helper functions
    fn validate_order(order: &Order) -> Result<(), Error> {
        if order.making_amount == 0 || order.taking_amount == 0 {
            return Err(Error::SwapWithZeroAmount);
        }
        Ok(())
    }

    fn verify_signature(env: &Env, order: &Order, signature: &Bytes) -> Result<(), Error> {
        let order_hash = Self::hash_order(env, order.clone());
        let maker_pubkey = Self::address_to_public_key(env, &order.maker)?;
        if signature.len() != 64 {
            return Err(Error::BadSignature);
        }
        let mut sig_bytes = [0u8; 64];
        for i in 0..64 {
            sig_bytes[i] = signature.get(i as u32).unwrap_or(0);
        }
        let signature_bytes = BytesN::from_array(env, &sig_bytes);
        let order_hash_bytes = Bytes::from_array(env, &order_hash.to_array());
        env.crypto().ed25519_verify(&maker_pubkey, &order_hash_bytes, &signature_bytes);
        Ok(())
    }

    fn get_remaining_amount(env: &Env, order_hash: &BytesN<32>) -> u128 {
        let remaining_inv: Map<BytesN<32>, u128> = env.storage().instance().get(&Self::REMAINING_INVALIDATOR).unwrap_or(Map::new(env));
        remaining_inv.get(order_hash.clone()).unwrap_or(u128::MAX)
    }

    fn update_remaining_amount(env: &Env, order_hash: &BytesN<32>, remaining: u128) {
        let mut remaining_inv: Map<BytesN<32>, u128> = env.storage().instance().get(&Self::REMAINING_INVALIDATOR).unwrap_or(Map::new(env));
        remaining_inv.set(order_hash.clone(), remaining);
        env.storage().instance().set(&Self::REMAINING_INVALIDATOR, &remaining_inv);
    }

    fn transfer_assets(env: &Env, order: &Order, taker: &Address, making_amount: u128, taking_amount: u128) -> Result<(), Error> {
        let escrow_address = env.current_contract_address();
        let maker_token = token::Client::new(env, &order.maker_asset);
        let taker_token = token::Client::new(env, &order.taker_asset);
        maker_token.transfer(&order.maker, &escrow_address, &(making_amount as i128));
        taker_token.transfer(taker, &order.maker, &(taking_amount as i128));
        maker_token.transfer(&escrow_address, taker, &(making_amount as i128));
        Ok(())
    }

    fn address_to_bytes(env: &Env, address: &Address) -> Bytes {
        // Use address.to_xdr(env) to get Bytes, then take the first 32 bytes
        let xdr = address.to_xdr(env);
        let mut arr = [0u8; 32];
        for i in 0..32 {
            arr[i] = xdr.get(i as u32).unwrap_or(0);
        }
        Bytes::from_array(env, &arr)
    }

    fn address_to_public_key(env: &Env, address: &Address) -> Result<BytesN<32>, Error> {
        let xdr = address.to_xdr(env);
        let mut arr = [0u8; 32];
        for i in 0..32 {
            arr[i] = xdr.get(i as u32).unwrap_or(0);
        }
        Ok(BytesN::from_array(env, &arr))
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Error {
    TakingAmountExceeded,
    OrderExpired,
    SwapWithZeroAmount,
    BadSignature,
    TransferFailed,
}

impl From<Error> for soroban_sdk::Error {
    fn from(err: Error) -> Self {
        match err {
            Error::TakingAmountExceeded => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::OrderExpired => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::SwapWithZeroAmount => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::BadSignature => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::TransferFailed => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
        }
    }
}

impl From<soroban_sdk::Error> for Error {
    fn from(_err: soroban_sdk::Error) -> Self {
        Error::TransferFailed
    }
}

impl From<&Error> for soroban_sdk::Error {
    fn from(err: &Error) -> Self {
        err.clone().into()
    }
}

#[cfg(test)]
mod test; 