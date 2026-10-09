import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import readline from 'readline';

console.log('========================================');
console.log('🔐 COMPLETE AUTHENTICATION');
console.log('========================================');

const CONFIG = {
  workerUrl: 'https://primeshieldhub-production.primeshieldhub-a74.workers.dev',
  email: 'primeshieldhub@gmail.com',
  password: '1234And56789$Admin',
  fingerprint: crypto.randomBytes(16).toString('hex'),
  cookieFile: './auth-cookies.json',
  userId: 'aed571a0-a848-49f3-8363-60b3d5a6c000', // From your successful request
};

console.log('Email:', CONFIG.email);
console.log('User ID:', CONFIG.userId);
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
        'User-Agent': 'Mozilla/5.0',
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

async function verifyOTP(cookieManager, otpCode) {
  console.log('\n🔐 Verifying OTP...');

  const response = await makeRequest(
    `${CONFIG.workerUrl}/api/auth/verify-otp`,
    {
      method: 'POST',
      body: {
        userId: CONFIG.userId,
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
    console.log('Token received!');
    return data;
  } else {
    console.error('❌ Failed:', response.body);
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
        message: 'Authentication successful!',
        timestamp: new Date().toISOString(),
      },
      cookieManager: cookieManager,
    }
  );

  const data = response.json();
  
  if (response.statusCode === 200) {
    console.log('✅ Deploy log sent!');
    console.log('Response:', data);
    return data;
  } else {
    console.error('❌ Failed:', response.body);
    return null;
  }
}

async function getOTPFromUser() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    rl.question('\n📱 Enter the OTP code from your email: ', (code) => {
      rl.close();
      resolve(code.trim());
    });
  });
}

async function main() {
  const cookieManager = new CookieManager(CONFIG.cookieFile);
  
  // Get OTP from user
  const otpCode = await getOTPFromUser();
  
  // Verify OTP
  const verifyResult = await verifyOTP(cookieManager, otpCode);
  if (!verifyResult?.success) {
    console.error('\n❌ OTP verification failed');
    process.exit(1);
  }
  
  // Send deploy log
  const deployResult = await sendDeployLog(cookieManager);
  
  if (deployResult) {
    console.log('\n🎉 COMPLETE!');
    console.log('✅ Authenticated successfully');
    console.log('✅ Deploy log sent');
    console.log('💾 Cookies saved to:', CONFIG.cookieFile);
    console.log('\nNext time, just run: node auth-deploy.js');
  }
}

main().catch(console.error);

