import test from 'node:test';
import assert from 'node:assert/strict';
import { loadProductStock } from './productStock.js';
import { apiRequest } from '../services/apiClient.js';
import { inventoryBaseUrl } from '../services/inventoryConfig.js';

const identity = { productId: 'product', variantId: 'variant', storeId: 'store' };
const row = { ...identity, available: true };

test('inventory routing honors gateway, override, and local proxy', () => {
  assert.equal(inventoryBaseUrl({ VITE_API_BASE_URL: 'http://localhost:8082/' }), 'http://localhost:8082/inventory-service');
  assert.equal(inventoryBaseUrl({ VITE_API_BASE_URL: 'https://gateway', VITE_INVENTORY_URL: '/custom/' }), '/custom');
  assert.equal(inventoryBaseUrl(), '/inventory-service');
});
test('public stock lookup returns availability without exposing inventory quantities', async () => {
  assert.deepEqual(await loadProductStock(async () => row, identity), { state: 'available' });
});
test('unavailable stock is confirmed non-purchasable', async () => {
  assert.deepEqual(await loadProductStock(async () => ({ ...row, available: false }), identity), { state: 'out' });
});
test('missing inventory is distinct from a failed request and zero stock', async () => {
  assert.deepEqual(await loadProductStock(async () => { throw Object.assign(new Error(), { status: 404 }); }, identity), { state: 'missing' });
});
test('a failed request affects only its card and never invents a zero quantity', async () => {
  const results = await Promise.all([
    loadProductStock(async () => { throw Object.assign(new Error(), { status: 502 }); }, identity),
    loadProductStock(async () => row, identity),
  ]);
  assert.deepEqual(results, [{ state: 'error' }, { state: 'available' }]);
});
test('mismatched identities and invalid availability cannot claim stock', async () => {
  for (const patch of [{ storeId: 'other' }, { productId: 'other' }, { variantId: 'other' }, { available: undefined }]) {
    assert.deepEqual(await loadProductStock(async () => ({ ...row, ...patch }), identity), { state: 'error' });
  }
  assert.deepEqual(await loadProductStock(async () => row, { productId: 'product', storeId: 'store' }), { state: 'error' });
});
test('public inventory availability lookup omits customer credentials and distinguishes server errors', async () => {
  const previous = { fetch: globalThis.fetch, sessionStorage: globalThis.sessionStorage };
  globalThis.sessionStorage = { getItem: () => 'session-token' };
  try {
    for (const status of [200, 502, 403]) {
      globalThis.fetch = async (url, options) => {
        assert.equal(url, 'https://gateway/inventory-service/api/v1/public/inventory-availability?productId=product&variantId=variant&storeId=store');
        assert.equal(options.headers.Authorization, undefined);
        return new Response(JSON.stringify(status === 200 ? row : { message: 'Request failed' }), { status });
      };
      const result = await loadProductStock(() => apiRequest('https://gateway/inventory-service', '/api/v1/public/inventory-availability?productId=product&variantId=variant&storeId=store', { auth: false, expireSession: false }), identity);
      assert.equal(result.state, status === 200 ? 'available' : 'error');
    }
  } finally { Object.assign(globalThis, previous); }
});
