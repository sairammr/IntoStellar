/**
 * @fileoverview Timelock management for 7-stage cross-chain atomic swaps
 */

import { TimelockData } from "../types/Events";
import { Logger } from "./Logger";

export enum TimelockStage {
  // Source chain stages (0-3)
  SrcWithdrawal = 0,
  SrcPublicWithdrawal = 1,
  SrcCancellation = 2,
  SrcPublicCancellation = 3,
  // Destination chain stages (4-6)
  DstWithdrawal = 4,
  DstPublicWithdrawal = 5,
  DstCancellation = 6,
}

export interface TimelockStatus {
  stage: TimelockStage;
  canWithdraw: boolean;
  canCancel: boolean;
  isPublicPhase: boolean;
  timeUntilNext: number;
  nextStage?: TimelockStage;
}

/**
 * Manages the complex 7-stage timelock system for cross-chain atomic swaps
 */
export class TimelockManager {
  private logger = Logger.getInstance();

  /**
   * Get the current timelock status for a swap
   */
  getCurrentStatus(
    timelocks: TimelockData,
    currentTime: number,
    isSourceChain: boolean
  ): TimelockStatus {
    const deployedAt = timelocks.deployedAt;
    const finality = deployedAt + timelocks.finality;

    // Before finality - no actions allowed
    if (currentTime < finality) {
      return {
        stage: TimelockStage.SrcWithdrawal,
        canWithdraw: false,
        canCancel: false,
        isPublicPhase: false,
        timeUntilNext: finality - currentTime,
        nextStage: TimelockStage.SrcWithdrawal,
      };
    }

    if (isSourceChain) {
      return this.getSourceChainStatus(timelocks, currentTime);
    } else {
      return this.getDestinationChainStatus(timelocks, currentTime);
    }
  }

  /**
   * Check if secret distribution should happen now
   */
  shouldDistributeSecret(
    srcTimelocks: TimelockData,
    dstTimelocks: TimelockData,
    currentTime: number
  ): boolean {
    const srcStatus = this.getCurrentStatus(srcTimelocks, currentTime, true);
    const dstStatus = this.getCurrentStatus(dstTimelocks, currentTime, false);

    // Both escrows must be past finality and in withdrawal phase
    const srcCanWithdraw =
      srcStatus.canWithdraw && srcStatus.stage >= TimelockStage.SrcWithdrawal;
    const dstCanWithdraw =
      dstStatus.canWithdraw && dstStatus.stage >= TimelockStage.DstWithdrawal;

    return srcCanWithdraw && dstCanWithdraw;
  }

  /**
   * Get source chain timelock status
   */
  private getSourceChainStatus(
    timelocks: TimelockData,
    currentTime: number
  ): TimelockStatus {
    const deployedAt = timelocks.deployedAt;
    const srcWithdrawal = deployedAt + timelocks.srcWithdrawal;
    const srcPublicWithdrawal = deployedAt + timelocks.srcPublicWithdrawal;
    const srcCancellation = deployedAt + timelocks.srcCancellation;
    const srcPublicCancellation = deployedAt + timelocks.srcPublicCancellation;

    // Stage 0: Private withdrawal (taker only)
    if (currentTime >= srcWithdrawal && currentTime < srcPublicWithdrawal) {
      return {
        stage: TimelockStage.SrcWithdrawal,
        canWithdraw: true,
        canCancel: false,
        isPublicPhase: false,
        timeUntilNext: srcPublicWithdrawal - currentTime,
        nextStage: TimelockStage.SrcPublicWithdrawal,
      };
    }

    // Stage 1: Public withdrawal (anyone)
    if (currentTime >= srcPublicWithdrawal && currentTime < srcCancellation) {
      return {
        stage: TimelockStage.SrcPublicWithdrawal,
        canWithdraw: true,
        canCancel: false,
        isPublicPhase: true,
        timeUntilNext: srcCancellation - currentTime,
        nextStage: TimelockStage.SrcCancellation,
      };
    }

    // Stage 2: Private cancellation (taker only)
    if (currentTime >= srcCancellation && currentTime < srcPublicCancellation) {
      return {
        stage: TimelockStage.SrcCancellation,
        canWithdraw: false,
        canCancel: true,
        isPublicPhase: false,
        timeUntilNext: srcPublicCancellation - currentTime,
        nextStage: TimelockStage.SrcPublicCancellation,
      };
    }

    // Stage 3: Public cancellation (anyone)
    if (currentTime >= srcPublicCancellation) {
      return {
        stage: TimelockStage.SrcPublicCancellation,
        canWithdraw: false,
        canCancel: true,
        isPublicPhase: true,
        timeUntilNext: 0,
      };
    }

    // Before any stage starts
    return {
      stage: TimelockStage.SrcWithdrawal,
      canWithdraw: false,
      canCancel: false,
      isPublicPhase: false,
      timeUntilNext: srcWithdrawal - currentTime,
      nextStage: TimelockStage.SrcWithdrawal,
    };
  }

  /**
   * Get destination chain timelock status
   */
  private getDestinationChainStatus(
    timelocks: TimelockData,
    currentTime: number
  ): TimelockStatus {
    const deployedAt = timelocks.deployedAt;
    const dstWithdrawal = deployedAt + timelocks.dstWithdrawal;
    const dstPublicWithdrawal = deployedAt + timelocks.dstPublicWithdrawal;
    const dstCancellation = deployedAt + timelocks.dstCancellation;

    // Stage 4: Private withdrawal (maker only)
    if (currentTime >= dstWithdrawal && currentTime < dstPublicWithdrawal) {
      return {
        stage: TimelockStage.DstWithdrawal,
        canWithdraw: true,
        canCancel: false,
        isPublicPhase: false,
        timeUntilNext: dstPublicWithdrawal - currentTime,
        nextStage: TimelockStage.DstPublicWithdrawal,
      };
    }

    // Stage 5: Public withdrawal (anyone)
    if (currentTime >= dstPublicWithdrawal && currentTime < dstCancellation) {
      return {
        stage: TimelockStage.DstPublicWithdrawal,
        canWithdraw: true,
        canCancel: false,
        isPublicPhase: true,
        timeUntilNext: dstCancellation - currentTime,
        nextStage: TimelockStage.DstCancellation,
      };
    }

    // Stage 6: Cancellation (anyone)
    if (currentTime >= dstCancellation) {
      return {
        stage: TimelockStage.DstCancellation,
        canWithdraw: false,
        canCancel: true,
        isPublicPhase: true,
        timeUntilNext: 0,
      };
    }

    // Before any stage starts
    return {
      stage: TimelockStage.DstWithdrawal,
      canWithdraw: false,
      canCancel: false,
      isPublicPhase: false,
      timeUntilNext: dstWithdrawal - currentTime,
      nextStage: TimelockStage.DstWithdrawal,
    };
  }

  /**
   * Log the current timelock status for debugging
   */
  logStatus(
    hashLock: string,
    timelocks: TimelockData,
    currentTime: number
  ): void {
    const srcStatus = this.getCurrentStatus(timelocks, currentTime, true);
    const dstStatus = this.getCurrentStatus(timelocks, currentTime, false);

    this.logger.debug("Timelock status", {
      hashLock,
      currentTime,
      source: {
        stage: TimelockStage[srcStatus.stage],
        canWithdraw: srcStatus.canWithdraw,
        canCancel: srcStatus.canCancel,
        isPublic: srcStatus.isPublicPhase,
        timeUntilNext: srcStatus.timeUntilNext,
      },
      destination: {
        stage: TimelockStage[dstStatus.stage],
        canWithdraw: dstStatus.canWithdraw,
        canCancel: dstStatus.canCancel,
        isPublic: dstStatus.isPublicPhase,
        timeUntilNext: dstStatus.timeUntilNext,
      },
    });
  }

  /**
   * Validate timelock configuration
   */
  validateTimelocks(timelocks: TimelockData): boolean {
    try {
      // Check ordering: each stage must be after the previous
      if (timelocks.srcWithdrawal <= timelocks.finality) return false;
      if (timelocks.srcPublicWithdrawal <= timelocks.srcWithdrawal)
        return false;
      if (timelocks.srcCancellation <= timelocks.srcPublicWithdrawal)
        return false;
      if (timelocks.srcPublicCancellation <= timelocks.srcCancellation)
        return false;

      if (timelocks.dstWithdrawal <= timelocks.finality) return false;
      if (timelocks.dstPublicWithdrawal <= timelocks.dstWithdrawal)
        return false;
      if (timelocks.dstCancellation <= timelocks.dstPublicWithdrawal)
        return false;

      return true;
    } catch (error) {
      this.logger.error("Invalid timelock configuration:", error);
      return false;
    }
  }
}
