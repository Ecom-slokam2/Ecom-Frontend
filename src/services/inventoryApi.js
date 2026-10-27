import { apiRequest } from './apiClient.js';

import { inventoryBaseUrl } from './inventoryConfig.js';

const INVENTORY_BASE_URL = inventoryBaseUrl(import.meta.env);
const buildQueryString = (params = {}) => {
  const search = new URLSearchParams();
  ['productId', 'variantId', 'storeId', 'status', 'page', 'size', 'sort'].forEach((key) => {
    const value = params[key];
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};
const request = (path, options = {}) => apiRequest(INVENTORY_BASE_URL, path, options);
export const createInventory = async data => request('/api/v1/inventories', { method: 'POST', body: JSON.stringify(data) });
export const updateInventory = async (id, data) => request(`/api/v1/inventories/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(data) });
export const getInventory = async id => request(`/api/v1/inventories/${encodeURIComponent(id)}`);
export const getInventories = async (params = {}) => {
  const { productId, variantId, storeId, status, page, size, sort } = params;
  return request(`/api/v1/inventories${buildQueryString({ productId, variantId, storeId, status, page, size, sort })}`);
};
const inventoryPageRows = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.inventories)) return payload.inventories;
  return null;
};
const uniqueInventoryRows = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row?.id == null ? JSON.stringify(row) : String(row.id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
export const getAllInventories = async (params = {}) => {
  const size = Number.isInteger(Number(params.size)) && Number(params.size) > 0 ? Number(params.size) : 50;
  const pageParams = { ...params, page: 0, size, sort: params.sort || 'id,asc' };
  const first = await getInventories(pageParams);
  const firstRows = inventoryPageRows(first);
  if (!firstRows) throw new Error('Inventory service returned an unsupported list response.');
  if (Array.isArray(first)) return uniqueInventoryRows(firstRows);

  const expectedTotal = Number(first?.totalElements);
  if (first?.totalElements == null || !Number.isInteger(expectedTotal) || expectedTotal < 0) {
    throw new Error('Inventory service response is missing the total record count; the list may be incomplete.');
  }
  let totalPages = Number(first?.totalPages);
  if (!Number.isInteger(totalPages) || totalPages < 0) {
    totalPages = Math.ceil(expectedTotal / Number(first.size || size));
  }
  const rows = [...firstRows];
  for (let page = 1; page < totalPages; page += 1) {
    const response = await getInventories({ ...pageParams, page });
    const pageRows = inventoryPageRows(response);
    if (!pageRows || Array.isArray(response)) {
      throw new Error(`Inventory service returned an invalid response for page ${page}.`);
    }
    if (Number.isInteger(Number(response.page)) && Number(response.page) !== page) {
      throw new Error(`Inventory service returned page ${response.page} when page ${page} was requested.`);
    }
    rows.push(...pageRows);
    if (Number.isInteger(Number(response.totalPages))) totalPages = Math.max(totalPages, Number(response.totalPages));
  }
  const uniqueRows = uniqueInventoryRows(rows);
  if (uniqueRows.length !== expectedTotal) {
    throw new Error(`Inventory service returned ${uniqueRows.length} unique records; expected ${expectedTotal}. The list may be incomplete.`);
  }
  return uniqueRows;
};
export const getInventoryForItem = ({ storeId, productId, variantId }) => request(`/api/v1/inventories${buildQueryString({ storeId, productId, variantId })}`);
export const getPublicInventoryAvailability = ({ storeId, productId, variantId }) => request(
  `/api/v1/public/inventory-availability${buildQueryString({ storeId, productId, variantId })}`,
  { auth: false, expireSession: false },
);
const inventoryRows = (payload) => Array.isArray(payload)
  ? payload
  : payload?.content || payload?.items || payload?.data || payload?.inventories || (payload ? [payload] : []);
const sameId = (left, right) => String(left ?? '') === String(right ?? '');
const matchingInventory = (payload, { storeId, productId, variantId }) => {
  const rows = inventoryRows(payload).filter((item) => sameId(item.storeId, storeId) && sameId(item.productId, productId));
  if (variantId) {
    const exact = rows.find((item) => sameId(item.variantId, variantId));
    if (exact) return exact;
  }
  return rows.find((item) => !item.variantId) || null;
};
export const findInventoryForItem = async ({ storeId, productId, variantId }) => {
  const queries = variantId
    ? [{ storeId, productId, variantId }, { storeId, productId }]
    : [{ storeId, productId }];
  for (const query of queries) {
    try {
      const match = matchingInventory(await getInventoryForItem(query), { storeId, productId, variantId });
      if (match) return match;
    } catch (error) {
      if (Number(error.status) !== 404) throw error;
    }
  }
  const payload = await getInventories({ storeId, status: 'ACTIVE' });
  const match = matchingInventory(payload, { storeId, productId, variantId });
  if (!match) {
    const error = new Error('Inventory not found for product and store');
    error.status = 404;
    throw error;
  }
  return match;
};
const stockOperation = (id, operation, data) => request(`/api/v1/inventories/${encodeURIComponent(id)}/stock/${operation}`, { method: 'POST', body: JSON.stringify(data) });
export const increaseStock = async (id, data) => stockOperation(id, 'increase', data);
export const decreaseStock = async (id, data) => stockOperation(id, 'decrease', data);
export const reserveStock = async (id, data) => stockOperation(id, 'reserve', data);
export const releaseStock = async (id, data) => stockOperation(id, 'release', data);
export const getStockMovements = async (id, params = {}) => {
  const { page, size, sort } = params;
  return request(`/api/v1/inventories/${encodeURIComponent(id)}/movements${buildQueryString({ page, size, sort })}`);
};
