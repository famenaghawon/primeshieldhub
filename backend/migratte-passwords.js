// migrate-passwords.js
// Run once to upgrade existing user/staff/franchise passwords to PBKDF2
// Usage: npx wrangler d1 execute DB --file=migrate-passwords.sql
// Or run via Worker script manually

import { hashPassword } from './auth-helpers.js';

export default {
  async fetch(request, env) {
    // Security check – only allow from admin or with secret
    const auth = request.headers.get("x-admin-secret");
    if (auth !== env.GATEWAY_SECRET) {
      return new Response("Unauthorized", { status: 403 });
    }

    const results = { users: 0, staff: 0, franchise: 0 };

    // 1. Migrate users
    const { results: users } = await env.DB.prepare(
      "SELECT id, password FROM users WHERE password IS NOT NULL AND password_hash IS NULL"
    ).all();

    for (const user of users) {
      const { hash, salt } = await hashPassword(user.password);
      await env.DB.prepare(
        "UPDATE users SET password_hash = ?, password_salt = ?, password = NULL WHERE id = ?"
      ).bind(hash, salt, user.id).run();
      results.users++;
    }

    // 2. Migrate staff
    const { results: staff } = await env.DB.prepare(
      "SELECT id, pin FROM staff WHERE pin IS NOT NULL AND pin_hash IS NULL"
    ).all();

    for (const s of staff) {
      const { hash, salt } = await hashPassword(s.pin);
      await env.DB.prepare(
        "UPDATE staff SET pin_hash = ?, pin_salt = ?, pin = NULL WHERE id = ?"
      ).bind(hash, salt, s.id).run();
      results.staff++;
    }

    // 3. Migrate franchise accounts
    const { results: franchise } = await env.DB.prepare(
      "SELECT id, password FROM franchise_accounts WHERE password IS NOT NULL AND password_hash IS NULL"
    ).all();

    for (const f of franchise) {
      const { hash, salt } = await hashPassword(f.password);
      await env.DB.prepare(
        "UPDATE franchise_accounts SET password_hash = ?, password_salt = ?, password = NULL WHERE id = ?"
      ).bind(hash, salt, f.id).run();
      results.franchise++;
    }

    return Response.json({
      success: true,
      migrated: results,
      message: "All passwords migrated to PBKDF2. You can now drop the plaintext columns."
    });
  }
};

