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

-- SMARTPHONES
('tecno-pop-20', 'Tecno POP 20 6.67" 4GB RAM + 64GB ROM Android 16', 'smartphones', 136730, 136730, 115000, 45, 0.195, 
 '/assets/products/tecno-pop-20.jpg', 'The Tecno POP 20 delivers exceptional everyday performance with a vibrant 6.67-inch HD+ 90Hz display, smooth Unisoc processor, 5000mAh battery with fast charging support, and dual AI cameras. Ideal for students, social media, and light multitasking. Features stylish design and reliable build quality popular across Nigeria.', 1, unixepoch(), 1, 115000, '/assets/products/tecno-pop-20.jpg', 125000, 4.5, 1, 'Tecno', 1, 1),

('infinix-smart-20', 'Infinix Smart 20 6.78" 4GB RAM + 64GB ROM Android 16', 'smartphones', 136670, 136670, 118000, 60, 0.205, 
 '/assets/products/infinix-smart-20.jpg', 'Infinix Smart 20 features a massive 6.78-inch display, reliable MediaTek processor, 5000mAh battery, DTS audio enhancement, and impressive rear camera setup. Perfect entry-level smartphone for first-time users, students, and daily communication in Nigeria.', 1, unixepoch(), 1, 118000, '/assets/products/infinix-smart-20.jpg', 128000, 4.4, 1, 'Infinix', 1, 0),

('samsung-galaxy-a07', 'Samsung Galaxy A07 6.7" 4GB RAM + 128GB ROM', 'smartphones', 168869, 168869, 145000, 35, 0.21, 
 '/assets/products/samsung-a07.jpg', 'Samsung Galaxy A07 offers a stunning 6.7-inch PLS LCD, dependable Exynos processor, 5000mAh battery with 25W fast charging, triple camera system, and Samsung''s trusted One UI with long-term security updates. A reliable bestseller for quality-conscious buyers.', 1, unixepoch(), 1, 145000, '/assets/products/samsung-a07.jpg', 158000, 4.6, 1, 'Samsung', 1, 1),

('redmi-15c', 'Xiaomi Redmi 15C 6.9" 6GB RAM + 128GB ROM', 'smartphones', 168685, 168685, 142000, 50, 0.22, 
 '/assets/products/redmi-15c.jpg', 'Redmi 15C boasts a huge 6.9-inch display, strong MediaTek Helio processor, massive 7000mAh battery, and AI-enhanced cameras. Excellent for multimedia, heavy daily usage, and gaming with customizable MIUI interface.', 1, unixepoch(), 1, 142000, '/assets/products/redmi-15c.jpg', 155000, 4.5, 0, 'Xiaomi', 0, 1),

('infinix-note-60-pro', 'Infinix Note 60 Pro 8GB RAM + 256GB ROM', 'smartphones', 559000, 559000, 480000, 25, 0.23, 
 '/assets/products/note-60-pro.jpg', 'Premium mid-ranger with 120Hz AMOLED display, advanced camera system with OIS, ultra-fast charging, in-display fingerprint, and sleek premium design. Perfect for photography enthusiasts and power users.', 1, unixepoch(), 1, 480000, '/assets/products/note-60-pro.jpg', 520000, 4.7, 1, 'Infinix', 1, 0),

('tecno-camon-50', 'Tecno Camon 50 8GB RAM + 256GB ROM Android 16', 'smartphones', 445389, 445389, 385000, 30, 0.195, 
 '/assets/products/camon-50.jpg', 'Camera-centric flagship killer with high-resolution sensors, vibrant display, elegant design, and reliable all-day battery. Ideal for content creators, influencers, and photography lovers.', 1, unixepoch(), 1, 385000, '/assets/products/camon-50.jpg', 415000, 4.6, 0, 'Tecno', 0, 1),

('samsung-galaxy-a36', 'Samsung Galaxy A36 6GB RAM + 128GB ROM', 'smartphones', 465317, 465317, 410000, 28, 0.21, 
 '/assets/products/samsung-a36.jpg', 'Mid-range excellence from Samsung featuring vibrant display, long software support, versatile cameras, and premium build. Great balance of features and reliability.', 1, unixepoch(), 1, 410000, '/assets/products/samsung-a36.jpg', 435000, 4.8, 1, 'Samsung', 1, 1),

('poco-x7', 'POCO X7 5G 8GB RAM + 256GB ROM', 'smartphones', 380000, 380000, 330000, 30, 0.205, 
 '/assets/products/poco-x7.jpg', 'Gaming-oriented 5G smartphone with high refresh rate AMOLED display, powerful processor, excellent cooling, and fast charging. Favorite among mobile gamers.', 1, unixepoch(), 1, 330000, '/assets/products/poco-x7.jpg', 355000, 4.6, 1, 'POCO', 0, 1),

('samsung-a26', 'Samsung Galaxy A26 5G 6GB RAM + 128GB', 'smartphones', 293183, 293183, 255000, 32, 0.21, 
 '/assets/products/samsung-a26.jpg', '5G-ready mid-range Samsung with excellent camera system, smooth performance, and long software support. Strong all-rounder.', 1, unixepoch(), 1, 255000, '/assets/products/samsung-a26.jpg', 270000, 4.6, 1, 'Samsung', 1, 1),

('infinix-hot-50-pro', 'Infinix Hot 50 Pro 8GB RAM + 256GB', 'smartphones', 340000, 340000, 295000, 40, 0.22, 
 '/assets/products/hot-50-pro.jpg', 'Stylish and powerful device with high refresh rate display, strong gaming performance, and premium camera features.', 1, unixepoch(), 1, 295000, '/assets/products/hot-50-pro.jpg', 315000, 4.5, 0, 'Infinix', 0, 1),

-- iPhones
('iphone-16-pro-max-256', 'Apple iPhone 16 Pro Max 256GB', 'smartphones', 1999000, 1999000, 1750000, 15, 0.23, 
 '/assets/products/iphone-16-pro-max.jpg', 'Flagship iPhone 16 Pro Max with A18 Pro chip, stunning 6.9" Super Retina XDR display, advanced camera system with 48MP fusion camera, titanium design, and exceptional battery life. Premium choice for professionals and content creators in Nigeria.', 1, unixepoch(), 1, 1750000, '/assets/products/iphone-16-pro-max.jpg', 1890000, 4.9, 1, 'Apple', 1, 1),

('iphone-16-pro-128', 'Apple iPhone 16 Pro 128GB', 'smartphones', 1450000, 1450000, 1280000, 18, 0.20, 
 '/assets/products/iphone-16-pro.jpg', 'Powerful iPhone 16 Pro featuring A18 Pro, pro camera system, 6.3" display, and titanium build. Ideal for photography and high-performance tasks.', 1, unixepoch(), 1, 1280000, '/assets/products/iphone-16-pro.jpg', 1370000, 4.8, 1, 'Apple', 1, 1),

('iphone-16-128', 'Apple iPhone 16 128GB', 'smartphones', 1350000, 1350000, 1180000, 25, 0.17, 
 '/assets/products/iphone-16.jpg', 'Latest iPhone 16 with A18 chip, excellent camera upgrades, dynamic island, and all-day battery. Perfect everyday premium smartphone.', 1, unixepoch(), 1, 1180000, '/assets/products/iphone-16.jpg', 1270000, 4.8, 1, 'Apple', 1, 1),

('iphone-15-pro-max-256', 'Apple iPhone 15 Pro Max 256GB', 'smartphones', 1250000, 1250000, 1080000, 20, 0.22, 
 '/assets/products/iphone-15-pro-max.jpg', 'iPhone 15 Pro Max with titanium design, powerful A17 Pro chip, and pro-grade cameras. Still a bestseller for its performance and reliability.', 1, unixepoch(), 1, 1080000, '/assets/products/iphone-15-pro-max.jpg', 1180000, 4.7, 1, 'Apple', 1, 0),

('iphone-14-pro-max-256', 'Apple iPhone 14 Pro Max 256GB', 'smartphones', 950000, 950000, 820000, 22, 0.24, 
 '/assets/products/iphone-14-pro-max.jpg', 'Pro-level performance with Dynamic Island, 48MP main camera, and long software support. Excellent value in the premium segment.', 1, unixepoch(), 1, 820000, '/assets/products/iphone-14-pro-max.jpg', 890000, 4.7, 1, 'Apple', 1, 0),

('iphone-13-pro-128', 'Apple iPhone 13 Pro 128GB', 'smartphones', 720000, 720000, 620000, 30, 0.20, 
 '/assets/products/iphone-13-pro.jpg', 'Timeless iPhone 13 Pro with A15 Bionic, pro cameras, and premium build. Popular for its balance of price and capability.', 1, unixepoch(), 1, 620000, '/assets/products/iphone-13-pro.jpg', 680000, 4.6, 0, 'Apple', 1, 0),

('iphone-15-128', 'Apple iPhone 15 128GB', 'smartphones', 850000, 850000, 740000, 28, 0.17, 
 '/assets/products/iphone-15.jpg', 'iPhone 15 with USB-C, Dynamic Island, and improved cameras. Great entry into recent Apple ecosystem.', 1, unixepoch(), 1, 740000, '/assets/products/iphone-15.jpg', 800000, 4.7, 1, 'Apple', 0, 1),

('iphone-14-128', 'Apple iPhone 14 128GB', 'smartphones', 680000, 680000, 590000, 35, 0.17, 
 '/assets/products/iphone-14.jpg', 'Reliable iPhone 14 with excellent battery, crash detection, and smooth iOS experience.', 1, unixepoch(), 1, 590000, '/assets/products/iphone-14.jpg', 640000, 4.6, 0, 'Apple', 1, 0),

-- LAPTOPS
('hp-15s-i5', 'HP 15s Intel Core i5 8GB RAM + 512GB SSD', 'laptops', 850000, 850000, 720000, 15, 1.75, 
 '/assets/products/hp-15s-i5.jpg', 'Reliable everyday performer with 13th Gen Intel Core i5, fast 512GB SSD, vibrant 15.6" FHD display, and solid battery life. Perfect for students, professionals, and office productivity.', 1, unixepoch(), 1, 720000, '/assets/products/hp-15s-i5.jpg', 790000, 4.5, 1, 'HP', 1, 0),

('lenovo-ideapad-3', 'Lenovo IdeaPad 3 Intel Core i5 8GB RAM + 512GB SSD', 'laptops', 750000, 750000, 640000, 20, 1.65, 
 '/assets/products/lenovo-ideapad-3.jpg', 'Versatile laptop with strong performance, ergonomic keyboard, FHD display, and excellent value. Great for multitasking, study, and light creative work.', 1, unixepoch(), 1, 640000, '/assets/products/lenovo-ideapad-3.jpg', 695000, 4.4, 0, 'Lenovo', 1, 1),

('macbook-air-m3', 'MacBook Air M3 13" 16GB RAM + 256GB SSD', 'laptops', 1450000, 1450000, 1320000, 12, 1.24, 
 '/assets/products/macbook-air-m3.jpg', 'Ultra-thin and lightweight powerhouse featuring Apple M3 chip, breathtaking Retina display, up to 18 hours battery life, and premium macOS experience. Ideal for professionals and creatives.', 1, unixepoch(), 1, 1320000, '/assets/products/macbook-air-m3.jpg', 1380000, 4.9, 1, 'Apple', 1, 1),

('dell-latitude-3420', 'Dell Latitude 3420 Intel i5 8GB RAM + 256GB SSD', 'laptops', 650000, 650000, 560000, 18, 1.6, 
 '/assets/products/dell-latitude.jpg', 'Business-grade durable laptop with excellent keyboard, security features, and reliable performance for professionals.', 1, unixepoch(), 1, 560000, '/assets/products/dell-latitude.jpg', 610000, 4.6, 0, 'Dell', 0, 0),

('hp-elitebook-840', 'HP EliteBook 840 G10 Intel i5', 'laptops', 950000, 950000, 820000, 12, 1.4, 
 '/assets/products/hp-elitebook.jpg', 'Business laptop with strong security features, durable build, and excellent keyboard.', 1, unixepoch(), 1, 820000, '/assets/products/hp-elitebook.jpg', 890000, 4.7, 1, 'HP', 1, 0),

('macbook-pro-m4', 'MacBook Pro M4 14-inch', 'laptops', 2450000, 2450000, 2180000, 8, 1.55, 
 '/assets/products/macbook-pro-m4.jpg', 'Pro workstation with M4 chip, Liquid Retina XDR display, and exceptional performance for creatives.', 1, unixepoch(), 1, 2180000, '/assets/products/macbook-pro-m4.jpg', 2320000, 4.9, 1, 'Apple', 1, 1),

-- AUDIO
('oraimo-spacebuds', 'Oraimo SpaceBuds Neo True Wireless Earbuds', 'audio', 17798, 17798, 13500, 120, 0.045, 
 '/assets/products/oraimo-spacebuds.jpg', 'Best-selling affordable TWS earbuds with rich bass, touch controls, long battery life, and comfortable fit. Extremely popular in Nigeria for music and calls.', 1, unixepoch(), 1, 13500, '/assets/products/oraimo-spacebuds.jpg', 16000, 4.5, 1, 'Oraimo', 1, 1),

('jbl-tune-beam', 'JBL Tune Beam Wireless Earbuds', 'audio', 45000, 45000, 38000, 80, 0.05, 
 '/assets/products/jbl-tune-beam.jpg', 'JBL signature powerful sound, IPX4 water resistance, up to 40 hours total playtime, and premium comfort. Excellent for workouts, commuting, and daily use.', 1, unixepoch(), 1, 38000, '/assets/products/jbl-tune-beam.jpg', 41000, 4.6, 0, 'JBL', 0, 1),

('sony-wh-ch720n', 'Sony WH-CH720N Wireless Noise Cancelling Headphones', 'audio', 85000, 85000, 72000, 40, 0.25, 
 '/assets/products/sony-ch720n.jpg', 'Industry-leading noise cancellation, comfortable over-ear fit, exceptional sound quality, and up to 35 hours battery life. Professional choice for travel and focus.', 1, unixepoch(), 1, 72000, '/assets/products/sony-ch720n.jpg', 78000, 4.7, 1, 'Sony', 1, 0),

('realme-buds-t110', 'Realme Buds T110 Wireless Earbuds', 'audio', 8500, 8500, 6500, 130, 0.04, 
 '/assets/products/realme-t110.jpg', 'Budget-friendly wireless earbuds with strong bass, 30-hour playtime, and IPX5 water resistance. Excellent value for daily use.', 1, unixepoch(), 1, 6500, '/assets/products/realme-t110.jpg', 7800, 4.4, 0, 'Realme', 1, 0),

('havit-gaming-headset', 'Havit Gaming Headset with RGB Lighting and Mic', 'audio', 18500, 18500, 14500, 50, 0.35, 
 '/assets/products/havit-gaming.jpg', 'Immersive gaming headset with noise-cancelling mic, RGB lighting, and comfortable over-ear design for long sessions.', 1, unixepoch(), 1, 14500, '/assets/products/havit-gaming.jpg', 16800, 4.4, 0, 'Havit', 0, 1),

('wired-earphones-mic', 'Premium Wired Earphones with Inline Mic', 'audio', 3500, 3500, 2200, 200, 0.03, 
 '/assets/products/wired-earphones.jpg', 'High-quality wired earphones delivering clear sound and convenient inline microphone for calls and media.', 1, unixepoch(), 1, 2200, '/assets/products/wired-earphones.jpg', 3000, 4.3, 0, 'Generic', 1, 0),

('oraimo-freepods-lite', 'Oraimo FreePods Lite True Wireless Earbuds', 'audio', 12000, 12000, 8500, 150, 0.04, 
 '/assets/products/oraimo-freepods-lite.jpg', 'Affordable TWS earbuds with clear sound, touch controls, and long playtime. Top seller for budget-conscious music lovers.', 1, unixepoch(), 1, 8500, '/assets/products/oraimo-freepods-lite.jpg', 10500, 4.5, 1, 'Oraimo', 1, 1),

('oraimo-freepods-pro', 'Oraimo FreePods Pro Wireless Earbuds', 'audio', 25000, 25000, 19500, 120, 0.045, 
 '/assets/products/oraimo-freepods-pro.jpg', 'Premium Oraimo earbuds with deep bass, noise isolation, and IPX5 rating. Excellent for calls and workouts.', 1, unixepoch(), 1, 19500, '/assets/products/oraimo-freepods-pro.jpg', 22500, 4.6, 1, 'Oraimo', 1, 0),

('oraimo-boompop', 'Oraimo BoomPop Wireless Headphones', 'audio', 18500, 18500, 14500, 80, 0.25, 
 '/assets/products/oraimo-boompop.jpg', 'Over-ear headphones with powerful bass and long battery life. Great for immersive listening.', 1, unixepoch(), 1, 14500, '/assets/products/oraimo-boompop.jpg', 16800, 4.4, 0, 'Oraimo', 1, 0),

('bluetooth-speaker-jbl', 'JBL Go 4 Portable Bluetooth Speaker', 'audio', 28000, 28000, 22000, 65, 0.19, 
 '/assets/products/jbl-go4.jpg', 'Iconic portable speaker known for powerful sound, durability, and long battery life in a compact form. Perfect for parties, beach, and travel.', 1, unixepoch(), 1, 22000, '/assets/products/jbl-go4.jpg', 25500, 4.7, 1, 'JBL', 1, 1),

-- POWER BANKS
('baseus-20000mah', 'Baseus 20000mAh PD Fast Charge Power Bank', 'power', 18500, 18500, 14800, 90, 0.38, 
 '/assets/products/baseus-20k.jpg', 'High-capacity power bank with PD fast charging, multiple ports, LED display, and compact build. Must-have for travelers and heavy smartphone users.', 1, unixepoch(), 1, 14800, '/assets/products/baseus-20k.jpg', 16800, 4.6, 1, 'Baseus', 1, 0),

('anker-prime-20k', 'Anker Prime 20000mAh Power Bank', 'power', 28000, 28000, 23500, 70, 0.42, 
 '/assets/products/anker-prime-20k.jpg', 'Premium Anker engineering with ultra-fast charging, smart digital display, and superior durability. Top-rated reliability for demanding users.', 1, unixepoch(), 1, 23500, '/assets/products/anker-prime-20k.jpg', 25500, 4.8, 1, 'Anker', 1, 1),

('xiaomi-33w-powerbank', 'Xiaomi 20000mAh 33W Fast Charge Power Bank', 'power', 16500, 16500, 13000, 85, 0.35, 
 '/assets/products/xiaomi-33w.jpg', 'Reliable high-capacity power bank with fast charging support and slim design. Popular choice for reliable on-the-go power.', 1, unixepoch(), 1, 13000, '/assets/products/xiaomi-33w.jpg', 15000, 4.6, 0, 'Xiaomi', 1, 0),

('newage-22500mah', 'New Age 22500mAh Fast Charge Power Bank', 'power', 15790, 15790, 12500, 200, 0.4, 
 '/assets/products/newage-22500.jpg', 'High capacity power bank with fast charging ports and LED indicator. Excellent value for bulk buyers.', 1, unixepoch(), 1, 12500, '/assets/products/newage-22500.jpg', 14200, 4.3, 0, 'New Age', 1, 0),

('itel-powerpulse-27k', 'itel PowerPulse 27000mAh Power Bank', 'power', 23500, 23500, 18900, 110, 0.45, 
 '/assets/products/itel-27k.jpg', 'Massive capacity power bank designed for heavy users with multiple output ports.', 1, unixepoch(), 1, 18900, '/assets/products/itel-27k.jpg', 21500, 4.5, 0, 'itel', 0, 1),

('oraimo-powerbox-20000', 'Oraimo PowerBox 20000mAh Power Bank', 'power', 18500, 18500, 14800, 110, 0.38, 
 '/assets/products/oraimo-powerbox-20k.jpg', 'Reliable high-capacity power bank with fast charging support. Essential travel companion.', 1, unixepoch(), 1, 14800, '/assets/products/oraimo-powerbox-20k.jpg', 16800, 4.6, 1, 'Oraimo', 1, 0),

('oraimo-powerbox-30000', 'Oraimo PowerBox 30000mAh Power Bank', 'power', 24500, 24500, 19800, 90, 0.45, 
 '/assets/products/oraimo-powerbox-30k.jpg', 'Massive capacity for multiple device charges with fast output.', 1, unixepoch(), 1, 19800, '/assets/products/oraimo-powerbox-30k.jpg', 22500, 4.5, 1, 'Oraimo', 1, 1),

-- CHARGERS
('samsung-45w-charger', 'Samsung 45W Super Fast GaN Charger USB-C', 'chargers', 6500, 6500, 4800, 180, 0.08, 
 '/assets/products/samsung-45w.jpg', 'Official Samsung 45W fast charger compatible with Galaxy phones, tablets, and laptops. Compact, safe, and highly efficient.', 1, unixepoch(), 1, 4800, '/assets/products/samsung-45w.jpg', 5800, 4.7, 1, 'Samsung', 1, 0),

('anker-65w', 'Anker 65W USB-C GaN Charger', 'chargers', 9800, 9800, 7800, 140, 0.12, 
 '/assets/products/anker-65w.jpg', 'Powerful GaN fast charger supporting multiple devices simultaneously. Compact, safe, and ideal for laptops and phones.', 1, unixepoch(), 1, 7800, '/assets/products/anker-65w.jpg', 8800, 4.8, 1, 'Anker', 1, 1),

('samsung-25w-charger', 'Samsung 25W Fast Charger USB-C', 'chargers', 4500, 4500, 3200, 220, 0.07, 
 '/assets/products/samsung-25w.jpg', 'Official Samsung fast charger for efficient and safe charging of Galaxy devices and compatible accessories.', 1, unixepoch(), 1, 3200, '/assets/products/samsung-25w.jpg', 4000, 4.6, 0, 'Samsung', 1, 0),

('cables-3pack', '3-Pack Fast Charging USB-C Cables (2m)', 'chargers', 5500, 5500, 3800, 250, 0.15, 
 '/assets/products/cables-3pack.jpg', 'Durable braided fast charging cables set. Compatible with most modern smartphones and devices.', 1, unixepoch(), 1, 3800, '/assets/products/cables-3pack.jpg', 4800, 4.5, 1, 'Generic', 1, 1),

('baseus-65w-charger', 'Baseus 65W GaN Multi-Port Charger', 'chargers', 12500, 12500, 9800, 100, 0.15, 
 '/assets/products/baseus-65w.jpg', 'High-power GaN charger supporting multiple devices at once. Fast, safe, and travel-friendly.', 1, unixepoch(), 1, 9800, '/assets/products/baseus-65w.jpg', 11200, 4.6, 1, 'Baseus', 1, 0),

('oraimo-33w-charger', 'Oraimo 33W Fast Charger', 'chargers', 6500, 6500, 4800, 200, 0.1, 
 '/assets/products/oraimo-33w.jpg', 'Fast and safe charging adapter compatible with most modern devices.', 1, unixepoch(), 1, 4800, '/assets/products/oraimo-33w.jpg', 5800, 4.6, 0, 'Oraimo', 1, 0),

-- WEARABLES
('apple-watch-se', 'Apple Watch SE 2nd Gen 40mm GPS', 'wearables', 280000, 280000, 245000, 22, 0.036, 
 '/assets/products/apple-watch-se.jpg', 'Advanced fitness and health tracking, beautiful Retina display, seamless iPhone integration, and comprehensive Apple ecosystem features.', 1, unixepoch(), 1, 245000, '/assets/products/apple-watch-se.jpg', 260000, 4.7, 1, 'Apple', 1, 1),

('fitness-smartwatch', 'Advanced Fitness Smart Watch with Heart Rate & SpO2', 'wearables', 12500, 12500, 9500, 75, 0.05, 
 '/assets/products/fitness-watch.jpg', 'Feature-rich smartwatch with multiple sports modes, sleep tracking, notifications, and long battery life. Great affordable health companion.', 1, unixepoch(), 1, 9500, '/assets/products/fitness-watch.jpg', 11000, 4.2, 0, 'Generic', 1, 0),

-- TABLETS
('samsung-tab-a9', 'Samsung Galaxy Tab A9 8.7" 4GB RAM + 64GB', 'tablets', 145000, 145000, 125000, 25, 0.33, 
 '/assets/products/tab-a9.jpg', 'Affordable yet capable tablet with vibrant display, reliable performance, long battery life, and full Samsung ecosystem support. Great for entertainment and education.', 1, unixepoch(), 1, 125000, '/assets/products/tab-a9.jpg', 135000, 4.5, 0, 'Samsung', 1, 0),

('redmi-pad-se', 'Redmi Pad SE 11" Tablet', 'tablets', 185000, 185000, 158000, 25, 0.48, 
 '/assets/products/redmi-pad-se.jpg', 'Affordable entertainment tablet with vibrant display and solid battery life.', 1, unixepoch(), 1, 158000, '/assets/products/redmi-pad-se.jpg', 172000, 4.5, 0, 'Xiaomi', 1, 0),

-- ACCESSORIES
('logitech-m185', 'Logitech Wireless Mouse M185', 'accessories', 8500, 8500, 6200, 90, 0.1, 
 '/assets/products/logitech-mouse.jpg', 'Reliable and comfortable wireless mouse with long battery life and nano USB receiver. Essential accessory for laptops and desktops.', 1, unixepoch(), 1, 6200, '/assets/products/logitech-mouse.jpg', 7500, 4.4, 0, 'Logitech', 0, 0),

('laptop-stand-adjustable', 'Adjustable Aluminum Laptop Stand', 'accessories', 6500, 6500, 4800, 120, 0.65, 
 '/assets/products/laptop-stand.jpg', 'Ergonomic laptop stand with multiple height angles, improved airflow, and portability for better posture and cooling.', 1, unixepoch(), 1, 4800, '/assets/products/laptop-stand.jpg', 5800, 4.5, 0, 'Generic', 0, 0),

('usb-hub-4port', '4-Port USB 3.0 Hub with Fast Data Transfer', 'accessories', 4500, 4500, 3200, 140, 0.08, 
 '/assets/products/usb-hub.jpg', 'Compact USB hub expanding your ports with high-speed data transfer. Ideal for laptops and desktops.', 1, unixepoch(), 1, 3200, '/assets/products/usb-hub.jpg', 4000, 4.4, 0, 'Generic', 1, 0),

('tablet-case-10inch', 'Universal 10" Tablet Protective Case', 'accessories', 8500, 8500, 6200, 95, 0.25, 
 '/assets/products/tablet-case.jpg', 'Durable and stylish protective case with stand function for 10-inch tablets. Shockproof and lightweight.', 1, unixepoch(), 1, 6200, '/assets/products/tablet-case.jpg', 7500, 4.4, 0, 'Generic', 0, 1),

('screen-protector-3pack', 'Tempered Glass Screen Protector 3-Pack (Universal)', 'accessories', 4500, 4500, 2800, 300, 0.05, 
 '/assets/products/screen-protector.jpg', 'High-quality tempered glass protectors offering maximum scratch and impact resistance.', 1, unixepoch(), 1, 2800, '/assets/products/screen-protector.jpg', 3900, 4.3, 1, 'Generic', 1, 0),

('phone-case-samsung', 'Samsung Galaxy Shockproof Protective Case', 'accessories', 6500, 6500, 4800, 180, 0.08, 
 '/assets/products/samsung-case.jpg', 'Military-grade shockproof case with precise cutouts and comfortable grip for Galaxy series.', 1, unixepoch(), 1, 4800, '/assets/products/samsung-case.jpg', 5800, 4.5, 0, 'Samsung', 0, 0),

('apple-pencil-2', 'Apple Pencil 2nd Generation', 'accessories', 95000, 95000, 82000, 45, 0.02, 
 '/assets/products/apple-pencil-2.jpg', 'Precision stylus for iPad with pixel-perfect accuracy, tilt sensitivity, and magnetic charging.', 1, unixepoch(), 1, 82000, '/assets/products/apple-pencil-2.jpg', 88000, 4.8, 0, 'Apple', 1, 0),

('cables-3pack-universal', 'Universal Fast Charging Cable 2m Braided (3-Pack)', 'chargers', 5500, 5500, 3800, 300, 0.15, 
 '/assets/products/cables-3pack.jpg', 'Durable braided USB-C cables set for fast charging across phones, tablets, and accessories. High-volume repeat purchase item.', 1, unixepoch(), 1, 3800, '/assets/products/cables-3pack.jpg', 4800, 4.5, 1, 'Generic', 1, 1);
