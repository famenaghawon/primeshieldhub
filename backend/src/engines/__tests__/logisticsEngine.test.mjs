import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateLogistics } from '../logisticsEngine.mjs';

// Mock that mimics the old Firebase-style call
function createMockDb(config) {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return { value: JSON.stringify(config) };
            }
          };
        }
      };
    }
  };
}

const sampleConfig = {
  airFreightPerKgUSD: 5,
  clearancePerKgNGN: 800,
  localDeliveryPerUnitNGN: 2000
};

test('calculates logistics cost for 1kg correctly', async () => {
  const db = createMockDb(sampleConfig);
  const result = await calculateLogistics(1, db);
  // freight = 1 * 5 * 1500 = 7500
  // clearance = 1 * 800 = 800
  // total = 7500 + 800 + 2000 = 10300
  assert.equal(result, 10300);
});

test('calculates logistics cost for 5kg correctly', async () => {
  const db = createMockDb(sampleConfig);
  const result = await calculateLogistics(5, db);
  // freight = 5 * 5 * 1500 = 37500
  // clearance = 5 * 800 = 4000
  // total = 37500 + 4000 + 2000 = 43500
  assert.equal(result, 43500);
});

test('handles zero weight', async () => {
  const db = createMockDb(sampleConfig);
  const result = await calculateLogistics(0, db);
  // freight = 0, clearance = 0, only local delivery
  assert.equal(result, 2000);
});

test('uses different rates correctly', async () => {
  const db = createMockDb({
    airFreightPerKgUSD: 8,
    clearancePerKgNGN: 1000,
    localDeliveryPerUnitNGN: 1500
  });
  const result = await calculateLogistics(2, db);
  // freight = 2 * 8 * 1500 = 24000
  // clearance = 2 * 1000 = 2000
  // total = 24000 + 2000 + 1500 = 27500
  assert.equal(result, 27500);
});
