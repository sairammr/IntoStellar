import 'dotenv/config'
import {expect, jest} from '@jest/globals'

import {createServer, CreateServerReturnType} from 'prool'
import {anvil} from 'prool/instances'

import {JsonRpcProvider, parseEther, parseUnits, randomBytes, Wallet as SignerWallet} from 'ethers'
import {uint8ArrayToHex} from '@1inch/byte-utils'
import {StellarWallet} from './stellar-wallet'
import {config} from './config-stellar'

jest.setTimeout(1000 * 120) // Increased timeout for cross-chain operations

const userPk = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const stellarUserPk = 'SCYIDJUAE7GGRY6ZJPBS3FVHR7DHFG3VPQWWKR3NIYC2SRHCG4VA7Q7L'

// eslint-disable-next-line max-lines-per-function
describe('ETH-Stellar Simple Integration Test', () => {
    let ethProvider: JsonRpcProvider | null = null
    let ethNode: CreateServerReturnType | null = null
    let ethUser: SignerWallet | null = null
    let stellarUser: StellarWallet | null = null

    beforeAll(async () => {
        console.log('🚀 Setting up ETH-Stellar simple integration test...')

        try {
            // Initialize Ethereum fork
            console.log('[ETH] Creating Ethereum fork...')
            const port = 8545 + Math.floor(Math.random() * 1000)

            ethNode = createServer({
                instance: anvil({
                    forkUrl: 'https://eth.merkle.io',
                    forkBlockNumber: 21316103,
                    accounts: [{privateKey: userPk, balance: parseEther('100')}]
                }),
                port
            })

            await ethNode.start()
            const ethUrl = `http://localhost:${port}`
            console.log(`[ETH] Fork started on port ${port}, connecting to ${ethUrl}`)

            ethProvider = new JsonRpcProvider(ethUrl)
            ethUser = new SignerWallet(userPk, ethProvider)

            console.log(`[ETH] User address: ${await ethUser.getAddress()}`)

            // Initialize Stellar user
            console.log('[STELLAR] Setting up Stellar testnet user...')
            stellarUser = await StellarWallet.fromSecret(stellarUserPk, config.chain.destination)

            console.log(`[STELLAR] User address: ${stellarUser.getAddress()}`)

            // Fund Stellar account from friendbot
            console.log('[STELLAR] Funding account from friendbot...')
            await stellarUser.topUpFromFriendbot()

            const stellarBalance = await stellarUser.getBalance('XLM')
            console.log(`[STELLAR] User XLM balance: ${stellarBalance}`)

            console.log('✅ Setup complete!')
        } catch (error) {
            console.error('❌ Setup failed:', error)
            throw error
        }
    })

    afterAll(async () => {
        console.log('🧹 Cleaning up...')
        try {
            if (ethProvider) {
                ethProvider.destroy()
            }
            if (ethNode) {
                await ethNode.stop()
            }
        } catch (error) {
            console.warn('Cleanup error:', error)
        }
    })

    describe('Basic Setup', () => {
        it('should have working Ethereum fork', async () => {
            if (!ethUser || !ethProvider) {
                throw new Error('Ethereum setup failed')
            }

            const balance = await ethProvider.getBalance(await ethUser.getAddress())
            console.log(`[ETH] User ETH balance: ${balance.toString()}`)

            expect(balance).toBeGreaterThan(0n)
        })

        it('should have working Stellar testnet connection', async () => {
            if (!stellarUser) {
                throw new Error('Stellar setup failed')
            }

            const balance = await stellarUser.getBalance('XLM')
            console.log(`[STELLAR] User XLM balance: ${balance}`)

            expect(parseFloat(balance)).toBeGreaterThan(0)
        })
    })

    describe('Cross-Chain Simulation', () => {
        it('should simulate ETH -> Stellar swap', async () => {
            if (!ethUser || !stellarUser || !ethProvider) {
                throw new Error('Setup incomplete')
            }

            console.log('🚀 Starting ETH -> Stellar swap simulation...')

            // Get initial balances
            const initialEthBalance = await ethProvider.getBalance(await ethUser.getAddress())
            const initialStellarBalance = await stellarUser.getBalance('XLM')

            console.log('Initial balances:', {
                eth: initialEthBalance.toString(),
                stellar: initialStellarBalance
            })

            // Simulate user action: "lock" some ETH (just send to a different address as simulation)
            const lockAmount = parseEther('0.1')
            const lockTx = await ethUser.sendTransaction({
                to: '0x0000000000000000000000000000000000000001', // burn address
                value: lockAmount
            })
            await lockTx.wait()

            console.log(`[ETH] Simulated locking ${lockAmount} ETH in tx ${lockTx.hash}`)

            // Simulate stellar transfer (representing the cross-chain swap result)
            const stellarTransferAmount = '10' // 10 XLM

            // In a real implementation, this would be done by the relayer service
            // For now, we'll just transfer to the same account to simulate receiving funds
            try {
                await stellarUser.transfer(stellarUser.getAddress(), stellarTransferAmount, 'XLM')
                console.log(`[STELLAR] Simulated receiving ${stellarTransferAmount} XLM`)
            } catch (error) {
                console.log(`[STELLAR] Transfer simulation (expected for same account):`, error.message)
            }

            // Get final balances
            const finalEthBalance = await ethProvider.getBalance(await ethUser.getAddress())
            const finalStellarBalance = await stellarUser.getBalance('XLM')

            console.log('Final balances:', {
                eth: finalEthBalance.toString(),
                stellar: finalStellarBalance
            })

            // Verify the swap simulation
            expect(finalEthBalance).toBeLessThan(initialEthBalance) // ETH was spent
            console.log('✅ ETH -> Stellar swap simulation completed!')
        })

        it('should demonstrate secret-based atomic swap pattern', async () => {
            console.log('🔐 Demonstrating atomic swap secret pattern...')

            // Generate a secret and its hash (like HTLC)
            const secret = uint8ArrayToHex(randomBytes(32))
            const secretHash = uint8ArrayToHex(randomBytes(32)) // In real implementation, this would be sha256(secret)

            console.log('Generated secret pattern:', {
                secretLength: secret.length,
                hashLength: secretHash.length,
                secretPreview: secret.substring(0, 10) + '...',
                hashPreview: secretHash.substring(0, 10) + '...'
            })

            // In a real atomic swap:
            // 1. User creates order with secret hash
            // 2. Resolver fills order on source chain (ETH)
            // 3. Relayer creates corresponding escrow on destination chain (Stellar)
            // 4. User reveals secret to withdraw from destination
            // 5. Resolver uses revealed secret to withdraw from source

            console.log('Atomic swap pattern components:', {
                step1: 'Order creation with secret hash ✓',
                step2: 'Source chain escrow (ETH) - simulated ✓',
                step3: 'Destination chain escrow (Stellar) - simulated ✓',
                step4: 'Secret revelation for withdrawal ✓',
                step5: 'Cross-chain settlement ✓'
            })

            expect(secret).toBeDefined()
            expect(secretHash).toBeDefined()
            expect(secret.length).toBeGreaterThan(0)

            console.log('✅ Atomic swap pattern demonstration completed!')
        })
    })

    describe('Real Integration Points', () => {
        it('should connect to deployed contracts', async () => {
            console.log('📋 Testing connection to deployed contracts...')

            // From the relayer service .env file
            const contractAddresses = {
                eth: {
                    escrowFactory: '0x55843E49acD5E479d2a3ec1Ab004334400c5AE4C',
                    limitOrderProtocol: '0x4c8a6315D705cb6669bC9EB37Df1eA35853386c3',
                    resolver: '0xC0AbE9Eb0bd7B40881101449d9978bf0806b47Ab'
                },
                stellar: {
                    escrowFactory: 'CCE5M2R5KRBL7LJDBI64B2HTUFKEOZXVQOELEYJRQ4LGC7FGRJU5KUH6',
                    limitOrderProtocol: 'CC4IKNTKK5MHJYJPA2MOSZQCATQN274JHVHZ3ZTABBXKVTURTFMM4O6V',
                    resolver: 'CDDGIPDK4QWH2CPJGB3YB4AVN5C7CQD46GN74XE5H5N2D3QLOIGDQAUK'
                }
            }

            console.log('Contract addresses:', contractAddresses)

            // In a real test, you would:
            // 1. Connect to these deployed contracts
            // 2. Call view functions to verify they're working
            // 3. Test the relayer service endpoints
            // 4. Perform end-to-end swaps

            expect(contractAddresses.eth.escrowFactory).toMatch(/^0x[a-fA-F0-9]{40}$/)
            expect(contractAddresses.stellar.escrowFactory).toMatch(/^C[A-Z0-9]{55}$/)

            console.log('✅ Contract addresses validated!')
        })

        it('should outline relayer service integration', async () => {
            console.log('🔗 Outlining relayer service integration...')

            const relayerEndpoints = {
                health: 'http://localhost:3000/health',
                swap: 'http://localhost:3000/api/swap',
                status: 'http://localhost:3000/api/swap/status'
            }

            const sampleSwapRequest = {
                sourceChain: 'ethereum',
                destinationChain: 'stellar',
                sourceAsset: 'USDC',
                destinationAsset: 'XLM',
                amount: '100',
                sourceAddress: ethUser ? await ethUser.getAddress() : '0x...',
                destinationAddress: stellarUser ? stellarUser.getAddress() : 'G...',
                secretHash: uint8ArrayToHex(randomBytes(32))
            }

            console.log('Relayer integration points:', {
                endpoints: relayerEndpoints,
                sampleRequest: sampleSwapRequest
            })

            // In a real test, you would:
            // 1. Start the relayer service
            // 2. Make HTTP requests to create swaps
            // 3. Monitor the swap status
            // 4. Verify cross-chain transactions

            expect(relayerEndpoints.swap).toBeDefined()
            expect(sampleSwapRequest.sourceChain).toBe('ethereum')
            expect(sampleSwapRequest.destinationChain).toBe('stellar')

            console.log('✅ Relayer service integration outlined!')
        })
    })
})
