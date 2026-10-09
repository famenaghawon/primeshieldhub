// ai.js - AI Analytics Engine
// Processes logs to generate business intelligence, predictions, and recommendations

/**
 * Analyze log entries and extract key business metrics
 * @param {Array} logs - Array of log objects with type, message, timestamp, user, etc.
 * @returns {Object} Analysis result containing revenue, peakHour, riskLevel, staffRanking, etc.
 */
export function analyzeLogs(logs) {
  let totalRevenue = 0;
  let alertCount = 0;
  let fraudCount = 0;
  let sessionCount = 0;
  
  const hourlyActivity = {};
  const staffScores = {};
  const deviceTypes = {};
  const paymentMethods = {};

  // Process each log entry
  logs.forEach(log => {
    if (!log) return;

    const timestamp = log.timestamp;
    const hour = timestamp ? new Date(timestamp).getHours() : null;

    // Revenue tracking from PAYMENT_SUCCESS events
    if (log.type === "PAYMENT_SUCCESS") {
      const amount = extractAmount(log.message);
      totalRevenue += amount;
      
      if (hour !== null) {
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
      }

      // Extract payment method if present
      const method = extractPaymentMethod(log.message);
      if (method) {
        paymentMethods[method] = (paymentMethods[method] || 0) + 1;
      }
    }

    // Session tracking
    if (log.type === "CHARGING_START") {
      sessionCount++;
      if (hour !== null) {
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
      }
      
      // Extract device type
      const device = extractDeviceType(log.message);
      if (device) {
        deviceTypes[device] = (deviceTypes[device] || 0) + 1;
      }
    }

    // Security alerts
    if (log.type === "UNAUTHORIZED_UNPLUG" || 
        log.type === "SECURITY_BREACH" || 
        log.type === "THEFT_SUSPECTED") {
      alertCount++;
    }

    // Fraud detection
    if (log.type === "FRAUD_DETECTED" || log.type === "FRAUD_ALERT") {
      fraudCount++;
    }

    // Staff scoring (based on event type)
    if (log.user && log.user !== "system") {
      staffScores[log.user] = (staffScores[log.user] || 0) + scoreLogEvent(log);
    }
  });

  // Calculate peak hour
  const peakHour = getPeakHour(hourlyActivity);
  const peakHourCount = peakHour ? hourlyActivity[peakHour] : 0;

  // Determine risk level
  const riskLevel = calculateRiskLevel(alertCount, fraudCount, totalRevenue, sessionCount);

  // Rank staff by score
  const staffRanking = rankStaff(staffScores);

  // Most popular device type
  const topDevice = getTopItem(deviceTypes);
  
  // Most used payment method
  const topPaymentMethod = getTopItem(paymentMethods);

  // Average revenue per session
  const avgRevenuePerSession = sessionCount > 0 ? totalRevenue / sessionCount : 0;

  return {
    totalRevenue,
    totalSessions: sessionCount,
    alertCount,
    fraudCount,
    peakHour: peakHour ? parseInt(peakHour) : null,
    peakHourActivity: peakHourCount,
    riskLevel,
    staffRanking,
    deviceTypes,
    paymentMethods,
    topDevice,
    topPaymentMethod,
    avgRevenuePerSession,
    hourlyActivity,
  };
}

/**
 * Generate actionable recommendations based on analysis
 * @param {Object} analysis - Output from analyzeLogs
 * @returns {Array<string>} List of recommendations
 */
export function generateRecommendations(analysis) {
  const recommendations = [];

  // Risk-based recommendations
  if (analysis.riskLevel === "HIGH" || analysis.riskLevel === "CRITICAL") {
    recommendations.push("🚨 Increase monitoring — high security risk detected. Review staff activities.");
    recommendations.push("🔒 Consider enabling stricter authentication for staff logins.");
  } else if (analysis.riskLevel === "MEDIUM") {
    recommendations.push("⚠️ Moderate risk level — maintain current security posture.");
  }

  // Revenue-based recommendations
  if (analysis.totalRevenue < 5000) {
    recommendations.push("📉 Revenue is below threshold (₦5,000). Consider running a promotion or discount.");
    recommendations.push("📢 Boost marketing efforts to attract more customers.");
  } else if (analysis.totalRevenue > 20000) {
    recommendations.push("💰 High revenue detected! Consider investing in expansion or additional staff.");
  }

  // Peak hour optimization
  if (analysis.peakHour !== null) {
    recommendations.push(`⏰ Peak hour detected at ${analysis.peakHour}:00 with ${analysis.peakHourActivity} sessions. Ensure sufficient staff and chargers available.`);
    if (analysis.peakHour >= 9 && analysis.peakHour <= 17) {
      recommendations.push("📅 Daytime peak — consider lunch specials or combo deals.");
    } else if (analysis.peakHour >= 18 || analysis.peakHour <= 8) {
      recommendations.push("🌙 Evening/overnight peak — ensure security cameras and lighting are operational.");
    }
  }

  // Session volume
  if (analysis.totalSessions < 10) {
    recommendations.push("📊 Low session count. Investigate possible causes: location visibility, pricing, or service quality.");
  }

  // Staff performance
  if (analysis.staffRanking && analysis.staffRanking.length > 0) {
    const topStaff = analysis.staffRanking[0];
    const lowStaff = analysis.staffRanking[analysis.staffRanking.length - 1];
    
    if (topStaff.score > 50) {
      recommendations.push(`🏆 Top performer: ${topStaff.name} (score: ${topStaff.score}). Consider recognition or bonus.`);
    }
    if (lowStaff.score < 10) {
      recommendations.push(`⚠️ Low performer: ${lowStaff.name} (score: ${lowStaff.score}). May need retraining or review.`);
    }
  }

  // Device insights
  if (analysis.topDevice) {
    recommendations.push(`📱 Most charged device: ${analysis.topDevice}. Ensure you have sufficient compatible chargers.`);
  }

  // Payment insights
  if (analysis.topPaymentMethod && analysis.topPaymentMethod !== 'cash') {
    recommendations.push(`💳 ${analysis.topPaymentMethod} is popular — ensure POS/payment systems are reliable.`);
  }

  // Average revenue per session
  if (analysis.avgRevenuePerSession < 200) {
    recommendations.push("💡 Average revenue per session is low. Consider upselling accessories or offering premium charging options.");
  }

  // If no specific recommendations, add generic
  if (recommendations.length === 0) {
    recommendations.push("✅ System metrics look normal. Continue monitoring.");
  }

  return recommendations;
}

// ==================== HELPER FUNCTIONS ====================

/**
 * Extract monetary amount from message string (supports ₦ and NGN formats)
 */
function extractAmount(text) {
  if (!text) return 0;
  // Match patterns: ₦500, NGN500, 500 NGN, etc.
  const match = text.match(/(?:₦|NGN)\s*(\d+(?:,\d{3})*(?:\.\d+)?)|(\d+(?:,\d{3})*(?:\.\d+)?)\s*(?:₦|NGN)/i);
  if (match) {
    const amountStr = (match[1] || match[2]).replace(/,/g, '');
    return parseFloat(amountStr) || 0;
  }
  return 0;
}

/**
 * Extract payment method from message
 */
function extractPaymentMethod(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('cash')) return 'cash';
  if (lower.includes('card') || lower.includes('pos')) return 'card';
  if (lower.includes('transfer') || lower.includes('bank')) return 'transfer';
  if (lower.includes('paystack') || lower.includes('online')) return 'online';
  return null;
}

/**
 * Extract device type from message
 */
function extractDeviceType(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('iphone')) return 'iPhone';
  if (lower.includes('android') || lower.includes('samsung')) return 'Android';
  if (lower.includes('laptop')) return 'Laptop';
  if (lower.includes('tablet') || lower.includes('ipad')) return 'Tablet';
  if (lower.includes('power bank')) return 'Power Bank';
  return 'Other';
}

/**
 * Score a single log event for staff performance
 */
function scoreLogEvent(log) {
  const type = log.type;
  let baseScore = 0;
  
  switch (type) {
    case "PAYMENT_SUCCESS":
      baseScore = 5;
      // Bonus for higher amounts
      const amount = extractAmount(log.message);
      baseScore += Math.floor(amount / 5000);
      break;
    case "CHARGING_COMPLETE":
      baseScore = 3;
      break;
    case "CHARGING_START":
      baseScore = 1;
      break;
    case "UNAUTHORIZED_UNPLUG":
      baseScore = -15;
      break;
    case "SECURITY_BREACH":
      baseScore = -20;
      break;
    case "FRAUD_DETECTED":
      baseScore = -25;
      break;
    case "LOW_REVENUE":
      baseScore = -10;
      break;
    case "OVERDUE":
      baseScore = -5;
      break;
    case "THEFT_SUSPECTED":
      baseScore = -30;
      break;
    default:
      baseScore = 0;
  }
  
  return baseScore;
}

/**
 * Determine peak hour from hourly activity map
 */
function getPeakHour(hourly) {
  let maxCount = -1;
  let peak = null;
  for (const hour in hourly) {
    if (hourly[hour] > maxCount) {
      maxCount = hourly[hour];
      peak = hour;
    }
  }
  return peak;
}

/**
 * Calculate risk level based on alerts, fraud, revenue, and session volume
 */
function calculateRiskLevel(alertCount, fraudCount, totalRevenue, sessionCount) {
  // Base risk score
  let riskScore = 0;
  
  // Alerts contribution
  if (alertCount > 10) riskScore += 30;
  else if (alertCount > 5) riskScore += 20;
  else if (alertCount > 2) riskScore += 10;
  
  // Fraud events (high weight)
  if (fraudCount > 3) riskScore += 40;
  else if (fraudCount > 1) riskScore += 25;
  else if (fraudCount > 0) riskScore += 15;
  
  // Low revenue with moderate sessions might indicate undercharging/theft
  if (sessionCount > 5 && totalRevenue < sessionCount * 100) {
    riskScore += 20;
  }
  
  // Determine level
  if (riskScore >= 50) return "CRITICAL";
  if (riskScore >= 30) return "HIGH";
  if (riskScore >= 15) return "MEDIUM";
  return "LOW";
}

/**
 * Rank staff by score (highest first)
 */
function rankStaff(staffScores) {
  return Object.entries(staffScores)
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Get the top item (by count) from a frequency map
 */
function getTopItem(freqMap) {
  let maxCount = 0;
  let top = null;
  for (const item in freqMap) {
    if (freqMap[item] > maxCount) {
      maxCount = freqMap[item];
      top = item;
    }
  }
  return top;
}

/**
 * Forecast next day revenue based on recent trend (simple linear)
 * @param {Array} dailyRevenue - Array of {date, revenue} objects sorted ascending
 * @returns {number} Predicted revenue for next day
 */
export function forecastRevenue(dailyRevenue) {
  if (!dailyRevenue || dailyRevenue.length < 2) return null;
  
  // Simple moving average with trend
  const last3 = dailyRevenue.slice(-3);
  const sum = last3.reduce((acc, d) => acc + d.revenue, 0);
  const avg = sum / last3.length;
  
  // Trend factor: compare last to first of last 3
  const trend = last3[2].revenue - last3[0].revenue;
  const adjustment = trend / 3;
  
  return Math.max(0, Math.round(avg + adjustment));
}

/**
 * Predict peak hours for upcoming days based on historical patterns
 * @param {Object} hourlyPatterns - Average activity by hour (0-23)
 * @returns {Array} Top 3 predicted peak hours
 */
export function predictPeakHours(hourlyPatterns) {
  const entries = Object.entries(hourlyPatterns).map(([hour, count]) => ({
    hour: parseInt(hour),
    count
  }));
  return entries.sort((a, b) => b.count - a.count).slice(0, 3);
}

/**
 * Detect anomalies in a time series using simple z-score
 * @param {Array} values - Numeric array
 * @param {number} threshold - Z-score threshold (default 2)
 * @returns {Array} Indices of anomalies
 */
export function detectAnomalies(values, threshold = 2) {
  if (values.length < 3) return [];
  
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  
  if (stdDev === 0) return [];
  
  return values.reduce((acc, val, idx) => {
    const zScore = Math.abs((val - mean) / stdDev);
    if (zScore > threshold) acc.push(idx);
    return acc;
  }, []);
}

