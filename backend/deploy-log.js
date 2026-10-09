import fetch from 'node-fetch';

// ===== CONFIGURATION =====
const CONFIG = {
  workerUrl: 'https://primeshieldhub-production.primeshieldhub-a74.workers.dev',
  fingerprint: 'device_12345678901234567890123456789012', // Must match what you use everywhere
  email: 'test@simple.com',      // Replace with your admin email
  password: 'admin123', // Replace with admin password
  // D1 credentials for OTP auto-fetch
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  d1DatabaseId: process.env.D1_DATABASE_ID,
};

// ===== HELPER: Fetch latest OTP from D1 =====
async function fetchLatestOTP(userId) {
  const query = `SELECT code FROM otp_codes WHERE user_id = '${userId}' AND verified = 0 ORDER BY created_at DESC LIMIT 1`;
  const url = `https://api.cloudflare.com/client/v4/accounts/${CONFIG.cloudflareAccountId}/d1/database/${CONFIG.d1DatabaseId}/query`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.cloudflareApiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: query }),
  });

  const data = await res.json();
  if (!data.success || !data.result[0]?.results?.length) {
    throw new Error('No valid OTP found in database');
  }
  return data.result[0].results[0].code;
}

// ===== STEP 1: Request OTP =====
async function requestOTP() {
  console.log('📨 Requesting OTP...');
  const res = await fetch(`${CONFIG.workerUrl}/api/auth/request-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-fingerprint': CONFIG.fingerprint,
    },
    body: JSON.stringify({
      email: CONFIG.email,
      password: CONFIG.password,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`OTP request failed: ${JSON.stringify(data)}`);
  }
  console.log('✅ OTP sent to email/phone');
  return data.userId;
}

// ===== STEP 2: Verify OTP (auto‑fetch from D1) =====
async function verifyOTP(userId) {
  console.log('🔍 Fetching OTP from D1...');
  const otp = await fetchLatestOTP(userId);
  console.log(`🔑 Got OTP: ${otp}`);

  const res = await fetch(`${CONFIG.workerUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-fingerprint': CONFIG.fingerprint,
    },
    body: JSON.stringify({
      userId,
      otp,
      fingerprint: CONFIG.fingerprint,
    }),
  });

  const data = await res.json();
  if (!data.success) {
    throw new Error(`OTP verification failed: ${JSON.stringify(data)}`);
  }

  const cookie = res.headers.get('set-cookie');
  if (!cookie) {
    throw new Error('No cookie received');
  }
  console.log('🍪 Auth cookie obtained');
  return cookie;
}

// ===== STEP 3: Send Deploy Log =====
async function sendDeployLog(cookie) {
  console.log('🚀 Sending deploy log...');
  const res = await fetch(`${CONFIG.workerUrl}/api/deploy/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-fingerprint': CONFIG.fingerprint,
      'Cookie': cookie,
    },
    body: JSON.stringify({
      type: 'deploy',
      status: 'success',
      message: 'Deployment completed successfully',
    }),
  });

  const text = await res.text();
  console.log('📦 Response:', text);
  if (!res.ok) {
    throw new Error(`Deploy log failed: ${res.status} ${text}`);
  }
  return text;
}

// ===== MAIN =====
async function main() {
  try {
    const userId = await requestOTP();
    const cookie = await verifyOTP(userId);
    await sendDeployLog(cookie);
    console.log('✅ All done!');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();

