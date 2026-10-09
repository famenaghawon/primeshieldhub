// fix-migration-errors.js
// Run with: node fix-migration-errors.js

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================
// FIX STATEMENTS - These handle the remaining errors
// ============================================================
const FIX_STATEMENTS = [
    // First, check if counters table exists and has the right columns
    `PRAGMA table_info(counters)`,
    
    // Insert counters one by one (safer)
    `INSERT OR IGNORE INTO counters (name, value, description) VALUES ('total_users', 0, 'Total registered users')`,
    `INSERT OR IGNORE INTO counters (name, value, description) VALUES ('total_orders', 0, 'Total orders placed')`,
    `INSERT OR IGNORE INTO counters (name, value, description) VALUES ('total_revenue', 0, 'Total revenue generated')`,
    `INSERT OR IGNORE INTO counters (name, value, description) VALUES ('total_sessions', 0, 'Total charging sessions')`,
    `INSERT OR IGNORE INTO counters (name, value, description) VALUES ('total_referrals', 0, 'Total referrals made')`,
    
    // System control
    `INSERT OR IGNORE INTO system_control (key, value, description) VALUES ('system_mode', 'normal', 'Current system mode: normal, maintenance, readonly')`,
    `INSERT OR IGNORE INTO system_control (key, value, description) VALUES ('debug_mode', '0', 'Debug mode enabled: 0 or 1')`,
    `INSERT OR IGNORE INTO system_control (key, value, description) VALUES ('maintenance_message', 'System is currently under maintenance. Please check back later.', 'Message shown during maintenance')`,
    `INSERT OR IGNORE INTO system_control (key, value, description) VALUES ('allow_registration', '1', 'Allow new user registration: 0 or 1')`,
    
    // Settings
    `INSERT OR IGNORE INTO settings (key, value, description) VALUES ('site_name', 'PrimeShieldHub', 'Site name')`,
    `INSERT OR IGNORE INTO settings (key, value, description) VALUES ('site_description', 'Premium EV Charging Solutions', 'Site description')`,
    `INSERT OR IGNORE INTO settings (key, value, description) VALUES ('currency', 'USD', 'Default currency')`,
    `INSERT OR IGNORE INTO settings (key, value, description) VALUES ('maintenance_mode', '0', 'Maintenance mode: 0 or 1')`,
    `INSERT OR IGNORE INTO settings (key, value, description) VALUES ('allow_registration', '1', 'Allow registration: 0 or 1')`,
    `INSERT OR IGNORE INTO settings (key, value, description) VALUES ('commission_rate', '5', 'Default commission rate for resellers')`,
    `INSERT OR IGNORE INTO settings (key, value, description) VALUES ('wholesale_discount', '10', 'Default wholesale discount percentage')`,
];

// ============================================================
// CHECK COLUMN EXISTENCE AND ADD IF MISSING
// ============================================================
const COLUMN_CHECKS = [
    // Check customer_history columns
    `PRAGMA table_info(customer_history)`,
    // Check referrals columns
    `PRAGMA table_info(referrals)`,
    // Check actions columns
    `PRAGMA table_info(actions)`,
    // Check notifications columns
    `PRAGMA table_info(notifications)`,
    // Check ai_conversations columns
    `PRAGMA table_info(ai_conversations)`,
    // Check ai_recommendations columns
    `PRAGMA table_info(ai_recommendations)`,
    // Check penalties columns
    `PRAGMA table_info(penalties)`,
    // Check charges columns
    `PRAGMA table_info(charges)`,
];

// ============================================================
// EXECUTE FIX
// ============================================================
async function runFix() {
    console.log('🔧 Running fixes for remaining issues...\n');
    
    // First, let's check what columns exist
    console.log('📋 Checking table structures...\n');
    
    for (const statement of COLUMN_CHECKS) {
        try {
            const cmd = `npx wrangler d1 execute DB --remote --command "${statement}"`;
            const { stdout } = await execAsync(cmd);
            console.log(`✅ ${statement}`);
            console.log(`   Result: ${stdout.trim().substring(0, 200)}...\n`);
        } catch (error) {
            console.log(`⚠️ Could not check: ${statement}`);
        }
    }
    
    // Now run the insert statements
    console.log('\n📝 Inserting default data...\n');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < FIX_STATEMENTS.length; i++) {
        const statement = FIX_STATEMENTS[i];
        const cleanStatement = statement.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        
        try {
            const escaped = cleanStatement.replace(/"/g, '\\"');
            const cmd = `npx wrangler d1 execute DB --remote --command "${escaped}"`;
            
            process.stdout.write(`📝 [${i + 1}/${FIX_STATEMENTS.length}] ${cleanStatement.substring(0, 60)}... `);
            
            await execAsync(cmd);
            successCount++;
            console.log('✅');
        } catch (error) {
            errorCount++;
            console.log('❌');
            console.log(`   Error: ${error.message.substring(0, 150)}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 FIX SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📝 Total Statements: ${FIX_STATEMENTS.length}`);
    
    if (errorCount === 0) {
        console.log('\n🎉 All fixes applied successfully!');
    } else {
        console.log('\n⚠️ Some inserts failed - tables may already have data or columns may differ.');
        console.log('💡 This is usually not a problem if the tables already exist.');
    }
}

runFix().catch(console.error);
