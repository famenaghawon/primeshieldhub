// ================================================================
// engines/logisticsEngine.js
// Logistics cost engine - Cloudflare Workers + D1 version
// ================================================================

const DEFAULT_CONFIG = {
  airFreightPerKgUSD: 5,
  clearancePerKgNGN: 800,
  localDeliveryPerUnitNGN: 2000
};

async function getLogisticsConfig(db) {
  if (!db || typeof db.prepare !== 'function') {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const result = await db
      .prepare('SELECT * FROM settings WHERE key = ?')
      .bind('logistics_config')
      .first();

    if (result && result.value) {
      const config = JSON.parse(result.value);
      return { ...DEFAULT_CONFIG, ...config };
    }
  } catch (err) {
    console.warn('Failed to fetch logistics config from D1, using defaults:', err);
  }

  return { ...DEFAULT_CONFIG };
}

export async function calculateLogistics(weightKg, db) {
  const config = await getLogisticsConfig(db);

  const freight = weightKg * config.airFreightPerKgUSD * 1500;
  const clearance = weightKg * config.clearancePerKgNGN;

  return freight + clearance + config.localDeliveryPerUnitNGN;
}
