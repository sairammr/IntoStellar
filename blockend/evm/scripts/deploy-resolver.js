const {ethers} = require('ethers')
require('dotenv').config()

async function deployResolver() {
    // Load environment variables
    const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/c1f86d8ca5114951a55937eb27a15b9f'
    const PRIVATE_KEY = process.env.PRIVATE_KEY || '87138e7ee20a24b26c4a3815c818b54d6153afc23c58754f7b5d92a28219c682'
    const ESCROW_FACTORY = process.env.ESCROW_FACTORY || '0x0000000000000000000000000000000000000000'
    const LIMIT_ORDER_PROTOCOL = process.env.LIMIT_ORDER_PROTOCOL || '0x111111125421ca6dc452d289314280a0f8842a65'

    console.log('🚀 Deploying Resolver...')
    console.log('RPC URL:', RPC_URL)
    console.log('Escrow Factory:', ESCROW_FACTORY)
    console.log('Limit Order Protocol:', LIMIT_ORDER_PROTOCOL)

    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

    console.log('Deployer address:', wallet.address)

    // Load the compiled contract
    const contractJson = require('../dist/contracts/Resolver.sol/Resolver.json')

    // Create contract factory
    const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet)

    try {
        // Deploy the contract with constructor arguments
        console.log('Deploying contract...')
        const contract = await factory.deploy(
            ESCROW_FACTORY, // escrowFactory
            LIMIT_ORDER_PROTOCOL, // limitOrderProtocol
            wallet.address // owner
        )

        console.log('Transaction hash:', contract.deploymentTransaction().hash)
        console.log('Waiting for deployment...')

        await contract.waitForDeployment()

        const address = await contract.getAddress()
        console.log('✅ Resolver deployed successfully!')
        console.log('Contract address:', address)
        console.log('Etherscan URL:', `https://sepolia.etherscan.io/address/${address}`)

        // Test basic functions
        console.log('\n🧪 Testing contract functions...')

        const owner = await contract.owner()
        console.log('Owner:', owner)

        const escrowFactory = await contract.escrowFactory()
        console.log('Escrow Factory:', escrowFactory)

        const limitOrderProtocol = await contract.limitOrderProtocol()
        console.log('Limit Order Protocol:', limitOrderProtocol)

        return address
    } catch (error) {
        console.error('❌ Deployment failed:', error)
        throw error
    }
}

// Run deployment if this script is executed directly
if (require.main === module) {
    deployResolver()
        .then((address) => {
            console.log('\n🎉 Deployment completed successfully!')
            console.log('Contract address:', address)
            process.exit(0)
        })
        .catch((error) => {
            console.error('❌ Deployment failed:', error)
            process.exit(1)
        })
}

module.exports = {deployResolver}
