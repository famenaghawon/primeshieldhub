// ============================================================================
// public../js/pages/dashboard.js - Reseller Dashboard Module v2.0
// ============================================================================
// Real-time reseller dashboard with commissions, referrals, and earnings.
// ============================================================================

import { CONFIG } from './config.js';
import { auth } from './auth.js';
import { api } from './api-client.js';
import { requireReseller } from './auth-check.js';
import { bus, Events } from './events.js';
import { getDeviceFingerprint } from './sophisticated/fraud-engine/fingerprint.js';

// ===== STATE =====
let dashboardInitialized = false;
let refreshInterval = null;
let currentData = {
    earnings: 0,
    referrals: 0,
    rank: 'bronze',
    commissions: []
};

// ===== HELPERS =====
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, (m) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m] || m));
}

function formatDate(dateStr) {
    if (!dateStr) return '--';
    try {
        return new Date(dateStr).toLocaleDateString('en-NG', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    } catch {
        return dateStr;
    }
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount || 0);
}

// ===== TOAST NOTIFICATION =====
function showToast(message, type = 'info') {
    const existing = document.querySelector('.quantum-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'quantum-toast';
    const colors = {
        success: 'linear-gradient(135deg, #00f7ff, #33ffaa)',
        error: 'linear-gradient(135deg, #ff3366, #ff0066)',
        info: 'linear-gradient(135deg, #00f7ff, #b200ff)',
        warning: 'linear-gradient(135deg, #ffaa33, #ff6600)'
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 2rem;
        font-weight: 600;
        z-index: 100000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 0 20px rgba(0,247,255,0.3);
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
    `;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== TRACKING =====
function trackEvent(eventName, data = {}) {
    if (bus?.emit) {
        bus.emit(Events.ANALYTICS_EVENT, { name: eventName, ...data });
    }
    console.log(`[Analytics] ${eventName}`, data);
}

// ===== DATA LOADING =====
async function loadDashboardData() {
    try {
        // Get current user
        const user = auth.getUser();
        if (!user) {
            console.warn('[Dashboard] No user found');
            return;
        }

        // Load commissions
        const commissionsData = await api.get('/commissions', { requireAuth: true });
        
        // Load stats
        const statsData = await api.get('/reseller/stats', { requireAuth: true });
        
        // Update state
        currentData.earnings = commissionsData.totalEarnings || statsData.totalEarnings || 0;
        currentData.referrals = commissionsData.totalReferrals || statsData.totalReferrals || 0;
        currentData.rank = commissionsData.rank || statsData.rank || 'bronze';
        currentData.commissions = commissionsData.commissions || [];
        
        // Update UI
        updateUI(currentData);
        
        // Cache in localStorage for offline fallback
        try {
            localStorage.setItem('psh_reseller_earnings', String(currentData.earnings));
            localStorage.setItem('psh_reseller_referrals', String(currentData.referrals));
            localStorage.setItem('psh_reseller_rank', currentData.rank);
            localStorage.setItem('psh_reseller_commissions', JSON.stringify(currentData.commissions));
        } catch (e) {
            // Ignore cache errors
        }
        
        return currentData;
        
    } catch (error) {
        console.error('[Dashboard] Load error:', error);
        
        // Try to load from cache
        try {
            const cachedEarnings = localStorage.getItem('psh_reseller_earnings');
            const cachedReferrals = localStorage.getItem('psh_reseller_referrals');
            const cachedRank = localStorage.getItem('psh_reseller_rank');
            const cachedCommissions = localStorage.getItem('psh_reseller_commissions');
            
            if (cachedEarnings) {
                currentData.earnings = parseFloat(cachedEarnings) || 0;
                currentData.referrals = parseInt(cachedReferrals) || 0;
                currentData.rank = cachedRank || 'bronze';
                currentData.commissions = cachedCommissions ? JSON.parse(cachedCommissions) : [];
                updateUI(currentData);
                showToast('Showing cached data (offline mode)', 'warning');
                return currentData;
            }
        } catch (e) {
            // Ignore cache errors
        }
        
        // If no cache, use defaults
        currentData = {
            earnings: 0,
            referrals: 0,
            rank: 'bronze',
            commissions: []
        };
        updateUI(currentData);
        showToast('Failed to load dashboard data', 'error');
        return currentData;
    }
}

// ===== UI UPDATE =====
function updateUI(data) {
    // Update earnings
    const earningsEl = document.getElementById('totalEarnings');
    if (earningsEl) {
        earningsEl.textContent = formatCurrency(data.earnings);
    }
    
    // Update referrals
    const referralsEl = document.getElementById('totalReferrals');
    if (referralsEl) {
        referralsEl.textContent = data.referrals.toString();
    }
    
    // Update rank
    const rankEl = document.getElementById('resellerRank');
    const nextEl = document.getElementById('rankNext');
    
    const rankInfo = getRankInfo(data.earnings);
    if (rankEl) {
        rankEl.textContent = rankInfo.emoji + ' ' + rankInfo.name;
    }
    if (nextEl) {
        nextEl.textContent = rankInfo.next;
    }
    
    // Update commissions list
    updateCommissionsList(data.commissions);
}

function getRankInfo(earnings) {
    const ranks = [
        { threshold: 0, name: 'Bronze', emoji: '🥉', next: 'Silver (₦50,000)' },
        { threshold: 50000, name: 'Silver', emoji: '🥈', next: 'Gold (₦100,000)' },
        { threshold: 100000, name: 'Gold', emoji: '🥇', next: 'Platinum (₦500,000)' },
        { threshold: 500000, name: 'Platinum', emoji: '💎', next: '🎉 Maximum Rank Achieved!' }
    ];
    
    let currentRank = ranks[0];
    for (const rank of ranks) {
        if (earnings >= rank.threshold) {
            currentRank = rank;
        }
    }
    
    const nextRank = ranks.find(r => r.threshold > earnings);
    const nextText = nextRank ? 
        `${nextRank.name} (Need ₦${(nextRank.threshold - earnings).toLocaleString()} more)` : 
        '🎉 Maximum Rank Achieved!';
    
    return {
        ...currentRank,
        next: nextText
    };
}

function updateCommissionsList(commissions) {
    const container = document.getElementById('commissionsContainer');
    if (!container) return;
    
    if (!commissions || commissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="text-align:center;padding:3rem;color:#9ca3cf;">
                <i class="fas fa-gift" style="font-size:3rem;margin-bottom:1rem;display:block;color:#ffd966;"></i>
                <p style="font-size:1.1rem;margin-bottom:0.5rem;">No commissions yet!</p>
                <p style="font-size:0.9rem;color:#6b7a9f;">Share your referral link to start earning</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = `
        <div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="border-bottom:1px solid rgba(0,247,255,0.1);">
                        <th style="padding:1rem;text-align:left;color:#00f7ff;font-weight:600;">Date</th>
                        <th style="padding:1rem;text-align:left;color:#00f7ff;font-weight:600;">Order</th>
                        <th style="padding:1rem;text-align:left;color:#00f7ff;font-weight:600;">Customer</th>
                        <th style="padding:1rem;text-align:right;color:#00f7ff;font-weight:600;">Sale</th>
                        <th style="padding:1rem;text-align:right;color:#00f7ff;font-weight:600;">Commission</th>
                        <th style="padding:1rem;text-align:center;color:#00f7ff;font-weight:600;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${commissions.slice(0, 20).map(c => {
                        const statusClass = c.status === 'paid' ? 'status-paid' : 
                                           c.status === 'cancelled' ? 'status-cancelled' : 'status-pending';
                        const statusLabels = {
                            paid: '✅ Paid',
                            pending: '⏳ Pending',
                            cancelled: '❌ Cancelled'
                        };
                        return `
                            <tr style="border-bottom:1px solid rgba(0,247,255,0.05);">
                                <td style="padding:1rem;color:#9ca3cf;">${formatDate(c.created_at || c.createdAt)}</td>
                                <td style="padding:1rem;font-family:monospace;color:#9ca3cf;">${(c.order_id || c.orderId || 'N/A').slice(0, 8)}</td>
                                <td style="padding:1rem;color:#f0f3ff;">${escapeHtml(c.customer_name || c.customerName || 'Anonymous')}</td>
                                <td style="padding:1rem;text-align:right;color:#9ca3cf;">${formatCurrency(c.sale_amount || c.saleAmount || 0)}</td>
                                <td style="padding:1rem;text-align:right;color:#ffd966;font-weight:bold;">+${formatCurrency(c.commission_amount || c.commissionAmount || 0)}</td>
                                <td style="padding:1rem;text-align:center;">
                                    <span class="status-badge ${statusClass}" style="padding:0.2rem 0.8rem;border-radius:1rem;font-size:0.75rem;font-weight:600;background:rgba(0,247,255,0.1);color:#00f7ff;">
                                        ${statusLabels[c.status] || c.status || 'Pending'}
                                    </span>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            ${commissions.length > 20 ? `<p style="text-align:center;color:#6b7a9f;padding:1rem;font-size:0.85rem;">Showing 20 of ${commissions.length} commissions</p>` : ''}
        </div>
    `;
}

// ===== EVENT LISTENERS =====
function setupEventListeners(user) {
    // Copy referral link
    const copyBtn = document.getElementById('copyReferralBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', async () => {
            const input = document.getElementById('referralLinkInput');
            if (!input) return;
            
            input.select();
            try {
                await navigator.clipboard.writeText(input.value);
                showToast('Link copied to clipboard!', 'success');
                const originalHTML = copyBtn.innerHTML;
                copyBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                setTimeout(() => { copyBtn.innerHTML = originalHTML; }, 2000);
                trackEvent('copy_referral_link');
            } catch (err) {
                document.execCommand('copy');
                showToast('Link copied!', 'success');
                trackEvent('copy_referral_link_fallback');
            }
        });
    }
    
    // Share buttons
    const shareBtns = [
        { id: 'shareWhatsAppBtn', platform: 'whatsapp', url: 'https://wa.me/?text=' },
        { id: 'shareTelegramBtn', platform: 'telegram', url: 'https://t.me/share/url?url=' },
        { id: 'shareTwitterBtn', platform: 'twitter', url: 'https://twitter.com/intent/tweet?text=' }
    ];
    
    shareBtns.forEach(({ id, platform, url }) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        
        btn.addEventListener('click', () => {
            const resellerId = user?.id || localStorage.getItem('resellerId') || 'unknown';
            const link = `${window.location.origin}?ref=${resellerId}`;
            const message = encodeURIComponent(`🚀 Join PrimeShieldHub Reseller Program!\n\nEarn 15% commission on every sale!\n\nUse my referral link: ${link}`);
            
            if (platform === 'whatsapp') {
                window.open(`${url}${message}`, '_blank');
            } else if (platform === 'telegram') {
                window.open(`${url}${encodeURIComponent(link)}&text=${message}`, '_blank');
            } else if (platform === 'twitter') {
                const text = encodeURIComponent('🚀 Become a PrimeShieldHub Reseller! Earn 15% commission on every sale!');
                window.open(`${url}${text}&url=${encodeURIComponent(link)}`, '_blank');
            }
            
            trackEvent(`share_${platform}`);
        });
    });
    
    // Stat card clicks
    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('click', () => {
            const action = card.dataset.action;
            const messages = {
                earnings: 'Total lifetime earnings from all referrals',
                referrals: 'Number of users who signed up using your link',
                rank: 'Earn more to unlock higher ranks!'
            };
            if (messages[action]) {
                showToast(messages[action], 'info');
            }
        });
    });
}

// ===== RENDER =====
export function renderDashboard() {
    const user = auth.getUser() || {};
    const resellerId = user.id || localStorage.getItem('resellerId') || 'unknown';
    const referralLink = `${window.location.origin}?ref=${resellerId}`;
    const name = user.name || user.email || 'Reseller';
    
    // Inject animation styles if not present
    if (!document.getElementById('dashboard-anim-styles')) {
        const style = document.createElement('style');
        style.id = 'dashboard-anim-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    return `
        <div class="dashboard-wrapper" style="min-height:100vh;background:linear-gradient(135deg,#010105 0%,#0a0a1a 100%);padding:2rem;font-family:'Inter',sans-serif;">
            <div class="dashboard-container" style="max-width:1400px;margin:0 auto;">
                <!-- Header -->
                <div class="dashboard-header" style="background:linear-gradient(135deg,rgba(0,247,255,0.1) 0%,rgba(178,0,255,0.1) 100%);border:1px solid rgba(0,247,255,0.2);border-radius:2rem;padding:2rem;margin-bottom:2rem;backdrop-filter:blur(20px);">
                    <div class="welcome-badge" style="display:inline-block;background:linear-gradient(135deg,#00f7ff,#b200ff);padding:0.3rem 1rem;border-radius:2rem;font-size:0.8rem;font-weight:600;margin-bottom:1rem;color:#000;">
                        <i class="fas fa-crown"></i> RESELLER PORTAL
                    </div>
                    <h1 style="font-size:2.5rem;background:linear-gradient(135deg,#fff,#00f7ff);-webkit-background-clip:text;background-clip:text;color:transparent;margin-bottom:0.5rem;">
                        Welcome back, ${escapeHtml(name)}!
                    </h1>
                    <p style="color:#9ca3cf;">Track your earnings, share your link, and grow your network</p>
                </div>
                
                <!-- Stats -->
                <div class="stats-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1.5rem;margin-bottom:2rem;">
                    <div class="stat-card" data-action="earnings" style="background:rgba(8,12,25,0.75);backdrop-filter:blur(10px);border:1px solid rgba(0,247,255,0.25);border-radius:1.5rem;padding:1.5rem;transition:all 0.3s ease;cursor:pointer;">
                        <div class="stat-icon" style="font-size:2.5rem;margin-bottom:1rem;">💰</div>
                        <div class="stat-label" style="color:#9ca3cf;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.5rem;">Total Earnings</div>
                        <div class="stat-value" id="totalEarnings" style="font-size:2.5rem;font-weight:bold;background:linear-gradient(135deg,#00f7ff,#ffd966);-webkit-background-clip:text;background-clip:text;color:transparent;">₦0</div>
                        <div class="stat-sub" style="color:#4a5568;font-size:0.8rem;margin-top:0.5rem;">Lifetime commissions</div>
                    </div>
                    
                    <div class="stat-card" data-action="referrals" style="background:rgba(8,12,25,0.75);backdrop-filter:blur(10px);border:1px solid rgba(0,247,255,0.25);border-radius:1.5rem;padding:1.5rem;transition:all 0.3s ease;cursor:pointer;">
                        <div class="stat-icon" style="font-size:2.5rem;margin-bottom:1rem;">👥</div>
                        <div class="stat-label" style="color:#9ca3cf;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.5rem;">Total Referrals</div>
                        <div class="stat-value" id="totalReferrals" style="font-size:2.5rem;font-weight:bold;background:linear-gradient(135deg,#00f7ff,#ffd966);-webkit-background-clip:text;background-clip:text;color:transparent;">0</div>
                        <div class="stat-sub" style="color:#4a5568;font-size:0.8rem;margin-top:0.5rem;">Active referrals</div>
                    </div>
                    
                    <div class="stat-card" data-action="rank" style="background:rgba(8,12,25,0.75);backdrop-filter:blur(10px);border:1px solid rgba(0,247,255,0.25);border-radius:1.5rem;padding:1.5rem;transition:all 0.3s ease;cursor:pointer;">
                        <div class="stat-icon" style="font-size:2.5rem;margin-bottom:1rem;">🏆</div>
                        <div class="stat-label" style="color:#9ca3cf;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;margin-bottom:0.5rem;">Reseller Rank</div>
                        <div class="stat-value" id="resellerRank" style="font-size:2.5rem;font-weight:bold;background:linear-gradient(135deg,#00f7ff,#ffd966);-webkit-background-clip:text;background-clip:text;color:transparent;">🥉 Bronze</div>
                        <div class="stat-sub" id="rankNext" style="color:#4a5568;font-size:0.8rem;margin-top:0.5rem;">Loading...</div>
                    </div>
                </div>
                
                <!-- Referral Section -->
                <div class="referral-section" style="background:rgba(8,12,25,0.75);backdrop-filter:blur(10px);border:1px solid rgba(255,217,102,0.25);border-radius:1.5rem;padding:2rem;margin-bottom:2rem;">
                    <div class="section-title" style="font-size:1.5rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;">
                        <i class="fas fa-link" style="color:#ffd966;"></i>
                        Your Referral Link
                    </div>
                    <p style="color:#9ca3cf;margin-bottom:1rem;">Share this link with friends and earn 15% commission on every sale!</p>
                    <div class="referral-link-box" style="display:flex;gap:0.5rem;margin:1rem 0;flex-wrap:wrap;">
                        <input type="text" id="referralLinkInput" value="${referralLink}" readonly style="flex:1;background:rgba(0,0,0,0.5);border:1px solid rgba(0,247,255,0.3);border-radius:2rem;padding:0.8rem 1.2rem;color:white;font-family:monospace;font-size:0.9rem;min-width:250px;">
                        <button class="quantum-btn btn-primary" id="copyReferralBtn" style="padding:0.8rem 1.5rem;border-radius:2rem;font-weight:bold;cursor:pointer;transition:all 0.3s ease;border:none;font-size:0.9rem;display:inline-flex;align-items:center;gap:0.5rem;background:linear-gradient(135deg,#00f7ff,#b200ff);color:white;">
                            <i class="fas fa-copy"></i> Copy
                        </button>
                    </div>
                    <div class="action-buttons" style="display:flex;gap:1rem;margin-top:1rem;flex-wrap:wrap;">
                        <button class="quantum-btn btn-secondary" id="shareWhatsAppBtn" style="padding:0.8rem 1.5rem;border-radius:2rem;font-weight:bold;cursor:pointer;transition:all 0.3s ease;border:1px solid #25D366;font-size:0.9rem;display:inline-flex;align-items:center;gap:0.5rem;background:rgba(37,211,102,0.1);color:#25D366;">
                            <i class="fab fa-whatsapp"></i> WhatsApp
                        </button>
                        <button class="quantum-btn btn-secondary" id="shareTelegramBtn" style="padding:0.8rem 1.5rem;border-radius:2rem;font-weight:bold;cursor:pointer;transition:all 0.3s ease;border:1px solid #0088cc;font-size:0.9rem;display:inline-flex;align-items:center;gap:0.5rem;background:rgba(0,136,204,0.1);color:#0088cc;">
                            <i class="fab fa-telegram"></i> Telegram
                        </button>
                        <button class="quantum-btn btn-secondary" id="shareTwitterBtn" style="padding:0.8rem 1.5rem;border-radius:2rem;font-weight:bold;cursor:pointer;transition:all 0.3s ease;border:1px solid #1DA1F2;font-size:0.9rem;display:inline-flex;align-items:center;gap:0.5rem;background:rgba(29,161,242,0.1);color:#1DA1F2;">
                            <i class="fab fa-twitter"></i> Twitter
                        </button>
                    </div>
                </div>
                
                <!-- Commissions -->
                <div class="commissions-section" style="background:rgba(8,12,25,0.75);backdrop-filter:blur(10px);border:1px solid rgba(0,247,255,0.25);border-radius:1.5rem;padding:2rem;">
                    <div class="section-title" style="font-size:1.5rem;margin-bottom:1rem;display:flex;align-items:center;gap:0.5rem;">
                        <i class="fas fa-history" style="color:#00f7ff;"></i>
                        Recent Commissions
                    </div>
                    <div class="commissions-table" id="commissionsContainer">
                        <div style="text-align:center;padding:3rem;color:#9ca3cf;">
                            <span style="display:inline-block;width:20px;height:20px;border:2px solid rgba(0,247,255,0.2);border-top-color:#00f7ff;border-radius:50%;animation:spin 0.6s linear infinite;margin-right:0.5rem;vertical-align:middle;"></span>
                            Loading commissions...
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ===== MOUNT =====
export async function mountDashboard() {
    if (dashboardInitialized) {
        console.log('[Dashboard] Already initialized');
        return;
    }
    
    // Check reseller access
    const session = await requireReseller({
        redirectIfNot: '/reseller/login',
        redirectIfUnauthorized: '/reseller/login',
        redirectOnFail: true
    });
    
    if (!session) return;
    
    const container = document.getElementById('app');
    if (!container) {
        console.error('[Dashboard] #app container not found');
        return;
    }
    
    // Render
    container.innerHTML = renderDashboard();
    
    // Set up event listeners
    setupEventListeners(session.user);
    
    // Load data
    await loadDashboardData();
    
    // Set up auto-refresh
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(loadDashboardData, 30000);
    
    dashboardInitialized = true;
    
    // Emit event
    if (bus?.emit) {
        bus.emit(Events.PAGE_LOADED, { page: 'dashboard', timestamp: Date.now() });
    }
    
    console.log('[Dashboard] Initialized');
}

// ===== CLEANUP =====
export function cleanupDashboard() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
    dashboardInitialized = false;
    console.log('[Dashboard] Cleaned up');
}

// ===== EXPORT =====
export default {
    render: renderDashboard,
    mounted: mountDashboard,
    cleanup: cleanupDashboard
};

// ===== AUTO-INIT =====
if (typeof document !== 'undefined' && document.readyState === 'complete') {
    mountDashboard();
}
