// ======================================================================
// WHOLESALE HANDLER - ADAPTED TO ACTUAL DATABASE SCHEMA
// ======================================================================

import { logEvent } from '../utils/logging.js';
import { requireAuth } from '../middleware/auth.js';
import { validateString, validateEmail } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { addSecurityHeaders } from '../middleware/security.js';

// ================================================================
// UUID GENERATOR (Cloudflare Workers compatible)
// ================================================================

function generateId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ================================================================
// CONSTANTS
// ================================================================

const WHOLESALE_MIN_QUANTITY = 10;
const MAX_WHOLESALE_ITEMS = 500;
const WHOLESALE_DEFAULT_DISCOUNT = 15;

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Verify a wholesale/reseller code against actual database schema
 */
async function verifyTierCode(code, env) {
    const normalized = code.toUpperCase().trim();
    const now = Date.now();

    // 1. Check wholesale_codes (WH-*, DIST-*, and some REF-*)
    const wholesale = await env.DB.prepare(
        `SELECT id, code, description, discount_percent, tier, max_uses, times_used, is_active 
         FROM wholesale_codes 
         WHERE code = ? AND is_active = 1`
    ).bind(normalized).first();

    if (wholesale) {
        if (wholesale.max_uses && wholesale.times_used >= wholesale.max_uses) {
            return { 
                valid: false, 
                error: 'This code has reached its usage limit.',
                code: 'USAGE_LIMIT_EXCEEDED'
            };
        }

        return {
            valid: true,
            source: 'wholesale_codes',
            code: wholesale.code,
            tier: wholesale.tier || 'wholesale',  // 'wholesale' | 'reseller' | 'distributor'
            discount: wholesale.discount_percent || WHOLESALE_DEFAULT_DISCOUNT,
            description: wholesale.description || 'Wholesale discount',
            dbId: wholesale.id,
            type: 'wholesale'
        };
    }

    // 2. Check reseller_codes (REF-* auto-generated codes)
    // NOTE: reseller_codes has NO id column - code is the primary key
    const reseller = await env.DB.prepare(
        `SELECT code, discount, tier, maxUses, active, expiryDate 
         FROM reseller_codes 
         WHERE code = ? AND active = 1`
    ).bind(normalized).first();

    if (reseller) {
        // Check expiry if present
        if (reseller.expiryDate && now > reseller.expiryDate) {
            return { 
                valid: false, 
                error: 'This reseller code has expired.',
                code: 'CODE_EXPIRED'
            };
        }

        // Check maxUses if present (use wholesale_usage table)
        if (reseller.maxUses) {
            const usage = await env.DB.prepare(
                `SELECT COUNT(*) as count FROM wholesale_usage 
                 WHERE code_type = 'reseller' AND code_id = ?`
            ).bind(reseller.code).first();

            if (usage && usage.count >= reseller.maxUses) {
                return { 
                    valid: false, 
                    error: 'This reseller code has reached its usage limit.',
                    code: 'USAGE_LIMIT_EXCEEDED'
                };
            }
        }

        return {
            valid: true,
            source: 'reseller_codes',
            code: reseller.code,
            tier: reseller.tier || 'reseller',  // 'basic' | 'bronze' | 'standard' | 'premium'
            discount: reseller.discount || 10,
            description: `${reseller.tier || 'Reseller'} discount`,
            dbId: reseller.code,  // reseller_codes has no id, use code as identifier
            type: 'reseller'
        };
    }

    return { 
        valid: false, 
        error: 'Invalid wholesale or reseller code.',
        code: 'INVALID_CODE'
    };
}

/**
 * Record usage of a wholesale/reseller code
 */
async function recordTierCodeUsage(env, codeId, userId, codeType = 'wholesale') {
    try {
        const id = generateId();
        const now = Date.now();

        await env.DB.prepare(
            `INSERT INTO wholesale_usage (id, code_id, user_id, code_type, used_at) 
             VALUES (?, ?, ?, ?, ?)`
        ).bind(id, codeId, userId, codeType, now).run();

        // Increment times_used on wholesale_codes if applicable
        if (codeType === 'wholesale') {
            await env.DB.prepare(
                `UPDATE wholesale_codes SET times_used = times_used + 1 WHERE id = ?`
            ).bind(codeId).run();
        }

        return { success: true };
    } catch (error) {
        console.error('❌ Error recording usage:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update user's wholesale_tier in database
 */
async function updateUserWholesaleTier(env, userId, tier) {
    try {
        await env.DB.prepare(
            `UPDATE users SET wholesale_tier = ? WHERE id = ?`
        ).bind(tier, userId).run();
        return { success: true };
    } catch (error) {
        console.error('❌ Error updating user tier:', error);
        return { success: false, error: error.message };
    }
}

// ================================================================
// ===== HANDLER: POST /api/wholesale/verify-code =====
// ================================================================

export async function handleWholesaleVerifyCode(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const { code, userId } = body || {};

        if (!code) {
            return new Response(JSON.stringify({
                success: false,
                verified: false,
                error: 'Code is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Verify the code
        const result = await verifyTierCode(code, env);

        if (!result.valid) {
            return new Response(JSON.stringify({
                success: false,
                verified: false,
                error: result.error,
                code: result.code || 'INVALID_CODE'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Track usage if userId provided
        if (userId) {
            await recordTierCodeUsage(env, result.dbId, userId, result.type || 'wholesale');
            
            // Update user's wholesale_tier in database
            await updateUserWholesaleTier(env, userId, result.tier);
        }

        // Log the verification
        await logEvent(env, 'WHOLESALE_CODE_VERIFIED', 
            `Wholesale code ${result.code} verified (${result.tier})`, 
            userId || 'anonymous'
        );

        return new Response(JSON.stringify({
            success: true,
            verified: true,
            tier: result.tier,
            discount: result.discount,
            code: result.code,
            description: result.description,
            message: `${result.tier.charAt(0).toUpperCase() + result.tier.slice(1)} code verified successfully`
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('❌ Wholesale verification error:', error);
        return new Response(JSON.stringify({
            success: false,
            verified: false,
            error: 'Failed to verify code: ' + error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/wholesale/request-access =====
// ================================================================

export async function handleWholesaleRequestAccess(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const {
            businessName,
            name,           // Map from frontend
            email,
            phone,
            message,        // Map from frontend
            description,    // Alternative field
            businessInfo,
            expectedVolume,
            businessType,
            cacNumber,
            address
        } = body || {};

        // Determine which fields to use
        const finalName = name || businessName || '';
        const finalMessage = message || description || '';
        const finalBusinessInfo = businessInfo || JSON.stringify({
            businessType: businessType || '',
            cacNumber: cacNumber || '',
            address: address || ''
        });
        const finalExpectedVolume = expectedVolume || '';

        // Validate required fields
        if (!finalName || !email || !phone) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Business name, email, and phone are required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Check if already exists
        const existing = await env.DB.prepare(
            `SELECT id FROM wholesale_requests WHERE email = ? AND status != 'rejected'`
        ).bind(email).first();

        if (existing) {
            return new Response(JSON.stringify({
                success: false,
                error: 'A request with this email already exists',
                requestId: existing.id
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Create request - using actual schema columns
        const id = generateId();
        const now = new Date().toISOString();

        await env.DB.prepare(
            `INSERT INTO wholesale_requests (
                id, name, email, phone, message, business_info, 
                expected_volume, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
        ).bind(
            id, 
            finalName, 
            email, 
            phone, 
            finalMessage, 
            finalBusinessInfo, 
            finalExpectedVolume,
            now
        ).run();

        // Log the request
        await logEvent(env, 'WHOLESALE_REQUEST', 
            `Wholesale request from ${finalName} (${email})`, 
            null
        );

        // Try to send notification email
        try {
            const { sendEmail } = await import('../../notifications.js');
            if (sendEmail) {
                await sendEmail(
                    email,
                    `Wholesale Access Request Received — PrimeShieldHub`,
                    `
                    <!DOCTYPE html>
                    <html>
                    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; padding: 20px;">
                        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px;">
                            <h1 style="color: #12122a; font-size: 20px;">PrimeShieldHub</h1>
                            <h2>Wholesale Access Request Received ✅</h2>
                            <p>Dear ${finalName},</p>
                            <p>Thank you for your wholesale access request.</p>
                            <p>We will review your request and get back to you within 24-48 hours.</p>
                            <hr style="border-color: #eee;">
                            <p style="font-size: 12px; color: #888;">PrimeShieldHub · Nigeria's Leading Tech Hub</p>
                        </div>
                    </body>
                    </html>
                    `,
                    env
                );
            }
        } catch (e) {
            console.log('Wholesale request email failed:', e.message);
        }

        return new Response(JSON.stringify({
            success: true,
            requestId: id,
            trackingId: id,
            message: 'Wholesale access request submitted successfully'
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('❌ Wholesale request error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to submit request: ' + error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: GET /api/wholesale/products =====
// ================================================================

export async function handleWholesaleProducts(request, env, corsHeaders, requestInfo) {
    try {
        const url = new URL(request.url);
        const category = url.searchParams.get('category') || '';
        const search = url.searchParams.get('search') || '';
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        // Check if user has wholesale access
        let user = null;
        let isWholesale = false;
        let wholesaleTier = null;

        try {
            user = await requireAuth(request, env, ['user', 'admin', 'staff']);
            if (user && user.id) {
                const userData = await env.DB.prepare(
                    `SELECT wholesale_tier FROM users WHERE id = ?`
                ).bind(user.id).first();
                
                if (userData && userData.wholesale_tier && userData.wholesale_tier !== 'standard') {
                    isWholesale = true;
                    wholesaleTier = userData.wholesale_tier;
                }
            }
        } catch (e) {
            // User not authenticated - return public products only
        }

        // Build query using actual product schema
        let query = `
            SELECT id, name, price, wholesale_price, stock, category, 
                   description, image_url, brand, store_type,
                   weightKg, specifications
            FROM products 
            WHERE active = 1 
            AND wholesale_available = 1
        `;
        const params = [];

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

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total FROM products 
            WHERE active = 1 AND wholesale_available = 1
        `;
        const countParams = [];

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

        // Format products for response
        const products = (result.results || []).map(product => {
            const wholesalePrice = product.wholesale_price || product.price * 0.85;
            const displayPrice = isWholesale ? wholesalePrice : product.price;
            
            return {
                id: product.id,
                name: product.name,
                price: product.price,
                wholesalePrice: product.wholesale_price || null,
                displayPrice: displayPrice,
                stock: product.stock,
                category: product.category,
                description: product.description,
                image: product.image_url,
                brand: product.brand,
                storeType: product.store_type,
                wholesaleAvailable: true,
                weightKg: product.weightKg || 0.5,
                specifications: product.specifications ? JSON.parse(product.specifications) : null,
                ...(isWholesale ? { wholesalePrice: wholesalePrice } : {})
            };
        });

        return new Response(JSON.stringify({
            success: true,
            products: products,
            total: total?.total || 0,
            limit,
            offset,
            isWholesale: isWholesale,
            wholesaleTier: wholesaleTier,
            minQuantity: WHOLESALE_MIN_QUANTITY
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('❌ Wholesale products error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to fetch products: ' + error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/wholesale/request-quote =====
// ================================================================

export async function handleWholesaleRequestQuote(request, env, corsHeaders) {
    try {
        const body = await request.json();
        const {
            customerName,
            customer_name,    // Alternative field
            email,
            customer_email,   // Alternative field
            phone,
            customer_phone,   // Alternative field
            companyName,
            company_name,     // Alternative field
            deliveryAddress,
            delivery_address, // Alternative field
            products,
            projectName,
            project_name,     // Alternative field
            subtotal,
            discount,
            tax,
            deliveryFee,
            delivery_fee,     // Alternative field
            total,
            notes
        } = body || {};

        // Map fields to actual schema
        const finalCustomerName = customerName || customer_name || '';
        const finalEmail = email || customer_email || '';
        const finalPhone = phone || customer_phone || '';
        const finalCompanyName = companyName || company_name || null;
        const finalDeliveryAddress = deliveryAddress || delivery_address || null;
        const finalProjectName = projectName || project_name || 'Quote Request';
        const finalSubtotal = subtotal || 0;
        const finalDiscount = discount || 0;
        const finalTax = tax || 0;
        const finalDeliveryFee = deliveryFee || delivery_fee || 0;
        const finalTotal = total || (finalSubtotal - finalDiscount + finalTax + finalDeliveryFee);
        const finalProducts = products || [];

        // Validate
        if (!finalCustomerName || !finalEmail || !finalPhone) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Customer name, email, and phone are required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (!finalProducts || finalProducts.length === 0) {
            return new Response(JSON.stringify({
                success: false,
                error: 'At least one product is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Create quote using actual schema
        const id = generateId();
        const quoteNumber = `QT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const now = new Date().toISOString();

        // Store products JSON in project_size (since no products column)
        const productsJson = JSON.stringify(finalProducts);

        await env.DB.prepare(
            `INSERT INTO quotes (
                id, quote_number, customer_name, customer_email, customer_phone,
                company_name, delivery_address, project_name, project_type,
                project_size, status, subtotal, discount, tax, delivery_fee,
                total, currency, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, 'NGN', ?, ?, ?)`
        ).bind(
            id, quoteNumber, finalCustomerName, finalEmail, finalPhone,
            finalCompanyName, finalDeliveryAddress, finalProjectName,
            'standard', productsJson,  // project_size stores products JSON
            finalSubtotal, finalDiscount, finalTax, finalDeliveryFee,
            finalTotal,
            notes || null,
            now, now
        ).run();

        // Log the quote
        await logEvent(env, 'WHOLESALE_QUOTE', 
            `Wholesale quote created for ${finalCustomerName} (${finalEmail}) - ${quoteNumber}`, 
            null
        );

        // Try to send notification email
        try {
            const { sendEmail } = await import('../../notifications.js');
            if (sendEmail) {
                let productListHtml = finalProducts.map(p => 
                    `<tr>
                        <td>${p.name || p.product_name || 'Product'}</td>
                        <td>${p.quantity || 1}</td>
                        <td>₦${(p.wholesalePrice || p.price || 0).toLocaleString()}</td>
                        <td>₦${((p.wholesalePrice || p.price || 0) * (p.quantity || 1)).toLocaleString()}</td>
                    </tr>`
                ).join('');

                await sendEmail(
                    finalEmail,
                    `Wholesale Quote Request — ${quoteNumber} — PrimeShieldHub`,
                    `
                    <!DOCTYPE html>
                    <html>
                    <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; padding: 20px;">
                        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px;">
                            <h1 style="color: #12122a; font-size: 20px;">PrimeShieldHub</h1>
                            <h2>Wholesale Quote Request ✅</h2>
                            <p>Dear ${finalCustomerName},</p>
                            <p>We have received your wholesale quote request.</p>
                            <p><strong>Quote Number:</strong> ${quoteNumber}</p>
                            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                                <thead>
                                    <tr style="background: #f4f4f8;">
                                        <th style="padding: 8px; text-align: left;">Product</th>
                                        <th style="padding: 8px; text-align: center;">Qty</th>
                                        <th style="padding: 8px; text-align: right;">Unit Price</th>
                                        <th style="padding: 8px; text-align: right;">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${productListHtml}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="3" style="padding: 8px; text-align: right; font-weight: 700;">Total:</td>
                                        <td style="padding: 8px; text-align: right; font-weight: 700;">₦${finalTotal.toLocaleString()}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <p>We will review your request and provide a formal quote within 24-48 hours.</p>
                            <hr style="border-color: #eee;">
                            <p style="font-size: 12px; color: #888;">PrimeShieldHub · Nigeria's Leading Tech Hub</p>
                        </div>
                    </body>
                    </html>
                    `,
                    env
                );
            }
        } catch (e) {
            console.log('Quote request email failed:', e.message);
        }

        return new Response(JSON.stringify({
            success: true,
            quoteId: id,
            quoteNumber: quoteNumber,
            totalAmount: finalTotal,
            productCount: finalProducts.length,
            message: 'Quote request submitted successfully'
        }), {
            status: 201,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('❌ Wholesale quote error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Failed to create quote: ' + error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== ADMIN: Get wholesale requests =====
// ================================================================

export async function handleAdminWholesaleRequests(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const status = url.searchParams.get('status') || '';
        const limit = parseInt(url.searchParams.get('limit') || '100');
        const offset = parseInt(url.searchParams.get('offset') || '0');

        let query = `SELECT * FROM wholesale_requests`;
        const params = [];

        if (status) {
            query += ` WHERE status = ?`;
            params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();

        let countQuery = `SELECT COUNT(*) as total FROM wholesale_requests`;
        const countParams = [];
        if (status) {
            countQuery += ` WHERE status = ?`;
            countParams.push(status);
        }
        const total = await env.DB.prepare(countQuery).bind(...countParams).first();

        return new Response(JSON.stringify({
            success: true,
            requests: result.results || [],
            total: total?.total || 0,
            limit,
            offset
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('❌ Admin wholesale requests error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== ADMIN: Update wholesale request status =====
// ================================================================

export async function handleAdminUpdateWholesaleRequest(request, env, corsHeaders) {
    try {
        const url = new URL(request.url);
        const id = url.pathname.split('/').pop();
        const body = await request.json();
        const { status, reviewed_by, notes } = body || {};

        if (!status) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Status is required'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const validStatuses = ['pending', 'approved', 'rejected', 'reviewing'];
        if (!validStatuses.includes(status)) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Invalid status'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const request = await env.DB.prepare(
            `SELECT name, email FROM wholesale_requests WHERE id = ?`
        ).bind(id).first();

        if (!request) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Request not found'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const now = new Date().toISOString();
        await env.DB.prepare(
            `UPDATE wholesale_requests 
             SET status = ?, reviewed_by = ?, reviewed_at = ? 
             WHERE id = ?`
        ).bind(status, reviewed_by || null, now, id).run();

        // If approved, generate wholesale code
        if (status === 'approved') {
            const code = `WH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
            const codeId = generateId();
            await env.DB.prepare(
                `INSERT INTO wholesale_codes (id, code, description, tier, is_active, created_at) 
                 VALUES (?, ?, ?, 'wholesale', 1, ?)`
            ).bind(codeId, code, `Wholesale code for ${request.name}`, Date.now()).run();

            // Try to send approval email
            try {
                const { sendEmail } = await import('../../notifications.js');
                if (sendEmail) {
                    await sendEmail(
                        request.email,
                        `Wholesale Access Approved — PrimeShieldHub`,
                        `
                        <!DOCTYPE html>
                        <html>
                        <body style="font-family: 'Segoe UI', Arial, sans-serif; background: #f4f4f8; padding: 20px;">
                            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 24px;">
                                <h1 style="color: #12122a; font-size: 20px;">PrimeShieldHub</h1>
                                <h2>Wholesale Access Approved! 🎉</h2>
                                <p>Dear ${request.name},</p>
                                <p>Your wholesale access request has been approved!</p>
                                <p>Your wholesale code: <strong>${code}</strong></p>
                                <p>Use this code at checkout to access wholesale pricing.</p>
                                <p>Happy shopping!</p>
                                <hr style="border-color: #eee;">
                                <p style="font-size: 12px; color: #888;">PrimeShieldHub · Nigeria's Leading Tech Hub</p>
                            </div>
                        </body>
                        </html>
                        `,
                        env
                    );
                }
            } catch (e) {
                console.log('Approval email failed:', e.message);
            }
        }

        await logEvent(env, 'WHOLESALE_REQUEST_UPDATED', 
            `Wholesale request ${id} updated to ${status}`, 
            null
        );

        return new Response(JSON.stringify({
            success: true,
            message: `Request updated to ${status}`
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('❌ Update wholesale request error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== EXPORT ALL HANDLERS =====
// ================================================================

export default {
    handleWholesaleVerifyCode,
    handleWholesaleRequestAccess,
    handleWholesaleProducts,
    handleWholesaleRequestQuote,
    handleAdminWholesaleRequests,
    handleAdminUpdateWholesaleRequest
};
