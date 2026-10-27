import { apiRequest } from './apiClient';
import { catalogBaseUrl } from './catalogConfig.js';
const CATALOG_BASE_URL = catalogBaseUrl(import.meta.env);

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : '';
};

const pendingReads = new Map();
const request = (path, options = {}) => {
  if (options.method && options.method !== 'GET') return apiRequest(CATALOG_BASE_URL, path, options);
  const publicReadOptions = { ...options, auth: options.auth ?? false };
  if (publicReadOptions.signal) return apiRequest(CATALOG_BASE_URL, path, publicReadOptions);
  // Keep public storefront reads separate from authenticated admin reads.
  const key = JSON.stringify([path, publicReadOptions.auth, publicReadOptions.auth === false ? '' : sessionStorage.getItem('authToken') || '']);
  if (!pendingReads.has(key)) {
    pendingReads.set(key, apiRequest(CATALOG_BASE_URL, path, publicReadOptions).finally(() => pendingReads.delete(key)));
  }
  return pendingReads.get(key);
};
const quoteCache = new Map();
const QUOTE_CACHE_TTL_MS = 60 * 1000;
const quoteCacheKey = (storeId, params = {}) => [
  storeId,
  Number(params.latitude).toFixed(5),
  Number(params.longitude).toFixed(5),
  params.orderTotal ?? '',
  params.deliveryMethod ?? '',
].join('|');

export const getCategories = async () => request('/api/v1/categories');
export const getCategory = async (categoryId) => request(`/api/v1/categories/${encodeURIComponent(categoryId)}`);
export const createCategory = async (data) => request('/api/v1/categories', { method:'POST', body:JSON.stringify(data) });
export const updateCategory = async (id, data) => request(`/api/v1/categories/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteCategory = async (id) => request(`/api/v1/categories/${encodeURIComponent(id)}`, { method:'DELETE' });
export const getCategoryProducts = async (categoryId, params = {}, options = {}) => {
  if (!categoryId) return getProducts(params, options);
  return request(`/api/v1/categories/${encodeURIComponent(categoryId)}/products${buildQueryString(params)}`, options);
};

export const getBanners = async (params = {}, options = {}) => request(`/api/v1/banners${buildQueryString(params)}`, options);
export const createBanner = async (data) => request('/api/v1/banners', { method:'POST', body:JSON.stringify(data) });
export const updateBanner = async (id, data) => request(`/api/v1/banners/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteBanner = async (id) => request(`/api/v1/banners/${encodeURIComponent(id)}`, { method:'DELETE' });
export const setBannerStatus = async (id, status) => request(`/api/v1/banners/${encodeURIComponent(id)}/status`, { method:'PATCH', body:JSON.stringify({ status }) });

export const getCoupons = async () => request('/api/v1/coupons', { auth:true });
export const validateCouponPromotion = async (data) => request('/api/v1/coupons/validate', { method:'POST', body:JSON.stringify(data) });
export const createCoupon = async (data) => request('/api/v1/coupons', { method:'POST', body:JSON.stringify(data) });
export const updateCoupon = async (id, data) => request(`/api/v1/coupons/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const setCouponStatus = async (id, status) => request(`/api/v1/coupons/${encodeURIComponent(id)}/status`, { method:'PATCH', body:JSON.stringify({ status }) });
export const deleteCoupon = async (id) => request(`/api/v1/coupons/${encodeURIComponent(id)}`, { method:'DELETE' });

export const getProducts = async (params = {}, options = {}) => request(`/api/v1/products${buildQueryString(params)}`, options);
export const getLocationProducts = async (params = {}) => request(`/api/v1/location-products${buildQueryString(params)}`, { auth:true });
export const createLocationProduct = async (data) => request('/api/v1/location-products', { method:'POST', body:JSON.stringify(data) });
export const updateLocationProduct = async (id, data) => request(`/api/v1/location-products/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const setLocationProductAvailability = async (id, available) => request(`/api/v1/location-products/${encodeURIComponent(id)}/availability`, { method:'PATCH', body:JSON.stringify({available}) });
export const deleteLocationProduct = async (id) => request(`/api/v1/location-products/${encodeURIComponent(id)}`, { method:'DELETE' });
export const getStoreManagerProducts = async (params = {}) => request(`/api/v1/store-manager-products${buildQueryString(params)}`, { auth:true });
export const createStoreManagerProduct = async (data) => request('/api/v1/store-manager-products', { method:'POST', body:JSON.stringify(data) });
export const updateStoreManagerProduct = async (id, data) => request(`/api/v1/store-manager-products/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const setStoreManagerProductAvailability = async (id, available) => request(`/api/v1/store-manager-products/${encodeURIComponent(id)}/availability`, { method:'PATCH', body:JSON.stringify({available}) });
export const deleteStoreManagerProduct = async (id) => request(`/api/v1/store-manager-products/${encodeURIComponent(id)}`, { method:'DELETE' });
export const searchProducts = async (params = {}) => getProducts(params);
export const getProduct = async (productId, options = {}) => request(`/api/v1/products/${encodeURIComponent(productId)}`, options);
export const createProduct = async (data) => request('/api/v1/products', { method:'POST', body:JSON.stringify(data) });
export const updateProduct = async (id, data) => request(`/api/v1/products/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteProduct = async (id) => request(`/api/v1/products/${encodeURIComponent(id)}`, { method:'DELETE' });
export const getStores = async (params = {}, options = {}) => request(`/api/v1/stores${buildQueryString(params)}`, options);
export const getStore = async (storeId, options = {}) => request(`/api/v1/stores/${encodeURIComponent(storeId)}`, options);
export const createStore = async (data) => request('/api/v1/stores', { method:'POST', body:JSON.stringify(data) });
export const updateStore = async (id, data) => request(`/api/v1/stores/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteStore = async (id) => request(`/api/v1/stores/${encodeURIComponent(id)}`, { method:'DELETE' });
export const getLocations = async (params = {}, options = {}) => request(`/api/v1/locations${buildQueryString(params)}`, options);
export const createLocation = async (data) => request('/api/v1/locations', { method:'POST', body:JSON.stringify(data) });
export const updateLocation = async (id, data) => request(`/api/v1/locations/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteLocation = async (id) => request(`/api/v1/locations/${encodeURIComponent(id)}`, { method:'DELETE' });
export const getStoreDeliveryZones = async (storeId, options = {}) => request(`/api/v1/stores/${encodeURIComponent(storeId)}/delivery-zones`, options);
export const createStoreDeliveryZone = async (storeId, data) => request(`/api/v1/stores/${encodeURIComponent(storeId)}/delivery-zones`, { method:'POST', body:JSON.stringify(data) });
export const updateStoreDeliveryZone = async (storeId, zoneId, data) => request(`/api/v1/stores/${encodeURIComponent(storeId)}/delivery-zones/${encodeURIComponent(zoneId)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteStoreDeliveryZone = async (storeId, zoneId) => request(`/api/v1/stores/${encodeURIComponent(storeId)}/delivery-zones/${encodeURIComponent(zoneId)}`, { method:'DELETE' });
export const getStoreDeliveryQuote = async (storeId, params = {}) => request(`/api/v1/stores/${encodeURIComponent(storeId)}/delivery-quote${buildQueryString(params)}`);
export const getCachedStoreDeliveryQuote = async (storeId, params = {}) => {
  const key = quoteCacheKey(storeId, params);
  const cached = quoteCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.promise;
  if (cached) quoteCache.delete(key);
  const entry = { promise: null, expiresAt: Date.now() + QUOTE_CACHE_TTL_MS };
  entry.promise = getStoreDeliveryQuote(storeId, params).catch((error) => {
    if (quoteCache.get(key) === entry) quoteCache.delete(key);
    throw error;
  });
  quoteCache.set(key, entry);
  return entry.promise;
};
export const clearDeliveryQuoteCache = () => quoteCache.clear();
export const getProductVariants = async (productId, options = {}) => request(`/api/v1/products/${encodeURIComponent(productId)}/variants`, options);
export const getVariant = async (variantId, options = {}) => request(`/api/v1/variants/${encodeURIComponent(variantId)}`, options);
export const createVariant = async (productId, data) => request(`/api/v1/products/${encodeURIComponent(productId)}/variants`, { method:'POST', body:JSON.stringify(data) });
export const updateVariant = async (id, data) => request(`/api/v1/variants/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteVariant = async (id) => request(`/api/v1/variants/${encodeURIComponent(id)}`, { method:'DELETE' });
export const getProductImages = async (productId, options = {}) => request(`/api/v1/products/${encodeURIComponent(productId)}/images`, options);
export const getImage = async (imageId, options = {}) => request(`/api/v1/images/${encodeURIComponent(imageId)}`, options);
export const createImage = async (productId, data) => request(`/api/v1/products/${encodeURIComponent(productId)}/images`, { method:'POST', body:JSON.stringify(data) });
export const updateImage = async (id, data) => request(`/api/v1/images/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteImage = async (id) => request(`/api/v1/images/${encodeURIComponent(id)}`, { method:'DELETE' });
export const getStoreProducts = async (storeId, params = {}) => {
  const query = new URLSearchParams();
  if (storeId) query.set('storeId', String(storeId));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  return request(`/api/v1/store-products${query.toString() ? `?${query.toString()}` : ''}`, { auth: true });
};
export const getPublicStoreProducts = async (storeId, params = {}) => {
  const query = new URLSearchParams();
  if (storeId) query.set('storeId', String(storeId));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  return request('/api/v1/public/store-products' + (query.toString() ? '?' + query.toString() : ''), { auth: false });
};
export const createStoreProduct = async (data) => request('/api/v1/store-products', { method:'POST', body:JSON.stringify(data) });
export const updateStoreProduct = async (id, data) => request(`/api/v1/store-products/${encodeURIComponent(id)}`, { method:'PUT', body:JSON.stringify(data) });
export const deleteStoreProduct = async (id) => request(`/api/v1/store-products/${encodeURIComponent(id)}`, { method:'DELETE' });
