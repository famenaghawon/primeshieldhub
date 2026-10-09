// src/handlers/receipts.js
// RECEIPT GENERATION & DOWNLOAD
// Integrated from api/receipt/download.js

/**
 * Generate receipt HTML for download/print
 */
export async function handleReceiptDownload(request, env, ctx) {
  const allowedOrigins = [
    "https://primeshieldhub.com",
    "https://www.primeshieldhub.com",
    "http://localhost:8787",
    "http://localhost:5173"
  ];
  
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
  };

  // OPTIONS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers
    });
  }
  
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON body' }), {
        status: 400, headers
      });
    }
    
    const { reference } = body;
    
    if (!reference || typeof reference !== 'string' || reference.length > 100) {
      return new Response(JSON.stringify({ success: false, error: 'Valid reference required' }), {
        status: 400, headers
      });
    }
    
    if (!env.DB) {
      return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
        status: 500, headers
      });
    }
    
    // Try to get transaction from both tables
    let transaction = await env.DB.prepare(`
      SELECT * FROM transactions WHERE reference = ?
    `).bind(reference).first();
    
    // If not in transactions, try orders table
    if (!transaction) {
      const order = await env.DB.prepare(`
        SELECT 
          reference,
          amount,
          email,
          customerName as customer_name,
          customerPhone as phone,
          status,
          createdAt,
          paystack_data
        FROM orders WHERE reference = ?
      `).bind(reference).first();
      
      if (order) {
        transaction = order;
      }
    }
    
    if (!transaction) {
      return new Response(JSON.stringify({ success: false, error: 'Transaction not found' }), {
        status: 404, headers
      });
    }
    
    // Parse metadata if stored as JSON string
    let metadata = {};
    if (transaction.paystack_data) {
      try {
        metadata = typeof transaction.paystack_data === 'string' 
          ? JSON.parse(transaction.paystack_data) 
          : transaction.paystack_data;
      } catch {}
    }
    
    // Build enriched transaction data
    const receiptData = {
      reference: transaction.reference,
      amount: transaction.amount,
      customer_name: transaction.customer_name || metadata.customer_name || metadata.customer?.name || 'Customer',
      email: transaction.email || metadata.customer?.email || '',
      phone: transaction.phone || metadata.customer?.phone || '',
      status: transaction.status || 'completed',
      createdAt: transaction.createdAt || Date.now(),
      paid_at: metadata.paid_at || transaction.createdAt,
      channel: metadata.channel || 'online',
      description: metadata.description || 'Purchase',
      currency: metadata.currency || 'NGN'
    };
    
    // Generate receipt HTML
    const pdfHtml = generateReceiptHTML(receiptData);
    
    return new Response(JSON.stringify({
      success: true,
      html: pdfHtml,
      transaction: receiptData
    }), { status: 200, headers });
    
  } catch (error) {
    console.error('Receipt generation error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to generate receipt' 
    }), {
      status: 500, headers
    });
  }
}

/**
 * Generate formatted receipt HTML
 */
function generateReceiptHTML(data) {
  const formattedAmount = typeof data.amount === 'number' 
    ? data.amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : data.amount;
  
  const formattedDate = data.createdAt 
    ? new Date(data.createdAt).toLocaleString('en-NG', { 
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : 'N/A';
  
  const statusColor = data.status === 'completed' ? '#00aa88' : 
                       data.status === 'failed' ? '#e74c3c' : 
                       data.status === 'disputed' ? '#f39c12' : '#666';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt - ${data.reference}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      padding: 40px 20px;
      background: #f5f5f5;
      color: #333;
    }
    .receipt { 
      max-width: 750px; 
      margin: 0 auto; 
      background: #fff;
      border-radius: 12px;
      box-shadow: 0 2px 20px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .receipt-header { 
      background: linear-gradient(135deg, #00aa88, #00cc88);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .receipt-logo { 
      font-size: 28px; 
      font-weight: 800; 
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .receipt-subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .receipt-body { padding: 30px; }
    .status-badge {
      display: inline-block;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      background: ${statusColor}22;
      color: ${statusColor};
      border: 1px solid ${statusColor}44;
      margin-bottom: 20px;
    }
    .detail-row { 
      display: flex; 
      justify-content: space-between; 
      align-items: center;
      padding: 14px 0; 
      border-bottom: 1px solid #f0f0f0;
    }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { 
      font-size: 13px; 
      color: #888; 
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .detail-value { 
      font-size: 14px; 
      color: #333; 
      font-weight: 500;
      text-align: right;
      max-width: 60%;
      word-break: break-word;
    }
    .amount-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 2px solid #333;
    }
    .amount-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .amount-label {
      font-size: 16px;
      font-weight: 700;
      color: #333;
    }
    .amount-value {
      font-size: 24px;
      font-weight: 800;
      color: #00aa88;
    }
    .receipt-footer { 
      text-align: center; 
      padding: 20px 30px;
      background: #fafafa;
      border-top: 1px solid #f0f0f0;
      font-size: 12px; 
      color: #999;
      line-height: 1.6;
    }
    .receipt-footer strong { color: #666; }
    .print-button {
      display: block;
      width: 200px;
      margin: 30px auto 10px;
      padding: 12px;
      background: #00aa88;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-align: center;
    }
    .print-button:hover { background: #009977; }
    @media print {
      body { background: white; padding: 0; }
      .receipt { box-shadow: none; border-radius: 0; }
      .print-button { display: none; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="receipt-header">
      <div class="receipt-logo">PRIMESHIELDHUB</div>
      <div class="receipt-subtitle">Official Payment Receipt</div>
    </div>
    
    <div class="receipt-body">
      <div class="status-badge">${data.status.toUpperCase()}</div>
      
      <div class="detail-row">
        <span class="detail-label">Transaction ID</span>
        <span class="detail-value">${data.reference}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Date</span>
        <span class="detail-value">${formattedDate}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Customer</span>
        <span class="detail-value">${escapeHtml(data.customer_name)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Email</span>
        <span class="detail-value">${escapeHtml(data.email)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Phone</span>
        <span class="detail-value">${escapeHtml(data.phone || 'N/A')}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Payment Method</span>
        <span class="detail-value">${data.channel || 'Online'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Description</span>
        <span class="detail-value">${escapeHtml(data.description || 'Purchase')}</span>
      </div>
      
      <div class="amount-section">
        <div class="amount-row">
          <span class="amount-label">Total Amount</span>
          <span class="amount-value">₦${formattedAmount}</span>
        </div>
      </div>
    </div>
    
    <div class="receipt-footer">
      <p>Thank you for choosing <strong>PrimeShieldHub</strong></p>
      <p>This is an official system-generated receipt.</p>
      <p style="margin-top: 8px;">For inquiries, contact support@primeshieldhub.com</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Escape HTML to prevent XSS in receipt
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==================== RECEIPT BY REFERENCE (GET) ====================
/**
 * Get receipt directly by reference (GET endpoint for links)
 */
export async function handleReceiptByReference(request, env, ctx) {
  const allowedOrigins = [
    "https://primeshieldhub.com",
    "https://www.primeshieldhub.com",
    "http://localhost:8787",
    "http://localhost:5173"
  ];
  
  const origin = request.headers.get("Origin") || "";
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload"
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (request.method !== "GET") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers
    });
  }

  const url = new URL(request.url);
  const reference = url.searchParams.get('reference') || url.pathname.split('/').pop();
  
  if (!reference || reference.length > 100) {
    return new Response(JSON.stringify({ success: false, error: 'Valid reference required' }), {
      status: 400, headers
    });
  }

  if (!env.DB) {
    return new Response(JSON.stringify({ success: false, error: 'Database not available' }), {
      status: 500, headers
    });
  }

  try {
    // Try both tables
    let transaction = await env.DB.prepare(
      "SELECT * FROM transactions WHERE reference = ?"
    ).bind(reference).first();

    if (!transaction) {
      const order = await env.DB.prepare(`
        SELECT 
          reference, amount, email, 
          customerName as customer_name, 
          customerPhone as phone, 
          status, createdAt, paystack_data
        FROM orders WHERE reference = ?
      `).bind(reference).first();
      
      if (order) transaction = order;
    }

    if (!transaction) {
      return new Response(JSON.stringify({ success: false, error: 'Transaction not found' }), {
        status: 404, headers
      });
    }

    return new Response(JSON.stringify({
      success: true,
      transaction: {
        reference: transaction.reference,
        amount: transaction.amount,
        customer_name: transaction.customer_name || 'Customer',
        email: transaction.email || '',
        phone: transaction.phone || '',
        status: transaction.status || 'completed',
        createdAt: transaction.createdAt
      }
    }), { status: 200, headers });

  } catch (error) {
    console.error('Receipt fetch error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Failed to fetch receipt' }), {
      status: 500, headers
    });
  }
}

// ==================== OPTIONS HANDLERS ====================
export async function handleReceiptDownloadOptions(request) {
  return createOptionsResponse(['POST']);
}

export async function handleReceiptByRefOptions(request) {
  return createOptionsResponse(['GET']);
}

function createOptionsResponse(methods) {
  const allowedOrigins = [
    "https://primeshieldhub.com",
    "https://www.primeshieldhub.com",
    "http://localhost:8787",
    "http://localhost:5173"
  ];
  const origin = (typeof request !== 'undefined' ? request.headers?.get("Origin") : '') || '';
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowOrigin,
      "Access-Control-Allow-Methods": `${methods.join(', ')}, OPTIONS`,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "86400"
    }
  });
}
