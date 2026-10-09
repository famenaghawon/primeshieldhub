import crypto from 'crypto';

const WORKER_URL = 'https://primeshieldhub-production-production.primeshieldhub-a74.workers.dev';
const fingerprint = crypto.randomBytes(16).toString('hex');

async function test() {
  console.log('Testing authentication...');
  console.log('Fingerprint:', fingerprint);
  
  try {
    const response = await fetch(`${WORKER_URL}/api/auth/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': fingerprint,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: JSON.stringify({
        email: 'primeshieldhub@gmail.com',
        password: '1234And56789$Admin'
      })
    });
    
    const text = await response.text();
    console.log('Status:', response.status);
    console.log('Response:', text);
    
    if (text.includes('challenge')) {
      console.log('\n⚠️ Challenge detected - need to solve it first');
      const match = text.match(/const challenge = "([^"]+)"/);
      if (match) {
        console.log('Challenge ID:', match[1]);
      }
    }
    
    try {
      const json = JSON.parse(text);
      if (json.success) {
        console.log('\n✅ SUCCESS! User ID:', json.userId);
      }
    } catch (e) {
      console.log('Response is not JSON (HTML challenge page)');
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();

