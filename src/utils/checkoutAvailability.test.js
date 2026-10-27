import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCheckoutAvailability } from './checkoutAvailability.js';
const stores = ['a', 'b'].map(storeId => ({ storeId, items: [{ productId: 'product', variantId: 'variant', productName: 'Chicken', quantity: 1 }] }));
test('availability checks the exact store and variant without mutating inventory', async () => {
  const calls = [];
  await validateCheckoutAvailability(stores, async query => { calls.push(query); return { ...query, available: true }; });
  assert.deepEqual(calls.map(query => query.storeId), ['a', 'b']);
});
test('missing and unavailable stock explain why no new checkout was submitted', async () => {
  await assert.rejects(validateCheckoutAvailability(stores, async query => {
    if (query.storeId === 'a') throw { status: 404 };
    return { ...query, available: false };
  }), /no stock record at a; Chicken: unavailable at b.*No new checkout/);
});
test('foreign stock responses and offline reads fail closed', async () => {
  await assert.rejects(validateCheckoutAvailability(stores, async query => ({ ...query, storeId: 'foreign', available: true })), /does not match/);
  await assert.rejects(validateCheckoutAvailability(stores, async () => { throw { status: 503 }; }), /could not be checked/);
});
