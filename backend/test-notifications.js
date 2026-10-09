// test-notifications.js
const CONFIG = {
  apiBase: 'https://api.primeshieldhub.com',
  email: 'f.e.amenaghawon@gmail.com',
  password: '1234And56789$Admin'
};

async function test() {
  console.log('🔑 Logging in...');
  
  // Login
  const loginRes = await fetch(CONFIG.apiBase + '/api/auth/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CONFIG.email, password: CONFIG.password })
  });
  
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  console.log('Login response:', JSON.stringify(loginData).substring(0, 200));
  
  if (!loginData.token) {
    console.log('❌ Login failed - no token');
    return;
  }
  
  const token = loginData.token;
  console.log('✅ Token:', token.substring(0, 30) + '...');
  
  // Test notifications
  console.log('\n📬 Testing /api/notifications...');
  const notifRes = await fetch(CONFIG.apiBase + '/api/notifications', {
    headers: { 
      'Authorization': 'Bearer ' + token, 
      'Content-Type': 'application/json' 
    }
  });
  
  const notifData = await notifRes.text();
  console.log('Status:', notifRes.status);
  console.log('Response:', notifData.substring(0, 500));
  
  // Try to parse if JSON
  try {
    const parsed = JSON.parse(notifData);
    console.log('Parsed:', JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('(Not JSON)');
  }
}

test().catch(e => console.error('Error:', e.message));
