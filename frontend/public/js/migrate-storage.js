// ============================================================================
// migrate-storage.js - Unified Storage Migration v2.0
// ============================================================================
// Migrates old storage keys to the unified CONFIG.STORAGE_KEYS system.
// Tracks migration version to prevent duplicate runs.
// ============================================================================

import { CONFIG } from './config.js';

// ===== CONSTANTS =====
const MIGRATION_VERSION_KEY = 'psh_migration_version';
const CURRENT_VERSION = '2.0';
const BACKUP_PREFIX = 'psh_backup_';

// ===== MIGRATION DEFINITIONS =====
const MIGRATIONS = {
    // Cart migrations
    cart: {
        oldKeys: [
            'psh_cart_v4',
            'psh_cart_v3', 
            'psh_cart_old',
            'quantum_cart',
            'psh_cart_backup',
            'psh_cart_legacy'
        ],
        newKey: CONFIG.STORAGE_KEYS.CART,
        transform: (data) => {
            if (!Array.isArray(data)) return null;
            return data
                .filter(item => item && item.id && item.name)
                .map(item => ({
                    id: String(item.id),
                    name: String(item.name || 'Product'),
                    price: parseFloat(item.price) || 0,
                    wholesalePrice: item.wholesalePrice ? parseFloat(item.wholesalePrice) : null,
                    originalPrice: item.originalPrice ? parseFloat(item.originalPrice) : null,
                    image: item.image || item.images?.[0] || '/company_logo.png',
                    description: String(item.description || ''),
                    category: String(item.category || 'general'),
                    quantity: Math.max(1, parseInt(item.quantity) || 1),
                    stock: Math.max(0, parseInt(item.stock) || 0),
                    features: Array.isArray(item.features) ? item.features : [],
                    addedAt: item.addedAt || Date.now()
                }));
        }
    },
    
    // Saved items migrations
    savedItems: {
        oldKeys: [
            'psh_saved_items_old',
            'quantum_saved',
            'psh_wishlist_old',
            'psh_saved_for_later'
        ],
        newKey: CONFIG.STORAGE_KEYS.SAVED_ITEMS,
        transform: (data) => {
            if (!Array.isArray(data)) return null;
            return data
                .filter(item => item && item.id)
                .map(item => ({
                    id: String(item.id),
                    name: String(item.name || 'Product'),
                    price: parseFloat(item.price) || 0,
                    wholesalePrice: item.wholesalePrice ? parseFloat(item.wholesalePrice) : null,
                    image: item.image || '/company_logo.png',
                    description: String(item.description || ''),
                    category: String(item.category || 'general'),
                    savedAt: item.savedAt || Date.now()
                }));
        }
    },
    
    // Wishlist migrations
    wishlist: {
        oldKeys: [
            'psh_wishlist_old',
            'quantum_wishlist',
            'psh_favorites'
        ],
        newKey: CONFIG.STORAGE_KEYS.WISHLIST,
        transform: (data) => {
            if (!Array.isArray(data)) return null;
            return data
                .filter(item => item && (item.id || item.product_id))
                .map(item => ({
                    id: String(item.id || item.product_id),
                    name: String(item.name || 'Product'),
                    price: parseFloat(item.price) || 0,
                    image: item.image || '/company_logo.png',
                    addedAt: item.addedAt || Date.now()
                }));
        }
    },
    
    // Discount migrations
    discount: {
        oldKeys: [
            'psh_cart_discount_old',
            'quantum_discount',
            'psh_discount_code'
        ],
        newKey: CONFIG.STORAGE_KEYS.DISCOUNT,
        transform: (data) => {
            if (!data || typeof data !== 'object') return null;
            if (!data.code) return null;
            return {
                code: String(data.code).toUpperCase(),
                type: data.type || 'percentage',
                value: parseFloat(data.value) || 0,
                minAmount: parseFloat(data.minAmount) || 0,
                description: String(data.description || ''),
                appliedAt: data.appliedAt || Date.now()
            };
        }
    },
    
    // Shipping migrations
    shipping: {
        oldKeys: [
            'psh_cart_shipping_old',
            'quantum_shipping'
        ],
        newKey: CONFIG.STORAGE_KEYS.SHIPPING,
        transform: (data) => {
            if (!data || typeof data !== 'object') return null;
            if (!data.id || !data.state) return null;
            return {
                id: String(data.id),
                state: String(data.state),
                price: parseFloat(data.price) || 0,
                name: String(data.name || ''),
                time: String(data.time || '')
            };
        }
    },
    
    // User preferences
    preferences: {
        oldKeys: [
            'psh_user_preferences_old',
            'psh_theme_old',
            'quantum_preferences'
        ],
        newKey: CONFIG.STORAGE_KEYS.PREFERENCES,
        transform: (data) => {
            if (!data || typeof data !== 'object') return null;
            return {
                theme: data.theme || 'dark',
                language: data.language || 'en',
                currency: data.currency || 'NGN',
                notifications: data.notifications !== false,
                reducedMotion: data.reducedMotion || false,
                updatedAt: Date.now()
            };
        }
    },
    
    // Recently viewed
    recentlyViewed: {
        oldKeys: [
            'psh_recently_viewed_old',
            'quantum_recently_viewed'
        ],
        newKey: CONFIG.STORAGE_KEYS.RECENTLY_VIEWED || 'psh_recently_viewed',
        transform: (data) => {
            if (!Array.isArray(data)) return null;
            return data
                .filter(item => item && item.id)
                .slice(0, 20)
                .map(item => ({
                    id: String(item.id),
                    name: String(item.name || 'Product'),
                    price: parseFloat(item.price) || 0,
                    image: item.image || '/company_logo.png',
                    viewedAt: item.viewedAt || Date.now()
                }));
        }
    }
};

// ===== MAIN MIGRATION FUNCTION =====
export function migrateStorage(options = {}) {
    const {
        verbose = true,
        force = false,
        createBackup = true,
        onProgress = null,
        onComplete = null,
        onError = null
    } = options;

    // Check if migration already ran
    if (!force) {
        const version = localStorage.getItem(MIGRATION_VERSION_KEY);
        if (version && version === CURRENT_VERSION) {
            if (verbose) {
                console.log(`✅ Storage already migrated to v${CURRENT_VERSION}`);
            }
            return { migrated: 0, skipped: true };
        }
    }

    console.log(`🔄 Starting storage migration to v${CURRENT_VERSION}...`);
    
    const results = {
        migrated: 0,
        errors: [],
        backups: [],
        skipped: []
    };

    // Create backup if requested
    if (createBackup) {
        try {
            const backup = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith('psh_')) {
                    backup[key] = localStorage.getItem(key);
                }
            }
            const backupKey = `${BACKUP_PREFIX}${Date.now()}`;
            localStorage.setItem(backupKey, JSON.stringify(backup));
            results.backups.push(backupKey);
            if (verbose) console.log(`💾 Backup created: ${backupKey}`);
        } catch (e) {
            console.warn('Failed to create backup:', e);
        }
    }

    // Run each migration
    const migrationKeys = Object.keys(MIGRATIONS);
    let processed = 0;

    for (const [name, migration] of Object.entries(MIGRATIONS)) {
        processed++;
        if (onProgress) {
            onProgress({
                current: processed,
                total: migrationKeys.length,
                name,
                status: 'processing'
            });
        }

        try {
            let migratedCount = 0;
            let newData = null;

            // Try each old key
            for (const oldKey of migration.oldKeys) {
                const data = localStorage.getItem(oldKey);
                if (data) {
                    try {
                        const parsed = JSON.parse(data);
                        const transformed = migration.transform(parsed);
                        
                        if (transformed) {
                            if (!newData) {
                                newData = transformed;
                            } else if (Array.isArray(newData) && Array.isArray(transformed)) {
                                // Merge arrays without duplicates
                                const ids = new Set(newData.map(item => item.id));
                                for (const item of transformed) {
                                    if (!ids.has(item.id)) {
                                        newData.push(item);
                                        ids.add(item.id);
                                    }
                                }
                            } else if (typeof newData === 'object' && typeof transformed === 'object') {
                                // Merge objects
                                newData = { ...newData, ...transformed };
                            }
                            migratedCount++;
                        }
                        
                        // Remove old key after successful migration
                        localStorage.removeItem(oldKey);
                        if (verbose) console.log(`✅ Migrated ${oldKey}`);
                    } catch (e) {
                        const error = `Failed to migrate ${oldKey}: ${e.message}`;
                        console.warn(error);
                        results.errors.push(error);
                    }
                }
            }

            // Save migrated data
            if (newData) {
                // Merge with existing data
                const existing = localStorage.getItem(migration.newKey);
                if (existing) {
                    try {
                        const existingData = JSON.parse(existing);
                        if (Array.isArray(existingData) && Array.isArray(newData)) {
                            const ids = new Set(existingData.map(item => item.id));
                            for (const item of newData) {
                                if (!ids.has(item.id)) {
                                    existingData.push(item);
                                    ids.add(item.id);
                                }
                            }
                            newData = existingData;
                        } else if (typeof existingData === 'object' && typeof newData === 'object') {
                            newData = { ...existingData, ...newData };
                        }
                    } catch (e) {
                        // If existing data is corrupted, overwrite it
                        console.warn(`Existing data for ${migration.newKey} is corrupted, overwriting`);
                    }
                }

                localStorage.setItem(migration.newKey, JSON.stringify(newData));
                results.migrated += migratedCount;
                if (verbose) {
                    const itemCount = Array.isArray(newData) ? newData.length : 1;
                    console.log(`✅ Migrated ${itemCount} items to ${migration.newKey}`);
                }
            } else {
                results.skipped.push(name);
            }
        } catch (e) {
            const error = `Migration ${name} failed: ${e.message}`;
            console.error(error);
            results.errors.push(error);
            if (onError) onError({ name, error: e.message });
        }
    }

    // Save migration version
    localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_VERSION);
    console.log(`✅ Storage migration complete! Migrated ${results.migrated} items.`);
    
    // Clean up old backup keys (keep last 5)
    try {
        const backupKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(BACKUP_PREFIX)) {
                backupKeys.push({
                    key,
                    time: parseInt(key.split('_').pop()) || 0
                });
            }
        }
        backupKeys.sort((a, b) => b.time - a.time);
        for (let i = 5; i < backupKeys.length; i++) {
            localStorage.removeItem(backupKeys[i].key);
            if (verbose) console.log(`🗑️ Removed old backup: ${backupKeys[i].key}`);
        }
    } catch (e) {
        // Ignore cleanup errors
    }

    if (onComplete) {
        onComplete(results);
    }

    return results;
}

// ===== UTILITY FUNCTIONS =====

/**
 * Check if migration is needed
 */
export function isMigrationNeeded() {
    const version = localStorage.getItem(MIGRATION_VERSION_KEY);
    if (version === CURRENT_VERSION) return false;
    
    // Check if any old keys exist
    for (const migration of Object.values(MIGRATIONS)) {
        for (const oldKey of migration.oldKeys) {
            if (localStorage.getItem(oldKey)) {
                return true;
            }
        }
    }
    return false;
}

/**
 * Get migration status
 */
export function getMigrationStatus() {
    const version = localStorage.getItem(MIGRATION_VERSION_KEY);
    const hasOldKeys = isMigrationNeeded();
    
    return {
        version: version || 'none',
        current: CURRENT_VERSION,
        isMigrated: version === CURRENT_VERSION,
        hasOldKeys,
        needsMigration: version !== CURRENT_VERSION || hasOldKeys,
        backupCount: getBackupCount()
    };
}

/**
 * Get number of backups
 */
function getBackupCount() {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(BACKUP_PREFIX)) {
            count++;
        }
    }
    return count;
}

/**
 * Rollback to a specific backup
 */
export function rollbackToBackup(backupKey) {
    try {
        const data = localStorage.getItem(backupKey);
        if (!data) {
            throw new Error(`Backup ${backupKey} not found`);
        }
        const backup = JSON.parse(data);
        
        // Clear current storage
        for (const key of Object.keys(backup)) {
            localStorage.setItem(key, backup[key]);
        }
        
        console.log(`✅ Rolled back to ${backupKey}`);
        return { success: true, backup: backupKey };
    } catch (e) {
        console.error(`Rollback failed: ${e.message}`);
        return { success: false, error: e.message };
    }
}

/**
 * Get list of available backups
 */
export function getBackups() {
    const backups = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(BACKUP_PREFIX)) {
            const time = parseInt(key.split('_').pop()) || 0;
            backups.push({
                key,
                time,
                date: time ? new Date(time).toISOString() : 'unknown'
            });
        }
    }
    backups.sort((a, b) => b.time - a.time);
    return backups;
}

// ===== AUTO-RUN =====
if (typeof window !== 'undefined') {
    // Auto-run if not already migrated
    const runMigration = () => {
        if (isMigrationNeeded()) {
            console.log('🔄 Auto-migrating storage...');
            migrateStorage({ verbose: false });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runMigration);
    } else {
        setTimeout(runMigration, 500);
    }
}

// ===== EXPORTS =====
export default {
    migrateStorage,
    isMigrationNeeded,
    getMigrationStatus,
    rollbackToBackup,
    getBackups,
    MIGRATION_VERSION_KEY,
    CURRENT_VERSION
};
