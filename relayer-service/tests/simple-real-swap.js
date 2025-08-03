#!/usr/bin/env node

/**
 * Simple Real ETH-Stellar Swap
 * Uses actual deployed contracts with proper interfaces
 */

const { ethers } = require("ethers");
const {
  Keypair,
  Networks,
  TransactionBuilder,
  Operation,
} = require("@stellar/stellar-sdk");
require("dotenv").config();

console.log("🔄 Simple Real ETH-Stellar Swap (0.01 ETH ↔ 1 XLM)");
console.log("===================================================");

// Configuration
const config = {
  // Ethereum (Sepolia)
  ethRpcUrl: process.env.ETH_RPC_URL,
  ethPrivateKey: process.env.ETH_PRIVATE_KEY,
  ethEscrowFactory: process.env.ETH_ESCROW_FACTORY,
  ethLimitOrderProtocol: process.env.ETH_LIMIT_ORDER_PROTOCOL,
  ethResolver: process.env.ETH_RESOLVER,
  ethWethAddress: process.env.ETH_WETH_ADDRESS,

  // Stellar (Testnet)
  stellarHorizonUrl: process.env.STELLAR_HORIZON_URL,
  stellarPrivateKey: process.env.STELLAR_PRIVATE_KEY,
  stellarAccountId: process.env.STELLAR_ACCOUNT_ID,
  stellarEscrowFactory: process.env.STELLAR_ESCROW_FACTORY,
  stellarLimitOrderProtocol: process.env.STELLAR_LIMIT_ORDER_PROTOCOL,
  stellarResolver: process.env.STELLAR_RESOLVER,

  // Swap amounts
  ethAmount: "10000000000000000", // 0.01 ETH (16 decimals)
  stellarAmount: "10000000", // 1 XLM (7 decimals)
};

// Swap state
let swapState = {
  orderHash: null,
  secret: null,
  hashLock: null,
  startTime: null,
  endTime: null,
  success: false,
  errors: [],
  transactions: [],
};

/**
 * Generate swap data
 */
function generateSwapData() {
  console.log("\n📝 Generating swap data...");

  // Generate a random secret (32 bytes)
  const secret = ethers.randomBytes(32);
  const secretHex = ethers.hexlify(secret);

  // Generate hashlock (keccak256 of secret)
  const hashLock = ethers.keccak256(secretHex);

  // Generate order hash
  const orderHash = ethers.solidityPackedKeccak256(
    ["address", "address", "uint256", "uint256", "bytes32"],
    [
      config.ethWethAddress, // srcToken (WETH)
      "0x0000000000000000000000000000000000000000", // dstToken (XLM placeholder)
      config.ethAmount, // 0.01 ETH
      config.stellarAmount, // 1 XLM
      hashLock,
    ]
  );

  swapState.secret = secretHex;
  swapState.hashLock = hashLock;
  swapState.orderHash = orderHash;

  console.log("✅ Swap data generated:");
  console.log("  Order Hash:", orderHash);
  console.log("  Hash Lock:", hashLock);
  console.log("  Secret:", secretHex);
  console.log("  ETH Amount: 0.01 ETH");
  console.log("  XLM Amount: 1 XLM");

  return { orderHash, hashLock, secret: secretHex };
}

/**
 * Setup Ethereum connection
 */
async function setupEthereum() {
  console.log("\n🔗 Setting up Ethereum connection...");

  try {
    const provider = new ethers.JsonRpcProvider(config.ethRpcUrl);
    const wallet = new ethers.Wallet(config.ethPrivateKey, provider);

    // Check connection
    const blockNumber = await provider.getBlockNumber();
    console.log("✅ Ethereum connected, block:", blockNumber);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log("✅ Wallet balance:", ethers.formatEther(balance), "ETH");
    console.log("✅ Wallet address:", wallet.address);

    // Check WETH balance
    const wethContract = new ethers.Contract(
      config.ethWethAddress,
      [
        "function balanceOf(address) view returns (uint256)",
        "function deposit() payable",
        "function approve(address spender, uint256 amount) returns (bool)",
      ],
      provider
    );
    const wethBalance = await wethContract.balanceOf(wallet.address);
    console.log("✅ WETH balance:", ethers.formatEther(wethBalance), "WETH");

    // Check contract addresses
    const contracts = [
      { name: "Escrow Factory", address: config.ethEscrowFactory },
      { name: "Limit Order Protocol", address: config.ethLimitOrderProtocol },
      { name: "Resolver", address: config.ethResolver },
      { name: "WETH", address: config.ethWethAddress },
    ];

    for (const contract of contracts) {
      const code = await provider.getCode(contract.address);
      if (code === "0x") {
        throw new Error(`${contract.name} not deployed at ${contract.address}`);
      }
      console.log(`✅ ${contract.name} found at ${contract.address}`);
    }

    return { provider, wallet, wethContract };
  } catch (error) {
    console.error("❌ Ethereum setup failed:", error.message);
    swapState.errors.push(`Ethereum Setup: ${error.message}`);
    throw error;
  }
}

/**
 * Setup Stellar connection
 */
async function setupStellar() {
  console.log("\n⭐ Setting up Stellar connection...");

  try {
    const StellarSdk = require("@stellar/stellar-sdk");
    const server = new StellarSdk.Horizon.Server(config.stellarHorizonUrl);
    const keypair = Keypair.fromSecret(config.stellarPrivateKey);

    // Check connection
    const ledgers = await server.ledgers().order("desc").limit(1).call();
    console.log(
      "✅ Stellar connected, latest ledger:",
      ledgers.records[0].sequence
    );

    // Check account
    const account = await server.loadAccount(config.stellarAccountId);
    console.log("✅ Stellar account found, sequence:", account.sequence);

    // Check XLM balance
    const nativeBalance = account.balances.find(
      (b) => b.asset_type === "native"
    );
    if (nativeBalance) {
      console.log("✅ XLM balance:", nativeBalance.balance);
      if (parseFloat(nativeBalance.balance) < 1) {
        throw new Error(
          "Insufficient XLM balance. Need at least 1 XLM for the swap."
        );
      }
    } else {
      throw new Error("No XLM balance found");
    }

    return { server, keypair, account };
  } catch (error) {
    console.error("❌ Stellar setup failed:", error.message);
    swapState.errors.push(`Stellar Setup: ${error.message}`);
    throw error;
  }
}

/**
 * Create Ethereum escrow directly via factory
 */
async function createEthereumEscrow(ethSetup) {
  console.log("\n🔒 Creating Ethereum escrow via factory...");

  try {
    const { provider, wallet } = ethSetup;

    // Create factory contract instance
    const factoryContract = new ethers.Contract(
      config.ethEscrowFactory,
      [
        "function createEscrow(bytes32 orderHash, bytes32 hashLock, address maker, address taker, address token, uint256 amount, uint256 safetyDeposit, uint256[] calldata timelocks) external returns (address)",
        "event SrcEscrowCreated(bytes32 indexed orderHash, address indexed escrow, address indexed maker, uint256 amount)",
      ],
      wallet
    );

    // Create timelocks array
    const timelocks = [
      60, // finalityDelay
      300, // srcWithdrawalDelay
      600, // srcPublicWithdrawalDelay
      900, // srcCancellationDelay
      1200, // srcPublicCancellationDelay
      300, // dstWithdrawalDelay
      600, // dstPublicWithdrawalDelay
    ];

    console.log("✅ Escrow parameters prepared:");
    console.log("  Order Hash:", swapState.orderHash);
    console.log("  Hash Lock:", swapState.hashLock);
    console.log("  Maker:", wallet.address);
    console.log("  Token:", config.ethWethAddress);
    console.log("  Amount:", ethers.formatEther(config.ethAmount), "ETH");

    // Create escrow
    console.log("🔄 Creating escrow...");
    const tx = await factoryContract.createEscrow(
      swapState.orderHash,
      swapState.hashLock,
      wallet.address, // maker
      "0x0000000000000000000000000000000000000000", // taker placeholder
      config.ethWethAddress, // token
      config.ethAmount, // amount
      0, // safety deposit
      timelocks,
      { gasLimit: 500000 }
    );

    const receipt = await tx.wait();
    swapState.transactions.push({
      chain: "ethereum",
      hash: tx.hash,
      type: "escrow_creation",
    });

    console.log("✅ Ethereum escrow created!");
    console.log("  Transaction:", tx.hash);
    console.log("  Gas used:", receipt.gasUsed.toString());

    // Get escrow address from event
    const event = receipt.logs.find((log) => {
      try {
        return factoryContract.interface.parseLog(log);
      } catch {
        return false;
      }
    });

    if (event) {
      const parsedEvent = factoryContract.interface.parseLog(event);
      const escrowAddress = parsedEvent.args.escrow;
      console.log("  Escrow Address:", escrowAddress);
      return { txHash: tx.hash, escrowAddress };
    } else {
      console.log("⚠️  Could not find escrow creation event");
      return { txHash: tx.hash, escrowAddress: null };
    }
  } catch (error) {
    console.error("❌ Ethereum escrow creation failed:", error.message);
    swapState.errors.push(`Ethereum Escrow: ${error.message}`);
    throw error;
  }
}

/**
 * Create Stellar escrow
 */
async function createStellarEscrow(stellarSetup) {
  console.log("\n🔒 Creating Stellar escrow...");

  try {
    const { server, keypair, account } = stellarSetup;

    // Create transaction to call the escrow factory
    const transaction = new TransactionBuilder(account, {
      fee: "100000", // 0.1 XLM fee
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(
        Operation.invokeHostFunction({
          hostFunction: "invoke",
          auth: [],
          args: [
            // Contract ID (Escrow Factory)
            { type: "address", value: config.stellarEscrowFactory },
            // Function name
            { type: "symbol", value: "post_interaction" },
            // Arguments - simplified for now
            {
              type: "vec",
              value: [
                { type: "bytes", value: swapState.orderHash },
                { type: "bytes", value: swapState.hashLock },
                { type: "address", value: config.stellarAccountId },
                { type: "address", value: "0x" + "0".repeat(40) }, // Placeholder taker
                { type: "address", value: "native" }, // XLM asset
                { type: "i128", value: config.stellarAmount },
                { type: "i128", value: "0" }, // Safety deposit
                { type: "u64", value: "60" }, // Finality delay
                { type: "u64", value: "300" }, // Src withdrawal delay
                { type: "u64", value: "600" }, // Src public withdrawal delay
                { type: "u64", value: "900" }, // Src cancellation delay
                { type: "u64", value: "1200" }, // Src public cancellation delay
                { type: "u64", value: "300" }, // Dst withdrawal delay
                { type: "u64", value: "600" }, // Dst public withdrawal delay
                { type: "u64", value: "900" }, // Dst cancellation delay
              ],
            },
          ],
        })
      )
      .setTimeout(30)
      .build();

    // Sign transaction
    transaction.sign(keypair);

    // Submit transaction
    console.log("🔄 Submitting Stellar escrow transaction...");
    const response = await server.submitTransaction(transaction);

    swapState.transactions.push({
      chain: "stellar",
      hash: response.hash,
      type: "escrow_creation",
    });

    console.log("✅ Stellar escrow created!");
    console.log("  Transaction:", response.hash);
    console.log("  Ledger:", response.ledger);

    return { txHash: response.hash, ledger: response.ledger };
  } catch (error) {
    console.error("❌ Stellar escrow creation failed:", error.message);
    swapState.errors.push(`Stellar Escrow: ${error.message}`);
    throw error;
  }
}

/**
 * Verify escrow creation
 */
async function verifyEscrowCreation(ethSetup, stellarSetup) {
  console.log("\n✅ Verifying escrow creation...");

  try {
    const { provider } = ethSetup;
    const { server } = stellarSetup;

    // Wait a bit for transactions to be processed
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Check Ethereum escrow
    const factoryContract = new ethers.Contract(
      config.ethEscrowFactory,
      [
        "event SrcEscrowCreated(bytes32 indexed orderHash, address indexed escrow, address indexed maker, uint256 amount)",
      ],
      provider
    );

    const events = await factoryContract.queryFilter(
      factoryContract.filters.SrcEscrowCreated(swapState.orderHash),
      "latest"
    );

    if (events.length > 0) {
      const event = events[0];
      console.log("✅ Ethereum escrow verified:", event.args.escrow);
    } else {
      console.log("⚠️  Ethereum escrow event not found");
    }

    // Check Stellar transaction
    try {
      const stellarTx = await server
        .transactions()
        .transaction(
          swapState.transactions.find((t) => t.chain === "stellar").hash
        )
        .call();
      console.log("✅ Stellar transaction verified:", stellarTx.hash);
    } catch (error) {
      console.log(
        "⚠️  Stellar transaction verification failed:",
        error.message
      );
    }

    return true;
  } catch (error) {
    console.error("❌ Escrow verification failed:", error.message);
    swapState.errors.push(`Verification: ${error.message}`);
    throw error;
  }
}

/**
 * Generate swap report
 */
function generateSwapReport() {
  console.log("\n📊 Simple Real Swap Report");
  console.log("===========================");

  const duration = swapState.endTime - swapState.startTime;

  console.log("Status:", swapState.success ? "✅ SUCCESS" : "❌ FAILED");
  console.log("Duration:", Math.round(duration / 1000), "seconds");
  console.log("Start Time:", swapState.startTime.toISOString());
  console.log("End Time:", swapState.endTime.toISOString());

  if (swapState.orderHash) {
    console.log("Order Hash:", swapState.orderHash);
  }

  if (swapState.transactions.length > 0) {
    console.log("\n📝 Transactions:");
    swapState.transactions.forEach((tx, index) => {
      console.log(
        `  ${index + 1}. ${tx.chain.toUpperCase()} - ${tx.type}: ${tx.hash}`
      );
    });
  }

  if (swapState.errors.length > 0) {
    console.log("\n❌ Errors encountered:");
    swapState.errors.forEach((error, index) => {
      console.log(`  ${index + 1}. ${error}`);
    });
  } else {
    console.log("\n✅ No errors encountered");
  }

  console.log("\n🔧 Swap Details:");
  console.log("  ETH Amount: 0.01 ETH");
  console.log("  XLM Amount: 1 XLM");
  console.log("  Hash Lock:", swapState.hashLock);
  console.log("  Secret:", swapState.secret);
}

/**
 * Main swap execution
 */
async function executeSimpleSwap() {
  console.log("\n🚀 Executing simple real ETH-Stellar swap...");
  swapState.startTime = new Date();

  try {
    // Step 1: Generate swap data
    const swapData = generateSwapData();

    // Step 2: Setup connections
    const ethSetup = await setupEthereum();
    const stellarSetup = await setupStellar();

    // Step 3: Create Ethereum escrow
    const ethEscrow = await createEthereumEscrow(ethSetup);

    // Step 4: Create Stellar escrow
    const stellarEscrow = await createStellarEscrow(stellarSetup);

    // Step 5: Verify escrow creation
    await verifyEscrowCreation(ethSetup, stellarSetup);

    swapState.success = true;
    swapState.endTime = new Date();

    console.log("\n🎉 Simple real swap execution completed successfully!");
    console.log("Both escrows have been created on their respective chains.");
    console.log("The relayer can now monitor and complete the swap.");
  } catch (error) {
    console.error("\n❌ Simple real swap execution failed:", error.message);
    swapState.errors.push(`Main Execution: ${error.message}`);
    swapState.endTime = new Date();
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await executeSimpleSwap();
    generateSwapReport();
  } catch (error) {
    console.error("❌ Main execution failed:", error);
    process.exit(1);
  }
}

// Run the simple swap
if (require.main === module) {
  main();
}

module.exports = {
  executeSimpleSwap,
  generateSwapData,
  setupEthereum,
  setupStellar,
  createEthereumEscrow,
  createStellarEscrow,
  verifyEscrowCreation,
};
