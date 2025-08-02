#!/usr/bin/env node

/**
 * Manual test script for menu loading
 * Run this to test the menu loading with the production API
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'https://fynlopos-9eg2c.ondigitalocean.app';
const TIMEOUT = 10000; // 10 seconds

async function testMenuLoading() {
  console.log('🧪 Testing menu loading from production API...\n');

  // Test 1: Health check
  console.log('1️⃣ Testing health endpoint...');
  try {
    const healthController = new AbortController();
    const healthTimeoutId = setTimeout(() => healthController.abort(), 5000);

    const healthResponse = await fetch(`${API_BASE_URL}/health`, {
      signal: healthController.signal,
    });

    clearTimeout(healthTimeoutId);
    if (healthResponse.ok) {
      console.log('✅ Health check passed\n');
    } else {
      console.log('❌ Health check failed with status:', healthResponse.status, '\n');
    }
  } catch (error) {
    console.log('❌ Health check error:', error.message, '\n');
  }

  // Test 2: Public Menu items endpoint (no auth required)
  console.log('2️⃣ Testing PUBLIC menu items endpoint...');
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(`${API_BASE_URL}/api/v1/public/menu/items`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Menu items loaded in ${elapsed}ms`);
      console.log(`   - Response has 'data' field: ${data.hasOwnProperty('data') ? 'Yes' : 'No'}`);
      console.log(`   - Items count: ${data.data ? data.data.length : 'N/A'}`);
      if (data.data && data.data.length > 0) {
        console.log(
          `   - First item: ${JSON.stringify(data.data[0], null, 2).substring(0, 200)}...`
        );
      }
    } else {
      console.log(`❌ Menu items request failed with status: ${response.status}`);
      const errorText = await response.text();
      console.log(`   - Error: ${errorText.substring(0, 200)}...`);
    }
  } catch (error) {
    const elapsed = Date.now() - startTime;
    if (error.name === 'AbortError') {
      console.log(`⏱️ Menu items request timed out after ${elapsed}ms`);
    } else {
      console.log(`❌ Menu items request error after ${elapsed}ms:`, error.message);
    }
  }

  console.log('\n3️⃣ Testing PUBLIC menu categories endpoint...');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);

    const response = await fetch(`${API_BASE_URL}/api/v1/public/menu/categories`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Menu categories loaded');
      console.log(`   - Categories count: ${data.data ? data.data.length : 'N/A'}`);
    } else {
      console.log(`❌ Menu categories request failed with status: ${response.status}`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('⏱️ Menu categories request timed out');
    } else {
      console.log('❌ Menu categories request error:', error.message);
    }
  }

  // Test 4: Compare with old authenticated endpoints
  console.log('\n4️⃣ Testing OLD (authenticated) menu endpoint for comparison...');
  const authStartTime = Date.now();
  try {
    const authController = new AbortController();
    const authTimeoutId = setTimeout(() => authController.abort(), 3000);

    const response = await fetch(`${API_BASE_URL}/api/v1/menu/items`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: authController.signal,
    });

    clearTimeout(authTimeoutId);
    const authElapsed = Date.now() - authStartTime;
    console.log(`❌ OLD endpoint returned ${response.status} in ${authElapsed}ms`);
    if (response.status === 401) {
      console.log('   - Confirms authentication is required on old endpoints');
    }
  } catch (error) {
    const authElapsed = Date.now() - authStartTime;
    console.log(`❌ OLD endpoint error after ${authElapsed}ms:`, error.message);
  }

  console.log('\n📊 Summary:');
  console.log('- API URL:', API_BASE_URL);
  console.log('- Timeout configured:', TIMEOUT, 'ms');
  console.log('- Retry attempts: 3 (with exponential backoff)');
  console.log('- Cache duration: 5 minutes');
  console.log('\n✅ Solution: Use /api/v1/public/menu/* endpoints for unauthenticated access');
}

// Run the test
testMenuLoading().catch(console.error);
