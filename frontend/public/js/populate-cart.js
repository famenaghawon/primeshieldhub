// ============================================================================
// populate-cart-store.js — Demo Cart Populator (Cloudflare Version)
// Can be triggered from console OR via URL parameter ?demo=cart
// ============================================================================

const demoProducts = [
  {
    id: 'iphone15-pro-max',
    name: 'iPhone 15 Pro Max',
    description: '256GB – Titanium Black',
    price: 1850000,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=800&q=80',
    category: 'Smartphones',
    warranty: '2-Year Manufacturer Warranty',
    inStock: true
  },
  {
    id: 'macbook-pro-m3',
    name: 'MacBook Pro M3',
    description: '14" – 1TB SSD – Space Black',
    price: 3850000,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=80',
    category: 'Laptops',
    warranty: '3-Year AppleCare+',
    inStock: true
  },
  {
    id: 'airpods-pro-2',
    name: 'AirPods Pro 2nd Gen (USB-C)',
    description: 'Active Noise Cancellation',
    price: 320000,
    quantity: 2,
    image: 'https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?auto=format&fit=crop&w=800&q=80',
    category: 'Audio Devices',
    warranty: '1-Year Manufacturer Warranty',
    inStock: true
  },
  {
    id: 'samsung-s24-ultra',
    name: 'Samsung Galaxy S24 Ultra',
    description: '512GB – Titanium Gray',
    price: 1650000,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=800&q=80',
    category: 'Smartphones',
    warranty: '2-Year Manufacturer Warranty',
    inStock: true
  },
  {
    id: null,
    name: 'Apple Watch Ultra 2',
    description: '49mm – Ocean Band',
    price: 1200000,
    quantity: 1,
    image: 'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?auto=format&fit=crop&w=800&q=80',
    category: 'Wearables',
    warranty: '1-Year Manufacturer Warranty',
    inStock: true
  }
];

/**
 * Populate cart with demo items
 * @param {number} itemCount - Number of items to add (1-5)
 */
export function populateDemoCart(itemCount = 3) {
  const items = demoProducts.slice(0, Math.min(itemCount, demoProducts.length));
  
  // Save to localStorage in the format cart-store.js expects
  localStorage.setItem('psh_cart', JSON.stringify(items));
  
  // Dispatch the CORRECT event name that cart-store.js listens for
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: items }));
  
  // Also dispatch a general event
  window.dispatchEvent(new CustomEvent('cartUpdated'));
  
  // Update any visible cart count elements
  updateCartCountDisplay(items);
  
  console.log(`?? Cart populated with ${items.length} demo items:`);
  console.table(items.map(i => ({ name: i.name, price: '?' + i.price.toLocaleString(), qty: i.quantity })));
  
  // Reload cart if CartManager is available
  if (window.cart && typeof window.cart.load === 'function') {
    window.cart.load();
  }
  
  return items;
}

/**
 * Clear the demo cart
 */
export function clearDemoCart() {
  localStorage.removeItem('psh_cart');
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: [] }));
  window.dispatchEvent(new CustomEvent('cartUpdated'));
  
  document.querySelectorAll('.cart-count, #cartCount').forEach(el => {
    el.textContent = '0';
    el.style.display = 'none';
  });
  
  console.log('??? Cart cleared');
}

/**
 * Add a single demo product by ID
 */
export function addDemoProduct(productId) {
  const product = demoProducts.find(p => p.id === productId);
  if (!product) {
    console.warn(`Product "${productId}" not found in demo catalog`);
    return null;
  }
  
  // Get existing cart
  let cart = [];
  try {
    cart = JSON.parse(localStorage.getItem('psh_cart') || '[]');
  } catch (e) {
    cart = [];
  }
  
  // Check if already in cart
  const existing = cart.find(i => i.id === productId);
  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  
  localStorage.setItem('psh_cart', JSON.stringify(cart));
  window.dispatchEvent(new CustomEvent('cart:updated', { detail: cart }));
  updateCartCountDisplay(cart);
  
  console.log(`? Added "${product.name}" to cart`);
  return cart;
}

function updateCartCountDisplay(items) {
  const totalItems = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
  document.querySelectorAll('.cart-count, #cartCount').forEach(el => {
    el.textContent = totalItems;
    el.style.display = totalItems > 0 ? 'inline' : 'none';
  });
}

// ==================== AUTO-TRIGGER VIA URL PARAMETER ====================
// Add ?demo=cart to any URL to auto-populate the cart
if (window.location.search.includes('demo=cart')) {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => populateDemoCart(3), 1000);
  });
}

// ==================== EXPOSE TO CONSOLE ====================
// Makes these available in browser console for testing
window.demoCart = {
  populate: populateDemoCart,
  clear: clearDemoCart,
  add: addDemoProduct,
  products: demoProducts
};

console.log('?? Demo cart tools ready! Try: demoCart.populate(3) or demoCart.add("airpods-pro-2")');

