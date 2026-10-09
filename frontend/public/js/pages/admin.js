// ============================================================================
// public../js/pages/admin.js - Admin Dashboard Page Module v2.0
// ============================================================================
// Security Operations Center dashboard for PrimeShieldHub administrators.
// ============================================================================

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { api } from './api-client.js';
import { requireAdmin } from './auth-check.js';
import { bus, Events } from './events.js';
import { getDeviceFingerprint } from '../sophisticated/fraud-engine/fingerprint.js';
import { navigate } from './router.js';

// ===== STATE =====
let refreshInterval = null;
let mapChart = null;
let cleanupFunctions = [];

// ===== LOAD ECHARTS =====
async function loadECharts() {
    if (typeof echarts !== 'undefined') return echarts;
    
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.5.0/dist/echarts.min.js';
        script.async = true;
        script.defer = true;
        
        const timeout = setTimeout(() => {
            reject(new Error('ECharts load timeout'));
        }, 10000);
        
        script.onload = () => {
            clearTimeout(timeout);
            if (typeof echarts !== 'undefined') {
                resolve(echarts);
            } else {
                reject(new Error('ECharts not available after load'));
            }
        };
        
        script.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('ECharts load failed'));
        };
        
        document.head.appendChild(script);
    });
}

// ===== UI HELPERS =====
function showError(message) {
    const errDiv = document.getElementById('admin-error');
    if (!errDiv) return;
    
    errDiv.textContent = message;
    errDiv.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        if (errDiv) errDiv.style.display = 'none';
    }, 5000);
}

function showSuccess(message) {
    const errDiv = document.getElementById('admin-error');
    if (!errDiv) return;
    
    errDiv.textContent = message;
    errDiv.style.backgroundColor = 'rgba(51, 255, 170, 0.1)';
    errDiv.style.border = '1px solid var(--quantum-success-neutron, #33ffaa)';
    errDiv.style.color = 'var(--quantum-success-neutron, #33ffaa)';
    errDiv.style.display = 'block';
    
    setTimeout(() => {
        if (errDiv) {
            errDiv.style.display = 'none';
            errDiv.style.backgroundColor = '';
            errDiv.style.border = '';
            errDiv.style.color = '';
        }
    }, 5000);
}

// ===== DATA LOADING =====
async function loadStats() {
    try {
        const data = await api.get('/security/stats', { requireAuth: true });
        
        const stats = [
            { id: 'stat-botBlocks', value: data.botBlocks ?? 0 },
            { id: 'stat-rateLimits', value: data.rateLimits ?? 0 },
            { id: 'stat-paymentAbuse', value: data.paymentAbuse ?? 0 },
            { id: 'stat-globalBlocks', value: data.globalBlocks ?? 0 },
            { id: 'stat-honeyTriggers', value: data.honeyTriggers ?? 0 }
        ];
        
        stats.forEach(({ id, value }) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value.toLocaleString();
        });
        
        return data;
    } catch (error) {
        console.error('[Admin] Stats error:', error);
        showError('Failed to load security stats');
        return null;
    }
}

async function loadTopIps() {
    try {
        const data = await api.get('/fraud/stats', { requireAuth: true });
        const topIps = data.topIps || [];
        const container = document.getElementById('top-ips-list');
        
        if (!container) return;
        
        if (!topIps.length) {
            container.innerHTML = '<p style="color: var(--quantum-text-tertiary, #9ca3cf);">No fraudulent IPs detected</p>';
            return;
        }
        
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--quantum-border-primary, rgba(255,255,255,0.1));">
                        <th style="text-align: left; padding: 8px; color: var(--quantum-gold-core, #d6b25e);">IP Address</th>
                        <th style="text-align: right; padding: 8px; color: var(--quantum-gold-core, #d6b25e);">Attempts</th>
                        <th style="text-align: center; padding: 8px; color: var(--quantum-gold-core, #d6b25e);">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${topIps.slice(0, 10).map(([ip, count]) => `
                        <tr style="border-bottom: 1px solid var(--quantum-border-secondary, rgba(255,255,255,0.05));">
                            <td style="padding: 8px; font-family: monospace; color: var(--quantum-text-primary, #f0f3ff);">${ip}</td>
                            <td style="padding: 8px; text-align: right; color: var(--quantum-text-secondary, #9ca3cf);">${count}</td>
                            <td style="padding: 8px; text-align: center;">
                                <button class="block-ip-btn" data-ip="${ip}" style="background: rgba(255,51,102,0.15); border: 1px solid rgba(255,51,102,0.3); color: #ff3366; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;">
                                    <i class="fas fa-ban"></i> Block
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        // Add block IP handlers
        container.querySelectorAll('.block-ip-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ip = btn.dataset.ip;
                if (confirm(`Block IP ${ip}?`)) {
                    await blockIP(ip);
                }
            });
        });
        
    } catch (error) {
        console.error('[Admin] Top IPs error:', error);
        const container = document.getElementById('top-ips-list');
        if (container) {
            container.innerHTML = '<p style="color: var(--quantum-danger-neutron, #ff3366);">Error loading IP data</p>';
        }
    }
}

async function blockIP(ip) {
    try {
        await api.post('/security/block-ip', { ip }, { requireAuth: true });
        showSuccess(`IP ${ip} blocked successfully`);
        loadTopIps(); // Refresh list
    } catch (error) {
        console.error('[Admin] Block IP error:', error);
        showError(`Failed to block IP ${ip}: ${error.message}`);
    }
}

async function loadBlockedIps() {
    try {
        const data = await api.get('/security/blocked-ips', { requireAuth: true });
        const ips = data.ips || [];
        const container = document.getElementById('blocked-ips-list');
        
        if (!container) return;
        
        if (!ips.length) {
            container.innerHTML = '<p style="color: var(--quantum-text-tertiary, #9ca3cf);">No blocked IPs</p>';
            return;
        }
        
        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--quantum-border-primary, rgba(255,255,255,0.1));">
                        <th style="text-align: left; padding: 8px; color: var(--quantum-gold-core, #d6b25e);">IP Address</th>
                        <th style="text-align: left; padding: 8px; color: var(--quantum-gold-core, #d6b25e);">Reason</th>
                        <th style="text-align: left; padding: 8px; color: var(--quantum-gold-core, #d6b25e);">Blocked At</th>
                        <th style="text-align: center; padding: 8px; color: var(--quantum-gold-core, #d6b25e);">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${ips.slice(0, 20).map(ip => `
                        <tr style="border-bottom: 1px solid var(--quantum-border-secondary, rgba(255,255,255,0.05));">
                            <td style="padding: 8px; font-family: monospace; color: var(--quantum-text-primary, #f0f3ff);">${ip.ip}</td>
                            <td style="padding: 8px; color: var(--quantum-text-secondary, #9ca3cf);">${ip.reason || 'Auto blocked'}</td>
                            <td style="padding: 8px; color: var(--quantum-text-secondary, #9ca3cf);">${ip.createdAt ? new Date(ip.createdAt).toLocaleDateString() : 'N/A'}</td>
                            <td style="padding: 8px; text-align: center;">
                                <button class="unblock-ip-btn" data-ip="${ip.ip}" style="background: rgba(51,255,170,0.15); border: 1px solid rgba(51,255,170,0.3); color: #33ffaa; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; transition: all 0.2s;">
                                    <i class="fas fa-unlock"></i> Unblock
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        // Add unblock handlers
        container.querySelectorAll('.unblock-ip-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ip = btn.dataset.ip;
                if (confirm(`Unblock IP ${ip}?`)) {
                    await unblockIP(ip);
                }
            });
        });
        
    } catch (error) {
        console.error('[Admin] Blocked IPs error:', error);
        const container = document.getElementById('blocked-ips-list');
        if (container) {
            container.innerHTML = '<p style="color: var(--quantum-danger-neutron, #ff3366);">Error loading blocked IPs</p>';
        }
    }
}

async function unblockIP(ip) {
    try {
        await api.delete(`/security/block-ip/${encodeURIComponent(ip)}`, { requireAuth: true });
        showSuccess(`IP ${ip} unblocked successfully`);
        loadBlockedIps(); // Refresh list
    } catch (error) {
        console.error('[Admin] Unblock IP error:', error);
        showError(`Failed to unblock IP ${ip}: ${error.message}`);
    }
}

async function loadMapData() {
    try {
        const data = await api.get('/security/attack-map', { requireAuth: true });
        const countries = data.countries || {};
        const mapData = Object.entries(countries).map(([name, value]) => ({ name, value }));
        const mapContainer = document.getElementById('world-map');
        
        if (!mapContainer) return;
        
        // Load ECharts if needed
        try {
            await loadECharts();
        } catch (error) {
            console.warn('[Admin] ECharts load failed:', error);
            mapContainer.innerHTML = '<p style="text-align:center;color:var(--quantum-text-tertiary, #9ca3cf);padding:40px;">Map visualization unavailable</p>';
            return;
        }
        
        if (!mapChart) {
            mapChart = echarts.init(mapContainer);
        }
        
        const option = {
            title: { show: false },
            tooltip: {
                trigger: 'item',
                formatter: function(params) {
                    return `<b>${params.name}</b><br/>Attacks: ${params.value || 0}`;
                }
            },
            visualMap: {
                min: 0,
                max: Math.max(1, ...mapData.map(d => d.value || 0)),
                left: 'left',
                bottom: 'bottom',
                calculable: true,
                inRange: {
                    color: ['#0a2a3a', '#1a4a6a', '#2a7aaa', '#3a9aaa', '#4abaaa']
                },
                textStyle: { color: '#9ca3cf' }
            },
            series: [{
                name: 'Attacks',
                type: 'map',
                map: 'world',
                roam: true,
                scaleLimit: { min: 1, max: 3 },
                itemStyle: {
                    borderColor: '#334155',
                    borderWidth: 0.5,
                    areaColor: '#1a1a2e'
                },
                emphasis: {
                    label: { show: true, color: '#d6b25e' },
                    itemStyle: { areaColor: '#2a3a5e' }
                },
                data: mapData
            }]
        };
        
        mapChart.setOption(option, true);
        
        // Resize handler
        const resizeHandler = () => {
            if (mapChart) mapChart.resize();
        };
        window.addEventListener('resize', resizeHandler);
        cleanupFunctions.push(() => {
            window.removeEventListener('resize', resizeHandler);
        });
        
    } catch (error) {
        console.error('[Admin] Map error:', error);
        const mapContainer = document.getElementById('world-map');
        if (mapContainer) {
            mapContainer.innerHTML = '<p style="text-align:center;color:var(--quantum-text-tertiary, #9ca3cf);padding:40px;">Failed to load attack map</p>';
        }
    }
}

async function refreshAll() {
    await Promise.allSettled([
        loadStats(),
        loadTopIps(),
        loadBlockedIps(),
        loadMapData()
    ]);
}

// ===== PAGE INITIALIZATION =====
export async function initAdminPage() {
    // Check admin access
    const session = await requireAdmin({
        redirectIfNot: '/admin/login',
        redirectIfUnauthorized: '/admin/login',
        redirectOnFail: true
    });
    
    if (!session) return;
    
    // Set up logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await auth.logout();
            navigate('/');
        });
    }
    
    // Load initial data
    try {
        await refreshAll();
    } catch (error) {
        console.error('[Admin] Initial load error:', error);
        showError('Failed to load admin dashboard. Please refresh.');
    }
    
    // Set up auto-refresh
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(refreshAll, 30000); // Refresh every 30 seconds
    
    // Emit page loaded event
    if (bus?.emit) {
        bus.emit(Events.PAGE_LOADED, { page: 'admin', timestamp: Date.now() });
    }
    
    return () => {
        // Cleanup
        if (refreshInterval) {
            clearInterval(refreshInterval);
            refreshInterval = null;
        }
        if (mapChart) {
            mapChart.dispose();
            mapChart = null;
        }
        cleanupFunctions.forEach(fn => {
            try { fn(); } catch (e) { /* ignore */ }
        });
        cleanupFunctions = [];
    };
}

// ===== RENDER =====
export function renderAdminPage() {
    return `
        <div class="admin-dashboard-page">
            <div class="quantum-container">
                <div class="admin-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--quantum-space-galaxy, 24px); flex-wrap: wrap; gap: 12px;">
                    <h1 class="section-title" style="margin-bottom: 0; color: var(--quantum-gold-core, #d6b25e);">
                        <i class="fas fa-shield-halved"></i> Security Operations Center
                    </h1>
                    <div style="display: flex; gap: 12px; align-items: center;">
                        <span id="admin-status" style="color: var(--quantum-text-secondary, #9ca3cf); font-size: 0.85rem;">
                            <i class="fas fa-circle" style="color: #33ffaa; font-size: 8px;"></i> Online
                        </span>
                        <button id="logoutBtn" class="quantum-btn quantum-btn-secondary" style="padding: 8px 20px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--quantum-text-primary, #f0f3ff); cursor: pointer; transition: all 0.2s;">
                            <i class="fas fa-sign-out-alt"></i> Sign Out
                        </button>
                    </div>
                </div>

                <div id="admin-error" class="error-message" style="display: none; background: rgba(255, 56, 96, 0.1); border: 1px solid var(--quantum-danger-neutron, #ff3366); color: var(--quantum-danger-neutron, #ff3366); padding: var(--quantum-space-organ, 16px); border-radius: var(--quantum-radius-organ, 12px); margin-bottom: var(--quantum-space-galaxy, 24px);"></div>

                <!-- Stats Grid -->
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--quantum-space-organ, 16px); margin-bottom: var(--quantum-space-galaxy, 24px);">
                    <div class="stat-card" style="background: var(--quantum-background-tertiary, rgba(255,255,255,0.03)); border-radius: var(--quantum-radius-organ, 12px); padding: var(--quantum-space-organ, 16px); text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                        <div class="stat-icon"><i class="fas fa-robot" style="font-size: 28px; color: var(--quantum-gold-core, #d6b25e);"></i></div>
                        <div class="stat-label" style="color: var(--quantum-text-tertiary, #9ca3cf); margin-top: 8px; font-size: 0.85rem;">Bot Blocks</div>
                        <div class="stat-value" id="stat-botBlocks" style="font-size: var(--quantum-font-size-galaxy, 28px); font-weight: var(--quantum-font-weight-bold, 700); color: var(--quantum-gold-core, #d6b25e);">0</div>
                    </div>
                    <div class="stat-card" style="background: var(--quantum-background-tertiary, rgba(255,255,255,0.03)); border-radius: var(--quantum-radius-organ, 12px); padding: var(--quantum-space-organ, 16px); text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                        <div class="stat-icon"><i class="fas fa-tachometer-alt" style="font-size: 28px; color: var(--quantum-gold-core, #d6b25e);"></i></div>
                        <div class="stat-label" style="color: var(--quantum-text-tertiary, #9ca3cf); margin-top: 8px; font-size: 0.85rem;">Rate Limits</div>
                        <div class="stat-value" id="stat-rateLimits" style="font-size: var(--quantum-font-size-galaxy, 28px); font-weight: var(--quantum-font-weight-bold, 700); color: var(--quantum-gold-core, #d6b25e);">0</div>
                    </div>
                    <div class="stat-card" style="background: var(--quantum-background-tertiary, rgba(255,255,255,0.03)); border-radius: var(--quantum-radius-organ, 12px); padding: var(--quantum-space-organ, 16px); text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                        <div class="stat-icon"><i class="fas fa-credit-card" style="font-size: 28px; color: var(--quantum-gold-core, #d6b25e);"></i></div>
                        <div class="stat-label" style="color: var(--quantum-text-tertiary, #9ca3cf); margin-top: 8px; font-size: 0.85rem;">Payment Abuse</div>
                        <div class="stat-value" id="stat-paymentAbuse" style="font-size: var(--quantum-font-size-galaxy, 28px); font-weight: var(--quantum-font-weight-bold, 700); color: var(--quantum-gold-core, #d6b25e);">0</div>
                    </div>
                    <div class="stat-card" style="background: var(--quantum-background-tertiary, rgba(255,255,255,0.03)); border-radius: var(--quantum-radius-organ, 12px); padding: var(--quantum-space-organ, 16px); text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                        <div class="stat-icon"><i class="fas fa-globe" style="font-size: 28px; color: var(--quantum-gold-core, #d6b25e);"></i></div>
                        <div class="stat-label" style="color: var(--quantum-text-tertiary, #9ca3cf); margin-top: 8px; font-size: 0.85rem;">Global Blocks</div>
                        <div class="stat-value" id="stat-globalBlocks" style="font-size: var(--quantum-font-size-galaxy, 28px); font-weight: var(--quantum-font-weight-bold, 700); color: var(--quantum-gold-core, #d6b25e);">0</div>
                    </div>
                    <div class="stat-card" style="background: var(--quantum-background-tertiary, rgba(255,255,255,0.03)); border-radius: var(--quantum-radius-organ, 12px); padding: var(--quantum-space-organ, 16px); text-align: center; border: 1px solid rgba(255,255,255,0.05);">
                        <div class="stat-icon"><i class="fas fa-trap" style="font-size: 28px; color: var(--quantum-gold-core, #d6b25e);"></i></div>
                        <div class="stat-label" style="color: var(--quantum-text-tertiary, #9ca3cf); margin-top: 8px; font-size: 0.85rem;">Honey Triggers</div>
                        <div class="stat-value" id="stat-honeyTriggers" style="font-size: var(--quantum-font-size-galaxy, 28px); font-weight: var(--quantum-font-weight-bold, 700); color: var(--quantum-gold-core, #d6b25e);">0</div>
                    </div>
                </div>

                <!-- Attack Map -->
                <div class="chart-container" style="background: var(--quantum-background-tertiary, rgba(255,255,255,0.03)); border-radius: var(--quantum-radius-organ, 12px); padding: var(--quantum-space-galaxy, 24px); margin-bottom: var(--quantum-space-galaxy, 24px); border: 1px solid rgba(255,255,255,0.05);">
                    <h2 style="margin-bottom: var(--quantum-space-organ, 16px); color: var(--quantum-gold-core, #d6b25e); font-size: 1.2rem;">
                        <i class="fas fa-map-marked-alt"></i> Global Attack Map
                    </h2>
                    <div id="world-map" style="height: 400px; width: 100%; min-height: 300px;"></div>
                </div>

                <!-- Two-column lists -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: var(--quantum-space-galaxy, 24px); margin-bottom: var(--quantum-space-galaxy, 24px);">
                    <div class="card" style="background: var(--quantum-background-tertiary, rgba(255,255,255,0.03)); border-radius: var(--quantum-radius-organ, 12px); padding: var(--quantum-space-galaxy, 24px); border: 1px solid rgba(255,255,255,0.05);">
                        <h3 style="margin-bottom: var(--quantum-space-organ, 16px); color: var(--quantum-gold-core, #d6b25e); font-size: 1rem;">
                            <i class="fas fa-skull-crosswalk"></i> Top Fraudulent IPs
                        </h3>
                        <div id="top-ips-list"></div>
                    </div>
                    <div class="card" style="background: var(--quantum-background-tertiary, rgba(255,255,255,0.03)); border-radius: var(--quantum-radius-organ, 12px); padding: var(--quantum-space-galaxy, 24px); border: 1px solid rgba(255,255,255,0.05);">
                        <h3 style="margin-bottom: var(--quantum-space-organ, 16px); color: var(--quantum-gold-core, #d6b25e); font-size: 1rem;">
                            <i class="fas fa-ban"></i> Cloudflare Blocked IPs
                        </h3>
                        <div id="blocked-ips-list"></div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== EXPORT =====
export default {
    render: renderAdminPage,
    mounted: initAdminPage
};
