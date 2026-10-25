# Operations Runbook

This document contains the standard operating procedures for deploying, maintaining, and troubleshooting PrimeShieldHub.

## 1. Deployments

### Automatic (CI/CD)
Pushes to the main branch automatically trigger a deployment via Cloudflare Git integration.
*   **Frontend**: Deploys to Cloudflare Pages (primeshieldhub.com).
*   **Backend**: Deploys to Cloudflare Workers (api.primeshieldhub.com).

### Manual (Emergency Hotfix)
If Cloudflare Git integration is down or a critical fix is needed immediately:

**Backend:**
cd backend
wrangler deploy

**Frontend:**
cd frontend
wrangler pages deploy public --project-name=primeshieldhub

## 2. Database (D1) Management

### Schema Changes
Never manually edit the D1 database via the dashboard. All changes must go through SQL migrations.
1. Create a new migration file: db/migrations/00X_description.sql.
2. Apply it to local dev: wrangler d1 execute primeshieldhub-db --local --file=db/migrations/00X_description.sql.
3. Apply it to production: wrangler d1 execute primeshieldhub-db --remote --file=db/migrations/00X_description.sql.

### Backup & Restore
Cloudflare D1 does not have a point-in-time recovery UI. You must export backups manually.

**Export:**
wrangler d1 export primeshieldhub-db --remote --output=db/backups/backup.sql

## 3. Secrets Management
Never commit .env files. To update a secret on the live Worker:
cd backend
wrangler secret put JWT_SECRET
wrangler secret put PAYSTACK_SECRET
The Worker will restart automatically with the new secrets.

## 4. Troubleshooting

*   **Invalid schema during CI:** The schema parser is strict. Check db/schema.sql for invalid SQL syntax.
*   **Images not loading:** Ensure the asset path in D1 matches the file in R2 (or frontend/public/assets/).
*   **HTTP 408 on Git Push:** Switch to SSH (git@github.com:...) and set git config --global http.postBuffer 524288.
