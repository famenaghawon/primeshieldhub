// ======================================================================
// CATEGORIES HANDLER - COMPLETE IMPLEMENTATION
// ======================================================================

import { logEvent, logAudit } from '../utils/logging.js';
import { requireAuth } from '../middleware/auth.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * ================================================================
 * CATEGORY DATA (STATIC - Predefined categories)
 * ================================================================
 */

const CATEGORIES_DATA = [
  // Electronics & Gadgets
  { id: 'smartphones', name: 'Smartphones', icon: 'fa-mobile-alt', description: 'Latest flagship and budget smartphones from top brands.', color: '#3b82f6', parent: null },
  { id: 'laptops', name: 'Laptops', icon: 'fa-laptop', description: 'Powerful laptops for work, gaming, and creativity.', color: '#10b981', parent: null },
  { id: 'tablets', name: 'Tablets', icon: 'fa-tablet-alt', description: 'Versatile tablets for productivity and entertainment.', color: '#8b5cf6', parent: null },
  { id: 'audio', name: 'Audio', icon: 'fa-headphones', description: 'Premium headphones, earbuds, and speakers.', color: '#ef4444', parent: null },
  { id: 'wearables', name: 'Wearables', icon: 'fa-watch', description: 'Smartwatches and fitness trackers.', color: '#f59e0b', parent: null },
  { id: 'accessories', name: 'Accessories', icon: 'fa-plug', description: 'Essential accessories for your devices.', color: '#6b7280', parent: null },
  { id: 'gaming', name: 'Gaming', icon: 'fa-gamepad', description: 'Gaming consoles, controllers, and accessories.', color: '#ec4899', parent: null },
  { id: 'cameras', name: 'Cameras', icon: 'fa-camera', description: 'Professional and hobbyist cameras.', color: '#14b8a6', parent: null },
  { id: 'drones', name: 'Drones', icon: 'fa-drone', description: 'Consumer and professional drones.', color: '#6366f1', parent: null },
  
  // Power & Energy
  { id: 'power', name: 'Power Banks', icon: 'fa-battery-full', description: 'Portable power banks and chargers.', color: '#22c55e', parent: null },
  { id: 'power-stations', name: 'Power Stations', icon: 'fa-charging-station', description: 'Portable power stations for off-grid use.', color: '#eab308', parent: null },
  { id: 'solar', name: 'Solar', icon: 'fa-solar-panel', description: 'Solar panels and solar accessories.', color: '#f97316', parent: null },
  { id: 'chargers', name: 'Chargers', icon: 'fa-charging-station', description: 'Chargers and charging cables.', color: '#8b5cf6', parent: null },
  
  // Smart Home
  { id: 'smart-home', name: 'Smart Home', icon: 'fa-home', description: 'Smart home devices and automation.', color: '#06b6d4', parent: null },
  { id: 'smart-lighting', name: 'Smart Lighting', icon: 'fa-lightbulb', description: 'Smart bulbs and lighting systems.', color: '#fcd34d', parent: null },
  { id: 'security', name: 'Security', icon: 'fa-shield-halved', description: 'Smart security cameras and systems.', color: '#ef4444', parent: 'smart-home' },
  
  // Display & Entertainment
  { id: 'monitors', name: 'Monitors', icon: 'fa-desktop', description: 'High-resolution monitors for work and gaming.', color: '#3b82f6', parent: null },
  { id: 'tvs', name: 'TVs', icon: 'fa-tv', description: 'Smart TVs and displays.', color: '#8b5cf6', parent: null },
  { id: 'projectors', name: 'Projectors', icon: 'fa-video', description: 'Portable and home projectors.', color: '#ec4899', parent: null },
  { id: 'streaming', name: 'Streaming', icon: 'fa-stream', description: 'Streaming devices and accessories.', color: '#f59e0b', parent: null },
  
  // Appliances & Furniture
  { id: 'appliances', name: 'Appliances', icon: 'fa-blender', description: 'Kitchen and home appliances.', color: '#14b8a6', parent: null },
  { id: 'furniture', name: 'Furniture', icon: 'fa-chair', description: 'Ergonomic furniture for home and office.', color: '#78716c', parent: null },
  
  // Lifestyle & Fitness
  { id: 'fitness', name: 'Fitness', icon: 'fa-heartbeat', description: 'Fitness equipment and wearables.', color: '#22c55e', parent: null },
  { id: 'outdoor', name: 'Outdoor', icon: 'fa-hiking', description: 'Outdoor gear and accessories.', color: '#f97316', parent: null },
  { id: 'personal-care', name: 'Personal Care', icon: 'fa-spa', description: 'Personal care and grooming products.', color: '#ec4899', parent: null },
  { id: 'health-tech', name: 'Health Tech', icon: 'fa-stethoscope', description: 'Health monitoring devices.', color: '#ef4444', parent: null },
  
  // Tech Components
  { id: 'pc-components', name: 'PC Components', icon: 'fa-microchip', description: 'PC components and upgrades.', color: '#6366f1', parent: null },
  { id: 'storage', name: 'Storage', icon: 'fa-hdd', description: 'External drives and storage solutions.', color: '#6b7280', parent: null },
  { id: 'networking', name: 'Networking', icon: 'fa-network-wired', description: 'Network routers and switches.', color: '#06b6d4', parent: null },
  
  // Specialized
  { id: 'car-electronics', name: 'Car Electronics', icon: 'fa-car', description: 'Car audio and electronics.', color: '#3b82f6', parent: null },
  { id: 'e-mobility', name: 'E-Mobility', icon: 'fa-bicycle', description: 'Electric scooters and bikes.', color: '#22c55e', parent: null },
  { id: 'instruments', name: 'Instruments', icon: 'fa-guitar', description: 'Musical instruments and gear.', color: '#8b5cf6', parent: null },
  { id: 'e-readers', name: 'E-Readers', icon: 'fa-book-reader', description: 'E-readers and digital notebooks.', color: '#f59e0b', parent: null },
  { id: 'vr-headsets', name: 'VR Headsets', icon: 'fa-vr-cardboard', description: 'Virtual reality headsets.', color: '#ec4899', parent: null },
  { id: 'kids-tech', name: 'Kids Tech', icon: 'fa-child', description: 'Technology for kids and learning.', color: '#f97316', parent: null },
  { id: 'pet-tech', name: 'Pet Tech', icon: 'fa-paw', description: 'Smart pet accessories.', color: '#14b8a6', parent: null },
  { id: 'stem-education', name: 'STEM Education', icon: 'fa-robot', description: 'STEM kits and educational toys.', color: '#6366f1', parent: null },
  { id: 'tools', name: 'Tools', icon: 'fa-tools', description: 'Power tools and hand tools.', color: '#78716c', parent: null },
  { id: 'office-tech', name: 'Office Tech', icon: 'fa-briefcase', description: 'Office technology and equipment.', color: '#3b82f6', parent: null }
];

/**
 * ================================================================
 * CATEGORY CRUD OPERATIONS
 * ================================================================
 */

/**
 * GET /api/categories
 * Get all categories with product counts and metadata
 * FIXED: Simplified query to avoid D1 parameter binding issues
 */
export async function handleGetCategories(request, env, ctx, corsHeaders) {
  try {
    const url = new URL(request.url);
    const includeProducts = url.searchParams.get('includeProducts') === 'true';
    const parent = url.searchParams.get('parent');
    const limit = parseInt(url.searchParams.get('limit')) || 100;
    const offset = parseInt(url.searchParams.get('offset')) || 0;

    // FIXED: Build WHERE clause separately
    let whereClause = '';
    const params = [];
    
    if (parent === 'null' || parent === null) {
      whereClause = 'WHERE c.parent_id IS NULL';
    } else if (parent) {
      whereClause = 'WHERE c.parent_id = ?';
      params.push(parent);
    }

    // Get categories
    const result = await env.DB.prepare(`
      SELECT c.* FROM categories c
      ${whereClause}
      ORDER BY c.display_order ASC, c.name ASC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all();
    
    const categories = result.results || [];

    // Get product counts per category (separate queries to avoid complex JOIN issues)
    for (const cat of categories) {
      const countResult = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM products WHERE category = ? AND active = 1"
      ).bind(cat.id).first();
      cat.product_count = countResult?.count || 0;
      cat.active_product_count = countResult?.count || 0;
      
      const totalResult = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM products WHERE category = ?"
      ).bind(cat.id).first();
      cat.total_products = totalResult?.count || 0;
    }

    // Get products per category if requested
    let categoryProducts = {};
    if (includeProducts) {
      const products = await env.DB.prepare(
        "SELECT p.*, p.category as category_id FROM products p WHERE p.active = 1 ORDER BY p.created_at DESC"
      ).all();
      categoryProducts = (products.results || []).reduce((acc, p) => {
        if (!acc[p.category_id]) acc[p.category_id] = [];
        acc[p.category_id].push(p);
        return acc;
      }, {});
    }

    return new Response(JSON.stringify({
      success: true,
      categories: categories,
      total: categories.length,
      limit: limit,
      offset: offset,
      products: includeProducts ? categoryProducts : undefined,
      stats: {
        totalCategories: categories.length,
        totalProducts: categories.reduce((sum, c) => sum + (c.product_count || 0), 0)
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * GET /api/categories/tree
 * Get categories as hierarchical tree
 */
export async function handleGetCategoryTree(request, env, ctx, corsHeaders) {
  try {
    // Get all categories
    const result = await env.DB.prepare(`
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category = c.id AND p.active = 1
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `).all();

    const categories = result.results || [];

    // Build tree structure
    const tree = [];
    const map = {};

    // First pass: create map
    categories.forEach(cat => {
      map[cat.id] = { 
        ...cat, 
        children: [],
        product_count: parseInt(cat.product_count) || 0
      };
    });

    // Second pass: build tree
    categories.forEach(cat => {
      if (cat.parent_id && map[cat.parent_id]) {
        map[cat.parent_id].children.push(map[cat.id]);
      } else {
        tree.push(map[cat.id]);
      }
    });

    return new Response(JSON.stringify({
      success: true,
      tree: tree,
      flat: categories,
      stats: {
        totalCategories: categories.length,
        rootCategories: tree.length
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error fetching category tree:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * GET /api/categories/:id
 * Get single category with products
 */
export async function handleGetCategory(request, env, ctx, corsHeaders) {
  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/')[3];
    const includeProducts = url.searchParams.get('includeProducts') === 'true';

    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get category
    const category = await env.DB.prepare(`
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as product_count,
        (
          SELECT COUNT(*) 
          FROM products p2 
          WHERE p2.category = c.id 
        ) as total_products
      FROM categories c
      LEFT JOIN products p ON p.category = c.id AND p.active = 1
      WHERE c.id = ?
      GROUP BY c.id
    `).bind(id).first();

    if (!category) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Get products in category
    let products = [];
    if (includeProducts) {
      const productResult = await env.DB.prepare(`
        SELECT * FROM products 
        WHERE category = ? AND active = 1
        ORDER BY created_at DESC
        LIMIT 20
      `).bind(id).all();
      products = productResult.results || [];
    }

    // Get subcategories
    const subcategories = await env.DB.prepare(`
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category = c.id AND p.active = 1
      WHERE c.parent_id = ?
      GROUP BY c.id
      ORDER BY c.display_order ASC, c.name ASC
    `).bind(id).all();

    return new Response(JSON.stringify({
      success: true,
      category: category,
      subcategories: subcategories.results || [],
      products: products,
      productCount: category.product_count || 0
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * POST /api/categories
 * Create new category (Admin only)
 */
export async function handleCreateCategory(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Admin only' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const body = await request.json();
    const { name, description, icon, color, parent_id, display_order } = body || {};

    if (!name) {
      return new Response(JSON.stringify({ error: 'Category name is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if category already exists
    const existing = await env.DB.prepare(
      'SELECT id FROM categories WHERE LOWER(name) = LOWER(?)'
    ).bind(name).first();

    if (existing) {
      return new Response(JSON.stringify({ error: 'Category already exists' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const id = uuidv4();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    await env.DB.prepare(`
      INSERT INTO categories (
        id, name, slug, description, icon, color, parent_id, display_order, active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `).bind(id, name, slug, description || null, icon || null, color || null, parent_id || null, display_order || 0).run();

    await logEvent(env, 'CATEGORY_CREATED', 
      `Admin ${user.id} created category ${name}`, user.id);
    await logAudit(env, 'CATEGORY_CREATED', user.id, 'admin', user.id, {
      categoryId: id,
      name: name,
      slug: slug
    }, null, null);

    const newCategory = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Category created successfully',
      category: newCategory
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * PUT /api/categories/:id
 * Update category (Admin only)
 */
export async function handleUpdateCategory(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Admin only' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/')[3];
    const body = await request.json();
    const { name, description, icon, color, parent_id, display_order, active } = body || {};

    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if category exists
    const existing = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Build update query
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      updates.push('slug = ?');
      values.push(slug);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (parent_id !== undefined) {
      updates.push('parent_id = ?');
      values.push(parent_id);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(display_order);
    }
    if (active !== undefined) {
      updates.push('active = ?');
      values.push(active ? 1 : 0);
    }

    if (updates.length === 0) {
      return new Response(JSON.stringify({ error: 'No fields to update' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(id);

    await env.DB.prepare(`
      UPDATE categories SET ${updates.join(', ')} WHERE id = ?
    `).bind(...values).run();

    await logEvent(env, 'CATEGORY_UPDATED', 
      `Admin ${user.id} updated category ${id}`, user.id);

    const updated = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();

    return new Response(JSON.stringify({
      success: true,
      message: 'Category updated successfully',
      category: updated
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error updating category:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * DELETE /api/categories/:id
 * Delete category (Admin only)
 */
export async function handleDeleteCategory(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Admin only' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.pathname.split('/')[3];

    if (!id) {
      return new Response(JSON.stringify({ error: 'Category ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if category exists
    const existing = await env.DB.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
    if (!existing) {
      return new Response(JSON.stringify({ error: 'Category not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if there are products in this category
    const products = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM products WHERE category = ? AND active = 1'
    ).bind(id).first();

    if (products && products.count > 0) {
      return new Response(JSON.stringify({ 
        error: 'Cannot delete category with active products. Move products first.',
        productCount: products.count
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Check if there are subcategories
    const subcategories = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM categories WHERE parent_id = ? AND active = 1'
    ).bind(id).first();

    if (subcategories && subcategories.count > 0) {
      return new Response(JSON.stringify({ 
        error: 'Cannot delete category with subcategories. Remove or reassign subcategories first.',
        subcategoryCount: subcategories.count
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Delete category
    await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();

    await logEvent(env, 'CATEGORY_DELETED', 
      `Admin ${user.id} deleted category ${existing.name}`, user.id);
    await logAudit(env, 'CATEGORY_DELETED', user.id, 'admin', user.id, {
      categoryId: id,
      name: existing.name
    }, null, null);

    return new Response(JSON.stringify({
      success: true,
      message: 'Category deleted successfully'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * ================================================================
 * CATEGORY STATISTICS
 * ================================================================
 */

/**
 * GET /api/categories/stats
 * Get category statistics
 */
export async function handleCategoryStats(request, env, ctx, corsHeaders) {
  try {
    // Total categories
    const total = await env.DB.prepare('SELECT COUNT(*) as count FROM categories').first();

    // Categories with products
    const withProducts = await env.DB.prepare(`
      SELECT COUNT(DISTINCT c.id) as count
      FROM categories c
      JOIN products p ON p.category = c.id
      WHERE p.active = 1
    `).first();

    // Categories without products
    const withoutProducts = await env.DB.prepare(`
      SELECT COUNT(*) as count
      FROM categories c
      WHERE NOT EXISTS (
        SELECT 1 FROM products p 
        WHERE p.category = c.id AND p.active = 1
      )
    `).first();

    // Product count by category
    const productCounts = await env.DB.prepare(`
      SELECT 
        c.id,
        c.name,
        COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category = c.id AND p.active = 1
      GROUP BY c.id
      ORDER BY product_count DESC
      LIMIT 20
    `).all();

    // Top categories by product count
    const topCategories = await env.DB.prepare(`
      SELECT 
        c.id,
        c.name,
        c.icon,
        c.color,
        COUNT(p.id) as product_count
      FROM categories c
      JOIN products p ON p.category = c.id AND p.active = 1
      GROUP BY c.id
      ORDER BY product_count DESC
      LIMIT 10
    `).all();

    return new Response(JSON.stringify({
      success: true,
      stats: {
        totalCategories: total?.count || 0,
        categoriesWithProducts: withProducts?.count || 0,
        categoriesWithoutProducts: withoutProducts?.count || 0,
        topCategories: topCategories.results || [],
        productCounts: productCounts.results || []
      }
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error getting category stats:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * POST /api/categories/seed
 * Seed default categories (Admin only)
 */
export async function handleSeedCategories(request, env, ctx, corsHeaders) {
  const user = await requireAuth(request, env, ['admin']);
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized - Admin only' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }

  try {
    let inserted = 0;
    let existing = 0;

    for (const cat of CATEGORIES_DATA) {
      // Check if exists
      const exists = await env.DB.prepare(
        'SELECT id FROM categories WHERE id = ? OR LOWER(name) = LOWER(?)'
      ).bind(cat.id, cat.name).first();

      if (exists) {
        existing++;
        continue;
      }

      await env.DB.prepare(`
        INSERT INTO categories (
          id, name, slug, description, icon, color, parent_id, active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `).bind(
        cat.id,
        cat.name,
        cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        cat.description,
        cat.icon,
        cat.color,
        cat.parent || null
      ).run();
      inserted++;
    }

    await logEvent(env, 'CATEGORIES_SEEDED', 
      `Admin ${user.id} seeded ${inserted} categories`, user.id);

    return new Response(JSON.stringify({
      success: true,
      message: `Seeded ${inserted} categories, ${existing} already existed`,
      inserted: inserted,
      existing: existing,
      total: CATEGORIES_DATA.length
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  } catch (error) {
    console.error('Error seeding categories:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
}

/**
 * ================================================================
 * EXPORT ALL HANDLERS
 * ================================================================
 */

export default {
  handleGetCategories,
  handleGetCategoryTree,
  handleGetCategory,
  handleCreateCategory,
  handleUpdateCategory,
  handleDeleteCategory,
  handleCategoryStats,
  handleSeedCategories
};
