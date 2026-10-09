// ======================================================================
// VALIDATION UTILITIES — COMPLETE INTEGRATED VERSION v11.4
// Full validation for staff portal, charging, branches, and more
// ======================================================================

/**
 * Parse cookies from cookie header string
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=');
    const name = parts[0]?.trim();
    const value = parts[1]?.trim();
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * Validate a string value
 */
export function validateString(val, maxLen = 255) {
  if (typeof val !== 'string') return null;
  const trimmed = val.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}

/**
 * Validate an email address
 */
export function validateEmail(email) {
  if (typeof email !== 'string' || email.length > 255) return null;
  const cleaned = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : null;
}

/**
 * Validate a phone number
 */
export function validatePhone(phone) {
  if (typeof phone !== 'string') return null;
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;
  return phoneRegex.test(cleaned) ? cleaned : null;
}

/**
 * Validate a monetary amount
 */
export function validateAmount(amount) {
  const num = Number(amount);
  if (isNaN(num) || num < 0 || num > 10000000) return null;
  return num;
}

/**
 * Validate a UUID string
 */
export function validateUUID(str) {
  if (typeof str !== 'string') return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str) ? str : null;
}

/**
 * Validate a branch ID
 * Branch IDs can be strings (like 'main') or numbers
 */
export function validateBranchId(value) {
  if (!value) return null;
  const str = String(value);
  if (str.length > 50) return null;
  return str;
}

/**
 * Validate a numeric ID (for database IDs)
 */
export function validateNumericId(value) {
  const num = Number(value);
  if (isNaN(num) || num < 0 || !Number.isInteger(num)) return null;
  return num;
}

/**
 * Validate a pagination limit
 */
export function validateLimit(value, max = 100) {
  const num = Number(value);
  if (isNaN(num) || num < 1 || num > max) return null;
  return num;
}

/**
 * Validate a pagination offset
 */
export function validateOffset(value) {
  const num = Number(value);
  if (isNaN(num) || num < 0) return null;
  return num;
}

/**
 * Validate an image upload (base64 data URL)
 */
export function validateImageUpload(imageData, maxSizeMB = 5) {
  if (!imageData || typeof imageData !== 'string') {
    return { valid: false, error: "No image data provided" };
  }
  const estimatedBytes = imageData.length * 0.75;
  if (estimatedBytes > maxSizeMB * 1024 * 1024) {
    return { valid: false, error: `Image too large. Max ${maxSizeMB}MB` };
  }
  const mimeMatch = imageData.match(/^data:image\/(\w+);base64,/);
  if (!mimeMatch || ['jpeg', 'jpg', 'png', 'webp'].indexOf(mimeMatch[1].toLowerCase()) === -1) {
    return { valid: false, error: "Invalid image format. Use JPEG, PNG, or WebP" };
  }
  return { valid: true, mimeType: mimeMatch[1] };
}

/**
 * Validate period parameter
 */
export function validatePeriod(period) {
  const valid = ['today', 'week', 'month', 'year', 'all'];
  return valid.indexOf(period) !== -1 ? period : 'month';
}

/**
 * Validate status against allowed list
 */
export function validateStatus(status, allowedList) {
  if (!status) return null;
  return allowedList.indexOf(status) !== -1 ? status : null;
}

/**
 * Validate charging session status
 */
export function validateChargingStatus(status) {
  const valid = ['charging', 'paused', 'ready', 'completed', 'overnight', 'abandoned'];
  return valid.indexOf(status) !== -1 ? status : null;
}

/**
 * Validate device type
 */
export function validateDeviceType(deviceType) {
  const valid = ['phone', 'laptop', 'tablet', 'powerbank', 'bluetooth', 'smartwatch', 'camera', 'default'];
  return valid.indexOf(deviceType) !== -1 ? deviceType : 'default';
}

/**
 * Validate cable type
 */
export function validateCableType(cableType) {
  const valid = ['USB-C', 'Lightning', 'Micro USB', 'Wireless'];
  return valid.indexOf(cableType) !== -1 ? cableType : 'USB-C';
}

/**
 * Validate payment method
 */
export function validatePaymentMethod(method) {
  const valid = ['cash', 'card', 'transfer', 'wallet', 'paystack'];
  return valid.indexOf(method) !== -1 ? method : 'cash';
}

/**
 * Validate user role
 */
export function validateRole(role) {
  const valid = ['user', 'staff', 'admin', 'manager', 'supervisor'];
  return valid.indexOf(role) !== -1 ? role : null;
}

/**
 * Validate staff role
 */
export function validateStaffRole(role) {
  const valid = ['staff', 'admin', 'manager'];
  return valid.indexOf(role) !== -1 ? role : 'staff';
}

/**
 * Validate score (for staff performance)
 */
export function validateScore(score) {
  const num = Number(score);
  if (isNaN(num) || num < 0 || num > 1000) return null;
  return num;
}

/**
 * Validate battery percentage
 */
export function validateBattery(percentage) {
  const num = Number(percentage);
  if (isNaN(num) || num < 0 || num > 100) return null;
  return num;
}

/**
 * Validate coordinates (latitude/longitude)
 */
export function validateLatitude(lat) {
  const num = Number(lat);
  if (isNaN(num) || num < -90 || num > 90) return null;
  return num;
}

export function validateLongitude(lng) {
  const num = Number(lng);
  if (isNaN(num) || num < -180 || num > 180) return null;
  return num;
}

/**
 * Validate date string (ISO format)
 */
export function validateDate(dateStr) {
  if (typeof dateStr !== 'string') return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

/**
 * Validate URL
 */
export function validateURL(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Validate JSON string
 */
export function validateJSON(str) {
  if (typeof str !== 'string') return null;
  try {
    const parsed = JSON.parse(str);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Validate boolean
 */
export function validateBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return null;
}

/**
 * Validate object (ensure it's a plain object)
 */
export function validateObject(obj) {
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj !== null) {
    return obj;
  }
  return null;
}

/**
 * Validate array
 */
export function validateArray(arr) {
  if (Array.isArray(arr)) return arr;
  return null;
}

/**
 * Validate product category
 */
export function validateCategory(category) {
  const valid = ['smartphones', 'audio', 'laptops', 'accessories', 'power', 'wearables', 'tablets', 'new', 'bestsellers'];
  return valid.indexOf(category) !== -1 ? category : 'all';
}

/**
 * Validate sort option
 */
export function validateSort(sort) {
  const valid = ['default', 'price-asc', 'price-desc', 'rating', 'name-asc', 'name-desc', 'newest'];
  return valid.indexOf(sort) !== -1 ? sort : 'default';
}

/**
 * Validate search query
 */
export function validateSearchQuery(query) {
  if (typeof query !== 'string') return null;
  const cleaned = query.trim().slice(0, 100);
  return cleaned || null;
}

/**
 * Validate invitation code
 */
export function validateInvitationCode(code) {
  if (typeof code !== 'string') return null;
  const cleaned = code.trim().toUpperCase();
  // Format: PSH-INV-TIMESTAMP-RANDOM or PSH-XXXX-XXXX
  const validFormat = /^PSH-(INV-)?[A-Z0-9]{4,12}$/;
  return validFormat.test(cleaned) ? cleaned : null;
}

/**
 * Validate ticket number
 */
export function validateTicketNumber(ticket) {
  if (typeof ticket !== 'string') return null;
  const cleaned = ticket.trim().toUpperCase();
  // Format: PSH-XXXXXX-XXXX
  const validFormat = /^PSH-[A-Z0-9]{6,8}$/;
  return validFormat.test(cleaned) ? cleaned : null;
}

/**
 * Validate IP address
 */
export function validateIP(ip) {
  if (typeof ip !== 'string') return null;
  // IPv4 or IPv6
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}$/i;
  return ipv4.test(ip) || ipv6.test(ip) ? ip : null;
}

/**
 * Validate user agent string (sanitize)
 */
export function validateUserAgent(ua) {
  if (typeof ua !== 'string') return 'unknown';
  return ua.slice(0, 500);
}

/**
 * Validate fingerprint
 */
export function validateFingerprint(fp) {
  if (typeof fp !== 'string') return null;
  const cleaned = fp.trim().slice(0, 64);
  return cleaned || null;
}

/**
 * Validate expiry time (in seconds)
 */
export function validateExpiry(seconds) {
  const num = Number(seconds);
  if (isNaN(num) || num < 60 || num > 604800) return null; // 1 min to 7 days
  return num;
}

/**
 * Validate multiple fields at once
 */
export function validateFields(data, schema) {
  const errors = {};
  const result = {};
  
  for (const [field, validator] of Object.entries(schema)) {
    const value = data[field];
    const validated = validator(value);
    
    if (validated === null && value !== undefined && value !== null) {
      errors[field] = `Invalid ${field} value`;
    } else if (validated !== null) {
      result[field] = validated;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    data: result,
    errors
  };
}

// ======================================================================
// EXPORT ALL FUNCTIONS
// ======================================================================

export default {
  parseCookies,
  validateString,
  validateEmail,
  validatePhone,
  validateAmount,
  validateUUID,
  validateBranchId,
  validateNumericId,
  validateLimit,
  validateOffset,
  validateImageUpload,
  validatePeriod,
  validateStatus,
  validateChargingStatus,
  validateDeviceType,
  validateCableType,
  validatePaymentMethod,
  validateRole,
  validateStaffRole,
  validateScore,
  validateBattery,
  validateLatitude,
  validateLongitude,
  validateDate,
  validateURL,
  validateJSON,
  validateBoolean,
  validateObject,
  validateArray,
  validateCategory,
  validateSort,
  validateSearchQuery,
  validateInvitationCode,
  validateTicketNumber,
  validateIP,
  validateUserAgent,
  validateFingerprint,
  validateExpiry,
  validateFields
};
