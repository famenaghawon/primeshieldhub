// ======================================================================
// MAIN WORKER ENTRY POINT - v17.0 WITH FULL CHECKOUT SUPPORT + SIGNATURE + PUSH + CHAT + SHIPPING STATS
// ======================================================================
// ======================================================================
// DURABLE OBJECTS EXPORT
// ======================================================================
export { ChatRoom } from './durable-objects/ChatRoom.js';

import { SITE_URL, MAX_REQUEST_SIZE } from './utils/constants.js';
import { getCorsHeaders } from './middleware/cors.js';
import { addSecurityHeaders, getMimeType } from './middleware/security.js';
import { logEvent, logAudit } from './utils/logging.js';
import { sendEmail } from '../notifications.js';
import { ERROR_404_PAGE } from './pages/error-pages.js';
import { analyzeLogs, generateRecommendations } from '../ai.js';
import { runAutonomousSystem } from '../autonomous.js';
import * as dashboardHandler from './handlers/dashboard.js';
import { hashPassword, verifyPassword, generateJWT, verifyJWT } from './utils/crypto.js';

// ===== UNIFIED PAYROLL HANDLERS =====
import {
  handleWalletCredit,
  handleWalletWithdraw,
  handleAddBankAccount,
  handleGetBankAccounts,
  handleProcessPayroll,
  handlePayrollHistory,
  handleGetWallet,
  handlePublicVerification,
  handlePublicStaffVerification,
  handleUpdateBankAccount,
  handleDeleteBankAccount
} from './handlers/staff-payout.js';

// ===== UNIFIED AUTH HANDLERS =====
import {
  handleRequestOTP, 
  handleVerifyOTP, 
  handleLogin, 
  handleRegister,
  handleRegisterStaff, 
  handleMe, 
  handleLogout, 
  handleAuthCheck,
  handleCSRF, 
  handleChangePassword,
  handleEnable2FA, 
  handleDisable2FA, 
  handleVerify2FA,
  handleAdminRegister,
  handleAdminCheck,
  handleListAdmins
} from './handlers/auth.js';

// ===== UNIFIED ADMIN HANDLERS =====
import {
  handleAdminStats, 
  handleAdminStaffList, 
  handleAdminGetStaff,
  handleAdminApproveStaff, 
  handleAdminRejectStaff, 
  handleAdminUpdateStaff,
  handleAdminGenerateInvite, 
  handleAdminInvitations, 
  handleAdminRevokeInvite,
  handleAdminBranches, 
  handleAdminCreateBranch, 
  handleAdminAIInsights,
  handleAdminRunAutonomous,
  handleAdminPageGet, 
  handleAdminPageUpdate,
  handleAdminSettingsGet, 
  handleAdminSettingsUpdate, 
  handleAdminLogs,
  handleAdminOrders, 
  handleAdminOrderStatus, 
  handleAdminCustomers,
  handleAdminInvestors, 
  handleAdminInvestorStatus,
  handleAdminReceiptsList, 
  handleAdminReceiptsResend, 
  handleAdminReceiptDetail,
  handleAdminConfirmPayment,
  handleAdminCreateOrder,
  handleAdminSendPaymentLink
} from './handlers/admin-unified.js';

// ===== REVIEW HANDLERS =====
import {
  handleGetReviews,
  handleCreateReview,
  handleDeleteReview
} from './handlers/reviews.js';

// ===== STAFF HANDLERS =====
import {
  handleStaffMe, 
  handleStaffDashboard, 
  handleStaffLocation, 
  handleStaffCapture,
  handleStartSession, 
  handleCollectSession, 
  handlePauseSession, 
  handleResumeSession,
  handleGetBays, 
  handleAssignBay, 
  handleReleaseBay, 
  handleGetCustomer,
  handleTopCustomers, 
  handleStaffActivity, 
  handleStaffStats,
  handleClockIn, 
  handleClockOut
} from './handlers/staff.js';

// ===== PRODUCT & ORDER HANDLERS =====
import {
  handleGetProducts, 
  handleCreateProduct, 
  handleUpdateProduct, 
  handleDeleteProduct
} from './handlers/products.js';
import {
  handleOrderTracking, 
  handleOrderNotify, 
  handleOrderStatusUpdate,
  handleGetOrders, 
  handleCreateOrder
} from './handlers/orders.js';

// ===== CHARGING HANDLERS =====
import {
  handleChargingStart, 
  handleChargingTimer, 
  handleGetSession,
  handleChargingPause, 
  handleChargingResume, 
  handleChargingComplete,
  handleMarkReady, 
  handleChargingStats, 
  handleGetBays as handleChargingBays
} from './handlers/charging.js';

// ===== WHOLESALE HANDLERS =====
import {
  handleWholesaleVerifyCode, 
  handleWholesaleRequestAccess,
  handleWholesaleProducts, 
  handleWholesaleRequestQuote
} from './handlers/wholesale.js';

// ===== NOTIFICATION HANDLERS =====
import {
  handleSendSMS, 
  handleSendWhatsApp, 
  handleSendTelegram
} from './handlers/notifications.js';

// ===== AI HANDLERS =====
import { handleBrain, handleAIChat, handleAIAnalytics } from './handlers/ai.js';

// ===== STATS HANDLERS =====
import { handleInvestorStats, handleShippingStats } from './handlers/stats.js';

// ===== PROFILE HANDLERS =====
import {
  handleGetProfile, 
  handleUpdateProfile,
  handleUploadAvatar, 
  handleRemoveAvatar,
  handleGetDocuments, 
  handleUploadDocument, 
  handleDeleteDocument,
  handleAddSkill, 
  handleDeleteSkill,
  handleUpdateNotificationPrefs,
  handleGetSubscription,
  handleUpdateSubscription,
  handleGetIntegrations,
  handleUpdateIntegration,
  handleSavePreferences,
  handleDeleteProfile,
  handleGetReferrals,
  handleClaimReferralReward,
  handleInitializeSubscription,
  handleExportData
} from './handlers/profile.js';

// ===== SECURITY HANDLERS =====
import {
  handleSecurityAnomalies,
  handleVerifyBrowser
} from './handlers/security.js';
import {
  handleTheftCheck,
  handleBlockedAttempts,
  handleFraudScore,
  handleBlockIP,
  handleUnblockIP
} from './handlers/security-admin.js';

// ===== INVESTOR & CUSTOMER HANDLERS =====
import { handleInvestorExpressInterest } from './handlers/investor.js';
import { handleCustomerHistory } from './handlers/customer.js';

// ===== BRANCH HANDLERS =====
import {
  handleBranchRevenue, 
  handleBranchStaff, 
  handleBranchDetails,
  handleBranchSessions, 
  handleBranchAnalytics, 
  handleBranchLocations,
  handleBranchCompare
} from './handlers/branch.js';

// ===== WISHLIST, CART, CATEGORIES =====
import {
  handleGetWishlist,
  handleAddToWishlist,
  handleRemoveFromWishlist,
  handleUpdatePriority,
  handleUpdateNotes,
  handleSetPriceAlert,
  handleRemovePriceAlert,
  handleCheckPriceAlerts,
  handleShareWishlist,
  handleGetSharedWishlist,
  handleRevokeShare,
  handleBulkAddToWishlist,
  handleClearWishlist,
  handleWishlistStats
} from './handlers/wishlist.js';

import {
  handleGetCart,
  handleAddToCart,
  handleUpdateCartItem,
  handleRemoveFromCart,
  handleSaveForLater,
  handleMoveToCart,
  handleRemoveSavedItem,
  handleBulkAddToCart,
  handleClearCart,
  handleSyncCart,
  handleCartStats,
  handleApplyDiscount
} from './handlers/cart.js';

import {
  handleGetCategories,
  handleGetCategoryTree,
  handleGetCategory,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleCategoryStats,
  handleSeedCategories
} from './handlers/categories.js';

// ===== PAYMENT & RECEIPT HANDLERS =====
import { 
  handlePaymentIntent, 
  handleIntegrityToken, 
  handleCheckoutToken 
} from './handlers/payment.js';
import { handleSimplePaymentInitiate } from './handlers/payment-simple.js';
import { handlePaymentVerify } from './handlers/payment-verify.js';
import { handleFingerprintToken } from './handlers/fingerprint.js';
import { handleVerifyChallenge } from './handlers/verify-challenge.js';
import { handlePaystackWebhook } from './handlers/webhook.js';
import { handleAnomalies } from './handlers/anomalies.js';

import {
  handleReceiptDownload,
  handleReceiptByReference
} from './handlers/receipts.js';
import {
  handleReceiptEmail
} from './handlers/receipt-email.js';
import {
  handleReceiptWhatsApp
} from './handlers/receipt-whatsapp.js';
import {
  handleReceiptSMS
} from './handlers/receipt-sms.js';

// ===== FRONTEND HANDLER =====
import { handleFrontendLog } from './handlers/frontend.js';

// ===== BUILD MART HANDLERS =====
import {
  handleBuildMartDashboard,
  handleBuildMartCategories,
  handleBuildMartProducts,
  handleBuildMartProductDetail,
  handleBuildMartBrands,
  handleBuildMartCreateQuote,
  handleBuildMartCalculateQuote,
  handleBuildMartGetQuote,
  handleBuildMartRegisterContractor,
  handleBuildMartGetContractors,
  handleBuildMartDeliveryRegions,
  handleBuildMartCalculateDelivery,
  handleBuildMartFeaturedProducts,
  handleBuildMartCompareProducts,
  handleBuildMartBulkOrder,
  handleBuildMartCheckout
} from './handlers/buildmart.js';

// ======================================================================
// ===== CHAT HANDLERS - IMPORTANT: These must be imported =====
// ======================================================================
import {
  handleGetRooms,
  handleGetMessages,
  handleSendMessage,
  handleMarkRead,
  handleGetOnlineUsers,
  handleGetUnreadCount,
  // ===== NEW: PRIVATE CHAT HANDLERS =====
  handleGetUsersForChat,
  handleCreatePrivateRoom,
  handleGetPrivateRooms
} from './handlers/chat.js';

// ======================================================================
// ===== SHIPPING STATS HANDLER =====
// ======================================================================

/**
 * Handle shipping stats endpoint - returns real-time delivery statistics
 */
async function handleShippingStatsEndpoint(request, env, corsHeaders) {
    try {
        // Query D1 database for real stats
        const DB = env.DB;
        
        // Get active deliveries (orders in transit)
        const activeDeliveries = await DB.prepare(
            "SELECT COUNT(*) as count FROM orders WHERE status IN ('shipped', 'in_transit', 'processing')"
        ).first();
        
        // Get today's deliveries
        const todayDeliveries = await DB.prepare(
            "SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = DATE('now')"
        ).first();
        
        // Calculate on-time rate (delivered within estimated time)
        const onTimeResult = await DB.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN delivered_at <= estimated_delivery THEN 1 ELSE 0 END) as on_time
            FROM orders 
            WHERE status = 'delivered' 
            AND delivered_at IS NOT NULL 
            AND estimated_delivery IS NOT NULL
        `).first();
        
        const onTimeRate = onTimeResult && onTimeResult.total > 0 
            ? Math.round((onTimeResult.on_time / onTimeResult.total) * 100 * 10) / 10 
            : 98.7;
        
        // Calculate average delivery time (in hours)
        const avgTimeResult = await DB.prepare(`
            SELECT AVG(
                CAST((julianday(delivered_at) - julianday(created_at)) * 24 AS REAL)
            ) as avg_hours
            FROM orders 
            WHERE status = 'delivered' 
            AND delivered_at IS NOT NULL
        `).first();
        
        const avgDeliveryTime = avgTimeResult && avgTimeResult.avg_hours 
            ? Math.round(avgTimeResult.avg_hours * 10) / 10 
            : 3.2;
        
        // Get active vehicles (drivers currently active)
        const activeDrones = await DB.prepare(
            "SELECT COUNT(*) as count FROM drivers WHERE status = 'active' OR status = 'online'"
        ).first();
        
        // Get in-transit deliveries count
        const inFlight = await DB.prepare(
            "SELECT COUNT(*) as count FROM orders WHERE status = 'in_transit' OR status = 'shipped'"
        ).first();
        
        // Calculate success rate
        const successResult = await DB.prepare(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as delivered
            FROM orders 
            WHERE created_at >= DATE('now', '-30 days')
        `).first();
        
        const successRate = successResult && successResult.total > 0 
            ? Math.round((successResult.delivered / successResult.total) * 100 * 10) / 10 
            : 99.2;
        
        // Get average speed from drivers table if exists
        const avgSpeedResult = await DB.prepare(
            "SELECT AVG(speed) as avg_speed FROM driver_locations WHERE timestamp >= DATE('now', '-1 hour')"
        ).first();
        
        const avgSpeed = avgSpeedResult && avgSpeedResult.avg_speed 
            ? Math.round(avgSpeedResult.avg_speed) 
            : 65;
        
        // Get carbon saved (could be calculated from deliveries)
        const carbonResult = await DB.prepare(
            "SELECT SUM(carbon_saved) as total_carbon FROM orders WHERE status = 'delivered' AND DATE(created_at) = DATE('now')"
        ).first();
        
        const carbonSaved = carbonResult && carbonResult.total_carbon 
            ? Math.round(carbonResult.total_carbon) 
            : 142;
        
        // Calculate AI efficiency (route optimization metrics)
        // This could be based on distance vs actual traveled
        const aiEfficiencyResult = await DB.prepare(`
            SELECT 
                AVG((direct_distance / actual_distance) * 100) as efficiency
            FROM deliveries 
            WHERE actual_distance > 0 
            AND direct_distance > 0
            AND DATE(created_at) >= DATE('now', '-7 days')
        `).first();
        
        const aiEfficiency = aiEfficiencyResult && aiEfficiencyResult.efficiency 
            ? Math.round(aiEfficiencyResult.efficiency) 
            : 42;
        
        // Get average drone/delivery time
        const droneTimeResult = await DB.prepare(`
            SELECT AVG(
                CAST((julianday(delivered_at) - julianday(shipped_at)) * 60 AS REAL)
            ) as avg_minutes
            FROM orders 
            WHERE status = 'delivered' 
            AND shipped_at IS NOT NULL 
            AND delivered_at IS NOT NULL
        `).first();
        
        const droneDeliveryTime = droneTimeResult && droneTimeResult.avg_minutes 
            ? Math.round(droneTimeResult.avg_minutes) 
            : 28;
        
        // Get weather status from external API
        let weatherStatus = "Clear";
        try {
            const weatherApiKey = env.WEATHER_API_KEY;
            if (weatherApiKey) {
                const weatherResponse = await fetch(
                    `https://api.openweathermap.org/data/2.5/weather?q=Lagos&appid=${weatherApiKey}&units=metric`
                );
                if (weatherResponse.ok) {
                    const weatherData = await weatherResponse.json();
                    weatherStatus = weatherData.weather?.[0]?.main || "Clear";
                }
            }
        } catch (e) {
            console.warn('Weather API failed, using default');
        }
        
        // Build stats object
        const stats = {
            activeDeliveries: parseInt(activeDeliveries?.count || 0),
            onTimeRate: onTimeRate,
            avgDeliveryTime: avgDeliveryTime,
            aiEfficiency: aiEfficiency,
            activeDrones: parseInt(activeDrones?.count || 0),
            inFlight: parseInt(inFlight?.count || 0),
            avgSpeed: avgSpeed,
            todayDeliveries: parseInt(todayDeliveries?.count || 0),
            successRate: successRate,
            droneDeliveryTime: droneDeliveryTime,
            carbonSaved: carbonSaved,
            weatherStatus: weatherStatus
        };
        
        return new Response(
            JSON.stringify({ stats }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true',
                    'Cache-Control': 'public, max-age=60'  // Cache for 60 seconds
                }
            }
        );
        
    } catch (error) {
        console.error('Error fetching shipping stats:', error);
        
        // Return fallback data if database query fails
        const fallbackStats = {
            activeDeliveries: 147,
            onTimeRate: 98.7,
            avgDeliveryTime: 3.2,
            aiEfficiency: 42,
            activeDrones: 12,
            inFlight: 7,
            avgSpeed: 65,
            todayDeliveries: 48,
            successRate: 99.2,
            droneDeliveryTime: 28,
            carbonSaved: 142,
            weatherStatus: "Clear"
        };
        
        return new Response(
            JSON.stringify({ 
                stats: fallbackStats,
                warning: 'Using fallback data due to database error'
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Credentials': 'true'
                }
            }
        );
    }
}

// ======================================================================
// INITIALIZE PUSH TABLE ON STARTUP
// ======================================================================

async function initPushTable(env) {
  try {
    // Create the push_subscriptions table if it doesn't exist
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        endpoint TEXT UNIQUE NOT NULL,
        keys_p256dh TEXT NOT NULL,
        keys_auth TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    
    // Create indexes for faster lookups
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_push_user_id ON push_subscriptions(user_id)
    `).run();
    
    await env.DB.prepare(`
      CREATE INDEX IF NOT EXISTS idx_push_endpoint ON push_subscriptions(endpoint)
    `).run();
    
    console.log('[Push] Table initialized successfully');
    return { success: true };
  } catch (error) {
    console.error('[Push] Table init error:', error);
    return { success: false, error: error.message };
  }
}

// ======================================================================
// SIGNATURE CACHE FUNCTION
// ======================================================================

/**
 * Clear the signature products cache
 * This is called by the cron job every 6 hours
 */
async function updateSignatureCache(env) {
  try {
    if (env.PRODUCTS_CACHE) {
      await env.PRODUCTS_CACHE.delete('signature_products');
      console.log('✅ Signature products cache cleared');
    } else {
      console.log('⚠️ PRODUCTS_CACHE not available, skipping cache clear');
    }
  } catch (e) {
    console.error('❌ Failed to clear signature cache:', e);
  }
}

// ======================================================================
// DISCOUNT VALIDATION FUNCTIONS
// ======================================================================

/**
 * Validate a discount code for a user
 */
async function validateDiscount(env, userId, email, code, subtotal) {
  try {
    // 1. Check if code exists and is active
    const discount = await env.DB.prepare(
      "SELECT * FROM discount_codes WHERE code = ? AND active = 1"
    ).bind(code.toUpperCase()).first();
    
    if (!discount) {
      return { valid: false, error: 'Invalid discount code' };
    }

    // 2. Check if user already used this code
    const used = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM user_discount_usage WHERE user_id = ? AND discount_code = ?"
    ).bind(userId, code.toUpperCase()).first();

    if (used && used.count > 0) {
      return { valid: false, error: 'You have already used this discount code' };
    }

    // 3. Check max uses globally
    if (discount.max_uses && discount.max_uses > 0) {
      const totalUsed = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM user_discount_usage WHERE discount_code = ?"
      ).bind(code.toUpperCase()).first();
      
      if (totalUsed && totalUsed.count >= discount.max_uses) {
        return { valid: false, error: 'This discount code has reached its usage limit' };
      }
    }

    // 4. Check minimum order amount
    if (discount.min_amount && discount.min_amount > 0 && subtotal < discount.min_amount) {
      return { 
        valid: false, 
        error: `Minimum order amount of ₦${discount.min_amount.toLocaleString()} required for this code` 
      };
    }

    // 5. Special validation for WELCOME10 - first order only
    if (code.toUpperCase() === 'WELCOME10') {
      const orders = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE customerEmail = ? AND status != 'cancelled'"
      ).bind(email).first();
      
      if (orders && orders.count > 0) {
        return { 
          valid: false, 
          error: 'Welcome discount is for first-time customers only' 
        };
      }
    }

    // FIXED: Also validate NEW5 and NEWCUSTOMER for first-time customers
    if (code.toUpperCase() === 'NEW5' || code.toUpperCase() === 'NEWCUSTOMER') {
      const newCustOrders = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE customerEmail = ? AND status != 'cancelled'"
      ).bind(email).first();

      if (newCustOrders && newCustOrders.count > 0) {
        return {
          valid: false,
          error: 'This discount is for first-time customers only'
        };
      }
    }

    // 6. Check if discount is expired (if expiry_date exists)
    if (discount.expiry_date) {
      const now = new Date();
      const expiry = new Date(discount.expiry_date);
      if (now > expiry) {
        return { valid: false, error: 'This discount code has expired' };
      }
    }

    // All validations passed
    return { 
      valid: true, 
      discount: {
        id: discount.id,
        code: discount.code,
        type: discount.type,
        value: discount.value,
        min_amount: discount.min_amount,
        max_uses: discount.max_uses,
        label: discount.label || discount.code
      }
    };
  } catch (error) {
    console.error('❌ Discount validation error:', error);
    return { valid: false, error: 'Error validating discount code' };
  }
}

/**
 * Record usage of a discount code
 */
async function recordDiscountUsage(env, userId, code, orderId) {
  try {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "INSERT INTO user_discount_usage (id, user_id, discount_code, order_id, used_at) VALUES (?, ?, ?, ?, unixepoch())"
    ).bind(id, userId, code.toUpperCase(), orderId).run();
    return { success: true };
  } catch (error) {
    console.error('❌ Error recording discount usage:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Apply automatic rules (free shipping, new customer discount)
 */
async function applyAutomaticRules(env, subtotal, email, userId) {
  let shipping = 3000; // Default shipping
  let discount = 0;
  let discountLabel = '';
  
  // Free shipping over ₦50,000
  if (subtotal >= 50000) {
    shipping = 0;
  }
  
  // New customer discount (5% on first order)
  if (email) {
    try {
      const orders = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM orders WHERE customerEmail = ? AND status != 'cancelled'"
      ).bind(email).first();
      
      if (!orders || orders.count === 0) {
        discount = Math.round(subtotal * 0.05);
        discountLabel = 'New Customer Discount (5%)';
      }
    } catch (e) {
      // Silent fail - don't block checkout
    }
  }
  
  return { 
    shipping, 
    discount, 
    discountLabel,
    subtotal_after_discount: subtotal - discount,
    total: subtotal - discount + shipping
  };
}

// ======================================================================
// AUTH HELPER - ONE SOURCE OF TRUTH
// ======================================================================
async function requireAuth(request, env, allowedRoles = []) {
    try {
        let token = null;
        
        const authHeader = request.headers.get("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }
        
        if (!token) {
            const cookieHeader = request.headers.get("Cookie") || "";
            const cookies = {};
            cookieHeader.split(';').forEach(cookie => {
                const [name, value] = cookie.trim().split('=');
                if (name && value) cookies[name] = value;
            });
            token = cookies["__Host-auth"] || cookies["auth"] || cookies["token"];
        }
        
        if (!token) return null;
        
        const payload = await verifyToken(token, env);
        if (!payload || !payload.id) return null;
        
        if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
            return null;
        }
        
        return { id: payload.id, role: payload.role, email: payload.email };
    } catch (e) {
        console.error('❌ requireAuth error:', e);
        return null;
    }
}

// ======================================================================
// FRANCHISE AUTH — server-side gate + scope resolver
// ======================================================================
// A franchisee is identified by:
//   1. A valid JWT (from cookie __Host-franchise-auth OR Authorization: Bearer)
//   2. users.role = 'franchise'
//   3. A matching franchises row with status = 'active'
//
// Returns: { userId, franchiseId, tier, email, name } on success
//          null on any failure
//
async function requireFranchise(request, env) {
  try {
    // --- 1. Extract token from cookie OR Authorization header ---
    let token = null;

    const cookieHeader = request.headers.get("Cookie") || "";
    const cookies = {};
    cookieHeader.split(';').forEach(c => {
      const [name, ...rest] = c.trim().split('=');
      if (name) cookies[name] = rest.join('=');
    });
    token = cookies["__Host-franchise-auth"] || cookies["franchise_auth"] || null;

    if (!token) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      }
    }

    if (!token) return null;

    // --- 2. Verify JWT signature + expiration ---
    const payload = await verifyToken(token, env);
    if (!payload || !payload.id) return null;

    // --- 3. Confirm user exists with role 'franchise' ---
    const user = await env.DB.prepare(
      "SELECT id, email, name, role, status, must_change_password FROM users WHERE id = ?"
    ).bind(payload.id).first();

    if (!user) return null;
    if (user.role !== 'franchise' && user.role !== 'admin') return null;
    if (user.status && user.status !== 'active') return null;

    // --- 4. Load franchise record (admin bypasses for support access) ---
    if (user.role === 'admin') {
      return {
        userId: user.id,
        franchiseId: null,   // admin has no single franchise
        tier: 'admin',
        email: user.email,
        name: user.name,
        isAdmin: true,
      };
    }

    const franchise = await env.DB.prepare(
      "SELECT id, tier, status, business_name FROM franchises WHERE user_id = ?"
    ).bind(user.id).first();

    if (!franchise) return null;
    if (franchise.status !== 'active') return null;

    return {
      userId: user.id,
      franchiseId: franchise.id,
      tier: franchise.tier,
      businessName: franchise.business_name,
      email: user.email,
      name: user.name,
      isAdmin: false,
      mustChangePassword: user.must_change_password === 1,
    };
  } catch (e) {
    console.error('❌ requireFranchise error:', e);
    return null;
  }
}

// ======================================================================
// ISSUE A FRANCHISE JWT + SET COOKIE
// ======================================================================
async function issueFranchiseToken(env, userId, email, extra = {}) {
  const secret = env.GATEWAY_SECRET || env.JWT_SECRET;
  if (!secret) throw new Error('JWT secret not configured');

  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    id: userId,
    email: email,
    role: 'franchise',
    iat: now,
    exp: now + (60 * 60 * 24 * 7), // 7 days
    ...extra,
  };

  const b64url = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const headerB64 = b64url(header);
  const payloadB64 = b64url(payload);
  const signingInput = `headerB64.{payloadB64}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const jwt = `signingInput.{sigB64}`;

  const cookie = [
    `__Host-franchise-auth=${jwt}`,
    'Path=/',
    'Secure',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=604800', // 7 days
  ].join('; ');

  return { jwt, cookie };
}


// ======================================================================
// ENHANCED JWT VERIFICATION
// ======================================================================
async function verifyToken(token, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    let payload = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    while (payload.length % 4) payload += '=';

    const decoded = JSON.parse(atob(payload));

    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    const jwtSecret = env.GATEWAY_SECRET || env.JWT_SECRET;

    if (jwtSecret) {
      try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          'raw',
          encoder.encode(jwtSecret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['verify']
        );

        let signature = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
        while (signature.length % 4) signature += '=';
        const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

        const isValid = await crypto.subtle.verify(
          'HMAC',
          key,
          sigBytes,
          encoder.encode(`headerB64.{payloadB64}`)
        );

        if (!isValid) return null;
      } catch (e) {
        return null;
      }
    }

    if (!decoded.id) return null;
    return decoded;
  } catch (e) {
    console.error('Token verification error:', e);
    return null;
  }
}

// ======================================================================
// UTILITY HELPERS
// ======================================================================
function errorResponse(message, status = 404, corsHeaders, routePath) {
  return new Response(JSON.stringify({ error: message, path: routePath }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

async function getTableColumns(env, tableName) {
  try {
    const result = await env.DB.prepare(`PRAGMA table_info(${tableName})`).all();
    return (result.results || []).map(c => c.name);
  } catch (e) {
    return [];
  }
}

async function getOrderColumn(env, tableName, preferred = 'createdAt') {
    const columns = await getTableColumns(env, tableName);
    if (columns.includes(preferred)) return preferred;
    if (columns.includes('created_at')) return 'created_at';
    if (columns.includes('createdAt')) return 'createdAt';
    if (columns.includes('timestamp')) return 'timestamp';
    if (columns.includes('updated_at')) return 'updated_at';
    return 'id';
}

async function getOrderClause(env, tableName, direction = 'DESC') {
    const col = await getOrderColumn(env, tableName);
    return `ORDER BY ${col} ${direction}`;
}

function sanitizeUpdateData(data) {
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '' && value !== 'undefined' &&
        !(typeof value === 'string' && value.trim() === '')) {
      if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
        sanitized[key] = Number.isInteger(parseFloat(value)) ? parseInt(value, 10) : parseFloat(value);
      } else {
        sanitized[key] = value;
      }
    }
  }
  return sanitized;
}

async function updateRecord(env, tableName, id, data, idColumn = 'id') {
  try {
    const sanitized = sanitizeUpdateData(data);
    if (Object.keys(sanitized).length === 0) return { success: true, message: 'No fields to update' };
    const setClause = Object.keys(sanitized).map(k => `${k} = ?`).join(', ');
    const values = Object.values(sanitized);
    values.push(id);
    await env.DB.prepare(`UPDATE ${tableName} SET ${setClause} WHERE ${idColumn} = ?`).bind(...values).run();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function deleteRecord(env, tableName, id, idColumn = 'id') {
  try {
    await env.DB.prepare(`DELETE FROM ${tableName} WHERE ${idColumn} = ?`).bind(id).run();
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ======================================================================
// RESELLER TIER MANAGEMENT
// ======================================================================
async function checkAndUpgradeResellerTier(env, resellerId) {
  try {
    const reseller = await env.DB.prepare(
      "SELECT total_earnings, rank FROM resellers WHERE id = ?"
    ).bind(resellerId).first();
    
    if (!reseller) return;
    
    const earnings = reseller.total_earnings || 0;
    let newTier = 'bronze';
    
    // Tier thresholds based on total earnings
    if (earnings >= 5000000) newTier = 'platinum';
    else if (earnings >= 1000000) newTier = 'gold';
    else if (earnings >= 250000) newTier = 'silver';
    else newTier = 'bronze';
    
    if (newTier !== reseller.rank) {
      await env.DB.prepare(
        "UPDATE resellers SET rank = ? WHERE id = ?"
      ).bind(newTier, resellerId).run();
      
      console.log(`[Tier Upgrade] Reseller ${resellerId} upgraded from ${reseller.rank} to ${newTier}`);
      
      // Update the associated reseller_codes tier as well
      await env.DB.prepare(
        "UPDATE reseller_codes SET tier = ? WHERE tier = ? AND active = 1"
      ).bind(newTier, reseller.rank).run().catch(() => {});
    }
  } catch (e) {
    console.error('[Tier Upgrade] Failed:', e);
  }
}


// ======================================================================
// HTML ROUTES - All static HTML pages
// ======================================================================
const HTML_ROUTES = [
  { path: '/', file: 'index.html' },
  { path: '/index.html', file: 'index.html' },
  { path: '/categories.html', file: 'categories.html' },
  { path: '/categories', file: 'categories.html' },
  { path: '/products', file: 'products.html' },
  { path: '/products.html', file: 'products.html' },
  { path: '/wholesale.html', file: 'wholesale.html' },
  { path: '/wholesale', file: 'wholesale.html' },
  { path: '/reseller.html', file: 'reseller.html' },
  { path: '/reseller', file: 'reseller.html' },
  { path: '/cart.html', file: 'cart.html' },
  { path: '/cart', file: 'cart.html' },
  { path: '/wishlist.html', file: 'wishlist.html' },
  { path: '/wishlist', file: 'wishlist.html' },
  { path: '/profile.html', file: 'profile.html' },
  { path: '/profile', file: 'profile.html' },
  { path: '/dashboard.html', file: 'dashboard.html' },
  { path: '/dashboard', file: 'dashboard.html' },
  { path: '/reseller-dashboard.html', file: 'reseller-dashboard.html' },
  { path: '/reseller-dashboard', file: 'reseller-dashboard.html' },
  { path: '/payment.html', file: 'payment.html' },
  { path: '/account.html', file: 'account.html' },
  { path: '/account', file: 'account.html' },
  { path: '/support.html', file: 'support.html' },
  { path: '/support', file: 'support.html' },
  { path: '/addresses.html', file: 'addresses.html' },
  { path: '/addresses', file: 'addresses.html' },
  { path: '/payment', file: 'payment.html' },
  { path: '/payment-gateway', file: 'payment.html' },
  { path: '/checkout', file: 'checkout.html' },
  { path: '/payment-methods', file: 'payment-methods.html' },
  { path: '/payment-methods.html', file: 'payment-methods.html' },
  { path: '/payment-success', file: 'payment-success.html' },
  { path: '/payment-success.html', file: 'payment-success.html' },
  { path: '/admin-maintenance', file: 'admin-maintenance.html' },
  { path: '/admin-maintenance.html', file: 'admin-maintenance.html' },
  { path: '/admin', file: 'admin-maintenance.html' },
  { path: '/admin/', file: 'admin-maintenance.html' },
  { path: '/admin-dashboard', file: 'admin-maintenance.html' },
  { path: '/admin-login', file: 'admin-login.html' },
  { path: '/staff', file: 'staff-portal.html' },
  { path: '/staff/', file: 'staff-portal.html' },
  { path: '/staff/dashboard', file: 'staff-dashboard.html' },
  { path: '/staff/profile', file: 'staff-profile.html' },
  { path: '/staff/settings', file: 'staff-settings.html' },
  { path: '/staff/activity', file: 'staff-activity.html' },
  { path: '/staff/activity-log', file: 'staff-activity.html' },
  { path: '/staff/login', file: 'staff-login.html' },
  { path: '/staff/login.html', file: 'staff-login.html' },
  { path: '/staff/register', file: 'staff-register.html' },
  { path: '/staff/register.html', file: 'staff-register.html' },
  { path: '/staff/forgot-password', file: 'staff-forgot-password.html' },
  { path: '/staff/forgot-password.html', file: 'staff-forgot-password.html' },
  { path: '/buildmart', file: 'buildmart.html' },
  { path: '/buildmart/', file: 'buildmart.html' },
  { path: '/buildmart.html', file: 'buildmart.html' },
  { path: '/assistant.html', file: 'assistant.html' },
  { path: '/track-order.html', file: 'track-order.html' },
  { path: '/faq.html', file: 'faq.html' },
  { path: '/contact.html', file: 'contact.html' },
  { path: '/shipping.html', file: 'shipping.html' },
  { path: '/returns.html', file: 'returns.html' },
  { path: '/founder.html', file: 'founder.html' },
  { path: '/founder', file: 'founder.html' },
  { path: '/company.html', file: 'company.html' },
  { path: '/company', file: 'company.html' },
  { path: '/leadership.html', file: 'leadership.html' },
  { path: '/leadership', file: 'leadership.html' },
  { path: '/mission.html', file: 'mission.html' },
  { path: '/vision.html', file: 'vision.html' },
  { path: '/press.html', file: 'press.html' },
  { path: '/media-kit.html', file: 'media-kit.html' },
  { path: '/articles.html', file: 'articles.html' },
  { path: '/biography.html', file: 'biography.html' },
  { path: '/biography', file: 'biography.html' },
  { path: '/knowledge-graph.html', file: 'knowledge-graph.html' },
  { path: '/knowledge-graph', file: 'knowledge-graph.html' },
  { path: '/founder-letter.html', file: 'founder-letter.html' },
  { path: '/recognition.html', file: 'recognition.html' },
  { path: '/freedom-evbakoe-amenaghawon', file: 'freedom-evbakoe-amenaghawon.html' },
  { path: '/freedom-evbakoe-amenaghawon.html', file: 'freedom-evbakoe-amenaghawon.html' },
  { path: '/investor-hub', file: 'investor-hub.html' },
  { path: '/investment-form', file: 'investment-form.html' },
  { path: '/equity', file: 'equity.html' },
  { path: '/loan', file: 'loan.html' },
  { path: '/login', file: 'login.html' },
  { path: '/login.html', file: 'login.html' },
  { path: '/register', file: 'register.html' },
  { path: '/signup', file: 'register.html' },
  { path: '/articles/why-i-founded-primeshieldhub.html', file: 'articles/why-i-founded-primeshieldhub.html' },
  { path: '/privacy.html', file: 'privacy.html' },
  { path: '/terms.html', file: 'terms.html' },
  { path: '/sitemap.xml', file: 'sitemap.xml' },
  { path: '/favicon.png', file: 'favicon.png' },
  { path: '/apple-touch-icon.png', file: 'apple-touch-icon.png' },
  { path: '/quantum-manifest.json', file: 'quantum-manifest.json' },
  { path: '/company_logo.png', file: 'company_logo.png' },
  { path: '/photograph.webp', file: 'photograph.webp' },
  { path: '/cac.webp', file: 'cac.webp' },
  { path: '/sw.js', file: 'sw.js' },
  { path: '/js/config.js', file: 'js/config.js' },
  { path: '/js/main.js', file: 'js/main.js' },
  { path: '/js/auth-storage.js', file: 'js/auth-storage.js' },
  { path: '/js/auth.js', file: 'js/auth.js' },
  { path: '/js/sophisticated/fraud-engine/fingerprint.js', file: 'js/sophisticated/fraud-engine/fingerprint.js' },
  { path: '/css/quantum.css', file: 'css/quantum.css' },

  // ===== FRANCHISE ROUTES =====
  { path: '/franchise.html', file: 'franchise.html' },
  { path: '/franchise', file: 'franchise.html' },
  { path: '/franchise/', file: 'franchise.html' },
  { path: '/franchise/apply.html', file: 'franchise/apply.html' },
  { path: '/franchise/apply', file: 'franchise/apply.html' },
  { path: '/franchise/login.html', file: 'franchise/login.html' },
  { path: '/franchise/login', file: 'franchise/login.html' },
  { path: '/franchise/dashboard.html', file: 'franchise/dashboard.html' },
  { path: '/franchise/dashboard', file: 'franchise/dashboard.html' },
  { path: '/franchise/forgot-password.html', file: 'franchise/forgot-password.html' },
  { path: '/franchise/forgot-password', file: 'franchise/forgot-password.html' },
  { path: '/franchise/change-password.html', file: 'franchise/change-password.html' },
  { path: '/franchise/change-password', file: 'franchise/change-password.html' },
  { path: '/franchise/orders.html', file: 'franchise/orders.html' },
  { path: '/franchise/orders', file: 'franchise/orders.html' },
  { path: '/franchise/inventory.html', file: 'franchise/inventory.html' },
  { path: '/franchise/inventory', file: 'franchise/inventory.html' },
  { path: '/franchise/customers.html', file: 'franchise/customers.html' },
  { path: '/franchise/customers', file: 'franchise/customers.html' },
  { path: '/franchise/settings.html', file: 'franchise/settings.html' },
  { path: '/franchise/settings', file: 'franchise/settings.html' },
  { path: '/franchise/analytics.html', file: 'franchise/analytics.html' },
  { path: '/franchise/analytics', file: 'franchise/analytics.html' },
  { path: '/franchise/reports.html', file: 'franchise/reports.html' },
  { path: '/franchise/reports', file: 'franchise/reports.html' },
  { path: '/franchise/staff.html', file: 'franchise/staff.html' },
  { path: '/franchise/staff', file: 'franchise/staff.html' },
  { path: '/franchise/marketing.html', file: 'franchise/marketing.html' },
  { path: '/franchise/marketing', file: 'franchise/marketing.html' },
  { path: '/franchise/messages.html', file: 'franchise/messages.html' },
  { path: '/franchise/messages', file: 'franchise/messages.html' },
  { path: '/franchise/training.html', file: 'franchise/training.html' },
  { path: '/franchise/training', file: 'franchise/training.html' },
];

// ======================================================================
// MAIN WORKER EXPORT
// ======================================================================
export async function handleRequest(request, env, ctx) {
    if (!env._push_initialized) {
      env._push_initialized = true;
      ctx.waitUntil(initPushTable(env));
    }
    const url = new URL(request.url);
    let path = url.pathname;

    const origin = request.headers.get("Origin");
    const corsHeaders = getCorsHeaders(origin);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const fingerprint = request.headers.get("x-device-fingerprint") || "none";

    const requestInfo = {
      ip, path, method: request.method,
      userAgent: request.headers.get("user-agent") || "",
      origin: origin || "",
      fingerprint
    };

    let routePath = path;
    if (path.startsWith('/api/api/')) routePath = path.replace('/api/api/', '/api/');
    else if (path.startsWith('/api//api/')) routePath = path.replace('/api//api/', '/api/');

    // ======================================================================
    // CORS PREFLIGHT HANDLING - FIXED
    // ======================================================================
    if (request.method === 'OPTIONS') {
      // Handle shipping stats preflight
      if (routePath === '/api/shipping/stats') {
        return new Response(null, { 
          status: 204, 
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
          }
        });
      }
      
      // Handle analytics preflight
      if (routePath === '/api/analytics/events' || routePath === '/api/analytics') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin || 'https://primeshieldhub.com',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-device-fingerprint, Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
          }
        });
      }
      
      // Handle all other preflight requests
      return new Response(null, { 
        status: 204, 
        headers: {
          'Access-Control-Allow-Origin': origin || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-device-fingerprint, x-csrf-token, x-integrity-token, x-primeshield-auth, Cookie, x-user-email, x-checkout-session, x-session-id, x-branch-id, x-device-signature, x-device-key, x-behavior',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    // ======================================================================
    // ANALYTICS ROUTES - FIXED CORS
    // ======================================================================
    if (routePath === "/api/analytics/events" || routePath === "/api/analytics") {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': origin || 'https://primeshieldhub.com',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-device-fingerprint, Authorization',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400'
          }
        });
      }
     
      if (request.method === 'GET') {
        return new Response(JSON.stringify({
          status: "ok",
          message: "Analytics endpoint is ready. Use POST to send events.",
          timestamp: Date.now(),
          version: "1.0"
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin || 'https://primeshieldhub.com',
            "Access-Control-Allow-Credentials": "true",
            'Cache-Control': 'no-cache'
          }
        });
      }
     
      if (request.method === 'POST') {
        try {
          let body;
          try { body = await request.json(); } catch (e) { body = {}; }
         
          const { sessionId, userId, events, event, data } = body || {};
          let eventsArray = events || [];
          if (event) { eventsArray = [{ type: event, data: data || {} }]; }
         
          if (!eventsArray || eventsArray.length === 0) {
            return new Response(JSON.stringify({
              accepted: true,
              message: "Analytics ping received",
              timestamp: Date.now()
            }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": origin || 'https://primeshieldhub.com',
                "Access-Control-Allow-Credentials": "true"
              }
            });
          }

          if (!Array.isArray(eventsArray)) {
            return new Response(JSON.stringify({
              accepted: false,
              error: "Invalid events data. Expected array."
            }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": origin || 'https://primeshieldhub.com',
                "Access-Control-Allow-Credentials": "true"
              }
            });
          }

          console.log(`📊 Analytics: ${eventsArray.length} events from ${sessionId || 'anonymous'}`);

          if (env.DB) {
            try {
              await env.DB.prepare(`
                CREATE TABLE IF NOT EXISTS analytics_events (
                  id TEXT PRIMARY KEY,
                  session_id TEXT,
                  user_id TEXT,
                  event_type TEXT,
                  event_data TEXT,
                  timestamp INTEGER,
                  url TEXT,
                  user_agent TEXT,
                  fingerprint TEXT,
                  ip TEXT,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
              `).run().catch(() => {});

              for (const evt of eventsArray.slice(0, 50)) {
                try {
                  const id = crypto.randomUUID ? crypto.randomUUID() : 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
                  await env.DB.prepare(`
                    INSERT INTO analytics_events (id, session_id, user_id, event_type, event_data, timestamp, url, user_agent, fingerprint, ip)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  `).bind(
                    id,
                    sessionId || null,
                    userId || null,
                    evt.type || 'unknown',
                    JSON.stringify(evt.data || {}),
                    evt.timestamp || Date.now(),
                    evt.url || null,
                    evt.userAgent || null,
                    evt.fingerprint || null,
                    request.headers.get("CF-Connecting-IP") || null
                  ).run().catch(() => {});
                } catch (e) {}
              }
            } catch (dbError) {
              console.debug('[Analytics] DB storage skipped:', dbError.message);
            }
          }

          return new Response(JSON.stringify({
            accepted: true,
            count: eventsArray.length,
            message: `Received ${eventsArray.length} events`,
            timestamp: Date.now()
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": origin || 'https://primeshieldhub.com',
              "Access-Control-Allow-Credentials": "true"
            }
          });

        } catch (error) {
          console.error('[Analytics] Error:', error.message);
          return new Response(JSON.stringify({
            accepted: false,
            error: error.message || 'Failed to process analytics'
          }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": origin || 'https://primeshieldhub.com',
              "Access-Control-Allow-Credentials": "true"
            }
          });
        }
      }

      return new Response(JSON.stringify({
        error: "Method not allowed. Use GET, POST, or OPTIONS.",
        allowed: ["GET", "POST", "OPTIONS"]
      }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          'Allow': 'GET, POST, OPTIONS',
          "Access-Control-Allow-Origin": origin || 'https://primeshieldhub.com',
          "Access-Control-Allow-Credentials": "true"
        }
      });
    }

    // ======================================================================
    // REQUEST SIZE LIMIT
    // ======================================================================
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentLength = parseInt(request.headers.get("Content-Length") || "0");
      const contentType = request.headers.get('content-type') || '';

      const maxSize = contentType.includes('multipart/form-data')
        ? (MAX_REQUEST_SIZE * 2)
        : MAX_REQUEST_SIZE;

      if (contentLength > maxSize) {
        return new Response(JSON.stringify({ error: "Request too large" }), {
          status: 413, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // REDIRECT WRONG PATHS TO CORRECT ONES
    // ======================================================================
    if (routePath === '/js/sophisticated/product-store.js') {
        return Response.redirect('/js/product-store.js', 301);
    }
    if (routePath === '/js/sophisticated/cart-store.js') {
        return Response.redirect('/js/cart-store.js', 301);
    }
    if (routePath === '/js/sophisticated/config.js') {
        return Response.redirect('/js/config.js', 301);
    }
    if (routePath === '/js/sophisticated/auth.js') {
        return Response.redirect('/js/auth.js', 301);
    }
    if (routePath === '/js/sophisticated/events.js') {
        return Response.redirect('/js/events.js', 301);
    }
    if (routePath === '/js/sophisticated/ai-brain-client.js') {
        return Response.redirect('/js/ai-brain-client.js', 301);
    }

    // ======================================================================
    // FRANCHISE HTML GATE — block /franchise/* unless authenticated
    // ======================================================================
    // Public franchise routes (no auth required):
    const FRANCHISE_PUBLIC = new Set([
      '/franchise',
      '/franchise/',
      '/franchise.html',
      '/franchise/apply',
      '/franchise/apply.html',
      '/franchise/login',
      '/franchise/login.html',
      '/franchise/forgot-password',
      '/franchise/forgot-password.html',
      '/franchise/change-password',
      '/franchise/change-password.html',
    ]);

    if (routePath.startsWith('/franchise') && !FRANCHISE_PUBLIC.has(routePath)) {
      const franchise = await requireFranchise(request, env);
      if (!franchise) {
        // Not authenticated → redirect to login
        return Response.redirect(SITE_URL + '/franchise/login', 302);
      }

      // Force password change on first login (non-admin only, allow the change-password page itself)
      if (franchise.mustChangePassword && !franchise.isAdmin &&
          routePath !== '/franchise/change-password' &&
          routePath !== '/franchise/change-password.html') {
        return Response.redirect(SITE_URL + '/franchise/change-password', 302);
      }

      // Authenticated — continue to HTML_ROUTES serve below
    }

    // ======================================================================
    // SERVE STATIC HTML FILES
    // ======================================================================
    for (const route of HTML_ROUTES) {
      if (routePath === route.path || routePath === route.path + '/') {
        try {
          const file = await env.STORAGE?.get(`public/${route.file}`);
          if (file) {
            return new Response(file.body, {
              status: 200,
              headers: {
                'Content-Type': 'text/html',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Credentials': 'true',
                'Cache-Control': 'public, max-age=0, must-revalidate',
                'CDN-Cache-Control': 'no-store',
                'Cloudflare-CDN-Cache-Control': 'no-store'
              }
            });
          }
          try {
            const localFile = await Bun.file(`public/${route.file}`).text();
            return new Response(localFile, {
              status: 200,
              headers: {
                'Content-Type': 'text/html',
                ...corsHeaders
              }
            });
          } catch (e) {}
        } catch (e) {
          console.error('File serve error:', e);
        }
      }
    }

    // ======================================================================
    // SERVE STATIC FILES FROM R2
    // ======================================================================
    if (routePath.startsWith('/files/') || routePath.startsWith('/js/') || routePath.startsWith('/css/') || routePath.startsWith('/assets/')) {
      try {
        const key = routePath.replace(/^\//, '');
        const object = await env.STORAGE?.get(key);
        if (!object) {
          return errorResponse('File not found', 404, corsHeaders, routePath);
        }

        let contentType = 'application/octet-stream';
        if (routePath.endsWith('.js') || routePath.endsWith('.mjs')) contentType = 'application/javascript';
        if (routePath.endsWith('.css')) contentType = 'text/css';
        if (routePath.endsWith('.json')) contentType = 'application/json';
        if (routePath.endsWith('.png')) contentType = 'image/png';
        if (routePath.endsWith('.jpg') || routePath.endsWith('.jpeg')) contentType = 'image/jpeg';
        if (routePath.endsWith('.webp')) contentType = 'image/webp';
        if (routePath.endsWith('.svg')) contentType = 'image/svg+xml';
        if (routePath.endsWith('.html')) contentType = 'text/html';
        if (routePath.endsWith('.woff')) contentType = 'font/woff';
        if (routePath.endsWith('.woff2')) contentType = 'font/woff2';
        if (routePath.endsWith('.ttf')) contentType = 'font/ttf';
        if (object.httpMetadata?.contentType) {
          contentType = object.httpMetadata.contentType;
        }
         
        const cacheMaxAge = routePath.includes('fingerprint.js') ? 3600 : 86400;
         
        return new Response(object.body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Cache-Control': `public, max-age=${cacheMaxAge}, immutable`,
            ...corsHeaders
          }
        });
      } catch (error) {
        console.error('Static file serve error:', error);
        return new Response('Error loading file', {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    }

    // ======================================================================
    // STAFF VERIFICATION PAGE
    // ======================================================================
    if (routePath.startsWith('/staff/verify/')) {
      try {
        const object = await env.STORAGE?.get('staff/verify/index.html');
        if (!object) {
          return errorResponse('Verification page not found', 404, corsHeaders, routePath);
        }
        return new Response(object.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (error) {
        return new Response('Error loading page', {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    }

    // ======================================================================
    // PAYSLIP VERIFICATION PAGE
    // ======================================================================
    if (routePath.startsWith('/payslips/verify/')) {
      try {
        const object = await env.STORAGE?.get('payslips/verify/index.html');
        if (!object) {
          return errorResponse('Verification page not found', 404, corsHeaders, routePath);
        }
        return new Response(object.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (error) {
        return new Response('Error loading verification page', {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    }

    // ======================================================================
    // INDIVIDUAL PAYSLIPS FROM R2
    // ======================================================================
    if (routePath.startsWith('/payslips/')) {
      try {
        const key = routePath.replace(/^\//, '');
        const object = await env.STORAGE?.get(key);
        if (!object) {
          return errorResponse('Payslip not found', 404, corsHeaders, routePath);
        }
        return new Response(object.body, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true',
            'Cache-Control': 'public, max-age=86400'
          }
        });
      } catch (error) {
        return new Response('Error loading payslip', {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
    }

    // ======================================================================
    // ROOT & CONFIG - FIXED CORS
    // ======================================================================
    if (routePath === "/") {
      return new Response(JSON.stringify({
        service: "PrimeShieldHub API Gateway",
        status: "running",
        version: "17.0",
        docs: "https://api.primeshieldhub.com/docs"
      }), { 
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
          ...corsHeaders 
        } 
      });
    }

    // ======================================================================
    // ✅ FIXED: /api/config/public - Returns ALL public config including VAPID
    // ======================================================================
    if (routePath === "/api/config/public" && request.method === "GET") {
      // Get the VAPID public key from environment secrets
      const vapidPublicKey = env.VAPID_PUBLIC_KEY || '';
      
      console.log('[Config] VAPID public key present:', !!vapidPublicKey);
      console.log('[Config] VAPID key length:', vapidPublicKey.length);
      
      return new Response(JSON.stringify({
        turnstileSiteKey: env.TURNSTILE_SITE_KEY || '',
        paystackPublicKey: env.PAYSTACK_PUBLIC_KEY || '',
        apiBaseUrl: 'https://api.primeshieldhub.com',
        siteUrl: SITE_URL,
        version: '17.0',
        vapidPublicKey: vapidPublicKey,
        vapidSubject: env.VAPID_SUBJECT || 'mailto:primeshieldhub@gmail.com',
        supportedCurrencies: ['NGN', 'USD', 'EUR'],
        defaultCurrency: 'NGN'
      }), { 
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
          "Cache-Control": "public, max-age=3600", 
          ...corsHeaders 
        } 
      });
    }

    // ======================================================================
    // ✅ NEW: /api/config/paystack - REQUIRED FOR CHECKOUT.HTML
    // ======================================================================
    if (routePath === "/api/config/paystack" && request.method === "GET") {
      return new Response(JSON.stringify({
        publicKey: env.PAYSTACK_PUBLIC_KEY || 'pk_test_...'
      }), { 
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true'
        } 
      });
    }

    // ======================================================================
    // ✅ SHIPPING STATS ENDPOINT - FIXED CORS
    // ======================================================================
    if (routePath === "/api/shipping/stats" && request.method === "GET") {
      return await handleShippingStatsEndpoint(request, env, corsHeaders);
    }

    if (routePath === "/api/log" && request.method === "POST") {
      return await handleFrontendLog(request, env, corsHeaders);
    }

    if (routePath === "/api/_health") {
      return new Response(JSON.stringify({
        status: "ok",
        timestamp: Date.now(),
        d1_connected: !!env.DB,
        r2_connected: !!env.STORAGE,
        version: "17.0",
        vapid_configured: !!env.VAPID_PUBLIC_KEY
      }), { 
        headers: { 
          "Content-Type": "application/json", 
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
          ...corsHeaders 
        } 
      });
    }
     
    // ======================================================================
    // FRANCHISE PUBLIC API — apply, login, me, logout
    // ======================================================================

    // --- POST /api/franchise/apply — submit a franchise application ---
    if (routePath === '/api/franchise/apply' && request.method === 'POST') {
      try {
        const body = await request.json();
        const {
          fullName, email, phone, whatsapp, city, state,
          occupation, experienceYears, businessBackground,
          retailExperience, teamSize, motivation,
          selectedTier, investmentCapacity, fundingSource,
          timeline, hasLocation, consent
        } = body || {};

        // --- Validate required fields ---
        if (!fullName || !email || !phone || !selectedTier) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Full name, email, phone, and selected tier are required',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        if (!consent) {
          return new Response(JSON.stringify({
            success: false,
            error: 'You must accept the terms to apply',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // --- Prevent duplicate applications from the same email ---
        const existing = await env.DB.prepare(
          "SELECT id, status FROM franchises WHERE email = ? AND status IN ('pending','active')"
        ).bind(email.toLowerCase().trim()).first();

        if (existing) {
          return new Response(JSON.stringify({
            success: false,
            error: existing.status === 'active'
              ? 'An active franchise already exists with this email. Please log in.'
              : 'You already have a pending application. We will contact you soon.',
          }), {
            status: 409,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // --- Insert the application ---
        const franchiseId = 'FR-' + crypto.randomUUID().split('-')[0].toUpperCase();
        const applicationData = JSON.stringify({
          whatsapp, occupation, experienceYears, businessBackground,
          retailExperience, teamSize, motivation, investmentCapacity,
          fundingSource, timeline, hasLocation,
        });

        await env.DB.prepare(`
          INSERT INTO franchises (
            id, business_name, owner_name, email, phone, tier, status,
            region, application_data, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))
        `).bind(
          franchiseId,
          `${fullName}'s Franchise`,
          fullName,
          email.toLowerCase().trim(),
          phone,
          selectedTier,
          `${city || ''}, ${state || ''}`.replace(/^,\s*|,\s*$/g, ''),
          applicationData
        ).run();

        // --- Log for audit ---
        try {
          await logEvent(env, 'FRANCHISE_APPLICATION_SUBMITTED',
            `Application ${franchiseId} from ${email}`, null);
        } catch (_) { /* non-critical */ }

        return new Response(JSON.stringify({
          success: true,
          applicationId: franchiseId,
          message: 'Application received. We will review it within 48 hours.',
        }), {
          status: 201,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Franchise Apply]', e);
        return new Response(JSON.stringify({
          success: false,
          error: 'Could not submit application. Please try again.',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // --- POST /api/franchise/login — login as a franchisee ---
    if (routePath === '/api/franchise/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { email, password } = body || {};

        if (!email || !password) {
          return new Response(JSON.stringify({
            success: false, error: 'Email and password required',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // --- Look up user with franchise role ---
        const user = await env.DB.prepare(
          "SELECT id, email, name, role, status, password_hash, password_salt, must_change_password FROM users WHERE email = ? AND role = 'franchise'"
        ).bind(email.toLowerCase().trim()).first();

        if (!user) {
          // Do not reveal whether email exists
          return new Response(JSON.stringify({
            success: false, error: 'Invalid email or password',
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // --- Verify password using existing helper ---
        const isValid = await verifyPassword(password, user.password_hash, user.password_salt);
        if (!isValid) {
          return new Response(JSON.stringify({
            success: false, error: 'Invalid email or password',
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (user.status && user.status !== 'active') {
          return new Response(JSON.stringify({
            success: false, error: 'Account is not active',
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // --- Load the franchise record ---
        const franchise = await env.DB.prepare(
          "SELECT id, tier, status, business_name FROM franchises WHERE user_id = ?"
        ).bind(user.id).first();

        if (!franchise || franchise.status !== 'active') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Your franchise is not yet active. Contact support.',
          }), {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // --- Issue JWT via existing helper ---
        const secret = env.GATEWAY_SECRET || env.JWT_SECRET;
        if (!secret) {
          return new Response(JSON.stringify({
            success: false, error: 'Auth not configured',
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const now = Math.floor(Date.now() / 1000);
        const jwt = await generateJWT({
          id: user.id,
          email: user.email,
          role: 'franchise',
          franchiseId: franchise.id,
          tier: franchise.tier,
          iat: now,
          exp: now + (60 * 60 * 24 * 7),
        }, secret);

        const cookie = [
          `__Host-franchise-auth=${jwt}`,
          'Path=/',
          'Secure',
          'HttpOnly',
          'SameSite=Lax',
          'Max-Age=604800',
        ].join('; ');

        return new Response(JSON.stringify({
          success: true,
          token: jwt,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: 'franchise',
            mustChangePassword: user.must_change_password === 1,
          },
          franchise: {
            id: franchise.id,
            tier: franchise.tier,
            businessName: franchise.business_name,
          },
        }), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Set-Cookie': cookie,
            ...corsHeaders,
          },
        });
      } catch (e) {
        console.error('[Franchise Login]', e);
        return new Response(JSON.stringify({
          success: false, error: 'Login failed. Please try again.',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // --- POST /api/franchise/change-password — set a new password (first-login flow) ---
    if (routePath === '/api/franchise/change-password' && request.method === 'POST') {
      const franchise = await requireFranchise(request, env);
      if (!franchise) {
        return new Response(JSON.stringify({
          success: false, error: 'Not authenticated',
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      try {
        const body = await request.json();
        const { currentPassword, newPassword, confirmPassword } = body || {};

        if (!currentPassword || !newPassword) {
          return new Response(JSON.stringify({
            success: false, error: 'Current password and new password are required',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (newPassword !== confirmPassword) {
          return new Response(JSON.stringify({
            success: false, error: 'New passwords do not match',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        if (newPassword.length < 8) {
          return new Response(JSON.stringify({
            success: false, error: 'Password must be at least 8 characters',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Load user with password hash
        const user = await env.DB.prepare(
          "SELECT id, password_hash, password_salt FROM users WHERE id = ?"
        ).bind(franchise.userId).first();

        if (!user) {
          return new Response(JSON.stringify({
            success: false, error: 'User not found',
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Verify current password
        const isValid = await verifyPassword(currentPassword, user.password_hash, user.password_salt);
        if (!isValid) {
          return new Response(JSON.stringify({
            success: false, error: 'Current password is incorrect',
          }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Reject if new password equals old password
        const isSame = await verifyPassword(newPassword, user.password_hash, user.password_salt);
        if (isSame) {
          return new Response(JSON.stringify({
            success: false, error: 'New password must be different from current password',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // Hash and store the new password, clear must_change_password
        const { hash, salt } = await hashPassword(newPassword);

        await env.DB.prepare(`
          UPDATE users
          SET password_hash = ?, password_salt = ?, must_change_password = 0, updated_at = datetime('now')
          WHERE id = ?
        `).bind(hash, salt, franchise.userId).run();

        // Audit log
        try {
          await logAudit(
            env,
            'FRANCHISE_PASSWORD_CHANGED',
            franchise.userId,
            'user',
            franchise.userId,
            JSON.stringify({ firstLoginChange: franchise.mustChangePassword }),
            ip,
            fingerprint
          );
        } catch (_) {}

        return new Response(JSON.stringify({
          success: true,
          message: 'Password changed successfully. Redirecting to dashboard...',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Franchise Change Password]', e);
        return new Response(JSON.stringify({
          success: false, error: 'Failed to change password. Please try again.',
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }


    // --- GET /api/franchise/me — who am I? ---
    if (routePath === '/api/franchise/me' && request.method === 'GET') {
      const franchise = await requireFranchise(request, env);
      if (!franchise) {
        return new Response(JSON.stringify({
          success: false, error: 'Not authenticated',
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
      return new Response(JSON.stringify({
        success: true,
        user: {
          id: franchise.userId,
          email: franchise.email,
          name: franchise.name,
          role: franchise.isAdmin ? 'admin' : 'franchise',
        },
        franchise: {
          id: franchise.franchiseId,
          tier: franchise.tier,
          businessName: franchise.businessName,
        },
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // --- POST /api/franchise/logout — clear the cookie ---
    if (routePath === '/api/franchise/logout' && request.method === 'POST') {
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': '__Host-franchise-auth=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0',
          ...corsHeaders,
        },
      });
    }

    // ======================================================================
    // FRANCHISE ADMIN API — list, approve, reject applications
    // ======================================================================

    // --- GET /api/admin/franchise/applications ---
    if (routePath === '/api/admin/franchise/applications' && request.method === 'GET') {
      const admin = await requireAuth(request, env, ['admin']);
      if (!admin) return errorResponse('Unauthorized', 401, corsHeaders, routePath);

      try {
        const url = new URL(request.url);
        const status = url.searchParams.get('status') || 'pending';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200);

        const rows = await env.DB.prepare(`
          SELECT id, business_name, owner_name, email, phone, tier, status,
                 region, application_data, created_at, approved_at, rejected_at,
                 rejection_reason
          FROM franchises
          WHERE status = ?
          ORDER BY created_at DESC
          LIMIT ?
        `).bind(status, limit).all();

        const applications = (rows.results || []).map(r => ({
          id: r.id,
          businessName: r.business_name,
          ownerName: r.owner_name,
          email: r.email,
          phone: r.phone,
          tier: r.tier,
          status: r.status,
          region: r.region,
          createdAt: r.created_at,
          approvedAt: r.approved_at,
          rejectedAt: r.rejected_at,
          rejectionReason: r.rejection_reason,
          details: (() => { try { return JSON.parse(r.application_data || '{}'); } catch { return {}; } })(),
        }));

        return new Response(JSON.stringify({ success: true, applications }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Admin Franchise List]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // --- POST /api/admin/franchise/approve ---
    if (routePath === '/api/admin/franchise/approve' && request.method === 'POST') {
      const admin = await requireAuth(request, env, ['admin']);
      if (!admin) return errorResponse('Unauthorized', 401, corsHeaders, routePath);

      try {
        const body = await request.json();
        const { applicationId, initialPassword, tier, notes } = body || {};

        if (!applicationId) {
          return new Response(JSON.stringify({
            success: false, error: 'applicationId required',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const app = await env.DB.prepare(
          "SELECT * FROM franchises WHERE id = ? AND status = 'pending'"
        ).bind(applicationId).first();

        if (!app) {
          return new Response(JSON.stringify({
            success: false, error: 'Application not found or already processed',
          }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        // --- Generate or use provided password ---
        const tempPassword = initialPassword || (
          'PSH-' + crypto.randomUUID().split('-')[0].toUpperCase() + '-' +
          Math.floor(1000 + Math.random() * 9000)
        );

        // --- Hash password using existing helper ---
        const { hash, salt } = await hashPassword(tempPassword);

        // --- Create user account with franchise role + must_change_password=1 ---
        const userId = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO users (id, email, name, phone, password_hash, password_salt, role, status, must_change_password, created_at)
          VALUES (?, ?, ?, ?, ?, ?, 'franchise', 'active', 1, datetime('now'))
        `).bind(
          userId,
          app.email.toLowerCase(),
          app.owner_name,
          app.phone || '',
          hash,
          salt
        ).run();

        // --- Link franchise to user + mark approved ---
        await env.DB.prepare(`
          UPDATE franchises
          SET user_id = ?,
              status = 'active',
              tier = COALESCE(?, tier),
              approved_at = datetime('now'),
              approved_by = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(userId, tier || null, admin.id, applicationId).run();

        // --- Log approval ---
        try {
          await logAudit(
            env,
            'FRANCHISE_APPROVED',
            admin.id,
            'franchise',
            applicationId,
            JSON.stringify({ email: app.email, tier: tier || app.tier }),
            ip,
            fingerprint
          );
        } catch (_) {}

        // --- Send welcome email with credentials ---
        const loginUrl = SITE_URL + '/franchise/login';
        let emailSent = false;
        let emailError = null;

        try {
          const html = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; padding: 40px 20px; margin: 0;">
              <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

                <div style="background: linear-gradient(135deg, #0f0f13 0%, #1a1a25 100%); padding: 32px; text-align: center;">
                  <h1 style="color: #d6b25e; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: 2px;">
                    PRIME<span style="color: #f3dba0;">SHIELD</span>HUB
                  </h1>
                  <p style="color: #b8b6ad; font-size: 13px; margin: 8px 0 0 0;">Franchise Partner Portal</p>
                </div>

                <div style="padding: 40px 32px;">
                  <div style="text-align: center; margin-bottom: 28px;">
                    <span style="display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 8px 20px; border-radius: 50px; font-weight: 600; font-size: 13px;">
                      ✓ Application Approved
                    </span>
                  </div>

                  <h2 style="color: #12122a; font-size: 20px; margin: 0 0 12px 0;">Welcome, ${app.owner_name}!</h2>
                  <p style="color: #555; font-size: 15px; line-height: 1.6; margin-bottom: 24px;">
                    Congratulations — your franchise application has been approved. Your PrimeShieldHub partner account is now active.
                  </p>

                  <div style="background: #f8f8fc; border-left: 4px solid #d6b25e; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                    <p style="color: #333; font-size: 14px; margin: 0 0 8px 0;"><strong>Business:</strong> ${app.business_name}</p>
                    <p style="color: #333; font-size: 14px; margin: 0;"><strong>Tier:</strong> ${tier || app.tier}</p>
                  </div>

                  <p style="color: #333; font-size: 15px; margin: 24px 0 12px 0;">Your login credentials:</p>

                  <div style="background: #12122a; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <p style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 6px 0;">Email</p>
                    <p style="color: #f3dba0; font-size: 15px; font-weight: 600; font-family: monospace; margin: 0 0 16px 0;">${app.email.toLowerCase()}</p>

                    <p style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 6px 0;">Temporary Password</p>
                    <p style="color: #f3dba0; font-size: 18px; font-weight: 700; font-family: monospace; letter-spacing: 1px; margin: 0;">${tempPassword}</p>
                  </div>

                  <div style="text-align: center; margin: 28px 0;">
                    <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #b8943c, #d6b25e); color: #0f0f13; padding: 14px 40px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">
                      Log In to Your Portal
                    </a>
                  </div>

                  <div style="background: #fff8e1; border-left: 4px solid #ffb300; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
                    <p style="color: #7a5c00; font-size: 13px; margin: 0; line-height: 1.5;">
                      <strong>Important:</strong> You will be asked to set a new password on your first login. Keep this temporary password safe until then.
                    </p>
                  </div>

                  <hr style="border: none; height: 1px; background: #eee; margin: 24px 0;">

                  <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 0;">
                    Questions? Reply to this email or contact us at
                    <a href="mailto:primeshieldhub@gmail.com" style="color: #b8943c;">primeshieldhub@gmail.com</a>.
                  </p>
                </div>

                <div style="background: #f8f8fc; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 11px; margin: 0;">
                    © 2026 PrimeShieldHub · 108 Ekhorutomwen Street, Uselu, Benin City, Edo State
                  </p>
                </div>
              </div>
            </body>
            </html>
          `;

          await sendEmail(
            app.email.toLowerCase(),
            `Welcome to PrimeShieldHub Franchise — Your Login Credentials`,
            html,
            env
          );
          emailSent = true;
        } catch (emailErr) {
          console.error('[Franchise Approve] Email failed:', emailErr);
          emailError = emailErr.message || 'Email send failed';
        }

        return new Response(JSON.stringify({
          success: true,
          userId,
          franchiseId: applicationId,
          credentials: {
            email: app.email.toLowerCase(),
            temporaryPassword: tempPassword,
            loginUrl: loginUrl,
          },
          emailSent,
          emailError: emailSent ? undefined : emailError,
          message: emailSent
            ? 'Franchise approved. Credentials emailed to applicant.'
            : 'Franchise approved. Email delivery failed — share credentials manually.',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Admin Franchise Approve]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }


    // --- POST /api/admin/franchise/reject ---
    if (routePath === '/api/admin/franchise/reject' && request.method === 'POST') {
      const admin = await requireAuth(request, env, ['admin']);
      if (!admin) return errorResponse('Unauthorized', 401, corsHeaders, routePath);

      try {
        const body = await request.json();
        const { applicationId, reason } = body || {};

        if (!applicationId) {
          return new Response(JSON.stringify({
            success: false, error: 'applicationId required',
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        await env.DB.prepare(`
          UPDATE franchises
          SET status = 'rejected',
              rejected_at = datetime('now'),
              rejection_reason = ?,
              updated_at = datetime('now')
          WHERE id = ? AND status = 'pending'
        `).bind(reason || 'Not specified', applicationId).run();

        try {
          await logAudit(
            env,
            'FRANCHISE_REJECTED',
            admin.id,
            'franchise',
            applicationId,
            JSON.stringify({ reason: reason || 'no reason' }),
            ip,
            fingerprint
          );
        } catch (_) {}

        return new Response(JSON.stringify({
          success: true,
          message: 'Application rejected',
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Admin Franchise Reject]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ======================================================================
    // FRANCHISE SCOPED API — every query filtered by authenticated franchise
    // ======================================================================

    // --- GET /api/franchise/orders ---
    if (routePath === '/api/franchise/orders' && request.method === 'GET') {
      const franchise = await requireFranchise(request, env);
      if (!franchise) return errorResponse('Unauthorized', 401, corsHeaders, routePath);

      try {
        // Admin sees all; franchisee sees only their own
        let rows;
        if (franchise.isAdmin) {
          rows = await env.DB.prepare(
            "SELECT * FROM orders WHERE franchise_id IS NOT NULL ORDER BY created_at DESC LIMIT 200"
          ).all();
        } else {
          rows = await env.DB.prepare(
            "SELECT * FROM orders WHERE franchise_id = ? ORDER BY created_at DESC LIMIT 200"
          ).bind(franchise.franchiseId).all();
        }

        return new Response(JSON.stringify({
          success: true,
          orders: rows.results || [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Franchise Orders]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // --- GET /api/franchise/customers ---
    if (routePath === '/api/franchise/customers' && request.method === 'GET') {
      const franchise = await requireFranchise(request, env);
      if (!franchise) return errorResponse('Unauthorized', 401, corsHeaders, routePath);

      try {
        let rows;
        if (franchise.isAdmin) {
          rows = await env.DB.prepare(
            "SELECT * FROM customers WHERE franchise_id IS NOT NULL ORDER BY created_at DESC LIMIT 200"
          ).all();
        } else {
          rows = await env.DB.prepare(
            "SELECT * FROM customers WHERE franchise_id = ? ORDER BY created_at DESC LIMIT 200"
          ).bind(franchise.franchiseId).all();
        }

        return new Response(JSON.stringify({
          success: true,
          customers: rows.results || [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Franchise Customers]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // --- GET /api/franchise/inventory ---
    if (routePath === '/api/franchise/inventory' && request.method === 'GET') {
      const franchise = await requireFranchise(request, env);
      if (!franchise) return errorResponse('Unauthorized', 401, corsHeaders, routePath);

      try {
        let rows;
        if (franchise.isAdmin) {
          rows = await env.DB.prepare(
            "SELECT id, name, price, stock, category, image_url FROM products WHERE franchise_id IS NOT NULL ORDER BY name ASC LIMIT 500"
          ).all();
        } else {
          rows = await env.DB.prepare(
            "SELECT id, name, price, stock, category, image_url FROM products WHERE franchise_id = ? ORDER BY name ASC LIMIT 500"
          ).bind(franchise.franchiseId).all();
        }

        return new Response(JSON.stringify({
          success: true,
          inventory: rows.results || [],
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Franchise Inventory]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // --- GET /api/franchise/stats ---
    if (routePath === '/api/franchise/stats' && request.method === 'GET') {
      const franchise = await requireFranchise(request, env);
      if (!franchise) return errorResponse('Unauthorized', 401, corsHeaders, routePath);

      try {
        const scoped = franchise.isAdmin ? null : franchise.franchiseId;

        const orderCount = scoped
          ? await env.DB.prepare("SELECT COUNT(*) as c FROM orders WHERE franchise_id = ?").bind(scoped).first()
          : await env.DB.prepare("SELECT COUNT(*) as c FROM orders WHERE franchise_id IS NOT NULL").first();

        const customerCount = scoped
          ? await env.DB.prepare("SELECT COUNT(*) as c FROM customers WHERE franchise_id = ?").bind(scoped).first()
          : await env.DB.prepare("SELECT COUNT(*) as c FROM customers WHERE franchise_id IS NOT NULL").first();

        const productCount = scoped
          ? await env.DB.prepare("SELECT COUNT(*) as c FROM products WHERE franchise_id = ?").bind(scoped).first()
          : await env.DB.prepare("SELECT COUNT(*) as c FROM products WHERE franchise_id IS NOT NULL").first();

        return new Response(JSON.stringify({
          success: true,
          stats: {
            orders: orderCount?.c || 0,
            customers: customerCount?.c || 0,
            products: productCount?.c || 0,
          },
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (e) {
        console.error('[Franchise Stats]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ======================================================================
    // REDIRECT FOR NON-API PATHS
    // ======================================================================
    if (!routePath.startsWith("/api") &&
        !routePath.startsWith("/admin") &&
        !routePath.startsWith("/files") &&
        !routePath.startsWith("/staff") &&
        !routePath.startsWith("/payslips") &&
        !routePath.startsWith("/payroll") &&
        !routePath.startsWith("/checkout") &&
        !routePath.startsWith("/payment") &&
        !routePath.startsWith("/careers") &&
        !routePath.startsWith("/jobs") &&
        !routePath.startsWith("/job") &&
        !routePath.startsWith("/css") &&
        !routePath.startsWith("/js") &&
        !routePath.startsWith("/assets") &&
        !routePath.startsWith("/articles") &&
        !routePath.startsWith("/franchise")) {
      // Only redirect if this isn't a known page — return 404 instead of looping
      const knownPages = [
        '/', '/index.html', '/products.html', '/products', '/cart.html', '/cart',
        '/wishlist.html', '/wishlist', '/profile.html', '/profile',
        '/dashboard.html', '/dashboard', '/reseller-dashboard.html',
        '/reseller.html', '/reseller', '/login', '/login.html',
        '/register', '/signup', '/wholesale.html', '/wholesale',
        '/support.html', '/support', '/track-order.html', '/faq.html',
        // ... add every page in your HTML_ROUTES that doesn't already start with /api, /admin, etc.
      ];
      if (!knownPages.includes(routePath)) {
        return errorResponse("Page not found", 404, corsHeaders, routePath);
      }
      // Otherwise, don't redirect — let the HTML_ROUTES block above handle it
    }

    // ======================================================================
    // ===== PUSH NOTIFICATION ENDPOINTS =====
    // ======================================================================

    // ===== 1. Subscribe to push notifications =====
    if (routePath === "/api/push/subscribe" && request.method === "POST") {
      try {
        const body = await request.json();
        const { endpoint, keys, userId } = body || {};

        if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
          return new Response(JSON.stringify({ 
            error: "Missing subscription data. Required: endpoint, keys.p256dh, keys.auth" 
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        // Check if subscription already exists
        const existing = await env.DB.prepare(
          "SELECT id FROM push_subscriptions WHERE endpoint = ?"
        ).bind(endpoint).first();

        let id;
        if (existing) {
          // Update existing
          await env.DB.prepare(
            `UPDATE push_subscriptions 
             SET keys_p256dh = ?, keys_auth = ?, user_id = ?, updated_at = datetime('now')
             WHERE endpoint = ?`
          ).bind(keys.p256dh, keys.auth, userId || null, endpoint).run();
          id = existing.id;
        } else {
          // Insert new
          id = crypto.randomUUID();
          await env.DB.prepare(
            `INSERT INTO push_subscriptions (id, user_id, endpoint, keys_p256dh, keys_auth, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
          ).bind(id, userId || null, endpoint, keys.p256dh, keys.auth).run();
        }

        console.log(`[Push] Subscription ${id} for user ${userId || 'anonymous'}`);

        return new Response(JSON.stringify({ 
          success: true, 
          id,
          message: 'Push notification subscription saved successfully'
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (e) {
        console.error('[Push] Subscribe error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ===== 2. Unsubscribe from push notifications =====
    if (routePath === "/api/push/unsubscribe" && request.method === "POST") {
      try {
        const body = await request.json();
        const { endpoint } = body || {};

        if (!endpoint) {
          return new Response(JSON.stringify({ error: "Missing endpoint" }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        await env.DB.prepare(
          "DELETE FROM push_subscriptions WHERE endpoint = ?"
        ).bind(endpoint).run();

        console.log('[Push] Unsubscribed:', endpoint.substring(0, 50) + '...');

        return new Response(JSON.stringify({ success: true }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (e) {
        console.error('[Push] Unsubscribe error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ===== 3. Get subscription status =====
    if (routePath === "/api/push/status" && request.method === "GET") {
      try {
        const user = await requireAuth(request, env);
        if (!user) {
          return new Response(JSON.stringify({ subscribed: false }), {
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const result = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM push_subscriptions WHERE user_id = ?"
        ).bind(user.id).first();

        return new Response(JSON.stringify({ 
          subscribed: (result?.count || 0) > 0,
          userId: user.id
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ===== 4. Send push notification to all subscribers (Admin only) =====
    if (routePath === "/api/push/send" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized - Admin only" }), {
          status: 401,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }

      try {
        const body = await request.json();
        const { title, message, url, icon, tag } = body || {};

        if (!title || !message) {
          return new Response(JSON.stringify({ error: "Title and message are required" }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        // Get all active subscriptions
        const subscriptions = await env.DB.prepare(
          `SELECT * FROM push_subscriptions 
           WHERE created_at > datetime('now', '-90 days')`
        ).all();

        if (!subscriptions.results || subscriptions.results.length === 0) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: "No active subscribers found" 
          }), {
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        // Dynamic import for web-push
        const webPushModule = await import('web-push');
        const webPush = webPushModule.default || webPushModule;

        // Set VAPID details from secrets
        const vapidPublicKey = env.VAPID_PUBLIC_KEY;
        const vapidPrivateKey = env.VAPID_PRIVATE_KEY;
        
        if (!vapidPublicKey || !vapidPrivateKey) {
          console.error('[Push] VAPID keys missing!');
          return new Response(JSON.stringify({ 
            error: "VAPID keys not configured" 
          }), {
            status: 500,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        webPush.setVapidDetails(
          env.VAPID_SUBJECT || 'mailto:primeshieldhub@gmail.com',
          vapidPublicKey,
          vapidPrivateKey
        );

        const payload = JSON.stringify({
          title: title,
          body: message,
          icon: icon || '/favicon.png',
          badge: '/favicon.png',
          url: url || '/',
          tag: tag || 'psh-' + Date.now()
        });

        let sentCount = 0;
        let failedCount = 0;
        const failedEndpoints = [];

        // Send to all subscribers
        for (const sub of subscriptions.results) {
          try {
            const subscription = {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.keys_p256dh,
                auth: sub.keys_auth
              }
            };

            await webPush.sendNotification(subscription, payload);
            sentCount++;
          } catch (e) {
            failedCount++;
            console.error('[Push] Send failed for endpoint:', sub.endpoint.substring(0, 50), e.message);
            
            // Remove invalid subscriptions (410 Gone or 404 Not Found)
            if (e.statusCode === 410 || e.statusCode === 404) {
              await env.DB.prepare(
                "DELETE FROM push_subscriptions WHERE endpoint = ?"
              ).bind(sub.endpoint).run();
              console.log('[Push] Removed invalid subscription:', sub.endpoint.substring(0, 50));
            } else {
              failedEndpoints.push(sub.endpoint.substring(0, 50));
            }
          }
        }

        // Log the action
        try {
          await env.DB.prepare(
            `INSERT INTO admin_logs (id, admin_id, action, details, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`
          ).bind(
            crypto.randomUUID(),
            user.id,
            'PUSH_NOTIFICATION_SENT',
            `Sent "${title}" to sentCountsubscribers({failedCount} failed)`
          ).run();
        } catch (logErr) {
          console.warn('[Push] Failed to log:', logErr.message);
        }

        return new Response(JSON.stringify({
          success: true,
          sentCount,
          failedCount,
          total: subscriptions.results.length,
          failedEndpoints: failedEndpoints.length > 0 ? failedEndpoints : undefined,
          message: `Notification sent to ${sentCount} of ${subscriptions.results.length} subscribers`
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (e) {
        console.error('[Push] Send error:', e);
        return new Response(JSON.stringify({ 
          error: e.message,
          stack: e.stack 
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ===== 5. Send targeted push notification to specific user =====
    if (routePath === "/api/push/send-user" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin", "staff"]);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }

      try {
        const body = await request.json();
        const { userId, title, message, url, icon } = body || {};

        if (!userId || !title || !message) {
          return new Response(JSON.stringify({ 
            error: "userId, title, and message are required" 
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        // Get user's subscriptions
        const subscriptions = await env.DB.prepare(
          `SELECT * FROM push_subscriptions WHERE user_id = ?`
        ).bind(userId).all();

        if (!subscriptions.results || subscriptions.results.length === 0) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: "User has no active subscriptions" 
          }), {
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const webPushModule = await import('web-push');
        const webPush = webPushModule.default || webPushModule;

        webPush.setVapidDetails(
          env.VAPID_SUBJECT || 'mailto:primeshieldhub@gmail.com',
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY
        );

        const payload = JSON.stringify({
          title: title,
          body: message,
          icon: icon || '/favicon.png',
          badge: '/favicon.png',
          url: url || '/'
        });

        let sentCount = 0;
        for (const sub of subscriptions.results) {
          try {
            await webPush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
            }, payload);
            sentCount++;
          } catch (e) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              await env.DB.prepare(
                "DELETE FROM push_subscriptions WHERE endpoint = ?"
              ).bind(sub.endpoint).run();
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          sentCount,
          message: `Sent to ${sentCount} devices`
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (e) {
        console.error('[Push] Send-user error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ===== 6. Push notification webhook (for automated triggers) =====
    if (routePath === "/api/push/webhook" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }

      try {
        const body = await request.json();
        const { event, data } = body || {};

        // Map events to notifications
        const eventMap = {
          'order_placed': {
            title: '🛒 New Order!',
            message: `Order #${data?.orderId} has been placed successfully.`,
            url: '/admin/orders'
          },
          'low_stock': {
            title: '⚠️ Low Stock Alert',
            message: `Product "data?.productName"isrunninglow({data?.stock} left).`,
            url: '/admin/products'
          },
          'new_review': {
            title: '⭐ New Review',
            message: `${data?.customerName} left a ${data?.rating}★ review.`,
            url: '/admin/reviews'
          },
          'staff_verified': {
            title: '✅ Staff Verified',
            message: `${data?.staffName} has been verified.`,
            url: '/admin/staff'
          }
        };

        const notification = eventMap[event];
        if (!notification) {
          return new Response(JSON.stringify({ 
            error: `Unknown event: ${event}` 
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        // Send notification
        const subscriptions = await env.DB.prepare(
          "SELECT * FROM push_subscriptions WHERE user_id IS NOT NULL"
        ).all();

        if (!subscriptions.results || subscriptions.results.length === 0) {
          return new Response(JSON.stringify({ 
            success: false, 
            message: "No subscriptions" 
          }), {
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const webPushModule = await import('web-push');
        const webPush = webPushModule.default || webPushModule;

        webPush.setVapidDetails(
          env.VAPID_SUBJECT || 'mailto:primeshieldhub@gmail.com',
          env.VAPID_PUBLIC_KEY,
          env.VAPID_PRIVATE_KEY
        );

        const payload = JSON.stringify(notification);
        let sentCount = 0;

        for (const sub of subscriptions.results) {
          try {
            await webPush.sendNotification({
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth }
            }, payload);
            sentCount++;
          } catch (e) {
            if (e.statusCode === 410 || e.statusCode === 404) {
              await env.DB.prepare(
                "DELETE FROM push_subscriptions WHERE endpoint = ?"
              ).bind(sub.endpoint).run();
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          sentCount,
          event,
          notification
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (e) {
        console.error('[Push] Webhook error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // ===== FIX: BRAIN API ENDPOINT =====
    // ======================================================================
    if (routePath === "/api/brain") {
      try {
        return new Response(JSON.stringify({
          status: "ok",
          version: "1.0",
          message: "Brain endpoint ready",
          timestamp: Date.now()
        }), {
          status: 200,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders,
            'Cache-Control': 'no-cache'
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // ===== SIGNATURE API - Get top products for dynamic email signature =====
    // ======================================================================
    if (routePath === '/api/signature/products' && request.method === 'GET') {
      try {
        // Try to get from cache first
        let cached = null;
        if (env.PRODUCTS_CACHE) {
          try {
            const cachedData = await env.PRODUCTS_CACHE.get('signature_products');
            if (cachedData) {
              cached = JSON.parse(cachedData);
            }
          } catch (e) {
            // Cache miss or error - fetch fresh
          }
        }

        if (cached) {
          return new Response(JSON.stringify({
            ...cached,
            cached: true
          }), {
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders,
              'Cache-Control': 'public, max-age=3600'
            }
          });
        }

        // Get top 4 active products with images
        const products = await env.DB.prepare(`
          SELECT id, name, image_url, price, slug, brand, description
          FROM products 
          WHERE active = 1 AND image_url IS NOT NULL AND image_url != ''
          ORDER BY featured DESC, createdAt DESC 
          LIMIT 4
        `).all();

        // Format the response with full image URLs and tracking URLs
        const formattedProducts = (products.results || []).map(p => {
          let imageUrl = p.image_url;

          if (imageUrl && !imageUrl.startsWith('http')) {
            const cleanPath = imageUrl
              .replace(/^\//, '')        // remove leading slash
              .replace(/^assets\//, ''); // remove duplicate assets if present

            imageUrl = `https://api.primeshieldhub.com/assets/${cleanPath}`;
          }
          
          const productSlug = p.slug || p.id;
          
          return {
            ...p,
            image_url: imageUrl,
            product_url: `https://www.primeshieldhub.com/t/p?url=https://www.primeshieldhub.com/products/productSlug&meta={encodeURIComponent(p.name)}`,
            tracking_url: `https://primeshieldhub.com/?product=${productSlug}&utm_source=email&utm_medium=signature&utm_campaign=ceo_${productSlug}`
          };
        });

        const responseData = {
          success: true,
          products: formattedProducts,
          timestamp: Date.now()
        };

        // Cache the response
        if (env.PRODUCTS_CACHE) {
          try {
            await env.PRODUCTS_CACHE.put('signature_products', JSON.stringify(responseData), {
              expirationTtl: 3600 // 1 hour
            });
          } catch (e) {
            // Cache write failed - continue
          }
        }

        return new Response(JSON.stringify(responseData), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders,
            'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
          }
        });
      } catch (e) {
        console.error('Signature API error:', e);
        return new Response(JSON.stringify({ 
          success: false, 
          error: e.message 
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // ===== SIGNATURE TRACKING ENDPOINT =====
    // ======================================================================
    if (routePath === '/api/track/signature' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { product, utm_source, utm_medium, utm_campaign } = body || {};
        
        await env.DB.prepare(`
          INSERT INTO analytics_events 
          (id, event_type, event_data, ip, user_agent, timestamp, created_at)
          VALUES (?, 'signature_click', ?, ?, ?, ?, datetime('now'))
        `).bind(
          crypto.randomUUID(),
          JSON.stringify({ product, utm_source, utm_medium, utm_campaign }),
          request.headers.get('CF-Connecting-IP') || 'unknown',
          request.headers.get('User-Agent') || 'unknown',
          Date.now()
        ).run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // ===== FIX: USER ENDPOINT (GET /api/user/:id) =====
    // ======================================================================
    if (routePath.match(/^\/api\/user\/[^\/]+$/) && request.method === "GET") {
      const userId = routePath.split('/').pop();
      
      try {
        let user = await env.DB.prepare(
          "SELECT id, email, name, phone, role, status, created_at as createdAt, referral_code, total_referrals, points FROM users WHERE id = ?"
        ).bind(userId).first();
        
        if (!user) {
          user = await env.DB.prepare(
            "SELECT id, email, name, phone, role, status, created_at as createdAt FROM staff WHERE id = ?"
          ).bind(userId).first();
        }
        
        if (!user) {
          return new Response(JSON.stringify({
            id: userId,
            name: "PrimeShield User",
            email: "user@primeshieldhub.com",
            role: "user",
            status: "active",
            createdAt: new Date().toISOString(),
            referral_code: null,
            total_referrals: 0,
            points: 0
          }), {
            status: 200,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }
        
        return new Response(JSON.stringify(user), {
          status: 200,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
        
      } catch (e) {
        return new Response(JSON.stringify({
          id: userId,
          name: "PrimeShield User",
          email: "user@primeshieldhub.com",
          role: "user",
          status: "active",
          createdAt: new Date().toISOString(),
          referral_code: null,
          total_referrals: 0,
          points: 0
        }), {
          status: 200,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // ===== DISCOUNT VALIDATION ENDPOINT =====
    // ======================================================================
    if (routePath === "/api/validate-discount" && request.method === "POST") {
      try {
        const body = await request.json();
        const { code, subtotal } = body || {};
        
        if (!code) {
          return new Response(JSON.stringify({ 
            valid: false, 
            error: 'Discount code is required' 
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        // Get user info from auth
        const user = await requireAuth(request, env, ["user", "admin"]);
        const userId = user?.id || 'anonymous';
        const email = user?.email || body?.email || '';

        const result = await validateDiscount(env, userId, email, code, subtotal || 0);
        
        return new Response(JSON.stringify(result), {
          status: result.valid ? 200 : 400,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          valid: false, 
          error: error.message || 'Error validating discount' 
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // AUTH ROUTES
    // ======================================================================
    if (routePath === "/api/auth/admin-register" && request.method === "POST") {
      return await handleAdminRegister(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/admin-login" && request.method === "POST") {
      return await handleLogin(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/admin-check" && request.method === "GET") {
      return await handleAdminCheck(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/list-admins" && request.method === "GET") {
      return await handleListAdmins(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/auth/request-otp" && request.method === "POST") {
      return await handleRequestOTP(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/verify-otp" && request.method === "POST") {
      return await handleVerifyOTP(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/login" && request.method === "POST") {
      return await handleLogin(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/register" && request.method === "POST") {
      return await handleRegister(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/register-staff" && request.method === "POST") {
      return await handleRegisterStaff(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/me" && request.method === "GET") {
      return await handleMe(request, env, corsHeaders, requestInfo);
    }
    if (routePath === "/api/auth/logout" && request.method === "POST") {
      return await handleLogout(request, env, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/check" && request.method === "GET") {
      return await handleAuthCheck(request, env, corsHeaders);
    }
    if (routePath === "/api/auth/csrf" && request.method === "GET") {
      return await handleCSRF(request, corsHeaders);
    }
    if (routePath === "/api/auth/change-password" && request.method === "POST") {
      return await handleChangePassword(request, env, corsHeaders, ip, fingerprint);
    }

    // ======================================================================
    // TWO-FACTOR AUTHENTICATION ROUTES
    // ======================================================================
    if (routePath === "/api/auth/2fa/enable" && request.method === "POST") {
      return await handleEnable2FA(request, env, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/2fa/disable" && request.method === "POST") {
      return await handleDisable2FA(request, env, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/auth/2fa/verify" && request.method === "POST") {
      return await handleVerify2FA(request, env, corsHeaders, ip, fingerprint);
    }

    // ======================================================================
    // ADMIN ROUTES
    // ======================================================================
    if (routePath === "/api/admin/stats" && request.method === "GET") {
      return await handleAdminStats(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/staff-list" && request.method === "GET") {
      return await handleAdminStaffList(request, env, ctx, corsHeaders);
    }
    if (routePath.match(/^\/api\/admin\/staff\/[^\/]+$/) && request.method === "GET") {
      return await handleAdminGetStaff(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/approve-staff" && request.method === "POST") {
      return await handleAdminApproveStaff(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/reject-staff" && request.method === "POST") {
      return await handleAdminRejectStaff(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath.match(/^\/api\/admin\/staff\/[^\/]+$/) && request.method === "PUT") {
      return await handleAdminUpdateStaff(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/generate-invite" && request.method === "POST") {
      return await handleAdminGenerateInvite(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/invitations" && request.method === "GET") {
      return await handleAdminInvitations(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/revoke-invite" && request.method === "POST") {
      return await handleAdminRevokeInvite(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/branches" && request.method === "GET") {
      return await handleAdminBranches(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/branches" && request.method === "POST") {
      return await handleAdminCreateBranch(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/orders" && request.method === "GET") {
      return await handleAdminOrders(request, env, ctx, corsHeaders);
    }
    if (routePath.match(/^\/api\/admin\/orders\/[^\/]+\/status$/) && request.method === "PUT") {
      return await handleAdminOrderStatus(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/customers" && request.method === "GET") {
      return await handleAdminCustomers(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/investors" && request.method === "GET") {
      return await handleAdminInvestors(request, env, ctx, corsHeaders);
    }
    if (routePath.match(/^\/api\/admin\/investors\/[^\/]+\/status$/) && request.method === "PUT") {
      return await handleAdminInvestorStatus(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath.match(/^\/api\/admin\/pages\/[^\/]+$/) && request.method === "GET") {
      return await handleAdminPageGet(request, env, ctx, corsHeaders);
    }
    if (routePath.match(/^\/api\/admin\/pages\/[^\/]+$/) && request.method === "PUT") {
      return await handleAdminPageUpdate(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/settings" && request.method === "GET") {
      return await handleAdminSettingsGet(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/settings" && request.method === "PUT") {
      return await handleAdminSettingsUpdate(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/logs" && request.method === "GET") {
      return await handleAdminLogs(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/ai-insights" && request.method === "GET") {
      return await handleAdminAIInsights(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/run-autonomous" && request.method === "POST") {
      return await handleAdminRunAutonomous(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath === "/api/admin/receipts" && request.method === "GET") {
      return await handleAdminReceiptsList(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/admin/receipts/resend" && request.method === "POST") {
      return await handleAdminReceiptsResend(request, env, ctx, corsHeaders, ip, fingerprint);
    }
    if (routePath.match(/^\/api\/admin\/receipts\/[^\/]+$/) && request.method === "GET") {
      return await handleAdminReceiptDetail(request, env, ctx, corsHeaders);
    }

    // ======================================================================
    // ADMIN NOTIFICATIONS
    // ======================================================================
    if (routePath === "/api/admin/notifications/send" && request.method === "POST") {
      const adminUser = await requireAuth(request, env, ["admin"]);
      if (!adminUser) return errorResponse("Unauthorized", 401, corsHeaders, routePath);

      try {
        const body = await request.json();
        const { staffId, title, message, type } = body || {};

        if (!staffId || !title || !message) {
          return new Response(JSON.stringify({ error: "staffId, title, and message are required" }), {
            status: 400, 
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const staff = await env.DB.prepare("SELECT id FROM staff WHERE id = ?").bind(staffId).first();
        if (!staff) {
          return errorResponse("Staff not found", 404, corsHeaders, routePath);
        }

        const notifId = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO notifications (id, user_id, title, message, type, read, created_at) VALUES (?, ?, ?, ?, ?, 0, datetime('now'))"
        ).bind(notifId, staffId, title, message, type || 'info').run();

        return new Response(JSON.stringify({
          success: true,
          id: notifId,
          message: 'Notification sent successfully'
        }), { 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          } 
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    if (routePath === "/api/admin/notifications/send-all" && request.method === "POST") {
      const adminUser = await requireAuth(request, env, ["admin"]);
      if (!adminUser) return errorResponse("Unauthorized", 401, corsHeaders, routePath);

      try {
        const body = await request.json();
        const { title, message, type } = body || {};

        if (!title || !message) {
          return new Response(JSON.stringify({ error: "title and message are required" }), {
            status: 400, 
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const staffList = await env.DB.prepare("SELECT id FROM staff WHERE status = 'active'").all();

        if (!staffList.results || staffList.results.length === 0) {
          return errorResponse("No active staff found", 404, corsHeaders, routePath);
        }

        let sentCount = 0;
        for (const staff of staffList.results) {
          await env.DB.prepare(
            "INSERT INTO notifications (id, user_id, title, message, type, read, created_at) VALUES (?, ?, ?, ?, ?, 0, datetime('now'))"
          ).bind(crypto.randomUUID(), staff.id, title, message, type || 'info').run();
          sentCount++;
        }

        return new Response(JSON.stringify({
          success: true,
          sentCount,
          message: `Notification sent to ${sentCount} staff members`
        }), { 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          } 
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // PAYROLL & STAFF VERIFICATION
    // ======================================================================
    if (routePath.startsWith('/api/staff/verify-public/') && request.method === 'GET') {
      return await handlePublicStaffVerification(request, env, corsHeaders);
    }

    if (routePath.startsWith('/api/payroll/verify-public/') && request.method === 'GET') {
      return await handlePublicVerification(request, env, corsHeaders);
    }

    if (routePath === "/api/payroll/process" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      return await handleProcessPayroll(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/payroll/history" && request.method === "GET") {
      const user = await requireAuth(request, env, ["staff", "admin"]);
      if (!user) {
        return errorResponse("Unauthorized - Please login again", 401, corsHeaders, routePath);
      }
      return await handlePayrollHistory(request, env, corsHeaders);
    }

    // ======================================================================
    // STAFF NOTIFICATION ROUTES
    // ======================================================================
    if (routePath === "/api/staff/notifications" && request.method === "GET") {
      const user = await requireAuth(request, env, ["staff", "admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);

      const url = new URL(request.url);
      const filter = url.searchParams.get('filter') || 'all';
      const limit = parseInt(url.searchParams.get('limit') || '50');

      let query = "SELECT * FROM notifications WHERE user_id = ?";
      if (filter === 'unread') query += " AND read = 0";
      else if (filter === 'read') query += " AND read = 1";
      query += " ORDER BY created_at DESC LIMIT ?";

      try {
        const result = await env.DB.prepare(query).bind(user.id, limit).all();
        const unreadCount = await env.DB.prepare(
          "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0"
        ).bind(user.id).first();

        return new Response(JSON.stringify({
          notifications: result.results || [],
          unreadCount: unreadCount?.count || 0
        }), { 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          } 
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, notifications: [] }), {
          status: 500, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    if (routePath.match(/^\/api\/staff\/notifications\/([^\/]+)\/read$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["staff", "admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);

      const notifId = routePath.split('/')[4];
      try {
        await env.DB.prepare(
          "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?"
        ).bind(notifId, user.id).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    if (routePath === "/api/staff/notifications/read-all" && request.method === "PUT") {
      const user = await requireAuth(request, env, ["staff", "admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);

      try {
        await env.DB.prepare(
          "UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0"
        ).bind(user.id).run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // STAFF ROUTES
    // ======================================================================
    if (routePath === "/api/staff/me" && request.method === "GET") { return await handleStaffMe(request, env, corsHeaders); }
    if (routePath === "/api/staff/dashboard" && request.method === "GET") { return await handleStaffDashboard(request, env, corsHeaders); }
    if (routePath === "/api/staff/performance" && request.method === "GET") { return await dashboardHandler.getStaffPerformance(request, env, ctx); }
    if (routePath === "/api/staff/location" && request.method === "POST") { return await handleStaffLocation(request, env, corsHeaders); }
    if (routePath === "/api/staff/capture" && request.method === "POST") { return await handleStaffCapture(request, env, corsHeaders, ip, fingerprint); }
    if (routePath === "/api/staff/session/start" && request.method === "POST") { return await handleStartSession(request, env, corsHeaders, ip, fingerprint); }
    if (routePath === "/api/staff/session/collect" && request.method === "POST") { return await handleCollectSession(request, env, corsHeaders, ip, fingerprint); }
    if (routePath === "/api/staff/session/pause" && request.method === "POST") { return await handlePauseSession(request, env, corsHeaders); }
    if (routePath === "/api/staff/session/resume" && request.method === "POST") { return await handleResumeSession(request, env, corsHeaders); }
    if (routePath === "/api/staff/bays" && request.method === "GET") { return await handleGetBays(request, env, corsHeaders); }
    if (routePath === "/api/staff/bays/assign" && request.method === "POST") { return await handleAssignBay(request, env, corsHeaders); }
    if (routePath === "/api/staff/bays/release" && request.method === "POST") { return await handleReleaseBay(request, env, corsHeaders); }
    if (routePath.match(/^\/api\/staff\/customer\/[^\/]+$/) && request.method === "GET") { return await handleGetCustomer(request, env, corsHeaders); }
    if (routePath === "/api/staff/loyalty/top" && request.method === "GET") { return await handleTopCustomers(request, env, corsHeaders); }
    if (routePath === "/api/staff/activity" && request.method === "GET") { return await handleStaffActivity(request, env, corsHeaders); }
    if (routePath === "/api/staff/stats" && request.method === "GET") { return await handleStaffStats(request, env, corsHeaders); }

    // Staff Wallet & Bank
    if (routePath === "/api/staff/bank-account" && request.method === "POST") {
      return await handleAddBankAccount(request, env, corsHeaders);
    }
    if (routePath.match(/^\/api\/staff\/bank-accounts\/[^\/]+$/) && request.method === "GET") {
      return await handleGetBankAccounts(request, env, corsHeaders);
    }
    if (routePath === "/api/staff/wallet/credit" && request.method === "POST") {
      return await handleWalletCredit(request, env, ctx, corsHeaders);
    }
    if (routePath === "/api/staff/wallet/withdraw" && request.method === "POST") {
      return await handleWalletWithdraw(request, env, ctx, corsHeaders);
    }
    if (routePath.match(/^\/api\/staff\/wallet\/[^\/]+$/) && request.method === "GET") {
      const user = await requireAuth(request, env, ["staff", "admin"]);
      if (!user) {
        return errorResponse("Unauthorized - Please login again", 401, corsHeaders, routePath);
      }
      return await handleGetWallet(request, env, corsHeaders);
    }
    if (routePath.match(/^\/api\/staff\/bank-account\/[^\/]+$/) && request.method === "PUT") {
      return await handleUpdateBankAccount(request, env, corsHeaders);
    }
    if (routePath.match(/^\/api\/staff\/bank-account\/[^\/]+$/) && request.method === "DELETE") {
      return await handleDeleteBankAccount(request, env, corsHeaders);
    }

    // Staff invites
    if (routePath === "/api/staff/invites" && request.method === "GET") {
      try { const result = await env.DB.prepare('SELECT * FROM staff_invites ORDER BY created_at DESC').all(); return new Response(JSON.stringify(result.results), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
      catch (e) { return new Response(JSON.stringify({ error: e.message, data: [] }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
    }
    if (routePath === "/api/staff/invites" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try { const body = await request.json(); const { name, branch, role, expires_at } = body; const id = crypto.randomUUID(); const code = crypto.randomUUID().slice(0, 8).toUpperCase(); await env.DB.prepare('INSERT INTO staff_invites (id, code, name, branch, role, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))').bind(id, code, name, branch || '', role || 'staff', expires_at || Date.now() + 7*24*60*60*1000).run(); return new Response(JSON.stringify({ success: true, id, code }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
      catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
    }

    // Staff invites - Resend
    if (routePath === "/api/staff/invites/resend" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { inviteId } = body || {};
        if (!inviteId) {
          return new Response(JSON.stringify({ error: "Invite ID required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const invite = await env.DB.prepare(
          "SELECT * FROM staff_invites WHERE id = ? AND used = 0 AND revoked = 0"
        ).bind(inviteId).first();
        if (!invite) {
          return errorResponse("Invite not found or already used", 404, corsHeaders, routePath);
        }
        const newCode = `PSH-crypto.randomUUID().split('-')[0].toUpperCase(){Math.floor(Math.random() * 1000)}`;
        await env.DB.prepare(
          "UPDATE staff_invites SET code = ?, expires_at = datetime('now', '+7 days'), updated_at = datetime('now') WHERE id = ?"
        ).bind(newCode, inviteId).run();
        await logEvent(env, "INVITE_RESENT", `Invite resent for ${invite.name}`, user.id);
        return new Response(JSON.stringify({ success: true, code: newCode, message: "Invite resent" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // Staff invites - Delete
    if (routePath.match(/^\/api\/staff\/invites\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await deleteRecord(env, 'staff_invites', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // Staff attendance
    if (routePath === "/api/staff/attendance/clock-in" && request.method === "POST") {
      const user = await requireAuth(request, env, ["staff", "admin"]);
      if (!user) return errorResponse("Unauthorized - Please login", 401, corsHeaders, routePath);
      return await handleClockIn(request, env, corsHeaders);
    }

    if (routePath === "/api/staff/attendance/clock-out" && request.method === "POST") {
      const user = await requireAuth(request, env, ["staff", "admin"]);
      if (!user) return errorResponse("Unauthorized - Please login", 401, corsHeaders, routePath);
      return await handleClockOut(request, env, corsHeaders);
    }

    if (routePath === "/api/staff/attendance" && request.method === "GET") {
      const user = await requireAuth(request, env, ["staff", "admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);

      const url = new URL(request.url);
      const date = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

      try {
        let attendance = await env.DB.prepare(
          "SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ?"
        ).bind(user.id, date).first();

        if (!attendance) {
          const staffRecord = await env.DB.prepare(
            "SELECT id FROM staff WHERE email = (SELECT email FROM users WHERE id = ?)"
          ).bind(user.id).first();

          if (staffRecord) {
            attendance = await env.DB.prepare(
              "SELECT * FROM staff_attendance WHERE staff_id = ? AND date = ?"
            ).bind(staffRecord.id, date).first();
          }
        }

        const resolvedStaffId = attendance?.staff_id || user.id;
        let streak = 0;
        const streakResult = await env.DB.prepare(
          "SELECT date FROM staff_attendance WHERE staff_id = ? AND clock_in IS NOT NULL ORDER BY date DESC LIMIT 30"
        ).bind(resolvedStaffId).all();

        if (streakResult.results?.length) {
          streak = 1;
          for (let i = 1; i < streakResult.results.length; i++) {
            const prev = new Date(streakResult.results[i-1].date);
            const curr = new Date(streakResult.results[i].date);
            if ((prev - curr) / 86400000 <= 2) streak++; else break;
          }
        }

        return new Response(JSON.stringify({ attendance, streak }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // STAFF CRUD
    // ======================================================================
    if (routePath.match(/^\/api\/staff\/[^\/]+$/) && request.method === "GET") {
      try {
        const id = routePath.split('/')[3];
        const result = await env.DB.prepare(
          `SELECT s.*, b.name as branch_name FROM staff s LEFT JOIN branches b ON s.branch_id = b.id WHERE s.id = ?`
        ).bind(id).first();

        if (!result) {
          return errorResponse("Staff not found", 404, corsHeaders, routePath);
        }

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
      catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath.match(/^\/api\/staff\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try { const id = routePath.split('/')[3]; const body = await request.json(); const result = await updateRecord(env, 'staff', id, body); return new Response(JSON.stringify(result), { status: result.success ? 200 : 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
      catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
    }

    if (routePath.match(/^\/api\/staff\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        await env.DB.prepare("DELETE FROM wallet_transactions WHERE staff_id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM staff_wallets WHERE staff_id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM payroll WHERE staff_id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM staff_bank_accounts WHERE staff_id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM notifications WHERE user_id = ?").bind(id).run().catch(() => {});
        await env.DB.prepare("DELETE FROM staff_activity WHERE staff_id = ?").bind(id).run().catch(() => {});
        await env.DB.prepare("DELETE FROM staff_locations WHERE staff_id = ?").bind(id).run().catch(() => {});
        await env.DB.prepare("DELETE FROM staff_captures WHERE staff_id = ?").bind(id).run().catch(() => {});
        await env.DB.prepare("DELETE FROM staff_password_resets WHERE staff_id = ?").bind(id).run().catch(() => {});
        await env.DB.prepare("DELETE FROM charging_sessions WHERE staff = ?").bind(id).run().catch(() => {});
        await env.DB.prepare("DELETE FROM staff WHERE id = ?").bind(id).run();
        await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run().catch(() => {});

        return new Response(JSON.stringify({
          success: true,
          message: 'Staff and all related records deleted'
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
      catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // STAFF PASSWORD RESET ROUTES
    // ======================================================================
    if (routePath === "/api/staff/forgot-password" && request.method === "POST") {
      try {
        const body = await request.json();
        const { email, staffId } = body || {};

        if (!email || !staffId) {
          return new Response(JSON.stringify({ error: "Email and Staff ID are required" }), {
            status: 400, 
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const staff = await env.DB.prepare(
          "SELECT id, email, name, status FROM staff WHERE email = ? AND id = ?"
        ).bind(email.trim().toLowerCase(), staffId.trim()).first();

        if (!staff) {
          return errorResponse("Staff not found", 404, corsHeaders, routePath);
        }

        if (staff.status === 'inactive' || staff.status === 'suspended') {
          return new Response(JSON.stringify({ error: "Account is not active. Contact your administrator." }), {
            status: 403, 
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const recentRequest = await env.DB.prepare(
          "SELECT createdAt FROM staff_password_resets WHERE email = ? AND createdAt > ? ORDER BY createdAt DESC LIMIT 1"
        ).bind(email.trim().toLowerCase(), Date.now() - 300000).first();

        if (recentRequest) {
          const waitTime = Math.ceil((recentRequest.createdAt + 300000 - Date.now()) / 60000);
          return new Response(JSON.stringify({
            error: `Please wait ${waitTime} minute(s) before requesting another code.`
          }), { 
            status: 429, 
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            } 
          });
        }

        const resetCode = String(Math.floor(100000 + Math.random() * 900000));
        const resetId = crypto.randomUUID();
        const expiresAt = Date.now() + 1800000;

        await env.DB.prepare(
          "INSERT INTO staff_password_resets (id, staff_id, email, reset_code, expires_at, used, created_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)"
        ).bind(resetId, staff.id, email.trim().toLowerCase(), resetCode, expiresAt, Date.now(), ip,
               request.headers.get("user-agent") || "").run();

        try {
          await sendEmail(
            staff.email,
            `Password Reset Code: ${resetCode} — PrimeShieldHub`,
            `
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; padding: 20px;">
              <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px;">
                <h1 style="color: #12122a; font-size: 20px;">PrimeShieldHub</h1>
                <p>Hello ${staff.name},</p>
                <p>You requested a password reset. Use the code below:</p>
                <div style="background: #f8f8fc; border: 2px dashed #d6b25e; border-radius: 8px; padding: 14px; text-align: center; margin: 20px 0;">
                  <span style="font-size: 32px; font-weight: 800; color: #12122a; letter-spacing: 8px;">${resetCode}</span>
                </div>
                <p style="font-size: 12px; color: #888;">This code expires in 30 minutes.</p>
              </div>
            </body>
            </html>
            `,
            env
          );
        } catch (e) {
          console.log('Password reset email failed:', e.message);
        }

        const isDev = env.ENVIRONMENT === 'development' || request.headers.get('host')?.includes('localhost');

        return new Response(JSON.stringify({
          success: true,
          message: 'Reset code sent to your email.',
          ...(isDev ? { dev_code: resetCode } : {})
        }), { 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          } 
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to process request: " + e.message }), {
          status: 500, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    if (routePath === "/api/staff/reset-password" && request.method === "POST") {
      try {
        const body = await request.json();
        const { email, staffId, resetCode, newPassword } = body || {};

        if (!email || !staffId || !resetCode || !newPassword) {
          return new Response(JSON.stringify({ error: "All fields are required" }), {
            status: 400, 
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        if (newPassword.length < 8) {
          return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), {
            status: 400, 
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const staff = await env.DB.prepare(
          "SELECT id, email, status FROM staff WHERE email = ? AND id = ?"
        ).bind(email.trim().toLowerCase(), staffId.trim()).first();

        if (!staff) {
          return errorResponse("Staff not found.", 404, corsHeaders, routePath);
        }

        const reset = await env.DB.prepare(
          "SELECT * FROM staff_password_resets WHERE email = ? AND staff_id = ? AND reset_code = ? AND used = 0 AND expires_at > ? ORDER BY created_at DESC LIMIT 1"
        ).bind(email.trim().toLowerCase(), staff.id, resetCode.trim(), Date.now()).first();

        if (!reset) {
          return new Response(JSON.stringify({ error: "Invalid or expired reset code. Please request a new one." }), {
            status: 400, 
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const hashResult = await hashPassword(newPassword);

        await env.DB.prepare(
          "UPDATE staff SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(hashResult.hash, hashResult.salt, staff.id).run();

        await env.DB.prepare(
          "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(hashResult.hash, hashResult.salt, staff.id).run().catch(() => {});

        await env.DB.prepare(
          "UPDATE staff_password_resets SET used = 1 WHERE id = ?"
        ).bind(reset.id).run();

        return new Response(JSON.stringify({
          success: true,
          message: 'Password reset successful! Redirecting to login...'
        }), { 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          } 
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: "Failed to reset password: " + e.message }), {
          status: 500, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // DASHBOARD ROUTES
    // ======================================================================
    if (routePath === "/api/notifications" && request.method === "GET") { return await dashboardHandler.getNotifications(request, env, ctx); }
    if (routePath === "/api/notifications/read-all" && request.method === "PUT") { return await dashboardHandler.markAllNotificationsRead(request, env, ctx); }
    if (routePath.match(/^\/api\/notifications\/[^\/]+\/read$/) && request.method === "PUT") { return await dashboardHandler.markNotificationRead(request, env, ctx); }
    if (routePath === "/api/customers/loyalty" && request.method === "GET") { return await dashboardHandler.getCustomerLoyalty(request, env, ctx); }
    if (routePath === "/api/customers/loyalty/earn" && request.method === "POST") { return await dashboardHandler.earnLoyaltyPoints(request, env, ctx); }
    if (routePath === "/api/analytics/dashboard" && request.method === "GET") { return await dashboardHandler.getDashboardAnalytics(request, env, ctx); }

    // ======================================================================
    // BRANCH ROUTES
    // ======================================================================
    if (routePath === "/api/branches" && request.method === "GET") {
      try { const result = await env.DB.prepare('SELECT * FROM branches ORDER BY created_at DESC').all(); return new Response(JSON.stringify(result.results || []), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
      catch (e) { return new Response(JSON.stringify({ error: e.message, data: [] }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
    }
    if (routePath === "/api/branches" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try { 
        const body = await request.json(); 
        const { name, city, address, phone, manager, location } = body || {}; 
        const id = body.id || crypto.randomUUID(); 
        await env.DB.prepare(
          `INSERT INTO branches (id, name, city, address, phone, manager, location, status, created_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))`
        ).bind(id, name || 'New Branch', city || '', address || '', phone || '', manager || '', location || '').run(); 
        return new Response(JSON.stringify({ success: true, id }), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); 
      }
      catch (e) { return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders } }); }
    }
    if (routePath.match(/^\/api\/branches\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const body = await request.json();
        const result = await updateRecord(env, 'branches', id, body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/branches\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const staffCount = await env.DB.prepare("SELECT COUNT(*) as count FROM staff WHERE branch_id = ?").bind(id).first();
        if (staffCount?.count > 0) {
          return new Response(JSON.stringify({ error: "Cannot delete branch with active staff" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const result = await deleteRecord(env, 'branches', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // CHARGING ROUTES
    // ======================================================================
    if (routePath === "/api/charging/start" && request.method === "POST") { return await handleChargingStart(request, env, ctx, corsHeaders, ip, fingerprint); }
    if (routePath === "/api/charging/timer" && request.method === "GET") { return await handleChargingTimer(request, env, ctx, corsHeaders); }
    if (routePath.match(/^\/api\/charging\/session\/[^\/]+$/) && request.method === "GET") { return await handleGetSession(request, env, ctx, corsHeaders); }
    if (routePath === "/api/charging/pause" && request.method === "POST") { return await handleChargingPause(request, env, ctx, corsHeaders, ip, fingerprint); }
    if (routePath === "/api/charging/resume" && request.method === "POST") { return await handleChargingResume(request, env, ctx, corsHeaders, ip, fingerprint); }
    if (routePath === "/api/charging/complete" && request.method === "POST") { return await handleChargingComplete(request, env, ctx, corsHeaders, ip, fingerprint); }
    if (routePath === "/api/charging/ready" && request.method === "POST") { return await handleMarkReady(request, env, ctx, corsHeaders, ip, fingerprint); }
    if (routePath === "/api/charging/bays" && request.method === "GET") { return await handleChargingBays(request, env, ctx, corsHeaders); }
    if (routePath === "/api/charging/stats" && request.method === "GET") { return await handleChargingStats(request, env, ctx, corsHeaders); }

    // ======================================================================
    // WHOLESALE CODES
    // ======================================================================
    if (routePath === "/api/wholesale/codes" && request.method === "GET") {
      try {
        let query = 'SELECT * FROM wholesale_codes';
        const columns = await getTableColumns(env, 'wholesale_codes');
        if (columns.includes('created_at')) query += ' ORDER BY created_at DESC';
        else if (columns.includes('createdAt')) query += ' ORDER BY createdAt DESC';
        else if (columns.includes('id')) query += ' ORDER BY id DESC';
        const result = await env.DB.prepare(query).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/wholesale/codes/generate" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { description, discount_percent, max_uses } = body || {};
        const code = 'WH-' + crypto.randomUUID().slice(0, 8).toUpperCase();
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO wholesale_codes (id, code, description, discount_percent, max_uses, times_used, is_active, created_at) VALUES (?, ?, ?, ?, ?, 0, 1, datetime('now'))"
        ).bind(id, code, description || 'Wholesale discount', discount_percent || 10, max_uses || 100).run();
        await logEvent(env, "WHOLESALE_CODE_GENERATED", `Wholesale code generated: ${code}`, user.id);
        return new Response(JSON.stringify({ success: true, code, id, message: "Wholesale code generated successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/wholesale\/codes\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const body = await request.json();
        const result = await updateRecord(env, 'wholesale_codes', id, body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/wholesale\/codes\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await deleteRecord(env, 'wholesale_codes', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // ✅ NEW: /api/wholesale/verify-code - REQUIRED FOR CHECKOUT.HTML
    // ======================================================================
    if (routePath === "/api/wholesale/verify-code" && request.method === "POST") {
      return await handleWholesaleVerifyCode(request, env, corsHeaders);
    }

    // ======================================================================
    // WHOLESALE PRODUCTS - Returns products with wholesale pricing
    // ======================================================================
    if (routePath === "/api/wholesale/products" && request.method === "GET") {
      return await handleWholesaleProducts(request, env, corsHeaders, { routePath });
    }

    // ======================================================================
    // WHOLESALE REQUEST ACCESS - Reseller access request form
    // ======================================================================
    if (routePath === "/api/wholesale/request-access" && request.method === "POST") {
      return await handleWholesaleRequestAccess(request, env, corsHeaders);
    }

    // ======================================================================
    // WHOLESALE REQUEST QUOTE - Custom bulk quote request
    // ======================================================================
    if (routePath === "/api/wholesale/request-quote" && request.method === "POST") {
      return await handleWholesaleRequestQuote(request, env, corsHeaders);
    }

    // ======================================================================
    // RESELLER CODES
    // ======================================================================
    if (routePath === "/api/reseller-codes" && request.method === "GET") {
      try {
        let query = 'SELECT * FROM reseller_codes';
        const columns = await getTableColumns(env, 'reseller_codes');
        if (columns.includes('created_at')) query += ' ORDER BY created_at DESC';
        else if (columns.includes('createdAt')) query += ' ORDER BY createdAt DESC';
        else if (columns.includes('code')) query += ' ORDER BY code DESC';
        else if (columns.includes('id')) query += ' ORDER BY id DESC';
        const result = await env.DB.prepare(query).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/reseller-codes/generate" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { reseller_name, discount, tier, maxUses } = body || {};
        const code = 'REF-' + crypto.randomUUID().slice(0, 8).toUpperCase();
        await env.DB.prepare(
          "INSERT INTO reseller_codes (code, discount, tier, maxUses, active, createdAt) VALUES (?, ?, ?, ?, 1, datetime('now'))"
        ).bind(code, discount || 10, tier || 'standard', maxUses || 50).run();
        await logEvent(env, "RESELLER_CODE_GENERATED", `Reseller code generated: ${code}`, user.id);
        return new Response(JSON.stringify({ success: true, code, message: "Reseller code generated successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/reseller-codes\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const code = routePath.split('/').pop();
        const body = await request.json();
        const result = await updateRecord(env, 'reseller_codes', code, body, 'code');
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/reseller-codes\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const code = routePath.split('/').pop();
        const result = await deleteRecord(env, 'reseller_codes', code, 'code');
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // TRANSACTIONS
    // ======================================================================
    if (routePath === "/api/transactions" && request.method === "GET") {
      try {
        let query = 'SELECT * FROM transactions';
        const columns = await getTableColumns(env, 'transactions');
        if (columns.includes('created_at')) query += ' ORDER BY created_at DESC';
        else if (columns.includes('createdAt')) query += ' ORDER BY createdAt DESC';
        else if (columns.includes('id')) query += ' ORDER BY id DESC';
        const result = await env.DB.prepare(query).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // CHARGING SESSIONS
    // ======================================================================
    if (routePath === "/api/charging/sessions" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT cs.*, b.name as bay_name, s.name as staff_name 
          FROM charging_sessions cs 
          LEFT JOIN bays b ON cs.bay_id = b.id 
          LEFT JOIN staff s ON cs.staff = s.id 
          ORDER BY cs.start_time DESC
        `).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // PAGES CRUD
    // ======================================================================
    if (routePath === "/api/pages" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM pages ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/pages" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { title, content, slug, meta_title, meta_description, meta_keywords, status } = body || {};
        if (!title || !slug) {
          return new Response(JSON.stringify({ error: "Title and slug are required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO pages (id, title, slug, content, meta_title, meta_description, meta_keywords, status, views, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`
        ).bind(id, title, slug, content || '', meta_title || '', meta_description || '', meta_keywords || '', status || 'draft').run();
        await logEvent(env, "PAGE_CREATED", `Page created: ${title}`, user.id);
        return new Response(JSON.stringify({ success: true, id, message: "Page created successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/pages\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const body = await request.json();
        const result = await updateRecord(env, 'pages', id, body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/pages\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await deleteRecord(env, 'pages', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // INVESTOR LEADS
    // ======================================================================
    if (routePath === "/api/investor/leads" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM investor_leads ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // LOGS
    // ======================================================================
    if (routePath === "/api/logs" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const result = await env.DB.prepare(
          'SELECT * FROM logs ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        ).bind(limit, offset).all();
        const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM logs').first();
        return new Response(JSON.stringify({
          logs: result.results || [],
          total: countResult?.count || 0
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ logs: [], total: 0 }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // SECURITY INCIDENTS
    // ======================================================================
    if (routePath === "/api/security/incidents" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM security_incidents ORDER BY reported_at DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify([]), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // AUDIT LOGS
    // ======================================================================
    if (routePath === "/api/audit/logs" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const result = await env.DB.prepare(
          'SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ? OFFSET ?'
        ).bind(limit, offset).all();
        const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM audit_logs').first();
        return new Response(JSON.stringify({
          logs: result.results || [],
          total: countResult?.count || 0
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ logs: [], total: 0 }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // ADDITIONAL CRUD ENDPOINTS
    // ======================================================================

    // ===== CUSTOMER HISTORY =====
    if (routePath === "/api/customer/history" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM customer_history ORDER BY date DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        try {
          const result = await env.DB.prepare('SELECT * FROM customer_history ORDER BY created_at DESC').all();
          return new Response(JSON.stringify(result.results || []), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        } catch (e2) {
          return new Response(JSON.stringify({ error: e2.message, data: [] }), {
            status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
      }
    }

    // ===== OTP CODES =====
    if (routePath === "/api/otp" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT o.*, u.name as user_name FROM otp_codes o 
          LEFT JOIN users u ON o.user_id = u.id 
          ORDER BY o.created_at DESC
        `).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== USER DEVICES =====
    if (routePath === "/api/user-devices" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT ud.*, u.name as user_name FROM user_devices ud 
          LEFT JOIN users u ON ud.user_id = u.id 
          ORDER BY ud.last_seen DESC
        `).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // ===== REFERRAL ROUTES =====
    // ======================================================================

    if (routePath === "/api/referrals" && request.method === "GET") {
      return await handleGetReferrals(request, env, corsHeaders);
    }

    if (routePath === "/api/referrals/claim" && request.method === "POST") {
      return await handleClaimReferralReward(request, env, corsHeaders);
    }

    // ======================================================================
    // ===== SUBSCRIPTION PAYMENT ROUTE =====
    // ======================================================================

    if (routePath === "/api/subscription/initialize" && request.method === "POST") {
      return await handleInitializeSubscription(request, env, corsHeaders);
    }

    // ======================================================================
    // ===== EXPORT DATA ROUTE =====
    // ======================================================================

    if (routePath.match(/^\/api\/export\/(.+)$/) && request.method === "GET") {
      return await handleExportData(request, env, corsHeaders);
    }

    // ======================================================================
    // WHOLESALE REQUESTS
    // ======================================================================
    if (routePath === "/api/wholesale/requests" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM wholesale_requests ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== RESELLERS =====
    if (routePath === "/api/resellers" && request.method === "GET") {
      try {
        let query = 'SELECT * FROM resellers';
        try {
          const tableInfo = await env.DB.prepare("PRAGMA table_info(resellers)").all();
          const columns = (tableInfo.results || []).map(c => c.name);
          if (columns.includes('createdAt')) query += ' ORDER BY createdAt DESC';
          else if (columns.includes('created_at')) query += ' ORDER BY created_at DESC';
        } catch (e) {}
        const result = await env.DB.prepare(query).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/resellers" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { name, email, phone, location, rank } = body || {};
        if (!name) {
          return new Response(JSON.stringify({ error: "Name is required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO resellers (id, name, email, phone, location, rank, status, total_earnings, total_referrals, createdAt) VALUES (?, ?, ?, ?, ?, ?, 'active', 0, 0, datetime('now'))"
        ).bind(id, name, email || '', phone || '', location || '', rank || 'bronze').run();
        await logEvent(env, "RESELLER_CREATED", `Reseller created: ${name}`, user.id);
        return new Response(JSON.stringify({ success: true, id, message: "Reseller created successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== PUBLIC RESELLER APPLICATION (NO AUTH REQUIRED) =====
    if (routePath === "/api/resellers/apply" && request.method === "POST") {
      try {
        const body = await request.json();
        
        const { 
          fullName, businessName, phone, email, location, city, 
          businessType, orderVolume, partnershipTier, experience, 
          referralSource, marketingConsent 
        } = body || {};

        // Basic Validation
        if (!fullName || !phone || !email) {
          return new Response(JSON.stringify({ 
            success: false,
            error: "Full name, phone, and email are required" 
          }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        // Check if this email has already applied
        const existing = await env.DB.prepare("SELECT id FROM resellers WHERE email = ?").bind(email).first();
        if (existing) {
          return new Response(JSON.stringify({ 
            success: true, duplicate: true, 
            message: "You have already applied. We will contact you soon." 
          }), {
            status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        const id = crypto.randomUUID();
        const now = Date.now();
        
        // 1. INSERT INTO DATABASE
        await env.DB.prepare(
          `INSERT INTO resellers (
            id, name, email, phone, location, business_name, city, 
            business_type, order_volume, partnership_tier, experience, 
            referral_source, rank, status, total_earnings, total_referrals, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 0, 0, ?)`
        ).bind(
          id, fullName, email, phone, location || '', businessName || null,
          city || null, businessType || null, orderVolume || null,
          partnershipTier || null, experience || null, referralSource || null, now
        ).run();

        await logEvent(env, "RESELLER_APPLICATION", `New application from: fullName({email})`);

        // 2. SEND AUTOMATED CONFIRMATION EMAIL TO APPLICANT
        try {
          const applicantEmailHtml = `
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; background: #f4f4f8; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px;">
                <h1 style="color: #12122a;">Application Received</h1>
                <p>Dear ${fullName},</p>
                <p>Thank you for applying to become a PrimeShieldHub Reseller. We have received your application for the <strong>${partnershipTier || 'Starter'}</strong> tier.</p>
                <div style="background: #f8f8fc; border-left: 4px solid #d6b25e; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0;"><strong>Next Steps:</strong></p>
                  <p style="margin: 8px 0 0 0;">Our partnership team will review your application. You will be contacted within 24-48 hours with the next steps.</p>
                </div>
                <p>If you have any questions, reply to this email or contact us at primeshieldhub@gmail.com.</p>
                <p>Best regards,<br>The PrimeShieldHub Team</p>
              </div>
            </body>
            </html>
          `;
          await sendEmail(email, "Application Received — PrimeShieldHub Reseller Program", applicantEmailHtml, env);
        } catch (emailErr) {
          console.error('[Reseller Apply] Applicant email failed:', emailErr);
        }

        // 3. SEND NOTIFICATION EMAIL TO ADMIN (OPTIONAL BUT RECOMMENDED)
        try {
          const adminEmailHtml = `
            <h2>New Reseller Application</h2>
            <p><strong>Name:</strong> ${fullName}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Phone:</strong> ${phone}</p>
            <p><strong>Business:</strong> ${businessName || 'N/A'}</p>
            <p><strong>Location:</strong> ${location} ${city ? '- ' + city : ''}</p>
            <p><strong>Tier:</strong> ${partnershipTier}</p>
            <p><a href="https://primeshieldhub.com/admin/">Login to Admin Dashboard to Review</a></p>
          `;
          await sendEmail("primeshieldhub@gmail.com", `New Reseller Application: ${fullName}`, adminEmailHtml, env);
        } catch (adminEmailErr) {
          console.error('[Reseller Apply] Admin email failed:', adminEmailErr);
        }

        return new Response(JSON.stringify({ 
          success: true, id, 
          message: "Application submitted successfully" 
        }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (e) {
        console.error('[Reseller Apply]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== GET SINGLE RESELLER BY ID (Admin Only) =====
    if (routePath.match(/^\/api\/resellers\/[^\/]+$/) && request.method === "GET") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      
      try {
        const id = routePath.split('/').pop();
        
        const result = await env.DB.prepare(
          "SELECT * FROM resellers WHERE id = ?"
        ).bind(id).first();
        
        if (!result) {
          return errorResponse("Reseller not found", 404, corsHeaders, routePath);
        }
        
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true", 
            ...corsHeaders 
          }
        });
        
      } catch (e) {
        console.error('[Reseller Get]', e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, 
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true", 
            ...corsHeaders 
          }
        });
      }
    }

    // ===== UPDATE RESELLER (Admin Only) — Handles Approval + Welcome Email =====
    if (routePath.match(/^\/api\/resellers\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      
      try {
        const id = routePath.split('/').pop();
        const body = await request.json();
        
        // 1. Get the existing reseller record first (so we have their email, name etc.)
        const reseller = await env.DB.prepare(
          "SELECT * FROM resellers WHERE id = ?"
        ).bind(id).first();
        
        if (!reseller) {
          return errorResponse("Reseller not found", 404, corsHeaders, routePath);
        }
        
        // 2. If the admin is approving this reseller, generate a unique code
        let resellerCode = null;
        const isBeingApproved = body.status === 'active' && reseller.status === 'pending';
        
        if (isBeingApproved) {
          resellerCode = 'PSH-' + crypto.randomUUID().split('-')[0].toUpperCase();
          
          // Save the reseller code into the reseller_codes table for future use
          try {
            await env.DB.prepare(
              "INSERT INTO reseller_codes (code, discount, tier, maxUses, active, createdAt) VALUES (?, 10, ?, 100, 1, datetime('now'))"
            ).bind(resellerCode, body.rank || 'bronze').run();
          } catch (codeErr) {
            console.error('[Reseller Approval] Failed to save reseller code:', codeErr);
          }
        }
        
        // 3. Update the reseller record in the database
        const result = await updateRecord(env, 'resellers', id, body);
        
        if (!result.success) {
          return new Response(JSON.stringify(result), {
            status: 500, 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        
        // 4. Send welcome email if this was an approval
        if (isBeingApproved && resellerCode && reseller.email) {
          try {
            const welcomeEmailHtml = `
              <!DOCTYPE html>
              <html>
              <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; padding: 40px 20px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
                  
                  <!-- Header -->
                  <div style="background: linear-gradient(135deg, #0f0f13 0%, #1a1a25 100%); padding: 40px 32px; text-align: center;">
                    <h1 style="color: #d6b25e; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: 2px;">
                      PRIME<span style="color: #f3dba0;">SHIELD</span>HUB
                    </h1>
                    <p style="color: #b8b6ad; font-size: 13px; margin: 8px 0 0 0; letter-spacing: 1px;">Premium Reseller Program</p>
                  </div>

                  <!-- Body -->
                  <div style="padding: 40px 32px;">
                    <div style="text-align: center; margin-bottom: 28px;">
                      <span style="display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 8px 20px; border-radius: 50px; font-weight: 600; font-size: 13px;">
                        ✓ Application Approved
                      </span>
                    </div>

                    <h2 style="color: #12122a; font-size: 22px; margin: 0 0 12px 0;">Welcome to the Team, ${reseller.name}!</h2>
                    <p style="color: #555; font-size: 15px; line-height: 1.7; margin-bottom: 24px;">
                      Congratulations! Your application to become an authorized PrimeShieldHub Reseller has been approved. We are thrilled to have you partner with us.
                    </p>

                    <div style="background: #f8f8fc; border-left: 4px solid #d6b25e; padding: 16px 20px; border-radius: 8px; margin-bottom: 24px;">
                      <p style="color: #333; font-size: 14px; margin: 0 0 8px 0;"><strong>Your Business:</strong> ${reseller.business_name || 'Individual Reseller'}</p>
                      <p style="color: #333; font-size: 14px; margin: 0 0 8px 0;"><strong>Location:</strong> reseller.location{reseller.city ? ', ' + reseller.city : ''}</p>
                      <p style="color: #333; font-size: 14px; margin: 0;"><strong>Tier:</strong> ${(body.rank || 'bronze').toUpperCase()}</p>
                    </div>

                    <!-- Reseller Code Box -->
                    <p style="color: #333; font-size: 15px; margin: 24px 0 12px 0; font-weight: 600;">Your Exclusive Reseller Code:</p>
                    <div style="background: #12122a; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                      <p style="color: #f3dba0; font-size: 26px; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 4px; margin: 0;">
                        ${resellerCode}
                      </p>
                      <p style="color: #888; font-size: 12px; margin: 8px 0 0 0;">Share this with your customers for exclusive discounts</p>
                    </div>

                    <div style="background: #fff8e1; border-left: 4px solid #ffb300; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
                      <p style="color: #7a5c00; font-size: 13px; margin: 0; line-height: 1.5;">
                        <strong>Next Steps:</strong> Log in to the reseller portal to view wholesale pricing, place your first order, and access marketing materials. Our team will contact you shortly with your onboarding guide.
                      </p>
                    </div>

                    <!-- CTA Button -->
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="https://primeshieldhub.com/reseller-dashboard" style="display: inline-block; background: linear-gradient(135deg, #b8943c, #d6b25e); color: #0f0f13; padding: 14px 40px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 15px;">
                        Access Reseller Portal
                      </a>
                    </div>

                    <hr style="border: none; height: 1px; background: #eee; margin: 24px 0;">
                    <p style="color: #888; font-size: 12px; line-height: 1.6; margin: 0;">
                      Questions? Reply to this email or chat with us on WhatsApp at <a href="https://wa.me/2348103535978" style="color: #b8943c;">+234 810 353 5978</a>.
                    </p>
                  </div>

                  <!-- Footer -->
                  <div style="background: #f8f8fc; padding: 20px; text-align: center; border-top: 1px solid #eee;">
                    <p style="color: #999; font-size: 11px; margin: 0;">© 2026 PrimeShieldHub · 108 Ekhorutomwen Street, Uselu, Benin City, Edo State</p>
                  </div>
                </div>
              </body>
              </html>
            `;
            
            await sendEmail(
              reseller.email, 
              `🎉 Congratulations! You're Now a PrimeShieldHub Reseller`, 
              welcomeEmailHtml, 
              env
            );
            
            console.log(`[Reseller Approval] Welcome email sent to ${reseller.email} with code ${resellerCode}`);
          } catch (emailErr) {
            console.error('[Reseller Approval] Welcome email failed:', emailErr);
          }
        }
        
        return new Response(JSON.stringify({
          success: true,
          message: isBeingApproved ? "Reseller approved & welcome email sent" : "Reseller updated",
          resellerCode: resellerCode || undefined
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
        
      } catch (e) {
        console.error('[Reseller Update]', e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, 
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath.match(/^\/api\/resellers\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await deleteRecord(env, 'resellers', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== RESELLER DASHBOARD — Get my profile =====
    if (routePath === "/api/reseller/me" && request.method === "GET") {
      const user = await requireAuth(request, env, null);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      
      try {
        const reseller = await env.DB.prepare(
          "SELECT * FROM resellers WHERE email = ? OR user_id = ?"
        ).bind(user.email, user.id).first();
        
        if (!reseller) {
          return errorResponse("You are not registered as a reseller", 404, corsHeaders, routePath);
        }
        
        // Get their reseller code
        const codeRow = await env.DB.prepare(
          "SELECT code, discount, maxUses, times_used FROM reseller_codes WHERE tier = ? AND active = 1 LIMIT 1"
        ).bind(reseller.rank || 'bronze').first();
        
        return new Response(JSON.stringify({
          success: true,
          reseller: {
            id: reseller.id,
            name: reseller.name,
            email: reseller.email,
            phone: reseller.phone,
            businessName: reseller.business_name,
            city: reseller.city,
            location: reseller.location,
            rank: reseller.rank,
            status: reseller.status,
            totalEarnings: reseller.total_earnings || 0,
            totalReferrals: reseller.total_referrals || 0,
            joinedAt: reseller.createdAt,
            resellerCode: codeRow?.code || null,
            codeDiscount: codeRow?.discount || 10
          }
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        console.error('[Reseller Me]', e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== RESELLER DASHBOARD — Get my sales =====
    if (routePath === "/api/reseller/sales" && request.method === "GET") {
      const user = await requireAuth(request, env, null);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      
      try {
        const reseller = await env.DB.prepare(
          "SELECT id FROM resellers WHERE email = ? OR user_id = ?"
        ).bind(user.email, user.id).first();
        
        if (!reseller) return errorResponse("Not a reseller", 404, corsHeaders, routePath);
        
        // Get all orders referred by this reseller
        const sales = await env.DB.prepare(
          "SELECT id, reference, customerName, total, discount_code, status, createdAt FROM orders WHERE reseller_id = ? ORDER BY createdAt DESC LIMIT 100"
        ).bind(reseller.id).all();
        
        // Calculate totals
        const salesArray = sales.results || [];
        const totalSales = salesArray.reduce((sum, s) => sum + (s.total || 0), 0);
        const totalCommission = Math.round(totalSales * 0.10);
        
        return new Response(JSON.stringify({
          success: true,
          sales: salesArray,
          stats: {
            totalOrders: salesArray.length,
            totalSales: totalSales,
            totalCommission: totalCommission,
            pendingCommission: Math.round(totalSales * 0.10 * 0.5) // 50% pending example
          }
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        console.error('[Reseller Sales]', e);
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== RESELLER DASHBOARD — Full aggregated data (single endpoint) =====
    if (routePath === "/api/reseller/dashboard" && request.method === "GET") {
      const user = await requireAuth(request, env, null);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      
      try {
        // 1. Find the reseller record
        const reseller = await env.DB.prepare(
          "SELECT * FROM resellers WHERE email = ? OR user_id = ?"
        ).bind(user.email, user.id).first();
        
        if (!reseller) {
          return new Response(JSON.stringify({
            stats: { totalRevenue: 0, totalOrders: 0, totalCustomers: 0, commissionRate: 0 },
            orders: [],
            tier: { totalRevenue: 0 },
            benefits: { discount: 10 }
          }), {
            status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        
        // 2. Get all orders referred by this reseller
        const ordersResult = await env.DB.prepare(
          `SELECT id, reference, customerName, customerEmail, total, discount_code, status, createdAt,
                  items
           FROM orders 
           WHERE reseller_id = ? 
           ORDER BY createdAt DESC 
           LIMIT 100`
        ).bind(reseller.id).all();
        
        const orders = ordersResult.results || [];
        
        // 3. Calculate stats
        const totalRevenue = orders.reduce((sum, o) => sum + (parseFloat(o.total) || 0), 0);
        const totalOrders = orders.length;
        const uniqueCustomers = new Set(orders.map(o => o.customerEmail).filter(Boolean));
        const totalCustomers = uniqueCustomers.size;
        const commissionRate = 10; // 10% commission
        
        // Calculate this month vs last month for "change" indicators
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        
        let thisMonthRevenue = 0;
        let lastMonthRevenue = 0;
        let thisMonthOrders = 0;
        let lastMonthOrders = 0;
        
        orders.forEach(o => {
          const ts = typeof o.createdAt === 'number' ? o.createdAt : new Date(o.createdAt).getTime();
          const rev = parseFloat(o.total) || 0;
          if (ts >= thisMonthStart) { thisMonthRevenue += rev; thisMonthOrders++; }
          else if (ts >= lastMonthStart && ts < thisMonthStart) { lastMonthRevenue += rev; lastMonthOrders++; }
        });
        
        const revenueChange = lastMonthRevenue > 0 
          ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100) 
          : (thisMonthRevenue > 0 ? 100 : 0);
        const ordersChange = lastMonthOrders > 0 
          ? Math.round(((thisMonthOrders - lastMonthOrders) / lastMonthOrders) * 100) 
          : (thisMonthOrders > 0 ? 100 : 0);
        
        // 4. Format orders for the dashboard table
        const formattedOrders = orders.map(o => {
          let itemCount = 0;
          try {
            const items = JSON.parse(o.items || '[]');
            itemCount = items.reduce((sum, i) => sum + (i.quantity || 1), 0);
          } catch (e) {}
          
          return {
            id: o.id,
            reference: o.reference,
            customer_name: o.customerName || 'Guest',
            customer_email: o.customerEmail,
            total: parseFloat(o.total) || 0,
            commission: Math.round((parseFloat(o.total) || 0) * 0.10),
            status: o.status || 'pending',
            paymentStatus: o.status,
            created_at: o.createdAt,
            items: new Array(itemCount).fill({}) // Filler array for .length
          };
        });
        
        // 5. Get reseller's code
        let resellerCode = null;
        try {
          const codeRow = await env.DB.prepare(
            "SELECT code, discount FROM reseller_codes WHERE tier = ? AND active = 1 LIMIT 1"
          ).bind(reseller.rank || 'bronze').first();
          if (codeRow) resellerCode = codeRow.code;
        } catch (e) {}
        
        // 6. Build response
        return new Response(JSON.stringify({
          success: true,
          reseller: {
            id: reseller.id,
            name: reseller.name,
            email: reseller.email,
            phone: reseller.phone,
            businessName: reseller.business_name,
            city: reseller.city,
            location: reseller.location,
            rank: reseller.rank || 'bronze',
            status: reseller.status,
            totalEarnings: reseller.total_earnings || 0,
            totalReferrals: reseller.total_referrals || 0,
            joinedAt: reseller.createdAt,
            resellerCode: resellerCode
          },
          stats: {
            totalRevenue: Math.round(totalRevenue),
            totalOrders: totalOrders,
            totalCustomers: totalCustomers,
            commissionRate: commissionRate,
            totalCommission: Math.round(totalRevenue * (commissionRate / 100)),
            revenueChange: revenueChange,
            ordersChange: ordersChange,
            customersChange: 0
          },
          orders: formattedOrders,
          tier: {
            totalRevenue: Math.round(totalRevenue),
            current: reseller.rank || 'bronze'
          },
          benefits: {
            discount: reseller.rank === 'platinum' ? 25 :
                      reseller.rank === 'gold' ? 20 :
                      reseller.rank === 'silver' ? 15 : 10
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
        
      } catch (e) {
        console.error('[Reseller Dashboard]', e);
        return new Response(JSON.stringify({ 
          success: false, 
          error: e.message,
          stats: { totalRevenue: 0, totalOrders: 0, totalCustomers: 0, commissionRate: 0 },
          orders: [],
          tier: { totalRevenue: 0 },
          benefits: { discount: 10 }
        }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }


    // ===== DAILY STATS =====
    if (routePath === "/api/daily-stats" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM daily_stats ORDER BY date DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== DEPLOY LOGS =====
    if (routePath === "/api/deploy-logs" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM deploy_logs ORDER BY timestamp DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== AI RECOMMENDATIONS =====
    if (routePath === "/api/ai/recommendations" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM ai_recommendations ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== AI CONVERSATIONS =====
    if (routePath === "/api/ai/conversations" && request.method === "GET") {
      try {
        const columns = await getTableColumns(env, 'ai_conversations');
        let orderColumn = 'id';
        if (columns.includes('created_at')) orderColumn = 'created_at';
        else if (columns.includes('timestamp')) orderColumn = 'timestamp';
        else if (columns.includes('createdAt')) orderColumn = 'createdAt';
        else if (columns.includes('updated_at')) orderColumn = 'updated_at';
        const result = await env.DB.prepare(`SELECT * FROM ai_conversations ORDER BY ${orderColumn} DESC`).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== COMMISSIONS =====
    if (routePath === "/api/commissions" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT c.*, r.name as reseller_name FROM commissions c 
          LEFT JOIN resellers r ON c.reseller_id = r.id 
          ORDER BY c.created_at DESC
        `).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/commissions" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { reseller_id, amount, description, type } = body || {};
        if (!reseller_id || !amount) {
          return new Response(JSON.stringify({ error: "reseller_id and amount are required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO commissions (id, reseller_id, amount, description, type, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))"
        ).bind(id, reseller_id, amount, description || '', type || 'sale').run();
        await logEvent(env, "COMMISSION_CREATED", `Commission created for reseller ${reseller_id}`, user.id);
        return new Response(JSON.stringify({ success: true, id, message: "Commission created successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/commissions\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const body = await request.json();
        const result = await updateRecord(env, 'commissions', id, body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/commissions\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await deleteRecord(env, 'commissions', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== PENALTIES =====
    if (routePath === "/api/penalties" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM penalties ORDER BY timestamp DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/penalties" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { staff_id, amount, reason } = body || {};
        if (!staff_id || !amount || !reason) {
          return new Response(JSON.stringify({ error: "staff_id, amount, and reason are required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO penalties (id, staff_id, amount, reason, timestamp) VALUES (?, ?, ?, ?, datetime('now'))"
        ).bind(id, staff_id, amount, reason).run();
        await logEvent(env, "PENALTY_CREATED", `Penalty created for staff ${staff_id}`, user.id);
        return new Response(JSON.stringify({ success: true, id, message: "Penalty created successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/penalties\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await deleteRecord(env, 'penalties', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== COUNTERS =====
    if (routePath === "/api/counters" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM counters ORDER BY key').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== ACTIONS =====
    if (routePath === "/api/actions" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM actions ORDER BY timestamp DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== ALERTS =====
    if (routePath === "/api/alerts" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT id, type, message, created_at FROM alerts ORDER BY created_at DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/alerts" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { type, message } = body || {};
        if (!type || !message) {
          return new Response(JSON.stringify({ error: "type and message are required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO alerts (id, type, message, created_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(id, type, message).run();
        await logEvent(env, "ALERT_CREATED", `Alert created: ${type}`, user.id);
        return new Response(JSON.stringify({ success: true, id, message: "Alert created successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/alerts\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await deleteRecord(env, 'alerts', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== NOTIFICATIONS =====
    if (routePath === "/api/notifications" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const result = await env.DB.prepare(
          'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ? OFFSET ?'
        ).bind(limit, offset).all();
        const countResult = await env.DB.prepare('SELECT COUNT(*) as count FROM notifications').first();
        return new Response(JSON.stringify({
          notifications: result.results || [],
          total: countResult?.count || 0
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ notifications: [], total: 0 }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/notifications" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin", "staff"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { user_id, title, message, type, link } = body || {};
        if (!user_id || !title || !message) {
          return new Response(JSON.stringify({ error: "user_id, title, and message are required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO notifications (id, user_id, title, message, type, link, read, createdAt) VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now'))"
        ).bind(id, user_id, title, message, type || 'info', link || null).run();
        await logEvent(env, "NOTIFICATION_CREATED", `Notification created for ${user_id}`, user.id);
        return new Response(JSON.stringify({ success: true, id, message: "Notification created successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/notifications\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await deleteRecord(env, 'notifications', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== PAYMENTS =====
    if (routePath === "/api/payments" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT p.*, cs.customer_name FROM payments p 
          LEFT JOIN charging_sessions cs ON p.session_id = cs.id 
          ORDER BY p.createdAt DESC
        `).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        try {
          const result = await env.DB.prepare('SELECT * FROM payments ORDER BY createdAt DESC').all();
          return new Response(JSON.stringify(result.results || []), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        } catch (e2) {
          return new Response(JSON.stringify({ error: e2.message, data: [] }), {
            status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
      }
    }

    // ===== PAYOUTS =====
    if (routePath === "/api/payouts" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM payouts ORDER BY createdAt DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    
    // ===== RESELLER PAYOUT — Request withdrawal (CORRECTED) =====
    if (routePath === "/api/reseller/request-payout" && request.method === "POST") {
      const user = await requireAuth(request, env, null);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      
      try {
        const body = await request.json();
        const { amount, bankName, accountNumber, accountName } = body || {};
        
        if (!amount || amount < 5000) {
          return new Response(JSON.stringify({ success: false, error: "Minimum payout is ₦5,000" }), {
            status: 400, 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        
        // Find reseller
        const reseller = await env.DB.prepare(
          "SELECT id, total_earnings FROM resellers WHERE email = ? OR user_id = ?"
        ).bind(user.email, user.id).first();
        
        if (!reseller) {
          return errorResponse("You are not a registered reseller", 404, corsHeaders, routePath);
        }
        
        if ((reseller.total_earnings || 0) < amount) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: `Insufficient balance. Your available earnings: ₦${(reseller.total_earnings || 0).toLocaleString()}` 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        
        if (!bankName || !accountNumber || !accountName) {
          return new Response(JSON.stringify({ success: false, error: "Bank details are required" }), {
            status: 400, 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        
        // Insert using the CORRECT column names (reseller_id, created_at)
        const id = crypto.randomUUID();
        await env.DB.prepare(
          `INSERT INTO payouts (id, reseller_id, amount, status, bank_name, account_number, account_name, created_at) 
           VALUES (?, ?, ?, 'pending', ?, ?, ?, datetime('now'))`
        ).bind(
          id, 
          reseller.id, 
          amount, 
          bankName, 
          accountNumber, 
          accountName
        ).run();
        
        await logEvent(env, "RESELLER_PAYOUT_REQUESTED", `Reseller reseller.idrequestedpayoutof₦{amount}`, user.id);
        
        return new Response(JSON.stringify({
          success: true,
          payoutId: id,
          message: "Payout request submitted. Admin will review within 48 hours."
        }), {
          status: 201,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
        
      } catch (e) {
        console.error('[Reseller Payout Request]', e);
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== CHARGES =====
    if (routePath === "/api/charges" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT * FROM charges ORDER BY createdAt DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== BAYS =====
    if (routePath === "/api/bays" && request.method === "GET") {
      try {
        const result = await env.DB.prepare('SELECT id, name, branch_id, cable_type, power_delivery, occupied, session_id, occupied_at, createdAt FROM bays ORDER BY createdAt DESC').all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath === "/api/bays" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { name, branch_id, cable_type, power_delivery } = body || {};
        if (!name) {
          return new Response(JSON.stringify({ error: "Name is required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO bays (id, name, branch_id, cable_type, power_delivery, occupied, createdAt) VALUES (?, ?, ?, ?, ?, 0, datetime('now'))"
        ).bind(id, name, branch_id || null, cable_type || 'USB-C', power_delivery || '65W').run();
        await logEvent(env, "BAY_CREATED", `Bay created: ${name}`, user.id);
        return new Response(JSON.stringify({ success: true, id, message: "Bay created successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/bays\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const body = await request.json();
        const result = await updateRecord(env, 'bays', id, body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }
    if (routePath.match(/^\/api\/bays\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const bay = await env.DB.prepare("SELECT occupied FROM bays WHERE id = ?").bind(id).first();
        if (bay?.occupied) {
          return new Response(JSON.stringify({ error: "Cannot delete occupied bay" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const result = await deleteRecord(env, 'bays', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // STAFF LOCATIONS
    // ======================================================================
    if (routePath === "/api/staff-locations" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT sl.*, s.name as staff_name 
          FROM staff_locations sl 
          LEFT JOIN staff s ON sl.staff_id = s.id 
          ORDER BY sl.timestamp DESC
        `).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        try {
          const result = await env.DB.prepare('SELECT * FROM staff_locations ORDER BY timestamp DESC').all();
          return new Response(JSON.stringify(result.results || []), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        } catch (e2) {
          return new Response(JSON.stringify({ error: e2.message, data: [] }), {
            status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
      }
    }

    // ======================================================================
    // STAFF CAPTURES
    // ======================================================================
    if (routePath === "/api/staff-captures" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT sc.*, s.name as staff_name 
          FROM staff_captures sc 
          LEFT JOIN staff s ON sc.staff_id = s.id 
          ORDER BY sc.timestamp DESC
        `).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        try {
          const result = await env.DB.prepare('SELECT * FROM staff_captures ORDER BY timestamp DESC').all();
          return new Response(JSON.stringify(result.results || []), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        } catch (e2) {
          return new Response(JSON.stringify({ error: e2.message, data: [] }), {
            status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
      }
    }

    // ======================================================================
    // STAFF LOGS
    // ======================================================================
    if (routePath === "/api/staff-logs" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(`
          SELECT sl.*, s.name as staff_name 
          FROM staff_logs sl 
          LEFT JOIN staff s ON sl.staff_id = s.id 
          ORDER BY sl.createdAt DESC
        `).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        try {
          const result = await env.DB.prepare('SELECT * FROM staff_logs ORDER BY createdAt DESC').all();
          return new Response(JSON.stringify(result.results || []), {
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        } catch (e2) {
          return new Response(JSON.stringify({ error: e2.message, data: [] }), {
            status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
      }
    }

    // ======================================================================
    // PUBLIC JOBS ENDPOINT - FOR CAREERS PAGE
    // ======================================================================
    if (routePath === "/api/jobs" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const search = url.searchParams.get('search') || '';
        const location = url.searchParams.get('location') || '';
        const employment_type = url.searchParams.get('employment_type') || '';
        const experience_level = url.searchParams.get('experience_level') || '';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = `
          SELECT j.*, COUNT(ja.id) as application_count
          FROM job_postings j
          LEFT JOIN job_applications ja ON j.id = ja.job_id
          WHERE j.is_active = 1 
          AND (j.application_deadline IS NULL OR j.application_deadline > datetime('now'))
        `;
        const params = [];

        if (search) {
          query += ` AND (j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ? OR j.description LIKE ?)`;
          const searchPattern = `%${search}%`;
          params.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }
        if (location) {
          query += ` AND j.location LIKE ?`;
          params.push(`%${location}%`);
        }
        if (employment_type) {
          query += ` AND j.employment_type = ?`;
          params.push(employment_type);
        }
        if (experience_level) {
          query += ` AND j.experience_level = ?`;
          params.push(experience_level);
        }

        query += ` GROUP BY j.id ORDER BY j.is_featured DESC, j.posted_date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();

        let countQuery = `
          SELECT COUNT(*) as total FROM job_postings j 
          WHERE j.is_active = 1 
          AND (j.application_deadline IS NULL OR j.application_deadline > datetime('now'))
        `;
        const countParams = [];
        if (search) {
          countQuery += ` AND (j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ? OR j.description LIKE ?)`;
          const searchPattern = `%${search}%`;
          countParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
        }
        if (location) {
          countQuery += ` AND j.location LIKE ?`;
          countParams.push(`%${location}%`);
        }
        if (employment_type) {
          countQuery += ` AND j.employment_type = ?`;
          countParams.push(employment_type);
        }
        if (experience_level) {
          countQuery += ` AND j.experience_level = ?`;
          countParams.push(experience_level);
        }
        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

        return new Response(JSON.stringify({
          success: true,
          jobs: result.results || [],
          pagination: {
            total: countResult?.total || 0,
            limit: limit,
            offset: offset,
            hasMore: (offset + limit) < (countResult?.total || 0)
          }
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Public jobs error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message,
          jobs: [],
          pagination: { total: 0, limit: 0, offset: 0, hasMore: false }
        }), {
          status: 500, 
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== PUBLIC JOB DETAILS =====
    if (routePath.match(/^\/api\/jobs\/[^\/]+$/) && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const id = url.pathname.split('/').pop();

        const result = await env.DB.prepare(`
          SELECT j.*, COUNT(ja.id) as application_count
          FROM job_postings j
          LEFT JOIN job_applications ja ON j.id = ja.job_id
          WHERE j.id = ? AND j.is_active = 1
          AND (j.application_deadline IS NULL OR j.application_deadline > datetime('now'))
          GROUP BY j.id
        `).bind(id).first();

        if (!result) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Job not found or no longer active" 
          }), {
            status: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        await env.DB.prepare(
          "UPDATE job_postings SET view_count = view_count + 1 WHERE id = ?"
        ).bind(id).run();

        return new Response(JSON.stringify({
          success: true,
          job: result
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Public job detail error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== PUBLIC JOB APPLICATION =====
    if (routePath === "/api/jobs/apply" && request.method === "POST") {
      try {
        const body = await request.json();
        const { 
          job_id, full_name, email, phone, current_company, current_title,
          years_experience, cover_letter, resume_url, portfolio_url,
          linkedin_url, github_url, referral_source
        } = body || {};

        if (!job_id || !full_name || !email) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Job ID, full name, and email are required" 
          }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        const job = await env.DB.prepare(`
          SELECT id, title FROM job_postings 
          WHERE id = ? AND is_active = 1
          AND (application_deadline IS NULL OR application_deadline > datetime('now'))
        `).bind(job_id).first();

        if (!job) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Job not found or no longer accepting applications" 
          }), {
            status: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        const existing = await env.DB.prepare(`
          SELECT id FROM job_applications 
          WHERE job_id = ? AND email = ?
        `).bind(job.id, email).first();

        if (existing) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "You have already applied for this position" 
          }), {
            status: 409,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        const id = crypto.randomUUID();
        const tracking_token = crypto.randomUUID().replace(/-/g, '').substring(0, 16).toUpperCase();
        const ip_address = request.headers.get("CF-Connecting-IP") || "unknown";
        const user_agent = request.headers.get("user-agent") || "";

        await env.DB.prepare(`
          INSERT INTO job_applications (
            id, job_id, tracking_token, full_name, email, phone,
            current_company, current_title, years_experience,
            cover_letter, resume_url, portfolio_url, linkedin_url,
            github_url, status, applied_at, ip_address, user_agent,
            referral_source
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'), ?, ?, ?)
        `).bind(
          id, job.id, tracking_token, full_name, email, phone || '',
          current_company || '', current_title || '', years_experience || null,
          cover_letter || '', resume_url || '', portfolio_url || '',
          linkedin_url || '', github_url || '',
          ip_address, user_agent, referral_source || ''
        ).run();

        try {
          await sendEmail(
            email,
            `Application Received: ${job.title} — PrimeShieldHub`,
            `
            <!DOCTYPE html>
            <html>
            <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #060608; padding: 40px 20px; margin: 0;">
              <div style="max-width: 600px; margin: 0 auto; background: linear-gradient(135deg, #0f0f13, #1a1a1f); border-radius: 20px; padding: 40px 32px; border: 1px solid rgba(214, 178, 94, 0.3); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                
                <!-- Header with Gold Accent -->
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="width: 60px; height: 60px; background: linear-gradient(135deg, #b8943c, #d6b25e, #f3dba0); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; font-weight: 900; color: #060608; margin-bottom: 12px;">
                    P
                  </div>
                  <h1 style="color: #f3dba0; font-size: 22px; font-weight: 800; margin: 0; letter-spacing: 2px;">
                    PRIME<span style="color: #d6b25e;">SHIELD</span>HUB
                  </h1>
                  <div style="width: 80px; height: 2px; background: linear-gradient(90deg, transparent, #d6b25e, transparent); margin: 12px auto;"></div>
                </div>

                <!-- Success Badge -->
                <div style="text-align: center; margin-bottom: 28px;">
                  <span style="display: inline-block; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10b981; padding: 8px 20px; border-radius: 50px; font-weight: 600; font-size: 13px;">
                    ✅ APPLICATION RECEIVED
                  </span>
                </div>

                <!-- Main Content -->
                <p style="color: #e8edff; font-size: 15px; margin-bottom: 12px;">Dear <strong style="color: #f3dba0;">${full_name}</strong>,</p>
                <p style="color: #b8b6ad; font-size: 14px; line-height: 1.7; margin-bottom: 16px;">
                  Thank you for applying for the position of
                </p>
                <div style="background: rgba(214, 178, 94, 0.08); border-left: 3px solid #d6b25e; padding: 16px 20px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
                  <p style="color: #f3dba0; font-size: 18px; font-weight: 700; margin: 0;">
                    ${job.title}
                  </p>
                </div>
                <p style="color: #b8b6ad; font-size: 14px; line-height: 1.7; margin-bottom: 20px;">
                  Your application has been received and is being reviewed by our team. We carefully evaluate every candidate and will reach out if your profile matches our requirements.
                </p>

                <!-- Tracking Code Box -->
                <div style="background: rgba(6, 6, 8, 0.6); border: 1px solid rgba(214, 178, 94, 0.3); border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
                  <p style="color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px;">
                    Your Tracking Code
                  </p>
                  <p style="color: #d6b25e; font-size: 20px; font-weight: 800; font-family: 'Courier New', monospace; letter-spacing: 3px; margin: 0 0 12px;">
                    ${tracking_token}
                  </p>
                  <a href="https://primeshieldhub.com/careers/apply/status/track.html?token=${tracking_token}" 
                     style="display: inline-block; background: linear-gradient(135deg, #b8943c, #d6b25e); color: #060608; padding: 12px 28px; border-radius: 50px; text-decoration: none; font-weight: 700; font-size: 14px;">
                    📋 Track Your Application
                  </a>
                </div>

                <!-- Divider -->
                <hr style="border: none; height: 1px; background: linear-gradient(90deg, transparent, rgba(214,178,94,0.4), transparent); margin: 24px 0;">

                <!-- Footer -->
                <div style="text-align: center;">
                  <p style="color: #666; font-size: 12px; margin: 0 0 8px;">
                    PrimeShieldHub · Nigeria's Leading Tech Hub
                  </p>
                  <p style="color: #555; font-size: 11px; margin: 0;">
                    📍 108 Ekhorutomwen Street, Uselu, Benin City, Edo State
                  </p>
                  <p style="color: #555; font-size: 11px; margin: 4px 0;">
                    📧 primeshieldhub@gmail.com · 📱 +234 810 353 5978
                  </p>
                </div>

              </div>
            </body>
            </html>
            `,
            env
          );
        } catch (e) {
          console.log('Application confirmation email failed:', e.message);
        }

        return new Response(JSON.stringify({
          success: true,
          id: id,
          tracking_token: tracking_token,
          message: "Application submitted successfully! Check your email for confirmation."
        }), {
          status: 201,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Public application error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: error.message 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== TRACK APPLICATION STATUS =====
    if (routePath.match(/^\/api\/jobs\/apply\/[A-Z0-9]+$/) && request.method === "GET") {
      const token = routePath.split('/').pop();
      
      try {
        const application = await env.DB.prepare(`
          SELECT 
            ja.tracking_token, ja.status, ja.full_name, ja.email,
            ja.applied_at, ja.updated_at,
            jp.title as job_title, jp.department, jp.location
          FROM job_applications ja
          LEFT JOIN job_postings jp ON ja.job_id = jp.id
          WHERE ja.tracking_token = ?
        `).bind(token).first();
        
        if (!application) {
          return new Response(JSON.stringify({
            success: false,
            error: "Application not found. Please check your tracking code."
          }), {
            status: 404,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        
        return new Response(JSON.stringify({
          success: true,
          application: {
            tracking_token: application.tracking_token,
            status: application.status,
            full_name: application.full_name,
            job_title: application.job_title || 'Position',
            department: application.department || 'General',
            location: application.location || 'N/A',
            applied_at: application.applied_at,
            updated_at: application.updated_at
          }
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (error) {
        console.error('Application tracking error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // JOB PORTAL ADMIN ENDPOINTS
    // ======================================================================

    if (routePath === "/api/admin/jobs" && request.method === "GET") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized - Admin access required", 401, corsHeaders, routePath);

      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const status = url.searchParams.get('status') || '';
        const search = url.searchParams.get('search') || '';

        let query = `
          SELECT j.*, COUNT(ja.id) as application_count
          FROM job_postings j
          LEFT JOIN job_applications ja ON j.id = ja.job_id
          WHERE 1=1
        `;
        const params = [];

        if (status) {
          query += ` AND j.is_active = ?`;
          params.push(status === 'active' ? 1 : 0);
        }

        if (search) {
          query += ` AND (j.title LIKE ? OR j.department LIKE ? OR j.location LIKE ?)`;
          const searchPattern = `%${search}%`;
          params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ` GROUP BY j.id ORDER BY j.posted_date DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();

        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Admin jobs error:', error);
        return new Response(JSON.stringify([]), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath === "/api/admin/jobs/stats" && request.method === "GET") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized - Admin access required", 401, corsHeaders, routePath);

      try {
        const totalJobs = await env.DB.prepare("SELECT COUNT(*) as count FROM job_postings").first();
        const openJobs = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM job_postings 
          WHERE is_active = 1 AND (application_deadline IS NULL OR application_deadline > datetime('now'))
        `).first();
        const totalApplications = await env.DB.prepare("SELECT COUNT(*) as count FROM job_applications").first();
        
        return new Response(JSON.stringify({
          totalJobs: totalJobs?.count || 0,
          openJobs: openJobs?.count || 0,
          totalApplications: totalApplications?.count || 0,
          newApplications: 0
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Job stats error:', error);
        return new Response(JSON.stringify({
          totalJobs: 0,
          openJobs: 0,
          totalApplications: 0,
          newApplications: 0
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath === "/api/admin/applications" && request.method === "GET") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized - Admin access required", 401, corsHeaders, routePath);

      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const status = url.searchParams.get('status') || '';
        const search = url.searchParams.get('search') || '';
        const jobId = url.searchParams.get('jobId') || '';

        let query = `
          SELECT ja.*, j.title as job_title, j.department
          FROM job_applications ja
          LEFT JOIN job_postings j ON ja.job_id = j.id
          WHERE 1=1
        `;
        const params = [];

        if (status) {
          query += ` AND ja.status = ?`;
          params.push(status);
        }
        if (search) {
          query += ` AND (ja.full_name LIKE ? OR ja.email LIKE ? OR ja.phone LIKE ?)`;
          const searchPattern = `%${search}%`;
          params.push(searchPattern, searchPattern, searchPattern);
        }
        if (jobId) {
          query += ` AND ja.job_id = ?`;
          params.push(jobId);
        }
        query += ` ORDER BY ja.applied_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();

        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Applications error:', error);
        return new Response(JSON.stringify([]), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath === "/api/admin/jobs" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized - Admin access required", 401, corsHeaders, routePath);

      try {
        const body = await request.json();
        const { title, department, location, employment_type, experience_level, salary_range, description, requirements, benefits, application_deadline, is_active, is_featured } = body || {};

        if (!title || !description || !department) {
          return new Response(JSON.stringify({ error: "Title, department, and description are required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        const id = crypto.randomUUID();
        const jobId = `JOB-Date.now().toString(36).toUpperCase()-{Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        await env.DB.prepare(`
          INSERT INTO job_postings (
            id, job_id, title, department, location, employment_type, experience_level,
            salary_range, description, requirements, benefits,
            application_deadline, is_active, is_featured, posted_date, createdAt, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
        `).bind(
          id, jobId, title, department || '', location || '', employment_type || 'full-time',
          experience_level || '', salary_range || '', description,
          requirements || '', benefits || '',
          application_deadline || null,
          is_active !== undefined ? is_active : 1,
          is_featured || 0
        ).run();

        await logEvent(env, "JOB_CREATED", `Job posting created: ${title}`, user.id);

        return new Response(JSON.stringify({ success: true, id, jobId, message: "Job posting created successfully" }), {
          status: 201,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Create job error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath.match(/^\/api\/admin\/jobs\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized - Admin access required", 401, corsHeaders, routePath);

      try {
        const url = new URL(request.url);
        const jobId = url.pathname.split('/')[4];
        const body = await request.json();

        const fields = [];
        const values = [];
        const allowedFields = ['title', 'department', 'location', 'employment_type', 'experience_level', 'salary_range', 'description', 'requirements', 'benefits', 'application_deadline', 'is_active', 'is_featured'];

        for (const field of allowedFields) {
          if (body[field] !== undefined) {
            fields.push(`${field} = ?`);
            values.push(body[field]);
          }
        }

        if (fields.length === 0) {
          return new Response(JSON.stringify({ error: "No fields to update" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        values.push(jobId);
        await env.DB.prepare(
          `UPDATE job_postings SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ? OR job_id = ?`
        ).bind(...values).run();

        await logEvent(env, "JOB_UPDATED", `Job posting updated: ${jobId}`, user.id);

        return new Response(JSON.stringify({ success: true, message: "Job posting updated successfully" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Update job error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath.match(/^\/api\/admin\/jobs\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized - Admin access required", 401, corsHeaders, routePath);

      try {
        const url = new URL(request.url);
        const jobId = url.pathname.split('/')[4];

        const job = await env.DB.prepare(
          "SELECT title FROM job_postings WHERE id = ? OR job_id = ?"
        ).bind(jobId, jobId).first();

        if (!job) {
          return errorResponse("Job not found", 404, corsHeaders, routePath);
        }

        await env.DB.prepare(
          "UPDATE job_postings SET is_active = 0, updated_at = datetime('now') WHERE id = ? OR job_id = ?"
        ).bind(jobId, jobId).run();

        await logEvent(env, "JOB_DELETED", `Job posting deleted: ${job.title}`, user.id);

        return new Response(JSON.stringify({ success: true, message: "Job posting deleted successfully" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Delete job error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath.match(/^\/api\/admin\/applications\/[^\/]+\/status$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized - Admin access required", 401, corsHeaders, routePath);

      try {
        const url = new URL(request.url);
        const applicationId = url.pathname.split('/')[4];
        const body = await request.json();
        const { status, note } = body || {};

        if (!status) {
          return new Response(JSON.stringify({ error: "Status is required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        const validStatuses = ['submitted', 'under_review', 'shortlisted', 'interview_scheduled', 'offered', 'hired', 'rejected'];
        if (!validStatuses.includes(status)) {
          return new Response(JSON.stringify({ error: "Invalid status" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }

        await env.DB.prepare(
          "UPDATE job_applications SET status = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(status, applicationId).run();

        await logEvent(env, "APPLICATION_STATUS_UPDATED", `Application ${applicationId} status updated to ${status}`, user.id);

        return new Response(JSON.stringify({ success: true, message: "Application status updated successfully" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        console.error('Update application status error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // USERS CRUD
    // ======================================================================
    if (routePath === "/api/users" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';
        const role = url.searchParams.get('role') || '';
        const offset = (page - 1) * limit;

        let query = "SELECT id, email, name, phone, role, status, created_at as createdAt FROM users WHERE 1=1";
        const params = [];

        if (search) {
          query += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
          const searchPattern = '%' + search + '%';
          params.push(searchPattern, searchPattern, searchPattern);
        }
        if (status) {
          query += " AND status = ?";
          params.push(status);
        }
        if (role) {
          query += " AND role = ?";
          params.push(role);
        }

        query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();
        
        let countQuery = "SELECT COUNT(*) as total FROM users WHERE 1=1";
        const countParams = [];
        if (search) {
          countQuery += " AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)";
          const searchPattern = '%' + search + '%';
          countParams.push(searchPattern, searchPattern, searchPattern);
        }
        if (status) {
          countQuery += " AND status = ?";
          countParams.push(status);
        }
        if (role) {
          countQuery += " AND role = ?";
          countParams.push(role);
        }
        const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();

        return new Response(JSON.stringify({
          items: result.results || [],
          total: countResult?.total || 0,
          page,
          limit
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, items: [], total: 0 }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath === "/api/users" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { name, email, phone, password, role } = body || {};
        if (!name || !email || !password) {
          return new Response(JSON.stringify({ error: "Name, email, and password are required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
        if (existing) {
          return new Response(JSON.stringify({ error: "Email already exists" }), {
            status: 409, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const id = crypto.randomUUID();
        const hashResult = await hashPassword(password);
        await env.DB.prepare(
          "INSERT INTO users (id, email, name, phone, password_hash, password_salt, role, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))"
        ).bind(id, email, name, phone || '', hashResult.hash, hashResult.salt, role || 'user').run();
        await logEvent(env, "USER_CREATED", `User created: ${email}`, user.id);
        return new Response(JSON.stringify({ success: true, id, message: "User created successfully" }), {
          status: 201, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath.match(/^\/api\/users\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const body = await request.json();
        const result = await updateRecord(env, 'users', id, body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath.match(/^\/api\/users\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        if (id === user.id) {
          return new Response(JSON.stringify({ error: "Cannot delete your own account" }), {
            status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const result = await deleteRecord(env, 'users', id);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    if (routePath.match(/^\/api\/users\/[^\/]+$/) && request.method === "GET") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const result = await env.DB.prepare(
          "SELECT id, email, name, phone, role, status, created_at as createdAt, referral_code, total_referrals, points FROM users WHERE id = ?"
        ).bind(id).first();
        if (!result) return errorResponse("User not found", 404, corsHeaders, routePath);
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // STAFF GET (with pagination)
    // ======================================================================
    if (routePath === "/api/staff" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const search = url.searchParams.get('search') || '';
        const status = url.searchParams.get('status') || '';
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = `
          SELECT s.*, u.email, u.status as user_status, u.created_at as user_createdAt,
                 b.name as branch_name, b.city as branch_city
          FROM staff s
          LEFT JOIN users u ON s.id = u.id
          LEFT JOIN branches b ON s.branch_id = b.id
          WHERE 1=1
        `;
        const params = [];

        if (search) {
          query += " AND (s.name LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)";
          const searchPattern = '%' + search + '%';
          params.push(searchPattern, searchPattern, searchPattern);
        }
        if (status) {
          query += " AND s.status = ?";
          params.push(status);
        }

        query += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?";
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // PRODUCTS GET with store_type filtering
    // ======================================================================
    if (routePath === "/api/products" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const storeType = url.searchParams.get('store') || 'gadgets';
        const category = url.searchParams.get('category') || '';
        const search = url.searchParams.get('search') || '';
        const limit = parseInt(url.searchParams.get('limit')) || 2000;
        const offset = parseInt(url.searchParams.get('offset')) || 0;

        let query = `
          SELECT * FROM products 
          WHERE (store_type = ? OR store_type = 'both')
        `;
        const params = [storeType];

        if (category) {
          query += ` AND category = ?`;
          params.push(category);
        }

        if (search) {
          query += ` AND (name LIKE ? OR brand LIKE ? OR description LIKE ?)`;
          const searchPattern = `%${search}%`;
          params.push(searchPattern, searchPattern, searchPattern);
        }

        query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();

        let countQuery = `
          SELECT COUNT(*) as total FROM products 
          WHERE (store_type = ? OR store_type = 'both')
        `;
        const countParams = [storeType];

        if (category) {
          countQuery += ` AND category = ?`;
          countParams.push(category);
        }

        if (search) {
          countQuery += ` AND (name LIKE ? OR brand LIKE ? OR description LIKE ?)`;
          const searchPattern = `%${search}%`;
          countParams.push(searchPattern, searchPattern, searchPattern);
        }

        const total = await env.DB.prepare(countQuery).bind(...countParams).first();

        return new Response(JSON.stringify({
          success: true,
          products: result.results || [],
          total: total?.total || 0,
          limit,
          offset,
          store_type: storeType
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // BUILD MART ENDPOINTS
    // ======================================================================

    if (routePath === "/api/buildmart/dashboard" && request.method === "GET") {
      return await handleBuildMartDashboard(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/categories" && request.method === "GET") {
      return await handleBuildMartCategories(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/products" && request.method === "GET") {
      return await handleBuildMartProducts(request, env, ctx, corsHeaders);
    }

    if (routePath.match(/^\/api\/buildmart\/products\/[^\/]+$/) && request.method === "GET") {
      return await handleBuildMartProductDetail(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/featured" && request.method === "GET") {
      return await handleBuildMartFeaturedProducts(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/compare" && request.method === "POST") {
      return await handleBuildMartCompareProducts(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/brands" && request.method === "GET") {
      return await handleBuildMartBrands(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/quotes" && request.method === "POST") {
      return await handleBuildMartCreateQuote(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/quotes/calculate" && request.method === "POST") {
      return await handleBuildMartCalculateQuote(request, env, ctx, corsHeaders);
    }

    if (routePath.match(/^\/api\/buildmart\/quotes\/[^\/]+$/) && request.method === "GET") {
      return await handleBuildMartGetQuote(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/contractors" && request.method === "POST") {
      return await handleBuildMartRegisterContractor(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/contractors" && request.method === "GET") {
      return await handleBuildMartGetContractors(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/delivery/regions" && request.method === "GET") {
      return await handleBuildMartDeliveryRegions(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/delivery/calculate" && request.method === "POST") {
      return await handleBuildMartCalculateDelivery(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/bulk-order" && request.method === "POST") {
      return await handleBuildMartBulkOrder(request, env, ctx, corsHeaders);
    }

    if (routePath === "/api/buildmart/checkout" && request.method === "POST") {
      return await handleBuildMartCheckout(request, env, ctx, corsHeaders);
    }

    // ======================================================================
    // SINGLE PRODUCT GET
    // ======================================================================
    if (routePath.match(/^\/api\/products\/[^\/]+$/) && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const id = url.pathname.split('/').pop();

        const result = await env.DB.prepare(
          "SELECT id, name, price, stock, category, description, image_url, active, wholesale_price, wholesale_available, brand, store_type FROM products WHERE id = ? AND (active = 1 OR active IS NULL)"
        ).bind(id).first();

        if (!result) {
          return errorResponse("Product not found", 404, corsHeaders, routePath);
        }

        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // ORDERS GET
    // ======================================================================
    if (routePath === "/api/orders" && request.method === "GET") {
      try {
        const url = new URL(request.url);
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        const status = url.searchParams.get('status') || '';
        let query = "SELECT * FROM orders ORDER BY createdAt DESC LIMIT ? OFFSET ?";
        let params = [limit, offset];
        if (status) {
          query = "SELECT * FROM orders WHERE status = ? OR trackingStatus = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?";
          params = [status, status, limit, offset];
        }
        const result = await env.DB.prepare(query).bind(...params).all();
        return new Response(JSON.stringify(result.results || []), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message, data: [] }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== ORDER - GET Single =====
    if (routePath.match(/^\/api\/orders\/[^\/]+$/) && request.method === "GET") {
      const user = await requireAuth(request, env, ["admin", "staff"]);
      if (!user) {
        return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      }
      try {
        const id = routePath.split('/').pop();
        const result = await env.DB.prepare(
          "SELECT * FROM orders WHERE id = ? OR reference = ? OR trackingId = ?"
        ).bind(id, id, id).first();
        if (!result) {
          return errorResponse("Order not found", 404, corsHeaders, routePath);
        }
        return new Response(JSON.stringify(result), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== ORDER - Update Tracking =====
    if (routePath === "/api/orders/update-status" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) {
        return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      }
      try {
        const body = await request.json();
        const { orderId, status, location, note } = body || {};
        if (!orderId || !status) {
          return new Response(JSON.stringify({ error: "Order ID and status required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        
        const order = await env.DB.prepare(
          "SELECT trackingHistory FROM orders WHERE id = ? OR reference = ? OR trackingId = ?"
        ).bind(orderId, orderId, orderId).first();
        
        let history = [];
        try { history = JSON.parse(order?.trackingHistory || '[]'); } catch(e) {}
        
        history.push({
          status: status,
          location: location || 'PrimeShieldHub HQ, Benin City',
          timestamp: new Date().toISOString(),
          note: note || '',
          updatedBy: user.id
        });
        
        await env.DB.prepare(
          "UPDATE orders SET trackingStatus = ?, trackingHistory = ?, status = ?, updated_at = datetime('now') WHERE id = ? OR reference = ? OR trackingId = ?"
        ).bind(status, JSON.stringify(history), status === 'delivered' ? 'completed' : 'processing', orderId, orderId, orderId).run();
        
        await logEvent(env, "ORDER_STATUS_UPDATED", `Order ${orderId} status updated to ${status}`, user.id);
        
        return new Response(JSON.stringify({ 
          success: true, 
          message: "Order status updated",
          newStatus: status 
        }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // ORDERS ROUTES - WITH DISCOUNT VALIDATION INTEGRATION
    // ======================================================================

    // POST /api/orders - Create new order with discount validation
    if (routePath === "/api/orders" && request.method === "POST") {
      try {
        const body = await request.json();
        const {
          items, total, subtotal, shipping_cost, vat, fee, amount,
          customerName, customerEmail, customerPhone,
          deliveryAddress, city, state, paymentMethod, reference, note,
          user_id, discountCode,
          resellerCode, expressDelivery, beninPickup, shipping_zone, estimated_days,
          shipping_label, wholesaleSavings, wholesaleTier
        } = body || {};
      
        if (!items || !Array.isArray(items) || items.length === 0) {
          return new Response(JSON.stringify({
            success: false,
            error: "Order must contain at least one item"
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        const orderAmount = amount || subtotal || total || 0;
        if (!orderAmount || orderAmount <= 0) {
          return new Response(JSON.stringify({
            success: false,
            error: "Invalid order amount"
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        // ===== DISCOUNT VALIDATION =====
        let discountResult = null;
        let discountApplied = 0;
        let discountLabel = '';
        let finalSubtotal = subtotal || 0;
        let finalShipping = shipping_cost || 0;
        
        // Apply automatic rules first
        const autoRules = await applyAutomaticRules(env, finalSubtotal, customerEmail, user_id);
        finalShipping = autoRules.shipping;
        discountApplied = autoRules.discount;
        discountLabel = autoRules.discountLabel;
        
        // Validate discount code if provided
        if (discountCode) {
          const user = await requireAuth(request, env, ["user", "admin"]);
          const userId = user?.id || user_id || 'anonymous';
          const email = user?.email || customerEmail || '';
          
          const validation = await validateDiscount(env, userId, email, discountCode, finalSubtotal);
          
          if (validation.valid) {
            const disc = validation.discount;
            if (disc.type === 'percentage') {
              discountApplied += Math.round(finalSubtotal * (disc.value / 100));
            } else {
              discountApplied += disc.value;
            }
            discountLabel = disc.label || disc.code;
            discountResult = validation.discount;
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: validation.error,
              code: discountCode
            }), {
              status: 400,
              headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
                ...corsHeaders
              }
            });
          }
        }
      

        // ===== RESELLER CODE VERIFICATION & CREDITING =====
        let resellerId = null;
        let resellerCommission = 0;
        
        if (resellerCode) {
          const resellerRow = await env.DB.prepare(
            "SELECT rc.code, rc.discount, r.id as reseller_id FROM reseller_codes rc JOIN resellers r ON r.rank = rc.tier WHERE rc.code = ? AND rc.active = 1 LIMIT 1"
          ).bind(resellerCode.toUpperCase()).first();
          
          if (resellerRow && resellerRow.reseller_id) {
            resellerId = resellerRow.reseller_id;
            resellerCommission = Math.round(finalTotal * 0.10);
            
            try {
              await env.DB.prepare(
                "UPDATE resellers SET total_earnings = COALESCE(total_earnings, 0) + ?, total_referrals = COALESCE(total_referrals, 0) + 1 WHERE id = ?"
              ).bind(resellerCommission, resellerId).run();
              // Check if this triggers a tier upgrade
              await checkAndUpgradeResellerTier(env, resellerId);
              console.log(`[Reseller Credit] Reseller ${resellerId} credited ${resellerCommission}`);
            } catch (creditErr) {
              console.error('[Reseller Credit] Failed:', creditErr);
            }
          }
        }

        const id = crypto.randomUUID();
        const trackingId = `PSH-newDate().toISOString().slice(0,10).replace(/-/g,'')-{Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const orderReference = reference || `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        const now = Date.now();
      
        let orderStatus = 'pending';
        if (paymentMethod === 'paystack' || paymentMethod === 'card') {
          orderStatus = 'pending_payment';
        } else if (paymentMethod === 'bank_transfer' || paymentMethod === 'bank') {
          orderStatus = 'pending_confirmation';
        } else if (paymentMethod === 'whatsapp') {
          orderStatus = 'pending_whatsapp';
        } else if (paymentMethod === 'pod') {
          orderStatus = 'pending_pod';
        }
      
        const orderSubtotal = subtotal || 0;
        const finalTotal = orderSubtotal - discountApplied + finalShipping + (vat || 0) + (fee || 0);
      
        // Insert order into database
        await env.DB.prepare(`
          INSERT INTO orders (
            id, user_id, reference, trackingId, trackingStatus, trackingHistory,
            customerName, customerEmail, customerPhone, deliveryAddress, city, state,
            items, amount, total, subtotal, shipping_cost, vat, fee,
            paymentMethod, status, createdAt, updated_at, paid_at,
            created_at, shippingAddress, estimatedDelivery,
            discount_code, discount_amount, discount_label,
            express_delivery, benin_pickup, shipping_zone, estimated_days,
            shipping_label, wholesale_savings, wholesale_tier,
            admin_notes, tracking_number, reseller_id
          ) VALUES (${'?, '.repeat(40).slice(0, -2)})
        `).bind(
          id, user_id || null, orderReference, trackingId, 'pending',
          JSON.stringify([{ status: 'order_created', timestamp: now, message: 'Order created successfully' }]),
          customerName || 'Guest', customerEmail || '', customerPhone || '',
          deliveryAddress || '', city || '', state || '',
          JSON.stringify(items), finalTotal, finalTotal, orderSubtotal, finalShipping,
          vat || 0, fee || 0, paymentMethod || 'unknown', orderStatus,
          now, now, null, now,
          JSON.stringify({ address: deliveryAddress || '', city: city || '', state: state || '', customerName: customerName || '' }),
          estimated_days || '3-5 business days',
          discountResult?.code || null, discountApplied || 0, discountLabel || null,
          expressDelivery ? 1 : 0, beninPickup ? 1 : 0,
          shipping_zone || null, estimated_days || null, shipping_label || null,
          wholesaleSavings || 0, wholesaleTier || null,
          null, null, resellerId
        ).run();

        // Record discount usage if applied
        if (discountResult && user_id) {
          await recordDiscountUsage(env, user_id, discountResult.code, id);
        }
      
        // Send email confirmation (optional)
        if (customerEmail) {
          try {
            // Email sending logic here
          } catch (e) {
            console.log('Order confirmation email failed:', e.message);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          orderId: id,
          reference: orderReference,
          trackingId: trackingId,
          status: orderStatus,
          discount_applied: discountApplied,
          discount_label: discountLabel,
          total: finalTotal,
          message: "Order created successfully"
        }), {
          status: 201,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      
      } catch (error) {
        console.error('Order creation error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Failed to create order'
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      }
    }

    // ===== PROFILE ROUTES =====
    if (routePath === "/api/profile" && request.method === "GET") {
      return await handleGetProfile(request, env, corsHeaders, requestInfo);
    }

    if (routePath === "/api/profile" && request.method === "PUT") {
      return await handleUpdateProfile(request, env, corsHeaders);
    }

    if (routePath === "/api/profile" && request.method === "DELETE") {
      return await handleDeleteProfile(request, env, corsHeaders);
    }

    // ===== SUBSCRIPTION ROUTES =====
    if (routePath === "/api/subscription" && request.method === "GET") {
      return await handleGetSubscription(request, env, corsHeaders);
    }

    if (routePath === "/api/subscription" && request.method === "PUT") {
      return await handleUpdateSubscription(request, env, corsHeaders);
    }

    // ===== INTEGRATIONS ROUTES =====
    if (routePath === "/api/integrations" && request.method === "GET") {
      return await handleGetIntegrations(request, env, corsHeaders);
    }

    if (routePath === "/api/integrations" && request.method === "PUT") {
      return await handleUpdateIntegration(request, env, corsHeaders);
    }

    // ===== PREFERENCES ROUTE =====
    if (routePath === "/api/preferences" && request.method === "POST") {
      return await handleSavePreferences(request, env, corsHeaders);
    }

    // ===== AVATAR ROUTES =====
    if (routePath === "/api/profile/avatar" && request.method === "POST") {
      return await handleUploadAvatar(request, env, corsHeaders);
    }

    if (routePath === "/api/profile/avatar" && request.method === "DELETE") {
      return await handleRemoveAvatar(request, env, corsHeaders);
    }

    // ===== REFERRAL ROUTES =====
    // Note: You already have /api/referrals GET, just need the claim route
    if (routePath === "/api/referrals/claim" && request.method === "POST") {
      return await handleClaimReferralReward(request, env, corsHeaders);
    }

    // ===== EXPORT ROUTE =====
    if (routePath === "/api/export" && request.method === "GET") {
      return await handleExportData(request, env, corsHeaders);
    }


    // ===== 10. ORDERS (already exists, but verify) =====
    // You already have /api/orders GET and POST

    // ===== 11. AUTH ROUTES (check if they exist) =====
    if (routePath === "/api/auth/me" && request.method === "GET") {
      const user = await requireAuth(request, env, null);
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      }
      return new Response(JSON.stringify(user), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (routePath === "/api/auth/change-password" && request.method === "POST") {
      return await handleChangePassword(request, env, corsHeaders);
    }

    if (routePath === "/api/auth/logout" && request.method === "POST") {
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // ======================================================================
    // CART ROUTES - FIXED FOR YOUR DATABASE STRUCTURE
    // ======================================================================

    // GET /api/cart - Get user's cart
    if (routePath === "/api/cart" && request.method === "GET") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        const userId = user?.id || null;
      
        if (!userId) {
          return new Response(JSON.stringify({
            success: true,
            items: [],
            total: 0,
            count: 0
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        // Get all cart items for this user from the `cart` table
        const cartItems = await env.DB.prepare(
          "SELECT id, product_id, quantity, variant, notes, created_at, updated_at FROM cart WHERE user_id = ? AND active = 1"
        ).bind(userId).all();
      
        const items = [];
        let total = 0;
        let count = 0;
      
        for (const item of (cartItems.results || [])) {
          // Get product details
          const product = await env.DB.prepare(
            "SELECT id, name, price, image_url, stock FROM products WHERE id = ? AND active = 1"
          ).bind(item.product_id).first();
        
          if (product) {
            items.push({
              id: item.id,
              productId: item.product_id,
              product: product,
              quantity: item.quantity || 1,
              variant: item.variant,
              notes: item.notes,
              added_at: item.created_at
            });
            total += (product.price || 0) * (item.quantity || 1);
            count += item.quantity || 1;
          }
        }
      
        return new Response(JSON.stringify({
          success: true,
          items: items,
          total: total,
          count: count
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      
      } catch (error) {
        console.error('[Cart] GET error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          items: [],
          total: 0,
          count: 0
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      }
    }

    // POST /api/cart - Add item to cart
    if (routePath === "/api/cart" && request.method === "POST") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        const userId = user?.id || null;
        const body = await request.json();
        const { productId, quantity = 1, variant, notes } = body || {};
      
        if (!productId) {
          return new Response(JSON.stringify({
            success: false,
            error: "Product ID is required"
          }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        // For guest users, just return success (cart is stored locally)
        if (!userId) {
          return new Response(JSON.stringify({
            success: true,
            message: "Item added to cart (guest)"
          }), {
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        // Check if product already exists in cart
        const existing = await env.DB.prepare(
          "SELECT id, quantity FROM cart WHERE user_id = ? AND product_id = ? AND active = 1"
        ).bind(userId, productId).first();
      
        const now = Math.floor(Date.now() / 1000);
      
        if (existing) {
          // Update existing cart item
          const newQuantity = (existing.quantity || 0) + quantity;
          await env.DB.prepare(
            "UPDATE cart SET quantity = ?, updated_at = ? WHERE id = ?"
          ).bind(newQuantity, now, existing.id).run();
        } else {
          // Insert new cart item
          const id = crypto.randomUUID();
          await env.DB.prepare(
            "INSERT INTO cart (id, user_id, product_id, quantity, variant, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
          ).bind(id, userId, productId, quantity, variant || null, notes || null, now, now).run();
        }
      
        // Get updated cart count
        const countResult = await env.DB.prepare(
          "SELECT SUM(quantity) as total FROM cart WHERE user_id = ? AND active = 1"
        ).bind(userId).first();
      
        // Get all cart items to return
        const cartItems = await env.DB.prepare(
          "SELECT id, product_id, quantity, variant, notes FROM cart WHERE user_id = ? AND active = 1"
        ).bind(userId).all();
      
        const items = [];
        let totalPrice = 0;
        let itemCount = 0;
      
        for (const item of (cartItems.results || [])) {
          const product = await env.DB.prepare(
            "SELECT id, name, price, image_url FROM products WHERE id = ? AND active = 1"
          ).bind(item.product_id).first();
        
          if (product) {
            items.push({
              id: item.id,
              productId: item.product_id,
              product: product,
              quantity: item.quantity || 1,
              variant: item.variant,
              notes: item.notes
            });
            totalPrice += (product.price || 0) * (item.quantity || 1);
            itemCount += item.quantity || 1;
          }
        }
      
        return new Response(JSON.stringify({
          success: true,
          message: "Item added to cart",
          items: items,
          total: totalPrice,
          count: itemCount
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      
      } catch (error) {
        console.error('[Cart] POST error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      }
    }

    // PUT /api/cart/:itemId - Update cart item quantity
    if (routePath.match(/^\/api\/cart\/[^\/]+$/) && request.method === "PUT") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: "Authentication required"
          }), {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        const itemId = routePath.split('/').pop();
        const body = await request.json();
        const { quantity } = body || {};
      
        if (quantity === undefined || quantity < 0) {
          return new Response(JSON.stringify({
            success: false,
            error: "Valid quantity is required"
          }), {
            status: 400,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        if (quantity === 0) {
          // Delete the item
          await env.DB.prepare(
            "DELETE FROM cart WHERE id = ? AND user_id = ?"
          ).bind(itemId, user.id).run();
        } else {
          // Update quantity
          const now = Math.floor(Date.now() / 1000);
          await env.DB.prepare(
            "UPDATE cart SET quantity = ?, updated_at = ? WHERE id = ? AND user_id = ?"
          ).bind(quantity, now, itemId, user.id).run();
        }
      
        // Get updated cart
        const cartItems = await env.DB.prepare(
          "SELECT id, product_id, quantity FROM cart WHERE user_id = ? AND active = 1"
        ).bind(user.id).all();
      
        let total = 0;
        let count = 0;
        for (const item of (cartItems.results || [])) {
          total += item.quantity || 0;
          count += item.quantity || 0;
        }
      
        return new Response(JSON.stringify({
          success: true,
          message: "Cart updated",
          total: total,
          count: count
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      
      } catch (error) {
        console.error('[Cart] PUT error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      }
    }

    // DELETE /api/cart/:itemId - Remove item from cart
    if (routePath.match(/^\/api\/cart\/[^\/]+$/) && request.method === "DELETE") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: "Authentication required"
          }), {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        const itemId = routePath.split('/').pop();
      
        await env.DB.prepare(
          "DELETE FROM cart WHERE id = ? AND user_id = ?"
        ).bind(itemId, user.id).run();
      
        // Get updated cart
        const cartItems = await env.DB.prepare(
          "SELECT id, product_id, quantity FROM cart WHERE user_id = ? AND active = 1"
        ).bind(user.id).all();
      
        let total = 0;
        let count = 0;
        for (const item of (cartItems.results || [])) {
          total += item.quantity || 0;
          count += item.quantity || 0;
        }
      
        return new Response(JSON.stringify({
          success: true,
          message: "Item removed from cart",
          total: total,
          count: count
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      
      } catch (error) {
        console.error('[Cart] DELETE error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      }
    }

    // DELETE /api/cart/clear - Clear entire cart
    if (routePath === "/api/cart/clear" && request.method === "DELETE") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: "Authentication required"
          }), {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders
            }
          });
        }
      
        await env.DB.prepare(
          "DELETE FROM cart WHERE user_id = ?"
        ).bind(user.id).run();
      
        return new Response(JSON.stringify({
          success: true,
          message: "Cart cleared"
        }), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      
      } catch (error) {
        console.error('[Cart] Clear error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      }
    }

    // ===== CART SYNC - Accept frontend format (localItems) =====
    if (routePath === "/api/cart/sync" && request.method === "POST") {
      try {
        const body = await request.json();
        
        // ============================================================
        // FIX: Support frontend format: { localItems: [...] }
        // ============================================================
        let items = [];
        
        // Format 1: { localItems: [...] } - What cart-store.js sends
        if (body.localItems && Array.isArray(body.localItems)) {
          items = body.localItems;
        }
        // Format 2: { items: [...] } - Standard format
        else if (body.items && Array.isArray(body.items)) {
          items = body.items;
        }
        // Format 3: { cart: [...] } - Legacy format
        else if (body.cart && Array.isArray(body.cart)) {
          items = body.cart;
        }
        // Format 4: Direct array
        else if (Array.isArray(body)) {
          items = body;
        }
        // Format 5: Single item
        else if (body.productId || body.id) {
          items = [body];
        }
        else {
          return new Response(JSON.stringify({
            success: false,
            error: "Items array required. Supported formats: { localItems: [...] }, { items: [...] }, or direct array"
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }
        
        // Filter out invalid items
        items = items.filter(item => item && (item.id || item.productId) && (item.name || item.productName));
        
        // Get user from auth
        const user = await requireAuth(request, env, null);
        
        if (user) {
          const userId = user.id;
          const now = Math.floor(Date.now() / 1000);
          
          // Clear existing cart
          await env.DB.prepare(
            "DELETE FROM cart WHERE user_id = ?"
          ).bind(userId).run();
          
          // Insert each item
          for (const item of items) {
            const productId = item.productId || item.id;
            const quantity = item.quantity || 1;
            const variant = item.variant || null;
            const notes = item.notes || null;
            
            await env.DB.prepare(`
              INSERT INTO cart (id, user_id, product_id, quantity, variant, notes, active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
            `).bind(crypto.randomUUID(), userId, productId, quantity, variant, notes, now, now).run();
          }
          
          // Also store savedItems if provided
          if (body.savedItems && Array.isArray(body.savedItems)) {
            // Store saved items (you can create a saved_items table or store in JSON)
            // For now, we'll just acknowledge it
          }
          
          console.log(`[Cart] Synced ${items.length} items for user ${userId}`);
          
          // Get updated cart count
          const countResult = await env.DB.prepare(
            "SELECT SUM(quantity) as total FROM cart WHERE user_id = ? AND active = 1"
          ).bind(userId).first();
          
          return new Response(JSON.stringify({
            success: true,
            synced: true,
            items: items,
            count: items.length,
            totalItems: countResult?.total || 0
          }), {
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        } else {
          // Guest user - just acknowledge sync
          return new Response(JSON.stringify({
            success: true,
            synced: true,
            items: items,
            count: items.length,
            message: "Guest cart sync acknowledged"
          }), {
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }
        
      } catch (error) {
        console.error('[Cart] Sync error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message || 'Cart sync failed'
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // WISHLIST ROUTES
    // ======================================================================

    // GET /api/wishlist - Get user's wishlist
    if (routePath === "/api/wishlist" && request.method === "GET") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: "Authentication required",
            items: [],
            count: 0
          }), {
            status: 401,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const userId = user.id;
        
        // Get wishlist items with product details
        const wishlistItems = await env.DB.prepare(`
          SELECT 
            w.id as wishlist_id,
            w.product_id,
            w.created_at as added_at,
            p.id as product_id,
            p.name,
            p.price,
            p.image_url,
            p.stock,
            p.category,
            p.description,
            p.rating,
            p.sale_price,
            p.wholesale_price
          FROM wishlist w
          LEFT JOIN products p ON w.product_id = p.id
          WHERE w.user_id = ? AND w.active = 1
          ORDER BY w.created_at DESC
        `).bind(userId).all();

        const items = (wishlistItems.results || []).map(row => ({
          id: row.product_id,
          wishlistId: row.wishlist_id,
          name: row.name || 'Product',
          price: row.sale_price || row.price || 0,
          wholesalePrice: row.wholesale_price || null,
          image: row.image_url || '/company_logo.png',
          stock: row.stock || 0,
          category: row.category || 'general',
          description: row.description || '',
          rating: row.rating || 0,
          addedAt: row.added_at
        }));

        return new Response(JSON.stringify({
          success: true,
          items: items,
          count: items.length
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (error) {
        console.error('[Wishlist] GET error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          items: [],
          count: 0
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // POST /api/wishlist - Add item to wishlist
    if (routePath === "/api/wishlist" && request.method === "POST") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: "Authentication required"
          }), {
            status: 401,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const body = await request.json();
        const { productId } = body || {};

        if (!productId) {
          return new Response(JSON.stringify({
            success: false,
            error: "Product ID is required"
          }), {
            status: 400,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const userId = user.id;
        const now = Math.floor(Date.now() / 1000);

        // Check if product already in wishlist
        const existing = await env.DB.prepare(
          "SELECT id FROM wishlist WHERE user_id = ? AND product_id = ? AND active = 1"
        ).bind(userId, productId).first();

        if (existing) {
          return new Response(JSON.stringify({
            success: false,
            error: "Product already in wishlist",
            alreadyExists: true
          }), {
            status: 409,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        // Add to wishlist
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO wishlist (id, user_id, product_id, active, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)"
        ).bind(id, userId, productId, now, now).run();

        // Get updated wishlist count
        const countResult = await env.DB.prepare(
          "SELECT COUNT(*) as total FROM wishlist WHERE user_id = ? AND active = 1"
        ).bind(userId).first();

        return new Response(JSON.stringify({
          success: true,
          message: "Product added to wishlist",
          wishlistId: id,
          count: countResult?.total || 0
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (error) {
        console.error('[Wishlist] POST error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // DELETE /api/wishlist/:productId - Remove item from wishlist
    if (routePath.match(/^\/api\/wishlist\/[^\/]+$/) && request.method === "DELETE") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: "Authentication required"
          }), {
            status: 401,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const productId = routePath.split('/').pop();
        const userId = user.id;

        // Soft delete (set active = 0)
        await env.DB.prepare(
          "UPDATE wishlist SET active = 0, updated_at = ? WHERE user_id = ? AND product_id = ? AND active = 1"
        ).bind(Math.floor(Date.now() / 1000), userId, productId).run();

        // Get updated wishlist count
        const countResult = await env.DB.prepare(
          "SELECT COUNT(*) as total FROM wishlist WHERE user_id = ? AND active = 1"
        ).bind(userId).first();

        return new Response(JSON.stringify({
          success: true,
          message: "Product removed from wishlist",
          count: countResult?.total || 0
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (error) {
        console.error('[Wishlist] DELETE error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // DELETE /api/wishlist/clear - Clear entire wishlist
    if (routePath === "/api/wishlist/clear" && request.method === "DELETE") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({
            success: false,
            error: "Authentication required"
          }), {
            status: 401,
            headers: { 
              "Content-Type": "application/json", 
              "Access-Control-Allow-Origin": "*", 
              "Access-Control-Allow-Credentials": "true",
              ...corsHeaders 
            }
          });
        }

        const userId = user.id;

        // Soft delete all wishlist items
        await env.DB.prepare(
          "UPDATE wishlist SET active = 0, updated_at = ? WHERE user_id = ? AND active = 1"
        ).bind(Math.floor(Date.now() / 1000), userId).run();

        return new Response(JSON.stringify({
          success: true,
          message: "Wishlist cleared"
        }), {
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });

      } catch (error) {
        console.error('[Wishlist] Clear error:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: { 
            "Content-Type": "application/json", 
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders 
          }
        });
      }
    }

    // ======================================================================
    // PRODUCTS - PUT (Edit)
    // ======================================================================
    if (routePath.match(/^\/api\/products\/[^\/]+$/) && request.method === "PUT") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        const body = await request.json();
        const result = await updateRecord(env, 'products', id, body);
        return new Response(JSON.stringify(result), {
          status: result.success ? 200 : 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== PRODUCTS - DELETE (soft delete) =====
    if (routePath.match(/^\/api\/products\/[^\/]+$/) && request.method === "DELETE") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const id = routePath.split('/').pop();
        await env.DB.prepare("UPDATE products SET active = 0 WHERE id = ?").bind(id).run();
        return new Response(JSON.stringify({ success: true, message: "Product deactivated" }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ===== PRODUCTS - CREATE (NEW) =====
    if (routePath === "/api/products" && request.method === "POST") {
      const user = await requireAuth(request, env, ["admin"]);
      if (!user) return errorResponse("Unauthorized", 401, corsHeaders, routePath);
      try {
        const body = await request.json();
        const { name, price, stock, category, description, image_url, active, wholesale_price, wholesale_available, brand, store_type } = body || {};
      
        if (!name || !price) {
          return new Response(JSON.stringify({ error: "Name and price are required" }), {
            status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
      
        const id = crypto.randomUUID();
        await env.DB.prepare(`
          INSERT INTO products (id, name, price, stock, category, description, image_url, active, wholesale_price, wholesale_available, brand, store_type, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).bind(
          id,
          name,
          price,
          stock || 0,
          category || null,
          description || null,
          image_url || null,
          active !== undefined ? active : 1,
          wholesale_price || null,
          wholesale_available || 0,
          brand || null,
          store_type || 'gadgets'
        ).run();
      
        await logEvent(env, "PRODUCT_CREATED", `Product created: ${name}`, user.id);
      
        return new Response(JSON.stringify({
          success: true,
          id,
          message: "Product created successfully"
        }), {
          status: 201,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // ======================================================================
    // CART FIX - Additional endpoints for frontend compatibility
    // ======================================================================

    // DELETE /api/cart/remove/:itemId - Remove item from cart
    if (routePath.match(/^\/api\/cart\/remove\/[^\/]+$/) && request.method === "DELETE") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        const itemId = routePath.split('/').pop();
        await env.DB.prepare("DELETE FROM cart WHERE id = ? AND user_id = ?").bind(itemId, user.id).run();
        const cartItems = await env.DB.prepare("SELECT id, product_id, quantity FROM cart WHERE user_id = ? AND active = 1").bind(user.id).all();
        let total = 0;
        let count = 0;
        for (const item of (cartItems.results || [])) {
          total += item.quantity || 0;
          count += item.quantity || 0;
        }
        return new Response(JSON.stringify({ success: true, message: "Item removed from cart", total: total, count: count }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (error) {
        console.error('[Cart] Remove error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }

    // DELETE /api/cart - Clear all cart
    if (routePath === "/api/cart" && request.method === "DELETE") {
      try {
        const user = await requireAuth(request, env, ["user", "admin", "staff"]);
        if (!user) {
          return new Response(JSON.stringify({ success: false, error: "Authentication required" }), {
            status: 401,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
          });
        }
        await env.DB.prepare("DELETE FROM cart WHERE user_id = ?").bind(user.id).run();
        return new Response(JSON.stringify({ success: true, message: "Cart cleared", total: 0, count: 0 }), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      } catch (error) {
        console.error('[Cart] Clear error:', error);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true", ...corsHeaders }
        });
      }
    }


    // ======================================================================
    // FIX: /api/analytics/performance endpoint
    // ======================================================================
    if (routePath === "/api/analytics/performance" && request.method === "POST") {
      try {
        const body = await request.json();
        console.log("[Performance] Received metrics");
        
        // Return success immediately (non-blocking)
        return new Response(JSON.stringify({
          success: true,
          message: "Performance metrics recorded",
          timestamp: Date.now()
        }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
            ...corsHeaders
          }
        });
      }
    }
    // Reviews
    if (path === '/api/reviews' && request.method === 'GET') {
        return await handleGetReviews(request, env, ctx);
    }
    if (path === '/api/reviews' && request.method === 'POST') {
        return await handleCreateReview(request, env, ctx);
    }
    if (path.startsWith('/api/reviews/') && request.method === 'DELETE') {
        const reviewId = path.slice('/api/reviews/'.length);
        if (reviewId && !reviewId.includes('/')) {
            return await handleDeleteReview(request, env, ctx, reviewId);
        }
    }

    // ======================================================================
    // 404 HANDLING - MUST BE LAST IN handleRequest()
    // ======================================================================
    return errorResponse("Endpoint not found", 404, corsHeaders, routePath);
}

// ======================================================================
// SCHEDULED / CRON JOBS
// ======================================================================
export async function scheduled(event, env, ctx) {
  // Clean up expired OTP codes
  try { 
    await env.DB.prepare("DELETE FROM otp_codes WHERE expires_at < ?").bind(Date.now()).run(); 
    console.log('✅ Cleaned up expired OTP codes');
  } catch (e) { console.error('❌ OTP cleanup failed:', e.message); }
  
  // Clean up abandoned charging sessions
  try {
    const oldSessions = await env.DB.prepare(
      "SELECT id FROM charging_sessions WHERE status IN ('charging', 'paused') AND start_time < datetime('now', '-24 hours')"
    ).all();
    for (const s of (oldSessions.results || [])) { 
      await env.DB.prepare(
        "UPDATE charging_sessions SET status = 'abandoned', completed_time = datetime('now') WHERE id = ?"
      ).bind(s.id).run(); 
    }
    if (oldSessions.results?.length > 0) {
      console.log(`✅ Marked ${oldSessions.results.length} abandoned charging sessions`);
    }
  } catch (e) { console.error('❌ Charging sessions cleanup failed:', e.message); }
  
  // Clean up old audit logs
  try { 
    const result = await env.DB.prepare("DELETE FROM audit_logs WHERE timestamp < datetime('now', '-90 days')").run();
    if (result.changes > 0) console.log(`✅ Cleaned up ${result.changes} old audit logs`);
  } catch (e) { console.error('❌ Audit logs cleanup failed:', e.message); }
  
  // Clean up old notifications
  try { 
    const result = await env.DB.prepare("DELETE FROM notifications WHERE created_at < datetime('now', '-30 days')").run();
    if (result.changes > 0) console.log(`✅ Cleaned up ${result.changes} old notifications`);
  } catch (e) { console.error('❌ Notifications cleanup failed:', e.message); }
  
  // Clean up expired password resets
  try { 
    const result = await env.DB.prepare("DELETE FROM staff_password_resets WHERE expires_at < ?").bind(Date.now()).run();
    if (result.changes > 0) console.log(`✅ Cleaned up ${result.changes} expired password resets`);
  } catch (e) { console.error('❌ Password resets cleanup failed:', e.message); }
  
  // Clean up old draft quotes
  try { 
    const result = await env.DB.prepare("DELETE FROM quotes WHERE status = 'draft' AND created_at < datetime('now', '-7 days')").run();
    if (result.changes > 0) console.log(`✅ Cleaned up ${result.changes} old draft quotes`);
  } catch (e) { console.error('❌ Quotes cleanup failed:', e.message); }
  
  // ===== CLEAR SIGNATURE PRODUCTS CACHE =====
  try {
    await updateSignatureCache(env);
  } catch (e) {
    console.error('❌ Failed to clear signature cache in scheduled job:', e.message);
  }
  
  // ===== CLEAN UP OLD PUSH SUBSCRIPTIONS =====
  try {
    const result = await env.DB.prepare(
      "DELETE FROM push_subscriptions WHERE created_at < datetime('now', '-90 days')"
    ).run();
    if (result.changes > 0) {
      console.log(`✅ Cleaned up ${result.changes} old push subscriptions`);
    }
  } catch (e) {
    console.error('❌ Push subscriptions cleanup failed:', e.message);
  }
}
