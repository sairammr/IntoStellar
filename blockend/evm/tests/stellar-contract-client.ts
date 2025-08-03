import * as StellarSdk from '@stellar/stellar-sdk'
import {StellarWallet} from './stellar-wallet'
import {StellarConfig} from './config-stellar'

export class StellarEscrowFactory {
    public server: StellarSdk.Horizon.Server
    public contractAddress: string
    public networkPassphrase: string

    constructor(config: StellarConfig, contractAddress: string) {
        this.server = new StellarSdk.Horizon.Server(config.horizonUrl)
        this.contractAddress = contractAddress
        this.networkPassphrase = config.networkPassphrase
    }

    public async createEscrow(
        wallet: StellarWallet,
        orderHash: string,
        srcChainId: number,
        dstChainId: number,
        srcEscrow: string,
        maker: string,
        makingAmount: string,
        takingAmount: string,
        hashLock: string,
        timeLocks: {
            srcWithdrawal: number
            srcPublicWithdrawal: number
            srcCancellation: number
            srcPublicCancellation: number
            dstWithdrawal: number
            dstPublicWithdrawal: number
            dstCancellation: number
        },
        safetyDeposit: string
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        const args = [
            StellarSdk.nativeToScVal(orderHash, {type: 'bytes'}),
            StellarSdk.nativeToScVal(srcChainId, {type: 'u32'}),
            StellarSdk.nativeToScVal(dstChainId, {type: 'u32'}),
            StellarSdk.nativeToScVal(srcEscrow, {type: 'address'}),
            StellarSdk.nativeToScVal(maker, {type: 'address'}),
            StellarSdk.nativeToScVal(makingAmount, {type: 'u64'}),
            StellarSdk.nativeToScVal(takingAmount, {type: 'u64'}),
            StellarSdk.nativeToScVal(hashLock, {type: 'bytes'}),
            StellarSdk.nativeToScVal({
                src_withdrawal: timeLocks.srcWithdrawal,
                src_public_withdrawal: timeLocks.srcPublicWithdrawal,
                src_cancellation: timeLocks.srcCancellation,
                src_public_cancellation: timeLocks.srcPublicCancellation,
                dst_withdrawal: timeLocks.dstWithdrawal,
                dst_public_withdrawal: timeLocks.dstPublicWithdrawal,
                dst_cancellation: timeLocks.dstCancellation
            }),
            StellarSdk.nativeToScVal(safetyDeposit, {type: 'u64'})
        ]

        return await wallet.invokeContract(this.contractAddress, 'create_escrow', args)
    }

    public async getEscrowAddress(wallet: StellarWallet, orderHash: string): Promise<string> {
        const args = [StellarSdk.nativeToScVal(orderHash, {type: 'bytes'})]

        // For now, we'll return a mock address since we need to simulate the contract call
        // In a real implementation, this would call the contract and return the actual address
        return `ESCROW_${orderHash.substring(0, 8)}`
    }
}

export class StellarResolver {
    public server: StellarSdk.Horizon.Server
    public contractAddress: string
    public networkPassphrase: string

    constructor(config: StellarConfig, contractAddress: string) {
        this.server = new StellarSdk.Horizon.Server(config.horizonUrl)
        this.contractAddress = contractAddress
        this.networkPassphrase = config.networkPassphrase
    }

    public async fillOrder(
        wallet: StellarWallet,
        orderHash: string,
        fillAmount: string,
        secret: string
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        const args = [
            StellarSdk.nativeToScVal(orderHash, {type: 'bytes'}),
            StellarSdk.nativeToScVal(fillAmount, {type: 'u64'}),
            StellarSdk.nativeToScVal(secret, {type: 'bytes'})
        ]

        return await wallet.invokeContract(this.contractAddress, 'fill_order', args)
    }

    public async withdrawFunds(
        wallet: StellarWallet,
        escrowAddress: string,
        secret: string
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        const args = [
            StellarSdk.nativeToScVal(escrowAddress, {type: 'address'}),
            StellarSdk.nativeToScVal(secret, {type: 'bytes'})
        ]

        return await wallet.invokeContract(this.contractAddress, 'withdraw_funds', args)
    }

    public async cancelEscrow(
        wallet: StellarWallet,
        escrowAddress: string
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        const args = [StellarSdk.nativeToScVal(escrowAddress, {type: 'address'})]

        return await wallet.invokeContract(this.contractAddress, 'cancel_escrow', args)
    }
}

export class StellarEscrow {
    public server: StellarSdk.Horizon.Server
    public contractAddress: string
    public networkPassphrase: string

    constructor(config: StellarConfig, contractAddress: string) {
        this.server = new StellarSdk.Horizon.Server(config.horizonUrl)
        this.contractAddress = contractAddress
        this.networkPassphrase = config.networkPassphrase
    }

    public async deposit(
        wallet: StellarWallet,
        amount: string,
        assetCode?: string,
        assetIssuer?: string
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        const asset =
            assetCode && assetCode !== 'XLM' && assetCode !== 'native'
                ? new StellarSdk.Asset(assetCode, assetIssuer!)
                : StellarSdk.Asset.native()

        const args = [
            StellarSdk.nativeToScVal(amount, {type: 'u64'}),
            StellarSdk.nativeToScVal(asset.code, {type: 'string'}),
            StellarSdk.nativeToScVal(asset.issuer || '', {type: 'string'})
        ]

        return await wallet.invokeContract(this.contractAddress, 'deposit', args)
    }

    public async withdraw(
        wallet: StellarWallet,
        secret: string
    ): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        const args = [StellarSdk.nativeToScVal(secret, {type: 'bytes'})]

        return await wallet.invokeContract(this.contractAddress, 'withdraw', args)
    }

    public async cancel(wallet: StellarWallet): Promise<StellarSdk.Horizon.SubmitTransactionResponse> {
        return await wallet.invokeContract(this.contractAddress, 'cancel', [])
    }

    public async getInfo(wallet: StellarWallet): Promise<any> {
        // This would simulate a view call to get escrow information
        // For now, return mock data
        return {
            maker: 'GAFVHOGVUA5A6WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ',
            taker: 'GAFVHOGVUA5A6WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ',
            amount: '1000000',
            hashLock: '0x1234567890abcdef',
            timeLock: Date.now() + 3600000, // 1 hour from now
            isCompleted: false,
            isCancelled: false
        }
    }
}
