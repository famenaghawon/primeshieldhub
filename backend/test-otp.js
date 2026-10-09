// test-otp.js
async function test() {
  // Step 1: Requaa	est OTP
  const otpReq = await fetch('https://api.primeshieldhub.com/api/auth/request-otp', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({email:'savfluxceo@gmail.com', password:1234And56789$Admin'})
  });
  const otpData = await otpReq.json();
  console.log('OTP Request Response:', JSON.stringify(otpData, null, 2));
  
  if (otpData.userId) {
    console.log('\n✅ UserID obtained:', otpData.userId);
    console.log('\nRun this command to get the OTP:');
    console.log('npx wrangler d1 execute primeshieldhub-db --remote --command="SELECT code, created_at FROM otp_codes WHERE user_id=\'' + otpData.userId + '\' ORDER BY created_at DESC LIMIT 1;"');
  }
}

test().catch(e => console.error(e));
