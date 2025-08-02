const {ethers} = require('ethers')
require('dotenv').config()

async function deployLimitOrderProtocol() {
    // Load environment variables
    const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/c1f86d8ca5114951a55937eb27a15b9f'
    const PRIVATE_KEY = process.env.PRIVATE_KEY || '87138e7ee20a24b26c4a3815c818b54d6153afc23c58754f7b5d92a28219c682'
    const WETH_ADDRESS = process.env.WETH_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'

    console.log('🚀 Deploying LimitOrderProtocol...')
    console.log('RPC URL:', RPC_URL)
    console.log('WETH Address:', WETH_ADDRESS)

    // Create provider and wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL)
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

    console.log('Deployer address:', wallet.address)

    // Load the compiled contract
    const contractJson = require('../dist/contracts/LimitOrderProtocol.sol/LimitOrderProtocol.json')

    // Create contract factory
    const factory = new ethers.ContractFactory(contractJson.abi, contractJson.bytecode, wallet)

    try {
        // Deploy the contract
        console.log('Deploying contract...')
        const contract = await factory.deploy(WETH_ADDRESS)

        console.log('Transaction hash:', contract.deploymentTransaction().hash)
        console.log('Waiting for deployment...')

        await contract.waitForDeployment()

        const address = await contract.getAddress()
        console.log('✅ LimitOrderProtocol deployed successfully!')
        console.log('Contract address:', address)
        console.log('Etherscan URL:', `https://sepolia.etherscan.io/address/${address}`)

        // Test basic functions
        console.log('\n🧪 Testing contract functions...')

        const owner = await contract.owner()
        console.log('Owner:', owner)

        const domainSeparator = await contract.DOMAIN_SEPARATOR()
        console.log('Domain Separator:', domainSeparator)

        const paused = await contract.paused()
        console.log('Paused:', paused)

        return address
    } catch (error) {
        console.error('❌ Deployment failed:', error)
        throw error
    }
}

// Run deployment if this script is executed directly
if (require.main === module) {
    deployLimitOrderProtocol()
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

module.exports = {deployLimitOrderProtocol}
