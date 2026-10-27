import test from 'node:test';
import assert from 'node:assert/strict';
import { orgAccessService, teamLandingPath } from './orgAccessService.js';

test('administrators land in the admin dashboard while delivery roles keep their own landing pages', () => {
  assert.equal(teamLandingPath('super-admin'), '/admin/dashboard');
  assert.equal(teamLandingPath('global-admin'), '/admin/dashboard');
  assert.equal(teamLandingPath('location-admin'), '/admin/dashboard');
  assert.equal(teamLandingPath('store-manager'), '/store-manager/dashboard');
  assert.equal(teamLandingPath('delivery-partner'), '/delivery');
  assert.equal(teamLandingPath('customer'), '/unauthorized');
});

test('Location Admin provisioning payload carries location scope without Global Admin or store ownership', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const originalWindow = globalThis.window;
  globalThis.sessionStorage = { getItem: () => 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature' };
  globalThis.window = { dispatchEvent: () => {} };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response('{}', { status: 201 });
  };
  try {
    await orgAccessService.createUser({
      username: 'location-admin', email: 'location@example.com', password: 'ValidPass123',
      role: 'location-admin', location: 'Hyderabad', storeLocation: 'Hyderabad', storeAddress: 'Should not be sent',
    });
    const body = JSON.parse(request.options.body);
    assert.equal(body.role, 'LOCATION_ADMIN');
    assert.equal(body.location, 'hyderabad');
    assert.equal(body.storeLocation, null);
    assert.equal(body.storeAddress, null);
    assert.equal(body.storeId, null);
    assert.equal(body.store, null);
  } finally { globalThis.fetch = originalFetch; globalThis.sessionStorage = originalStorage; globalThis.window = originalWindow; }
});

test('Global Admin provisioning payload does not inherit a selected location', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const originalWindow = globalThis.window;
  globalThis.sessionStorage = { getItem: () => 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature' };
  globalThis.window = { dispatchEvent: () => {} };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response('{}', { status: 201 });
  };
  try {
    await orgAccessService.createUser({
      username: 'global-admin', email: 'global@example.com', password: 'ValidPass123',
      role: 'global-admin', location: 'Hyderabad',
    });
    const body = JSON.parse(request.options.body);
    assert.equal(body.role, 'GLOBAL_ADMIN');
    assert.equal(body.location, null);
    assert.equal(body.storeLocation, null);
    assert.equal(body.storeId, null);
  } finally { globalThis.fetch = originalFetch; globalThis.sessionStorage = originalStorage; globalThis.window = originalWindow; }
});

test('staff update sends a scoped PUT payload to the numeric user endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const originalWindow = globalThis.window;
  globalThis.sessionStorage = { getItem: () => 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature' };
  globalThis.window = { dispatchEvent: () => {} };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: 21, username: 'staff', email: 'staff@example.com' }), { status: 200 });
  };
  try {
    await orgAccessService.updateUser(21, {
      name: 'Staff Name', email: 'staff@example.com', mobile: '1234567890', role: 'location-admin',
      location: 'Hyderabad', status: 'Active', password: 'should-not-be-sent', organizationId: 'untrusted-org',
    });
    assert.match(request.url, /\/api\/users\/21$/);
    assert.equal(request.options.method, 'PUT');
    assert.deepEqual(JSON.parse(request.options.body), {
      name: 'Staff Name', email: 'staff@example.com', mobile: '1234567890', role: 'LOCATION_ADMIN',
      status: 'Active', location: 'hyderabad',
    });
  } finally { globalThis.fetch = originalFetch; globalThis.sessionStorage = originalStorage; globalThis.window = originalWindow; }
});

test('staff update rejects an invalid ID before making a request', async () => {
  await assert.rejects(orgAccessService.updateUser('not-a-database-id', {}), /valid staff account ID/);
});

test('staff delete sends an authenticated DELETE to the numeric user endpoint', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const originalWindow = globalThis.window;
  globalThis.sessionStorage = { getItem: () => 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature' };
  globalThis.window = { dispatchEvent: () => {} };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(null, { status: 204 });
  };
  try {
    await orgAccessService.deleteUser(21);
    assert.match(request.url, /\/api\/users\/21$/);
    assert.equal(request.options.method, 'DELETE');
  } finally { globalThis.fetch = originalFetch; globalThis.sessionStorage = originalStorage; globalThis.window = originalWindow; }
});

test('staff delete rejects an invalid ID before making a request', async () => {
  await assert.rejects(orgAccessService.deleteUser('not-a-database-id'), /valid staff account ID/);
});

test('Super Admin profile update sends only the authenticated user name', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const originalWindow = globalThis.window;
  globalThis.sessionStorage = { getItem: () => 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature' };
  globalThis.window = { dispatchEvent: () => {} };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(JSON.stringify({ id: '1', username: 'root-admin', name: 'Root Admin', role: 'super-admin' }), { status: 200 });
  };
  try {
    const response = await orgAccessService.updateMyName(' Root Admin ');
    assert.match(request.url, /\/api\/users\/me\/profile\/name$/);
    assert.equal(request.options.method, 'PUT');
    assert.deepEqual(JSON.parse(request.options.body), { name: 'Root Admin' });
    assert.equal(response.name, 'Root Admin');
  } finally { globalThis.fetch = originalFetch; globalThis.sessionStorage = originalStorage; globalThis.window = originalWindow; }
});

test('staff update surfaces validation and permission errors from the API', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.sessionStorage;
  const originalWindow = globalThis.window;
  globalThis.sessionStorage = { getItem: () => 'header.eyJleHAiOjQxMDI0NDQ4MDB9.signature' };
  globalThis.window = { dispatchEvent: () => {} };
  globalThis.fetch = async () => new Response(JSON.stringify({ message: 'Forbidden by staff policy' }), { status: 403 });
  try {
    await assert.rejects(orgAccessService.updateUser(21, { name: 'x' }), /Forbidden by staff policy/);
  } finally { globalThis.fetch = originalFetch; globalThis.sessionStorage = originalStorage; globalThis.window = originalWindow; }
});
