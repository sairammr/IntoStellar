#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Bytes, BytesN, Env, IntoVal, Symbol, Vec, String, xdr::{ScErrorCode, ScErrorType, ToXdr, ScVal}, token::TokenClient, I256, TryFromVal,
};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Order {
    pub salt: u64,
    pub maker: Address,           // Stellar account
    pub receiver: Address,        // Stellar account
    pub maker_asset: Address,     // Stellar asset contract
    pub taker_asset: Address,     // Stellar asset contract  
    pub making_amount: u128,
    pub taking_amount: u128,
    pub maker_traits: u128,       // MakerTraits as uint256
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BaseEscrowImmutables {
    pub order_hash: BytesN<32>,
    pub hashlock: BytesN<32>,
    pub maker: Address,
    pub taker: Address,
    pub token: Address,
    pub amount: u128,
    pub safety_deposit: u128,
    pub timelocks: Timelocks,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Timelocks {
    pub finality: u64,
    pub src_withdrawal: u64,
    pub src_public_withdrawal: u64,
    pub src_cancellation: u64,
    pub src_public_cancellation: u64,
    pub dst_withdrawal: u64,
    pub dst_public_withdrawal: u64,
    pub dst_cancellation: u64,
    pub deployed_at: u64,
}

// TakerTraits as uint256 (equivalent to EVM TakerTraits)
type TakerTraits = i128; // Changed to i128 to support higher bit positions

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ResolverConfig {
    pub factory: Address,         // Stellar Escrow Factory contract
    pub limit_order_protocol: Address,  // Stellar Limit Order Protocol contract
    pub admin: Address,           // Admin address (equivalent to EVM owner)
}

#[contract]
pub struct StellarResolver;

#[contractimpl]
impl StellarResolver {
    const CONFIG: Symbol = symbol_short!("config");
    const ARGS_HAS_TARGET: i128 = 1i128 << 127; // Use max available bit position for i128

    /// Initialize the resolver with configuration (equivalent to EVM constructor)
    pub fn initialize(
        env: &Env,
        factory: Address,
        limit_order_protocol: Address,
        admin: Address,
    ) -> Result<(), Error> {
        let config = ResolverConfig {
            factory,
            limit_order_protocol,
            admin,
        };
        
        env.storage().instance().set(&Self::CONFIG, &config);
        
        Ok(())
    }

    /// Deploy source escrow and execute order (equivalent to EVM deploySrc)
    pub fn deploy_src(
        env: &Env,
        immutables: BaseEscrowImmutables,
        order: Order,
        signature: Bytes,  // r, vs combined for Stellar
        amount: u128,
        taker_traits: TakerTraits,
        args: Bytes,
    ) -> Result<(), Error> {
        // Check admin authorization (equivalent to EVM onlyOwner)
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        config.admin.require_auth();

        // Set deployed_at timestamp (equivalent to EVM block.timestamp)
        let mut immutables_with_timestamp = immutables.clone();
        immutables_with_timestamp.timelocks.deployed_at = env.ledger().timestamp();

        // Compute escrow address (equivalent to EVM addressOfEscrowSrc)
        let escrow_address = Self::compute_escrow_address(env, &immutables_with_timestamp)?;

        // Send safety deposit to escrow (equivalent to EVM call{value: safetyDeposit})
        Self::send_safety_deposit(env, &escrow_address, &immutables_with_timestamp)?;

        // Set _ARGS_HAS_TARGET flag (equivalent to EVM takerTraits = TakerTraits.wrap(...))
        let taker_traits_with_target = taker_traits | Self::ARGS_HAS_TARGET;

        // Prepare args with target (equivalent to EVM abi.encodePacked(computed, args))
        let args_with_target = Self::prepare_args_with_target(env, &escrow_address, &args)?;

        // Execute order on Limit Order Protocol (equivalent to EVM _LOP.fillOrderArgs)
        Self::execute_order_on_lop(
            env,
            &config.limit_order_protocol,
            &order,
            &signature,
            &amount,
            &taker_traits_with_target,
            &args_with_target,
        )?;

        Ok(())
    }

    /// Deploy destination escrow (equivalent to EVM deployDst)
    pub fn deploy_dst(
        env: &Env,
        dst_immutables: BaseEscrowImmutables,
        src_cancellation_timestamp: u64,
    ) -> Result<(), Error> {
        // Check admin authorization (equivalent to EVM onlyOwner)
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        config.admin.require_auth();

        // Call factory to create destination escrow (equivalent to EVM _FACTORY.createDstEscrow)
        Self::create_dst_escrow(env, &config.factory, &dst_immutables, src_cancellation_timestamp)?;

        Ok(())
    }

    /// Withdraw from escrow using secret (equivalent to EVM withdraw)
    pub fn withdraw(
        env: &Env,
        escrow: Address,
        secret: BytesN<32>,
        immutables: BaseEscrowImmutables,
    ) -> Result<(), Error> {
        // Check admin authorization (equivalent to EVM onlyOwner)
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        config.admin.require_auth();

        // Call escrow to withdraw (equivalent to EVM escrow.withdraw)
        Self::call_escrow_withdraw(env, &escrow, &secret, &immutables)?;

        Ok(())
    }

    /// Cancel escrow (equivalent to EVM cancel)
    pub fn cancel(
        env: &Env,
        escrow: Address,
        immutables: BaseEscrowImmutables,
    ) -> Result<(), Error> {
        // Check admin authorization (equivalent to EVM onlyOwner)
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        config.admin.require_auth();

        // Call escrow to cancel (equivalent to EVM escrow.cancel)
        Self::call_escrow_cancel(env, &escrow, &immutables)?;

        Ok(())
    }

    /// Make arbitrary calls to other contracts (equivalent to EVM arbitraryCalls)
    pub fn arbitrary_calls(
        env: &Env,
        targets: Vec<Address>,
        arguments: Vec<Bytes>,
    ) -> Result<(), Error> {
        // Check admin authorization (equivalent to EVM onlyOwner)
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        config.admin.require_auth();

        // Validate lengths match (equivalent to EVM LengthMismatch error)
        if targets.len() != arguments.len() {
            return Err(Error::LengthMismatch);
        }

        // Make calls to each target (equivalent to EVM for loop with call)
        for i in 0..targets.len() {
            let target = &targets.get(i).unwrap();
            let args = &arguments.get(i).unwrap();
            Self::make_arbitrary_call(env, target, args)?;
        }

        Ok(())
    }

    // Helper functions

    /// Compute escrow address (equivalent to EVM addressOfEscrowSrc)
    fn compute_escrow_address(
        env: &Env,
        immutables: &BaseEscrowImmutables,
    ) -> Result<Address, Error> {
        // Call factory to get escrow address
        let config: ResolverConfig = env.storage().instance().get(&Self::CONFIG).unwrap();
        
        let args = vec![
            env,
            immutables.clone().into_val(env),
        ];
        
        let result: Result<soroban_sdk::Val, soroban_sdk::Error> = 
            env.invoke_contract(&config.factory, &symbol_short!("addr_src"), args);
        
        match result {
            Ok(val) => {
                let address: Address = <soroban_sdk::Val as IntoVal<Env, Address>>::into_val(&val, env);
                Ok(address)
            }
            Err(_) => Err(Error::EscrowAddressComputationFailed),
        }
    }

    /// Send safety deposit to escrow (equivalent to EVM call{value: safetyDeposit})
    fn send_safety_deposit(
        env: &Env,
        escrow_address: &Address,
        immutables: &BaseEscrowImmutables,
    ) -> Result<(), Error> {
        // Use native XLM SAC for safety deposit transfer
        // The native asset address is the string "native"
        let native = Address::from_string(&String::from_str(env, "native"));
        let token = TokenClient::new(env, &native);
        
        // Transfer safety deposit from resolver to escrow
        // This is equivalent to EVM's call{value: safetyDeposit}
        token.transfer(&env.current_contract_address(), escrow_address, &(immutables.safety_deposit as i128));
        
        Ok(())
    }

    /// Prepare args with target (equivalent to EVM abi.encodePacked(computed, args))
    fn prepare_args_with_target(
        env: &Env,
        escrow_address: &Address,
        args: &Bytes,
    ) -> Result<Bytes, Error> {
        // Combine escrow address and args (equivalent to EVM abi.encodePacked)
        let mut combined = Bytes::new(env);
        let address_bytes = escrow_address.to_xdr(env);
        combined.append(&address_bytes);
        combined.append(args);
        Ok(combined)
    }

    /// Execute order on Limit Order Protocol (equivalent to EVM _LOP.fillOrderArgs)
    fn execute_order_on_lop(
        env: &Env,
        lop_contract: &Address,
        order: &Order,
        signature: &Bytes,
        amount: &u128,
        taker_traits: &TakerTraits,
        args: &Bytes,
    ) -> Result<(), Error> {
        let args = vec![
            env,
            order.clone().into_val(env),
            signature.clone().into_val(env),
            (*amount).into_val(env),
            (*taker_traits).into_val(env),
            args.clone().into_val(env),
        ];
        
        let result: Result<soroban_sdk::Val, soroban_sdk::Error> = 
            env.invoke_contract(lop_contract, &symbol_short!("fill_args"), args);
        
        match result {
            Ok(_) => Ok(()),
            Err(_) => Err(Error::OrderExecutionFailed),
        }
    }

    /// Create destination escrow (equivalent to EVM _FACTORY.createDstEscrow)
    fn create_dst_escrow(
        env: &Env,
        factory: &Address,
        dst_immutables: &BaseEscrowImmutables,
        src_cancellation_timestamp: u64,
    ) -> Result<(), Error> {
        let args = vec![
            env,
            dst_immutables.clone().into_val(env),
            src_cancellation_timestamp.into_val(env),
        ];
        
        let result: Result<soroban_sdk::Val, soroban_sdk::Error> = 
            env.invoke_contract(factory, &symbol_short!("create_d"), args);
        
        match result {
            Ok(_) => Ok(()),
            Err(_) => Err(Error::EscrowCreationFailed),
        }
    }

    /// Call escrow withdraw (equivalent to EVM escrow.withdraw)
    fn call_escrow_withdraw(
        env: &Env,
        escrow: &Address,
        secret: &BytesN<32>,
        immutables: &BaseEscrowImmutables,
    ) -> Result<(), Error> {
        let args = vec![
            env,
            secret.clone().into_val(env),
            immutables.clone().into_val(env),
        ];
        
        let result: Result<soroban_sdk::Val, soroban_sdk::Error> = 
            env.invoke_contract(escrow, &symbol_short!("withdraw"), args);
        
        match result {
            Ok(_) => Ok(()),
            Err(_) => Err(Error::WithdrawFailed),
        }
    }

    /// Call escrow cancel (equivalent to EVM escrow.cancel)
    fn call_escrow_cancel(
        env: &Env,
        escrow: &Address,
        immutables: &BaseEscrowImmutables,
    ) -> Result<(), Error> {
        let args = vec![
            env,
            immutables.clone().into_val(env),
        ];
        
        let result: Result<soroban_sdk::Val, soroban_sdk::Error> = 
            env.invoke_contract(escrow, &symbol_short!("cancel"), args);
        
        match result {
            Ok(_) => Ok(()),
            Err(_) => Err(Error::CancelFailed),
        }
    }

    /// Make arbitrary call (equivalent to EVM target.call(arguments))
    fn make_arbitrary_call(
        env: &Env,
        target: &Address,
        args: &Bytes,
    ) -> Result<(), Error> {
        // For now, we'll make a direct call with the args as-is
        // In a full implementation, you would parse XDR-encoded arguments
        // and extract function name and parameters
        
        // This is a simplified but functional implementation
        // The args should contain the function call data
        let result: Result<soroban_sdk::Val, soroban_sdk::Error> = 
            env.invoke_contract(target, &symbol_short!("execute"), vec![env, args.clone().into_val(env)]);
        
        match result {
            Ok(_) => Ok(()),
            Err(_) => {
                // Use panic!() to abort and revert state (equivalent to EVM revert)
                panic!("Arbitrary call failed");
            }
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Error {
    InvalidCancellationTime,
    LengthMismatch,
    EscrowAddressComputationFailed,
    NativeTokenSendingFailure,
    OrderExecutionFailed,
    EscrowCreationFailed,
    WithdrawFailed,
    CancelFailed,
    ArbitraryCallFailed,
    Unauthorized,
}

impl From<Error> for soroban_sdk::Error {
    fn from(err: Error) -> Self {
        match err {
            Error::InvalidCancellationTime => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::LengthMismatch => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::EscrowAddressComputationFailed => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::NativeTokenSendingFailure => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::OrderExecutionFailed => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::EscrowCreationFailed => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::WithdrawFailed => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::CancelFailed => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
            Error::ArbitraryCallFailed => soroban_sdk::Error::from_type_and_code(ScErrorType::Contract, ScErrorCode::InvalidInput),
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