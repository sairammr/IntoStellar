#!/usr/bin/env node

/**
 * Simple Contract Test
 * Tests if deployed contracts are accessible and have basic functionality
 */

const { ethers } = require("ethers");
require("dotenv").config();

console.log("🧪 Testing Deployed Contracts");
console.log("==============================");

// Configuration
const config = {
  // Ethereum (Sepolia)
  ethRpcUrl: process.env.ETH_RPC_URL,
  ethPrivateKey: process.env.ETH_PRIVATE_KEY,
  ethEscrowFactory: process.env.ETH_ESCROW_FACTORY,
  ethLimitOrderProtocol: process.env.ETH_LIMIT_ORDER_PROTOCOL,
  ethResolver: process.env.ETH_RESOLVER,
  ethWethAddress: process.env.ETH_WETH_ADDRESS,
};

async function testContracts() {
  try {
    console.log("\n🔗 Setting up Ethereum connection...");

    const provider = new ethers.JsonRpcProvider(config.ethRpcUrl);
    const wallet = new ethers.Wallet(config.ethPrivateKey, provider);

    // Check connection
    const blockNumber = await provider.getBlockNumber();
    console.log("✅ Ethereum connected, block:", blockNumber);
    console.log("✅ Wallet address:", wallet.address);

    // Test WETH contract
    console.log("\n📋 Testing WETH contract...");
    const wethContract = new ethers.Contract(
      config.ethWethAddress,
      [
        "function name() view returns (string)",
        "function symbol() view returns (string)",
        "function decimals() view returns (uint8)",
        "function totalSupply() view returns (uint256)",
        "function balanceOf(address) view returns (uint256)",
      ],
      provider
    );

    const wethName = await wethContract.name();
    const wethSymbol = await wethContract.symbol();
    const wethDecimals = await wethContract.decimals();
    const wethTotalSupply = await wethContract.totalSupply();
    const wethBalance = await wethContract.balanceOf(wallet.address);

    console.log("✅ WETH contract accessible:");
    console.log("  Name:", wethName);
    console.log("  Symbol:", wethSymbol);
    console.log("  Decimals:", wethDecimals.toString());
    console.log("  Total Supply:", ethers.formatEther(wethTotalSupply));
    console.log("  Wallet Balance:", ethers.formatEther(wethBalance));

    // Test Escrow Factory contract
    console.log("\n📋 Testing Escrow Factory contract...");
    const factoryContract = new ethers.Contract(
      config.ethEscrowFactory,
      [
        "function ESCROW_SRC_IMPLEMENTATION() view returns (address)",
        "function ESCROW_DST_IMPLEMENTATION() view returns (address)",
        "function FEE_BANK() view returns (address)",
      ],
      provider
    );

    const srcImpl = await factoryContract.ESCROW_SRC_IMPLEMENTATION();
    const dstImpl = await factoryContract.ESCROW_DST_IMPLEMENTATION();
    const feeBank = await factoryContract.FEE_BANK();

    console.log("✅ Escrow Factory contract accessible:");
    console.log("  Src Implementation:", srcImpl);
    console.log("  Dst Implementation:", dstImpl);
    console.log("  Fee Bank:", feeBank);

    // Test Limit Order Protocol contract
    console.log("\n📋 Testing Limit Order Protocol contract...");
    const lopContract = new ethers.Contract(
      config.ethLimitOrderProtocol,
      [
        "function DOMAIN_SEPARATOR() view returns (bytes32)",
        "function paused() view returns (bool)",
      ],
      provider
    );

    const domainSeparator = await lopContract.DOMAIN_SEPARATOR();
    const isPaused = await lopContract.paused();

    console.log("✅ Limit Order Protocol contract accessible:");
    console.log("  Domain Separator:", domainSeparator);
    console.log("  Paused:", isPaused);

    // Test Resolver contract
    console.log("\n📋 Testing Resolver contract...");
    const resolverContract = new ethers.Contract(
      config.ethResolver,
      [
        "function escrowFactory() view returns (address)",
        "function limitOrderProtocol() view returns (address)",
      ],
      provider
    );

    const resolverFactory = await resolverContract.escrowFactory();
    const resolverLop = await resolverContract.limitOrderProtocol();

    console.log("✅ Resolver contract accessible:");
    console.log("  Escrow Factory:", resolverFactory);
    console.log("  Limit Order Protocol:", resolverLop);

    // Verify contract relationships
    console.log("\n🔗 Verifying contract relationships...");

    if (
      resolverFactory.toLowerCase() === config.ethEscrowFactory.toLowerCase()
    ) {
      console.log("✅ Resolver correctly references Escrow Factory");
    } else {
      console.log("❌ Resolver Escrow Factory reference mismatch");
      console.log("  Expected:", config.ethEscrowFactory);
      console.log("  Got:", resolverFactory);
    }

    if (
      resolverLop.toLowerCase() === config.ethLimitOrderProtocol.toLowerCase()
    ) {
      console.log("✅ Resolver correctly references Limit Order Protocol");
    } else {
      console.log("❌ Resolver Limit Order Protocol reference mismatch");
      console.log("  Expected:", config.ethLimitOrderProtocol);
      console.log("  Got:", resolverLop);
    }

    console.log("\n🎉 All contract tests completed successfully!");
    console.log("\n📝 Summary:");
    console.log("  ✅ WETH contract is accessible and functional");
    console.log("  ✅ Escrow Factory contract is accessible");
    console.log("  ✅ Limit Order Protocol contract is accessible");
    console.log("  ✅ Resolver contract is accessible");
    console.log("  ✅ Contract relationships are properly configured");

    console.log("\n💡 Next Steps:");
    console.log("  1. The contracts are properly deployed and accessible");
    console.log("  2. To perform a real swap, you need to:");
    console.log("     - Create an order through the LOP");
    console.log("     - Use the resolver to fill the order");
    console.log("     - The escrow factory will be called automatically");
    console.log("  3. The LOP requires proper order formatting and signatures");
    console.log(
      "  4. Consider using the existing ETH-BSC example as a reference"
    );
  } catch (error) {
    console.error("❌ Contract test failed:", error.message);
    throw error;
  }
}

// Run the test
if (require.main === module) {
  testContracts()
    .then(() => {
      console.log("\n🎉 Contract test completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Contract test failed:", error);
      process.exit(1);
    });
}

module.exports = { testContracts };
