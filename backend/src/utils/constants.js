// ======================================================================
// FILE: primeshieldhub/backend/src/utils/constants.js
// DESCRIPTION: Centralized constants & configuration for PrimeShieldHub
// ======================================================================

// ======================================================================
// 1. SITE & APPLICATION CONFIGURATION
// ======================================================================

export const SITE_URL = 'https://primeshieldhub.com';
export const API_URL = 'https://api.primeshieldhub.com/api';
export const APP_NAME = 'PrimeShieldHub';
export const APP_VERSION = '13.3.0';

// ======================================================================
// 2. SECURITY & AUTHENTICATION
// ======================================================================

export const MAX_REQUEST_SIZE = 1048576; // 1MB
export const PBKDF2_ITERATIONS = 100000;
export const JWT_EXPIRY = 86400; // 24 hours in seconds
export const JWT_REFRESH_EXPIRY = 604800; // 7 days in seconds
export const BCRYPT_ROUNDS = 12;
export const SESSION_TIMEOUT = 3600; // 1 hour in seconds

// ======================================================================
// 3. CORS & ALLOWED ORIGINS
// ======================================================================

export const ALLOWED_ORIGINS = [
  // Production
  'https://primeshieldhub.com',
  'https://www.primeshieldhub.com',
  'https://api.primeshieldhub.com',
  
  // Cloudflare Pages
  'https://primeshieldhub.pages.dev',
  'https://staging.primeshieldhub-v2.pages.dev',
  'https://develop.primeshieldhub-v2.pages.dev',
  
  // Local development
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:8080',
  
  // Deployment platforms
  'https://primeshieldhub.netlify.app',
  'https://primeshieldhub.vercel.app',
  'https://primeshieldhub-git-main.vercel.app'
];

// ======================================================================
// 4. NIGERIA CITY COORDINATES
// ======================================================================

export const CITY_COORDS = {
  // Major Cities
  'lagos': { lat: 6.5244, lng: 3.3792 },
  'abuja': { lat: 9.0765, lng: 7.3986 },
  'kano': { lat: 12.0022, lng: 8.5920 },
  'ibadan': { lat: 7.3775, lng: 3.9470 },
  'kaduna': { lat: 10.5264, lng: 7.4388 },
  'port harcourt': { lat: 4.8156, lng: 7.0498 },
  'benin city': { lat: 6.3350, lng: 5.6037 },
  
  // South-South
  'rivers': { lat: 4.8156, lng: 7.0498 },
  'edo': { lat: 6.3350, lng: 5.6037 },
  'warri': { lat: 5.5174, lng: 5.7506 },
  'calabar': { lat: 4.9517, lng: 8.3220 },
  'uyo': { lat: 5.0513, lng: 7.9335 },
  
  // South-East
  'owerri': { lat: 5.4836, lng: 7.0333 },
  'aba': { lat: 5.1066, lng: 7.3667 },
  'awka': { lat: 6.2105, lng: 7.0723 },
  'enugu': { lat: 6.4584, lng: 7.5464 },
  'abakaliki': { lat: 6.3249, lng: 8.1137 },
  'asaba': { lat: 6.1983, lng: 6.7274 },
  
  // South-West
  'akure': { lat: 7.2571, lng: 5.2058 },
  'osogbo': { lat: 7.7710, lng: 4.5567 },
  'ilorin': { lat: 8.4966, lng: 4.5426 },
  
  // North-Central
  'jos': { lat: 9.8965, lng: 8.8583 },
  'minna': { lat: 9.6154, lng: 6.5476 },
  
  // North-East
  'maiduguri': { lat: 11.8469, lng: 13.1571 },
  'bauchi': { lat: 10.3103, lng: 9.8439 },
  
  // North-West
  'katsina': { lat: 12.9908, lng: 7.6171 },
  'sokoto': { lat: 13.0626, lng: 5.2337 },
  'zaria': { lat: 11.0796, lng: 7.7199 }
};

// ======================================================================
// 5. PRODUCT & INVENTORY
// ======================================================================

export const CABLE_TYPES = ['USB-C', 'Micro-USB', 'Lightning', 'Wireless'];

export const PRODUCT_CATEGORIES = [
  'Cables',
  'Chargers',
  'Adapters',
  'Power Banks',
  'Cases',
  'Screen Protectors',
  'Audio',
  'Smart Home',
  'Gaming',
  'Accessories'
];

export const PRODUCT_STATUSES = ['draft', 'published', 'out_of_stock', 'discontinued'];

// ======================================================================
// 6. USER & STAFF ROLES
// ======================================================================

export const STAFF_ROLES = ['staff', 'admin', 'super_admin'];
export const USER_ROLES = ['user', 'premium', 'enterprise', 'staff', 'admin'];
export const USER_STATUSES = ['active', 'inactive', 'suspended', 'banned'];

// ======================================================================
// 7. ORDER MANAGEMENT
// ======================================================================

export const ORDER_STATUSES = [
  'pending',
  'processing',
  'shipped',
  'in_transit',
  'delivered',
  'cancelled',
  'completed',
  'refunded'
];

export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded', 'cancelled'];
export const PAYMENT_METHODS = ['card', 'bank_transfer', 'wallet', 'cash_on_delivery'];

// ======================================================================
// 8. INVESTOR & FUNDING
// ======================================================================

export const INVESTOR_STATUSES = [
  'pending',
  'contacted',
  'qualified',
  'converted',
  'rejected'
];

export const INVESTMENT_TYPES = ['angel', 'seed', 'series_a', 'series_b', 'venture'];
export const INVESTMENT_RANGES = [
  { min: 5000, max: 25000, label: 'Seed' },
  { min: 25000, max: 100000, label: 'Angel' },
  { min: 100000, max: 500000, label: 'Series A' },
  { min: 500000, max: 2000000, label: 'Series B+' }
];

// ======================================================================
// 9. API & RATE LIMITING
// ======================================================================

export const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standard: 50,
  premium: 200,
  enterprise: 500
};

export const API_ENDPOINTS = {
  auth: '/auth',
  users: '/users',
  products: '/products',
  orders: '/orders',
  payments: '/payments',
  investors: '/investors',
  analytics: '/analytics',
  brain: '/brain'
};

// ======================================================================
// 10. CACHE & STORAGE
// ======================================================================

export const CACHE_TTL = {
  products: 3600, // 1 hour
  categories: 86400, // 24 hours
  user: 300, // 5 minutes
  analytics: 1800 // 30 minutes
};

export const REDIS_KEYS = {
  session: 'session:',
  user: 'user:',
  product: 'product:',
  cart: 'cart:',
  rateLimit: 'rate_limit:'
};

// ======================================================================
// 11. EMAIL & NOTIFICATIONS
// ======================================================================

export const EMAIL_TEMPLATES = {
  welcome: 'welcome',
  verification: 'verification',
  password_reset: 'password_reset',
  order_confirmation: 'order_confirmation',
  shipping_update: 'shipping_update',
  invoice: 'invoice'
};

export const NOTIFICATION_TYPES = ['email', 'sms', 'push', 'in_app'];

// ======================================================================
// 12. FEATURE FLAGS
// ======================================================================

export const FEATURES = {
  enable3D: true,
  enableAI: true,
  enableWallet: false,
  enableBeta: false,
  enableAnalytics: true,
  enableReferrals: false,
  enableBulkDiscounts: true
};

// ======================================================================
// 13. REGEX PATTERNS
// ======================================================================

export const PATTERNS = {
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  PHONE: /^(\+234|0)[7-9][0-1][0-9]{8}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  NIN: /^[0-9]{11}$/,
  BVN: /^[0-9]{11}$/,
  URL: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
};

// ======================================================================
// 14. ERROR CODES
// ======================================================================

export const ERROR_CODES = {
  // Client Errors (4xx)
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  
  // Server Errors (5xx)
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
};

export const ERROR_MESSAGES = {
  [400]: 'Bad Request',
  [401]: 'Unauthorized - Please login',
  [403]: 'Forbidden - Insufficient permissions',
  [404]: 'Resource not found',
  [409]: 'Conflict - Resource already exists',
  [422]: 'Validation error',
  [429]: 'Too many requests - Please slow down',
  [500]: 'Internal server error',
  [503]: 'Service unavailable',
  [504]: 'Gateway timeout'
};

// ======================================================================
// 15. EXPORT ALL
// ======================================================================

export default {
  // App Config
  SITE_URL,
  API_URL,
  APP_NAME,
  APP_VERSION,
  
  // Security
  MAX_REQUEST_SIZE,
  PBKDF2_ITERATIONS,
  JWT_EXPIRY,
  JWT_REFRESH_EXPIRY,
  BCRYPT_ROUNDS,
  SESSION_TIMEOUT,
  
  // CORS
  ALLOWED_ORIGINS,
  
  // Location
  CITY_COORDS,
  
  // Products
  CABLE_TYPES,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  
  // Users
  STAFF_ROLES,
  USER_ROLES,
  USER_STATUSES,
  
  // Orders
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  PAYMENT_METHODS,
  
  // Investors
  INVESTOR_STATUSES,
  INVESTMENT_TYPES,
  INVESTMENT_RANGES,
  
  // API
  RATE_LIMIT,
  API_ENDPOINTS,
  
  // Cache
  CACHE_TTL,
  REDIS_KEYS,
  
  // Notifications
  EMAIL_TEMPLATES,
  NOTIFICATION_TYPES,
  
  // Features
  FEATURES,
  
  // Patterns
  PATTERNS,
  
  // Errors
  ERROR_CODES,
  ERROR_MESSAGES
};
