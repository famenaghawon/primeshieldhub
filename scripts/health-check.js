// scripts/health-check.js
// Quick health check for the deployed system

const API_URL = 'https://primeshieldhub.com/api/_health';

async function healthCheck() {
  console.log('🏥 Checking PrimeShieldHub system health...\n');
  
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    
    console.log(`📊 Status: ${data.status}`);
    console.log(`🌍 Region: ${data.region}`);
    console.log(`🗄️  D1 Connected: ${data.d1_connected ? '✅' : '❌'}`);
    console.log(`📦 R2 Connected: ${data.r2_connected ? '✅' : '❌'}`);
    console.log(`⏰ Timestamp: ${new Date(data.timestamp).toLocaleString()}`);
    
    if (data.status === 'ok' && data.d1_connected && data.r2_connected) {
      console.log('\n✅ System is healthy');
      process.exit(0);
    } else {
      console.log('\n⚠️  System has issues');
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ Health check failed: ${error.message}`);
    process.exit(1);
  }
}

healthCheck();

