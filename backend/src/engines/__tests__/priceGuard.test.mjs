import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateProduct } from '../priceGuard.js';

// Minimal mock that makes D1 calls fail gracefully so defaults are used
const mockEnv = {
  DB: {
    prepare() {
      return {
        bind() { return this; },
        async first() { throw new Error('no db in unit test'); }
      };
    }
  }
};

test('blocks product when retail price is at or below landed cost', async () => {
  const result = await evaluateProduct({
    landedCost: 10000,
    price: 9000,
  }, mockEnv);

  assert.equal(result.status, 'blocked');
  assert.equal(result.blocked, true);
  assert.ok(result.warnings.some(w => w.toLowerCase().includes('below landed')));
});

test('flags low retail margin', async () => {
  const result = await evaluateProduct({
    landedCost: 10000,
    price: 11000, // ~10% margin
  }, mockEnv);

  assert.equal(result.status, 'warning');
  assert.ok(result.retailMargin < 15);
  assert.ok(result.warnings.some(w => w.toLowerCase().includes('below minimum')));
});

test('approves healthy margin product', async () => {
  const result = await evaluateProduct({
    landedCost: 10000,
    price: 14000, // 40% margin
    priceWholesale: 12000,
  }, mockEnv);

  assert.equal(result.status, 'approved');
  assert.equal(result.approved, true);
  assert.ok(result.retailMargin >= 15);
});

test('warns on high-profit margin', async () => {
  const result = await evaluateProduct({
    landedCost: 10000,
    price: 20000, // 100% margin
  }, mockEnv);

  assert.ok(result.warnings.some(w => w.toLowerCase().includes('high-profit')));
});

test('returns recommended retail price above landed cost when blocked', async () => {
  const result = await evaluateProduct({
    landedCost: 10000,
    price: 8000,
  }, mockEnv);

  assert.ok(result.recommendedRetail > 10000);
  assert.equal(result.blocked, true);
});
