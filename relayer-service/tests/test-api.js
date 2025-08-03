#!/usr/bin/env node

/**
 * Simple API test script for the relayer service
 */

// Load environment variables
require("dotenv").config();

const baseUrl = `http://${process.env.API_HOST || "localhost"}:${
  process.env.PORT || 3000
}`;

console.log("🌐 Testing Relayer API Endpoints");
console.log("=================================");
console.log("Base URL:", baseUrl);

async function testEndpoint(endpoint, description) {
  try {
    console.log(`\n🔍 Testing ${description}...`);
    const response = await fetch(`${baseUrl}${endpoint}`);

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${description} - Status: ${response.status}`);
      console.log(`   Response:`, JSON.stringify(data, null, 2));
      return { success: true, data };
    } else {
      console.log(`❌ ${description} - Status: ${response.status}`);
      const errorText = await response.text();
      console.log(`   Error: ${errorText}`);
      return { success: false, error: errorText };
    }
  } catch (error) {
    console.log(`❌ ${description} - Connection failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAPITests() {
  console.log("\n🚀 Starting API tests...");

  const tests = [
    { endpoint: "/health", description: "Health Check" },
    { endpoint: "/status", description: "Service Status" },
    { endpoint: "/api/v1/health", description: "API Health Check" },
    { endpoint: "/api/v1/status", description: "API Status" },
  ];

  const results = [];

  for (const test of tests) {
    const result = await testEndpoint(test.endpoint, test.description);
    results.push({ ...test, ...result });
  }

  // Summary
  console.log("\n📊 API Test Summary");
  console.log("==================");

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(
    `📈 Success Rate: ${Math.round((passed / results.length) * 100)}%`
  );

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.success)
      .forEach((test) => {
        console.log(`  - ${test.description}: ${test.error}`);
      });
  }

  return results;
}

// Run tests
if (require.main === module) {
  runAPITests().catch(console.error);
}

module.exports = { runAPITests, testEndpoint };
