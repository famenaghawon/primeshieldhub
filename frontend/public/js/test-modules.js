/**
 * test-modules.js - Module Loading Test Suite v1.0
 * Run this in development to verify all modules load correctly
 * 
 * Usage: Add this to your HTML:
 *   <script type="module" src="../js/test-modules.js"></script>
 * 
 * Or run from console:
 *   import('./test-modules.js').then(m => m.runTests());
 */

// ============================================================================
// TEST SUITE
// ============================================================================

// List of modules to test
const MODULES_TO_TEST = [
    { name: 'config', path: '../js/config.js', required: true },
    { name: 'auth', path: '../js/auth.js', required: true },
    { name: 'api-client', path: '../js/api-client.js', required: true },
    { name: 'events', path: '../js/events.js', required: true },
    { name: 'utils', path: '../js/utils.js', required: true },
    { name: 'config', path: '../js/config.js', required: true },
    { name: 'cart-store', path: '../js/cart-store.js', required: true },
    { name: 'fingerprint', path: '../js/sophisticated/fraud-engine/fingerprint.js', required: true },
    { name: 'product-store', path: '../js/product-store.js', required: false },
    { name: 'analytics', path: '../js/analytics.js', required: false },
    { name: 'auth-check', path: '../js/auth-check.js', required: false },
    { name: 'router', path: '../js/router.js', required: false },
    { name: 'events (full)', path: '../js/events.js', required: false },
    { name: 'auth-storage', path: '../js/auth-storage.js', required: false },
    { name: 'migrate-storage', path: '../js/migrate-storage.js', required: false },
];

// Test results
const results = {
    passed: [],
    failed: [],
    skipped: [],
    total: 0,
    startTime: Date.now()
};

// ============================================================================
// TEST RUNNER
// ============================================================================

export async function runTests(options = {}) {
    const { 
        verbose = true, 
        timeout = 5000, 
        stopOnError = false,
        showHtml = true 
    } = options;

    console.log('🧪 Starting Module Tests...');
    console.log(`📦 Testing ${MODULES_TO_TEST.length} modules\n`);

    // Clear previous results
    results.passed = [];
    results.failed = [];
    results.skipped = [];
    results.total = 0;

    // Run each test
    for (const module of MODULES_TO_TEST) {
        await testModule(module, timeout, stopOnError);
    }

    // Show summary
    showSummary();

    // Show HTML results
    if (showHtml) {
        showHtmlResults();
    }

    return results;
}

// ============================================================================
// SINGLE MODULE TEST
// ============================================================================

async function testModule(module, timeout, stopOnError) {
    results.total++;
    const { name, path, required } = module;

    try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout);
        });

        // Import module with timeout
        const modulePromise = import(path);
        const loaded = await Promise.race([modulePromise, timeoutPromise]);

        // Check if it loaded correctly
        const exports = Object.keys(loaded);
        const hasDefault = loaded.default !== undefined;
        const exportCount = exports.length;

        // Log success
        results.passed.push({ name, path, exports, hasDefault, exportCount });
        
        if (true) { // verbose
            const icon = required ? '✅' : '✅ (optional)';
            console.log(`  ${icon} ${name}: ${exportCount} exports${hasDefault ? ' + default' : ''}`);
        }

    } catch (error) {
        // Log failure
        const message = error.message || String(error);
        results.failed.push({ name, path, error: message, required });

        console.error(`  ❌ ${name}: ${message}`);

        if (stopOnError && required) {
            throw new Error(`Stopped on ${name} failure: ${message}`);
        }
    }
}

// ============================================================================
// SUMMARY
// ============================================================================

function showSummary() {
    const total = results.total;
    const passed = results.passed.length;
    const failed = results.failed.length;
    const duration = Date.now() - results.startTime;

    console.log('\n' + '═'.repeat(50));
    console.log('📊 TEST SUMMARY');
    console.log('═'.repeat(50));
    
    if (failed === 0) {
        console.log(`✅ All ${total} modules loaded successfully (${duration}ms)`);
    } else {
        console.log(`❌ ${passed}/${total} passed, ${failed} failed (${duration}ms)`);
        
        // Show failed modules details
        console.log('\n❌ Failed Modules:');
        results.failed.forEach(f => {
            console.log(`  • ${f.name}: ${f.error}`);
            if (f.required) {
                console.log(`    ⚠️  CRITICAL: This module is required!`);
            }
        });
    }

    // Show passed modules
    if (results.passed.length > 0) {
        console.log(`\n✅ Passed Modules (${results.passed.length}):`);
        results.passed.forEach(p => {
            console.log(`  • ${p.name}: ${p.exportCount} exports`);
        });
    }

    // Recommendations
    if (results.failed.some(f => f.required)) {
        console.log('\n⚠️  RECOMMENDATIONS:');
        console.log('  1. Check that all required files exist in the correct paths');
        console.log('  2. Verify there are no syntax errors in the failed modules');
        console.log('  3. Check for circular dependencies');
        console.log('  4. Ensure all imports are correct');
    }

    console.log('═'.repeat(50));
}

// ============================================================================
// HTML RESULTS
// ============================================================================

function showHtmlResults() {
    const container = document.createElement('div');
    container.id = 'module-test-results';
    container.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: rgba(0,0,0,0.9);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 20px;
        max-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        z-index: 999999;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        color: #f0f0f0;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        transition: all 0.3s ease;
    `;

    const passed = results.passed.length;
    const failed = results.failed.length;
    const total = results.total;
    const status = failed === 0 ? '✅ All Passed' : `❌ ${failed} Failed`;

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <strong style="font-size:14px;color:#d6b25e;">🧪 Module Tests</strong>
            <span style="font-size:12px;color:${failed === 0 ? '#33ffaa' : '#ff3366'};">${status}</span>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:12px;font-size:11px;color:#888;">
            <span>${passed}/${total} passed</span>
            ${failed > 0 ? `<span style="color:#ff3366;">${failed} failed</span>` : ''}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:12px;">
            ${results.passed.map(p => 
                `<span style="background:rgba(51,255,170,0.15);color:#33ffaa;padding:2px 8px;border-radius:10px;font-size:10px;">${p.name}</span>`
            ).join('')}
            ${results.failed.map(f => 
                `<span style="background:rgba(255,51,102,0.15);color:#ff3366;padding:2px 8px;border-radius:10px;font-size:10px;">${f.name}</span>`
            ).join('')}
        </div>
        ${results.failed.length > 0 ? `
            <div style="background:rgba(255,51,102,0.1);border-left:2px solid #ff3366;padding:8px 12px;border-radius:4px;margin-bottom:8px;font-size:11px;">
                <strong style="color:#ff3366;">Failed:</strong>
                ${results.failed.map(f => `<div style="color:#ccc;">• ${f.name}: ${f.error}</div>`).join('')}
            </div>
        ` : ''}
        <div style="display:flex;gap:8px;margin-top:8px;">
            <button onclick="document.getElementById('module-test-results').remove()" 
                    style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#888;padding:4px 12px;border-radius:8px;cursor:pointer;font-size:11px;">
                Close
            </button>
            <button onclick="window.location.reload()" 
                    style="background:rgba(214,178,94,0.2);border:1px solid rgba(214,178,94,0.3);color:#d6b25e;padding:4px 12px;border-radius:8px;cursor:pointer;font-size:11px;">
                🔄 Reload
            </button>
        </div>
        <div style="margin-top:8px;font-size:9px;color:#555;">
            ${new Date().toLocaleTimeString()}
        </div>
    `;

    // Remove existing container if present
    const existing = document.getElementById('module-test-results');
    if (existing) existing.remove();

    document.body.appendChild(container);

    // Auto-remove after 30 seconds
    setTimeout(() => {
        const el = document.getElementById('module-test-results');
        if (el) el.style.opacity = '0';
        setTimeout(() => {
            const el2 = document.getElementById('module-test-results');
            if (el2) el2.remove();
        }, 500);
    }, 30000);
}

// ============================================================================
// CHECK CRITICAL MODULES
// ============================================================================

export async function checkCriticalModules() {
    const critical = MODULES_TO_TEST.filter(m => m.required);
    const results = [];

    for (const module of critical) {
        try {
            await import(module.path);
            results.push({ name: module.name, status: 'ok' });
        } catch (error) {
            results.push({ name: module.name, status: 'failed', error: error.message });
        }
    }

    const allOk = results.every(r => r.status === 'ok');
    
    console.log(`🔍 Critical Modules: ${allOk ? '✅ All OK' : '❌ Some failed'}`);
    
    if (!allOk) {
        console.log('❌ Failed critical modules:');
        results.filter(r => r.status === 'failed').forEach(f => {
            console.log(`  • ${f.name}: ${f.error}`);
        });
    }

    return results;
}

// ============================================================================
// EXPORT FUNCTIONS
// ============================================================================

export default {
    runTests,
    checkCriticalModules,
    MODULES_TO_TEST,
    results
};

// ============================================================================
// AUTO-RUN (if executed directly)
// ============================================================================

// Auto-run when loaded as a module
if (import.meta && import.meta.url) {
    console.log('🧪 Module Test Suite v1.0');
    console.log('ℹ️  Run tests: import("./test-modules.js").then(m => m.runTests())');
    
    // Auto-run after a short delay
    setTimeout(() => {
        runTests({ verbose: true, showHtml: true });
    }, 100);
}

// Also expose to window
if (typeof window !== 'undefined') {
    window.testModules = {
        runTests,
        checkCriticalModules,
        results
    };
    console.log('ℹ️  Window.testModules available');
}
