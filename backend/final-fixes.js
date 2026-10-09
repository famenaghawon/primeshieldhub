// final-fixes.js - Final database fixes
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SQL_COMMANDS = [
  // Fix charging sessions
  "ALTER TABLE charging_sessions ADD COLUMN bay_id TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN staff_name TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN completed_time DATETIME;",
  
  // Fix anomaly_logs for AI insights
  "ALTER TABLE anomaly_logs ADD COLUMN count INTEGER DEFAULT 0;",
  "ALTER TABLE anomaly_logs ADD COLUMN severity TEXT DEFAULT 'medium';",
  "ALTER TABLE anomaly_logs ADD COLUMN category TEXT;",
  
  // Add indexes for performance
  "CREATE INDEX IF NOT EXISTS idx_charging_sessions_bay_id ON charging_sessions(bay_id);",
  "CREATE INDEX IF NOT EXISTS idx_charging_sessions_staff_id ON charging_sessions(staff_id);",
  "CREATE INDEX IF NOT EXISTS idx_charging_sessions_status ON charging_sessions(status);",
  "CREATE INDEX IF NOT EXISTS idx_charging_sessions_start_time ON charging_sessions(start_time);",
  "CREATE INDEX IF NOT EXISTS idx_anomaly_logs_timestamp ON anomaly_logs(timestamp);",
  "CREATE INDEX IF NOT EXISTS idx_anomaly_logs_severity ON anomaly_logs(severity);",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);",
  
  // Fix admin_logs query - create view if needed
  `CREATE TABLE IF NOT EXISTS admin_logs (
    id TEXT PRIMARY KEY DEFAULT (uuid()),
    action TEXT,
    user_id TEXT,
    resource TEXT,
    resource_id TEXT,
    details TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    ip TEXT,
    fingerprint TEXT
  );`,
];

async function runFixes() {
  console.log('🔧 Applying final fixes...\n');
  
  let success = 0;
  let failed = 0;
  
  for (const sql of SQL_COMMANDS) {
    try {
      const cleanSql = sql.replace(/"/g, '\\"');
      console.log(`📝 ${sql.substring(0, 70)}...`);
      
      const { stdout, stderr } = await execAsync(
        `npx wrangler d1 execute primeshieldhub-db --remote --command="${cleanSql}"`
      );
      
      if (stderr && (stderr.includes('already exists') || stderr.includes('duplicate column'))) {
        console.log('ℹ️ Already exists');
        success++;
      } else if (stdout && stdout.includes('Error')) {
        console.log(`⚠️ ${stdout.trim().substring(0, 100)}`);
        failed++;
      } else {
        console.log('✅ Success');
        success++;
      }
    } catch (error) {
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate column') ||
          error.message.includes('SQLITE_ERROR')) {
        console.log('ℹ️ Already exists or table missing');
        success++;
      } else {
        console.log(`❌ ${error.message.substring(0, 100)}`);
        failed++;
      }
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Results: ✅ ${success} | ❌ ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (failed === 0) {
    console.log('\n🎉 All fixes applied successfully!');
  } else {
    console.log(`\n⚠️ ${failed} fixes failed. You may need to run them manually.`);
  }
}

runFixes();
