#!/usr/bin/env node

/**
 * Generate Stellar keypairs for testing
 * Run this script to generate a new Stellar keypair for the relayer
 */

const { Keypair, Networks } = require("@stellar/stellar-sdk");

console.log("🔑 Generating Stellar Keypair for Testing");
console.log("==========================================");

// Generate a new keypair
const keypair = Keypair.random();

console.log("\n✅ Generated Keypair:");
console.log("Public Key (Account ID):", keypair.publicKey());
console.log("Secret Key:", keypair.secret());

console.log("\n📝 Add these to your .env file:");
console.log("STELLAR_PRIVATE_KEY=" + keypair.secret());
console.log("STELLAR_ACCOUNT_ID=" + keypair.publicKey());

console.log("\n⚠️  IMPORTANT:");
console.log("1. This is a TEST keypair - do NOT use in production!");
console.log("2. You need to fund this account with XLM before using it");
console.log("3. For testnet, use: https://laboratory.stellar.org/#account-creator");
console.log("4. For futurenet, use: https://www.stellar.org/developers/guides/get-started/create-account.html");

console.log("\n🚀 To fund your account:");
console.log("- Testnet: Visit https://laboratory.stellar.org/#account-creator");
console.log("- Futurenet: Use the friendbot or transfer from another account");

console.log("\n🔧 Environment Setup:");
console.log("Copy the generated values to your .env file in the relayer-service directory");
console.log("Then run: npm start"); 