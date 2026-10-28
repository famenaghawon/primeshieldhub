// ================================================================
// engines/fxEngine.js
// FX conversion engine - Cloudflare Workers + D1 version
// ================================================================

const DEFAULT_RATES = {
  USD: 1600,
  CAD: 1200,
  CNY: 220
};

async function getFxRates(db) {
  if (!db || typeof db.prepare !== 'function') {
    return { ...DEFAULT_RATES };
  }

  try {
    const result = await db
      .prepare('SELECT * FROM settings WHERE key = ?')
      .bind('fx_rates')
      .first();

    if (result && result.value) {
      const rates = JSON.parse(result.value);
      return { ...DEFAULT_RATES, ...rates };
    }
  } catch (err) {
    console.warn('Failed to fetch FX rates from D1, using defaults:', err);
  }

  return { ...DEFAULT_RATES };
}

export async function convertToNaira(amount, currency, db) {
  const rates = await getFxRates(db);

  if (currency === 'CAD') return amount * rates.CAD;
  if (currency === 'USD') return amount * rates.USD;
  if (currency === 'CNY') return amount * rates.CNY;

  throw new Error('Unsupported currency');
}
