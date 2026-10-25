# System Architecture

PrimeShieldHub is an edge-native platform built entirely on the Cloudflare ecosystem. It uses a monolithic repository with a separation of concerns between the static frontend, the Worker API, and the core business engines.

## High-Level Topology

[ Client / Browser ]
       |
       v
[ Cloudflare Pages ] ------> Serves HTML/CSS/JS, PWA Assets
       |
       v (Fetch API)
[ Cloudflare Workers ] ----> Acts as the Edge API Gateway
       |
       +--> [ Backend Engines ]
       |    +-- fxEngine.js        (Currency & NGN normalization)
       |    +-- logisticsEngine.js (Regional shipping calculations)
       |    +-- priceGuard.js      (Fraud & pricing validation)
       |
       +--> [ Cloudflare D1 ] ---> primeshieldhub-db (Core relational data)
       +--> [ Cloudflare D1 ] ---> payment-logs    (Immutable webhooks/audit)
       +--> [ Cloudflare KV ] ---> PRODUCTS_CACHE  (High-speed read cache)
       +--> [ Cloudflare KV ] ---> RATE_LIMITER    (DDoS/Middleware limits)
       +--> [ Cloudflare R2 ] ---> Media storage   (Images, receipts)

## Core Components

### 1. The Engines (backend/src/engines/)
Business logic is strictly decoupled from API routing to allow for unit testing and isolated updates.

*   **fxEngine**: Handles real-time currency conversions. Because the store operates primarily in NGN but sources globally, this engine normalizes prices based on current exchange rates.
*   **logisticsEngine**: Calculates shipping vectors, courier fees, and delivery ETAs based on weight/dimensions and the destination region.
*   **priceGuard**: The most critical engine. It validates item prices at checkout against the D1 database to prevent cart-manipulation attacks, evaluates margin floors, and flags anomalous high-value orders for manual review.

### 2. The Data Layer
*   **D1 (SQLite)**: Used for relational data (Products, Users, Orders). The schema is version-controlled at db/schema.sql.
*   **KV (Key-Value)**: Used for high-throughput, low-latency reads. The PRODUCTS_CACHE namespace drastically reduces D1 read operations during traffic spikes.
*   **R2 (Object Storage)**: Used for zero-egress storage of heavy assets (product images, PDF receipts).

## Security Model

1.  **Edge Rate Limiting**: Before hitting the Worker, requests pass through the RATE_LIMITER KV namespace. This mitigates brute-force and basic DDoS attempts.
2.  **Secret Management**: No hardcoded credentials. Secrets are stored in Cloudflare Workers secrets and injected as environment variables.
3.  **CI/CD Enforcement**: The .github/workflows/ci.yml pipeline automatically blocks any commit containing a recognizable secret pattern (e.g., sk_live_, r8_) or invalid SQL.
4.  **Fraud-Aware Checkout**: The priceGuard engine validates that the price submitted by the browser matches the D1 database price before initializing the payment gateway.
