import {z} from 'zod'
import Sdk from '@1inch/cross-chain-sdk'
import * as process from 'node:process'

const bool = z
    .string()
    .transform((v) => v.toLowerCase() === 'true')
    .pipe(z.boolean())

const ConfigSchema = z.object({
    SRC_CHAIN_RPC: z.string().url(),
    STELLAR_HORIZON_URL: z.string().url(),
    SRC_CHAIN_CREATE_FORK: bool.default('true'),
    STELLAR_NETWORK_PASSPHRASE: z.string().default('Test SDF Network ; September 2015')
})

const fromEnv = ConfigSchema.parse(process.env)

export const config = {
    chain: {
        source: {
            chainId: Sdk.NetworkEnum.ETHEREUM,
            url: fromEnv.SRC_CHAIN_RPC,
            createFork: fromEnv.SRC_CHAIN_CREATE_FORK,
            limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
            wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            ownerPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
            tokens: {
                USDC: {
                    address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
                    donor: '0xd54F23BE482D9A58676590fCa79c8E43087f92fB'
                }
            }
        },
        destination: {
            // Stellar configuration
            horizonUrl: fromEnv.STELLAR_HORIZON_URL,
            networkPassphrase: fromEnv.STELLAR_NETWORK_PASSPHRASE,
            escrowFactory: 'CCE5M2R5KRBL7LJDBI64B2HTUFKEOZXVQOELEYJRQ4LGC7FGRJU5KUH6',
            limitOrderProtocol: 'CC4IKNTKK5MHJYJPA2MOSZQCATQN274JHVHZ3ZTABBXKVTURTFMM4O6V',
            resolver: 'CDDGIPDK4QWH2CPJGB3YB4AVN5C7CQD46GN74XE5H5N2D3QLOIGDQAUK',
            adminAddress: 'GAFVHOGVUA5A6WZAAMCAYCNHA6ZRLGJ2WFLARJWXHXP6QIJCEI56JMBQ',
            tokens: {
                XLM: {
                    address: '0x0000000000000000000000000000000000000000', // Use zero address like ETH-BSC for special assets
                    decimals: 7
                },
                USDC: {
                    address: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34KUEKUS',
                    decimals: 7
                }
            }
        }
    }
} as const

export type ChainConfig = (typeof config.chain)['source']
export type StellarConfig = (typeof config.chain)['destination']
