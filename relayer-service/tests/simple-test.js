#!/usr/bin/env node

/**
 * Simple test focusing on working components
 */

const { ethers } = require("ethers");
require("dotenv").config();

console.log("🧪 Simple Component Test");
console.log("=======================");

async function testEthereumOnly() {
  console.log("\n🔗 Testing Ethereum components...");

  try {
    const provider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
    const wallet = new ethers.Wallet(process.env.ETH_PRIVATE_KEY, provider);

    // Check connection
    const blockNumber = await provider.getBlockNumber();
    console.log("✅ Ethereum connected, block:", blockNumber);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log("✅ Wallet balance:", ethers.formatEther(balance), "ETH");
    console.log("✅ Wallet address:", wallet.address);

    // Check contract addresses
    const contracts = [
      { name: "Escrow Factory", address: process.env.ETH_ESCROW_FACTORY },
      {
        name: "Limit Order Protocol",
        address: process.env.ETH_LIMIT_ORDER_PROTOCOL,
      },
      { name: "Resolver", address: process.env.ETH_RESOLVER },
      { name: "WETH", address: process.env.ETH_WETH_ADDRESS },
    ];

    for (const contract of contracts) {
      const code = await provider.getCode(contract.address);
      if (code === "0x") {
        console.log(`❌ ${contract.name} not found at ${contract.address}`);
      } else {
        console.log(`✅ ${contract.name} found at ${contract.address}`);
      }
    }

    return true;
  } catch (error) {
    console.error("❌ Ethereum test failed:", error.message);
    return false;
  }
}

async function testRelayerAPI() {
  console.log("\n🌐 Testing Relayer API...");

  try {
    const baseUrl = `http://${process.env.API_HOST || "localhost"}:${
      process.env.PORT || 3000
    }`;

    // Test health endpoint
    const healthResponse = await fetch(`${baseUrl}/health`);
    if (healthResponse.ok) {
      const health = await healthResponse.json();
      console.log("✅ Relayer health check passed:", health.status);
      console.log("✅ Uptime:", Math.round(health.uptime / 60), "minutes");
    } else {
      console.log("❌ Health check failed:", healthResponse.status);
      return false;
    }

    // Test status endpoint
    const statusResponse = await fetch(`${baseUrl}/status`);
    if (statusResponse.ok) {
      const status = await statusResponse.json();
      console.log("✅ Relayer status:", status.status);
      console.log("✅ Active swaps:", status.activeSwaps);
      console.log("✅ Completed swaps:", status.completedSwaps);
    } else {
      console.log("❌ Status check failed:", statusResponse.status);
      return false;
    }

    return true;
  } catch (error) {
    console.error("❌ Relayer API test failed:", error.message);
    return false;
  }
}

async function testStellarBasic() {
  console.log("\n⭐ Testing Stellar basic connection...");

  try {
    const StellarSdk = require("@stellar/stellar-sdk");
    const server = new StellarSdk.Horizon.Server(
      process.env.STELLAR_HORIZON_URL
    );

    // Check connection by getting latest ledger
    const ledgers = await server.ledgers().order("desc").limit(1).call();
    if (ledgers.records && ledgers.records.length > 0) {
      console.log(
        "✅ Stellar connected, latest ledger:",
        ledgers.records[0].sequence
      );
    } else {
      throw new Error("Could not fetch latest ledger");
    }

    // Check if account exists
    try {
      const account = await server.loadAccount(process.env.STELLAR_ACCOUNT_ID);
      console.log("✅ Stellar account found, sequence:", account.sequence);

      // Check balances
      const nativeBalance = account.balances.find(
        (b) => b.asset_type === "native"
      );
      if (nativeBalance) {
        console.log("✅ XLM balance:", nativeBalance.balance);
      } else {
        console.log("⚠️  No XLM balance found");
      }
    } catch (accountError) {
      console.log(
        "⚠️  Stellar account not found or not funded:",
        process.env.STELLAR_ACCOUNT_ID
      );
      console.log("   You may need to fund this account with XLM");
    }

    // Check contract addresses format
    const contracts = [
      { name: "Escrow Factory", address: process.env.STELLAR_ESCROW_FACTORY },
      {
        name: "Limit Order Protocol",
        address: process.env.STELLAR_LIMIT_ORDER_PROTOCOL,
      },
      { name: "Resolver", address: process.env.STELLAR_RESOLVER },
    ];

    for (const contract of contracts) {
      if (contract.address && contract.address.startsWith("C")) {
        console.log(
          `✅ ${contract.name} address format valid: ${contract.address}`
        );
      } else {
        console.log(
          `❌ ${contract.name} invalid address format: ${contract.address}`
        );
      }
    }

    return true;
  } catch (error) {
    console.error("❌ Stellar test failed:", error.message);
    return false;
  }
}

async function generateTestOrder() {
  console.log("\n📝 Generating test order data...");

  try {
    // Generate a random secret (32 bytes)
    const secret = ethers.randomBytes(32);
    const secretHex = ethers.hexlify(secret);

    // Generate hashlock (keccak256 of secret)
    const hashLock = ethers.keccak256(secretHex);

    // Generate order hash
    const orderHash = ethers.solidityPackedKeccak256(
      ["address", "address", "uint256", "uint256", "bytes32"],
      [
        process.env.ETH_WETH_ADDRESS, // srcToken
        "0x0000000000000000000000000000000000000000", // dstToken (XLM placeholder)
        "1000000000000000000", // 1 ETH
        "1000000000", // 1 XLM
        hashLock, // hashLock
      ]
    );

    console.log("✅ Test order data generated:");
    console.log("  Order Hash:", orderHash);
    console.log("  Hash Lock:", hashLock);
    console.log("  Secret:", secretHex);

    return { orderHash, hashLock, secret: secretHex };
  } catch (error) {
    console.error("❌ Order generation failed:", error.message);
    return null;
  }
}

async function runSimpleTest() {
  console.log("\n🚀 Running simple component tests...");

  const results = {
    ethereum: await testEthereumOnly(),
    relayer: await testRelayerAPI(),
    stellar: await testStellarBasic(),
    orderData: await generateTestOrder(),
  };

  console.log("\n📊 Test Results Summary");
  console.log("=======================");
  console.log(
    "Ethereum Components:",
    results.ethereum ? "✅ WORKING" : "❌ FAILED"
  );
  console.log("Relayer API:", results.relayer ? "✅ WORKING" : "❌ FAILED");
  console.log("Stellar Basic:", results.stellar ? "✅ WORKING" : "❌ FAILED");
  console.log(
    "Order Generation:",
    results.orderData ? "✅ WORKING" : "❌ FAILED"
  );

  const workingComponents = Object.values(results).filter(Boolean).length;
  const totalComponents = Object.keys(results).length;

  console.log(
    `\n📈 Overall Status: ${workingComponents}/${totalComponents} components working`
  );

  if (workingComponents >= 3) {
    console.log("\n🎉 The relayer is ready for testing!");
    console.log("You can now:");
    console.log("1. Monitor the relayer logs for swap events");
    console.log("2. Create real swap orders through the API");
    console.log("3. Test the complete swap flow");
  } else {
    console.log("\n⚠️  Some components need attention:");
    if (!results.ethereum)
      console.log("- Check Ethereum RPC URL and private key");
    if (!results.relayer)
      console.log("- Check if relayer is running on correct port");
    if (!results.stellar)
      console.log("- Check Stellar account funding and configuration");
  }

  return results;
}

// Run the test
if (require.main === module) {
  runSimpleTest().catch(console.error);
}

module.exports = { runSimpleTest };
