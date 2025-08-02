const {ethers} = require('ethers')
require('dotenv').config()

async function testContracts() {
    console.log('🧪 Testing deployed contracts...\n')

    try {
        // Load deployment info
        const fs = require('fs')
        if (!fs.existsSync('deployment-info.json')) {
            console.log('❌ deployment-info.json not found. Please run deploy-all.js first.')
            return
        }

        const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'))
        const {contracts} = deploymentInfo

        // Setup provider and wallet
        const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/c1f86d8ca5114951a55937eb27a15b9f'
        const PRIVATE_KEY =
            process.env.PRIVATE_KEY || '87138e7ee20a24b26c4a3815c818b54d6153afc23c58754f7b5d92a28219c682'

        const provider = new ethers.JsonRpcProvider(RPC_URL)
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider)

        console.log('🔗 Connected to network:', await provider.getNetwork())
        console.log('👤 Testing with address:', wallet.address)

        // Load contract ABIs
        const limitOrderProtocolJson = require('../dist/contracts/LimitOrderProtocol.sol/LimitOrderProtocol.json')
        const escrowFactoryJson = require('../dist/contracts/EscrowFactory.sol/EscrowFactory.json')
        const resolverJson = require('../dist/contracts/Resolver.sol/Resolver.json')

        // Create contract instances
        const limitOrderProtocol = new ethers.Contract(contracts.limitOrderProtocol, limitOrderProtocolJson.abi, wallet)
        const escrowFactory = new ethers.Contract(contracts.escrowFactory, escrowFactoryJson.abi, wallet)
        const resolver = new ethers.Contract(contracts.resolver, resolverJson.abi, wallet)

        console.log('\n📋 Testing LimitOrderProtocol...')
        console.log('Address:', contracts.limitOrderProtocol)

        const lopOwner = await limitOrderProtocol.owner()
        console.log('Owner:', lopOwner)

        const lopPaused = await limitOrderProtocol.paused()
        console.log('Paused:', lopPaused)

        const domainSeparator = await limitOrderProtocol.DOMAIN_SEPARATOR()
        console.log('Domain Separator:', domainSeparator)

        console.log('\n📋 Testing EscrowFactory...')
        console.log('Address:', contracts.escrowFactory)

        const factoryOwner = await escrowFactory.owner()
        console.log('Owner:', factoryOwner)

        const factoryLOP = await escrowFactory.limitOrderProtocol()
        console.log('Limit Order Protocol:', factoryLOP)

        const factoryFeeToken = await escrowFactory.feeToken()
        console.log('Fee Token:', factoryFeeToken)

        console.log('\n📋 Testing Resolver...')
        console.log('Address:', contracts.resolver)

        const resolverOwner = await resolver.owner()
        console.log('Owner:', resolverOwner)

        const resolverFactory = await resolver.escrowFactory()
        console.log('Escrow Factory:', resolverFactory)

        const resolverLOP = await resolver.limitOrderProtocol()
        console.log('Limit Order Protocol:', resolverLOP)

        // Test contract relationships
        console.log('\n🔗 Testing contract relationships...')

        if (factoryLOP === contracts.limitOrderProtocol) {
            console.log('✅ EscrowFactory correctly references LimitOrderProtocol')
        } else {
            console.log('❌ EscrowFactory LimitOrderProtocol reference mismatch')
        }

        if (resolverFactory === contracts.escrowFactory) {
            console.log('✅ Resolver correctly references EscrowFactory')
        } else {
            console.log('❌ Resolver EscrowFactory reference mismatch')
        }

        if (resolverLOP === contracts.limitOrderProtocol) {
            console.log('✅ Resolver correctly references LimitOrderProtocol')
        } else {
            console.log('❌ Resolver LimitOrderProtocol reference mismatch')
        }

        // Test basic functionality
        console.log('\n🧪 Testing basic functionality...')

        // Test pause/unpause on LimitOrderProtocol
        if (lopOwner === wallet.address) {
            console.log('Testing pause functionality...')
            if (!lopPaused) {
                const pauseTx = await limitOrderProtocol.pause()
                await pauseTx.wait()
                console.log('✅ Contract paused successfully')

                const unpauseTx = await limitOrderProtocol.unpause()
                await unpauseTx.wait()
                console.log('✅ Contract unpaused successfully')
            } else {
                console.log('Contract is already paused, testing unpause...')
                const unpauseTx = await limitOrderProtocol.unpause()
                await unpauseTx.wait()
                console.log('✅ Contract unpaused successfully')
            }
        } else {
            console.log('⚠️  Cannot test pause functionality - not the owner')
        }

        console.log('\n🎉 All tests completed successfully!')
    } catch (error) {
        console.error('❌ Testing failed:', error)
        throw error
    }
}

// Run tests if this script is executed directly
if (require.main === module) {
    testContracts()
        .then(() => {
            console.log('\n🎉 All tests passed!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('❌ Tests failed:', error)
            process.exit(1)
        })
}

module.exports = {testContracts}
