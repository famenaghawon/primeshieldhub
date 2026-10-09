// intelligence.js - Smart Decision Engine
// Analyzes events and determines notification priority and channels

/**
 * Analyze an event and return decision on how to handle it
 * @param {Object} event - Event object containing type, duration, attempts, paymentStatus, etc.
 * @returns {Object} { priority: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL', channels: ['email'|'sms'|'whatsapp'] }
 */
export function analyzeEvent(event) {
  const { type, duration, attempts, paymentStatus, unplugTime, failedPins, amount } = event;

  let priority = "LOW";
  let channels = [];

  // 🚨 SECURITY EVENTS
  if (type === "UNAUTHORIZED_UNPLUG") {
    priority = "CRITICAL";
    channels = ["sms", "whatsapp", "email"];
  }
  else if (type === "SECURITY_BREACH") {
    priority = "CRITICAL";
    channels = ["sms", "whatsapp", "email"];
  }
  else if (type === "FRAUD_DETECTED") {
    priority = "CRITICAL";
    channels = ["sms", "whatsapp", "email"];
  }

  // 🔌 CHARGING EVENTS
  else if (type === "CHARGING_START") {
    priority = "LOW";
    channels = ["email"]; // optional confirmation
  }
  else if (type === "CHARGING_COMPLETE") {
    priority = "MEDIUM";
    channels = ["email"];
    // If duration was extremely long, escalate
    if (duration && duration > 4 * 60 * 60) { // >4 hours
      priority = "HIGH";
      channels.push("sms");
    }
  }
  else if (type === "CHARGING_OVERDUE") {
    priority = "HIGH";
    channels = ["sms", "email"];
  }

  // ⏱️ TIME-BASED INTELLIGENCE
  else if (type === "OVERDUE") {
    priority = "HIGH";
    channels = ["sms"];
    if (duration && duration > 6 * 60 * 60) { // >6 hours
      priority = "CRITICAL";
      channels.push("whatsapp");
    }
  }

  // 💰 PAYMENT EVENTS
  else if (type === "PAYMENT_SUCCESS") {
    priority = "MEDIUM";
    channels = ["email"];
    // High-value transactions get SMS receipt
    if (amount && amount > 50000) {
      priority = "HIGH";
      channels.push("sms");
    }
  }
  else if (type === "PAYMENT_FAILED") {
    priority = "HIGH";
    channels = ["email", "sms"];
  }
  else if (type === "PAYMENT_PENDING") {
    priority = "LOW";
    channels = ["email"];
  }

  // 🔁 REPEATED FAILURES (across any type)
  if (attempts && attempts > 3) {
    // Escalate priority
    if (priority === "LOW") priority = "MEDIUM";
    else if (priority === "MEDIUM") priority = "HIGH";
    else if (priority === "HIGH") priority = "CRITICAL";
    // Ensure critical channels are added
    if (priority === "CRITICAL") {
      channels = [...new Set([...channels, "sms", "whatsapp"])];
    }
  }

  // 📍 SUSPICIOUS UNPLUG TIME (e.g., unplugged within 1 minute)
  if (unplugTime && unplugTime < 60) {
    priority = "HIGH";
    channels = [...new Set([...channels, "sms"])];
  }

  // 🔐 FAILED PIN ATTEMPTS
  if (failedPins && failedPins > 3) {
    priority = "CRITICAL";
    channels = ["sms", "whatsapp", "email"];
  }

  // Default fallback: at least email for any event
  if (channels.length === 0) {
    channels = ["email"];
  }

  return { priority, channels };
}

/**
 * Generate a human-readable message based on event data
 * @param {Object} event - Event object
 * @returns {string} Formatted message
 */
export function generateMessage(event) {
  const { type, amount, duration, customerName, deviceType, reference, branchId } = event;

  switch (type) {
    case "UNAUTHORIZED_UNPLUG":
      return `🚨 SECURITY ALERT: Device unplug detected without authorization.\nLocation: ${branchId || 'Unknown'}\nImmediate attention required.`;

    case "SECURITY_BREACH":
      return `🚨 CRITICAL: Security breach detected. Multiple failed attempts.\nPlease investigate immediately.`;

    case "FRAUD_DETECTED":
      return `🚨 FRAUD ALERT: Suspicious activity flagged by AI engine.\nBranch: ${branchId || 'N/A'}\nReview staff logs.`;

    case "CHARGING_START":
      return `⚡ Charging started for ${customerName || 'customer'}.\nDevice: ${deviceType || 'Unknown'}\nYour device is secure with PrimeShield.`;

    case "CHARGING_COMPLETE":
      return `✅ Charging complete! Your ${deviceType || 'device'} is fully charged and ready for pickup.\nDuration: ${formatDuration(duration)}\nThank you for using PrimeShield.`;

    case "CHARGING_OVERDUE":
    case "OVERDUE":
      return `⏰ OVERDUE: Device has exceeded charging time (${formatDuration(duration)}).\nPlease pick up your ${deviceType || 'device'} to avoid additional charges.`;

    case "PAYMENT_SUCCESS":
      return `💳 Payment Successful!\nAmount: ₦${amount?.toLocaleString() || 'N/A'}\nReference: ${reference || 'N/A'}\nThank you for your payment.`;

    case "PAYMENT_FAILED":
      return `❌ Payment Failed\nAmount: ₦${amount?.toLocaleString() || 'N/A'}\nPlease try again or use a different method.`;

    case "PAYMENT_PENDING":
      return `⏳ Payment Pending\nAmount: ₦${amount?.toLocaleString() || 'N/A'}\nWe're waiting for confirmation.`;

    case "LOW_REVENUE":
      return `📉 Low revenue detected at branch ${branchId || ''}. Consider promotions.`;

    case "PEAK_HOUR":
      return `📈 Peak hour approaching (${event.hour}:00). Prepare extra capacity.`;

    case "STAFF_SCORE_LOW":
      return `⚠️ Staff ${event.staffName} score dropped to ${event.score}. Review performance.`;

    default:
      return `ℹ️ PrimeShield System Update: ${type}`;
  }
}

/**
 * Format duration in seconds to human-readable string
 */
function formatDuration(seconds) {
  if (!seconds) return 'N/A';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} minutes`;
}

/**
 * Determine if an event should trigger an immediate alert based on anomaly detection
 * @param {Object} sessionData - Session data including duration, amount, etc.
 * @returns {Object} { isAnomaly: boolean, type: string, reason: string }
 */
export function detectAnomaly(sessionData) {
  const { duration, amount, staffScore, averageAmount, averageDuration } = sessionData;

  const anomalies = [];

  // Duration anomalies
  if (duration && averageDuration) {
    if (duration < averageDuration * 0.3) {
      anomalies.push({ type: "SHORT_SESSION", reason: "Unusually short charging session" });
    }
    if (duration > averageDuration * 2.5) {
      anomalies.push({ type: "LONG_SESSION", reason: "Unusually long charging session" });
    }
  }

  // Revenue anomalies
  if (amount && averageAmount) {
    if (amount < averageAmount * 0.5) {
      anomalies.push({ type: "LOW_REVENUE", reason: "Amount significantly below average" });
    }
    if (amount > averageAmount * 2) {
      anomalies.push({ type: "HIGH_REVENUE", reason: "Amount significantly above average" });
    }
  }

  // Staff performance
  if (staffScore && staffScore < 40) {
    anomalies.push({ type: "STAFF_RISK", reason: "Staff score critically low" });
  }

  if (anomalies.length > 0) {
    return { isAnomaly: true, anomalies };
  }
  return { isAnomaly: false };
}

/**
 * Score an event for staff performance tracking
 * @param {Object} logEntry - Log entry with type and other data
 * @returns {number} Score delta (positive or negative)
 */
export function scoreEvent(logEntry) {
  const { type, amount, duration } = logEntry;
  switch (type) {
    case "PAYMENT_SUCCESS":
      return 5 + Math.floor((amount || 0) / 5000); // bonus for higher amounts
    case "CHARGING_COMPLETE":
      return 3;
    case "CHARGING_START":
      return 1;
    case "UNAUTHORIZED_UNPLUG":
      return -15;
    case "SECURITY_BREACH":
      return -20;
    case "FRAUD_DETECTED":
      return -25;
    case "LOW_REVENUE":
      return -10;
    case "OVERDUE":
      return -5;
    default:
      return 0;
  }
}

