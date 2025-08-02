const {ethers} = require('ethers')
require('dotenv').config()

const {deployLimitOrderProtocol} = require('./deploy-limit-order-protocol')
const {deployEscrowFactory} = require('./deploy-escrow-factory')
const {deployResolver} = require('./deploy-resolver')

async function deployAllContracts() {
    console.log('🚀 Starting deployment of all contracts...\n')

    try {
        // Step 1: Deploy LimitOrderProtocol
        console.log('📋 Step 1: Deploying LimitOrderProtocol...')
        const limitOrderProtocolAddress = await deployLimitOrderProtocol()
        console.log('✅ LimitOrderProtocol deployed at:', limitOrderProtocolAddress)

        // Step 2: Deploy EscrowFactory (requires LimitOrderProtocol)
        console.log('\n📋 Step 2: Deploying EscrowFactory...')
        process.env.LIMIT_ORDER_PROTOCOL = limitOrderProtocolAddress
        const escrowFactoryAddress = await deployEscrowFactory()
        console.log('✅ EscrowFactory deployed at:', escrowFactoryAddress)

        // Step 3: Deploy Resolver (requires both LimitOrderProtocol and EscrowFactory)
        console.log('\n📋 Step 3: Deploying Resolver...')
        process.env.ESCROW_FACTORY = escrowFactoryAddress
        process.env.LIMIT_ORDER_PROTOCOL = limitOrderProtocolAddress
        const resolverAddress = await deployResolver()
        console.log('✅ Resolver deployed at:', resolverAddress)

        // Summary
        console.log('\n🎉 All contracts deployed successfully!')
        console.log('📊 Deployment Summary:')
        console.log('├── LimitOrderProtocol:', limitOrderProtocolAddress)
        console.log('├── EscrowFactory:', escrowFactoryAddress)
        console.log('└── Resolver:', resolverAddress)

        // Save addresses to a file
        const deploymentInfo = {
            network: 'sepolia',
            deployedAt: new Date().toISOString(),
            contracts: {
                limitOrderProtocol: limitOrderProtocolAddress,
                escrowFactory: escrowFactoryAddress,
                resolver: resolverAddress
            }
        }

        const fs = require('fs')
        fs.writeFileSync('deployment-info.json', JSON.stringify(deploymentInfo, null, 2))
        console.log('\n💾 Deployment info saved to deployment-info.json')

        // Environment variables for easy copy-paste
        console.log('\n🔧 Environment Variables:')
        console.log(`LIMIT_ORDER_PROTOCOL=${limitOrderProtocolAddress}`)
        console.log(`ESCROW_FACTORY=${escrowFactoryAddress}`)
        console.log(`RESOLVER=${resolverAddress}`)

        return deploymentInfo
    } catch (error) {
        console.error('❌ Deployment failed:', error)
        throw error
    }
}

// Run deployment if this script is executed directly
if (require.main === module) {
    deployAllContracts()
        .then((deploymentInfo) => {
            console.log('\n🎉 All deployments completed successfully!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('❌ Deployment failed:', error)
            process.exit(1)
        })
}

module.exports = {deployAllContracts}
