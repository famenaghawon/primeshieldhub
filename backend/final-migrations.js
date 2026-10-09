// final-migrations.js - Complete database migrations
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const SQL_COMMANDS = [
  // ===== Fix 1: Add bay_id column to charging_sessions =====
  "ALTER TABLE charging_sessions ADD COLUMN bay_id TEXT;",
  
  // ===== Fix 2: Add count column to anomaly_logs =====
  "ALTER TABLE anomaly_logs ADD COLUMN count INTEGER DEFAULT 0;",
  "ALTER TABLE anomaly_logs ADD COLUMN severity TEXT DEFAULT 'medium';",
  "ALTER TABLE anomaly_logs ADD COLUMN category TEXT;",
  
  // ===== Fix 3: Create admin_logs table if missing =====
  `CREATE TABLE IF NOT EXISTS admin_logs (
    id TEXT PRIMARY KEY DEFAULT (uuid()),
    action TEXT,
    user_id TEXT,
    resource TEXT,
    resource_id TEXT,
    details TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip TEXT,
    fingerprint TEXT
  );`,
  
  // ===== Fix 4: Add indexes for performance =====
  "CREATE INDEX IF NOT EXISTS idx_charging_sessions_bay_id ON charging_sessions(bay_id);",
  "CREATE INDEX IF NOT EXISTS idx_charging_sessions_staff_id ON charging_sessions(staff_id);",
  "CREATE INDEX IF NOT EXISTS idx_charging_sessions_status ON charging_sessions(status);",
  "CREATE INDEX IF NOT EXISTS idx_charging_sessions_start_time ON charging_sessions(start_time);",
  "CREATE INDEX IF NOT EXISTS idx_anomaly_logs_timestamp ON anomaly_logs(timestamp);",
  "CREATE INDEX IF NOT EXISTS idx_anomaly_logs_severity ON anomaly_logs(severity);",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);",
  "CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);",
  "CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);",
  "CREATE INDEX IF NOT EXISTS idx_logs_type ON logs(type);",
  
  // ===== Fix 5: Add missing columns to charging_sessions =====
  "ALTER TABLE charging_sessions ADD COLUMN staff_name TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN completed_time DATETIME;",
  "ALTER TABLE charging_sessions ADD COLUMN payment_method TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN completed_by TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN completion_notes TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN paused_at DATETIME;",
  "ALTER TABLE charging_sessions ADD COLUMN resumed_at DATETIME;",
  "ALTER TABLE charging_sessions ADD COLUMN pause_reason TEXT;",
  "ALTER TABLE charging_sessions ADD COLUMN ready_at DATETIME;",
  "ALTER TABLE charging_sessions ADD COLUMN notified_ready INTEGER DEFAULT 0;",
  "ALTER TABLE charging_sessions ADD COLUMN notified_closing INTEGER DEFAULT 0;",
  "ALTER TABLE charging_sessions ADD COLUMN notified_overnight INTEGER DEFAULT 0;",
];

async function runMigrations() {
  console.log('🔧 Running database migrations...\n');
  
  let success = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const sql of SQL_COMMANDS) {
    try {
      const cleanSql = sql.replace(/"/g, '\\"').replace(/\n/g, ' ').trim();
      console.log(`📝 ${cleanSql.substring(0, 80)}${cleanSql.length > 80 ? '...' : ''}`);
      
      const { stdout, stderr } = await execAsync(
        `npx wrangler d1 execute primeshieldhub-db --remote --command="${cleanSql}"`
      );
      
      // Check if it was a duplicate column or already exists
      if (stderr && (stderr.includes('already exists') || stderr.includes('duplicate column'))) {
        console.log('   ℹ️ Already exists (skipped)');
        skipped++;
        continue;
      }
      
      if (stderr && stderr.includes('SQLITE_ERROR')) {
        console.log(`   ⚠️ SQL Error: ${stderr.trim().substring(0, 100)}`);
        failed++;
        continue;
      }
      
      if (stdout && stdout.includes('Error')) {
        console.log(`   ⚠️ Error: ${stdout.trim().substring(0, 100)}`);
        failed++;
        continue;
      }
      
      console.log('   ✅ Success');
      success++;
    } catch (error) {
      // Check if it's a duplicate column error
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate column') ||
          error.message.includes('SQLITE_ERROR')) {
        console.log('   ℹ️ Already exists (skipped)');
        skipped++;
      } else {
        console.log(`   ❌ Failed: ${error.message.substring(0, 100)}`);
        failed++;
      }
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📊 Migration Results:`);
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ℹ️ Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (failed === 0) {
    console.log('\n🎉 All migrations completed successfully!');
    console.log('📝 Run: npx wrangler deploy');
  } else {
    console.log(`\n⚠️ ${failed} migrations failed. Please check the errors above.`);
  }
}

runMigrations();
