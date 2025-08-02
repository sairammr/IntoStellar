import { Buffer } from "buffer";
import { Address } from '@stellar/stellar-sdk';
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from '@stellar/stellar-sdk/contract';
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Typepoint,
  Duration,
} from '@stellar/stellar-sdk/contract';
export * from '@stellar/stellar-sdk'
export * as contract from '@stellar/stellar-sdk/contract'
export * as rpc from '@stellar/stellar-sdk/rpc'

if (typeof window !== 'undefined') {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CB6YENCF3FP7JGU5K7CQY5T35K3JWCESH5I2PWOMZCKKMP5RZNN7NPMQ",
  }
} as const


export interface FactoryTimelockParams {
  dst_cancellation_delay: u32;
  dst_public_withdrawal_delay: u32;
  dst_withdrawal_delay: u32;
  finality_delay: u32;
  src_cancellation_delay: u32;
  src_public_cancellation_delay: u32;
  src_public_withdrawal_delay: u32;
  src_withdrawal_delay: u32;
}

export type DataKey = {tag: "EscrowMapping", values: readonly [Buffer]} | {tag: "Initialized", values: void} | {tag: "EscrowWasmHash", values: void} | {tag: "Admin", values: void};


export interface SrcEscrowCreatedEvent {
  amount: i128;
  escrow_address: string;
  hash_lock: Buffer;
  maker: string;
  order_hash: Buffer;
  safety_deposit: i128;
  taker: string;
  timelocks: TimelockInfo;
  token: string;
}


export interface DstEscrowCreatedEvent {
  amount: i128;
  escrow_address: string;
  hash_lock: Buffer;
  maker: string;
  order_hash: Buffer;
  safety_deposit: i128;
  taker: string;
  timelocks: TimelockInfo;
  token: string;
}


export interface TimelockInfo {
  deployed_at: u64;
  dst_cancellation: u32;
  dst_public_withdrawal: u32;
  dst_withdrawal: u32;
  finality: u32;
  src_cancellation: u32;
  src_public_cancellation: u32;
  src_public_withdrawal: u32;
  src_withdrawal: u32;
}

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"EscrowExists"},
  4: {message:"EscrowNotFound"},
  5: {message:"Unauthorized"},
  6: {message:"InvalidParams"},
  7: {message:"DeploymentFailed"}
}

export interface Client {
  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({escrow_wasm_hash, admin}: {escrow_wasm_hash: Buffer, admin: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_src_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_src_escrow: ({order_hash, hash_lock, maker, taker, token, amount, safety_deposit, timelocks}: {order_hash: Buffer, hash_lock: Buffer, maker: string, taker: string, token: string, amount: i128, safety_deposit: i128, timelocks: FactoryTimelockParams}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a create_dst_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_dst_escrow: ({order_hash, hash_lock, maker, taker, token, amount, safety_deposit, timelocks, caller}: {order_hash: Buffer, hash_lock: Buffer, maker: string, taker: string, token: string, amount: i128, safety_deposit: i128, timelocks: FactoryTimelockParams, caller: string}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_escrow_address transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow_address: ({hash_lock}: {hash_lock: Buffer}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a escrow_exists transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  escrow_exists: ({hash_lock}: {hash_lock: Buffer}, options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_admin: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a get_escrow_wasm_hash transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow_wasm_hash: (options?: {
    /**
     * The fee to pay for the transaction. Default: BASE_FEE
     */
    fee?: number;

    /**
     * The maximum amount of time to wait for the transaction to complete. Default: DEFAULT_TIMEOUT
     */
    timeoutInSeconds?: number;

    /**
     * Whether to automatically simulate the transaction when constructing the AssembledTransaction. Default: true
     */
    simulate?: boolean;
  }) => Promise<AssembledTransaction<Result<Buffer>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAAAAAAAAAAAAFUZhY3RvcnlUaW1lbG9ja1BhcmFtcwAAAAAAAAgAAAAAAAAAFmRzdF9jYW5jZWxsYXRpb25fZGVsYXkAAAAAAAQAAAAAAAAAG2RzdF9wdWJsaWNfd2l0aGRyYXdhbF9kZWxheQAAAAAEAAAAAAAAABRkc3Rfd2l0aGRyYXdhbF9kZWxheQAAAAQAAAAAAAAADmZpbmFsaXR5X2RlbGF5AAAAAAAEAAAAAAAAABZzcmNfY2FuY2VsbGF0aW9uX2RlbGF5AAAAAAAEAAAAAAAAAB1zcmNfcHVibGljX2NhbmNlbGxhdGlvbl9kZWxheQAAAAAAAAQAAAAAAAAAG3NyY19wdWJsaWNfd2l0aGRyYXdhbF9kZWxheQAAAAAEAAAAAAAAABRzcmNfd2l0aGRyYXdhbF9kZWxheQAAAAQ=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABAAAAAEAAAAAAAAADUVzY3Jvd01hcHBpbmcAAAAAAAABAAAD7gAAACAAAAAAAAAAAAAAAAtJbml0aWFsaXplZAAAAAAAAAAAAAAAAA5Fc2Nyb3dXYXNtSGFzaAAAAAAAAAAAAAAAAAAFQWRtaW4AAAA=",
        "AAAAAQAAAAAAAAAAAAAAFVNyY0VzY3Jvd0NyZWF0ZWRFdmVudAAAAAAAAAkAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAOZXNjcm93X2FkZHJlc3MAAAAAABMAAAAAAAAACWhhc2hfbG9jawAAAAAAA+4AAAAgAAAAAAAAAAVtYWtlcgAAAAAAABMAAAAAAAAACm9yZGVyX2hhc2gAAAAAA+4AAAAgAAAAAAAAAA5zYWZldHlfZGVwb3NpdAAAAAAACwAAAAAAAAAFdGFrZXIAAAAAAAATAAAAAAAAAAl0aW1lbG9ja3MAAAAAAAfQAAAADFRpbWVsb2NrSW5mbwAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAQAAAAAAAAAAAAAAFURzdEVzY3Jvd0NyZWF0ZWRFdmVudAAAAAAAAAkAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAOZXNjcm93X2FkZHJlc3MAAAAAABMAAAAAAAAACWhhc2hfbG9jawAAAAAAA+4AAAAgAAAAAAAAAAVtYWtlcgAAAAAAABMAAAAAAAAACm9yZGVyX2hhc2gAAAAAA+4AAAAgAAAAAAAAAA5zYWZldHlfZGVwb3NpdAAAAAAACwAAAAAAAAAFdGFrZXIAAAAAAAATAAAAAAAAAAl0aW1lbG9ja3MAAAAAAAfQAAAADFRpbWVsb2NrSW5mbwAAAAAAAAAFdG9rZW4AAAAAAAAT",
        "AAAAAQAAAAAAAAAAAAAADFRpbWVsb2NrSW5mbwAAAAkAAAAAAAAAC2RlcGxveWVkX2F0AAAAAAYAAAAAAAAAEGRzdF9jYW5jZWxsYXRpb24AAAAEAAAAAAAAABVkc3RfcHVibGljX3dpdGhkcmF3YWwAAAAAAAAEAAAAAAAAAA5kc3Rfd2l0aGRyYXdhbAAAAAAABAAAAAAAAAAIZmluYWxpdHkAAAAEAAAAAAAAABBzcmNfY2FuY2VsbGF0aW9uAAAABAAAAAAAAAAXc3JjX3B1YmxpY19jYW5jZWxsYXRpb24AAAAABAAAAAAAAAAVc3JjX3B1YmxpY193aXRoZHJhd2FsAAAAAAAABAAAAAAAAAAOc3JjX3dpdGhkcmF3YWwAAAAAAAQ=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABwAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAAMRXNjcm93RXhpc3RzAAAAAwAAAAAAAAAORXNjcm93Tm90Rm91bmQAAAAAAAQAAAAAAAAADFVuYXV0aG9yaXplZAAAAAUAAAAAAAAADUludmFsaWRQYXJhbXMAAAAAAAAGAAAAAAAAABBEZXBsb3ltZW50RmFpbGVkAAAABw==",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAQZXNjcm93X3dhc21faGFzaAAAA+4AAAAgAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAARY3JlYXRlX3NyY19lc2Nyb3cAAAAAAAAIAAAAAAAAAApvcmRlcl9oYXNoAAAAAAPuAAAAIAAAAAAAAAAJaGFzaF9sb2NrAAAAAAAD7gAAACAAAAAAAAAABW1ha2VyAAAAAAAAEwAAAAAAAAAFdGFrZXIAAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAOc2FmZXR5X2RlcG9zaXQAAAAAAAsAAAAAAAAACXRpbWVsb2NrcwAAAAAAB9AAAAAVRmFjdG9yeVRpbWVsb2NrUGFyYW1zAAAAAAAAAQAAA+kAAAATAAAAAw==",
        "AAAAAAAAAAAAAAARY3JlYXRlX2RzdF9lc2Nyb3cAAAAAAAAJAAAAAAAAAApvcmRlcl9oYXNoAAAAAAPuAAAAIAAAAAAAAAAJaGFzaF9sb2NrAAAAAAAD7gAAACAAAAAAAAAABW1ha2VyAAAAAAAAEwAAAAAAAAAFdGFrZXIAAAAAAAATAAAAAAAAAAV0b2tlbgAAAAAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAOc2FmZXR5X2RlcG9zaXQAAAAAAAsAAAAAAAAACXRpbWVsb2NrcwAAAAAAB9AAAAAVRmFjdG9yeVRpbWVsb2NrUGFyYW1zAAAAAAAAAAAAAAZjYWxsZXIAAAAAABMAAAABAAAD6QAAABMAAAAD",
        "AAAAAAAAAAAAAAASZ2V0X2VzY3Jvd19hZGRyZXNzAAAAAAABAAAAAAAAAAloYXNoX2xvY2sAAAAAAAPuAAAAIAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAAAAAAAANZXNjcm93X2V4aXN0cwAAAAAAAAEAAAAAAAAACWhhc2hfbG9jawAAAAAAA+4AAAAgAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAJZ2V0X2FkbWluAAAAAAAAAAAAAAEAAAPpAAAAEwAAAAM=",
        "AAAAAAAAAAAAAAAUZ2V0X2VzY3Jvd193YXNtX2hhc2gAAAAAAAAAAQAAA+kAAAPuAAAAIAAAAAM=" ]),
      options
    )
  }
  public readonly fromJSON = {
    initialize: this.txFromJSON<Result<void>>,
        create_src_escrow: this.txFromJSON<Result<string>>,
        create_dst_escrow: this.txFromJSON<Result<string>>,
        get_escrow_address: this.txFromJSON<Result<string>>,
        escrow_exists: this.txFromJSON<boolean>,
        get_admin: this.txFromJSON<Result<string>>,
        get_escrow_wasm_hash: this.txFromJSON<Result<Buffer>>
  }
}