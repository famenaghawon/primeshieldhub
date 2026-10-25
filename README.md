<div align="center">

# 🛡️ PrimeShieldHub

**Fraud-aware, edge-native e-commerce infrastructure for gadgets, wholesale, and franchise operations.**

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Cloudflare D1](https://img.shields.io/badge/Cloudflare-D1-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/d1/)
[![Cloudflare R2](https://img.shields.io/badge/Cloudflare-R2-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/r2/)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge)](LICENSE)
[![CI](https://github.com/famenaghawon/primeshieldhub/actions/workflows/ci.yml/badge.svg)](https://github.com/famenaghawon/primeshieldhub/actions/workflows/ci.yml)

*Built by [Freedom Amenaghawon](https://github.com/famenaghawon) — Benin City, Nigeria.*

</div>

---

## 📖 Table of Contents

- [Why PrimeShieldHub?](#-why-primeshieldhub)
- [System Architecture](#-system-architecture)
- [The Engines](#-the-engines)
- [Tech Stack](#-tech-stack)
- [Security & Fraud Prevention](#-security--fraud-prevention)
- [Local Development](#-local-development)
- [Deployment](#-deployment)
- [Repository Structure](#-repository-structure)
- [Testing & CI](#-testing--ci)
- [Performance Budget](#-performance-budget)
- [Documentation](#-documentation)
- [License](#-license)

---

## 🎯 Why PrimeShieldHub?

Traditional e-commerce platforms treat fraud detection as an afterthought — a third-party plugin bolted onto a legacy stack. PrimeShieldHub was engineered from day one with **fraud-awareness as a first-class concern**.

| Challenge | PrimeShieldHub's Approach |
| :--- | :--- |
| **Cart manipulation attacks** | The `priceGuard` engine re-validates every line item against the live D1 database *before* a payment reference is ever issued. |
| **Origin server latency** | Zero origin servers. All compute runs on Cloudflare's 300+ edge locations via V8 isolates. |
| **Cold-start overhead** | Workers boot in ~5ms — a fraction of the cost of containerized runtimes. |
| **Payment gateway complexity** | Unified abstraction over Paystack (NGN) and Coinbase Commerce (crypto), with HMAC-SHA256 webhook verification. |
| **Currency volatility** | The `fxEngine` normalizes pricing across currencies at checkout time. |

Every architectural decision in this repository is a deliberate choice for **speed, security, and maintainability at the edge**.

---

## 🏗 System Architecture

```text
┌──────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser / PWA)                        │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTPS (TLS 1.3)
                                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE (300+ Cities)                     │
│                                                                      │
│  ┌─────────────────────┐         ┌─────────────────────────────┐    │
│  │  Cloudflare Pages   │◄────────│  Cloudflare Workers (API)   │    │
│  │  (Static + PWA)     │  Fetch  │  (V8 Isolates)              │    │
│  └─────────────────────┘         └──────────────┬──────────────┘    │
│                                                  │                   │
│         ┌────────────────────────────────────────┼───────────┐      │
│         ▼                    ▼                   ▼           ▼      │
│  ┌────────────┐      ┌────────────┐      ┌──────────┐  ┌────────┐  │
│  │  Engines   │      │  D1 (SQL)  │      │    KV    │  │   R2   │  │
│  │ ──────────  │      │ ────────── │      │ ──────── │  │ ────── │  │
│  │ priceGuard │      │ primeshield│      │ RATE_    │  │ media  │  │
│  │ fxEngine   │      │ payment-   │      │ LIMITER  │  │ assets │  │
│  │ logistics  │      │ logs       │      │ PRODUCTS │  │ PDFs   │  │
│  └────────────┘      └────────────┘      └──────────┘  └────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
              ┌───────────────────────────────────┐
              │  External Integrations            │
              │  ─────────────────────            │
              │  • Paystack (Card, Bank, USSD)    │
              │  • Coinbase Commerce (Crypto)     │
              │  • OpenAI (AI-assisted features)  │
              │  • Resend (Transactional email)   │
              │  • Telegram (Ops alerting)        │
              └───────────────────────────────────┘
```

### Key Design Decisions

- **Zero origin servers** — the entire platform lives on Cloudflare's edge. No EC2, no DigitalOcean droplets, no VMs to patch.
- **D1 as the single source of truth** — SQLite-compatible relational storage with point-in-time consistency for payments and orders.
- **KV for hot reads** — product catalog pages are cached in KV to reduce D1 read pressure during traffic spikes.
- **R2 for zero-egress storage** — product images, receipt PDFs, and verification documents live here (not in Git, not in D1).
- **Durable Objects for real-time chat** — WebSocket-based customer/staff chat lives inside a single Durable Object per room.

---

## ⚙️ The Engines

Business logic is **decoupled** from API routing to enable unit testing and isolated updates.

### 🛡️ `priceGuard` — Fraud & Pricing Validation
**Location:** `backend/src/engines/priceGuard.js`

The most critical module. Before any payment is initialized:
1. Fetches each cart line item's canonical price from D1.
2. Compares the client-submitted price against the database price.
3. Enforces margin floors defined per category.
4. Rejects with `403 Forbidden` if any mismatch is detected.

This prevents the classic **cart-manipulation attack** where a malicious user alters prices in the browser's DevTools before checkout.

### 💱 `fxEngine` — Currency Normalization
**Location:** `backend/src/engines/fxEngine.js`

Handles live FX rates so the storefront can display prices in ₦, $, or any supported currency — with a single NGN value stored in D1 as the source of truth.

### 🚚 `logisticsEngine` — Delivery Routing
**Location:** `backend/src/engines/logisticsEngine.js`

Computes shipping cost based on weight, dimensions, and destination region. Delivery zones are defined in the `delivery_regions` table and can be updated without redeploying code.

---

## 🛠 Tech Stack

| Layer | Technology | Why |
| :--- | :--- | :--- |
| **Frontend** | HTML5 · CSS3 · Vanilla JS · PWA | Zero-build UI, instant edge caching |
| **API** | Cloudflare Workers (V8 Isolates) | Sub-10ms cold starts |
| **Database** | Cloudflare D1 (SQLite) | Distributed relational data |
| **Cache** | Cloudflare KV | Product catalog + rate limiting |
| **Storage** | Cloudflare R2 | Zero-egress media + PDFs |
| **Real-time** | Durable Objects | WebSocket chat with per-room state |
| **CI/CD** | GitHub Actions + Cloudflare Git | Schema validation, secret scanning, size checks |
| **Monitoring** | Cloudflare Analytics + custom D1 audit logs | Full traceability |

---

## 🔒 Security & Fraud Prevention

PrimeShieldHub processes real financial transactions. Security is enforced at every layer.

### Authentication
- **JWT tokens** signed with HMAC-SHA256, stored in `HttpOnly` cookies.
- **CSRF protection** via rotating tokens.
- **Two-Factor Authentication** (TOTP) available for staff and admin accounts.
- **Session revocation** — every login has a unique `jti` claim that can be blacklisted.

### Rate Limiting
- Cloudflare KV-backed sliding window rate limiter.
- Per-IP and per-user bucketing.
- Automatic escalation to Cloudflare's WAF for sustained abuse.

### Audit & Fraud Logging
- Every payment attempt, refund, and admin action is logged to `PAYMENT_LOGS_DB`.
- Fraud signals (price mismatch, velocity, geo-anomaly) are recorded with timestamps.
- Audit trail is immutable (append-only tables).

### Secret Management
- **No hardcoded secrets in source.**
- All credentials injected via `wrangler secret put` or Cloudflare dashboard.
- CI fails immediately if any known secret pattern (`sk_live_`, `r8_`, `FLWSECK`) is detected in a commit.
- `.env` files are git-ignored and verified by CI on every push.

### What We Don't Claim
PrimeShieldHub publishes an honest [**How It Works**](/how-it-works) page describing the real architecture. We explicitly do **not** use:
- Blockchain or distributed ledgers (reseller codes are securely random tokens, not blockchain assets)
- Quantum computing or quantum-resistant cryptography (we use standard TLS 1.3 + HMAC-SHA256)
- Satellite or IoT tracking (we use courier API integrations)
- Neural networks or deep learning for inventory management
- Smart contracts (reseller agreements are signed electronically and stored as PDFs)

Transparency is a security feature.

---

## 🚀 Local Development

### Prerequisites
- **Node.js** `v20+`
- **Wrangler CLI** `npm i -g wrangler`
- **Cloudflare Account** with D1, R2, and KV enabled

### 1. Clone & Install
```bash
git clone git@github.com:famenaghawon/primeshieldhub.git
cd primeshieldhub
npm install
```

### 2. Environment Configuration
Copy the example file and fill in your local development keys:

```bash
cp .env.example .env
```

> ⚠️ **Never commit `.env`.** It is git-ignored and CI will fail if a `.env` file ever appears in a diff.

### 3. Database Initialization (D1)
The canonical schema lives at `db/schema.sql`. It is a **reference file** exported from production D1 — **do not run it against an existing database** (tables already exist).

For a fresh local D1 instance:

```bash
# Local dev DB
wrangler d1 execute primeshieldhub-db --local --file=db/schema.sql
```

### 4. Start the Dev Server
```bash
cd backend
wrangler dev
```

The API will be available at `http://localhost:8787`.

---

## 🚢 Deployment

### Automatic (Cloudflare Git Integration)
Pushes to `main` trigger a production deployment via Cloudflare's native git integration.

### Manual (Scripted)
The repository ships with two hardened scripts for manual deploys:

**Frontend (Pages):**
```powershell
.\deploy.ps1
```

**Backend (Worker):**
```powershell
.\deploy-backend.ps1
```

Both scripts:
- Use exponential backoff for rate-limit (HTTP 429) recovery.
- Purge the Cloudflare cache after a successful deploy (requires `PSH_CACHE_TOKEN` in env).
- Exit non-zero on any non-retryable error, so CI can detect failures.

### Database Migrations
```bash
wrangler d1 execute primeshieldhub-db --remote --file=db/migrations/XXXX_description.sql
```

Migrations live in `db/migrations/` and follow a numbered sequence (`0001_…`, `0002_…`). See [`db/migrations/README.md`](db/migrations/README.md) for the full workflow.

---

## 📂 Repository Structure

```text
primeshieldhub/
├── backend/                    # Cloudflare Worker API
│   ├── src/
│   │   ├── engines/            # fxEngine, logisticsEngine, priceGuard
│   │   ├── handlers/           # ~40 modular route handlers
│   │   ├── middleware/         # auth, cors, rate-limit, security
│   │   ├── durable-objects/    # ChatRoom (WebSocket)
│   │   ├── utils/              # crypto, logging, validation
│   │   └── index.js            # Worker entry point
│   ├── wrangler.jsonc          # Bindings, routes, secrets refs
│   └── package.json
├── frontend/
│   └── public/                 # Cloudflare Pages static site
│       ├── assets/             # Brand assets
│       ├── js/                 # Client-side modules
│       └── index.html
├── db/
│   ├── schema.sql              # Canonical D1 schema (validated by CI)
│   ├── migrations/             # Sequential SQL migrations
│   └── seed/                   # Historical catalog seeds
├── scripts/
│   ├── ops/                    # create-admin, verify-api, health-check
│   └── dev/                    # Local development helpers
├── docs/
│   ├── architecture.md         # Deep-dive on system design
│   ├── api.md                  # 180+ endpoint reference
│   └── operations.md           # Runbook: deploy, backup, incident response
├── .github/workflows/ci.yml    # CI: schema, secrets, size, nvm/
├── .env.example                # Documented env var matrix
├── CONTRIBUTING.md             # Internal dev guidelines
├── LICENSE                     # Proprietary
└── README.md                   # This file
```

---

## 🧪 Testing & CI

Every push to `main` triggers the CI pipeline, which validates:

- ✅ **Schema Integrity** — `db/schema.sql` is parsed in an isolated SQLite instance.
- ✅ **Secret Scanning** — fails on any `sk_live_`, `r8_`, `FLWSECK` pattern in source.
- ✅ **Repo Hygiene** — blocks accidental commits of `nvm/`, `node_modules/`, or binaries > 100 MB.
- ✅ **Size Guard** — pack size is capped to prevent history bloat regressions.

Run the checks locally before pushing:

```bash
# Secret scan
git grep -inE 'sk_live_[A-Za-z0-9]{20,}|r8_[A-Za-z0-9]{30,}|FLWSECK[_-][A-Za-z0-9]{20,}' -- . ':(exclude)*.md'

# Schema validation (requires sqlite3 installed)
sqlite3 :memory: < db/schema.sql
```

---

## 📊 Performance Budget

PrimeShieldHub is engineered to hit aggressive performance targets:

| Metric | Target | Current |
| :--- | :--- | :--- |
| **Worker cold start** | < 15ms | ~7ms |
| **Gzipped bundle size** | < 250 KB | ~170 KB |
| **Time to first byte (edge)** | < 100ms | ~40ms |
| **Largest contentful paint** | < 2.5s (3G) | ~1.9s |
| **D1 read latency (p50)** | < 5ms | ~2ms |
| **CI pipeline duration** | < 90s | ~45s |

Regressions against these budgets block merges via CI.

---

## 📚 Documentation

In-depth guides live in `docs/`:

- [**Architecture**](docs/architecture.md) — system design, engines, data flow
- [**API Reference**](docs/api.md) — 180+ endpoints, grouped by domain
- [**Operations Runbook**](docs/operations.md) — deployments, backups, incident response
- [**How It Works**](/how-it-works) — public-facing transparency page
- [**Contributing**](CONTRIBUTING.md) — internal developer guidelines
- [**Migrations**](db/migrations/README.md) — schema evolution workflow

---

## 🛡️ License

**Proprietary & Confidential.** All rights reserved.
See [LICENSE](LICENSE) for full terms. Unauthorized copying, modification, distribution, or use is strictly prohibited.

---

<div align="center">

**Engineered with care in Benin City, Nigeria 🇳🇬**

*By [Freedom Amenaghawon](https://github.com/famenaghawon)*

[⬆ back to top](#️-primeshieldhub)

</div>
