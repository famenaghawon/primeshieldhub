# PrimeShieldHub

## Deploy Commands

Frontend (Pages):
    cd C:\Users\myori\Desktop\primeshieldhub
    .\deploy.ps1

Backend (Worker):
    cd C:\Users\myori\Desktop\primeshieldhub
    .\deploy-backend.ps1

## Environment Requirements

- $env:PSH_CACHE_TOKEN — Cloudflare API token with Zone.Cache Purge
- Wrangler authenticated via OAuth (npx wrangler login)

## Architecture

- primeshieldhub.com/*               → Cloudflare Pages (project: primeshieldhub)
- primeshieldhub.com/franchise/*     → Cloudflare Worker
- primeshieldhub.com/api/franchise/* → Cloudflare Worker
- api.primeshieldhub.com/*           → Cloudflare Worker

## Bindings

- R2: primeshieldhub-storage
- D1: primeshieldhub-db
- KV: RATE_LIMITER, PRODUCTS_CACHE, RATE_LIMITER_BACKUP
- DO: CHAT_ROOM
