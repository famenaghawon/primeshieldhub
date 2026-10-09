// create-missing-tables-fixed.js
// Run with: node create-missing-tables-fixed.js

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

// ============================================================
// SQL STATEMENTS - Each statement as a single string WITHOUT comments
// ============================================================
const SQL_STATEMENTS = [
    // ========== STAFF TABLES ==========
    `CREATE TABLE IF NOT EXISTS staff_locations (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        staff_id TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id)
    )`,

    `CREATE TABLE IF NOT EXISTS staff_captures (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        staff_id TEXT NOT NULL,
        image_url TEXT NOT NULL,
        capture_type TEXT DEFAULT 'photo',
        metadata TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id)
    )`,

    `CREATE TABLE IF NOT EXISTS staff_logs (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        staff_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        ip TEXT,
        user_agent TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (staff_id) REFERENCES staff(id)
    )`,

    // ========== CUSTOMER TABLES ==========
    `CREATE TABLE IF NOT EXISTS customer_history (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        metadata TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS otp_codes (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        user_id TEXT NOT NULL,
        code TEXT NOT NULL,
        purpose TEXT DEFAULT 'verification',
        status TEXT DEFAULT 'active',
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS user_devices (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        user_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        device_type TEXT,
        os TEXT,
        browser TEXT,
        ip TEXT,
        last_active TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS referrals (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        referrer_id TEXT NOT NULL,
        referred_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        reward_amount REAL DEFAULT 0,
        reward_status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (referrer_id) REFERENCES users(id),
        FOREIGN KEY (referred_id) REFERENCES users(id)
    )`,

    // ========== SYSTEM TABLES ==========
    `CREATE TABLE IF NOT EXISTS pages (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        title TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        content TEXT,
        meta_title TEXT,
        meta_description TEXT,
        status TEXT DEFAULT 'draft',
        views INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        user_id TEXT,
        action_type TEXT NOT NULL,
        action_name TEXT NOT NULL,
        details TEXT,
        ip TEXT,
        user_agent TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        title TEXT NOT NULL,
        type TEXT DEFAULT 'info',
        message TEXT NOT NULL,
        severity TEXT DEFAULT 'low',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        recipient TEXT NOT NULL,
        subject TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT DEFAULT 'email',
        status TEXT DEFAULT 'pending',
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // ========== AI TABLES ==========
    `CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        user_id TEXT,
        session_id TEXT NOT NULL,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        context TEXT,
        message_count INTEGER DEFAULT 1,
        last_active TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS ai_recommendations (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        user_id TEXT,
        recommendation_type TEXT NOT NULL,
        recommendation TEXT NOT NULL,
        confidence REAL DEFAULT 0.5,
        status TEXT DEFAULT 'pending',
        viewed BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // ========== FINANCE TABLES ==========
    `CREATE TABLE IF NOT EXISTS commissions (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        reseller_id TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT DEFAULT 'referral',
        status TEXT DEFAULT 'pending',
        description TEXT,
        paid_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reseller_id) REFERENCES resellers(id)
    )`,

    `CREATE TABLE IF NOT EXISTS penalties (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        user_id TEXT,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'pending',
        paid BOOLEAN DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    `CREATE TABLE IF NOT EXISTS charges (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        user_id TEXT,
        charge_type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`,

    // ========== STATS TABLES ==========
    `CREATE TABLE IF NOT EXISTS counters (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        name TEXT UNIQUE NOT NULL,
        value INTEGER DEFAULT 0,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS daily_stats (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        date TEXT UNIQUE NOT NULL,
        users INTEGER DEFAULT 0,
        orders INTEGER DEFAULT 0,
        revenue REAL DEFAULT 0,
        sessions INTEGER DEFAULT 0,
        new_users INTEGER DEFAULT 0,
        active_users INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS deploy_logs (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        version TEXT NOT NULL,
        status TEXT DEFAULT 'success',
        details TEXT,
        deployed_by TEXT,
        timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS system_control (
        id TEXT PRIMARY KEY DEFAULT (uuid()),
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,

    // ========== INITIAL DATA ==========
    `INSERT OR IGNORE INTO counters (name, value, description) VALUES 
        ('total_users', 0, 'Total registered users'),
        ('total_orders', 0, 'Total orders placed'),
        ('total_revenue', 0, 'Total revenue generated'),
        ('total_sessions', 0, 'Total charging sessions'),
        ('total_referrals', 0, 'Total referrals made')`,

    `INSERT OR IGNORE INTO system_control (key, value, description) VALUES 
        ('system_mode', 'normal', 'Current system mode: normal, maintenance, readonly'),
        ('debug_mode', '0', 'Debug mode enabled: 0 or 1'),
        ('maintenance_message', 'System is currently under maintenance. Please check back later.', 'Message shown during maintenance'),
        ('allow_registration', '1', 'Allow new user registration: 0 or 1')`,

    `INSERT OR IGNORE INTO settings (key, value, description) VALUES 
        ('site_name', 'PrimeShieldHub', 'Site name'),
        ('site_description', 'Premium EV Charging Solutions', 'Site description'),
        ('currency', 'USD', 'Default currency'),
        ('maintenance_mode', '0', 'Maintenance mode: 0 or 1'),
        ('allow_registration', '1', 'Allow registration: 0 or 1'),
        ('commission_rate', '5', 'Default commission rate for resellers'),
        ('wholesale_discount', '10', 'Default wholesale discount percentage')`,

    // ========== INDEXES ==========
    `CREATE INDEX IF NOT EXISTS idx_staff_locations_staff_id ON staff_locations(staff_id)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_locations_timestamp ON staff_locations(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_captures_staff_id ON staff_captures(staff_id)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_logs_staff_id ON staff_logs(staff_id)`,
    `CREATE INDEX IF NOT EXISTS idx_staff_logs_timestamp ON staff_logs(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_customer_history_user_id ON customer_history(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_customer_history_timestamp ON customer_history(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_otp_codes_user_id ON otp_codes(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_otp_codes_code ON otp_codes(code)`,
    `CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id)`,
    `CREATE INDEX IF NOT EXISTS idx_pages_slug ON pages(slug)`,
    `CREATE INDEX IF NOT EXISTS idx_actions_user_id ON actions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_actions_timestamp ON actions(timestamp)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_conversations_session_id ON ai_conversations(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_ai_recommendations_user_id ON ai_recommendations(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_commissions_reseller_id ON commissions(reseller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_penalties_user_id ON penalties(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_charges_user_id ON charges(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date)`,
    `CREATE INDEX IF NOT EXISTS idx_deploy_logs_timestamp ON deploy_logs(timestamp)`
];

// ============================================================
// EXECUTE MIGRATION
// ============================================================
async function runMigration() {
    console.log('🚀 Creating missing tables in D1 database...\n');
    console.log(`📝 Total SQL statements: ${SQL_STATEMENTS.length}\n`);
    
    let successCount = 0;
    let errorCount = 0;
    const errors = [];
    
    for (let i = 0; i < SQL_STATEMENTS.length; i++) {
        const statement = SQL_STATEMENTS[i];
        const cleanStatement = statement.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        
        // Skip empty statements
        if (!cleanStatement) continue;
        
        try {
            // Escape the statement for the command line
            const escaped = cleanStatement.replace(/"/g, '\\"');
            const cmd = `npx wrangler d1 execute DB --remote --command "${escaped}"`;
            
            process.stdout.write(`📝 [${i + 1}/${SQL_STATEMENTS.length}] ${cleanStatement.substring(0, 60)}... `);
            
            const { stdout, stderr } = await execAsync(cmd);
            
            if (stderr && !stderr.includes('already exists') && !stderr.includes('Error')) {
                console.log(`⚠️ Warning: ${stderr.trim()}`);
            }
            
            successCount++;
            console.log('✅');
        } catch (error) {
            errorCount++;
            console.log('❌');
            errors.push({
                index: i + 1,
                statement: cleanStatement.substring(0, 100) + '...',
                error: error.message
            });
            
            // Log the full error
            console.error(`   Error: ${error.message.substring(0, 200)}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📝 Total Statements: ${SQL_STATEMENTS.length}`);
    
    if (errors.length > 0) {
        console.log('\n❌ Failed Statements:');
        errors.forEach(e => {
            console.log(`  ${e.index}. ${e.statement}`);
            console.log(`     Error: ${e.error.substring(0, 100)}`);
        });
    }
    
    if (errorCount === 0) {
        console.log('\n🎉 All tables created successfully!');
    } else {
        console.log('\n⚠️ Some tables may already exist or there were errors.');
        console.log('💡 This is often because tables already exist. Check the errors above.');
    }
}

runMigration().catch(console.error);
