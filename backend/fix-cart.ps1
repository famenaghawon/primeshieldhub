# fix-cart.ps1
# This script adds the missing cart endpoints to index.js

Write-Host "🔧 Fixing Cart Endpoints..." -ForegroundColor Cyan

# Path to your index.js file
$indexFilePath = "src/index.js"

# Check if file exists
if (-not (Test-Path $indexFilePath)) {
    Write-Host "❌ File not found: $indexFilePath" -ForegroundColor Red
    Write-Host "Make sure you're in the correct directory" -ForegroundColor Yellow
    exit 1
}

Write-Host "📁 Found index.js at: $indexFilePath" -ForegroundColor Green

# Read the file
$content = Get-Content $indexFilePath -Raw

# Check if endpoints already exist
if ($content -match "/api/cart/remove/") {
    Write-Host "✅ Cart remove endpoint already exists" -ForegroundColor Green
} else {
    Write-Host "📝 Adding cart remove endpoint..." -ForegroundColor Yellow
    
    # Find the cart routes section and insert the new endpoints after it
    $newEndpoints = @'

// ======================================================================
// ADDITIONAL CART ENDPOINTS - FOR FRONTEND COMPATIBILITY
// ======================================================================

// DELETE /api/cart/remove/:itemId - Remove item from cart (frontend compatibility)
if (routePath.match(/^\/api\/cart\/remove\/[^\/]+$/) && request.method === "DELETE") {
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
    console.error('[Cart] Remove error:', error);
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

// DELETE /api/cart - Clear all cart (frontend compatibility)
if (routePath === "/api/cart" && request.method === "DELETE") {
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
      message: "Cart cleared",
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

// ======================================================================
// CART SYNC - UPDATED TO HANDLE MULTIPLE FORMATS
// ======================================================================

// POST /api/cart/sync - Updated to handle multiple body formats
if (routePath === "/api/cart/sync" && request.method === "POST") {
  try {
    const user = await requireAuth(request, env, ["user", "admin", "staff"]);
    const userId = user?.id || null;
    const body = await request.json();
    
    let items = body.items || body || [];
    
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (e) {
        items = [];
      }
    }
    
    if (!Array.isArray(items)) {
      if (body.cart && Array.isArray(body.cart)) {
        items = body.cart;
      } else if (body.cart && body.cart.items && Array.isArray(body.cart.items)) {
        items = body.cart.items;
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: "Items array required"
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
    
    if (!userId) {
      return new Response(JSON.stringify({
        success: true,
        message: "Guest cart sync skipped"
      }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
          ...corsHeaders
        }
      });
    }
    
    const now = Math.floor(Date.now() / 1000);
    
    const existingItems = await env.DB.prepare(
      "SELECT id, product_id FROM cart WHERE user_id = ? AND active = 1"
    ).bind(userId).all();
    
    const existingMap = {};
    for (const item of (existingItems.results || [])) {
      existingMap[item.product_id] = item.id;
    }
    
    const processedProducts = new Set();
    
    for (const item of items) {
      const productId = item.productId || item.product_id || item.id;
      const quantity = item.quantity || 1;
      const variant = item.variant || null;
      const notes = item.notes || null;
      
      if (!productId) continue;
      
      processedProducts.add(productId);
      
      if (existingMap[productId]) {
        await env.DB.prepare(
          "UPDATE cart SET quantity = ?, variant = ?, notes = ?, updated_at = ? WHERE id = ?"
        ).bind(quantity, variant, notes, now, existingMap[productId]).run();
      } else {
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO cart (id, user_id, product_id, quantity, variant, notes, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)"
        ).bind(id, userId, productId, quantity, variant, notes, now, now).run();
      }
    }
    
    for (const productId of Object.keys(existingMap)) {
      if (!processedProducts.has(productId)) {
        await env.DB.prepare(
          "DELETE FROM cart WHERE id = ? AND user_id = ?"
        ).bind(existingMap[productId], userId).run();
      }
    }
    
    const cartItems = await env.DB.prepare(
      "SELECT id, product_id, quantity FROM cart WHERE user_id = ? AND active = 1"
    ).bind(userId).all();
    
    let total = 0;
    let count = 0;
    for (const item of (cartItems.results || [])) {
      total += item.quantity || 0;
      count += item.quantity || 0;
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: "Cart synced successfully",
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
    console.error('[Cart] Sync error:', error);
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
'@

    # Find the CART ROUTES section and insert after it
    $pattern = '(?<=// ======================================================================\s*// CART ROUTES - FIXED FOR YOUR DATABASE STRUCTURE\s*// ======================================================================.*?)(?=// ======================================================================)'
    
    if ($content -match $pattern) {
        # Insert after the existing cart routes section
        $newContent = $content -replace $pattern, "`$&`n$newEndpoints`n"
        Set-Content -Path $indexFilePath -Value $newContent
        Write-Host "✅ Added new cart endpoints to index.js" -ForegroundColor Green
    } else {
        # If pattern not found, try to insert after a known marker
        $pattern2 = '(?<=// ======================================================================\s*// ORDERS ROUTES.*?// ======================================================================)'
        if ($content -match $pattern2) {
            $newContent = $content -replace $pattern2, "`$&`n$newEndpoints`n"
            Set-Content -Path $indexFilePath -Value $newContent
            Write-Host "✅ Added new cart endpoints after ORDERS section" -ForegroundColor Green
        } else {
            Write-Host "⚠️ Could not find cart section. Appending to end of file..." -ForegroundColor Yellow
            # Append to end before the 404 handler
            $newContent = $content -replace '(?=// ======================================================================\s*// 404 HANDLING)', "$newEndpoints`n`n`$&"
            Set-Content -Path $indexFilePath -Value $newContent
            Write-Host "✅ Appended new cart endpoints" -ForegroundColor Green
        }
    }
}

Write-Host "`n📦 Deploying to Cloudflare Workers..." -ForegroundColor Cyan

# Deploy the worker
npx wrangler deploy

Write-Host "`n✅ Done! Cart endpoints should now work." -ForegroundColor Green
Write-Host "🔄 Clear browser cache and reload the page." -ForegroundColor Yellow
