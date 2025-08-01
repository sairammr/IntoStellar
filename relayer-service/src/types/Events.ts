/**
 * @fileoverview Event type definitions for cross-chain swap monitoring
 */

// Common event properties
export interface BaseEvent {
  hashLock: string;
  blockNumber?: number;
  ledgerNumber?: number;
  transactionHash: string;
  timestamp: number;
}

// Complete 7-stage timelock system
export interface TimelockData {
  finality: number;
  srcWithdrawal: number;
  srcPublicWithdrawal: number;
  srcCancellation: number;
  srcPublicCancellation: number;
  dstWithdrawal: number;
  dstPublicWithdrawal: number;
  dstCancellation: number;
  deployedAt: number;
}

// Ethereum-specific events
export interface EthereumEscrowCreatedEvent extends BaseEvent {
  escrowAddress: string;
  orderHash: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: TimelockData;
  chain: "ethereum";
}

// Stellar-specific events
export interface StellarEscrowCreatedEvent extends BaseEvent {
  escrowAddress: string;
  orderHash: string;
  maker: string;
  taker: string;
  token: string;
  amount: string;
  safetyDeposit: string;
  timelocks: TimelockData;
  chain: "stellar";
}

// Withdrawal events
export interface WithdrawalEvent extends BaseEvent {
  escrowAddress: string;
  secret: string;
  withdrawnBy: string;
  isPublicWithdrawal: boolean;
  chain: "ethereum" | "stellar";
}

// Cancellation events
export interface CancellationEvent extends BaseEvent {
  escrowAddress: string;
  cancelledBy: string;
  refundTo: string;
  isPublicCancellation: boolean;
  chain: "ethereum" | "stellar";
}

// Union types for event handling
export type EscrowCreatedEvent =
  | EthereumEscrowCreatedEvent
  | StellarEscrowCreatedEvent;
export type SwapEvent =
  | EscrowCreatedEvent
  | WithdrawalEvent
  | CancellationEvent;

// Event emitter types
export interface RelayerEvents {
  escrowCreated: (event: EscrowCreatedEvent) => void;
  withdrawal: (event: WithdrawalEvent) => void;
  cancellation: (event: CancellationEvent) => void;
  secretRevealed: (data: { hashLock: string; secret: string }) => void;
  swapCompleted: (data: {
    hashLock: string;
    chain: "ethereum" | "stellar";
  }) => void;
  swapFailed: (data: { hashLock: string; reason: string }) => void;
}

// Contract ABI fragments for event parsing
export const ETHEREUM_ESCROW_EVENTS = {
  SrcEscrowCreated: [
    "event SrcEscrowCreated(",
    "  address indexed escrow,",
    "  bytes32 indexed hashLock,",
    "  address indexed maker,",
    "  address taker,",
    "  address token,",
    "  uint256 amount,",
    "  uint256 safetyDeposit,",
    "  uint256 finality,",
    "  uint256 srcWithdrawal,",
    "  uint256 srcCancellation,",
    "  uint256 dstWithdrawal,",
    "  uint256 dstCancellation,",
    "  uint256 deployedAt",
    ")",
  ].join(""),

  DstEscrowCreated: [
    "event DstEscrowCreated(",
    "  address indexed escrow,",
    "  bytes32 indexed hashLock,",
    "  address indexed taker",
    ")",
  ].join(""),

  Withdrawal: "event Withdrawal(bytes32 secret)",
  EscrowCancelled: "event EscrowCancelled()",
};

// Stellar event names (matching contract events)
export const STELLAR_ESCROW_EVENTS = {
  SrcEscrowCreatedEvent: "SrcEscrowCreatedEvent",
  DstEscrowCreatedEvent: "DstEscrowCreatedEvent",
  WithdrawalEvent: "WithdrawalEvent",
  EscrowCancelledEvent: "EscrowCancelledEvent",
};
