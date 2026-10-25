// create-admin.js
// Usage: npx wrangler dev --remote create-admin.js
// Or deploy as a temporary Worker endpoint

import { hashPassword, generateSecureOTP } from './auth-helpers.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Only allow from local or with secret
    const auth = request.headers.get("x-admin-secret");
    if (auth !== env.GATEWAY_SECRET) {
      return new Response("Unauthorized", { status: 403 });
    }

    if (url.pathname === "/create-admin" && request.method === "POST") {
      const { email, password, name, phone } = await request.json();
      
      if (!email || !password) {
        return Response.json({ error: "Email and password required" }, { status: 400 });
      }

      // Check if user exists
      const existing = await env.DB.prepare(
        "SELECT id FROM users WHERE email = ?"
      ).bind(email).first();

      if (existing) {
        return Response.json({ error: "User already exists" }, { status: 409 });
      }

      const { hash, salt } = await hashPassword(password);
      const userId = crypto.randomUUID();
      const now = Date.now();

      await env.DB.prepare(`
        INSERT INTO users (id, email, password_hash, password_salt, name, phone, role, isAdmin, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, 'admin', 1, ?)
      `).bind(userId, email, hash, salt, name || 'Admin', phone || null, now).run();

      return Response.json({
        success: true,
        userId,
        message: "Admin user created successfully"
      });
    }

    return new Response("Send POST to /create-admin with { email, password, name, phone }", { status: 404 });
  }
};

