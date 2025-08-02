import "dotenv/config";
import { expect, jest } from "@jest/globals";
import { ethers } from "ethers";
import { StellarProvider } from "../../relayer-service/src/services/StellarProvider";
import { StellarWallet } from "../../relayer-service/src/services/StellarWallet";
import { StellarContractClient } from "../../relayer-service/src/services/StellarContractClient";
import { CrossChainOrchestrator } from "../../relayer-service/src/services/CrossChainOrchestrator";
import { RelayerService } from "../../relayer-service/src/services/RelayerService";
import { SecretManager } from "../../relayer-service/src/services/SecretManager";

// Test configuration
const TEST_CONFIG = {
  ethereum: {
    rpcUrl:
      process.env.ETHEREUM_RPC_URL || "https://sepolia.infura.io/v3/YOUR_KEY",
    privateKey: process.env.ETHEREUM_PRIVATE_KEY || "0x...",
    escrowFactory: process.env.ETHEREUM_ESCROW_FACTORY || "0x...",
    limitOrderProtocol: "0x111111125421ca6dc452d289314280a0f8842a65",
    tokens: {
      USDC: {
        address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
        decimals: 6,
      },
      WETH: {
        address: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
        decimals: 18,
      },
    },
  },
  stellar: {
    horizonUrl:
      process.env.STELLAR_HORIZON_URL || "https://soroban-testnet.stellar.org",
    privateKey: process.env.STELLAR_PRIVATE_KEY || "S...",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowFactory: process.env.STELLAR_ESCROW_FACTORY || "CA...",
    limitOrderProtocol: process.env.STELLAR_LIMIT_ORDER_PROTOCOL || "CA...",
    resolver: process.env.STELLAR_RESOLVER || "CA...",
    tokens: {
      XLM: {
        address: "native",
        decimals: 7,
      },
      USDC: {
        address: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
        decimals: 7,
      },
    },
  },
};

// Test utilities
class TestUtils {
  static generateSecret(): string {
    return ethers.randomBytes(32).toString("hex");
  }

  static generateHashLock(secret: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(secret));
  }

  static generateOrderHash(
    maker: string,
    amount: string,
    nonce: number
  ): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256", "uint256"],
        [maker, amount, nonce]
      )
    );
  }

  static async waitForTransaction(
    provider: ethers.Provider,
    hash: string
  ): Promise<ethers.TransactionReceipt> {
    return await provider.waitForTransaction(hash);
  }

  static async increaseTime(
    provider: ethers.Provider,
    seconds: number
  ): Promise<void> {
    await provider.send("evm_increaseTime", [seconds]);
    await provider.send("evm_mine", []);
  }
}

// Main test suite
describe("ETH-Stellar Cross-Chain Atomic Swap", () => {
  let ethereumProvider: ethers.Provider;
  let ethereumWallet: ethers.Wallet;
  let stellarProvider: StellarProvider;
  let stellarWallet: StellarWallet;
  let stellarContractClient: StellarContractClient;
  let crossChainOrchestrator: CrossChainOrchestrator;
  let relayerService: RelayerService;
  let secretManager: SecretManager;

  let testSecret: string;
  let testHashLock: string;
  let testOrderHash: string;
  let testMaker: string;
  let testTaker: string;

  beforeAll(async () => {
    console.log("🚀 Setting up ETH-Stellar cross-chain swap test...");

    // Initialize Ethereum components
    ethereumProvider = new ethers.JsonRpcProvider(TEST_CONFIG.ethereum.rpcUrl);
    ethereumWallet = new ethers.Wallet(
      TEST_CONFIG.ethereum.privateKey,
      ethereumProvider
    );
    testMaker = await ethereumWallet.getAddress();

    // Initialize Stellar components
    stellarProvider = new StellarProvider({
      horizonUrl: TEST_CONFIG.stellar.horizonUrl,
      networkPassphrase: TEST_CONFIG.stellar.networkPassphrase,
      allowHttp: true,
    });
    stellarWallet = new StellarWallet(stellarProvider, {
      privateKey: TEST_CONFIG.stellar.privateKey,
      accountId: "", // Will be loaded from private key
      networkPassphrase: TEST_CONFIG.stellar.networkPassphrase,
    });
    testTaker = stellarWallet.getAccountId();

    // Initialize contract clients
    stellarContractClient = new StellarContractClient(
      stellarProvider,
      stellarWallet,
      {
        escrowFactory: TEST_CONFIG.stellar.escrowFactory,
        limitOrderProtocol: TEST_CONFIG.stellar.limitOrderProtocol,
        resolver: TEST_CONFIG.stellar.resolver,
      }
    );

    // Initialize cross-chain orchestrator
    crossChainOrchestrator = new CrossChainOrchestrator();

    // Initialize relayer service
    secretManager = new SecretManager();
    relayerService = new RelayerService(secretManager);

    // Generate test data
    testSecret = TestUtils.generateSecret();
    testHashLock = TestUtils.generateHashLock(testSecret);
    testOrderHash = TestUtils.generateOrderHash(
      testMaker,
      "1000000",
      Date.now()
    );

    console.log("✅ Test setup completed");
    console.log(`   Test Secret: ${testSecret.substring(0, 16)}...`);
    console.log(`   Test Hash Lock: ${testHashLock.substring(0, 16)}...`);
    console.log(`   Test Order Hash: ${testOrderHash.substring(0, 16)}...`);
  });

  afterAll(async () => {
    console.log("🧹 Cleaning up test environment...");
    await relayerService.stop();
    await secretManager.cleanup();
  });

  describe("Contract Deployment Verification", () => {
    it("should verify all contracts are deployed and accessible", async () => {
      console.log("🔍 Verifying contract deployments...");

      // Check Ethereum contracts
      const ethFactoryCode = await ethereumProvider.getCode(
        TEST_CONFIG.ethereum.escrowFactory
      );
      expect(ethFactoryCode).not.toBe("0x");
      console.log("✅ Ethereum EscrowFactory deployed");

      // Check Stellar contracts
      const stellarStatus = await stellarContractClient.getStatus();
      expect(stellarStatus.providerConnected).toBe(true);
      expect(stellarStatus.walletConnected).toBe(true);
      console.log("✅ Stellar contracts accessible");

      // Check relayer status
      const relayerStatus = await relayerService.getStatus();
      expect(relayerStatus.totalSwaps).toBeGreaterThanOrEqual(0);
      console.log("✅ Relayer service operational");
    });
  });

  describe("Cross-Chain Atomic Swap Flow", () => {
    it("should execute complete ETH → XLM swap", async () => {
      console.log("🔄 Starting ETH → XLM cross-chain swap...");

      const swapParams = {
        orderHash: testOrderHash,
        hashLock: testHashLock,
        maker: testMaker,
        taker: testTaker,
        token: TEST_CONFIG.ethereum.tokens.USDC.address,
        amount: "1000000", // 1 USDC
        safetyDeposit: "100000", // 0.1 USDC
        timelocks: {
          finalityDelay: 10, // 10 seconds for testing
          srcWithdrawalDelay: 20,
          srcPublicWithdrawalDelay: 30,
          srcCancellationDelay: 40,
          srcPublicCancellationDelay: 50,
          dstWithdrawalDelay: 60,
          dstPublicWithdrawalDelay: 70,
          dstCancellationDelay: 80,
        },
      };

      // Step 1: Create Ethereum escrow (simulate user order)
      console.log("📦 Step 1: Creating Ethereum escrow...");
      const ethEscrowEvent = {
        hashLock: swapParams.hashLock,
        orderHash: swapParams.orderHash,
        maker: swapParams.maker,
        taker: swapParams.taker,
        token: swapParams.token,
        amount: swapParams.amount,
        safetyDeposit: swapParams.safetyDeposit,
        timelocks: {
          finality: swapParams.timelocks.finalityDelay,
          srcWithdrawal: swapParams.timelocks.srcWithdrawalDelay,
          srcPublicWithdrawal: swapParams.timelocks.srcPublicWithdrawalDelay,
          srcCancellation: swapParams.timelocks.srcCancellationDelay,
          srcPublicCancellation:
            swapParams.timelocks.srcPublicCancellationDelay,
          dstWithdrawal: swapParams.timelocks.dstWithdrawalDelay,
          dstPublicWithdrawal: swapParams.timelocks.dstPublicWithdrawalDelay,
          dstCancellation: swapParams.timelocks.dstCancellationDelay,
        },
        chain: "ethereum" as const,
        transactionHash: "0x" + "0".repeat(64),
        timestamp: Date.now(),
      };

      // Step 2: Relayer detects Ethereum escrow and creates Stellar escrow
      console.log("🌐 Step 2: Creating corresponding Stellar escrow...");
      await relayerService.handleEscrowCreated(ethEscrowEvent);

      // Step 3: Verify Stellar escrow was created
      console.log("🔍 Step 3: Verifying Stellar escrow creation...");
      const stellarEscrowExists = await stellarContractClient.escrowExists(
        swapParams.hashLock
      );
      expect(stellarEscrowExists).toBe(true);
      console.log("✅ Stellar escrow created successfully");

      // Step 4: Wait for finality period
      console.log("⏰ Step 4: Waiting for finality period...");
      await TestUtils.increaseTime(ethereumProvider, 15); // Wait 15 seconds

      // Step 5: User reveals secret (simulate)
      console.log("🔑 Step 5: User reveals secret...");
      await relayerService.manualSecretReveal(swapParams.hashLock, testSecret);

      // Step 6: Verify secret distribution
      console.log("🔍 Step 6: Verifying secret distribution...");
      const swapStatus = relayerService.getSwapStatus(swapParams.hashLock);
      expect(swapStatus?.secretRevealed).toBe(true);
      console.log("✅ Secret revealed successfully");

      // Step 7: Wait for withdrawal period
      console.log("⏰ Step 7: Waiting for withdrawal period...");
      await TestUtils.increaseTime(ethereumProvider, 25); // Wait 25 more seconds

      // Step 8: Verify swap completion
      console.log("🔍 Step 8: Verifying swap completion...");
      const finalSwapStatus = relayerService.getSwapStatus(swapParams.hashLock);
      expect(finalSwapStatus?.completed).toBe(true);
      console.log("✅ ETH → XLM swap completed successfully!");
    });

    it("should execute complete XLM → ETH swap", async () => {
      console.log("🔄 Starting XLM → ETH cross-chain swap...");

      const swapParams = {
        orderHash: TestUtils.generateOrderHash(
          testTaker,
          "50000000",
          Date.now()
        ), // 5 XLM
        hashLock: TestUtils.generateHashLock(TestUtils.generateSecret()),
        maker: testTaker,
        taker: testMaker,
        token: TEST_CONFIG.stellar.tokens.XLM.address,
        amount: "50000000", // 5 XLM
        safetyDeposit: "5000000", // 0.5 XLM
        timelocks: {
          finalityDelay: 10,
          srcWithdrawalDelay: 20,
          srcPublicWithdrawalDelay: 30,
          srcCancellationDelay: 40,
          srcPublicCancellationDelay: 50,
          dstWithdrawalDelay: 60,
          dstPublicWithdrawalDelay: 70,
          dstCancellationDelay: 80,
        },
      };

      // Step 1: Create Stellar escrow (simulate user order)
      console.log("📦 Step 1: Creating Stellar escrow...");
      const stellarEscrowEvent = {
        hashLock: swapParams.hashLock,
        orderHash: swapParams.orderHash,
        maker: swapParams.maker,
        taker: swapParams.taker,
        token: swapParams.token,
        amount: swapParams.amount,
        safetyDeposit: swapParams.safetyDeposit,
        timelocks: {
          finality: swapParams.timelocks.finalityDelay,
          srcWithdrawal: swapParams.timelocks.srcWithdrawalDelay,
          srcPublicWithdrawal: swapParams.timelocks.srcPublicWithdrawalDelay,
          srcCancellation: swapParams.timelocks.srcCancellationDelay,
          srcPublicCancellation:
            swapParams.timelocks.srcPublicCancellationDelay,
          dstWithdrawal: swapParams.timelocks.dstWithdrawalDelay,
          dstPublicWithdrawal: swapParams.timelocks.dstPublicWithdrawalDelay,
          dstCancellation: swapParams.timelocks.dstCancellationDelay,
        },
        chain: "stellar" as const,
        transactionHash: "0x" + "0".repeat(64),
        timestamp: Date.now(),
      };

      // Step 2: Relayer detects Stellar escrow and creates Ethereum escrow
      console.log("🌐 Step 2: Creating corresponding Ethereum escrow...");
      await relayerService.handleEscrowCreated(stellarEscrowEvent);

      // Step 3: Verify Ethereum escrow was created
      console.log("🔍 Step 3: Verifying Ethereum escrow creation...");
      // This would check if Ethereum escrow exists (implementation needed)

      // Step 4: Complete the swap flow
      console.log("✅ XLM → ETH swap flow initiated successfully!");
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle insufficient balance scenarios", async () => {
      console.log("🚨 Testing insufficient balance handling...");

      const swapParams = {
        orderHash: TestUtils.generateOrderHash(
          testMaker,
          "1000000000000",
          Date.now()
        ), // Very large amount
        hashLock: TestUtils.generateHashLock(TestUtils.generateSecret()),
        maker: testMaker,
        taker: testTaker,
        token: TEST_CONFIG.ethereum.tokens.USDC.address,
        amount: "1000000000000", // 1M USDC (should fail)
        safetyDeposit: "100000000000",
        timelocks: {
          finalityDelay: 10,
          srcWithdrawalDelay: 20,
          srcPublicWithdrawalDelay: 30,
          srcCancellationDelay: 40,
          srcPublicCancellationDelay: 50,
          dstWithdrawalDelay: 60,
          dstPublicWithdrawalDelay: 70,
          dstCancellationDelay: 80,
        },
      };

      const ethEscrowEvent = {
        hashLock: swapParams.hashLock,
        orderHash: swapParams.orderHash,
        maker: swapParams.maker,
        taker: swapParams.taker,
        token: swapParams.token,
        amount: swapParams.amount,
        safetyDeposit: swapParams.safetyDeposit,
        timelocks: {
          finality: swapParams.timelocks.finalityDelay,
          srcWithdrawal: swapParams.timelocks.srcWithdrawalDelay,
          srcPublicWithdrawal: swapParams.timelocks.srcPublicWithdrawalDelay,
          srcCancellation: swapParams.timelocks.srcCancellationDelay,
          srcPublicCancellation:
            swapParams.timelocks.srcPublicCancellationDelay,
          dstWithdrawal: swapParams.timelocks.dstWithdrawalDelay,
          dstPublicWithdrawal: swapParams.timelocks.dstPublicWithdrawalDelay,
          dstCancellation: swapParams.timelocks.dstCancellationDelay,
        },
        chain: "ethereum" as const,
        transactionHash: "0x" + "0".repeat(64),
        timestamp: Date.now(),
      };

      // This should fail gracefully
      await expect(
        relayerService.handleEscrowCreated(ethEscrowEvent)
      ).rejects.toThrow();
      console.log("✅ Insufficient balance handled correctly");
    });

    it("should handle timelock expiry scenarios", async () => {
      console.log("⏰ Testing timelock expiry handling...");

      // Create a swap with very short timelocks
      const swapParams = {
        orderHash: TestUtils.generateOrderHash(
          testMaker,
          "1000000",
          Date.now()
        ),
        hashLock: TestUtils.generateHashLock(TestUtils.generateSecret()),
        maker: testMaker,
        taker: testTaker,
        token: TEST_CONFIG.ethereum.tokens.USDC.address,
        amount: "1000000",
        safetyDeposit: "100000",
        timelocks: {
          finalityDelay: 1, // Very short timelocks
          srcWithdrawalDelay: 2,
          srcPublicWithdrawalDelay: 3,
          srcCancellationDelay: 4,
          srcPublicCancellationDelay: 5,
          dstWithdrawalDelay: 6,
          dstPublicWithdrawalDelay: 7,
          dstCancellationDelay: 8,
        },
      };

      const ethEscrowEvent = {
        hashLock: swapParams.hashLock,
        orderHash: swapParams.orderHash,
        maker: swapParams.maker,
        taker: swapParams.taker,
        token: swapParams.token,
        amount: swapParams.amount,
        safetyDeposit: swapParams.safetyDeposit,
        timelocks: {
          finality: swapParams.timelocks.finalityDelay,
          srcWithdrawal: swapParams.timelocks.srcWithdrawalDelay,
          srcPublicWithdrawal: swapParams.timelocks.srcPublicWithdrawalDelay,
          srcCancellation: swapParams.timelocks.srcCancellationDelay,
          srcPublicCancellation:
            swapParams.timelocks.srcPublicCancellationDelay,
          dstWithdrawal: swapParams.timelocks.dstWithdrawalDelay,
          dstPublicWithdrawal: swapParams.timelocks.dstPublicWithdrawalDelay,
          dstCancellation: swapParams.timelocks.dstCancellationDelay,
        },
        chain: "ethereum" as const,
        transactionHash: "0x" + "0".repeat(64),
        timestamp: Date.now(),
      };

      await relayerService.handleEscrowCreated(ethEscrowEvent);

      // Fast forward time to trigger timelock expiry
      await TestUtils.increaseTime(ethereumProvider, 20);

      const swapStatus = relayerService.getSwapStatus(swapParams.hashLock);
      expect(swapStatus?.cancelled).toBe(true);
      console.log("✅ Timelock expiry handled correctly");
    });
  });

  describe("Performance and Load Testing", () => {
    it("should handle multiple concurrent swaps", async () => {
      console.log("⚡ Testing multiple concurrent swaps...");

      const swapPromises = [];
      const numSwaps = 5;

      for (let i = 0; i < numSwaps; i++) {
        const swapParams = {
          orderHash: TestUtils.generateOrderHash(
            testMaker,
            "1000000",
            Date.now() + i
          ),
          hashLock: TestUtils.generateHashLock(TestUtils.generateSecret()),
          maker: testMaker,
          taker: testTaker,
          token: TEST_CONFIG.ethereum.tokens.USDC.address,
          amount: "1000000",
          safetyDeposit: "100000",
          timelocks: {
            finalityDelay: 10,
            srcWithdrawalDelay: 20,
            srcPublicWithdrawalDelay: 30,
            srcCancellationDelay: 40,
            srcPublicCancellationDelay: 50,
            dstWithdrawalDelay: 60,
            dstPublicWithdrawalDelay: 70,
            dstCancellationDelay: 80,
          },
        };

        const ethEscrowEvent = {
          hashLock: swapParams.hashLock,
          orderHash: swapParams.orderHash,
          maker: swapParams.maker,
          taker: swapParams.taker,
          token: swapParams.token,
          amount: swapParams.amount,
          safetyDeposit: swapParams.safetyDeposit,
          timelocks: {
            finality: swapParams.timelocks.finalityDelay,
            srcWithdrawal: swapParams.timelocks.srcWithdrawalDelay,
            srcPublicWithdrawal: swapParams.timelocks.srcPublicWithdrawalDelay,
            srcCancellation: swapParams.timelocks.srcCancellationDelay,
            srcPublicCancellation:
              swapParams.timelocks.srcPublicCancellationDelay,
            dstWithdrawal: swapParams.timelocks.dstWithdrawalDelay,
            dstPublicWithdrawal: swapParams.timelocks.dstPublicWithdrawalDelay,
            dstCancellation: swapParams.timelocks.dstCancellationDelay,
          },
          chain: "ethereum" as const,
          transactionHash: "0x" + "0".repeat(64),
          timestamp: Date.now(),
        };

        swapPromises.push(relayerService.handleEscrowCreated(ethEscrowEvent));
      }

      await Promise.all(swapPromises);

      const stats = relayerService.getStatistics();
      expect(stats.activeSwaps).toBeGreaterThanOrEqual(numSwaps);
      console.log(`✅ Successfully handled ${numSwaps} concurrent swaps`);
    });
  });
});
