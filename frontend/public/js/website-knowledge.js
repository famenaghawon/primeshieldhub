// ============================================================================
// website-knowledge.js — PrimeShieldHub Knowledge Base for AI Chatbot v2.0
// Now integrated with CONFIG for dynamic data
// ============================================================================

import { CONFIG } from './config.js';

// ============================================================================
// COMPANY INFO (from CONFIG)
// ============================================================================

const COMPANY = {
    name: "PrimeShieldHub Gadgets Limited",
    tagline: "Nigeria's Premium Gadget Supply Chain with Quantum Authentication",
    rcNumber: "RC 9283954",
    tin: "2621297539968",
    founded: "2026",
    headquarters: "Lagos, Nigeria (Victoria Island)",
    mission: "To provide authentic, high-quality gadgets and accessories to Nigerians with nationwide delivery and verified reseller opportunities.",
    contact: {
        phone: CONFIG.SUPPORT_PHONE || "+234 810 353 5978",
        email: "contact@primeshieldhub.com",
        whatsapp: `https://wa.me/${(CONFIG.SUPPORT_PHONE || '2348103535978').replace(/[^0-9]/g, '')}`,
        hours: "24/7 Support"
    }
};

// ============================================================================
// PRODUCT CATALOG (FULL)
// ============================================================================

const PRODUCTS = {
    categories: [
        { id: 'smartphones', name: "Smartphones", icon: "📱", emoji: "📱", description: "Latest iPhones, Samsung Galaxy, Google Pixel, OnePlus, and more. All 100% authentic with manufacturer warranty." },
        { id: 'audio', name: "Audio Devices", icon: "🎧", emoji: "🎧", description: "AirPods, Sony headphones, JBL speakers, Bluetooth headsets, and professional audio equipment." },
        { id: 'laptops', name: "Laptops", icon: "💻", emoji: "💻", description: "MacBooks, Dell XPS, HP Spectre, Lenovo ThinkPads for business and personal use." },
        { id: 'accessories', name: "Accessories", icon: "🔌", emoji: "🔌", description: "Chargers, cables, screen protectors, cases, mounts, and adapters." },
        { id: 'power', name: "Power Banks", icon: "🔋", emoji: "🔋", description: "High-capacity portable chargers from Anker, Xiaomi, and other premium brands." },
        { id: 'wearables', name: "Wearables", icon: "⌚", emoji: "⌚", description: "Apple Watch, Samsung Galaxy Watch, Fitbit, and smart bands." },
        { id: 'tablets', name: "Tablets", icon: "📋", emoji: "📋", description: "iPad, Samsung Galaxy Tab, and premium Android tablets." }
    ],
    authenticity: "Every device comes with a unique QR code for blockchain verification. Scan to confirm authenticity.",
    warranty: "All products include manufacturer warranty (1-2 years depending on brand). Extended warranty available.",
    pricing: {
        retail: "Standard pricing for all customers",
        reseller: "Up to 25% off retail pricing for verified resellers",
        wholesale: "Volume discounts available for corporate orders (contact for quote)"
    },
    
    // ===== FULL PRODUCT LIST =====
    list: [
        // SMARTPHONES
        { id: 'iphone-15-pro-max', name: "iPhone 15 Pro Max", price: "₦1,850,000", category: "Smartphones", inStock: true, brand: "Apple", image: "/assets/products/iphone-15-pro-max.webp", keywords: ["iphone", "15", "pro max", "apple"], rating: 4.9, isNew: true },
        { id: 'iphone-15-pro', name: "iPhone 15 Pro", price: "₦1,550,000", category: "Smartphones", inStock: true, brand: "Apple", image: "/assets/products/iphone-15-pro.webp", keywords: ["iphone", "15", "pro", "apple"], rating: 4.8, isNew: true },
        { id: 'iphone-15-plus', name: "iPhone 15 Plus", price: "₦1,350,000", category: "Smartphones", inStock: true, brand: "Apple", image: "/assets/products/iphone-15-plus.webp", keywords: ["iphone", "15", "plus", "apple"], rating: 4.7, isNew: true },
        { id: 'iphone-15', name: "iPhone 15", price: "₦1,150,000", category: "Smartphones", inStock: true, brand: "Apple", image: "/assets/products/iphone-15.webp", keywords: ["iphone", "15", "apple"], rating: 4.6, isNew: true },
        { id: 'iphone-14-pro-max', name: "iPhone 14 Pro Max", price: "₦1,450,000", category: "Smartphones", inStock: true, brand: "Apple", image: "/assets/products/iphone-14-pro-max.webp", keywords: ["iphone", "14", "pro max", "apple"], rating: 4.8 },
        { id: 'iphone-14', name: "iPhone 14", price: "₦950,000", category: "Smartphones", inStock: true, brand: "Apple", image: "/assets/products/iphone-14.webp", keywords: ["iphone", "14", "apple"], rating: 4.5 },
        { id: 'samsung-s24-ultra', name: "Samsung Galaxy S24 Ultra", price: "₦1,650,000", category: "Smartphones", inStock: true, brand: "Samsung", image: "/assets/products/s24-ultra.webp", keywords: ["samsung", "s24", "ultra", "galaxy"], rating: 4.9, isNew: true },
        { id: 'samsung-s24-plus', name: "Samsung Galaxy S24+", price: "₦1,350,000", category: "Smartphones", inStock: true, brand: "Samsung", image: "/assets/products/s24-plus.webp", keywords: ["samsung", "s24", "plus", "galaxy"], rating: 4.7, isNew: true },
        { id: 'samsung-s24', name: "Samsung Galaxy S24", price: "₦1,100,000", category: "Smartphones", inStock: true, brand: "Samsung", image: "/assets/products/s24.webp", keywords: ["samsung", "s24", "galaxy"], rating: 4.6, isNew: true },
        { id: 'samsung-s23-ultra', name: "Samsung Galaxy S23 Ultra", price: "₦1,200,000", category: "Smartphones", inStock: true, brand: "Samsung", image: "/assets/products/s23-ultra.webp", keywords: ["samsung", "s23", "ultra", "galaxy"], rating: 4.8 },
        { id: 'samsung-z-fold-5', name: "Samsung Galaxy Z Fold 5", price: "₦2,100,000", category: "Smartphones", inStock: true, brand: "Samsung", image: "/assets/products/z-fold-5.webp", keywords: ["samsung", "fold", "z fold", "galaxy"], rating: 4.7 },
        { id: 'samsung-z-flip-5', name: "Samsung Galaxy Z Flip 5", price: "₦1,300,000", category: "Smartphones", inStock: true, brand: "Samsung", image: "/assets/products/z-flip-5.webp", keywords: ["samsung", "flip", "z flip", "galaxy"], rating: 4.6 },
        { id: 'google-pixel-8-pro', name: "Google Pixel 8 Pro", price: "₦1,200,000", category: "Smartphones", inStock: true, brand: "Google", image: "/assets/products/pixel-8-pro.webp", keywords: ["google", "pixel", "8", "pro"], rating: 4.7, isNew: true },
        { id: 'google-pixel-8', name: "Google Pixel 8", price: "₦850,000", category: "Smartphones", inStock: true, brand: "Google", image: "/assets/products/pixel-8.webp", keywords: ["google", "pixel", "8"], rating: 4.5, isNew: true },
        { id: 'oneplus-12', name: "OnePlus 12", price: "₦950,000", category: "Smartphones", inStock: true, brand: "OnePlus", image: "/assets/products/oneplus-12.webp", keywords: ["oneplus", "12"], rating: 4.6, isNew: true },
        { id: 'oneplus-12r', name: "OnePlus 12R", price: "₦650,000", category: "Smartphones", inStock: true, brand: "OnePlus", image: "/assets/products/oneplus-12r.webp", keywords: ["oneplus", "12r"], rating: 4.4, isNew: true },
        { id: 'xiaomi-14-ultra', name: "Xiaomi 14 Ultra", price: "₦1,100,000", category: "Smartphones", inStock: true, brand: "Xiaomi", image: "/assets/products/xiaomi-14-ultra.webp", keywords: ["xiaomi", "14", "ultra"], rating: 4.5, isNew: true },
        { id: 'nothing-phone-2', name: "Nothing Phone 2", price: "₦550,000", category: "Smartphones", inStock: true, brand: "Nothing", image: "/assets/products/nothing-phone-2.webp", keywords: ["nothing", "phone 2"], rating: 4.3 },

        // AUDIO DEVICES
        { id: 'airpods-pro-2', name: "AirPods Pro 2nd Gen (USB-C)", price: "₦320,000", category: "Audio Devices", inStock: true, brand: "Apple", image: "/assets/products/airpods-pro-2.webp", keywords: ["airpods", "pro", "2nd gen", "usb", "apple"], rating: 4.9, isNew: true },
        { id: 'airpods-3', name: "AirPods 3rd Gen", price: "₦220,000", category: "Audio Devices", inStock: true, brand: "Apple", image: "/assets/products/airpods-3.webp", keywords: ["airpods", "3rd gen", "apple"], rating: 4.6 },
        { id: 'airpods-max', name: "AirPods Max", price: "₦750,000", category: "Audio Devices", inStock: true, brand: "Apple", image: "/assets/products/airpods-max.webp", keywords: ["airpods", "max", "apple"], rating: 4.7 },
        { id: 'galaxy-buds-3-pro', name: "Samsung Galaxy Buds 3 Pro", price: "₦280,000", category: "Audio Devices", inStock: true, brand: "Samsung", image: "/assets/products/buds-3-pro.webp", keywords: ["samsung", "buds", "3", "pro", "galaxy"], rating: 4.5, isNew: true },
        { id: 'sony-wh-1000xm5', name: "Sony WH-1000XM5", price: "₦450,000", category: "Audio Devices", inStock: true, brand: "Sony", image: "/assets/products/wh-1000xm5.webp", keywords: ["sony", "wh", "1000xm5", "headphones"], rating: 4.8 },
        { id: 'sony-wf-1000xm5', name: "Sony WF-1000XM5", price: "₦350,000", category: "Audio Devices", inStock: true, brand: "Sony", image: "/assets/products/wf-1000xm5.webp", keywords: ["sony", "wf", "1000xm5", "earbuds"], rating: 4.7 },
        { id: 'jbl-charge-5', name: "JBL Charge 5", price: "₦180,000", category: "Audio Devices", inStock: true, brand: "JBL", image: "/assets/products/charge-5.webp", keywords: ["jbl", "charge", "5", "speaker"], rating: 4.4 },
        { id: 'jbl-flip-6', name: "JBL Flip 6", price: "₦120,000", category: "Audio Devices", inStock: true, brand: "JBL", image: "/assets/products/flip-6.webp", keywords: ["jbl", "flip", "6", "speaker"], rating: 4.3 },
        { id: 'beats-studio-pro', name: "Beats Studio Pro", price: "₦420,000", category: "Audio Devices", inStock: true, brand: "Beats", image: "/assets/products/beats-studio-pro.webp", keywords: ["beats", "studio", "pro", "headphones"], rating: 4.4 },
        { id: 'beats-fit-pro', name: "Beats Fit Pro", price: "₦250,000", category: "Audio Devices", inStock: true, brand: "Beats", image: "/assets/products/beats-fit-pro.webp", keywords: ["beats", "fit", "pro", "earbuds"], rating: 4.3 },
        { id: 'bose-quietcomfort-ultra', name: "Bose QuietComfort Ultra", price: "₦520,000", category: "Audio Devices", inStock: true, brand: "Bose", image: "/assets/products/bose-qc-ultra.webp", keywords: ["bose", "quietcomfort", "ultra", "headphones"], rating: 4.8 },

        // LAPTOPS
        { id: 'macbook-pro-14-m3', name: "MacBook Pro 14\" M3 Pro", price: "₦3,200,000", category: "Laptops", inStock: true, brand: "Apple", image: "/assets/products/macbook-pro-14.webp", keywords: ["macbook", "pro", "14", "m3", "apple"], rating: 4.9, isNew: true },
        { id: 'macbook-pro-16-m3', name: "MacBook Pro 16\" M3 Max", price: "₦4,800,000", category: "Laptops", inStock: true, brand: "Apple", image: "/assets/products/macbook-pro-16.webp", keywords: ["macbook", "pro", "16", "m3 max", "apple"], rating: 4.9, isNew: true },
        { id: 'macbook-air-15-m3', name: "MacBook Air 15\" M3", price: "₦2,100,000", category: "Laptops", inStock: true, brand: "Apple", image: "/assets/products/macbook-air-15.webp", keywords: ["macbook", "air", "15", "m3", "apple"], rating: 4.7, isNew: true },
        { id: 'macbook-air-13-m3', name: "MacBook Air 13\" M3", price: "₦1,750,000", category: "Laptops", inStock: true, brand: "Apple", image: "/assets/products/macbook-air-13.webp", keywords: ["macbook", "air", "13", "m3", "apple"], rating: 4.6, isNew: true },
        { id: 'dell-xps-15', name: "Dell XPS 15", price: "₦2,400,000", category: "Laptops", inStock: true, brand: "Dell", image: "/assets/products/dell-xps-15.webp", keywords: ["dell", "xps", "15"], rating: 4.5 },
        { id: 'dell-xps-13-plus', name: "Dell XPS 13 Plus", price: "₦1,900,000", category: "Laptops", inStock: true, brand: "Dell", image: "/assets/products/dell-xps-13-plus.webp", keywords: ["dell", "xps", "13", "plus"], rating: 4.4 },
        { id: 'hp-spectre-x360', name: "HP Spectre x360 14", price: "₦1,850,000", category: "Laptops", inStock: true, brand: "HP", image: "/assets/products/hp-spectre.webp", keywords: ["hp", "spectre", "x360", "14"], rating: 4.4 },
        { id: 'lenovo-thinkpad-x1', name: "Lenovo ThinkPad X1 Carbon Gen 11", price: "₦2,200,000", category: "Laptops", inStock: true, brand: "Lenovo", image: "/assets/products/thinkpad-x1.webp", keywords: ["lenovo", "thinkpad", "x1", "carbon"], rating: 4.6 },
        { id: 'asus-rog-zephyrus-g14', name: "ASUS ROG Zephyrus G14", price: "₦1,800,000", category: "Laptops", inStock: true, brand: "ASUS", image: "/assets/products/rog-zephyrus.webp", keywords: ["asus", "rog", "zephyrus", "g14", "gaming"], rating: 4.5 },

        // TABLETS
        { id: 'ipad-pro-12-9', name: "iPad Pro 12.9\" M2", price: "₦1,850,000", category: "Tablets", inStock: true, brand: "Apple", image: "/assets/products/ipad-pro-12-9.webp", keywords: ["ipad", "pro", "12.9", "m2", "apple"], rating: 4.8 },
        { id: 'ipad-pro-11', name: "iPad Pro 11\" M2", price: "₦1,350,000", category: "Tablets", inStock: true, brand: "Apple", image: "/assets/products/ipad-pro-11.webp", keywords: ["ipad", "pro", "11", "m2", "apple"], rating: 4.7 },
        { id: 'ipad-air-5', name: "iPad Air 5th Gen", price: "₦850,000", category: "Tablets", inStock: true, brand: "Apple", image: "/assets/products/ipad-air-5.webp", keywords: ["ipad", "air", "5th", "apple"], rating: 4.6 },
        { id: 'ipad-10', name: "iPad 10th Gen", price: "₦550,000", category: "Tablets", inStock: true, brand: "Apple", image: "/assets/products/ipad-10.webp", keywords: ["ipad", "10th", "apple"], rating: 4.4 },
        { id: 'tab-s9-ultra', name: "Samsung Galaxy Tab S9 Ultra", price: "₦1,500,000", category: "Tablets", inStock: true, brand: "Samsung", image: "/assets/products/tab-s9-ultra.webp", keywords: ["samsung", "tab", "s9", "ultra", "galaxy"], rating: 4.7 },
        { id: 'tab-s9-plus', name: "Samsung Galaxy Tab S9+", price: "₦1,100,000", category: "Tablets", inStock: true, brand: "Samsung", image: "/assets/products/tab-s9-plus.webp", keywords: ["samsung", "tab", "s9", "plus", "galaxy"], rating: 4.6 },

        // WEARABLES
        { id: 'apple-watch-ultra-2', name: "Apple Watch Ultra 2", price: "₦1,200,000", category: "Wearables", inStock: true, brand: "Apple", image: "/assets/products/watch-ultra-2.webp", keywords: ["apple", "watch", "ultra", "2"], rating: 4.8, isNew: true },
        { id: 'apple-watch-series-9', name: "Apple Watch Series 9", price: "₦650,000", category: "Wearables", inStock: true, brand: "Apple", image: "/assets/products/watch-series-9.webp", keywords: ["apple", "watch", "series", "9"], rating: 4.7 },
        { id: 'apple-watch-se-2', name: "Apple Watch SE 2nd Gen", price: "₦380,000", category: "Wearables", inStock: true, brand: "Apple", image: "/assets/products/watch-se-2.webp", keywords: ["apple", "watch", "se"], rating: 4.5 },
        { id: 'galaxy-watch-6-classic', name: "Samsung Galaxy Watch 6 Classic", price: "₦550,000", category: "Wearables", inStock: true, brand: "Samsung", image: "/assets/products/watch-6-classic.webp", keywords: ["samsung", "watch", "6", "classic", "galaxy"], rating: 4.6 },
        { id: 'galaxy-watch-6', name: "Samsung Galaxy Watch 6", price: "₦420,000", category: "Wearables", inStock: true, brand: "Samsung", image: "/assets/products/watch-6.webp", keywords: ["samsung", "watch", "6", "galaxy"], rating: 4.4 },
        { id: 'fitbit-charge-6', name: "Fitbit Charge 6", price: "₦180,000", category: "Wearables", inStock: true, brand: "Fitbit", image: "/assets/products/fitbit-charge-6.webp", keywords: ["fitbit", "charge", "6"], rating: 4.3 },

        // POWER BANKS
        { id: 'anker-26800', name: "Anker PowerCore 26800mAh", price: "₦45,000", category: "Power Banks", inStock: true, brand: "Anker", image: "/assets/products/anker-26800.webp", keywords: ["anker", "powercore", "26800"], rating: 4.6 },
        { id: 'anker-10000', name: "Anker PowerCore 10000mAh", price: "₦22,000", category: "Power Banks", inStock: true, brand: "Anker", image: "/assets/products/anker-10000.webp", keywords: ["anker", "powercore", "10000"], rating: 4.5 },
        { id: 'xiaomi-20000', name: "Xiaomi Mi 50W Power Bank 20000mAh", price: "₦35,000", category: "Power Banks", inStock: true, brand: "Xiaomi", image: "/assets/products/xiaomi-20000.webp", keywords: ["xiaomi", "mi", "power bank", "20000"], rating: 4.4 },
        { id: 'samsung-10000', name: "Samsung 25W Battery Pack 10000mAh", price: "₦28,000", category: "Power Banks", inStock: true, brand: "Samsung", image: "/assets/products/samsung-10000.webp", keywords: ["samsung", "battery", "pack", "10000"], rating: 4.3 },

        // ACCESSORIES
        { id: 'apple-magsafe', name: "Apple MagSafe Charger", price: "₦55,000", category: "Accessories", inStock: true, brand: "Apple", image: "/assets/products/magsafe.webp", keywords: ["apple", "magsafe", "charger"], rating: 4.5 },
        { id: 'apple-20w', name: "Apple 20W USB-C Power Adapter", price: "₦25,000", category: "Accessories", inStock: true, brand: "Apple", image: "/assets/products/apple-20w.webp", keywords: ["apple", "20w", "adapter", "charger"], rating: 4.4 },
        { id: 'samsung-45w', name: "Samsung 45W Super Fast Charger", price: "₦35,000", category: "Accessories", inStock: true, brand: "Samsung", image: "/assets/products/samsung-45w.webp", keywords: ["samsung", "45w", "charger"], rating: 4.4 },
        { id: 'spigen-iphone-case', name: "Spigen Tough Armor Case (iPhone)", price: "₦18,000", category: "Accessories", inStock: true, brand: "Spigen", image: "/assets/products/spigen-case.webp", keywords: ["spigen", "case", "iphone"], rating: 4.3 },
        { id: 'belkin-3-in-1', name: "Belkin 3-in-1 Wireless Charger", price: "₦120,000", category: "Accessories", inStock: true, brand: "Belkin", image: "/assets/products/belkin-3-in-1.webp", keywords: ["belkin", "wireless", "charger", "3 in 1"], rating: 4.4 }
    ]
};

// ============================================================================
// SHIPPING (from CONFIG)
// ============================================================================

const SHIPPING = {
    coverage: "All 36 states in Nigeria plus FCT Abuja",
    timeframe: {
        lagos: "Same-day delivery (orders before 2 PM)",
        majorCities: "1-2 business days (Abuja, Port Harcourt, Kano, Ibadan)",
        otherStates: "2-5 business days"
    },
    cost: {
        lagos: CONFIG.SHIPPING_RATES?.Lagos?.[0]?.price ? `₦${CONFIG.SHIPPING_RATES.Lagos[0].price.toLocaleString()}` : "₦1,500 - ₦3,000",
        nationwide: "₦3,000 - ₦7,000 (depending on location)",
        freeThreshold: "Free delivery on orders over ₦150,000"
    },
    tracking: "Real-time order tracking available at /track-order with your order ID",
    partners: "GIG Logistics, DHL, FedEx, ABC Transport"
};

// ============================================================================
// PAYMENTS
// ============================================================================

const PAYMENTS = {
    methods: [
        "Paystack (Card payment - Visa, Mastercard, Verve)",
        "Bank Transfer (GTBank, Access Bank, First Bank, UBA, Zenith)",
        "USSD Transfer",
        "Cryptocurrency (BTC, ETH, USDT)",
        "Buy Now Pay Later (available for orders over ₦50,000)"
    ],
    currency: "Nigerian Naira (₦)",
    security: "All payments are encrypted with SSL. We use Paystack's PCI-DSS compliant payment gateway."
};

// ============================================================================
// RESELLER PROGRAM
// ============================================================================

const RESELLER = {
    title: "Quantum Reseller Program",
    benefits: [
        "Up to 25% discount on retail prices",
        "Early access to new products",
        "Dedicated account manager",
        "Custom invoicing and credit terms (Net 30/60)",
        "Marketing materials and product images provided",
        "15% commission on referred customers",
        "Access to wholesale portal"
    ],
    requirements: "Must be a registered business in Nigeria with valid identification. Minimum first order of ₦50,000.",
    howToJoin: "Click 'Join Reseller Program' or contact our WhatsApp to apply. Verification takes 24-48 hours.",
    contact: `WhatsApp ${COMPANY.contact.phone} or email ${COMPANY.contact.email}`
};

// ============================================================================
// KNOWLEDGE BASE
// ============================================================================

export const websiteKnowledge = {
    company: COMPANY,
    products: PRODUCTS,
    payments: PAYMENTS,
    delivery: SHIPPING,
    resellerProgram: RESELLER,
    enterprise: {
        solutions: [
            "Corporate Procurement — Volume pricing, dedicated account managers, Net 30/60 terms",
            "Oil & Gas / Ruggedized — ATEX/IECEx certified explosion-proof devices",
            "Government & Defense — FIPS 140-2 certified, secure boot, encrypted devices",
            "FinTech & Banking — PCI-PTS compliant POS terminals, biometric authentication"
        ],
        contact: "Email enterprise@primeshieldhub.com for corporate quotes"
    },
    policies: {
        returns: "7-day return policy for defective items. Item must be in original packaging with all accessories.",
        refunds: "Refunds processed within 5-7 business days after inspection. Refund goes to original payment method.",
        warranty: "Manufacturer warranty applies. We handle warranty claims on your behalf.",
        privacy: "Full GDPR-compliant privacy policy at /privacy. We never share your data with third parties.",
        terms: "Full terms of service at /terms"
    },
    features: {
        quantumAuth: "Blockchain-based device authentication. Every product has a unique digital certificate.",
        aiAssistant: "24/7 AI shopping assistant to help you find the perfect gadget.",
        compare: "Compare up to 4 products side-by-side with our comparison tool.",
        wishlist: "Save products to your wishlist and get notified of price drops.",
        orderTracking: "Real-time order tracking with GPS delivery updates.",
        quantumPoints: "Earn points on every purchase. Redeem for discounts."
    },
    faq: [
        { q: "Are your products authentic?", a: "Yes! Every product is 100% authentic with manufacturer warranty. You can verify authenticity using our blockchain QR code on every device." },
        { q: "How fast is delivery?", a: `Same-day delivery in Lagos (orders before 2 PM). 1-2 business days for major cities. 2-5 business days for other states.` },
        { q: "What payment methods do you accept?", a: "We accept Paystack (cards), bank transfers, USSD, and cryptocurrency (BTC, ETH, USDT). Buy Now Pay Later is available for orders over ₦50,000." },
        { q: "How do I become a reseller?", a: `Click 'Join Reseller Program' or WhatsApp us at ${COMPANY.contact.phone}. Verification takes 24-48 hours.` },
        { q: "Do you offer warranty?", a: "Yes, all products come with manufacturer warranty (1-2 years). We handle warranty claims for you." },
        { q: "Can I return a product?", a: "Yes, we have a 7-day return policy for defective items. Items must be in original packaging." },
        { q: "Do you deliver outside Lagos?", a: "Yes! We deliver to all 36 states in Nigeria plus FCT Abuja. Free delivery on orders over ₦150,000." },
        { q: "Is there a physical store?", a: "We're primarily online but you can schedule a viewing at our Lagos office. Contact support to book." },
        { q: "Do you offer corporate pricing?", a: "Yes! Visit our Enterprise Solutions section or email enterprise@primeshieldhub.com." },
        { q: "How do I track my order?", a: "Visit /track-order and enter your order ID. You'll get real-time tracking updates." },
        { q: "Do you accept cryptocurrency?", a: "Yes! We accept Bitcoin (BTC), Ethereum (ETH), and Tether (USDT) for all purchases." },
        { q: "What brands do you sell?", a: "We stock Apple, Samsung, Google, OnePlus, Xiaomi, Sony, JBL, Bose, Dell, HP, Lenovo, ASUS, Anker, and many more premium brands." }
    ]
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function searchProducts(query) {
    const q = query.toLowerCase().trim();
    const results = [];
    
    for (const product of websiteKnowledge.products.list) {
        const allTerms = [
            product.name.toLowerCase(),
            ...(product.keywords || []),
            product.brand.toLowerCase(),
            product.category.toLowerCase()
        ];
        
        let matchScore = 0;
        for (const term of allTerms) {
            if (q.includes(term)) matchScore += term.length;
            if (term.includes(q)) matchScore += 2;
        }
        
        if (matchScore > 0) {
            results.push({ ...product, matchScore });
        }
    }
    
    results.sort((a, b) => b.matchScore - a.matchScore);
    return results;
}

export function getProductById(id) {
    return websiteKnowledge.products.list.find(p => p.id === id);
}

export function getProductsByCategory(category) {
    return websiteKnowledge.products.list.filter(p => p.category === category && p.inStock);
}

export function getCategories() {
    return websiteKnowledge.products.categories;
}

// ============================================================================
// LOCAL AI RESPONSE
// ============================================================================

export function localAIResponse(message) {
    const msg = message.toLowerCase();
    const k = websiteKnowledge;

    // --- PRODUCT SEARCH ---
    const productMatches = searchProducts(message);
    
    if (productMatches.length > 0) {
        const product = productMatches[0];
        
        if (msg.includes('price') || msg.includes('cost') || msg.includes('how much') || msg.includes('₦')) {
            return `${product.inStock ? '✅' : '❌'} **${product.name}**\n\n💰 **Price**: ${product.price}\n📦 **Status**: ${product.inStock ? 'In Stock' : 'Out of Stock'}\n🏷️ **Category**: ${product.category}\n⭐ **Rating**: ${product.rating || 'N/A'}\n\n${product.inStock ? 'Would you like to place an order? I can help you with that! 🛒' : 'This item is currently out of stock. Would you like me to suggest similar alternatives?'}`;
        }
        
        if (msg.includes('available') || msg.includes('stock') || msg.includes('in stock') || msg.includes('have')) {
            return `${product.inStock ? '✅' : '❌'} **${product.name}** is ${product.inStock ? 'currently IN STOCK' : 'currently OUT OF STOCK'}.\n\n${product.inStock ? `Price: ${product.price}\nReady for immediate delivery! 🚚` : 'Would you like me to suggest similar products that are available?'}`;
        }
        
        const similarProducts = productMatches.slice(0, 4).filter(p => p.name !== product.name);
        let response = `📱 **${product.name}**\n\n💰 **Price**: ${product.price}\n📦 **Status**: ${product.inStock ? '✅ In Stock' : '❌ Out of Stock'}\n🏷️ **Category**: ${product.category}`;
        
        if (similarProducts.length > 0) {
            response += `\n\n📋 **Similar Products**:\n${similarProducts.map(p => `• ${p.name} — ${p.price}`).join('\n')}`;
        }
        
        response += `\n\nAll products are 100% authentic with blockchain verification and manufacturer warranty. 🛡️\n\nWould you like to order or learn more?`;
        return response;
    }

    // --- CATEGORY SEARCH ---
    for (const cat of k.products.categories) {
        if (msg.includes(cat.name.toLowerCase())) {
            const catProducts = k.products.list.filter(p => p.category === cat.name && p.inStock);
            if (catProducts.length > 0) {
                const top5 = catProducts.slice(0, 5);
                return `${cat.icon} **${cat.name}**\n\n${cat.description}\n\n📋 **Available Products**:\n${top5.map(p => `• ${p.name} — ${p.price}`).join('\n')}\n${catProducts.length > 5 ? `\n_...and ${catProducts.length - 5} more!_` : ''}\n\nWhich one interests you? 😊`;
            }
            return `${cat.icon} **${cat.name}**\n\n${cat.description}\n\nBrowse our full ${cat.name.toLowerCase()} collection on the homepage! 🛍️`;
        }
    }

    // --- PAYMENT ---
    if (msg.includes('payment') || msg.includes('pay') || msg.includes('card') || msg.includes('transfer') || msg.includes('crypto') || msg.includes('bitcoin') || msg.includes('usdt')) {
        return `We accept multiple payment methods:\n\n${k.payments.methods.map(m => '• ' + m).join('\n')}\n\nAll payments are secured with SSL encryption and PCI-DSS compliance. Which method would you prefer? 💳`;
    }

    // --- DELIVERY ---
    if (msg.includes('delivery') || msg.includes('shipping') || msg.includes('deliver') || msg.includes('ship') || msg.includes('how long')) {
        return `🚚 **Nationwide Delivery Across All 36 States!**\n\n• **Lagos**: Same-day delivery (orders before 2 PM)\n• **Major Cities** (Abuja, PH, Kano, Ibadan): 1-2 business days\n• **Other States**: 2-5 business days\n\n💰 **Cost**:\n• Lagos: ${SHIPPING.cost.lagos}\n• Nationwide: ${SHIPPING.cost.nationwide}\n• **FREE delivery on orders over ${SHIPPING.cost.freeThreshold}**\n\nTrack your order anytime at /track-order 📍`;
    }

    // --- RESELLER ---
    if (msg.includes('reseller') || msg.includes('wholesale') || msg.includes('bulk') || msg.includes('become a reseller') || msg.includes('join')) {
        return `🌟 **Quantum Reseller Program**\n\nJoin our exclusive reseller network and enjoy:\n\n${k.resellerProgram.benefits.map(b => '• ' + b).join('\n')}\n\n**Requirements**: ${k.resellerProgram.requirements}\n\n**How to Join**: ${k.resellerProgram.howToJoin}\n\nVerification takes 24-48 hours. Ready to start earning? 🚀`;
    }

    // --- WARRANTY / RETURNS ---
    if (msg.includes('warranty') || msg.includes('return') || msg.includes('refund') || msg.includes('guarantee')) {
        return `🛡️ **Warranty & Returns Policy**\n\n• **Warranty**: All products come with manufacturer warranty (1-2 years)\n• **Returns**: 7-day return policy for defective items\n• **Refunds**: Processed within 5-7 business days after inspection\n• Items must be in original packaging with all accessories\n\nWe handle warranty claims on your behalf for a hassle-free experience!`;
    }

    // --- AUTHENTICITY ---
    if (msg.includes('authentic') || msg.includes('original') || msg.includes('fake') || msg.includes('genuine') || msg.includes('verify')) {
        return `✅ **100% Authentic Guarantee**\n\nEvery product sold by PrimeShieldHub is 100% authentic with manufacturer warranty. Each device comes with a unique QR code for blockchain verification — scan it to confirm authenticity instantly!\n\nWe source directly from authorized distributors. No fakes, no clones, no refurbished sold as new. That's our Quantum Promise. 🛡️`;
    }

    // --- CONTACT ---
    if (msg.includes('contact') || msg.includes('support') || msg.includes('help') || msg.includes('whatsapp') || msg.includes('email') || msg.includes('call') || msg.includes('phone')) {
        return `📞 **Contact PrimeShieldHub**\n\n• **WhatsApp**: ${COMPANY.contact.phone} (24/7)\n• **Email**: ${COMPANY.contact.email}\n• **Phone**: ${COMPANY.contact.phone}\n• **HQ**: ${COMPANY.headquarters}\n\nOur support team is available 24/7. We respond to WhatsApp messages within minutes! 💬`;
    }

    // --- ORDER TRACKING ---
    if (msg.includes('track') || msg.includes('order') || msg.includes('where is my') || msg.includes('status')) {
        return `📍 **Track Your Order**\n\nVisit /track-order and enter your Order ID to see real-time tracking updates. You can also track via:\n\n• WhatsApp: ${COMPANY.contact.phone}\n• Email: ${COMPANY.contact.email}\n\nDelivery partners: GIG Logistics, DHL, FedEx, ABC Transport 🚚`;
    }

    // --- ENTERPRISE ---
    if (msg.includes('enterprise') || msg.includes('corporate') || msg.includes('business') || msg.includes('company') || msg.includes('bulk order')) {
        return `🏢 **Quantum Enterprise Solutions**\n\n${k.enterprise.solutions.map(s => '• ' + s).join('\n')}\n\nFor corporate quotes and volume pricing:\n📧 ${k.enterprise.contact}\n📞 ${COMPANY.contact.phone}\n\nOr visit /wholesale.html for more details.`;
    }

    // --- GREETING ---
    if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey') || msg.includes('good morning') || msg.includes('good afternoon') || msg.includes('good evening') || msg === '') {
        return `👋 Hello! I'm your Quantum Assistant at PrimeShieldHub — Nigeria's premium gadget store.\n\nI can help you with:\n• 📱 **Product prices & availability** — Just ask "How much is iPhone 15?"\n• 🚚 Delivery information\n• 💰 Payment methods\n• 🌟 Reseller program details\n• 📍 Order tracking\n• 🛡️ Warranty and returns\n\nWhat would you like to know today?`;
    }

    // --- ABOUT ---
    if (msg.includes('about') || msg.includes('who are you') || msg.includes('company') || msg.includes('primeshieldhub')) {
        return `🏢 **About PrimeShieldHub**\n\nPrimeShieldHub Gadgets Limited (${COMPANY.rcNumber}) is Nigeria's premier supplier of authentic smartphones, laptops, audio devices, and accessories.\n\n• 🇳🇬 Based in Lagos, delivering to all 36 states\n• ✅ 100% authentic products with blockchain verification\n• 🌟 850+ verified resellers nationwide\n• ⭐ 4.92 average customer rating\n• 🚀 Same-day delivery in Lagos\n\nWe're on a mission to make premium gadgets accessible to every Nigerian!`;
    }

    // --- FAQ MATCHES ---
    for (const faq of k.faq) {
        const faqWords = faq.q.toLowerCase().split(' ').slice(0, 4).join(' ');
        if (msg.includes(faqWords)) {
            return faq.a;
        }
    }

    // --- DEFAULT ---
    return `Thanks for your question! Let me help you with that.\n\nYou can ask me about:\n• 📱 Specific product prices (e.g., "How much is iPhone 15 Pro Max?")\n• 🚚 Delivery times & costs\n• 💰 Payment methods\n• 🌟 Reseller program\n• 📍 Order tracking\n\nOr contact us directly:\n💬 WhatsApp: ${COMPANY.contact.phone}\n📧 Email: ${COMPANY.contact.email}\n\nWhat would you like to know? 😊`;
}

// ============================================================================
// BUILD AI CONTEXT
// ============================================================================

export function buildAIContext() {
    const k = websiteKnowledge;

    const productList = k.products.list
        .slice(0, 50)
        .map(p => `${p.name} | ${p.price} | ${p.category} | ${p.inStock ? 'In Stock' : 'Out of Stock'}`)
        .join('\n');

    return `
You are the Quantum Assistant for PrimeShieldHub, Nigeria's premium gadget store.
Use this knowledge to answer customer questions accurately and helpfully.

=== COMPANY INFO ===
Name: ${k.company.name}
HQ: ${k.company.headquarters}
Contact: ${k.company.contact.phone} | ${k.company.contact.email}
Hours: ${k.company.contact.hours}
RC Number: ${k.company.rcNumber}

=== PRODUCT CATEGORIES ===
${k.products.categories.map(c => `- ${c.icon} ${c.name}: ${c.description}`).join('\n')}

=== PRODUCT CATALOG (PRICES & STOCK) ===
${productList}

Authenticity: ${k.products.authenticity}
Warranty: ${k.products.warranty}

=== PRICING ===
${Object.entries(k.products.pricing).map(([key, val]) => `- ${key}: ${val}`).join('\n')}

=== PAYMENT METHODS ===
${k.payments.methods.map(m => `- ${m}`).join('\n')}
Security: ${k.payments.security}

=== DELIVERY ===
Coverage: ${k.delivery.coverage}
Lagos: ${k.delivery.timeframe.lagos}
Major Cities: ${k.delivery.timeframe.majorCities}
Other States: ${k.delivery.timeframe.otherStates}
Cost: ${k.delivery.cost.lagos} (Lagos) | ${k.delivery.cost.nationwide} (Nationwide)
Free delivery: ${k.delivery.freeThreshold}

=== RESELLER PROGRAM ===
${k.resellerProgram.benefits.map(b => `- ${b}`).join('\n')}
Requirements: ${k.resellerProgram.requirements}
How to join: ${k.resellerProgram.howToJoin}

=== ENTERPRISE SOLUTIONS ===
${k.enterprise.solutions.map(s => `- ${s}`).join('\n')}

=== POLICIES ===
Returns: ${k.policies.returns}
Refunds: ${k.policies.refunds}
Warranty: ${k.policies.warranty}

=== IMPORTANT RULES ===
1. Be friendly and helpful. Use emojis occasionally.
2. When asked about product prices, check the catalog above and respond with accurate prices in ₦.
3. Never share security details, passwords, or internal system information.
4. For out-of-stock products, suggest similar alternatives from the catalog.
5. For complex issues, suggest contacting WhatsApp support at ${k.company.contact.phone}.
6. Keep responses concise (2-4 sentences unless detailed explanation needed).
7. Always mention our authenticity guarantee and nationwide delivery.
8. Use Nigerian Naira (₦) for all prices.
`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default websiteKnowledge;
