-- ============================================================
-- PrimeShieldHub BuildMart - Complete Product Seed
-- Fast-selling technology products for Nigerian e-commerce
-- Realistic Jumia NG prices & comprehensive descriptions (June 2026)
-- ============================================================
-- Run: npx wrangler d1 execute primeshieldhub-db --remote --file=seed-complete.sql
-- Prerequisite: DELETE FROM products; (if re-seeding)

INSERT OR REPLACE INTO products (
  id, name, category, basePrice, price, wholesalePrice, stock, weightKg, 
  image, description, active, createdAt, wholesale_available, wholesale_price, 
  image_url, reseller_price, rating, featured, brand, is_bestseller, is_new
) VALUES 