import * as StellarSdk from '@stellar/stellar-sdk'
import {StellarConfig} from './config-stellar'

export class StellarWallet {
    public server: StellarSdk.Horizon.Server
    public keypair: StellarSdk.Keypair
    public account: StellarSdk.AccountResponse | null = null
    public networkPassphrase: string

    constructor(privateKey: string, config: StellarConfig) {
        this.server = new StellarSdk.Horizon.Server(config.horizonUrl)
        this.keypair = StellarSdk.Keypair.fromSecret(privateKey)
        this.networkPassphrase = config.networkPassphrase
    }

    public static async fromSecret(privateKey: string, config: StellarConfig): Promise<StellarWallet> {
        const wallet = new StellarWallet(privateKey, config)
        await wallet.loadAccount()
        return wallet
    }

    public static async fromAddress(publicKey: string, config: StellarConfig): Promise<StellarWallet> {
        // For testing purposes, we'll use a test private key
        // In real scenarios, this would be used differently
        const wallet = new StellarWallet('SCYIDJUAE7GGRY6ZJPBS3FVHR7DHFG3VPQWWKR3NIYC2SRHCG4VA7Q7L', config)
        await wallet.loadAccount()
        return wallet
    }

    public async loadAccount(): Promise<void> {
        try {
            this.account = await this.server.loadAccount(this.getAddress())
        } catch (error) {
            // Account might not exist yet, we'll handle this in the calling code
            console.warn(`Account ${this.getAddress()} not found, might need funding`)
        }
    }

    public getAddress(): string {
        return this.keypair.publicKey()
    }

    public async getBalance(assetCode?: string, assetIssuer?: string): Promise<string> {
        if (!this.account) {
            await this.loadAccount()
        }

        if (!this.account) {
            return '0'
        }

        if (!assetCode || assetCode === 'XLM' || assetCode === 'native') {
            // Native XLM balance
            const nativeBalance = this.account.balances.find((balance) => balance.asset_type === 'native')
            return nativeBalance ? nativeBalance.balance : '0'
        } else {
            // Asset balance
            const assetBalance = this.account.balances.find(
                (balance) =>
                    balance.asset_type !== 'native' &&
                    'asset_code' in balance &&
                    balance.asset_code === assetCode &&
                    'asset_issuer' in balance &&
                    balance.asset_issuer === assetIssuer
            )
            return assetBalance ? assetBalance.balance : '0'
        }
    }

    public async transfer(
        destination: string,
        amount: string,
        assetCode?: string,
        assetIssuer?: string
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        if (!this.account) {
            await this.loadAccount()
        }

        const asset =
            assetCode && assetCode !== 'XLM' && assetCode !== 'native'
                ? new StellarSdk.Asset(assetCode, assetIssuer!)
                : StellarSdk.Asset.native()

        const transaction = new StellarSdk.TransactionBuilder(this.account!, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: this.networkPassphrase
        })
            .addOperation(
                StellarSdk.Operation.payment({
                    destination,
                    asset,
                    amount
                })
            )
            .setTimeout(30)
            .build()

        transaction.sign(this.keypair)
        return await this.server.submitTransaction(transaction)
    }

    public async topUpFromFriendbot(): Promise<void> {
        try {
            await fetch(`https://friendbot.stellar.org?addr=${encodeURIComponent(this.getAddress())}`)
            // Wait for the transaction to be processed
            await new Promise((resolve) => setTimeout(resolve, 2000))
            await this.loadAccount()
        } catch (error) {
            console.error('Friendbot funding failed:', error)
            throw error
        }
    }

    public async invokeContract(
        contractAddress: string,
        method: string,
        args: StellarSdk.xdr.ScVal[],
        fee: string = '1000000'
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        if (!this.account) {
            await this.loadAccount()
        }

        const contract = new StellarSdk.Contract(contractAddress)

        const transaction = new StellarSdk.TransactionBuilder(this.account!, {
            fee,
            networkPassphrase: this.networkPassphrase
        })
            .addOperation(contract.call(method, ...args))
            .setTimeout(30)
            .build()

        // Simulate first to get the proper fee
        const simulated = await this.server.simulateTransaction(transaction)

        if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(simulated)) {
            const assembled = StellarSdk.assembleTransaction(transaction, simulated)
            assembled.sign(this.keypair)
            return await this.server.submitTransaction(assembled)
        } else {
            throw new Error(`Contract simulation failed: ${simulated.error}`)
        }
    }

    public async createTrustline(
        assetCode: string,
        assetIssuer: string,
        limit?: string
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        if (!this.account) {
            await this.loadAccount()
        }

        const asset = new StellarSdk.Asset(assetCode, assetIssuer)

        const transaction = new StellarSdk.TransactionBuilder(this.account!, {
            fee: StellarSdk.BASE_FEE,
            networkPassphrase: this.networkPassphrase
        })
            .addOperation(
                StellarSdk.Operation.changeTrust({
                    asset,
                    limit
                })
            )
            .setTimeout(30)
            .build()

        transaction.sign(this.keypair)
        return await this.server.submitTransaction(transaction)
    }
}
