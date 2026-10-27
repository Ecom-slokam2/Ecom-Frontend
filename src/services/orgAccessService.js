import { serviceBaseUrl } from '../config/serviceRoutes.js';
import { apiRequest } from './apiClient.js';
const ORG_ACCESS_BASE_URL = serviceBaseUrl('orgAccess', import.meta.env);

const normalizeRole = (role) => {
  if (!role) return null;
  const value = String(role).trim();
  const withoutPrefix = value.startsWith('ROLE_') ? value.slice('ROLE_'.length) : value;
  const normalized = withoutPrefix.toLowerCase().replace(/_/g, '-');
  const map = {
    'super-admin': 'super-admin',
    'global-admin': 'global-admin',
    'location-admin': 'location-admin',
    'store-manager': 'store-manager',
    'delivery-partner': 'delivery-partner',
    'customer': 'customer',
  };
  return map[normalized] || normalized;
};

export const teamLandingPath = (role) => role === 'delivery-partner' ? '/delivery' : role === 'store-manager' ? '/store-manager/dashboard' : ['super-admin', 'global-admin', 'location-admin'].includes(role) ? '/admin/dashboard' : '/unauthorized';

export const orgAccessService = {
  async login(username, password) {
    const payload = await apiRequest(ORG_ACCESS_BASE_URL, '/api/auth/login', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username: String(username).trim(), password: String(password) }),
    });

    const roles = Array.isArray(payload.roles) ? payload.roles : [];
    const user = await apiRequest(ORG_ACCESS_BASE_URL, '/api/users/me', { headers: { Authorization: `Bearer ${payload.token}` } });
    user.role = normalizeRole(user.role);

    return {
      user,
      token: payload.token || '',
      expiresInMillis: payload.expiresInMillis || 0,
      roles,
    };
  },
  async registerCustomer(customer) {
    return apiRequest(ORG_ACCESS_BASE_URL, '/api/auth/register', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({
        confirmPassword: String(customer.confirmPassword || ''),
        email: String(customer.email).trim(),
        password: String(customer.password),
        name: String(customer.name).trim(),
        mobile: String(customer.mobile || customer.phone).trim(),
      }),
    });
  },
  async me() {
    const user = await apiRequest(ORG_ACCESS_BASE_URL, '/api/users/me');
    user.role = normalizeRole(user.role);
    return user;
  },
  async updateMyName(name) {
    return apiRequest(ORG_ACCESS_BASE_URL, '/api/users/me/profile/name', {
      method: 'PUT',
      body: JSON.stringify({ name: String(name || '').trim() }),
    });
  },
  async validate() { return apiRequest(ORG_ACCESS_BASE_URL, '/api/auth/validate'); },
  async listUsers() { return apiRequest(ORG_ACCESS_BASE_URL, '/api/users'); },
  async createUser(user) {
    const role = String(user.role || '').toUpperCase().replace(/-/g, '_');
    const isStoreAccount = role === 'STORE_MANAGER' || role === 'DELIVERY_PARTNER';
    const isLocationAdmin = role === 'LOCATION_ADMIN';
    return apiRequest(ORG_ACCESS_BASE_URL, '/api/users', {
      method: 'POST',
      body: JSON.stringify({
        username:user.username || user.email,
        email:user.email,
        password:user.password,
        role,
        name:user.name || null,
        mobile:user.mobile || user.phone || null,
        status:user.status || 'Active',
        organizationId:user.organizationId || 'metaarch-commerce',
        // Org Access persists location_id as the canonical lower-case key used by existing memberships.
        location:isLocationAdmin && user.location ? String(user.location).trim().toLowerCase() : null,
        storeId:isStoreAccount ? user.storeId || null : null,
        store:isStoreAccount ? user.store || user.storeName || null : null,
        storeLocation:isStoreAccount ? user.storeLocation || user.location || null : null,
        storeAddress:isStoreAccount ? user.storeAddress || user.address || null : null,
        latitude:isStoreAccount && user.latitude !== '' && user.latitude != null ? Number(user.latitude) : null,
        longitude:isStoreAccount && user.longitude !== '' && user.longitude != null ? Number(user.longitude) : null,
        provider:isStoreAccount ? user.provider || null : null,
        providerPlaceId:isStoreAccount ? user.providerPlaceId || null : null,
        providerOsmType:isStoreAccount ? user.providerOsmType || null : null,
        providerOsmId:isStoreAccount ? user.providerOsmId || null : null,
        locationAccuracyMeters:isStoreAccount && user.locationAccuracyMeters !== '' && user.locationAccuracyMeters != null ? Number(user.locationAccuracyMeters) : null,
      }),
    });
  },
  async updateUser(id, user) {
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new Error('A valid staff account ID is required.');
    return apiRequest(ORG_ACCESS_BASE_URL, `/api/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: String(user.name || '').trim(),
        email: String(user.email || '').trim(),
        mobile: String(user.mobile || user.phone || '').trim() || null,
        role: String(user.role || '').toUpperCase().replace(/-/g, '_'),
        status: user.status || 'Active',
        location: user.role === 'location-admin' ? String(user.location || '').trim().toLowerCase() : null,
      }),
    });
  },
  async resetUserPassword(id, newPassword) {
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new Error('A valid staff account ID is required.');
    return apiRequest(ORG_ACCESS_BASE_URL, `/api/users/${encodeURIComponent(id)}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword: String(newPassword || '') }),
    });
  },
  async deleteUser(id) {
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) throw new Error('A valid staff account ID is required.');
    return apiRequest(ORG_ACCESS_BASE_URL, `/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  async changePassword({ currentPassword, newPassword }) {
    return apiRequest(ORG_ACCESS_BASE_URL, '/api/users/me/password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
};
