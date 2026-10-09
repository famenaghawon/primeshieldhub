import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import readline from 'readline';

console.log('========================================');
console.log('🔐 FULL AUTHENTICATION (SINGLE FINGERPRINT)');
console.log('========================================');

const CONFIG = {
  workerUrl: 'https://primeshieldhub-production.primeshieldhub-a74.workers.dev',
  email: 'test@simple.com',
  password: 'admin123',
  cookieFile: './auth-cookies.json',
  fingerprintFile: './fingerprint.json',
};

// Load or create fingerprint
function getFingerprint() {
  try {
    if (fs.existsSync(CONFIG.fingerprintFile)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.fingerprintFile, 'utf8'));
      console.log('🔑 Loaded existing fingerprint');
      return data.fingerprint;
    }
  } catch (err) {}
  
  const newFingerprint = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(CONFIG.fingerprintFile, JSON.stringify({ fingerprint: newFingerprint }));
  console.log('🔑 Created new fingerprint');
  return newFingerprint;
}

const FINGERPRINT = getFingerprint();
CONFIG.fingerprint = FINGERPRINT;

console.log('Email:', CONFIG.email);
console.log('Fingerprint:', CONFIG.fingerprint);

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
        console.log('🍪 Loaded cookies');
      }
    } catch (err) {}
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
        console.log('🍪 Cookie:', name);
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
    console.log('🗑️ Cookies cleared');
  }
}

async function makeRequest(url, options = {}) {
  const urlObj = new URL(url);
  
  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': CONFIG.fingerprint,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Origin': 'https://primeshieldhub.com',
        ...options.headers,
      },
    };

    if (options.cookieManager) {
      const cookieHeader = options.cookieManager.getCookieHeader();
      if (cookieHeader) {
        requestOptions.headers['Cookie'] = cookieHeader;
      }
    }

    const req = https.request(requestOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          json: () => {
            try { return JSON.parse(body); } catch { return null; }
          }
        });
      });
    });

    req.on('error', reject);
    if (options.body) req.write(JSON.stringify(options.body));
    req.end();
  });
}

async function solveChallenge(cookieManager, htmlBody) {
  console.log('\n🧩 Solving challenge...');
  
  const match = htmlBody.match(/const challenge = "([^"]+)"/);
  if (!match) {
    console.error('No challenge found');
    return false;
  }
  
  const challenge = match[1];
  console.log('Challenge:', challenge);
  
  const response = await makeRequest(
    `${CONFIG.workerUrl}/api/verify-browser`,
    {
      method: 'POST',
      body: { challenge },
      cookieManager: cookieManager,
      headers: {
        'Origin': 'https://primeshieldhub.com',
      }
    }
  );
  
  cookieManager.setFromResponse(response);
  return response.statusCode === 200;
}

async function requestOTP(cookieManager) {
  console.log('\n📧 Requesting OTP...');

  let response = await makeRequest(
    `${CONFIG.workerUrl}/api/auth/request-otp`,
    {
      method: 'POST',
      body: { email: CONFIG.email, password: CONFIG.password },
      cookieManager: cookieManager,
    }
  );

  cookieManager.setFromResponse(response);

  if (response.statusCode === 403 && response.body.includes('challenge')) {
    const solved = await solveChallenge(cookieManager, response.body);
    if (!solved) return null;
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log('Retrying OTP request...');
    response = await makeRequest(
      `${CONFIG.workerUrl}/api/auth/request-otp`,
      {
        method: 'POST',
        body: { email: CONFIG.email, password: CONFIG.password },
        cookieManager: cookieManager,
      }
    );
    
    cookieManager.setFromResponse(response);
  }

  const data = response.json();
  
  if (response.statusCode === 200 && data?.success) {
    console.log('✅ OTP requested! User ID:', data.userId);
    return data;
  } else {
    console.error('❌ Failed:', response.body);
    return null;
  }
}

async function verifyOTP(cookieManager, userId, otpCode) {
  console.log('\n🔐 Verifying OTP...');

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
    console.log('✅ OTP verified!');
    console.log('Role:', data.role);
    return data;
  } else {
    console.error('❌ Failed:', response.body);
    return null;
  }
}

async function checkAuth(cookieManager) {
  const response = await makeRequest(
    `${CONFIG.workerUrl}/api/auth/check`,
    {
      method: 'GET',
      cookieManager: cookieManager,
    }
  );

  const data = response.json();
  
  if (response.statusCode === 200 && data?.authenticated) {
    return data;
  } else {
    return null;
  }
}

async function sendDeployLog(cookieManager) {
  console.log('\n🚀 Sending deploy log...');

  const response = await makeRequest(
    `${CONFIG.workerUrl}/api/deploy/log`,
    {
      method: 'POST',
      body: {
        type: 'deploy',
        status: 'success',
        message: 'Deployment completed successfully!',
        timestamp: new Date().toISOString(),
      },
      cookieManager: cookieManager,
      headers: {
        'x-device-fingerprint': CONFIG.fingerprint,
      }
    }
  );

  const data = response.json();
  
  if (response.statusCode === 200) {
    console.log('✅ Deploy log sent successfully!');
    console.log('Response:', JSON.stringify(data, null, 2));
    return data;
  } else {
    console.error('❌ Failed to send deploy log');
    console.error('   Status:', response.statusCode);
    console.error('   Response:', response.body);
    return null;
  }
}

async function getOTPFromUser() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\n📱 Enter OTP from database: ', (code) => {
      rl.close();
      resolve(code.trim());
    });
  });
}

async function main() {
  const cookieManager = new CookieManager(CONFIG.cookieFile);
  
  // Check if already authenticated
  if (cookieManager.hasAuthCookie()) {
    console.log('\n🍪 Found existing auth cookie, checking validity...');
    const authCheck = await checkAuth(cookieManager);
    if (authCheck?.authenticated) {
      console.log('✅ Already authenticated as:', authCheck.role);
      
      // Send deploy log
      const deployResult = await sendDeployLog(cookieManager);
      if (deployResult) {
        console.log('\n🎉 Deploy log sent successfully!');
      }
      return;
    } else {
      console.log('⚠️ Cookie expired or invalid, re-authenticating...');
      cookieManager.clear();
    }
  }
  
  // Step 1: Request OTP
  const otpResult = await requestOTP(cookieManager);
  if (!otpResult?.userId) {
    console.error('Failed to request OTP');
    process.exit(1);
  }
  
  const userId = otpResult.userId;
  
  // Step 2: Get fresh OTP from database
  console.log('\n📋 Run this in another terminal:');
  console.log(`npx wrangler d1 execute primeshieldhub-db --command "SELECT code FROM otp_codes WHERE user_id = '${userId}' ORDER BY created_at DESC LIMIT 1;" --remote`);
  
  const otpCode = await getOTPFromUser();
  
  // Step 3: Verify OTP
  const verifyResult = await verifyOTP(cookieManager, userId, otpCode);
  if (!verifyResult?.success) {
    console.error('OTP verification failed');
    process.exit(1);
  }
  
  // Step 4: Send deploy log
  const deployResult = await sendDeployLog(cookieManager);
  
  if (deployResult) {
    console.log('\n🎉 COMPLETE SUCCESS!');
    console.log('💾 Cookies saved to:', CONFIG.cookieFile);
    console.log('🔑 Fingerprint saved to:', CONFIG.fingerprintFile);
    console.log('\n✅ You are now fully authenticated!');
    console.log('📤 Deploy log sent successfully!');
    console.log('\n💡 Next time, just run this script again - it will reuse the saved cookie AND fingerprint!');
  } else {
    console.error('\n⚠️ Authentication worked but deploy log failed.');
    console.error('Check the response above for details.');
  }
}

main().catch(console.error);

