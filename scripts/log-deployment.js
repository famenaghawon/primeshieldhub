// scripts/log-deployment.js
// Logs deployment to /api/deploy/log with proper authentication
// Usage: node scripts/log-deployment.js <backend|frontend>

import { createHash, randomUUID } from 'crypto';

const DEPLOY_TYPE = process.argv[2] || 'backend';
const API_URL = 'https://primeshieldhub.com/api/deploy/log';

// Configuration – set these in your environment or .env file
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const GATEWAY_SECRET = process.env.GATEWAY_SECRET;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !GATEWAY_SECRET) {
  console.error('❌ Missing required environment variables: ADMIN_EMAIL, ADMIN_PASSWORD, GATEWAY_SECRET');
  process.exit(1);
}

// Generate a simple device fingerprint for the deployment script
function generateFingerprint() {
  return createHash('sha256')
    .update(`${process.cwd()}-${process.platform}-${Date.now()}`)
    .digest('hex')
    .substring(0, 32);
}

// Base64url encoding (JWT compatible)
function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// HMAC signing
async function signRaw(data, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return base64url(String.fromCharCode(...new Uint8Array(signature)));
}

// Generate JWT for authentication
async function generateJWT(payload, secret) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify(payload));
  const signature = await signRaw(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

// Generate integrity token for API call
async function generateIntegrityToken(path, fingerprint, ip, secret) {
  const uaHash = createHash('sha256')
    .update('PrimeShieldHub-DeployScript/9.0')
    .digest('hex')
    .substring(0, 16);

  const payload = {
    ts: Date.now(),
    expiry: 120,
    nonce: randomUUID(),
    fingerprint,
    ip: ip || '127.0.0.1',
    path,
    method: 'POST',
    uaHash,
    origin: 'https://primeshieldhub.com',
    csrf: randomUUID()
  };

  const signature = await signRaw(JSON.stringify(payload), secret);
  return { payload, signature };
}

async function login() {
  const fingerprint = generateFingerprint();

  // Step 1: Request OTP
  console.log('🔐 Authenticating...');
  const otpRes = await fetch('https://primeshieldhub.com/api/auth/request-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-fingerprint': fingerprint
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    })
  });

  const otpData = await otpRes.json();
  if (!otpData.success) {
    throw new Error(`OTP request failed: ${otpData.error}`);
  }

  console.log('📧 OTP sent to your email/phone. Enter the code:');
  
  // Wait for OTP input
  const otp = await new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });

  // Step 2: Verify OTP
  const verifyRes = await fetch('https://primeshieldhub.com/api/auth/verify-otp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-fingerprint': fingerprint
    },
    body: JSON.stringify({
      userId: otpData.userId,
      otp,
      fingerprint
    })
  });

  const verifyData = await verifyRes.json();
  if (!verifyData.success) {
    throw new Error(`OTP verification failed: ${verifyData.error}`);
  }

  // Extract cookie from response
  const cookies = verifyRes.headers.get('set-cookie');
  const authCookie = cookies?.match(/auth=([^;]+)/)?.[1];

  if (!authCookie) {
    throw new Error('No auth cookie received');
  }

  console.log('✅ Authenticated successfully');
  return { authCookie, fingerprint };
}

async function logDeployment() {
  try {
    // Login and get auth cookie
    const { authCookie, fingerprint } = await login();

    // Generate integrity token
    const { payload, signature } = await generateIntegrityToken(
      '/api/deploy/log',
      fingerprint,
      '127.0.0.1',
      GATEWAY_SECRET
    );

    // Log deployment
    console.log(`🚀 Logging ${DEPLOY_TYPE} deployment...`);
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `auth=${authCookie}`,
        'x-integrity-token': JSON.stringify({ payload, signature }),
        'x-device-fingerprint': fingerprint,
        'x-csrf-token': payload.csrf
      },
      body: JSON.stringify({
        type: DEPLOY_TYPE,
        status: 'success',
        message: `${DEPLOY_TYPE.charAt(0).toUpperCase() + DEPLOY_TYPE.slice(1)} deployed successfully (v9.0)`
      })
    });

    const data = await response.json();
    if (data.success) {
      console.log(`✅ Deployment logged – Risk score: ${data.risk}/100`);
    } else {
      console.error('❌ Failed to log deployment:', data.error);
    }
  } catch (error) {
    console.error('❌ Deployment logging failed:', error.message);
    process.exit(1);
  }
}

logDeployment();

