#!/usr/bin/env node

/**
 * Create a test swap order and submit it to the relayer
 */

const { ethers } = require("ethers");
require("dotenv").config();

console.log("🔄 Creating Test Swap Order");
console.log("===========================");

async function createTestSwapOrder() {
  try {
    // Generate test data
    const secret = ethers.randomBytes(32);
    const secretHex = ethers.hexlify(secret);
    const hashLock = ethers.keccak256(secretHex);

    // Create order hash
    const orderHash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "uint256", "bytes32"],
      [
        process.env.ETH_WETH_ADDRESS, // srcToken (WETH)
        "0x0000000000000000000000000000000000000000", // dstToken (XLM placeholder)
        "1000000000000000000", // 1 ETH (18 decimals)
        "1000000000", // 1 XLM (7 decimals)
        hashLock,
      ]
    );

    // Create order data
    const orderData = {
      orderHash,
      hashLock,
      maker: process.env.STELLAR_ACCOUNT_ID, // Stellar account as maker
      taker: "0x" + "0".repeat(40), // Placeholder Ethereum taker
      srcToken: process.env.ETH_WETH_ADDRESS,
      dstToken: "XLM",
      srcAmount: "1000000000000000000", // 1 ETH
      dstAmount: "1000000000", // 1 XLM
      timelocks: {
        finalityDelay: 60,
        srcWithdrawalDelay: 300,
        srcPublicWithdrawalDelay: 600,
        srcCancellationDelay: 900,
        srcPublicCancellationDelay: 1200,
        dstWithdrawalDelay: 300,
        dstPublicWithdrawalDelay: 600,
        dstCancellationDelay: 900,
      },
      signature: "0x" + "0".repeat(130), // Placeholder signature
    };

    console.log("📝 Generated test order:");
    console.log("  Order Hash:", orderHash);
    console.log("  Hash Lock:", hashLock);
    console.log("  Maker:", orderData.maker);
    console.log("  Src Token:", orderData.srcToken);
    console.log("  Dst Token:", orderData.dstToken);
    console.log("  Src Amount: 1 ETH");
    console.log("  Dst Amount: 1 XLM");

    // Submit to relayer API
    const baseUrl = `http://${process.env.API_HOST || "localhost"}:${
      process.env.PORT || 3000
    }`;

    console.log("\n🌐 Submitting order to relayer...");
    const response = await fetch(`${baseUrl}/api/v1/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderData),
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Order submitted successfully!");
      console.log("  Response:", JSON.stringify(result, null, 2));
      return { success: true, orderHash, result };
    } else {
      const error = await response.text();
      console.log("❌ Order submission failed:", response.status);
      console.log("  Error:", error);
      return { success: false, error };
    }
  } catch (error) {
    console.error("❌ Failed to create test swap:", error.message);
    return { success: false, error: error.message };
  }
}

async function monitorSwapStatus(orderHash) {
  console.log("\n👀 Monitoring swap status...");

  const baseUrl = `http://${process.env.API_HOST || "localhost"}:${
    process.env.PORT || 3000
  }`;

  // Check status every 10 seconds for 2 minutes
  for (let i = 0; i < 12; i++) {
    try {
      const response = await fetch(`${baseUrl}/api/v1/swap/${orderHash}`);
      if (response.ok) {
        const status = await response.json();
        console.log(`  [${new Date().toISOString()}] Status:`, status.status);

        if (status.status === "completed" || status.status === "cancelled") {
          console.log("✅ Swap finished with status:", status.status);
          return status;
        }
      }
    } catch (error) {
      console.log(
        `  [${new Date().toISOString()}] Error checking status:`,
        error.message
      );
    }

    // Wait 10 seconds
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }

  console.log("⏰ Monitoring timeout reached");
  return null;
}

async function main() {
  console.log("🚀 Starting test swap creation...");

  // Create the swap order
  const result = await createTestSwapOrder();

  if (result.success) {
    console.log("\n🎉 Test swap order created successfully!");
    console.log("The relayer should now process this order.");

    // Monitor the swap status
    await monitorSwapStatus(result.orderHash);

    console.log("\n📋 Next steps:");
    console.log("1. Watch the relayer logs for processing events");
    console.log("2. Check the API status endpoint for updates");
    console.log(
      "3. Monitor both Ethereum and Stellar networks for transactions"
    );
  } else {
    console.log("\n❌ Test swap creation failed");
    console.log("Check the relayer logs for more details");
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { createTestSwapOrder, monitorSwapStatus };
