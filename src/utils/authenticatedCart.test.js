import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateAuthenticatedCart } from './authenticatedCart.js';
import { validateCheckoutAvailability } from './checkoutAvailability.js';

const guest = storeId => ({ id: `product-${storeId}`, productId: `product-${storeId}`, storeId,
  variantId: null, quantity: 2, productName: storeId, unitPrice: 10 });
const fixture = (items = []) => {
  const data = new Map([['guestCartItems', JSON.stringify(items)]]);
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) };
  const carts = new Map(); const calls = []; const accepted = new Set();
  let stock = 100; let loseResponse = false; let failStore = '';
  const api = {
    getActiveCart: async ({ storeId }) => { if (!carts.has(storeId)) throw { status: 404 }; return structuredClone(carts.get(storeId)); },
    createCart: async ({ customerId, storeId }) => { const cart = { id: `cart-${storeId}`, customerId, storeId, status: 'ACTIVE', items: [] }; carts.set(storeId, cart); return structuredClone(cart); },
    addCartItem: async (id, item, key = `new-${calls.length}`) => {
      const cart = [...carts.values()].find(cart => cart.id === id);
      calls.push({ operation: 'add', storeId: cart.storeId, key });
      if (cart.storeId === failStore) throw new Error('offline');
      if (!accepted.has(`${id}:${key}`)) {
        accepted.add(`${id}:${key}`);
        const existing = cart.items.find(line => line.productId === item.productId);
        if (existing) existing.quantity += item.quantity;
        else cart.items.push({ ...item, id: `server-${item.productId}` });
      }
      if (loseResponse) { loseResponse = false; throw new Error('lost response'); }
      return structuredClone(cart);
    },
    updateCartItem: async (id, itemId, { quantity }) => {
      const cart = [...carts.values()].find(cart => cart.id === id);
      const item = cart.items.find(item => item.id === itemId);
      assert.ok(item); assert.notEqual(itemId, item.productId);
      calls.push({ operation: 'update', itemId }); item.quantity = quantity;
      return structuredClone(cart);
    },
    removeCartItem: async (id, itemId) => {
      const cart = [...carts.values()].find(cart => cart.id === id);
      const item = cart.items.find(item => item.id === itemId);
      assert.ok(item); assert.notEqual(itemId, item.productId);
      calls.push({ operation: 'remove', itemId }); cart.items = cart.items.filter(item => item.id !== itemId);
      return structuredClone(cart);
    },
  };
  const mutate = (storeId, operation = 'add', delta = 0) => mutateAuthenticatedCart({ customerId: 'owner', storeId,
    item: { ...guest(storeId), quantity: 1 }, operation, delta, api, storage,
    checkInventory: stores => validateCheckoutAvailability(stores, async query => ({ ...query, available: stock > 0 })),
  });
  return { carts, calls, data, storage, api, mutate, stock: value => { stock = value; },
    lose: () => { loseResponse = true; }, fail: store => { failStore = store; } };
};

test('login transfer A then update/remove guest B always uses B server item ID', async () => {
  const f = fixture([guest('a'), guest('b')]);
  await f.mutate('a');
  assert.equal(f.carts.get('a').items[0].quantity, 3);
  assert.deepEqual(JSON.parse(f.storage.getItem('guestCartItems')), [guest('b')]);
  await f.mutate('b', 'update', 1);
  assert.equal(f.carts.get('b').items[0].quantity, 3);
  await f.mutate('b', 'remove');
  assert.equal(f.carts.get('b').items.length, 0);
  assert.equal(f.carts.get('a').items[0].quantity, 3);
  assert.deepEqual(f.calls.filter(call => call.itemId).map(call => call.itemId), ['server-product-b', 'server-product-b']);
});

test('lost guest transfer response replays idempotently then applies the requested add once', async () => {
  const stock = 1;
  const f = fixture([guest('a')]); f.stock(stock); f.lose();
  await assert.rejects(f.mutate('a'), /lost response/);
  const saved = JSON.parse(f.storage.getItem('guest-transfer:owner:a:product-a:'));
  assert.equal(saved.targetQuantity, 2);
  assert.equal(f.carts.get('a').items[0].quantity, 2);
  await f.mutate('a');
  assert.equal(f.calls[0].key, f.calls[1].key);
  assert.notEqual(f.calls[1].key, f.calls[2].key);
  assert.equal(f.carts.get('a').items[0].quantity, 3);
  assert.equal(f.calls.length, 3);
  assert.deepEqual(JSON.parse(f.storage.getItem('guestCartItems')), []);
});

test('failed B transfer preserves B and cannot corrupt A', async () => {
  const f = fixture([guest('a'), guest('b')]); await f.mutate('a'); f.fail('b');
  await assert.rejects(f.mutate('b', 'update', 1), /offline/);
  assert.deepEqual(JSON.parse(f.storage.getItem('guestCartItems')), [guest('b')]);
  assert.equal(f.carts.get('a').items[0].quantity, 3);
  assert.ok(f.storage.getItem('guest-transfer:owner:b:product-b:'));
});

test('pending transfer rejects replacement and foreign carts without another mutation', async () => {
  const f = fixture([guest('a')]); f.lose(); await assert.rejects(f.mutate('a'));
  const cart = f.carts.get('a'); cart.id = 'replacement';
  await assert.rejects(f.mutate('a'), /saved guest cart/);
  cart.customerId = 'stranger';
  await assert.rejects(f.mutate('a'), /ownership/);
  assert.equal(f.calls.length, 1);
  assert.ok(f.storage.getItem('guest-transfer:owner:a:product-a:'));
});

test('normal authenticated adds, deltas, removal and store totals remain isolated', async () => {
  const f = fixture(); await f.mutate('a'); await f.mutate('b'); await f.mutate('a', 'update', 1);
  assert.equal([...f.carts.values()].flatMap(cart => cart.items).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), 30);
  await f.mutate('a', 'remove'); assert.equal(f.carts.get('b').items[0].quantity, 1);
});
