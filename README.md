# PrimeShieldHub 🛡️

> **Fraud-aware e-commerce, wholesale, and franchise infrastructure.** 
> Built on the edge with Cloudflare (Pages, Workers, D1, R2, KV), designed for high-throughput transactions, automated logistics, and real-time fraud mitigation.

---

## 🏗 System Architecture

PrimeShieldHub is a full-stack, edge-native commerce platform. It eliminates traditional origin servers by leveraging Cloudflare's global network for compute, storage, and caching.

```text
[ Client / Browser ]
       │
       ▼
[ Cloudflare Pages ] ── (Static Assets, PWA, UI)
       │
       ▼
[ Cloudflare Workers ] ── (Edge API, Routing, Auth)
       │
       ├──► [ Core Engines ] 
       │    ├── fxEngine.js          (Currency normalization)
       │    ├── logisticsEngine.js   (Dynamic shipping & routing)
       │    └── priceGuard.js        (Fraud detection & pricing logic)
       │
       ├──► [ Cloudflare D1 ] ────── (Relational Data: Products, Orders)
       ├──► [ Cloudflare D1 ] ────── (Payment Logs & Auditing)
       ├──► [ Cloudflare KV ] ────── (High-speed Cache, Rate Limiting)
       └──► [ Cloudflare R2 ] ────── (Zero-egress object storage for Media)
```

### ⚙️ The Engines (`backend/src/engines/`)
The platform's core business logic is decoupled into specialized modules:
*   **`priceGuard`**: Real-time validation of pricing, margin protection, and anomaly detection to prevent checkout exploits or pricing desyncs.
*   **`logisticsEngine`**: Computes regional shipping vectors, weight/dimension constraints, and courier routing.
*   **`fxEngine`**: Handles currency conversion and normalization, ensuring stable pricing across borders.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | HTML5, CSS3, Vanilla JS, PWA | Fast, zero-build UI served via Edge |
| **API** | Cloudflare Workers (V8 Isolates) | Sub-millisecond API latency |
| **Database** | Cloudflare D1 (SQLite) | Distributed relational data |
| **Cache** | Cloudflare KV | Session management, rate limiting |
| **Storage** | Cloudflare R2 | Media assets, invoices, zero-egress |
| **CI/CD** | GitHub Actions + Cloudflare Git | Automated validation & deployment |

---

## 🚀 Local Setup & Development

### Prerequisites
*   **Node.js** (`v20+`)
*   **Wrangler CLI** (`npm i -g wrangler`)
*   **Cloudflare Account** (with D1, R2, and KV enabled)

### 1. Clone & Install
```bash
git clone git@github.com:famenaghawon/primeshieldhub.git
cd primeshieldhub
npm install
```

### 2. Environment Configuration
Secrets are never committed. Duplicate the example file and fill in your local development keys:
```bash
cp .env.example .env
```
*(Requires: `JWT_SECRET`, `PAYSTACK_SECRET`, `FLUTTERWAVE_SECRET`, etc. See `.env.example` for the full matrix).*

### 3. Database Initialization (D1)
The canonical schema is located at `db/schema.sql`. To initialize a **fresh, local** D1 database for development:

```bash
# Apply schema to local dev database
wrangler d1 execute primeshieldhub-db --local --file=db/schema.sql

# (Optional) Seed initial product data
# wrangler d1 execute primeshieldhub-db --local --file=db/seed/001_initial_catalog.sql
```

### 4. Start the Dev Server
Run the Edge Worker locally with hot-reload and local D1 bindings:
```bash
cd backend
wrangler dev
```
*The API will be available at `http://localhost:8787`.*

---

## 🚢 Deployment & Operations

This repository uses **GitHub Actions** for CI (schema validation, secret scanning, size checks) and **Cloudflare's native Git integration** for zero-config production deployments.

### Production Deploy
Merges to `main` automatically trigger a production build on Cloudflare.

To deploy manually via CLI (e.g., for immediate hotfixes):

**Backend (Workers):**
```bash
cd backend
wrangler deploy
```

**Frontend (Pages):**
```bash
cd frontend
wrangler pages deploy public --project-name=primeshieldhub
```

### Database Migrations
We use sequential SQL files for schema changes. To apply a new migration to production:
```bash
wrangler d1 execute primeshieldhub-db --remote --file=db/migrations/002_add_audit_logs.sql
```

---

## 📂 Repository Structure

```text
primeshieldhub/
├── backend/                  # Cloudflare Worker API
│   ├── src/
│   │   ├── engines/          # Core logic (FX, Logistics, PriceGuard)
│   │   ├── routes/           # API Endpoints
│   │   └── index.js          # Worker entrypoint
│   ├── wrangler.jsonc        # Worker configuration & bindings
│   └── migrations/           # Worker-specific migrations
├── frontend/                 
│   └── public/               # Static site (Pages)
│       ├── assets/           # Images, fonts (R2 fallback)
│       ├── js/               # Client-side logic
│       └── index.html        # Entry point
├── db/                       
│   ├── schema.sql            # Canonical D1 schema (auto-validated in CI)
│   └── seed/                 # Seed data for fresh environments
├── scripts/                  
│   ├── ops/                  # Ops runbooks (create-admin, verify-api)
│   └── dev/                  # Local dev helpers
├── .github/workflows/        # CI pipeline (ci.yml)
└── .env.example              # Documented environment variables
```

---

## 🔒 Security & Fraud Prevention

As a platform handling financial transactions, security is enforced at every layer:

1.  **Secret Management:** No hardcoded tokens. All secrets are injected via `wrangler secret put` or GitHub Environments. CI automatically fails if a secret pattern (`sk_live_`, `r8_`, etc.) is detected in the source.
2.  **Rate Limiting:** Edge-level `RATE_LIMITER` KV bindings prevent brute-force and DDoS attempts at the API gateway.
3.  **Price Guard:** The `priceGuard` engine validates item prices against the D1 database at the moment of checkout, preventing cart manipulation or race-condition exploits.
4.  **Audit Logging:** All payment gateway webhooks and critical state changes are logged to the isolated `PAYMENT_LOGS_DB` (D1) for fraud analysis and reconciliation.

---

## 🧪 Testing & CI

Every push to `main` triggers the CI pipeline:
*   **Schema Validation:** Parses `db/schema.sql` in an isolated SQLite instance to guarantee no syntax corruption.
*   **Secret Scanning:** Greps the tree for known API key signatures.
*   **Repo Hygiene:** Blocks accidental commits of `node_modules`, `nvm/`, or binaries >100MB.

```bash
# Run the CI checks locally before pushing:
git grep -inE 'sk_live_[A-Za-z0-9]{20,}|r8_[A-Za-z0-9]{30,}' -- . ':(exclude)*.md'
```

---

## 📄 License

**Proprietary & Confidential.** 
All rights reserved. This software and its associated documentation are the confidential property of PrimeShieldHub. Unauthorized copying, modification, distribution, or use is strictly prohibited.
