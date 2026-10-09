// test-admin.js
const ADMIN_EMAIL = "f.e.amenaghawon@gmail.com";
const ADMIN_PASSWORD = "1234And56789$Admin"; // Change this to your actual password

async function testAdminAuth() {
  try {
    console.log("🔐 Testing admin login...");
    
    // Login
    const loginRes = await fetch("https://api.primeshieldhub.com/api/auth/admin-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD
      })
    });
    
    const loginData = await loginRes.json();
    console.log("Login response:", loginData);
    
    if (!loginData.session) {
      console.log("❌ Login failed - no token received");
      console.log("Check admin credentials in the database");
      return;
    }
    
    const token = loginData.token;
    console.log("✅ Token received:", token.substring(0, 30) + "...");
    console.log("User data:", loginData.user);
    
    // Test admin check
    console.log("\n🔍 Testing admin-check...");
    const checkRes = await fetch("https://api.primeshieldhub.com/api/auth/admin-check", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const checkData = await checkRes.json();
    console.log("Admin check:", checkData);
    
    // Test stats endpoint
    console.log("\n📊 Testing stats endpoint...");
    const statsRes = await fetch("https://api.primeshieldhub.com/api/admin/stats", {
      headers: { "Authorization": `Bearer ${token}` }
    });
    const statsData = await statsRes.json();
    console.log("Stats response:", statsData);
    
    if (statsData.error) {
      console.log("❌ Stats endpoint error:", statsData.error);
      console.log("Check the admin handler authentication");
    } else if (statsData.orders || statsData.customers) {
      console.log("✅ Stats endpoint working!");
    }
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

testAdminAuth();
