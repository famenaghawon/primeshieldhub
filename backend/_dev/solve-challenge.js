import fs from 'fs';
import crypto from 'crypto';
import https from 'https';
import readline from 'readline';

console.log('========================================');
console.log('🔐 PRIMESHIELD CHALLENGE SOLVER');
console.log('========================================');

const CONFIG = {
  workerUrl: 'https://primeshieldhub-production.primeshieldhub-a74.workers.dev',
  email: 'primeshieldhub@gmail.com',
  password: 'Mustake0826)4',
  fingerprint: crypto.randomBytes(16).toString('hex'),
  cookieFile: './cookies.json',
};

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
        console.log('Cookie set:', name);
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
    }
  );
  
  cookieManager.setFromResponse(response);
  console.log('Challenge response:', response.statusCode);
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
    console.error('❌ Failed. Status:', response.statusCode);
    console.error('Response:', response.body);
    return null;
  }
}

async function main() {
  const cookieManager = new CookieManager(CONFIG.cookieFile);
  const result = await requestOTP(cookieManager);
  
  if (result) {
    console.log('\n✅ Ready for OTP verification!');
    console.log('User ID:', result.userId);
  }
}

main().catch(console.error);

