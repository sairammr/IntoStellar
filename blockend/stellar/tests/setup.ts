import dotenv from "dotenv";
import { ethers } from "ethers";

// Load environment variables
dotenv.config();

// Global test setup
beforeAll(async () => {
  console.log("🧪 Setting up ETH-Stellar test environment...");

  // Validate required environment variables
  const requiredEnvVars = [
    "ETHEREUM_RPC_URL",
    "ETHEREUM_PRIVATE_KEY",
    "ETHEREUM_ESCROW_FACTORY",
    "STELLAR_PRIVATE_KEY",
    "STELLAR_ESCROW_FACTORY",
    "STELLAR_LIMIT_ORDER_PROTOCOL",
    "STELLAR_RESOLVER",
  ];

  const missingVars = requiredEnvVars.filter(
    (varName) => !process.env[varName]
  );

  if (missingVars.length > 0) {
    console.warn("⚠️  Missing environment variables:", missingVars);
    console.warn(
      "   Some tests may fail. Please set these variables in your .env file"
    );
  }

  // Set up global test utilities
  global.testUtils = {
    generateSecret: () => ethers.randomBytes(32).toString("hex"),
    generateHashLock: (secret: string) =>
      ethers.keccak256(ethers.toUtf8Bytes(secret)),
    wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    increaseTime: async (provider: ethers.Provider, seconds: number) => {
      await provider.send("evm_increaseTime", [seconds]);
      await provider.send("evm_mine", []);
    },
  };

  console.log("✅ Test environment setup completed");
});

// Global test teardown
afterAll(async () => {
  console.log("🧹 Cleaning up test environment...");

  // Clean up any remaining resources
  if (global.testUtils) {
    delete global.testUtils;
  }

  console.log("✅ Test environment cleanup completed");
});

// Global test utilities type definition
declare global {
  var testUtils: {
    generateSecret: () => string;
    generateHashLock: (secret: string) => string;
    wait: (ms: number) => Promise<void>;
    increaseTime: (provider: ethers.Provider, seconds: number) => Promise<void>;
  };
}
