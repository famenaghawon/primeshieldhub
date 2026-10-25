# API Reference

The PrimeShieldHub API is served via Cloudflare Workers. All endpoints return JSON.
Base URL (Production): https://api.primeshieldhub.com

## Authentication
Routes marked with [Auth Required] require a valid JWT in the Authorization: Bearer <token> header.

## Public Routes

### GET /api/products
Fetches the product catalog. Heavily cached via Cloudflare KV.

**Query Params:**
*   store (string): gadgets | buildmart (default: gadgets)
*   limit (int): Max items to return (default: 20)
*   category (string): Filter by category

**Response 200 OK:**
{
  "success": true,
  "products": [
    {
      "id": "psh-001",
      "name": "Apple iPhone 16 Pro Max",
      "price": 1850000,
      "image_url": "/assets/products/iphone-16.webp",
      "stock": 12
    }
  ]
}

### GET /api/products/:id
Fetch a single product by ID or slug.

## Checkout & Payments

### POST /api/paystack/init
Initializes a transaction. 

**Security Note:** The priceGuard engine validates the submitted item prices against D1 before this route proceeds. If prices do not match the DB, it returns 403 Forbidden.

**Body:**
{
  "cart": [
    { "id": "psh-001", "quantity": 1 }
  ],
  "email": "customer@example.com"
}

**Response 200 OK:**
{
  "success": true,
  "authorization_url": "https://checkout.paystack.com/..."
}

### POST /api/paystack/verify
Called by the frontend after the user returns from the Paystack checkout page.

**Body:**
{ "reference": "T123456789" }

## Protected Routes (Admin) [Auth Required]

### GET /api/admin/orders
Fetch all orders. Requires a valid JWT with role: "admin".

### POST /api/admin/products
Create a new product. Requires admin JWT.
