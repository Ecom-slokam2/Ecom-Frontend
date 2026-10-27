import { serviceBaseUrl } from '../config/serviceRoutes.js';
import { apiRequest } from './apiClient.js';
import { createOrderAttempt, retrySavedOrderAttempt } from '../utils/orderCreationAttempt.js';

export const ORDER_STATUSES = ['CREATED', 'CONFIRMED', 'PROCESSING', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
export const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'PAID', 'FAILED', 'REFUNDED'];

const ORDER_BASE_URL = serviceBaseUrl('order', import.meta.env || {});

const request = (path, options = {}) => apiRequest(ORDER_BASE_URL, path, options);

export const isOrderServiceUnavailable = (error) => error?.name === 'TypeError' || Number(error?.status) >= 500;

export const createOrder = async (data) => createOrderAttempt(data, (body, key) =>
  request('/api/v1/orders', { method: 'POST', body, headers: { 'Idempotency-Key': key } }));

export const retrySavedOrder = (customerId, storeId) => retrySavedOrderAttempt(customerId, storeId, (body, key) =>
  request('/api/v1/orders', { method: 'POST', body, headers: { 'Idempotency-Key': key } }));

export const getOrders = async (params = {}) => {
  const search = new URLSearchParams();
  if (params.storeId) search.set('storeId', params.storeId);
  return request(`/api/v1/orders${search.toString() ? `?${search.toString()}` : ''}`);
};

export const getOrder = async (orderId) => request(`/api/v1/orders/${encodeURIComponent(orderId)}`);

export const getGlobalStoreAssignmentOptions = async (orderId) => request(`/api/v1/orders/${encodeURIComponent(orderId)}/global-store-assignment-options`);

export const assignGlobalStore = async (orderId, storeId) => request(`/api/v1/orders/${encodeURIComponent(orderId)}/global-store-assignment`, {
  method: 'POST',
  body: JSON.stringify({ storeId }),
});

export const getCheckoutGroup = async (groupId) => request(`/api/v1/checkouts/${encodeURIComponent(groupId)}`);
export const getCheckoutGroupByKey = async (key) => request(`/api/v1/checkouts/by-key/${encodeURIComponent(key)}`);
export const getCheckoutGroupByCart = async (cartId) => request(`/api/v1/checkouts/by-cart/${encodeURIComponent(cartId)}`);
export const retryCheckoutGroup = async (groupId) => request(`/api/v1/checkouts/${encodeURIComponent(groupId)}/retry`, { method: 'POST' });
export const createCheckoutGroup = async (body, key) => request('/api/v1/checkouts', {
  method: 'POST', body, headers: { 'Idempotency-Key': key },
});

export const getCustomerOrders = async (customerId, options = {}) =>
  request(`/api/v1/orders/customer/${encodeURIComponent(customerId)}`, options);

export const updateOrderStatus = async (orderId, status) =>
  request(`/api/v1/orders/${encodeURIComponent(orderId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const updateOrderPaymentStatus = async (orderId, paymentStatus) =>
  request(`/api/v1/orders/${encodeURIComponent(orderId)}/payment-status`, {
    method: 'PATCH',
    body: JSON.stringify({ paymentStatus }),
  });

export const cancelOrder = async (orderId) => request(`/api/v1/orders/${encodeURIComponent(orderId)}/cancel`, { method: 'POST' });

export const getOrderItems = async (orderId) => request(`/api/v1/orders/${encodeURIComponent(orderId)}/items`);

export const reconcileOrderDelivery = async (orderId) => request(`/api/v1/orders/${encodeURIComponent(orderId)}/reconcile-delivery`, { method: 'POST' });

export const getOrderReview = async (orderId) => request(`/api/v1/orders/${encodeURIComponent(orderId)}/review`);
export const getOrderReviews = async (orderId) => request(`/api/v1/orders/${encodeURIComponent(orderId)}/reviews`);

export const saveOrderReview = async (orderId, review) =>
  request(`/api/v1/orders/${encodeURIComponent(orderId)}/reviews`, {
    method: 'POST',
    body: JSON.stringify(review),
  });

export const getCustomerOrderHistory = async (customerId) =>
  request(`/api/v1/orders/customer/${encodeURIComponent(customerId)}/history`);

export const normalizeOrderItem = (item = {}) => ({
  ...item,
  id: item.id || item.orderItemId || item.productId || item.productName || '',
  productId: item.productId || null,
  variantId: item.variantId ?? null,
  productName: item.productName || item.title || item.name || 'Product',
  title: item.productName || item.title || item.name || 'Product',
  quantity: Number(item.quantity ?? item.qty ?? 1),
  unitPrice: Number(item.unitPrice ?? item.price ?? 0),
  price: Number(item.unitPrice ?? item.price ?? 0),
  totalPrice: Number(item.totalPrice ?? item.lineTotal ?? Number(item.unitPrice ?? item.price ?? 0) * Number(item.quantity ?? item.qty ?? 1)),
  weight: item.weight || (item.variantId == null ? 'Product-level item' : String(item.variantId)),
  image: item.image || item.imageUrl || item.productImage || item.thumbnailUrl || '',
});

export const isGlobalOrder = (order = {}) => {
  const type = String(order.fulfillmentType || order.deliveryMethod || '').toLowerCase();
  const channel = String(order.channel || '').toLowerCase();
  const approval = String(order.globalApproval || '').toLowerCase();
  return type === 'global' || order.storeId === 'global-store' || approval === 'pending' || channel.includes('global') || channel.includes('7-10 days delivery') || channel.includes('5-7 days delivery');
};

export const normalizeOrder = (order = {}) => {
  const items = (Array.isArray(order.items) ? order.items : Array.isArray(order.orderItems) ? order.orderItems : []).map(normalizeOrderItem);
  const addresses = Array.isArray(order.addresses) ? order.addresses : [];
  const shippingAddress = order.shippingAddress || addresses.find((address) => address.addressType === 'SHIPPING') || addresses[0] || null;
  const billingAddress = order.billingAddress || addresses.find((address) => address.addressType === 'BILLING') || shippingAddress;
  const fulfillmentType = order.fulfillmentType || (order.deliveryMethod === 'global' || order.storeId === 'global-store' ? 'global' : order.deliveryMethod);
  const normalized = { ...order, fulfillmentType };
  const global = isGlobalOrder(normalized);
  const deliveryLabel = global ? '7-10 days delivery' : order.deliveryLabel;
  return {
    ...normalized,
    id: order.id || order.orderId || '',
    orderId: order.orderId || order.id || '',
    status: ORDER_STATUSES.includes(order.status) ? order.status : 'CREATED',
    paymentStatus: order.paymentStatus === 'PAID' ? 'SUCCESS' : PAYMENT_STATUSES.includes(order.paymentStatus) ? order.paymentStatus : 'PENDING',
    totalAmount: Number(order.totalAmount ?? order.total ?? 0),
    items: items.map((item) => ({ ...item, ...(global ? { deliveryLabel: item.deliveryLabel || deliveryLabel, sourceStore: item.sourceStore || order.sourceStore || order.store || 'India-wide Global Store' } : {}) })),
    addresses,
    shippingAddress,
    billingAddress,
    fulfillmentType,
    deliveryLabel,
    estimatedDelivery: global ? '7-10 days' : order.estimatedDelivery,
    channel: order.channel || (global ? '7-10 Days Delivery' : order.channel),
  };
};

// Turns a (normalized) order into a delivery-address entry usable by the checkout address picker.
// Reuses the customer coordinates captured on the order so the delivery quote still works.
export const orderDeliveryAddress = (order = {}) => {
  const address = order.shippingAddress
    || (order.addresses || []).find((item) => item.addressType === 'SHIPPING')
    || (order.addresses || [])[0]
    || null;
  if (!address) return null;
  const text = [address.addressLine1, address.addressLine2, address.city, address.state, address.country, address.postalCode]
    .filter(Boolean).join(', ').trim();
  if (!text) return null;
  const lat = Number(order.customerLatitude);
  const lng = Number(order.customerLongitude);
  return {
    address: text,
    recipientName: address.recipientName || '',
    phone: String(address.recipientPhone || '').replace(/\D/g, ''),
    coordinates: Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null,
    lastUsedAt: order.createdAt || order.updatedAt || null,
  };
};

export const buildOrderItemsPayload = (cartItems = []) =>
  cartItems.map((item) => ({
    productId: item.productId,
    variantId: item.variantId ?? null,
    productName: item.productName || item.title || 'Product',
    quantity: Number(item.quantity || 0),
    unitPrice: Number(item.unitPrice ?? item.price ?? 0),
  }));

const parseAddressText = (text = '') => {
  const raw = String(text || '').trim();
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const postalMatch = raw.match(/\b\d{5,6}\b/);
  const state = parts.find((part) => part.toLowerCase().includes('telangana')) || '';
  const city = parts.find((part) => part.toLowerCase().includes('hyderabad')) || '';
  return {
    addressLine1: parts.slice(0, 4).join(', ') || raw || 'Customer address',
    city,
    state,
    country: parts.find((part) => part.toLowerCase() === 'india') || 'India',
    postalCode: postalMatch?.[0] || '',
  };
};

export const buildAddressPayload = (address = {}, fallbackText = '', customer = {}) => {
  const parsed = parseAddressText(address.address || fallbackText);
  return {
    addressLine1: address.addressLine1 || address.street || address.manualLocation?.street || parsed.addressLine1,
    addressLine2: address.addressLine2 || [address.houseNumber, address.floor, address.landmark].filter(Boolean).join(', ') || null,
    city: address.city || address.manualLocation?.city || parsed.city || 'Hyderabad',
    state: address.state || address.manualLocation?.state || parsed.state || 'Telangana',
    country: address.country || parsed.country || 'India',
    postalCode: address.postalCode || address.pincode || address.manualLocation?.pincode || parsed.postalCode || '500001',
    recipientName: address.recipientName || address.contactName || address.name || customer.name || null,
    recipientPhone: customer.phone || customer.mobile || address.recipientPhone || address.contactPhone || address.phone || null,
  };
};

export const buildOrderAddressesPayload = (address = {}, fallbackText = '', customer = {}) => {
  const payload = buildAddressPayload(address, fallbackText, customer);
  return [
    { ...payload, addressType: 'SHIPPING' },
    { ...payload, addressType: 'BILLING' },
  ];
};
