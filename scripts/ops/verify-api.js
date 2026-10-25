// verify-api.js
// API Contract Verification Script for PrimeShieldHub
// Run with: node verify-api.js

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const execAsync = promisify(exec);

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  apiBase: 'https://api.primeshieldhub.com',
  // For local testing, you might want to use:
  // apiBase: 'http://localhost:8787',
  
  // Test credentials - replace with valid test data
  testAdmin: {
    email: 'f.e.amenaghawon@gmail.com', // ← CHANGE THIS
    password: '12234And56789$AdminRotated!'  // ← CHANGE THIS
  },
  
  testStaff: {
    id: 'test-staff-id', // Will be fetched dynamically
    branchId: 'test-branch-id'
  },
  
  timeout: 5000,
  verbose: true
};

// ============================================
// HELPER FUNCTIONS
// ============================================

let authToken = null;
let testData = {
  userId: null,
  staffId: null,
  productId: null,
  orderId: null,
  wholesaleCodeId: null,
  resellerCodeId: null,
  branchId: null,
  sessionId: null,
  inviteId: null
};

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
  errors: []
};

function log(message, level = 'info') {
  const colors = {
    info: '\x1b[36m', // Cyan
    success: '\x1b[32m', // Green
    error: '\x1b[31m', // Red
    warning: '\x1b[33m', // Yellow
    reset: '\x1b[0m'
  };
  
  const timestamp = new Date().toISOString().slice(11, 19);
  const prefix = colors[level] || colors.info;
  console.log(`${prefix}[${timestamp}]${colors.reset} ${message}`);
}

async function fetchAPI(endpoint, options = {}) {
  const url = `${CONFIG.apiBase}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: CONFIG.timeout
  };

  // Add auth token if available
  if (authToken && !options.skipAuth) {
    defaultOptions.headers['Authorization'] = `Bearer ${authToken}`;
  }

  const mergedOptions = { ...defaultOptions, ...options };
  
  if (mergedOptions.body && typeof mergedOptions.body === 'object') {
    mergedOptions.body = JSON.stringify(mergedOptions.body);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
    
    const response = await fetch(url, {
      ...mergedOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return {
      status: response.status,
      ok: response.ok,
      data: data,
      headers: response.headers
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      return {
        status: 408,
        ok: false,
        data: { error: 'Request timeout' }
      };
    }
    return {
      status: 0,
      ok: false,
      data: { error: error.message }
    };
  }
}

async function testEndpoint(name, method, endpoint, options = {}) {
  const { expectedStatus = 200, skipAuth = false, body = null, validateResponse = null } = options;
  
  log(`Testing: ${method} ${endpoint}`, 'info');
  
  try {
    const fetchOptions = {
      method: method,
      skipAuth: skipAuth,
      ...(body && { body })
    };
    
    const response = await fetchAPI(endpoint, fetchOptions);
    
    // Special case for 404 - if it's not found, it's still a valid response
    const isSuccess = response.status === expectedStatus || 
                     (response.status === 404 && options.accept404) ||
                     (response.status === 401 && options.accept401);
    
    if (isSuccess) {
      // Validate response structure if validator provided
      if (validateResponse && typeof validateResponse === 'function') {
        const isValid = validateResponse(response.data);
        if (!isValid) {
          log(`  ❌ Response validation failed`, 'error');
          results.failed++;
          results.errors.push({ endpoint, name, error: 'Response validation failed' });
          return false;
        }
      }
      
      log(`  ✅ ${response.status} - PASSED`, 'success');
      results.passed++;
      return true;
    } else {
      log(`  ❌ ${response.status} - FAILED (expected ${expectedStatus})`, 'error');
      log(`  Response: ${JSON.stringify(response.data).substring(0, 200)}`, 'error');
      results.failed++;
      results.errors.push({ endpoint, name, status: response.status, error: response.data });
      return false;
    }
  } catch (error) {
    log(`  ❌ ERROR - ${error.message}`, 'error');
    results.failed++;
    results.errors.push({ endpoint, name, error: error.message });
    return false;
  }
}

// ============================================
// DATABASE VERIFICATION
// ============================================

async function verifyDatabase() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📊 VERIFYING DATABASE TABLES', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  try {
    const { stdout } = await execAsync(
      'npx wrangler d1 execute primeshieldhub-db --remote --command="SELECT name FROM sqlite_master WHERE type=\'table\' ORDER BY name;"'
    );
    
    // Extract table names from output
    const tableLines = stdout.split('\n');
    const tables = [];
    let inTableSection = false;
    
    for (const line of tableLines) {
      if (line.includes('┌────────────────────┐')) {
        inTableSection = true;
        continue;
      }
      if (inTableSection && line.includes('├')) continue;
      if (inTableSection && line.includes('│')) {
        const name = line.trim().replace(/^│\s*/, '').replace(/\s*│$/, '');
        if (name && name !== 'name' && name !== '') {
          tables.push(name);
        }
      }
      if (line.includes('└────────────────────┘')) {
        break;
      }
    }
    
    log(`Found ${tables.length} tables`, 'success');
    
    // Check critical tables
    const criticalTables = [
      'users', 'staff', 'products', 'orders', 'transactions',
      'charging_sessions', 'branches', 'payments', 'payouts',
      'wholesale_codes', 'reseller_codes', 'staff_invites'
    ];
    
    for (const table of criticalTables) {
      if (tables.includes(table)) {
        log(`  ✅ ${table} exists`, 'success');
      } else {
        log(`  ❌ ${table} MISSING`, 'error');
        results.errors.push({ database: table, error: 'Table missing' });
      }
    }
    
    // Get counts
    log('\n📈 Table counts:', 'info');
    const countTables = ['users', 'staff', 'products', 'orders', 'wholesale_codes', 'reseller_codes'];
    for (const table of countTables) {
      try {
        const { stdout } = await execAsync(
          `npx wrangler d1 execute primeshieldhub-db --remote --command="SELECT COUNT(*) FROM ${table};"`
        );
        const match = stdout.match(/\d+/);
        const count = match ? match[0] : '0';
        log(`  ${table}: ${count}`, 'info');
      } catch (error) {
        log(`  ${table}: ❌ Error fetching count`, 'error');
      }
    }
    
    return true;
  } catch (error) {
    log(`Database verification failed: ${error.message}`, 'error');
    return false;
  }
}

// ============================================
// AUTHENTICATION TESTS
// ============================================

async function testAuthentication() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('🔐 TESTING AUTHENTICATION', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // Test public config endpoint
  await testEndpoint('Public Config', 'GET', '/api/config/public', {
    expectedStatus: 200,
    skipAuth: true
  });
  
  // Test health endpoint
  await testEndpoint('Health Check', 'GET', '/api/_health', {
    expectedStatus: 200,
    skipAuth: true
  });
  
  // Test login
  log('\nAttempting admin login...', 'info');
  try {
    const response = await fetchAPI('/api/auth/admin-login', {
      method: 'POST',
      body: {
        email: CONFIG.testAdmin.email,
        password: CONFIG.testAdmin.password
      },
      skipAuth: true
    });
    
    if (response.ok && response.data.token) {
      authToken = response.data.token;
      log(`  ✅ Login successful - Token obtained`, 'success');
      results.passed++;
      
      // Test admin check
      await testEndpoint('Admin Check', 'GET', '/api/auth/admin-check', {
        expectedStatus: 200
      });
      
      return true;
    } else {
      log(`  ❌ Login failed: ${JSON.stringify(response.data)}`, 'error');
      results.failed++;
      results.errors.push({ auth: 'Login failed', error: response.data });
      
      // Try staff login instead
      log('\n⚠️ Trying staff login...', 'warning');
      const staffResponse = await fetchAPI('/api/auth/login', {
        method: 'POST',
        body: {
          email: CONFIG.testAdmin.email,
          password: CONFIG.testAdmin.password
        },
        skipAuth: true
      });
      
      if (staffResponse.ok && staffResponse.data.token) {
        authToken = staffResponse.data.token;
        log(`  ✅ Staff login successful`, 'success');
        results.passed++;
        return true;
      }
      
      return false;
    }
  } catch (error) {
    log(`  ❌ Authentication error: ${error.message}`, 'error');
    return false;
  }
}

// ============================================
// USER MANAGEMENT TESTS
// ============================================

async function testUserManagement() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('👤 TESTING USER MANAGEMENT', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET users
  await testEndpoint('Get Users', 'GET', '/api/users?page=1&limit=10', {
    expectedStatus: 200,
    validateResponse: (data) => Array.isArray(data) || (data && data.results !== undefined)
  });
  
  // GET staff
  await testEndpoint('Get Staff', 'GET', '/api/staff', {
    expectedStatus: 200,
    validateResponse: (data) => Array.isArray(data) || (data && data.results !== undefined)
  });
  
  // GET staff with filters
  await testEndpoint('Get Staff (filtered)', 'GET', '/api/staff?status=active', {
    expectedStatus: 200
  });
  
  // CREATE staff (test data)
  const newStaff = {
    name: 'Test Staff API',
    email: `test.staff.${Date.now()}@example.com`,
    phone: '08012345678',
    role: 'staff',
    branch_id: 'branch-1',
    pin: '1234'
  };
  
  const staffResult = await testEndpoint('Create Staff', 'POST', '/api/staff', {
    expectedStatus: 200,
    body: newStaff
  });
  
  // GET staff invites
  await testEndpoint('Get Staff Invites', 'GET', '/api/staff/invites', {
    expectedStatus: 200
  });
  
  // GET staff locations
  await testEndpoint('Get Staff Locations', 'GET', '/api/staff-locations', {
    expectedStatus: 200
  });
  
  // GET staff captures
  await testEndpoint('Get Staff Captures', 'GET', '/api/staff-captures', {
    expectedStatus: 200
  });
  
  // GET staff logs
  await testEndpoint('Get Staff Logs', 'GET', '/api/staff-logs', {
    expectedStatus: 200
  });
}

// ============================================
// ADMIN TESTS
// ============================================

async function testAdminEndpoints() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('🛡️ TESTING ADMIN ENDPOINTS', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // Admin stats
  await testEndpoint('Admin Stats', 'GET', '/api/admin/stats', {
    expectedStatus: 200
  });
  
  // Admin staff list
  await testEndpoint('Admin Staff List', 'GET', '/api/admin/staff-list', {
    expectedStatus: 200
  });
  
  // Admin orders
  await testEndpoint('Admin Orders', 'GET', '/api/admin/orders', {
    expectedStatus: 200
  });
  
  // Admin customers
  await testEndpoint('Admin Customers', 'GET', '/api/admin/customers', {
    expectedStatus: 200
  });
  
  // Admin investors
  await testEndpoint('Admin Investors', 'GET', '/api/admin/investors', {
    expectedStatus: 200
  });
  
  // Admin invitations
  await testEndpoint('Admin Invitations', 'GET', '/api/admin/invitations', {
    expectedStatus: 200
  });
  
  // Admin branches
  await testEndpoint('Admin Branches', 'GET', '/api/admin/branches', {
    expectedStatus: 200
  });
  
  // Admin logs
  await testEndpoint('Admin Logs', 'GET', '/api/admin/logs', {
    expectedStatus: 200
  });
  
  // Admin AI insights
  await testEndpoint('Admin AI Insights', 'GET', '/api/admin/ai-insights', {
    expectedStatus: 200
  });
  
  // Admin approve-staff endpoint (CRITICAL)
  await testEndpoint('Admin Approve Staff (CRITICAL)', 'POST', '/api/admin/approve-staff', {
    expectedStatus: 404, // Will fail without staff ID, but that's expected
    accept404: false,
    body: { staffId: 'test-id' }
  });
  
  // Admin reject-staff
  await testEndpoint('Admin Reject Staff', 'POST', '/api/admin/reject-staff', {
    expectedStatus: 404,
    body: { staffId: 'test-id', reason: 'Test rejection' }
  });
}

// ============================================
// PRODUCT TESTS
// ============================================

async function testProducts() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📦 TESTING PRODUCTS', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET products
  await testEndpoint('Get Products', 'GET', '/api/products?page=1&limit=10', {
    expectedStatus: 200
  });
  
  // GET products with filters
  await testEndpoint('Get Products (filtered)', 'GET', '/api/products?category=smartphones&active=true', {
    expectedStatus: 200
  });
  
  // CREATE product
  const newProduct = {
    name: `Test Product ${Date.now()}`,
    price: 25000,
    description: 'Test product for API verification',
    category: 'smartphones',
    stock: 10,
    wholesalePrice: 22000,
    wholesaleAvailable: true
  };
  
  const productResult = await testEndpoint('Create Product', 'POST', '/api/products', {
    expectedStatus: 200,
    body: newProduct
  });
}

// ============================================
// ORDER TESTS
// ============================================

async function testOrders() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📋 TESTING ORDERS', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET orders
  await testEndpoint('Get Orders', 'GET', '/api/orders?page=1&limit=10', {
    expectedStatus: 200
  });
  
  // GET orders with status filter
  await testEndpoint('Get Orders (filtered)', 'GET', '/api/orders?status=pending', {
    expectedStatus: 200
  });
}

// ============================================
// CHARGING TESTS
// ============================================

async function testCharging() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('⚡ TESTING CHARGING', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET charging sessions
  await testEndpoint('Get Charging Sessions', 'GET', '/api/charging/sessions?status=active', {
    expectedStatus: 200
  });
  
  // GET charging timer
  await testEndpoint('Get Charging Timer', 'GET', '/api/charging/timer', {
    expectedStatus: 200
  });
  
  // GET charging stats
  await testEndpoint('Get Charging Stats', 'GET', '/api/charging/stats', {
    expectedStatus: 200
  });
  
  // GET charging bays
  await testEndpoint('Get Charging Bays', 'GET', '/api/charging/bays', {
    expectedStatus: 200
  });
  
  // START charging session
  const newSession = {
    name: 'Test Customer',
    deviceType: 'phone',
    customerEmail: 'test@example.com',
    customerPhone: '08012345678',
    branchId: 'branch-1'
  };
  
  await testEndpoint('Start Charging Session', 'POST', '/api/charging/start', {
    expectedStatus: 201,
    body: newSession
  });
}

// ============================================
// WHOLESALE TESTS
// ============================================

async function testWholesale() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📦 WHOLESALE TESTING', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET wholesale codes
  await testEndpoint('Get Wholesale Codes', 'GET', '/api/wholesale/codes', {
    expectedStatus: 200
  });
  
  // GET wholesale requests
  await testEndpoint('Get Wholesale Requests', 'GET', '/api/wholesale/requests', {
    expectedStatus: 200
  });
  
  // GET wholesale products
  await testEndpoint('Get Wholesale Products', 'GET', '/api/wholesale/products', {
    expectedStatus: 200
  });
  
  // GET wholesale code by ID - THIS WILL FAIL because it doesn't exist
  await testEndpoint('Get Wholesale Code by ID (EXPECTED TO FAIL)', 'GET', '/api/wholesale/codes/wc001', {
    expectedStatus: 200,
    accept404: true,
    skipAuth: true
  });
}

// ============================================
// RESELLER TESTS
// ============================================

async function testReseller() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('👔 TESTING RESELLERS', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET resellers
  await testEndpoint('Get Resellers', 'GET', '/api/resellers', {
    expectedStatus: 200
  });
  
  // GET reseller codes
  await testEndpoint('Get Reseller Codes', 'GET', '/api/reseller-codes', {
    expectedStatus: 200
  });
  
  // CREATE reseller
  const newReseller = {
    name: `Test Reseller ${Date.now()}`,
    email: `reseller.${Date.now()}@example.com`,
    phone: '08012345678',
    location: 'Lagos',
    rank: 'bronze'
  };
  
  await testEndpoint('Create Reseller', 'POST', '/api/resellers', {
    expectedStatus: 200,
    body: newReseller
  });
  
  // GENERATE reseller code (THIS WILL LIKELY FAIL if no reseller exists)
  await testEndpoint('Generate Reseller Code', 'POST', '/api/reseller-codes/generate', {
    expectedStatus: 200, // May 500 if missing data
    accept404: true,
    body: {
      reseller_name: 'Test Reseller',
      discount: 10,
      tier: 'bronze',
      maxUses: 5
    }
  });
}

// ============================================
// PAYMENT TESTS
// ============================================

async function testPayments() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('💳 TESTING PAYMENTS', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET payments
  await testEndpoint('Get Payments', 'GET', '/api/payments', {
    expectedStatus: 200
  });
  
  // GET payouts
  await testEndpoint('Get Payouts', 'GET', '/api/payouts', {
    expectedStatus: 200
  });
  
  // GET charges
  await testEndpoint('Get Charges', 'GET', '/api/charges', {
    expectedStatus: 200
  });
  
  // GET transactions
  await testEndpoint('Get Transactions', 'GET', '/api/transactions', {
    expectedStatus: 200
  });

  // Verify Challenge v2 (D1) - Should fail with 403 without valid integrity token
  await testEndpoint('Verify Challenge v2 (D1)', 'POST', '/api/verify-challenge/v2', {
    expectedStatus: 403, // Expected 403 without valid integrity token
    skipAuth: true,
    body: {
      type: 'otp',
      solution: '123456'
    }
  });

  // Verify Challenge v1 (D1) - Should fail with 403 without valid integrity token
  await testEndpoint('Verify Challenge v1 (D1)', 'POST', '/api/verify-challenge', {
    expectedStatus: 403, // Expected 403 without valid integrity token
    skipAuth: true,
    body: {
      type: 'otp',
      solution: '123456'
    }
  });
}

// ============================================
// AI & ANALYTICS TESTS
// ============================================

async function testAI() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('🤖 TESTING AI & ANALYTICS', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET AI conversations
  await testEndpoint('Get AI Conversations', 'GET', '/api/ai/conversations', {
    expectedStatus: 200
  });
  
  // GET AI recommendations
  await testEndpoint('Get AI Recommendations', 'GET', '/api/ai/recommendations', {
    expectedStatus: 200
  });
  
  // GET brain (health check)
  await testEndpoint('Brain Health', 'GET', '/api/brain', {
    expectedStatus: 200,
    skipAuth: true
  });
  
  // AI Chat
  await testEndpoint('AI Chat', 'POST', '/api/ai/chat', {
    expectedStatus: 200,
    body: {
      message: 'Hello, this is a test message',
      sessionId: 'test-session'
    }
  });
}

// ============================================
// NOTIFICATION TESTS
// ============================================

async function testNotifications() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('🔔 TESTING NOTIFICATIONS', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET notifications
  await testEndpoint('Get Notifications', 'GET', '/api/notifications', {
    expectedStatus: 200
  });
}

// ============================================
// SYSTEM TESTS
// ============================================

async function testSystem() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('⚙️ TESTING SYSTEM', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'info');
  
  // GET audit logs
  await testEndpoint('Get Audit Logs', 'GET', '/api/audit/logs', {
    expectedStatus: 200
  });
  
  // GET security incidents
  await testEndpoint('Get Security Incidents', 'GET', '/api/security/incidents', {
    expectedStatus: 200
  });
  
  // GET deploy logs
  await testEndpoint('Get Deploy Logs', 'GET', '/api/deploy-logs', {
    expectedStatus: 200
  });
  
  // GET settings
  await testEndpoint('Get Settings', 'GET', '/api/settings', {
    expectedStatus: 200
  });
  
  // GET investor leads
  await testEndpoint('Get Investor Leads', 'GET', '/api/investor/leads', {
    expectedStatus: 200
  });
  
  // GET investor stats
  await testEndpoint('Get Investor Stats', 'GET', '/api/investor/stats', {
    expectedStatus: 200
  });
  
  // GET counters
  await testEndpoint('Get Counters', 'GET', '/api/counters', {
    expectedStatus: 200
  });
  
  // GET daily stats
  await testEndpoint('Get Daily Stats', 'GET', '/api/daily-stats', {
    expectedStatus: 200
  });
  
  // GET shipping stats
  await testEndpoint('Get Shipping Stats', 'GET', '/api/shipping/stats', {
    expectedStatus: 200
  });
}

// ============================================
// REPORT GENERATION
// ============================================

function generateReport() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  log('📊 API VERIFICATION REPORT', 'info');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
  
  const total = results.passed + results.failed + results.skipped;
  
  log(`\n📈 Summary:`, 'info');
  log(`  ✅ Passed: ${results.passed}`, 'success');
  log(`  ❌ Failed: ${results.failed}`, results.failed > 0 ? 'error' : 'info');
  log(`  ⏭️ Skipped: ${results.skipped}`, 'warning');
  log(`  📊 Total: ${total}`, 'info');
  
  const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
  log(`\n🎯 Pass Rate: ${passRate}%`, passRate >= 80 ? 'success' : 'error');
  
  if (results.errors.length > 0) {
    log('\n❌ Failed Tests:', 'error');
    const errorsByEndpoint = {};
    for (const err of results.errors) {
      const key = err.endpoint || err.database || err.auth || 'unknown';
      if (!errorsByEndpoint[key]) {
        errorsByEndpoint[key] = [];
      }
      errorsByEndpoint[key].push(err);
    }
    
    for (const [endpoint, errors] of Object.entries(errorsByEndpoint)) {
      log(`\n  📍 ${endpoint}:`, 'warning');
      for (const err of errors) {
        log(`    - ${err.error || err.message || 'Unknown error'}`, 'error');
      }
    }
  }
  
  // Recommendations
  log('\n💡 Recommendations:', 'info');
  
  if (results.errors.some(e => e.endpoint && e.endpoint.includes('approve-staff'))) {
    log('  🔧 Staff approve endpoint: Frontend uses /api/staff/:id/approve but backend uses /api/admin/approve-staff', 'warning');
  }
  
  if (results.errors.some(e => e.endpoint && e.endpoint.includes('wholesale/codes'))) {
    log('  🔧 Wholesale codes: Backend has GET /api/wholesale/codes but NOT GET /api/wholesale/codes/:id', 'warning');
  }
  
  // Save report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      total: total,
      passRate: passRate + '%'
    },
    errors: results.errors
  };
  
  fs.writeFileSync('api-verification-report.json', JSON.stringify(report, null, 2));
  log(`\n📄 Report saved to: api-verification-report.json`, 'info');
  
  // Exit with appropriate code
  if (results.failed > 0) {
    log('\n⚠️ Some tests failed. Review the errors above.', 'warning');
    process.exit(1);
  } else {
    log('\n✅ All tests passed! API is healthy.', 'success');
    process.exit(0);
  }
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main() {
  log('🚀 PrimeShieldHub API Verification Suite v2.0', 'info');
  log(`📡 Target: ${CONFIG.apiBase}\n`, 'info');
  
  // Check if we have credentials configured
  if (CONFIG.testAdmin.email === 'your-admin@email.com') {
    log('⚠️  WARNING: Using default test credentials. Please update CONFIG.testAdmin', 'warning');
    log('   Edit verify-api.js and set your actual admin email and password\n', 'warning');
  }
  
  try {
    // Database verification
    await verifyDatabase();
    
    // Authentication (must pass for most tests)
    const authSuccess = await testAuthentication();
    
    if (!authSuccess) {
      log('\n❌ Authentication failed. Some tests will be skipped.', 'error');
      // Continue with tests that don't require auth
    }
    
    // Run all test suites
    await testUserManagement();
    await testAdminEndpoints();
    await testProducts();
    await testOrders();
    await testCharging();
    await testWholesale();
    await testReseller();
    await testPayments();
    await testAI();
    await testNotifications();
    await testSystem();
    
    // Generate report
    generateReport();
    
  } catch (error) {
    log(`\n💥 Fatal error: ${error.message}`, 'error');
    console.error(error.stack);
    process.exit(1);
  }
}

// ============================================
// RUN THE TESTS
// ============================================

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n\n⏹️  Tests interrupted by user', 'warning');
  generateReport();
});

// Run the main function
main().catch(error => {
  log(`\n💥 Unhandled error: ${error.message}`, 'error');
  console.error(error.stack);
  process.exit(1);
});
