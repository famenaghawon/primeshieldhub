// ======================================================================
// PRODUCT HANDLERS
// ======================================================================
import { requireAuth } from '../middleware/auth.js';
import { logAudit } from '../utils/logging.js';
import { validateString, validateAmount, validateUUID } from '../utils/validation.js';
import { getCorsHeaders } from '../middleware/cors.js';
import { addSecurityHeaders } from '../middleware/security.js';

/**
 * Handle get all products
 */
export async function handleGetProducts(request, env, corsHeaders, requestInfo) {
  try {
    const url = new URL(request.url);
    const storeType = url.searchParams.get('store_type') || url.searchParams.get('store');
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    
    let query = `
      SELECT id, name, price, stock, category, description, 
             COALESCE(image_url, image) as image, 
             active, 
             COALESCE(wholesale_price, wholesalePrice) as wholesale_price, 
             COALESCE(wholesale_available, 0) as wholesale_available,
             store_type
      FROM products 
      WHERE (active = 1 OR active IS NULL)
    `;
    let params = [];
    
    // Filter by store type
    if (storeType) {
      query += " AND (store_type = ? OR store_type = 'both')";
      params.push(storeType);
    }
    
    // Filter by category
    if (category && category !== 'all' && category !== '') {
      query += " AND category = ?";
      params.push(category);
    }
    
    // Search by name or description
    if (search) {
      query += " AND (name LIKE ? OR description LIKE ?)";
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }
    
    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM products 
      WHERE (active = 1 OR active IS NULL)
    `;
    let countParams = [];
    
    if (storeType) {
      countQuery += " AND (store_type = ? OR store_type = 'both')";
      countParams.push(storeType);
    }
    if (category && category !== 'all' && category !== '') {
      countQuery += " AND category = ?";
      countParams.push(category);
    }
    if (search) {
      countQuery += " AND (name LIKE ? OR description LIKE ?)";
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern);
    }
    
    const countResult = await env.DB.prepare(countQuery).bind(...countParams).first();
    const total = countResult?.total || 0;
    
    // Add sorting
    const sortBy = url.searchParams.get('sort') || 'name';
    const sortOrder = url.searchParams.get('order') || 'ASC';
    const validSortColumns = ['name', 'price', 'stock', 'createdAt', 'updated_at'];
    const validOrders = ['ASC', 'DESC'];
    const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'name';
    const order = validOrders.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'ASC';
    
    query += ` ORDER BY ${sortColumn} ${order} LIMIT ? OFFSET ?`;
    params.push(limit, offset);
    
    const productsResult = await env.DB.prepare(query).bind(...params).all();
    const products = productsResult.results || [];

    // ===== FIX: Return structured response =====
    return addSecurityHeaders(new Response(JSON.stringify({
      success: true,
      products: products,
      total: total,
      limit: limit,
      offset: offset,
      store_type: storeType || 'all'
    }), {
      headers: { 
        'Content-Type': 'application/json', 
        ...corsHeaders,
        'Cache-Control': 'public, max-age=60'
      }
    }), requestInfo);
    
  } catch (error) {
    console.error('handleGetProducts error:', error);
    
    return addSecurityHeaders(new Response(JSON.stringify({
      success: false,
      products: [],
      total: 0,
      error: error.message || 'Failed to fetch products'
    }), {
      headers: { 
        'Content-Type': 'application/json', 
        ...corsHeaders 
      }
    }), requestInfo);
  }
}

/**
 * Handle create product (admin only)
 */
export async function handleCreateProduct(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized - Admin access required" }), {
      status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const name = validateString(body.name, 200);
    const price = validateAmount(body.price);
    const stock = typeof body.stock === 'number' ? Math.max(0, Math.floor(body.stock)) : 0;
    const category = validateString(body.category, 50);
    const description = validateString(body.description, 2000);
    const imageUrl = validateString(body.imageUrl, 500);
    const wholesalePrice = validateAmount(body.wholesalePrice);
    const wholesaleAvailable = body.wholesaleAvailable === true ? 1 : 0;
    const storeType = body.store_type || 'gadgets';

    if (!name || price === null) {
      return new Response(JSON.stringify({ error: "Invalid name or price" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const productId = crypto.randomUUID();
    const now = Date.now();

    await env.DB.prepare(
      "INSERT INTO products (id, name, price, stock, category, description, image_url, active, wholesale_price, wholesale_available, store_type, createdAt, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)"
    ).bind(
      productId, name, price, stock, category || null,
      description || null, imageUrl || null,
      wholesalePrice || null, wholesaleAvailable, storeType, now, now
    ).run();

    await logAudit(env, "PRODUCT_CREATED", user.id, "product", productId, {
      name, price
    }, ip, fingerprint);

    return new Response(JSON.stringify({ success: true, id: productId, message: "Product created successfully" }), {
      status: 201, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Database error: ' + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Handle update product (admin only)
 */
export async function handleUpdateProduct(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized - Admin access required" }), {
      status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const productId = url.pathname.split('/').pop();
    const body = await request.json();

    const existingQuery = await env.DB.prepare("SELECT id FROM products WHERE id = ?").bind(productId);
    const existingResult = await existingQuery.all();

    if (existingResult.results.length === 0) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const updates = [];
    const params = [];

    if (body.name !== undefined) {
      const name = validateString(body.name, 200);
      if (name) { updates.push("name = ?"); params.push(name); }
    }
    if (body.price !== undefined) {
      const price = validateAmount(body.price);
      if (price !== null) { updates.push("price = ?"); params.push(price); }
    }
    if (body.stock !== undefined) {
      const stock = typeof body.stock === 'number' ? Math.max(0, Math.floor(body.stock)) : null;
      if (stock !== null) { updates.push("stock = ?"); params.push(stock); }
    }
    if (body.category !== undefined) {
      const category = validateString(body.category, 50);
      if (category !== null) { updates.push("category = ?"); params.push(category); }
    }
    if (body.description !== undefined) {
      const description = validateString(body.description, 2000);
      if (description !== null) { updates.push("description = ?"); params.push(description); }
    }
    if (body.imageUrl !== undefined) {
      const imageUrl = validateString(body.imageUrl, 500);
      if (imageUrl !== null) { updates.push("image_url = ?"); params.push(imageUrl); }
    }
    if (body.active !== undefined) {
      updates.push("active = ?");
      params.push(body.active === true ? 1 : 0);
    }
    if (body.wholesalePrice !== undefined) {
      const wholesalePrice = validateAmount(body.wholesalePrice);
      if (wholesalePrice !== null) { updates.push("wholesale_price = ?"); params.push(wholesalePrice); }
    }
    if (body.wholesaleAvailable !== undefined) {
      updates.push("wholesale_available = ?");
      params.push(body.wholesaleAvailable === true ? 1 : 0);
    }
    if (body.store_type !== undefined) {
      updates.push("store_type = ?");
      params.push(body.store_type);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: "No valid fields to update" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    updates.push("updated_at = ?");
    params.push(Date.now());
    params.push(productId);

    await env.DB.prepare("UPDATE products SET " + updates.join(", ") + " WHERE id = ?").bind(...params).run();

    await logAudit(env, "PRODUCT_UPDATED", user.id, "product", productId, body, ip, fingerprint);

    return new Response(JSON.stringify({ success: true, message: "Product updated successfully" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Database error: ' + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}

/**
 * Handle delete product (admin only)
 */
export async function handleDeleteProduct(request, env, corsHeaders, ip, fingerprint) {
  const user = await requireAuth(request, env, ["admin"]);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized - Admin access required" }), {
      status: 403, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const productId = url.pathname.split('/').pop();

    const existingQuery = await env.DB.prepare("SELECT id, name FROM products WHERE id = ?").bind(productId);
    const existingResult = await existingQuery.all();

    if (existingResult.results.length === 0) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404, headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    await env.DB.prepare("UPDATE products SET active = 0, updated_at = ? WHERE id = ?")
      .bind(Date.now(), productId).run();

    await logAudit(env, "PRODUCT_DELETED", user.id, "product", productId, {
      name: existingResult.results[0].name
    }, ip, fingerprint);

    return new Response(JSON.stringify({ success: true, message: "Product deleted successfully" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Database error: ' + error.message }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
}
