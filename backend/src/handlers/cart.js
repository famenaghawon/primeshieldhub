// ======================================================================
// CART HANDLER - COMPLETE IMPLEMENTATION v17.0
// FULLY INTEGRATED WITH D1 DATABASE
// ======================================================================

import { requireAuth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

// ================================================================
// CONFIGURATION
// ================================================================

const CART_CACHE_TTL = 3600; // 1 hour
const MAX_CART_ITEMS = 50;
const FREE_SHIPPING_THRESHOLD = 50000; // ₦50,000 (realistic Nigerian threshold)
const EXPRESS_FREE_SHIPPING_THRESHOLD = 1000000;
const WHOLESALE_MIN_QUANTITY = 10;
const VAT_RATE = 0.075;

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
// SHIPPING ZONES (synced with checkout.html)
// ================================================================

const SHIPPING_ZONES = {
    'Edo':          { zoneId: 'z1', base: 2000,  days: '1',   region: 'Home' },
    'Delta':        { zoneId: 'z2', base: 2500,  days: '1-2', region: 'Neighbor' },
    'Lagos':        { zoneId: 'z3', base: 4500,  days: '1-2', region: 'South-West' },
    'Ogun':         { zoneId: 'z3', base: 4500,  days: '1-2', region: 'South-West' },
    'Oyo':          { zoneId: 'z3', base: 4500,  days: '1-2', region: 'South-West' },
    'Osun':         { zoneId: 'z3', base: 4500,  days: '1-2', region: 'South-West' },
    'Ondo':         { zoneId: 'z3', base: 4500,  days: '1-2', region: 'South-West' },
    'Ekiti':        { zoneId: 'z3', base: 4500,  days: '1-2', region: 'South-West' },
    'Rivers':       { zoneId: 'z4', base: 5000,  days: '2-3', region: 'South-South' },
    'Bayelsa':      { zoneId: 'z4', base: 5000,  days: '2-3', region: 'South-South' },
    'Akwa Ibom':    { zoneId: 'z4', base: 5000,  days: '2-3', region: 'South-South' },
    'Cross River':  { zoneId: 'z4', base: 5000,  days: '2-3', region: 'South-South' },
    'Anambra':      { zoneId: 'z5', base: 5500,  days: '2-3', region: 'South-East' },
    'Imo':          { zoneId: 'z5', base: 5500,  days: '2-3', region: 'South-East' },
    'Abia':         { zoneId: 'z5', base: 5500,  days: '2-3', region: 'South-East' },
    'Enugu':        { zoneId: 'z5', base: 5500,  days: '2-3', region: 'South-East' },
    'Ebonyi':       { zoneId: 'z5', base: 5500,  days: '2-3', region: 'South-East' },
    'Abuja FCT':    { zoneId: 'z6', base: 6500,  days: '3-4', region: 'North-Central' },
    'Kwara':        { zoneId: 'z6', base: 6500,  days: '3-4', region: 'North-Central' },
    'Kogi':         { zoneId: 'z6', base: 6500,  days: '3-4', region: 'North-Central' },
    'Nasarawa':     { zoneId: 'z6', base: 6500,  days: '3-4', region: 'North-Central' },
    'Niger':        { zoneId: 'z6', base: 6500,  days: '3-4', region: 'North-Central' },
    'Plateau':      { zoneId: 'z6', base: 6500,  days: '3-4', region: 'North-Central' },
    'Benue':        { zoneId: 'z6', base: 6500,  days: '3-4', region: 'North-Central' },
    'Kaduna':       { zoneId: 'z7', base: 8500,  days: '4-5', region: 'North-West' },
    'Kano':         { zoneId: 'z7', base: 8500,  days: '4-5', region: 'North-West' },
    'Katsina':      { zoneId: 'z7', base: 8500,  days: '4-5', region: 'North-West' },
    'Sokoto':       { zoneId: 'z7', base: 8500,  days: '4-5', region: 'North-West' },
    'Zamfara':      { zoneId: 'z7', base: 8500,  days: '4-5', region: 'North-West' },
    'Kebbi':        { zoneId: 'z7', base: 8500,  days: '4-5', region: 'North-West' },
    'Jigawa':       { zoneId: 'z7', base: 8500,  days: '4-5', region: 'North-West' },
    'Adamawa':      { zoneId: 'z8', base: 9500,  days: '4-6', region: 'North-East' },
    'Bauchi':       { zoneId: 'z8', base: 9500,  days: '4-6', region: 'North-East' },
    'Borno':        { zoneId: 'z8', base: 9500,  days: '4-6', region: 'North-East' },
    'Gombe':        { zoneId: 'z8', base: 9500,  days: '4-6', region: 'North-East' },
    'Taraba':       { zoneId: 'z8', base: 9500,  days: '4-6', region: 'North-East' },
    'Yobe':         { zoneId: 'z8', base: 9500,  days: '4-6', region: 'North-East' }
};

// ================================================================
// PUBLIC DISCOUNT CODES (from database)
// ================================================================

const PUBLIC_DISCOUNTS = {
    'NEWCUSTOMER': { type: 'percentage', value: 5,  minAmount: 0,       maxUses: 1,  description: '5% off for new customers' },
    'FREESHIP':    { type: 'shipping',   value: 0,  minAmount: 15000,   maxUses: null, description: 'Free standard shipping' },
    'SAVE20':      { type: 'percentage', value: 20, minAmount: 100000,  maxUses: null, description: '20% off orders over ₦100,000' },
    'WELCOME10':   { type: 'percentage', value: 10, minAmount: 0,       maxUses: 1,  description: '10% off first order' }
};

// ================================================================
// HELPER FUNCTIONS
// ================================================================

/**
 * Calculate weight multiplier for shipping
 */
function getWeightMultiplier(totalWeightKg) {
    if (totalWeightKg > 10) return 2.5;
    if (totalWeightKg > 5)  return 1.8;
    if (totalWeightKg > 2)  return 1.3;
    return 1;
}

/**
 * Calculate shipping using zone-based pricing
 */
function calculateZoneShipping(state, subtotal, totalWeightKg, express, pickup) {
    // Benin City pickup = completely free, same day
    if (pickup && state === 'Edo') {
        return { cost: 0, label: 'Benin City Pickup', days: 'Same day', zoneId: 'z1' };
    }

    // Free shipping threshold
    if (subtotal >= FREE_SHIPPING_THRESHOLD) {
        return { cost: 0, label: 'Free Shipping', days: '1-6', zoneId: null };
    }

    const zone = SHIPPING_ZONES[state];
    if (!zone) {
        return { cost: 8500, label: 'Standard Shipping', days: '3-6', zoneId: 'z7' };
    }

    let cost = Math.round(zone.base * getWeightMultiplier(totalWeightKg));

    if (express) {
        cost = Math.round(cost * 1.5);
        return { cost: cost, label: 'Express Delivery', days: '1-2', zoneId: zone.zoneId };
    }

    return { cost: cost, label: 'Standard Shipping', days: zone.days, zoneId: zone.zoneId };
}

/**
 * Calculate cart totals with all discounts and promotions
 */
function calculateCartTotals(items, user = null, discountCode = null, wholesaleTier = null, state = 'Edo', express = false, pickup = false) {
    let retailSubtotal = 0;
    let wholesaleSavingsTotal = 0;
    let isWholesale = false;
    let totalItems = 0;
    let totalWeight = 0;

    for (const item of items) {
        const price = parseFloat(item.price) || 0;
        const qty = parseInt(item.quantity) || 1;
        const wholesalePrice = parseFloat(item.wholesale_price) || parseFloat(item.wholesalePrice) || null;
        const weight = parseFloat(item.weightKg) || parseFloat(item.weight_kg) || 0.5;

        retailSubtotal += price * qty;
        totalItems += qty;
        totalWeight += weight * qty;

        // Wholesale pricing: qty >= 10 AND verified tier
        if (qty >= WHOLESALE_MIN_QUANTITY && wholesaleTier) {
            if (wholesalePrice && wholesalePrice > 0 && wholesalePrice < price) {
                wholesaleSavingsTotal += (price - wholesalePrice) * qty;
            } else {
                const rate = wholesaleTier === 'wholesale' ? 0.15 : 0.10;
                wholesaleSavingsTotal += (price * rate) * qty;
            }
            isWholesale = true;
        }
    }

    const adjustedSubtotal = retailSubtotal - wholesaleSavingsTotal;

    // Calculate shipping from zone map
    const shipping = calculateZoneShipping(state, adjustedSubtotal, totalWeight, express, pickup);

    // Apply PUBLIC discount code
    let discountAmount = 0;
    let displayDiscount = 0;

    if (discountCode) {
        const discount = PUBLIC_DISCOUNTS[discountCode.toUpperCase()];
        if (discount && adjustedSubtotal >= discount.minAmount) {
            if (discount.type === 'percentage') {
                discountAmount = Math.round(adjustedSubtotal * (discount.value / 100));
                displayDiscount = discountAmount;
            } else if (discount.type === 'shipping') {
                displayDiscount = shipping.cost;
                shipping.cost = 0;
                shipping.label = 'Free Shipping (Promo)';
            }
        }
    }

    // VAT on post-discount amount (Nigeria VAT Act compliance)
    const taxableAmount = Math.max(0, adjustedSubtotal - discountAmount);
    const vat = Math.round(taxableAmount * VAT_RATE);

    const total = taxableAmount + shipping.cost + vat;

    return {
        retailSubtotal: Math.round(retailSubtotal),
        adjustedSubtotal: Math.round(adjustedSubtotal),
        wholesaleSavings: Math.round(wholesaleSavingsTotal),
        isWholesale: isWholesale,
        shippingCost: Math.round(shipping.cost),
        shippingLabel: shipping.label,
        shippingDays: shipping.days,
        shippingZoneId: shipping.zoneId,
        vat: Math.round(vat),
        discountAmount: Math.round(displayDiscount),
        total: Math.round(total),
        totalItems: totalItems,
        totalWeight: totalWeight,
        freeShipping: adjustedSubtotal >= FREE_SHIPPING_THRESHOLD
    };
}

/**
 * Validate product stock
 */
async function validateStock(env, productId, quantity) {
    try {
        const product = await env.DB.prepare(`
            SELECT id, stock, name, active, price, wholesale_price, weightKg
            FROM products 
            WHERE id = ? AND active = 1
        `).bind(productId).first();

        if (!product) {
            return { valid: false, error: 'Product not found or inactive' };
        }

        if (product.stock < quantity) {
            return { 
                valid: false, 
                error: 'Insufficient stock',
                available: product.stock,
                product: product
            };
        }

        return { valid: true, product };
    } catch (error) {
        console.error('Stock validation error:', error);
        return { valid: false, error: 'Error validating stock' };
    }
}

/**
 * Format cart item for response
 */
function formatCartItem(item) {
    return {
        id: item.id,
        quantity: parseInt(item.quantity) || 1,
        variant: item.variant || null,
        notes: item.notes || null,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        product: {
            id: item.product_id,
            name: item.name,
            price: parseFloat(item.price) || 0,
            originalPrice: parseFloat(item.original_price) || null,
            wholesalePrice: parseFloat(item.wholesale_price) || null,
            image: item.image_url || item.image || null,
            description: item.description || null,
            category: item.category || null,
            slug: item.slug || null,
            stock: parseInt(item.stock) || 0,
            brand: item.brand || null,
            rating: parseFloat(item.rating) || null,
            specifications: item.specifications ? JSON.parse(item.specifications) : null,
            features: item.specifications ? JSON.parse(item.specifications) : [],
            isBestseller: parseInt(item.is_bestseller) || 0,
            isNew: parseInt(item.is_new) || 0,
            featured: parseInt(item.featured) || 0,
            wholesaleAvailable: parseInt(item.wholesale_available) || 0,
            weightKg: parseFloat(item.weightKg) || 0.5
        },
        subtotal: Math.round((parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1))
    };
}

/**
 * Log event to audit_logs
 */
async function logEvent(env, eventType, description, userId = null) {
    try {
        const id = generateId();
        await env.DB.prepare(`
            INSERT INTO audit_logs (id, user_id, event_type, description, timestamp)
            VALUES (?, ?, ?, ?, unixepoch())
        `).bind(id, userId, eventType, description).run();
    } catch (e) {
        // Silent fail - logging is optional
        console.warn('Logging failed:', e.message);
    }
}

// ================================================================
// ===== HANDLER: GET /api/cart =====
// ================================================================

export async function handleGetCart(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        // Get cart items with product details
        const result = await env.DB.prepare(`
            SELECT 
                c.id,
                c.quantity,
                c.variant,
                c.notes,
                c.created_at,
                c.updated_at,
                p.id as product_id,
                p.name,
                p.price,
                p.original_price,
                p.wholesale_price,
                p.image,
                p.image_url,
                p.description,
                p.category,
                p.stock,
                p.slug,
                p.brand,
                p.rating,
                p.specifications,
                p.wholesale_available,
                p.is_bestseller,
                p.is_new,
                p.featured,
                p.weightKg
            FROM cart c
            LEFT JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ? AND c.active = 1
            ORDER BY c.created_at DESC
        `).bind(user.id).all();

        const items = result.results || [];

        // Get saved items
        const savedResult = await env.DB.prepare(`
            SELECT 
                cs.id,
                cs.quantity,
                cs.variant,
                cs.created_at,
                p.id as product_id,
                p.name,
                p.price,
                p.wholesale_price,
                p.image,
                p.image_url,
                p.description,
                p.stock,
                p.slug
            FROM cart_saved cs
            LEFT JOIN products p ON cs.product_id = p.id
            WHERE cs.user_id = ? AND cs.active = 1
            ORDER BY cs.created_at DESC
        `).bind(user.id).all();

        const savedItems = savedResult.results || [];

        // Get user wholesale tier
        let wholesaleTier = null;
        const userData = await env.DB.prepare(
            `SELECT wholesale_tier FROM users WHERE id = ?`
        ).bind(user.id).first();
        if (userData && userData.wholesale_tier && userData.wholesale_tier !== 'standard') {
            wholesaleTier = userData.wholesale_tier;
        }

        // Get applied discount
        const discountResult = await env.DB.prepare(`
            SELECT cd.*, dc.code, dc.type, dc.value, dc.description
            FROM cart_discounts cd
            JOIN discount_codes dc ON cd.discount_id = dc.id
            WHERE cd.user_id = ? AND cd.active = 1
            ORDER BY cd.applied_at DESC
            LIMIT 1
        `).bind(user.id).first();

        const appliedDiscount = discountResult ? {
            code: discountResult.code,
            type: discountResult.type,
            value: discountResult.value,
            amount: discountResult.amount,
            description: discountResult.description,
            appliedAt: discountResult.applied_at
        } : null;

        // Calculate totals (default state = Edo)
        const state = 'Edo';
        const express = false;
        const pickup = false;
        const totals = calculateCartTotals(items, user, appliedDiscount?.code || null, wholesaleTier, state, express, pickup);

        // Format items
        const formattedItems = items.map(formatCartItem);
        const formattedSaved = savedItems.map(item => ({
            id: item.id,
            quantity: parseInt(item.quantity) || 1,
            variant: item.variant || null,
            createdAt: item.created_at,
            product: {
                id: item.product_id,
                name: item.name,
                price: parseFloat(item.price) || 0,
                wholesalePrice: parseFloat(item.wholesale_price) || null,
                image: item.image_url || item.image || null,
                description: item.description || null,
                stock: parseInt(item.stock) || 0,
                slug: item.slug || null
            }
        }));

        const response = {
            success: true,
            items: formattedItems,
            savedItems: formattedSaved,
            summary: {
                totalItems: totals.totalItems,
                retailSubtotal: totals.retailSubtotal,
                adjustedSubtotal: totals.adjustedSubtotal,
                wholesaleSavings: totals.wholesaleSavings,
                shippingCost: totals.shippingCost,
                shippingLabel: totals.shippingLabel,
                shippingDays: totals.shippingDays,
                vat: totals.vat,
                discountAmount: totals.discountAmount,
                total: totals.total,
                savings: totals.wholesaleSavings + totals.discountAmount,
                freeShipping: totals.freeShipping,
                wholesaleEligible: totals.isWholesale,
                itemCount: items.length
            },
            discount: appliedDiscount,
            wholesaleTier: wholesaleTier,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            },
            metadata: {
                maxItems: MAX_CART_ITEMS,
                freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
                wholesaleMinQuantity: WHOLESALE_MIN_QUANTITY,
                vatRate: VAT_RATE,
                currency: 'NGN'
            }
        };

        return new Response(JSON.stringify(response), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error fetching cart:', error);
        return new Response(JSON.stringify({ 
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/cart/add =====
// ================================================================

export async function handleAddToCart(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const body = await request.json();
        const { 
            productId, 
            quantity = 1, 
            variant = null, 
            notes = '',
            addToSaved = false 
        } = body || {};

        if (!productId) {
            return new Response(JSON.stringify({ error: 'Product ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (quantity < 1) {
            return new Response(JSON.stringify({ error: 'Quantity must be at least 1' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Validate product and stock
        const stockValidation = await validateStock(env, productId, quantity);
        if (!stockValidation.valid) {
            return new Response(JSON.stringify({ 
                error: stockValidation.error,
                available: stockValidation.available || 0
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const product = stockValidation.product;

        // Check if user has reached max cart items
        const currentCount = await env.DB.prepare(`
            SELECT COUNT(*) as count
            FROM cart
            WHERE user_id = ? AND active = 1
        `).bind(user.id).first();

        if (currentCount && currentCount.count >= MAX_CART_ITEMS) {
            return new Response(JSON.stringify({ 
                error: `Maximum ${MAX_CART_ITEMS} items allowed in cart`,
                currentCount: currentCount.count,
                maxItems: MAX_CART_ITEMS
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Check if already in cart
        const existing = await env.DB.prepare(`
            SELECT id, quantity FROM cart 
            WHERE user_id = ? AND product_id = ? AND active = 1
        `).bind(user.id, productId).first();

        let cartId;
        let newQuantity;
        let isNewItem = false;

        if (existing) {
            // Update existing
            newQuantity = existing.quantity + quantity;
            
            const stockCheck = await validateStock(env, productId, newQuantity);
            if (!stockCheck.valid) {
                return new Response(JSON.stringify({ 
                    error: 'Insufficient stock for total quantity',
                    available: stockCheck.available || 0,
                    currentInCart: existing.quantity
                }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json', ...corsHeaders }
                });
            }

            await env.DB.prepare(`
                UPDATE cart 
                SET quantity = ?, variant = ?, notes = ?, updated_at = unixepoch()
                WHERE id = ?
            `).bind(newQuantity, variant || null, notes || null, existing.id).run();
            
            cartId = existing.id;
        } else {
            // Add new
            cartId = generateId();
            await env.DB.prepare(`
                INSERT INTO cart (
                    id, user_id, product_id, quantity, variant, notes, active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())
            `).bind(cartId, user.id, productId, quantity, variant || null, notes || null).run();
            
            newQuantity = quantity;
            isNewItem = true;
        }

        await logEvent(env, 'CART_ADD', 
            `User ${user.id} added ${newQuantity}x ${product.name} (${productId}) to cart`, 
            user.id
        );

        return new Response(JSON.stringify({
            success: true,
            message: 'Added to cart',
            cartId,
            product: {
                id: product.id,
                name: product.name,
                quantity: newQuantity,
                price: product.price,
                wholesalePrice: product.wholesale_price
            },
            isNewItem
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error adding to cart:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: PUT /api/cart/update/:productId =====
// ================================================================

export async function handleUpdateCartItem(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const productId = pathSegments[pathSegments.length - 1];
        const body = await request.json();
        const { quantity, variant, notes } = body || {};

        if (!productId) {
            return new Response(JSON.stringify({ error: 'Product ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (quantity === undefined || quantity < 0) {
            return new Response(JSON.stringify({ error: 'Valid quantity is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Get cart item
        const cartItem = await env.DB.prepare(`
            SELECT id, product_id, quantity FROM cart 
            WHERE user_id = ? AND product_id = ? AND active = 1
        `).bind(user.id, productId).first();

        if (!cartItem) {
            return new Response(JSON.stringify({ error: 'Item not found in cart' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // If quantity is 0, remove the item
        if (quantity === 0) {
            await env.DB.prepare(`
                UPDATE cart SET active = 0, updated_at = unixepoch() 
                WHERE id = ?
            `).bind(cartItem.id).run();

            await logEvent(env, 'CART_REMOVE', 
                `User ${user.id} removed product ${productId} from cart`, user.id);

            return new Response(JSON.stringify({
                success: true,
                message: 'Item removed from cart'
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Validate stock for new quantity
        const stockValidation = await validateStock(env, productId, quantity);
        if (!stockValidation.valid) {
            return new Response(JSON.stringify({ 
                error: stockValidation.error,
                available: stockValidation.available || 0
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        await env.DB.prepare(`
            UPDATE cart 
            SET quantity = ?, variant = ?, notes = ?, updated_at = unixepoch()
            WHERE id = ?
        `).bind(quantity, variant || null, notes || null, cartItem.id).run();

        await logEvent(env, 'CART_UPDATE', 
            `User ${user.id} updated quantity to ${quantity} for product ${productId}`, user.id);

        return new Response(JSON.stringify({
            success: true,
            message: 'Cart updated',
            quantity
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error updating cart:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: DELETE /api/cart/remove/:productId =====
// ================================================================

export async function handleRemoveFromCart(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const productId = pathSegments[pathSegments.length - 1];

        if (!productId) {
            return new Response(JSON.stringify({ error: 'Product ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const result = await env.DB.prepare(`
            UPDATE cart SET active = 0, updated_at = unixepoch() 
            WHERE user_id = ? AND product_id = ? AND active = 1
        `).bind(user.id, productId).run();

        if (result.changes === 0) {
            return new Response(JSON.stringify({ error: 'Item not found in cart' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        await logEvent(env, 'CART_REMOVE', 
            `User ${user.id} removed product ${productId} from cart`, user.id);

        return new Response(JSON.stringify({
            success: true,
            message: 'Removed from cart'
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error removing from cart:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/cart/save/:productId =====
// ================================================================

export async function handleSaveForLater(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const productId = pathSegments[pathSegments.length - 1];

        if (!productId) {
            return new Response(JSON.stringify({ error: 'Product ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Get cart item
        const cartItem = await env.DB.prepare(`
            SELECT id, quantity, variant FROM cart 
            WHERE user_id = ? AND product_id = ? AND active = 1
        `).bind(user.id, productId).first();

        if (!cartItem) {
            return new Response(JSON.stringify({ error: 'Item not found in cart' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Remove from cart
        await env.DB.prepare(`
            UPDATE cart SET active = 0, updated_at = unixepoch() 
            WHERE id = ?
        `).bind(cartItem.id).run();

        // Check if already saved
        const existing = await env.DB.prepare(`
            SELECT id FROM cart_saved 
            WHERE user_id = ? AND product_id = ? AND active = 1
        `).bind(user.id, productId).first();

        if (existing) {
            await env.DB.prepare(`
                UPDATE cart_saved SET quantity = quantity + ?, updated_at = unixepoch() 
                WHERE id = ?
            `).bind(cartItem.quantity || 1, existing.id).run();
        } else {
            const savedId = generateId();
            await env.DB.prepare(`
                INSERT INTO cart_saved (
                    id, user_id, product_id, quantity, variant, active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())
            `).bind(savedId, user.id, productId, cartItem.quantity || 1, cartItem.variant || null).run();
        }

        await logEvent(env, 'CART_SAVE_FOR_LATER', 
            `User ${user.id} saved product ${productId} for later`, user.id);

        return new Response(JSON.stringify({
            success: true,
            message: 'Item saved for later'
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error saving for later:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/cart/move/:productId =====
// ================================================================

export async function handleMoveToCart(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const productId = pathSegments[pathSegments.length - 1];

        if (!productId) {
            return new Response(JSON.stringify({ error: 'Product ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Get saved item
        const savedItem = await env.DB.prepare(`
            SELECT id, quantity, variant FROM cart_saved 
            WHERE user_id = ? AND product_id = ? AND active = 1
        `).bind(user.id, productId).first();

        if (!savedItem) {
            return new Response(JSON.stringify({ error: 'Item not found in saved list' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Check stock
        const stockValidation = await validateStock(env, productId, savedItem.quantity);
        if (!stockValidation.valid) {
            return new Response(JSON.stringify({ 
                error: stockValidation.error,
                available: stockValidation.available || 0
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Remove from saved
        await env.DB.prepare(`
            UPDATE cart_saved SET active = 0, updated_at = unixepoch() 
            WHERE id = ?
        `).bind(savedItem.id).run();

        // Check if already in cart
        const existing = await env.DB.prepare(`
            SELECT id FROM cart 
            WHERE user_id = ? AND product_id = ? AND active = 1
        `).bind(user.id, productId).first();

        if (existing) {
            await env.DB.prepare(`
                UPDATE cart SET quantity = quantity + ?, updated_at = unixepoch() 
                WHERE id = ?
            `).bind(savedItem.quantity || 1, existing.id).run();
        } else {
            const cartId = generateId();
            await env.DB.prepare(`
                INSERT INTO cart (
                    id, user_id, product_id, quantity, variant, active, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())
            `).bind(cartId, user.id, productId, savedItem.quantity || 1, savedItem.variant || null).run();
        }

        await logEvent(env, 'CART_MOVE_TO_CART', 
            `User ${user.id} moved product ${productId} from saved to cart`, user.id);

        return new Response(JSON.stringify({
            success: true,
            message: 'Item moved to cart'
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error moving to cart:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: DELETE /api/cart/saved/remove/:productId =====
// ================================================================

export async function handleRemoveSavedItem(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const url = new URL(request.url);
        const pathSegments = url.pathname.split('/');
        const productId = pathSegments[pathSegments.length - 1];

        if (!productId) {
            return new Response(JSON.stringify({ error: 'Product ID is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const result = await env.DB.prepare(`
            UPDATE cart_saved SET active = 0, updated_at = unixepoch() 
            WHERE user_id = ? AND product_id = ? AND active = 1
        `).bind(user.id, productId).run();

        if (result.changes === 0) {
            return new Response(JSON.stringify({ error: 'Item not found in saved list' }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Item removed from saved list'
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error removing saved item:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/cart/bulk/add =====
// ================================================================

export async function handleBulkAddToCart(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const body = await request.json();
        const { products, clearExisting = false } = body || {};

        if (!products || !Array.isArray(products) || products.length === 0) {
            return new Response(JSON.stringify({ error: 'Products array is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (products.length > 20) {
            return new Response(JSON.stringify({ error: 'Maximum 20 products per bulk add' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (clearExisting) {
            await env.DB.prepare(`
                UPDATE cart SET active = 0, updated_at = unixepoch() 
                WHERE user_id = ? AND active = 1
            `).bind(user.id).run();
        }

        const results = [];
        const errors = [];
        let addedCount = 0;
        let updatedCount = 0;

        for (const item of products) {
            try {
                const { productId, quantity = 1, variant = null, notes = '' } = item;
                
                if (!productId) {
                    errors.push({ productId, error: 'Product ID is required' });
                    continue;
                }

                const stockValidation = await validateStock(env, productId, quantity);
                if (!stockValidation.valid) {
                    errors.push({ 
                        productId, 
                        error: stockValidation.error,
                        available: stockValidation.available || 0
                    });
                    continue;
                }

                const product = stockValidation.product;

                const existing = await env.DB.prepare(`
                    SELECT id, quantity FROM cart 
                    WHERE user_id = ? AND product_id = ? AND active = 1
                `).bind(user.id, productId).first();

                if (existing) {
                    const newQty = existing.quantity + quantity;
                    const stockCheck = await validateStock(env, productId, newQty);
                    if (!stockCheck.valid) {
                        errors.push({ 
                            productId, 
                            error: 'Insufficient stock for total quantity',
                            available: stockCheck.available || 0
                        });
                        continue;
                    }
                    await env.DB.prepare(`
                        UPDATE cart SET quantity = ?, updated_at = unixepoch() WHERE id = ?
                    `).bind(newQty, existing.id).run();
                    updatedCount++;
                    results.push({ productId, status: 'updated', quantity: newQty });
                } else {
                    const cartId = generateId();
                    await env.DB.prepare(`
                        INSERT INTO cart (
                            id, user_id, product_id, quantity, variant, notes, active, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())
                    `).bind(cartId, user.id, productId, quantity, variant || null, notes).run();
                    addedCount++;
                    results.push({ productId, status: 'added', quantity });
                }
            } catch (err) {
                errors.push({ productId: item.productId, error: err.message });
            }
        }

        await logEvent(env, 'CART_BULK_ADD', 
            `User ${user.id} bulk added ${addedCount} items, updated ${updatedCount} items`, user.id);

        return new Response(JSON.stringify({
            success: true,
            added: addedCount,
            updated: updatedCount,
            failed: errors.length,
            errors: errors.length > 0 ? errors : undefined,
            results
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error bulk adding to cart:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/cart/clear =====
// ================================================================

export async function handleClearCart(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const count = await env.DB.prepare(`
            SELECT COUNT(*) as total FROM cart 
            WHERE user_id = ? AND active = 1
        `).bind(user.id).first();

        await env.DB.prepare(`
            UPDATE cart SET active = 0, updated_at = unixepoch() 
            WHERE user_id = ? AND active = 1
        `).bind(user.id).run();

        await logEvent(env, 'CART_CLEAR', 
            `User ${user.id} cleared cart (${count?.total || 0} items)`, user.id);

        return new Response(JSON.stringify({
            success: true,
            message: 'Cart cleared',
            itemsRemoved: count?.total || 0
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error clearing cart:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/cart/sync =====
// ================================================================

export async function handleSyncCart(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const body = await request.json();
        const { localItems, mergeStrategy = 'merge' } = body || {};

        if (!localItems || !Array.isArray(localItems) || localItems.length === 0) {
            return new Response(JSON.stringify({ 
                success: true, 
                message: 'No items to sync',
                synced: 0,
                strategy: mergeStrategy
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        let synced = 0;
        const errors = [];

        if (mergeStrategy === 'replace') {
            await env.DB.prepare(`
                UPDATE cart SET active = 0, updated_at = unixepoch() 
                WHERE user_id = ? AND active = 1
            `).bind(user.id).run();
        }

        for (const item of localItems) {
            try {
                const { id: productId, quantity = 1, variant = null } = item;
                
                if (!productId) {
                    errors.push({ productId, error: 'Product ID is required' });
                    continue;
                }

                const product = await env.DB.prepare(`
                    SELECT id, stock FROM products WHERE id = ? AND active = 1
                `).bind(productId).first();

                if (!product) {
                    errors.push({ productId, error: 'Product not found' });
                    continue;
                }

                const existing = await env.DB.prepare(`
                    SELECT id, quantity FROM cart 
                    WHERE user_id = ? AND product_id = ? AND active = 1
                `).bind(user.id, productId).first();

                if (existing && mergeStrategy !== 'replace') {
                    const newQty = Math.min(existing.quantity + quantity, product.stock || 999);
                    await env.DB.prepare(`
                        UPDATE cart SET quantity = ?, updated_at = unixepoch() WHERE id = ?
                    `).bind(newQty, existing.id).run();
                } else {
                    const cartId = generateId();
                    const qty = Math.min(quantity, product.stock || 999);
                    await env.DB.prepare(`
                        INSERT INTO cart (
                            id, user_id, product_id, quantity, variant, active, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, 1, unixepoch(), unixepoch())
                    `).bind(cartId, user.id, productId, qty, variant || null).run();
                }
                synced++;
            } catch (err) {
                errors.push({ productId: item.id, error: err.message });
            }
        }

        await logEvent(env, 'CART_SYNC', 
            `User ${user.id} synced ${synced} items from local cart (strategy: ${mergeStrategy})`, user.id);

        return new Response(JSON.stringify({
            success: true,
            message: `Synced ${synced} items`,
            synced,
            errors: errors.length > 0 ? errors : undefined,
            strategy: mergeStrategy
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error syncing cart:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: GET /api/cart/stats =====
// ================================================================

export async function handleCartStats(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const total = await env.DB.prepare(`
            SELECT COUNT(*) as count, SUM(quantity) as items
            FROM cart 
            WHERE user_id = ? AND active = 1
        `).bind(user.id).first();

        const value = await env.DB.prepare(`
            SELECT SUM(p.price * c.quantity) as total
            FROM cart c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ? AND c.active = 1
        `).bind(user.id).first();

        const saved = await env.DB.prepare(`
            SELECT COUNT(*) as count
            FROM cart_saved 
            WHERE user_id = ? AND active = 1
        `).bind(user.id).first();

        const stats = {
            success: true,
            stats: {
                totalItems: total?.count || 0,
                totalQuantity: total?.items || 0,
                totalValue: Math.round(value?.total || 0),
                savedItems: saved?.count || 0,
                hasItems: (total?.count || 0) > 0,
                isEmpty: (total?.count || 0) === 0
            },
            timestamp: new Date().toISOString()
        };

        return new Response(JSON.stringify(stats), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error getting cart stats:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== HANDLER: POST /api/cart/discount =====
// ================================================================

export async function handleApplyDiscount(request, env, ctx, corsHeaders) {
    const user = request.user;
    if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        const body = await request.json();
        const { code, remove = false } = body || {};

        if (remove) {
            await env.DB.prepare(`
                UPDATE cart_discounts SET active = 0 
                WHERE user_id = ? AND active = 1
            `).bind(user.id).run();
            
            await logEvent(env, 'CART_DISCOUNT_REMOVED', 
                `User ${user.id} removed discount from cart`, user.id);

            return new Response(JSON.stringify({
                success: true,
                message: 'Discount removed'
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        if (!code) {
            return new Response(JSON.stringify({ error: 'Discount code is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Get cart items for subtotal calculation
        const items = await env.DB.prepare(`
            SELECT c.*, p.price, p.wholesale_price, p.weightKg
            FROM cart c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ? AND c.active = 1
        `).bind(user.id).all();

        if (!items.results || items.results.length === 0) {
            return new Response(JSON.stringify({ 
                error: 'Your cart is empty',
                code: 'EMPTY_CART'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Get user wholesale tier
        let wholesaleTier = null;
        const userData = await env.DB.prepare(
            `SELECT wholesale_tier FROM users WHERE id = ?`
        ).bind(user.id).first();
        if (userData && userData.wholesale_tier && userData.wholesale_tier !== 'standard') {
            wholesaleTier = userData.wholesale_tier;
        }

        // Calculate current totals
        const totals = calculateCartTotals(items.results, user, null, wholesaleTier);

        // Check if discount already applied
        const existingDiscount = await env.DB.prepare(`
            SELECT * FROM cart_discounts 
            WHERE user_id = ? AND active = 1
        `).bind(user.id).first();

        if (existingDiscount) {
            return new Response(JSON.stringify({ 
                error: 'A discount is already applied. Remove it first.',
                code: 'DISCOUNT_EXISTS',
                existing: existingDiscount.code
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Validate discount code
        const discount = await env.DB.prepare(`
            SELECT * FROM discount_codes 
            WHERE code = ? 
            AND active = 1 
            AND (expiry_date IS NULL OR expiry_date > unixepoch())
            AND (max_uses IS NULL OR times_used < max_uses)
            AND (min_amount IS NULL OR min_amount <= ?)
        `).bind(code.toUpperCase(), totals.adjustedSubtotal).first();

        if (!discount) {
            return new Response(JSON.stringify({ 
                error: 'Invalid or expired discount code',
                code: 'INVALID_DISCOUNT'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // Calculate discount amount
        let discountAmount = 0;
        let discountDescription = discount.description || '';

        if (discount.type === 'percentage') {
            discountAmount = Math.round(totals.adjustedSubtotal * (discount.value / 100));
            discountDescription = `${discount.value}% off`;
        } else if (discount.type === 'fixed') {
            discountAmount = Math.round(discount.value);
            discountDescription = `₦${discount.value.toLocaleString()} off`;
        } else if (discount.type === 'shipping') {
            discountAmount = 0;
            discountDescription = 'Free shipping';
        }

        // Apply discount
        const appliedId = generateId();
        await env.DB.prepare(`
            INSERT INTO cart_discounts (
                id, user_id, code, discount_id, amount, active, applied_at
            ) VALUES (?, ?, ?, ?, ?, 1, datetime('now'))
        `).bind(appliedId, user.id, code.toUpperCase(), discount.id, discountAmount).run();

        // Update usage count
        await env.DB.prepare(`
            UPDATE discount_codes SET times_used = times_used + 1 WHERE id = ?
        `).bind(discount.id).run();

        await logEvent(env, 'CART_DISCOUNT_APPLIED', 
            `User ${user.id} applied discount ${code} for ${discountAmount}`, user.id);

        return new Response(JSON.stringify({
            success: true,
            discount: {
                code: discount.code,
                type: discount.type,
                value: discount.value,
                amount: discountAmount,
                description: discountDescription,
                appliedAt: new Date().toISOString()
            },
            appliedId,
            cartTotal: totals.total,
            newTotal: Math.max(0, totals.total - discountAmount)
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        console.error('Error applying discount:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// ================================================================
// ===== EXPORT ALL HANDLERS =====
// ================================================================

export default {
    // Main cart operations
    handleGetCart,
    handleAddToCart,
    handleUpdateCartItem,
    handleRemoveFromCart,
    
    // Save for later
    handleSaveForLater,
    handleMoveToCart,
    handleRemoveSavedItem,
    
    // Bulk operations
    handleBulkAddToCart,
    handleClearCart,
    
    // Sync and utilities
    handleSyncCart,
    handleCartStats,
    handleApplyDiscount
};
