# Navigate to stellar directory

cd blockend/stellar

# Build FusionPlusEscrow

cd contracts/fusion_plus_escrow
cargo build --target wasm32-unknown-unknown --release

# Build StellarEscrowFactory

cd ../stellar_escrow_factory
cargo build --target wasm32-unknown-unknown --release

# Go back to stellar root

cd ../../

# Deploy FusionPlusEscrow (copy the ID manually)

stellar contract deploy \
 --wasm target/wasm32-unknown-unknown/release/fusion_plus_escrow.wasm \
 --source-account alice \
 --network testnet \
 --alias fusion_plus_escrow

# Deploy StellarEscrowFactory (copy the ID manually)

stellar contract deploy \
 --wasm target/wasm32-unknown-unknown/release/stellar_escrow_factory.wasm \
 --source-account alice \
 --network testnet \
 --alias stellar_escrow_factory

# Initialize factory (replace FACTORY_ID with your actual factory ID)

stellar contract invoke \
 --id stellar_escrow_factory \
 --source-account alice \
 --network testnet \
 -- \
 initialize \
 --escrow_wasm_hash a99516dcb5b3c76678c20e864a7b439d3d8cf4d6a871cee2fa5c2baa22bf7a22 \
 --admin $(stellar keys public-key alice)
