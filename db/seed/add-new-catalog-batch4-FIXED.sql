-- ============================================================
-- BATCH 4: Final Products - PS3, PS4, Remaining Accessories, Cleanup
-- FIXED VERSION
-- ============================================================

-- ============================================================
-- PLAYSTATION 3 & 4 PRODUCTS (INSERTS)
-- ============================================================

-- PlayStation 3 Slim 320GB + 20 Games Bundle (ADD)
INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type)
VALUES ('ps3-slim-320gb-games-bundle', 'Sony PlayStation 3 Slim 320GB + 20 Games Bundle - UK Used - Tested, Controller Included', 'gaming', 185000, 185000, 155000, 5, 3.0, '/assets/products/ps3-slim-320gb-games-bundle.webp', 'Relive gaming history with the iconic PlayStation 3 Slim, a timeless console that defined a generation of interactive entertainment. This 320GB bundle includes a curated library of 20 classic titles spanning action, adventure, racing, and sports genres. The sleek, compact Slim design operates whisper-quiet while delivering Blu-ray playback, HDMI output, and online connectivity via PlayStation Network. With built-in WiFi, DualShock 3 wireless controller, and a vast backward-compatible library, this is the perfect entry point for retro gaming enthusiasts and collectors seeking nostalgic masterpieces. UK Used condition — fully tested, clean exterior, all ports functional, controller included. Note: Specific game titles may vary based on availability.', 1, 1718400000, 1, 155000, '/assets/products/ps3-slim-320gb-games-bundle.webp', 170000, 4.4, 0, 'Sony', 0, 0, 'gadgets');

-- PlayStation 3 Slim Console Only (ADD)
INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type)
VALUES ('ps3-slim-console-only', 'Sony PlayStation 3 Slim Console Only - UK Used - 320GB, Tested, Power Cable Included', 'gaming', 135000, 135000, 112000, 8, 2.5, '/assets/products/ps3-slim-console-only.webp', 'The PlayStation 3 Slim console-only unit is the ideal choice for collectors and those with existing accessories. This compact, energy-efficient revision of the legendary PS3 features a 320GB hard drive, Blu-ray disc drive, HDMI output, and built-in WiFi connectivity. Access the extensive PlayStation Store library of classic PS3, PS2, and PS1 titles, or enjoy the console superb media playback capabilities. A reliable piece of gaming history, tested and ready for immediate setup. UK Used condition — fully tested, all ports and disc drive operational, power cable included. Note: Controller and games not included.', 1, 1718400000, 1, 112000, '/assets/products/ps3-slim-console-only.webp', 122000, 4.3, 0, 'Sony', 0, 0, 'gadgets');

-- PlayStation 4 Standard 500GB (ADD)
INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type)
VALUES ('ps4-standard-500gb-uk-used', 'Sony PlayStation 4 500GB Standard - UK Used - 1 Controller, Tested', 'gaming', 265000, 265000, 225000, 6, 2.8, '/assets/products/ps4-standard-500gb-uk-used.webp', 'The PlayStation 4 revolutionized modern gaming with its powerful x86-64 AMD Jaguar processor and 1.84 TFLOPS graphics performance. This 500GB standard edition delivers access to an unparalleled library of exclusive masterpieces including God of War, The Last of Us, Spider-Man, and Bloodborne. With 1080p gaming, Blu-ray playback, HDR support, and seamless Share Play functionality, the PS4 remains a formidable gaming platform. The sleek, angular design and quiet operation make it a living room essential. UK Used condition — fully tested, clean exterior, all ports functional, 1 original DualShock 4 controller, HDMI cable, and power cable included.', 1, 1718400000, 1, 225000, '/assets/products/ps4-standard-500gb-uk-used.webp', 245000, 4.6, 0, 'Sony', 0, 0, 'gadgets');

-- ============================================================
-- PLAYSTATION 4 UPDATES
-- ============================================================

-- PlayStation 4 Slim 500GB (UPDATE existing + ADD description)
UPDATE products SET price = 320000, wholesale_price = 275000, reseller_price = 295000, description = 'The PlayStation 4 Slim refines the PS4 experience with a 30% smaller, more energy-efficient chassis without sacrificing performance. The 500GB hard drive stores a substantial library of AAA titles and indie gems, while the upgraded WiFi module ensures stable online multiplayer and PlayStation Plus access. With HDR gaming support, 1080p streaming capabilities, and a whisper-quiet fan design, this is the definitive PS4 revision for discerning gamers. Includes 1 original DualShock 4 controller, HDMI cable, power cable, and USB charging cable. UK Used — fully tested, excellent cosmetic condition.' WHERE id = 'ps4-slim-500gb-new';

-- PlayStation 4 Pro 1TB (UPDATE existing)
UPDATE products SET price = 315000, wholesale_price = 268000, reseller_price = 290000, description = 'The PlayStation 4 Pro is the powerhouse revision that introduced 4K gaming to the console world. With a boosted 4.2 TFLOPS GPU, 1TB storage, and enhanced CPU clock speeds, the PS4 Pro delivers higher resolution, improved frame rates, and supersampled 1080p visuals on compatible titles. HDR support brings games to life with breathtaking color depth, while Boost Mode enhances performance on legacy PS4 games. For gamers seeking the ultimate PS4 experience with the largest storage capacity, this is the definitive choice. UK Used — fully tested, all ports operational, 1 original DualShock 4 controller, HDMI cable, and power cable included.' WHERE id = 'ps4-pro-1tb-uk-used';

-- ============================================================
-- PLAYSTATION 5 PRODUCTS (INSERTS)
-- ============================================================

-- PS5 Digital Edition Standard (ADD)
INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type)
VALUES ('ps5-digital-edition-standard', 'Sony PlayStation 5 Digital Edition - Brand New - 825GB SSD, 1 Controller, 4K 120fps', 'gaming', 920000, 920000, 820000, 6, 4.5, '/assets/products/ps5-digital-edition-standard.webp', 'The PlayStation 5 Digital Edition ushers in a new era of gaming with the revolutionary custom AMD RDNA 2 GPU delivering 10.28 TFLOPS of graphical power. Experience lightning-fast loading with the custom 825GB SSD, ray-traced 4K visuals at 120Hz, and the immersive haptic feedback of the DualSense wireless controller. The 3D AudioTech creates spatial soundscapes that place you inside the game world. Without a disc drive, this sleek, symmetrical design is perfect for digital-first gamers who embrace the PlayStation Store and PlayStation Plus ecosystem. Includes DualSense controller, HDMI 2.1 cable, power cable, USB-C cable, and ASTRO PLAYROOM pre-installed. Brand new, sealed, original Sony packaging, 1-year Sony warranty.', 1, 1718400000, 1, 820000, '/assets/products/ps5-digital-edition-standard.webp', 870000, 4.8, 1, 'Sony', 1, 1, 'gadgets');

-- PS5 Standard Disc Edition (ADD)
INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type)
VALUES ('ps5-standard-disc-edition', 'Sony PlayStation 5 Disc Edition - Brand New - 825GB SSD, 1 Controller, 4K Blu-ray', 'gaming', 980000, 980000, 870000, 5, 4.5, '/assets/products/ps5-standard-disc-edition.webp', 'The PlayStation 5 Disc Edition combines next-generation performance with physical media flexibility. The custom AMD Zen 2 CPU and RDNA 2 GPU deliver 4K ray-traced gaming at up to 120fps, while the ultra-high-speed SSD virtually eliminates loading screens. The 4K UHD Blu-ray drive plays your PS5 and PS4 game discs, 4K movies, and standard Blu-rays. The revolutionary DualSense controller with adaptive triggers and haptic feedback creates tactile sensations that mirror in-game actions. With 3D AudioTech, Tempest Engine, and backward compatibility with thousands of PS4 titles, this is the complete next-gen package. Includes DualSense controller, HDMI 2.1 cable, power cable, USB-C cable, and ASTRO PLAYROOM. Brand new, sealed, original Sony packaging, 1-year Sony warranty.', 1, 1718400000, 1, 870000, '/assets/products/ps5-standard-disc-edition.webp', 925000, 4.8, 1, 'Sony', 1, 1, 'gadgets');

-- PS5 Slim Disc Edition Europe (ADD)
INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type)
VALUES ('ps5-slim-disc-europe', 'Sony PlayStation 5 Slim Disc Edition - Europe Import - 1TB, 30% Smaller, 4K Blu-ray', 'gaming', 1020000, 1020000, 920000, 5, 3.2, '/assets/products/ps5-slim-disc-europe.webp', 'The PlayStation 5 Slim Disc Edition reimagines next-gen gaming in a remarkably compact 30% smaller chassis. Despite the reduced footprint, it retains the full 1TB SSD performance, 4K ray-traced gaming capability, and 4K UHD Blu-ray drive of its larger sibling. The detachable disc drive offers modular flexibility, while the improved cooling system ensures whisper-quiet operation during intensive gaming sessions. With the DualSense controller, 3D AudioTech, and full PS5 game library access, this is the refined future of PlayStation. Europe import with physical disc drive. Includes DualSense controller, HDMI 2.1 cable, power cable, and USB-C cable. Brand new, sealed, original Sony packaging, 1-year Sony warranty.', 1, 1718400000, 1, 920000, '/assets/products/ps5-slim-disc-europe.webp', 970000, 4.8, 0, 'Sony', 0, 1, 'gadgets');

-- PS5 Slim Digital Edition Europe (ADD)
INSERT OR REPLACE INTO products (id, name, category, basePrice, price, wholesalePrice, stock, weightKg, image, description, active, createdAt, wholesale_available, wholesale_price, image_url, reseller_price, rating, featured, brand, is_bestseller, is_new, store_type)
VALUES ('ps5-slim-digital-europe', 'Sony PlayStation 5 Slim Digital Edition - Europe Import - 1TB, 30% Smaller', 'gaming', 950000, 950000, 850000, 6, 2.9, '/assets/products/ps5-slim-digital-europe.webp', 'The PlayStation 5 Slim Digital Edition delivers uncompromising next-gen performance in an elegantly compact form factor. The 30% smaller design houses a 1TB custom SSD, AMD RDNA 2 ray-tracing GPU, and the revolutionary DualSense controller with haptic feedback and adaptive triggers. Without the disc drive, this is the purest digital gaming experience — perfect for PlayStation Store enthusiasts and PlayStation Plus subscribers. The improved thermal design ensures sustained peak performance during marathon gaming sessions. Europe import. Includes DualSense controller, HDMI 2.1 cable, power cable, and USB-C cable. Brand new, sealed, original Sony packaging, 1-year Sony warranty.', 1, 1718400000, 1, 850000, '/assets/products/ps5-slim-digital-europe.webp', 900000, 4.8, 0, 'Sony', 0, 1, 'gadgets');

-- ============================================================
-- PLAYSTATION 5 PRO UPDATE
-- ============================================================

-- PS5 Pro 2TB (UPDATE existing)
UPDATE products SET price = 1550000, wholesale_price = 1350000, reseller_price = 1450000, description = 'The PlayStation 5 Pro is the most powerful console ever created by Sony. Featuring a 45% faster GPU with advanced ray tracing architecture, AI-driven upscaling via PlayStation Spectral Super Resolution, and a massive 2TB SSD, this console delivers 8K gaming support and enhanced 4K performance at 60fps and beyond. The 2TB storage accommodates extensive game libraries, while the advanced cooling system maintains peak performance silently. With WiFi 7 connectivity, 8K video output, and enhanced DualSense wireless controller support, this is the definitive console for enthusiasts who demand absolute performance. Brand new, sealed, original Sony packaging, 1-year Sony warranty.' WHERE id = 'ps5-pro-console';

-- ============================================================
-- AIRPODS UPDATES
-- ============================================================

-- AirPods Max USB-C (UPDATE existing)
UPDATE products SET price = 880000, wholesale_price = 780000, reseller_price = 830000, description = 'The AirPods Max with USB-C are the ultimate over-ear listening experience. The Apple-designed dynamic driver delivers high-fidelity audio with rich, detailed sound across the entire frequency range. Active Noise Cancellation blocks external noise, while Transparency mode lets you hear your surroundings. Computational audio with the H1 chip in each ear cup, Adaptive EQ, and Spatial Audio with dynamic head tracking create an immersive theater-like experience. The knit mesh canopy and memory foam ear cushions ensure exceptional comfort for extended listening. With 20 hours of battery life and a sleek Smart Case, these are the pinnacle of personal audio luxury. USB-C charging for universal convenience. Brand new, sealed, original Apple packaging, 1-year Apple warranty.' WHERE id = 'apple-airpods-max-usb-c';

-- AirPods 4 Standard (UPDATE existing)
UPDATE products SET price = 275000, wholesale_price = 235000, reseller_price = 255000, description = 'Experience the next evolution of wireless audio with Apple AirPods 4. Featuring the H2 chip for advanced computational audio, these earbuds deliver rich, detailed sound with Personalized Spatial Audio and dynamic head tracking. The redesigned contour ensures a comfortable, secure fit for all-day wear. Force sensor controls, IP54 sweat and water resistance, and up to 30 hours of total listening time with the USB-C charging case make these the perfect everyday audio companion. Seamless pairing, automatic switching, and Hey Siri voice activation complete the effortless Apple ecosystem experience. Brand new, sealed, original Apple packaging, 1-year Apple warranty.' WHERE id = 'apple-airpods-4';

-- AirPods 4 ANC (UPDATE existing)
UPDATE products SET price = 290000, wholesale_price = 248000, reseller_price = 268000, description = 'Immerse yourself in silence with AirPods 4 featuring Active Noise Cancellation. The H2 chip powers Adaptive Audio, which dynamically blends Transparency mode and ANC based on your environment. Personalized Spatial Audio with dynamic head tracking places sound all around you, while the improved acoustic architecture delivers deeper bass and clearer highs. The USB-C charging case supports wireless charging and provides up to 30 hours of total battery life. With IP54 rating and precision finding, these are the most advanced standard AirPods ever created. Brand new, sealed, original Apple packaging, 1-year Apple warranty.' WHERE id = 'apple-airpods-4-anc';

-- AirPods Pro 2 USB-C (UPDATE existing)
UPDATE products SET price = 300000, wholesale_price = 255000, reseller_price = 278000, description = 'The AirPods Pro 2 with USB-C represents the gold standard of wireless audio. The H2 chip delivers up to 2x more Active Noise Cancellation, while Adaptive Transparency reduces loud environmental noise in real time. Personalized Spatial Audio, Customizable Volume Control, and Precision Finding with the U1 chip create an unparalleled listening experience. The MagSafe Charging Case with USB-C, Apple Watch charger compatibility, and built-in speaker for location alerts ensures you never lose your AirPods. With up to 6 hours of listening time and IP54 rating, these are engineered for audiophiles. Brand new, sealed, original Apple packaging, 1-year Apple warranty.' WHERE id = 'apple-airpods-pro-2nd-gen-usb-c';

-- ============================================================
-- POWER BANK UPDATES
-- ============================================================

-- Oraimo 20000mAh Power Bank (UPDATE existing)
UPDATE products SET price = 28000, wholesale_price = 23000, reseller_price = 25000 WHERE id = 'oraimo-powerbox-20000';

-- Oraimo 27000mAh Power Bank (UPDATE existing)
UPDATE products SET price = 38000, wholesale_price = 31000, reseller_price = 34500 WHERE id = 'oraimo-powerbox-30000';

-- itel 27000mAh Power Bank (UPDATE existing)
UPDATE products SET price = 28000, wholesale_price = 23000, reseller_price = 25500 WHERE id = 'itel-powerpulse-27000';
UPDATE products SET price = 28000, wholesale_price = 23000, reseller_price = 25500 WHERE id = 'itel-powerpulse-27k';

-- itel 20000mAh Power Bank (UPDATE existing)
UPDATE products SET price = 19500, wholesale_price = 16000, reseller_price = 17500 WHERE id = 'itel-powerpulse-20000-22w';

-- ============================================================
-- FINAL CLEANUP: Deactivate old duplicate products
-- ============================================================
UPDATE products SET active = 0 WHERE id IN (
    'infinix-smart-20', 'tecno-pop-20', 'redmi-15c', 'samsung-galaxy-a07',
    'tecno-camon-50', 'infinix-note-60-pro', 'samsung-galaxy-a36',
    'infinix-hot-50-pro', 'iphone-14-128', 'iphone-15-128', 'iphone-16-128',
    'iphone-13-pro-128', 'iphone-14-pro-max-256', 'iphone-15-pro-max-256',
    'iphone-16-pro-max-256', 'iphone-16-pro-128', 'dell-latitude-3420',
    'hp-elitebook-840', 'havit-gaming-headset', 'wired-earphones-mic',
    'bluetooth-speaker-jbl', 'baseus-20000mah', 'xiaomi-33w-powerbank',
    'newage-22500mah', 'itel-powerpulse-27k', 'samsung-45w-charger',
    'samsung-25w-charger', 'baseus-65w-charger', 'fitness-smartwatch',
    'samsung-tab-a9', 'logitech-m185', 'laptop-stand-adjustable',
    'usb-hub-4port', 'poco-x7', 'apple-pencil-2'
);

-- ============================================================
-- VERIFY COUNTS
-- ============================================================
SELECT store_type, COUNT(*) as total, COUNT(CASE WHEN active = 1 THEN 1 END) as active_count 
FROM products GROUP BY store_type;
