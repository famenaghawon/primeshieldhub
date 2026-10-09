import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import readline from 'readline';

console.log('========================================');
console.log('🔍 DEBUG MODE - Script Starting');
console.log('========================================');

// ============================================
// CONFIGURATION - EDIT THESE VALUES
// ============================================
const CONFIG = {
  workerUrl: 'https://primeshieldhub-production.primeshieldhub-a74.workers.dev',
  email: 'ceo@primeshieldhub.com',  // ← CHANGE THIS
  password: '1234And56789Admin',  // ← CH5ANGE THIS
  fingerprint: crypto.randomBytes(16).toString('hex'),
  cookieFile: './auth-cookies.json',
  otpMode: 'manual',
  otpCode: null,
};

console.log('\n📋 Configuration loaded:');
console.log(`   Worker URL: ${CONFIG.workerUrl}`);
console.log(`   Email: ${CONFIG.email}`);
console.log(`   Fingerprint: ${CONFIG.fingerprint}`);

// Check if credentials are still defaults
if (CONFIG.email === 'your-admin@email.com' || CONFIG.password === 'your-password-here') {
  console.error('\n❌ ERROR: You must edit the CONFIG with your actual email and password!');
  console.error('   Open auth-deploy.js and change lines 20-21');
  process.exit(1);
}

// ============================================
// COOKIE MANAGEMENT
// ============================================
class CookieManager {
  constructor(filePath) {
    this.filePath = filePath;
    this.cookies = new Map();
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        this.cookies = new Map(Object.entries(data));
        console.log('🍪 Loaded existing cookies');
      }
    } catch (err) {
      console.log('🍪 No existing cookies found');
    }
  }

  save() {
    const data = Object.fromEntries(this.cookies);
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  setFromResponse(response) {
    const setCookie = response.headers['set-cookie'];
    if (setCookie) {
      setCookie.forEach(cookie => {
        const [nameValue] = cookie.split(';');
        const [name, value] = nameValue.split('=');
        this.cookies.set(name, value);
        console.log(`🍪 Cookie set: ${name}=${value.substring(0, 20)}...`);
      });
      this.save();
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  hasAuthCookie() {
    return this.cookies.has('auth') || this.cookies.has('session');
  }

  clear() {
    this.cookies.clear();
    if (fs.existsSync(this.filePath)) {
      fs.unlinkSync(this.filePath);
    }
  }
}

// ============================================
// HTTP REQUEST HELPER WITH DEBUG
// ============================================
async function makeRequest(url, options = {}) {
  console.log(`\n🌐 Making ${options.method || 'GET'} request to: ${url}`);
  
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': CONFIG.fingerprint,
        ...options.headers,
      },
    };

    if (options.cookieManager) {
      const cookieHeader = options.cookieManager.getCookieHeader();
      if (cookieHeader) {
        requestOptions.headers['Cookie'] = cookieHeader;
        console.log(`   📎 With cookies: ${cookieHeader.substring(0, 50)}...`);
      }
    }

    console.log(`   ⏳ Waiting for response...`);

    const req = httpModule.request(requestOptions, (res) => {
      console.log(`   📡 Response status: ${res.statusCode}`);
      
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`   📦 Response body length: ${body.length} bytes`);
        if (body.length < 500) {
          console.log(`   📄 Body preview: ${body}`);
        } else {
          console.log(`   📄 Body preview: ${body.substring(0, 200)}...`);
        }
        
        const response = {
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          json: () => {
            try {
              return JSON.parse(body);
            } catch {
              return null;
            }
          }
        };
        resolve(response);
      });
    });

    req.on('error', (err) => {
      console.error(`   ❌ Request error: ${err.message}`);
      reject(err);
    });

    if (options.body) {
      const bodyString = JSON.stringify(options.body);
      console.log(`   📤 Sending body: ${bodyString}`);
      req.write(bodyString);
    }

    req.end();
  });
}

// ============================================
// AUTHENTICATION FLOW
// ============================================
async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestOTP(cookieManager) {
  console.log('\n========================================');
  console.log('📧 STEP 1: Requesting OTP');
  console.log('========================================');

  try {
    const response = await makeRequest(
      `${CONFIG.workerUrl}/api/auth/request-otp`,
      {
        method: 'POST',
        body: {
          email: CONFIG.email,
          password: CONFIG.password,
        },
        cookieManager: cookieManager,
      }
    );

    cookieManager.setFromResponse(response);
    const data = response.json();
    
    if (response.statusCode === 200 && data?.success) {
      console.log(`✅ OTP requested successfully`);
      console.log(`   User ID: ${data.userId}`);
      return data;
    } else {
      console.error('❌ Failed to request OTP');
      console.error('   Full response:', response.body);
      return null;
    }
  } catch (error) {
    console.error('🔥 Request failed:', error.message);
    return null;
  }
}

async function verifyOTP(cookieManager, userId, otpCode) {
  console.log('\n========================================');
  console.log('🔐 STEP 2: Verifying OTP');
  console.log('========================================');

  try {
    const response = await makeRequest(
      `${CONFIG.workerUrl}/api/auth/verify-otp`,
      {
        method: 'POST',
        body: {
          userId: userId,
          otp: otpCode,
          fingerprint: CONFIG.fingerprint,
        },
        cookieManager: cookieManager,
      }
    );

    cookieManager.setFromResponse(response);
    const data = response.json();
    
    if (response.statusCode === 200 && data?.success) {
      console.log(`✅ OTP verified successfully`);
      console.log(`   Role: ${data.role || 'unknown'}`);
      return data;
    } else {
      console.error('❌ Failed to verify OTP');
      console.error('   Full response:', response.body);
      return null;
    }
  } catch (error) {
    console.error('🔥 Request failed:', error.message);
    return null;
  }
}

async function checkAuth(cookieManager) {
  console.log('\n========================================');
  console.log('🔍 STEP 3: Checking authentication');
  console.log('========================================');

  try {
    const response = await makeRequest(
      `${CONFIG.workerUrl}/api/auth/check`,
      {
        method: 'GET',
        cookieManager: cookieManager,
      }
    );

    const data = response.json();
    
    if (response.statusCode === 200 && data?.authenticated) {
      console.log(`✅ Authenticated as: ${data.role}`);
      return data;
    } else {
      console.error('❌ Not authenticated');
      console.error('   Response:', response.body);
      return null;
    }
  } catch (error) {
    console.error('🔥 Request failed:', error.message);
    return null;
  }
}

async function sendDeployLog(cookieManager, logData) {
  console.log('\n========================================');
  console.log('🚀 STEP 4: Sending deploy log');
  console.log('========================================');

  try {
    const response = await makeRequest(
      `${CONFIG.workerUrl}/api/deploy/log`,
      {
        method: 'POST',
        body: logData,
        cookieManager: cookieManager,
      }
    );

    const data = response.json();
    
    if (response.statusCode === 200) {
      console.log(`✅ Deploy log sent successfully`);
      console.log(`   Response:`, data);
      return data;
    } else {
      console.error('❌ Failed to send deploy log');
      console.error('   Full response:', response.body);
      return null;
    }
  } catch (error) {
    console.error('🔥 Request failed:', error.message);
    return null;
  }
}

async function getOTPFromUser() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\n📱 Enter the OTP code you received: ', (code) => {
      rl.close();
      resolve(code.trim());
    });
  });
}

// ============================================
// MAIN AUTHENTICATION FLOW
// ============================================
async function authenticate() {
  console.log('\n========================================');
  console.log('🔐 STARTING AUTHENTICATION FLOW');
  console.log('========================================');
  
  const cookieManager = new CookieManager(CONFIG.cookieFile);
  
  // Check if already authenticated
  if (cookieManager.hasAuthCookie()) {
    console.log('\n🍪 Found existing auth cookie, checking validity...');
    const authCheck = await checkAuth(cookieManager);
    if (authCheck?.authenticated) {
      console.log('✅ Already authenticated!');
      return { success: true, cookieManager };
    } else {
      console.log('⚠️  Cookie expired or invalid, re-authenticating...');
      cookieManager.clear();
    }
  }

  // STEP 1: Request OTP
  const otpRequest = await requestOTP(cookieManager);
  if (!otpRequest?.userId) {
    console.error('\n❌ Authentication failed at OTP request stage');
    return { success: false, cookieManager };
  }

  // Wait for OTP to be sent
  console.log('\n⏳ Waiting 3 seconds for OTP delivery...');
  await sleep(3000);

  // STEP 2: Get OTP from user
  console.log('\n📱 Ready for OTP input...');
  const otpCode = await getOTPFromUser();
  console.log(`   Received OTP: ${otpCode}`);

  // STEP 3: Verify OTP
  const verifyResult = await verifyOTP(cookieManager, otpRequest.userId, otpCode);
  if (!verifyResult?.success) {
    console.error('\n❌ Authentication failed at OTP verification stage');
    return { success: false, cookieManager };
  }

  // STEP 4: Check final auth status
  const authCheck = await checkAuth(cookieManager);
  if (!authCheck?.authenticated) {
    console.error('\n❌ Authentication failed - final check failed');
    return { success: false, cookieManager };
  }

  if (authCheck.role !== 'admin') {
    console.error(`\n⚠️  Authenticated but role is "${authCheck.role}" (needs "admin")`);
    return { success: false, cookieManager };
  }

  console.log('\n========================================');
  console.log('✅ FULL AUTHENTICATION SUCCESSFUL!');
  console.log('========================================');
  
  return { success: true, cookieManager };
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main() {
  console.log('\n🚀 Main function starting...\n');
  
  try {
    const auth = await authenticate();
    
    if (!auth.success) {
      console.error('\n❌ Authentication failed. Exiting.');
      process.exit(1);
    }

    console.log('\n📤 Preparing to send deploy log...');
    
    const logData = {
      type: 'deploy',
      status: 'success',
      message: 'Deployment completed - JWT auth working!',
      timestamp: new Date().toISOString(),
    };

    const result = await sendDeployLog(auth.cookieManager, logData);
    
    if (result) {
      console.log('\n========================================');
      console.log('🎉 COMPLETE FLOW WORKED PERFECTLY!');
      console.log('========================================');
      console.log('   ✅ JWT Authentication');
      console.log('   ✅ Cookie management');
      console.log('   ✅ Deploy API call');
      console.log('\n💡 Cookies saved to:', CONFIG.cookieFile);
    }

  } catch (error) {
    console.error('\n🔥 FATAL ERROR:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// ============================================
// RUN IMMEDIATELY
// ============================================
console.log('\n📌 About to call main()...\n');

main().catch(error => {
  console.error('💥 Unhandled error in main():', error);
  process.exit(1);
});

console.log('📌 After main() call - waiting for async operations...\n');

