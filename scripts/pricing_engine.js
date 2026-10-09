// ============================================================================
// pricing-engine.ts - Pricing calculation engine for Cloudflare Workers
// Supports D1 (SQL) or KV storage for settings
// ============================================================================

// ------------------------------ Types ---------------------------------------
export interface PricingSettings {
  fx: {
    cad: number;
    usd: number;
    cny: number;
    gbp?: number;
    eur?: number;
  };
  airCargoPerKg: number;
  clearingPerKg: number;
  localDelivery: number;
  wholesaleBaseMarkup: number;
  // Optional: minimum profit margins
  minRetailMargin?: number;
  minWholesaleMargin?: number;
}

export interface CategoryConfig {
  markup: Record<string, number>;
  weight: Record<string, number>;
}

export interface PriceResult {
  landed: number;
  retail: number;
  wholesale: number;
  breakdown?: {
    nairaEquivalent: number;
    freight: number;
    clearing: number;
    localDelivery: number;
    markupAmount: number;
  };
}

// ------------------------------ Default Configuration ------------------------
const DEFAULT_CATEGORY_MARKUP: Record<string, number> = {
  'Phones': 30,
  'Laptops': 25,
  'Accessories': 40,
  'Tablets': 28,
  'Audio': 35,
  'Wearables': 38,
  'Gaming': 25,
  'Default': 25
};

const DEFAULT_WEIGHT_KG: Record<string, number> = {
  'Phones': 0.3,
  'Laptops': 2.5,
  'Tablets': 0.6,
  'Audio': 0.5,
  'Wearables': 0.15,
  'Gaming': 3.0,
  'Accessories': 0.2,
  'Default': 0.5
};

// ------------------------------ D1 Database Version -------------------------
export class PricingEngine {
  private settings: PricingSettings | null = null;
  private categoryMarkup: Record<string, number> = DEFAULT_CATEGORY_MARKUP;
  private categoryWeight: Record<string, number> = DEFAULT_WEIGHT_KG;
  private db: D1Database | null = null;

  constructor(db?: D1Database) {
    if (db) {
      this.db = db;
    }
  }

  // Load settings from D1 database
  async loadSettingsFromD1(): Promise<void> {
    if (!this.db) throw new Error('D1 database not initialized');

    // Load pricing settings
    const pricingResult = await this.db.prepare(
      'SELECT key, value FROM app_settings WHERE category = ?'
    ).bind('pricing').all();

    if (pricingResult.results && pricingResult.results.length > 0) {
      const settingsObj: any = {};
      for (const row of pricingResult.results) {
        settingsObj[row.key] = JSON.parse(row.value);
      }
      this.settings = settingsObj as PricingSettings;
    }

    // Load category markup
    const markupResult = await this.db.prepare(
      'SELECT category, markup_percent FROM category_markup'
    ).all();

    if (markupResult.results && markupResult.results.length > 0) {
      for (const row of markupResult.results) {
        this.categoryMarkup[row.category] = row.markup_percent;
      }
    }

    // Load category weights
    const weightResult = await this.db.prepare(
      'SELECT category, weight_kg FROM category_weights'
    ).all();

    if (weightResult.results && weightResult.results.length > 0) {
      for (const row of weightResult.results) {
        this.categoryWeight[row.category] = row.weight_kg;
      }
    }
  }

  // Load settings from KV (alternative to D1)
  async loadSettingsFromKV(kv: KVNamespace): Promise<void> {
    const settingsJson = await kv.get('pricing:settings', 'json');
    if (settingsJson) this.settings = settingsJson as PricingSettings;

    const markupJson = await kv.get('pricing:categoryMarkup', 'json');
    if (markupJson) this.categoryMarkup = markupJson;

    const weightJson = await kv.get('pricing:categoryWeights', 'json');
    if (weightJson) this.categoryWeight = weightJson;
  }

  // Manual setter for testing / direct config
  setSettings(settings: PricingSettings): void {
    this.settings = settings;
  }

  setCategoryMarkup(markup: Record<string, number>): void {
    this.categoryMarkup = { ...this.categoryMarkup, ...markup };
  }

  setCategoryWeight(weight: Record<string, number>): void {
    this.categoryWeight = { ...this.categoryWeight, ...weight };
  }

  // Get markup percentage for a category
  getMarkup(category: string): number {
    return this.categoryMarkup[category] || this.categoryMarkup['Default'] || 25;
  }

  // Get weight in kg for a product type
  getWeight(type: string): number {
    return this.categoryWeight[type] || this.categoryWeight['Default'] || 0.5;
  }

  // Convert currency to NGN (Naira)
  convertToNaira(sourcePrice: number, currency: string): number {
    if (!this.settings) {
      throw new Error('Pricing settings not loaded. Call loadSettingsFromD1() or loadSettingsFromKV() first.');
    }

    const rates: Record<string, number> = {
      'CAD': this.settings.fx.cad,
      'USD': this.settings.fx.usd,
      'CNY': this.settings.fx.cny,
      'GBP': this.settings.fx.gbp || this.settings.fx.usd * 1.25,
      'EUR': this.settings.fx.eur || this.settings.fx.usd * 1.08,
    };

    const rate = rates[currency.toUpperCase()];
    if (!rate) {
      throw new Error(`Unsupported currency: ${currency}`);
    }

    return sourcePrice * rate;
  }

  // Main pricing calculation
  async calculatePrice(
    sourcePrice: number,
    currency: string,
    category: string,
    type: string,
    options?: {
      includeBreakdown?: boolean;
      customMarkup?: number;
      customWeight?: number;
    }
  ): Promise<PriceResult> {
    if (!this.settings) {
      throw new Error('Pricing settings not loaded. Call loadSettingsFromD1() or loadSettingsFromKV() first.');
    }

    // 1. Currency conversion to Naira
    const nairaEquivalent = this.convertToNaira(sourcePrice, currency);

    // 2. Weight-based costs
    const weight = options?.customWeight || this.getWeight(type);
    const freight = weight * this.settings.airCargoPerKg;
    const clearing = weight * this.settings.clearingPerKg;
    const localDelivery = this.settings.localDelivery;

    // 3. Landed cost calculation
    const landed = nairaEquivalent + freight + clearing + localDelivery;

    // 4. Markup
    const markupPercent = options?.customMarkup || this.getMarkup(category);
    const markupAmount = landed * (markupPercent / 100);
    const retail = landed + markupAmount;

    // 5. Wholesale price (based on wholesale base markup)
    const wholesaleMarkup = this.settings.wholesaleBaseMarkup;
    const wholesale = landed + (landed * wholesaleMarkup / 100);

    const result: PriceResult = {
      landed: Math.round(landed),
      retail: Math.round(retail),
      wholesale: Math.round(wholesale),
    };

    if (options?.includeBreakdown) {
      result.breakdown = {
        nairaEquivalent: Math.round(nairaEquivalent),
        freight: Math.round(freight),
        clearing: Math.round(clearing),
        localDelivery: Math.round(localDelivery),
        markupAmount: Math.round(markupAmount),
      };
    }

    return result;
  }

  // Batch calculation for multiple products
  async calculateBatch(
    products: Array<{
      sourcePrice: number;
      currency: string;
      category: string;
      type: string;
    }>
  ): Promise<PriceResult[]> {
    const results: PriceResult[] = [];
    for (const product of products) {
      results.push(await this.calculatePrice(
        product.sourcePrice,
        product.currency,
        product.category,
        product.type
      ));
    }
    return results;
  }
}

// ------------------------------ SQL Schema for D1 ---------------------------
export const PRICING_SCHEMA_SQL = `
-- App settings table
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(category, key)
);

-- Category markup configuration
CREATE TABLE IF NOT EXISTS category_markup (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL UNIQUE,
  markup_percent INTEGER NOT NULL DEFAULT 25,
  updated_at TEXT NOT NULL
);

-- Category weight configuration
CREATE TABLE IF NOT EXISTS category_weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL UNIQUE,
  weight_kg REAL NOT NULL DEFAULT 0.5,
  updated_at TEXT NOT NULL
);

-- Insert default settings
INSERT OR IGNORE INTO app_settings (category, key, value, updated_at) VALUES
  ('pricing', 'fx', '{"cad": 430, "usd": 580, "cny": 80}', datetime('now')),
  ('pricing', 'airCargoPerKg', '15', datetime('now')),
  ('pricing', 'clearingPerKg', '12', datetime('now')),
  ('pricing', 'localDelivery', '5000', datetime('now')),
  ('pricing', 'wholesaleBaseMarkup', '8', datetime('now'));

-- Insert default categories
INSERT OR IGNORE INTO category_markup (category, markup_percent, updated_at) VALUES
  ('Phones', 30, datetime('now')),
  ('Laptops', 25, datetime('now')),
  ('Accessories', 40, datetime('now')),
  ('Tablets', 28, datetime('now')),
  ('Audio', 35, datetime('now')),
  ('Wearables', 38, datetime('now')),
  ('Gaming', 25, datetime('now')),
  ('Default', 25, datetime('now'));

INSERT OR IGNORE INTO category_weights (category, weight_kg, updated_at) VALUES
  ('Phones', 0.3, datetime('now')),
  ('Laptops', 2.5, datetime('now')),
  ('Tablets', 0.6, datetime('now')),
  ('Audio', 0.5, datetime('now')),
  ('Wearables', 0.15, datetime('now')),
  ('Gaming', 3.0, datetime('now')),
  ('Accessories', 0.2, datetime('now')),
  ('Default', 0.5, datetime('now'));
`;

// ------------------------------ Usage Example in Cloudflare Worker ----------
/*
export interface Env {
  DB: D1Database;
  PRICING_KV: KVNamespace;
}

export default {
  async fetch(request: Request, env: Env) {
    const engine = new PricingEngine(env.DB);
    
    // Load settings from D1
    await engine.loadSettingsFromD1();
    
    // Or from KV:
    // await engine.loadSettingsFromKV(env.PRICING_KV);
    
    // Calculate price
    const price = await engine.calculatePrice(
      699,      // source price
      'USD',    // currency
      'Phones', // category
      'Phones'  // type
    );
    
    return Response.json(price);
  }
};
*/

// ------------------------------ Standalone Export for Node.js ----------------
// For use in Node.js scripts (not Workers)
export class PricingEngineNode extends PricingEngine {
  constructor() {
    super();
  }

  async loadSettingsFromJSON(configPath: string): Promise<void> {
    const fs = await import('fs');
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    this.settings = data.settings;
    this.categoryMarkup = data.categoryMarkup || DEFAULT_CATEGORY_MARKUP;
    this.categoryWeight = data.categoryWeight || DEFAULT_WEIGHT_KG;
  }
}

