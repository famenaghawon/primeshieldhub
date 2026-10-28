import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertToNaira } from '../fxEngine.mjs';

// Mock that mimics the old Firebase-style call
function createMockDb(rates) {
  return {
    prepare() {
      return {
        bind() {
          return {
            async first() {
              return { value: JSON.stringify(rates) };
            }
          };
        }
      };
    }
  };
}

test('converts USD to Naira correctly', async () => {
  const db = createMockDb({ USD: 1600, CAD: 1200, CNY: 220 });
  const result = await convertToNaira(100, 'USD', db);
  assert.equal(result, 160000);
});

test('converts CAD to Naira correctly', async () => {
  const db = createMockDb({ USD: 1600, CAD: 1200, CNY: 220 });
  const result = await convertToNaira(50, 'CAD', db);
  assert.equal(result, 60000);
});

test('converts CNY to Naira correctly', async () => {
  const db = createMockDb({ USD: 1600, CAD: 1200, CNY: 220 });
  const result = await convertToNaira(200, 'CNY', db);
  assert.equal(result, 44000);
});

test('throws on unsupported currency', async () => {
  const db = createMockDb({ USD: 1600 });
  await assert.rejects(
    () => convertToNaira(100, 'EUR', db),
    { message: 'Unsupported currency' }
  );
});

test('handles zero amount', async () => {
  const db = createMockDb({ USD: 1600 });
  const result = await convertToNaira(0, 'USD', db);
  assert.equal(result, 0);
});
