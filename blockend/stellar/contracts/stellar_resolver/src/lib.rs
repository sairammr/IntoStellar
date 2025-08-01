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
pub struct ResolverConfig {
    pub limit_order_protocol: Address,  // Stellar Limit Order Protocol contract
    pub escrow_factory: Address,        // Stellar Escrow Factory contract
    pub price_oracle: Address,          // Price oracle contract (optional)
    pub admin: Address,                 // Admin address
    pub fee_recipient: Address,         // Fee recipient address
    pub fee_rate: u32,                  // Fee rate in basis points (e.g., 30 = 0.3%)
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CrossChainOrder {
    pub evm_order_hash: BytesN<32>,     // EVM order hash
    pub stellar_order: Order,           // Stellar order
    pub secret_hash: BytesN<32>,        // HTLC secret hash
    pub timelock: u64,                  // HTLC timelock
    pub status: OrderStatus,            // Current status
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OrderStatus {
    Pending,        // Order created, waiting for execution
    Executing,      // Order being executed
    Completed,      // Order completed successfully
    Failed,         // Order failed
    Cancelled,      // Order cancelled
}

#[contract]
pub struct StellarResolver;

#[contractimpl]
impl StellarResolver {
    const CONFIG: Symbol = symbol_short!("config");
    const ORDERS: Symbol = symbol_short!("orders");
    const EXECUTED: Symbol = symbol_short!("executed");

    /// Initialize the resolver with configuration
    pub fn initialize(
        env: &Env,
        limit_order_protocol: Address,
        escrow_factory: Address,
        price_oracle: Address,
        admin: Address,
        fee_recipient: Address,
        fee_rate: u32,
    ) -> Result<(), Error> {
        let config = ResolverConfig {
            limit_order_protocol,
            escrow_factory,
            price_oracle,
            admin,
            fee_recipient,
            fee_rate,
        };
        
        env.storage().instance().set(&Self::CONFIG, &config);
        env.storage().instance().set(&Self::ORDERS, &Map::<BytesN<32>, CrossChainOrder>::new(env));
        env.storage().instance().set(&Self::EXECUTED, &Map::<BytesN<32>, bool>::new(env));
        
        Ok(())
    }

    /// Create a cross-chain order (equivalent to EVM deploySrc)
    pub fn create_cross_chain_order(
        env: &Env,
        evm_order_hash: BytesN<32>,
        stellar_order: Order,
        secret_hash: BytesN<32>,
        timelock: u64,
    ) -> Result<Address, Error> {
        // Validate order
        Self::validate_order(&stellar_order)?;
        
        // Check if order already exists
        let orders: Map<BytesN<32>, CrossChainOrder> = env.storage().instance().get(&Self::ORDERS).unwrap_or(Map::new(env));
        if orders.contains_key(evm_order_hash.clone()) {
            return Err(Error::OrderAlreadyExists);
        }
        
        // Create cross-chain order
        let cross_chain_order = CrossChainOrder {
            evm_order_hash: evm_order_hash.clone(),
            stellar_order: stellar_order.clone(),
            secret_hash: secret_hash.clone(),
            timelock,
            status: OrderStatus::Pending,
        };
        
        // Store the order
        let mut orders = orders;
        orders.set(evm_order_hash.clone(), cross_chain_order);
        env.storage().instance().set(&Self::ORDERS, &orders);
        
        // Create escrow on Stellar side
        let escrow_address = Self::create_stellar_escrow(env, &stellar_order, &secret_hash, timelock)?;
        
        // Emit event
        env.events().publish(("CrossChainOrderCreated",), (evm_order_hash, escrow_address.clone()));
        
        Ok(escrow_address)
    }

    /// Execute a cross-chain order (equivalent to EVM deployDst)
    pub fn execute_cross_chain_order(
        env: &Env,
        evm_order_hash: BytesN<32>,
        signature: Bytes,
        taker: Address,
        amount: u128,
    ) -> Result<(u128, u128), Error> {
        // Get the cross-chain order
        let orders: Map<BytesN<32>, CrossChainOrder> = env.storage().instance().get(&Self::ORDERS).unwrap_or(Map::new(env));
        let cross_chain_order = orders.get(evm_order_hash.clone()).ok_or(Error::OrderNotFound)?;
        
        // Check if already executed
        let executed: Map<BytesN<32>, bool> = env.storage().instance().get(&Self::EXECUTED).unwrap_or(Map::new(env));
        if executed.get(evm_order_hash.clone()).unwrap_or(false) {
            return Err(Error::OrderAlreadyExecuted);
        }
        
        // Update status to executing
        let mut updated_order = cross_chain_order.clone();
        updated_order.status = OrderStatus::Executing;
        
        let mut orders = orders;
        orders.set(evm_order_hash.clone(), updated_order);
        env.storage().instance().set(&Self::ORDERS, &orders);
        
        // Execute the order on Stellar Limit Order Protocol
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        
        // Call the limit order protocol to fill the order
        let taker_traits = stellar_limit_order_protocol::TakerTraits {
            threshold: amount,
            skip_maker_permit: false,
        };
        
        let result = stellar_limit_order_protocol::Client::new(env, &config.limit_order_protocol)
            .fill_order(&cross_chain_order.stellar_order, &signature, &taker, &amount, &taker_traits);
        
        match result {
            Ok((making_amount, taking_amount, _order_hash)) => {
                // Mark as executed
                let mut executed = executed;
                executed.set(evm_order_hash.clone(), true);
                env.storage().instance().set(&Self::EXECUTED, &executed);
                
                // Update status to completed
                let mut updated_order = cross_chain_order.clone();
                updated_order.status = OrderStatus::Completed;
                orders.set(evm_order_hash.clone(), updated_order);
                env.storage().instance().set(&Self::ORDERS, &orders);
                
                // Emit event
                env.events().publish(("CrossChainOrderExecuted",), (evm_order_hash, making_amount, taking_amount));
                
                Ok((making_amount, taking_amount))
            }
            Err(_) => {
                // Update status to failed
                let mut updated_order = cross_chain_order.clone();
                updated_order.status = OrderStatus::Failed;
                orders.set(evm_order_hash.clone(), updated_order);
                env.storage().instance().set(&Self::ORDERS, &orders);
                
                Err(Error::OrderExecutionFailed)
            }
        }
    }

    /// Get cross-chain order status
    pub fn get_order_status(env: &Env, evm_order_hash: BytesN<32>) -> Result<OrderStatus, Error> {
        let orders: Map<BytesN<32>, CrossChainOrder> = env.storage().instance().get(&Self::ORDERS).unwrap_or(Map::new(env));
        let cross_chain_order = orders.get(evm_order_hash).ok_or(Error::OrderNotFound)?;
        Ok(cross_chain_order.status)
    }

    /// Cancel a cross-chain order (admin only)
    pub fn cancel_order(env: &Env, evm_order_hash: BytesN<32>) -> Result<(), Error> {
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        config.admin.require_auth();
        
        let orders: Map<BytesN<32>, CrossChainOrder> = env.storage().instance().get(&Self::ORDERS).unwrap_or(Map::new(env));
        let cross_chain_order = orders.get(evm_order_hash.clone()).ok_or(Error::OrderNotFound)?;
        
        let mut updated_order = cross_chain_order.clone();
        updated_order.status = OrderStatus::Cancelled;
        
        let mut orders = orders;
        orders.set(evm_order_hash.clone(), updated_order);
        env.storage().instance().set(&Self::ORDERS, &orders);
        
        env.events().publish(("CrossChainOrderCancelled",), evm_order_hash);
        
        Ok(())
    }

    /// Update configuration (admin only)
    pub fn update_config(
        env: &Env,
        limit_order_protocol: Option<Address>,
        escrow_factory: Option<Address>,
        price_oracle: Option<Address>,
        fee_recipient: Option<Address>,
        fee_rate: Option<u32>,
    ) -> Result<(), Error> {
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        config.admin.require_auth();
        
        let mut new_config = config.clone();
        
        if let Some(lop) = limit_order_protocol {
            new_config.limit_order_protocol = lop;
        }
        if let Some(ef) = escrow_factory {
            new_config.escrow_factory = ef;
        }
        if let Some(po) = price_oracle {
            new_config.price_oracle = po;
        }
        if let Some(fr) = fee_recipient {
            new_config.fee_recipient = fr;
        }
        if let Some(rate) = fee_rate {
            new_config.fee_rate = rate;
        }
        
        env.storage().instance().set(&Self::CONFIG, &new_config);
        
        Ok(())
    }

    // Helper functions
    fn validate_order(order: &Order) -> Result<(), Error> {
        if order.making_amount == 0 || order.taking_amount == 0 {
            return Err(Error::InvalidOrder);
        }
        Ok(())
    }

    fn create_stellar_escrow(
        env: &Env,
        order: &Order,
        secret_hash: &BytesN<32>,
        timelock: u64,
    ) -> Result<Address, Error> {
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        
        // Call the escrow factory to create an escrow
        // This would typically involve calling the factory's create_src_escrow method
        // For now, we'll return a mock address - this needs to be implemented based on your factory interface
        
        // Mock implementation - replace with actual factory call
        // Use the current contract address as a placeholder
        let escrow_address = env.current_contract_address();
        
        Ok(escrow_address)
    }
}

// Mock stellar_limit_order_protocol module for compilation
mod stellar_limit_order_protocol {
    use soroban_sdk::{Address, Bytes, contracttype};
    
    #[contracttype]
    #[derive(Clone, Debug, Eq, PartialEq)]
    pub struct TakerTraits {
        pub threshold: u128,
        pub skip_maker_permit: bool,
    }
    
    pub struct Client<'a> {
        env: &'a soroban_sdk::Env,
        contract_id: Address,
    }
    
    impl<'a> Client<'a> {
        pub fn new(env: &'a soroban_sdk::Env, contract_id: &Address) -> Self {
            Self {
                env,
                contract_id: contract_id.clone(),
            }
        }
        
        pub fn fill_order(
            &self,
            _order: &super::Order,
            _signature: &Bytes,
            _taker: &Address,
            _amount: &u128,
            _taker_traits: &TakerTraits,
        ) -> Result<(u128, u128, soroban_sdk::BytesN<32>), super::Error> {
            // Mock implementation - replace with actual contract call
            Ok((1000, 500, soroban_sdk::BytesN::from_array(self.env, &[0u8; 32])))
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Error {
    InvalidOrder,
    OrderNotFound,
    OrderAlreadyExists,
    OrderAlreadyExecuted,
    OrderExecutionFailed,
    InsufficientBalance,
    InvalidSignature,
    Unauthorized,
}

impl From<Error> for soroban_sdk::Error {
    fn from(err: Error) -> Self {
        match err {
            Error::InvalidOrder => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::OrderNotFound => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::OrderAlreadyExists => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::OrderAlreadyExecuted => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::OrderExecutionFailed => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::InsufficientBalance => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::InvalidSignature => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::Unauthorized => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
        }
    }
}

impl From<&Error> for soroban_sdk::Error {
    fn from(err: &Error) -> Self {
        err.clone().into()
    }
}

impl From<soroban_sdk::Error> for Error {
    fn from(_err: soroban_sdk::Error) -> Self {
        Error::OrderExecutionFailed
    }
}

#[cfg(test)]
mod test; 