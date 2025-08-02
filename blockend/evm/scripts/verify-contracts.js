const {ethers} = require('ethers')
require('dotenv').config()

async function verifyContract(contractName, contractAddress, constructorArgs = []) {
    const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY
    if (!ETHERSCAN_API_KEY) {
        console.log(`⚠️  Skipping verification for ${contractName} - ETHERSCAN_API_KEY not set`)
        return
    }

    console.log(`🔍 Verifying ${contractName} at ${contractAddress}...`)

    try {
        // Load contract JSON
        const contractJson = require(`../dist/contracts/${contractName}.sol/${contractName}.json`)

        // Prepare verification data
        const verificationData = {
            contractAddress: contractAddress,
            sourceCode: JSON.stringify(contractJson.metadata),
            abiEncodedConstructorArguments:
                constructorArgs.length > 0
                    ? ethers.AbiCoder.defaultAbiCoder()
                          .encode(
                              contractJson.abi.find((item) => item.type === 'constructor')?.inputs || [],
                              constructorArgs
                          )
                          .slice(2)
                    : '', // Remove '0x' prefix
            compilerVersion: `v${contractJson.metadata.compiler.version}`,
            optimizationUsed: contractJson.metadata.settings.optimizer.enabled ? '1' : '0',
            runs: contractJson.metadata.settings.optimizer.runs.toString(),
            licenseType: contractJson.metadata.sources[Object.keys(contractJson.metadata.sources)[0]].license
        }

        // Make verification request
        const response = await fetch(`https://api-sepolia.etherscan.io/api`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                apikey: ETHERSCAN_API_KEY,
                module: 'contract',
                action: 'verifysourcecode',
                ...verificationData
            })
        })

        const result = await response.json()

        if (result.status === '1') {
            console.log(`✅ ${contractName} verification submitted successfully!`)
            console.log(`   GUID: ${result.result}`)
            console.log(`   Check status: https://sepolia.etherscan.io/address/${contractAddress}#code`)
        } else {
            console.log(`❌ ${contractName} verification failed:`, result.result)
        }
    } catch (error) {
        console.error(`❌ Error verifying ${contractName}:`, error.message)
    }
}

async function verifyAllContracts() {
    console.log('🔍 Starting contract verification...\n')

    try {
        // Load deployment info
        const fs = require('fs')
        if (!fs.existsSync('deployment-info.json')) {
            console.log('❌ deployment-info.json not found. Please run deploy-all.js first.')
            return
        }

        const deploymentInfo = JSON.parse(fs.readFileSync('deployment-info.json', 'utf8'))
        const {contracts} = deploymentInfo

        // Verify LimitOrderProtocol
        await verifyContract('LimitOrderProtocol', contracts.limitOrderProtocol, [
            process.env.WETH_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9'
        ])

        // Verify EscrowFactory
        await verifyContract('EscrowFactory', contracts.escrowFactory, [
            contracts.limitOrderProtocol,
            process.env.WETH_ADDRESS || '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
            ethers.ZeroAddress,
            process.env.PRIVATE_KEY
                ? new ethers.Wallet(process.env.PRIVATE_KEY).address
                : '0xD1a7297B88f470e5e57c5183cB6D43b59024465F',
            1800,
            1800
        ])

        // Verify Resolver
        await verifyContract('Resolver', contracts.resolver, [
            contracts.escrowFactory,
            contracts.limitOrderProtocol,
            process.env.PRIVATE_KEY
                ? new ethers.Wallet(process.env.PRIVATE_KEY).address
                : '0xD1a7297B88f470e5e57c5183cB6D43b59024465F'
        ])

        console.log('\n🎉 Contract verification process completed!')
    } catch (error) {
        console.error('❌ Verification failed:', error)
        throw error
    }
}

// Run verification if this script is executed directly
if (require.main === module) {
    verifyAllContracts()
        .then(() => {
            console.log('\n🎉 All verifications completed!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('❌ Verification failed:', error)
            process.exit(1)
        })
}

module.exports = {verifyAllContracts, verifyContract}
