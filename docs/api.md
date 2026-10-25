# API Reference

PrimeShieldHub exposes **~180 endpoints** across 40 handler modules in `backend/src/handlers/`. The Worker entrypoint (`backend/src/index.js`) dispatches requests based on `url.pathname`.

- **Base URL (Production):** `https://api.primeshieldhub.com`
- **Base URL (Local):** `http://localhost:8787`
- **Content-Type:** `application/json`
- **Authentication:** JWT via `Authorization: Bearer <token>` header, or `auth_token` HttpOnly cookie.

Routes marked 🔒 require authentication. Routes marked 👑 require admin role.

---

## Route Organization

| Handler | Domain | Section |
|---|---|---|
| `auth.js` | Login, register, OTP, 2FA, CSRF | [Authentication](#authentication) |
| `products.js` | Product catalog | [Products](#products) |
| `categories.js` | Category tree | [Products](#products) |
| `cart.js` | Shopping cart | [Cart & Wishlist](#cart--wishlist) |
| `wishlist.js` | Saved items | [Cart & Wishlist](#cart--wishlist) |
| `orders.js` | Order lifecycle | [Orders](#orders) |
| `payment.js`, `payment-verify.js` | Paystack integration | [Payments](#payments) |
| `webhook.js` | Payment callbacks | [Payments](#payments) |
| `staff.js`, `staff-payout.js` | Staff management, payroll | [Staff & Payroll](#staff--payroll) |
| `admin-unified.js` | Admin operations | [Admin](#admin) |
| `wholesale.js` | B2B / wholesale | [Wholesale](#wholesale) |
| `buildmart.js` | BuildMart construction store | [BuildMart](#buildmart) |
| `charging.js` | Device charging sessions | [Charging](#charging) |
| `analytics.js`, `stats.js` | Reporting | [Analytics](#analytics) |
| `notifications.js` | Email, SMS, push | [Notifications](#notifications) |
| `chat.js` + `ChatRoom.js` (Durable Object) | Real-time chat | [Chat](#chat) |
| `investor.js`, `customer.js`, `branch.js` | Investors, customers, branches | [Business](#business) |
| `franchise.js` | Franchise operations | [Franchise](#franchise) |
| `security.js`, `security-admin.js`, `anomalies.js` | Fraud / security | [Security](#security) |
| `ai.js`, `intelligence.js` | AI / recommendations | [AI & Autonomous](#ai--autonomous) |
| `dashboard.js` | User dashboards | [Dashboards](#dashboards) |
| `fingerprint.js`, `verify-challenge.js` | Device fingerprinting | [Security](#security) |

---

## Authentication

Implemented in `backend/src/handlers/auth.js`. Uses JWT + HttpOnly cookies + optional 2FA.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Create user account | Public |
| POST | `/api/auth/login` | Email + password login | Public |
| POST | `/api/auth/logout` | Invalidate session | 🔒 |
| GET  | `/api/auth/me` | Current user info | 🔒 |
| GET  | `/api/auth/check` | Session validity check | Public |
| POST | `/api/auth/change-password` | Update password | 🔒 |
| POST | `/api/auth/request-otp` | Send 6-digit OTP | Public |
| POST | `/api/auth/verify-otp` | Verify OTP code | Public |
| POST | `/api/auth/2fa/enable` | Enable TOTP 2FA | 🔒 |
| POST | `/api/auth/2fa/verify` | Verify TOTP code | 🔒 |
| POST | `/api/auth/2fa/disable` | Disable 2FA | 🔒 |
| POST | `/api/auth/admin-login` | Admin-only login | Public |
| POST | `/api/auth/admin-register` | Admin registration | 👑 |
| GET  | `/api/auth/admin-check` | Verify admin role | 👑 |
| GET  | `/api/auth/csrf` | Generate CSRF token | Public |
| POST | `/api/auth/register-staff` | Staff onboarding | 👑 |
| GET  | `/api/auth/invitations` | List pending invites | 👑 |

---

## Products

Implemented in `backend/src/handlers/products.js` and `categories.js`. Reads are cached in KV (`PRODUCTS_CACHE`).

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/products` | List products (paginated) | Public |
| GET  | `/api/products/:id` | Single product | Public |
| POST | `/api/products` | Create product | 👑 |
| PUT  | `/api/products/:id` | Update product | 👑 |
| DELETE | `/api/products/:id` | Delete (soft) | 👑 |
| GET  | `/api/categories` | Category tree | Public |
| GET  | `/api/signature/products` | Featured / signature items | Public |

**Query params for `GET /api/products`:** `store`, `category`, `search`, `limit`, `offset`, `filter`, `page`.

---

## Cart & Wishlist

Implemented in `cart.js` and `wishlist.js`.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/cart` | Get current cart | 🔒 |
| POST | `/api/cart` | Add item | 🔒 |
| POST | `/api/cart/sync` | Merge guest cart with account | 🔒 |
| POST | `/api/cart/clear` | Empty cart | 🔒 |
| GET  | `/api/wishlist` | List saved items | 🔒 |
| POST | `/api/wishlist` | Save item | 🔒 |
| POST | `/api/wishlist/clear` | Empty wishlist | 🔒 |
| POST | `/api/validate-discount` | Validate coupon code | 🔒 |

---

## Orders

Implemented in `orders.js`. Payment state transitions are logged to `PAYMENT_LOGS_DB`.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/orders` | List user's orders | 🔒 |
| POST | `/api/orders` | Create order | 🔒 |
| POST | `/api/orders/update-status` | Update fulfillment status | 🔒 |
| GET  | `/api/customer/history` | Order history | 🔒 |

---

## Payments

Implemented in `payment.js`, `payment-simple.js`, `payment-verify.js`, `webhook.js`. **All payment flows pass through the `priceGuard` engine** (`backend/src/engines/priceGuard.js`) before a gateway call.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/config/paystack` | Get public Paystack key | Public |
| POST | `/api/checkout` | Initialize payment | 🔒 |
| POST | `/api/payments` | Record payment attempt | 🔒 |
| GET  | `/api/transactions` | List user transactions | 🔒 |
| POST | `/api/webhook/paystack` | Paystack callback | Public (signed) |
| POST | `/api/subscription/initialize` | Start recurring sub | 🔒 |
| GET  | `/api/subscription` | Current subscription | 🔒 |
| GET  | `/api/integrations` | List configured integrations | 👑 |

**Security note:** `priceGuard` re-validates every line item against D1 (`products` table) before any payment reference is issued. Price mismatches return `403 Forbidden`.

---

## Staff & Payroll

Implemented in `staff.js` and `staff-payout.js`. Includes wallet, bank account management, and payroll processing.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/staff` | List staff | 🔒 |
| GET  | `/api/staff/me` | Current staff profile | 🔒 |
| POST | `/api/staff/invites` | Send invite | 👑 |
| POST | `/api/staff/invites/resend` | Resend invite | 👑 |
| GET  | `/api/staff/activity` | Activity log | 👑 |
| GET  | `/api/staff/stats` | Staff stats | 👑 |
| GET  | `/api/staff/performance` | Performance metrics | 👑 |
| POST | `/api/staff/attendance/clock-in` | Clock in | 🔒 |
| POST | `/api/staff/attendance/clock-out` | Clock out | 🔒 |
| GET  | `/api/staff/attendance` | Attendance history | 🔒 |
| GET  | `/api/staff/wallet` | Staff wallet balance | 🔒 |
| POST | `/api/staff/wallet/credit` | Credit wallet | 👑 |
| POST | `/api/staff/wallet/withdraw` | Withdraw from wallet | 🔒 |
| GET  | `/api/staff/bank-account` | Get bank account | 🔒 |
| POST | `/api/staff/bank-account` | Add bank account | 🔒 |
| POST | `/api/payroll/process` | Run payroll | 👑 |
| GET  | `/api/payroll/history` | Payroll history | 👑 |
| GET  | `/api/payroll/verify-public/:token` | Public payslip verification | Public |
| GET  | `/api/staff/verify-public/:token` | Public staff verification | Public |
| POST | `/api/staff/forgot-password` | Password reset request | Public |
| POST | `/api/staff/reset-password` | Reset password | Public |

---

## Admin

Implemented in `admin-unified.js`. All routes 👑 admin-only.

| Method | Path | Description |
|---|---|---|
| GET  | `/api/admin/stats` | Dashboard metrics |
| GET  | `/api/admin/staff-list` | Full staff list |
| POST | `/api/admin/approve-staff` | Approve staff account |
| POST | `/api/admin/reject-staff` | Reject staff account |
| POST | `/api/admin/generate-invite` | Generate invite token |
| GET  | `/api/admin/invitations` | List invites |
| POST | `/api/admin/revoke-invite` | Revoke invite |
| GET  | `/api/admin/branches` | List branches |
| POST | `/api/admin/branches` | Create branch |
| GET  | `/api/admin/orders` | All orders |
| POST | `/api/admin/order-status` | Update order status |
| GET  | `/api/admin/customers` | Customer list |
| GET  | `/api/admin/investors` | Investor list |
| POST | `/api/admin/investor-status` | Approve/reject investor |
| GET  | `/api/admin/receipts` | Receipt list |
| POST | `/api/admin/receipts/resend` | Resend receipt |
| GET  | `/api/admin/logs` | Audit logs |
| GET  | `/api/admin/settings` | Platform settings |
| POST | `/api/admin/settings` | Update settings |
| GET  | `/api/admin/list-admins` | List admin users |
| POST | `/api/admin/notifications/send` | Send to user |
| POST | `/api/admin/notifications/send-all` | Broadcast |
| GET  | `/api/admin/applications` | Pending applications |
| GET  | `/api/admin/ai-insights` | AI dashboard |
| POST | `/api/admin/run-autonomous` | Trigger autonomous run |
| GET  | `/api/admin/jobs` | Job listings |
| GET  | `/api/admin/jobs/stats` | Job stats |
| GET  | `/api/admin/franchise/applications` | Franchise apps |
| POST | `/api/admin/franchise/approve` | Approve franchise |
| POST | `/api/admin/franchise/reject` | Reject franchise |

---

## Wholesale

Implemented in `wholesale.js`. Requires a wholesale code or approved account.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/wholesale/request-access` | Apply for wholesale | Public |
| POST | `/api/wholesale/request-quote` | Submit quote request | Public |
| GET  | `/api/wholesale/requests` | List user requests | 🔒 |
| GET  | `/api/wholesale/products` | Wholesale product list | 🔒 |
| GET  | `/api/wholesale/codes` | User's codes | 🔒 |
| POST | `/api/wholesale/codes/generate` | Generate code | 👑 |
| POST | `/api/wholesale/verify-code` | Verify a code | Public |

---

## BuildMart

Implemented in `buildmart.js`. Separate construction-materials storefront.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/buildmart/products` | Catalog | Public |
| GET  | `/api/buildmart/categories` | Categories | Public |
| GET  | `/api/buildmart/brands` | Brands | Public |
| GET  | `/api/buildmart/featured` | Featured items | Public |
| POST | `/api/buildmart/compare` | Compare items | Public |
| POST | `/api/buildmart/checkout` | Checkout | 🔒 |
| POST | `/api/buildmart/bulk-order` | Bulk order | 🔒 |
| POST | `/api/buildmart/quotes/calculate` | Calculate quote | Public |
| GET  | `/api/buildmart/quotes` | User quotes | 🔒 |
| GET  | `/api/buildmart/delivery/regions` | Delivery regions | Public |
| POST | `/api/buildmart/delivery/calculate` | Calculate delivery | Public |
| GET  | `/api/buildmart/contractors` | Contractors directory | Public |
| GET  | `/api/buildmart/dashboard` | User dashboard | 🔒 |

---

## Charging

Implemented in `charging.js`. Device charging service — session lifecycle.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/charging/bays` | List charging bays | 🔒 |
| POST | `/api/charging/start` | Start session | 🔒 |
| POST | `/api/charging/pause` | Pause session | 🔒 |
| POST | `/api/charging/resume` | Resume session | 🔒 |
| POST | `/api/charging/complete` | Complete session | 🔒 |
| POST | `/api/charging/ready` | Mark device ready | 🔒 |
| GET  | `/api/charging/sessions` | User sessions | 🔒 |
| GET  | `/api/charging/stats` | Charging stats | 👑 |
| GET  | `/api/charging/timer` | Active timer | 🔒 |
| GET  | `/api/bays` | Legacy bay list | 🔒 |
| GET  | `/api/charges` | Legacy charges list | 🔒 |
| GET  | `/api/counters` | Bay counters | 👑 |

---

## Analytics

Implemented in `analytics.js` and `stats.js`.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/analytics` | Aggregate metrics | 👑 |
| GET  | `/api/analytics/dashboard` | Dashboard view | 👑 |
| GET  | `/api/analytics/events` | Raw events | 👑 |
| GET  | `/api/analytics/performance` | Performance metrics | 👑 |
| GET  | `/api/stats/daily` | Daily rollup | 👑 |
| GET  | `/api/shipping/stats` | Shipping metrics | 👑 |
| POST | `/api/log` | Client-side log | Public |
| GET  | `/api/logs` | Log query | 👑 |
| GET  | `/api/audit/logs` | Audit trail | 👑 |
| GET  | `/api/deploy-logs` | Deployment log | 👑 |

---

## Notifications

Implemented in `notifications.js`.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/notifications` | List notifications | 🔒 |
| POST | `/api/notifications/read-all` | Mark all read | 🔒 |
| GET  | `/api/staff/notifications` | Staff notifications | 🔒 |
| POST | `/api/staff/notifications/read-all` | Mark staff's read | 🔒 |
| POST | `/api/push/subscribe` | Register push device | 🔒 |
| POST | `/api/push/unsubscribe` | Remove push device | 🔒 |
| POST | `/api/push/send` | Send push (admin) | 👑 |
| POST | `/api/push/send-user` | Send push to user | 👑 |
| GET  | `/api/push/status` | Push status | 🔒 |
| POST | `/api/push/webhook` | Push provider callback | Public |
| POST | `/api/alerts` | Create alert | 🔒 |

---

## Chat

Implemented in `chat.js` and the Durable Object `ChatRoom.js`. WebSocket upgrade.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/chat/ws` | WebSocket upgrade | 🔒 |
| GET  | `/api/ai/conversations` | List AI conversations | 🔒 |
| POST | `/api/ai/conversations` | Start AI conversation | 🔒 |
| GET  | `/api/ai/recommendations` | AI product recommendations | 🔒 |
| POST | `/api/brain` | AI assistant input | 🔒 |

---

## Business

Investors, customers, branches, franchises.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/investor/leads` | Submit investor lead | Public |
| GET  | `/api/customer/history` | Customer order history | 🔒 |
| GET  | `/api/customers/loyalty` | Loyalty status | 🔒 |
| POST | `/api/customers/loyalty/earn` | Earn loyalty points | 🔒 |
| GET  | `/api/branches` | List branches | Public |
| GET  | `/api/branch/:id` | Branch detail | Public |
| GET  | `/api/franchise/stats` | Franchise stats | 🔒 |
| GET  | `/api/franchise/orders` | Franchise orders | 🔒 |
| GET  | `/api/franchise/customers` | Franchise customers | 🔒 |
| GET  | `/api/franchise/inventory` | Franchise inventory | 🔒 |
| POST | `/api/franchise/login` | Franchise login | Public |
| POST | `/api/franchise/logout` | Franchise logout | 🔒 |
| GET  | `/api/franchise/me` | Franchise profile | 🔒 |
| POST | `/api/franchise/change-password` | Change password | 🔒 |
| POST | `/api/franchise/apply` | Apply to franchise | Public |
| GET  | `/api/reseller/me` | Reseller profile | 🔒 |
| GET  | `/api/reseller/dashboard` | Reseller dashboard | 🔒 |
| GET  | `/api/reseller/sales` | Reseller sales | 🔒 |
| POST | `/api/reseller/request-payout` | Request payout | 🔒 |
| GET  | `/api/reseller-codes` | Reseller codes | 🔒 |
| POST | `/api/reseller-codes/generate` | Generate code | 👑 |
| GET  | `/api/resellers` | Reseller list | 👑 |
| POST | `/api/resellers/apply` | Apply as reseller | Public |
| GET  | `/api/referrals` | Referral list | 🔒 |
| POST | `/api/referrals/claim` | Claim referral | 🔒 |
| GET  | `/api/subscription` | Subscription status | 🔒 |
| GET  | `/api/payouts` | Payout history | 🔒 |
| GET  | `/api/commissions` | Commission report | 🔒 |
| GET  | `/api/penalties` | Penalty records | 👑 |

---

## Security

Fraud detection, anomaly detection, fingerprinting.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/security/incidents` | Incident log | 👑 |
| POST | `/api/security/incidents` | Report incident | 🔒 |
| GET  | `/api/staff-logs` | Staff action logs | 👑 |
| GET  | `/api/staff-locations` | Staff locations | 👑 |
| GET  | `/api/staff-captures` | Captured evidence | 👑 |
| GET  | `/api/user-devices` | User device list | 🔒 |
| POST | `/api/staff/capture` | Capture event | 🔒 |
| POST | `/api/staff/location` | Report location | 🔒 |
| POST | `/api/staff/session/start` | Session start | 🔒 |
| POST | `/api/staff/session/pause` | Session pause | 🔒 |
| POST | `/api/staff/session/resume` | Session resume | 🔒 |
| POST | `/api/staff/session/collect` | Collect evidence | 🔒 |
| GET  | `/api/fingerprint` | Device fingerprint | Public |

---

## AI & Autonomous

Implemented in `ai.js`, `intelligence.js`, `autonomous.js`.

| Method | Path | Description | Auth |
|---|---|---|---|
| POST | `/api/ai/recommendations` | Product recommendations | 🔒 |
| POST | `/api/ai/conversations` | Start conversation | 🔒 |
| POST | `/api/brain` | Assistant input | 🔒 |
| POST | `/api/admin/ai-insights` | Admin AI dashboard | 👑 |
| POST | `/api/admin/run-autonomous` | Trigger autonomous run | 👑 |

---

## Dashboards

Implemented in `dashboard.js`.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/dashboard` | Main dashboard | 🔒 |
| GET  | `/api/profile` | Profile | 🔒 |
| POST | `/api/profile` | Update profile | 🔒 |
| POST | `/api/profile/avatar` | Upload avatar | 🔒 |
| GET  | `/api/preferences` | User preferences | 🔒 |
| POST | `/api/preferences` | Update preferences | 🔒 |
| GET  | `/api/staff/dashboard` | Staff dashboard | 🔒 |

---

## Infrastructure

Health, config, and public metadata endpoints.

| Method | Path | Description | Auth |
|---|---|---|---|
| GET  | `/api/_health` | Health check | Public |
| GET  | `/api/config/public` | Public config | Public |
| GET  | `/api/pages` | Static page list | Public |
| GET  | `/api/export` | Data export | 👑 |
| GET  | `/api/actions` | Action list | 👑 |
| GET  | `/api/daily-stats` | Daily rollup | 👑 |

---

## Error Responses

All errors follow this shape:

```json
{
  "success": false,
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
