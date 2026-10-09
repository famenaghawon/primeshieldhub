// final-fix.js - Last database fixes
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SQL_COMMANDS = [
  // Fix AI insights - add resolved column
  "ALTER TABLE anomaly_logs ADD COLUMN resolved INTEGER DEFAULT 0;",
  "ALTER TABLE anomaly_logs ADD COLUMN resolved_at DATETIME;",
  "ALTER TABLE anomaly_logs ADD COLUMN resolved_by TEXT;",
  
  // Add more columns for AI insights
  "ALTER TABLE anomaly_logs ADD COLUMN severity_score INTEGER DEFAULT 0;",
  "ALTER TABLE anomaly_logs ADD COLUMN confidence REAL DEFAULT 0.5;",
  
  // Ensure charging_sessions has all needed columns
  "ALTER TABLE charging_sessions ADD COLUMN amount REAL DEFAULT 0;",
  "ALTER TABLE charging_sessions ADD COLUMN estimated_minutes INTEGER DEFAULT 60;",
  
  // Add indexes for performance
  "CREATE INDEX IF NOT EXISTS idx_anomaly_logs_resolved ON anomaly_logs(resolved);",
  "CREATE INDEX IF NOT EXISTS idx_anomaly_logs_severity_score ON anomaly_logs(severity_score);",
];

async function runFixes() {
  console.log('🔧 Applying final database fixes...\n');
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const sql of SQL_COMMANDS) {
    try {
      const cleanSql = sql.replace(/"/g, '\\"');
      console.log(`📝 ${sql.substring(0, 70)}...`);
      
      const { stdout, stderr } = await execAsync(
        `npx wrangler d1 execute primeshieldhub-db --remote --command="${cleanSql}"`
      );
      
      if (stderr && (stderr.includes('already exists') || stderr.includes('duplicate column'))) {
        console.log('   ℹ️ Already exists (skipped)');
        skipped++;
      } else if (stdout && stdout.includes('Error')) {
        console.log(`   ⚠️ ${stdout.trim().substring(0, 80)}`);
        failed++;
      } else {
        console.log('   ✅ Success');
        success++;
      }
    } catch (error) {
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate column') ||
          error.message.includes('SQLITE_ERROR')) {
        console.log('   ℹ️ Already exists or table missing (skipped)');
        skipped++;
      } else {
        console.log(`   ❌ ${error.message.substring(0, 80)}`);
        failed++;
      }
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Results:`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ℹ️ Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (failed === 0) {
    console.log('\n🎉 All fixes applied successfully!');
    console.log('📝 Next steps:');
    console.log('   1. Fix charging handler data types in src/handlers/charging.js');
    console.log('   2. Update the test in verify-api.js for reseller-codes');
    console.log('   3. Run: npx wrangler deploy');
    console.log('   4. Run: node verify-api.js');
  } else {
    console.log(`\n⚠️ ${failed} fixes failed. You may need to run them manually.`);
  }
}

runFixes();
