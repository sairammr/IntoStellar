#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Bytes, BytesN, Env, Map, Symbol, Vec,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub salt: u64,
    pub maker: Address,
    pub receiver: Address,
    pub maker_asset: Address,
    pub taker_asset: Address,
    pub making_amount: u128,
    pub taking_amount: u128,
    pub maker_traits: u64, // Simplified from EVM MakerTraits
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
    // Storage keys
    const BIT_INVALIDATOR: Symbol = symbol_short!("bit_inv");
    const REMAINING_INVALIDATOR: Symbol = symbol_short!("rem_inv");
    const ORDERS: Symbol = symbol_short!("orders");

    /// Initialize the contract
    pub fn initialize(env: &Env) -> Result<(), Error> {
        // Initialize storage
        env.storage().instance().set(&Self::BIT_INVALIDATOR, &Map::new(env));
        env.storage().instance().set(&Self::REMAINING_INVALIDATOR, &Map::new(env));
        env.storage().instance().set(&Self::ORDERS, &Map::new(env));
        Ok(())
    }

    /// Fill an order (equivalent to EVM fillOrder)
    pub fn fill_order(
        env: &Env,
        order: Order,
        signature: Bytes,
        taker: Address,
        amount: u128,
        taker_traits: TakerTraits,
    ) -> Result<(u128, u128, BytesN<32>), Error> {
        // Validate order
        Self::validate_order(env, &order)?;
        
        // Check signature
        Self::verify_signature(env, &order, &signature)?;
        
        // Calculate order hash
        let order_hash = Self::hash_order(env, &order);
        
        // Check remaining amount
        let remaining = Self::get_remaining_amount(env, &order.maker, &order_hash);
        if remaining < amount {
            return Err(Error::TakingAmountExceeded);
        }
        
        // Calculate making and taking amounts
        let making_amount = (amount * order.making_amount) / order.taking_amount;
        let taking_amount = amount;
        
        // Update remaining amount
        Self::update_remaining_amount(env, &order.maker, &order_hash, remaining - amount);
        
        // Transfer assets (simplified - would need actual token transfers)
        Self::transfer_assets(env, &order, &taker, making_amount, taking_amount)?;
        
        // Emit OrderFilled event
        env.events().publish(("OrderFilled",), (order_hash, remaining - amount));
        
        Ok((making_amount, taking_amount, order_hash))
    }

    /// Cancel an order
    pub fn cancel_order(env: &Env, maker: Address, order_hash: BytesN<32>) -> Result<(), Error> {
        // Only maker can cancel
        maker.require_auth();
        
        // Mark order as cancelled
        let mut remaining_inv: Map<BytesN<32>, u128> = env.storage().instance().get(&Self::REMAINING_INVALIDATOR).unwrap_or(Map::new(env));
        remaining_inv.set(order_hash, 0); // 0 means fully filled/cancelled
        env.storage().instance().set(&Self::REMAINING_INVALIDATOR, &remaining_inv);
        
        // Emit OrderCancelled event
        env.events().publish(("OrderCancelled",), order_hash);
        
        Ok(())
    }

    /// Get remaining amount for an order
    pub fn remaining_invalidator_for_order(env: &Env, maker: Address, order_hash: BytesN<32>) -> u128 {
        let remaining_inv: Map<BytesN<32>, u128> = env.storage().instance().get(&Self::REMAINING_INVALIDATOR).unwrap_or(Map::new(env));
        remaining_inv.get(order_hash).unwrap_or(0)
    }

    /// Hash an order (equivalent to EVM hashOrder)
    pub fn hash_order(env: &Env, order: &Order) -> BytesN<32> {
        // Create a deterministic hash from order components
        let mut data = vec![env];
        data.push_back(order.salt.into());
        data.push_back(order.maker.into());
        data.push_back(order.receiver.into());
        data.push_back(order.maker_asset.into());
        data.push_back(order.taker_asset.into());
        data.push_back(order.making_amount.into());
        data.push_back(order.taking_amount.into());
        data.push_back(order.maker_traits.into());
        
        env.crypto().keccak256(&data.into())
    }

    // Helper functions
    fn validate_order(env: &Env, order: &Order) -> Result<(), Error> {
        // Check if order is expired (simplified)
        if order.salt < env.ledger().timestamp() {
            return Err(Error::OrderExpired);
        }
        
        // Check amounts
        if order.making_amount == 0 || order.taking_amount == 0 {
            return Err(Error::SwapWithZeroAmount);
        }
        
        Ok(())
    }

    fn verify_signature(env: &Env, order: &Order, signature: &Bytes) -> Result<(), Error> {
        // Simplified signature verification
        // In production, this would verify Ed25519 signature
        let order_hash = Self::hash_order(env, order);
        let message = order_hash.to_array();
        
        // For now, just check signature length (Ed25519 = 64 bytes)
        if signature.len() != 64 {
            return Err(Error::BadSignature);
        }
        
        // TODO: Implement actual Ed25519 signature verification
        // This is a placeholder - you'll need to implement proper signature verification
        
        Ok(())
    }

    fn get_remaining_amount(env: &Env, maker: &Address, order_hash: &BytesN<32>) -> u128 {
        let remaining_inv: Map<BytesN<32>, u128> = env.storage().instance().get(&Self::REMAINING_INVALIDATOR).unwrap_or(Map::new(env));
        remaining_inv.get(order_hash).unwrap_or(u128::MAX) // Default to full amount if not found
    }

    fn update_remaining_amount(env: &Env, maker: &Address, order_hash: &BytesN<32>, remaining: u128) {
        let mut remaining_inv: Map<BytesN<32>, u128> = env.storage().instance().get(&Self::REMAINING_INVALIDATOR).unwrap_or(Map::new(env));
        remaining_inv.set(order_hash, remaining);
        env.storage().instance().set(&Self::REMAINING_INVALIDATOR, &remaining_inv);
    }

    fn transfer_assets(env: &Env, order: &Order, taker: &Address, making_amount: u128, taking_amount: u128) -> Result<(), Error> {
        // Simplified asset transfer
        // In production, this would handle actual Stellar asset transfers
        // For now, just validate the transfer would be possible
        
        // TODO: Implement actual Stellar asset transfers
        // This would involve:
        // 1. Transfer maker_asset from maker to escrow
        // 2. Transfer taker_asset from taker to maker
        
        Ok(())
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
            Error::TakingAmountExceeded => soroban_sdk::Error::from_type_and_code(1, 1),
            Error::OrderExpired => soroban_sdk::Error::from_type_and_code(1, 2),
            Error::SwapWithZeroAmount => soroban_sdk::Error::from_type_and_code(1, 3),
            Error::BadSignature => soroban_sdk::Error::from_type_and_code(1, 4),
            Error::TransferFailed => soroban_sdk::Error::from_type_and_code(1, 5),
        }
    }
}

#[cfg(test)]
mod test; 