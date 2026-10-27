import { serviceBaseUrl } from '../config/serviceRoutes.js';
import { apiRequest } from './apiClient';

export const FULFILLMENT_STATUSES = ['PENDING', 'ALLOCATED', 'PACKING', 'READY_TO_SHIP', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'FAILED'];
export const FULFILLMENT_TYPES = ['SHIP_TO_HOME', 'STORE_PICKUP', 'GLOBAL', 'DIGITAL'];
export const SHIPMENT_STATUSES = ['CREATED', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED', 'RETURNED', 'CANCELLED'];

const FULFILLMENT_BASE_URL = serviceBaseUrl('fulfillment', import.meta.env);

const request = (path, options = {}) => apiRequest(FULFILLMENT_BASE_URL, path, options);

export const isFulfillmentServiceUnavailable = (error) => error?.name === 'TypeError' || Number(error?.status) >= 500;
export const isFulfillmentNotFound = (error) => Number(error?.status) === 404;

export const createFulfillment = async (data) =>
  request('/api/v1/fulfillments', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getFulfillmentById = async (fulfillmentId) =>
  request(`/api/v1/fulfillments/${encodeURIComponent(fulfillmentId)}`);

export const getFulfillmentByOrderId = async (orderId) =>
  request(`/api/v1/fulfillments/order/${encodeURIComponent(orderId)}`);

export const updateFulfillmentStatus = async (fulfillmentId, status) =>
  request(`/api/v1/fulfillments/${encodeURIComponent(fulfillmentId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const getShipmentByOrderId = async (orderId) =>
  request(`/api/v1/shipments/order/${encodeURIComponent(orderId)}`);

export const createShipment = async (data) =>
  request('/api/v1/shipments', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const updateShipmentStatus = async (shipmentId, status) =>
  request(`/api/v1/shipments/${encodeURIComponent(shipmentId)}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });

export const assignShipmentDeliveryPartner = async (shipmentId, data) =>
  request(`/api/v1/shipments/${encodeURIComponent(shipmentId)}/delivery-partner`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

export const retryCarrierShipment = async (shipmentId, data) =>
  request(`/api/v1/shipments/${encodeURIComponent(shipmentId)}/carrier-retry`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getCarrierRetryAttempts = async (shipmentId) =>
  request(`/api/v1/shipments/${encodeURIComponent(shipmentId)}/carrier-attempts`);

export const markShipmentDelivered = async (shipmentId) =>
  request(`/api/v1/shipments/${encodeURIComponent(shipmentId)}/delivered`, { method: 'PATCH' });

export const getTrackingEvents = async (shipmentId) =>
  request(`/api/v1/shipments/${encodeURIComponent(shipmentId)}/tracking-events`);

export const addTrackingEvent = async (shipmentId, data) =>
  request(`/api/v1/shipments/${encodeURIComponent(shipmentId)}/tracking-events`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const normalizeFulfillment = (fulfillment = {}) => ({
  ...fulfillment,
  id: fulfillment.id || fulfillment.fulfillmentId || '',
  fulfillmentId: fulfillment.fulfillmentId || fulfillment.id || '',
  orderId: fulfillment.orderId || '',
  customerId: fulfillment.customerId || '',
  storeId: fulfillment.storeId || '',
  shippingAddressId: fulfillment.shippingAddressId || '',
  fulfillmentType: FULFILLMENT_TYPES.includes(fulfillment.fulfillmentType) ? fulfillment.fulfillmentType : fulfillment.fulfillmentType || '',
  status: FULFILLMENT_STATUSES.includes(fulfillment.status) ? fulfillment.status : fulfillment.status || '',
});

export const normalizeShipment = (shipment = {}) => ({
  ...shipment,
  id: shipment.id || shipment.shipmentId || '',
  shipmentId: shipment.shipmentId || shipment.id || '',
  fulfillmentId: shipment.fulfillmentId || '',
  orderId: shipment.orderId || '',
  carrier: shipment.carrier || '',
  trackingNumber: shipment.trackingNumber || '',
  deliveryPartnerId: shipment.deliveryPartnerId || '',
  deliveryPartnerName: shipment.deliveryPartnerName || '',
  deliveryPartnerPhone: shipment.deliveryPartnerPhone || '',
  deliveryPartnerVehicleNumber: shipment.deliveryPartnerVehicleNumber || '',
  deliveryAssignedAt: shipment.deliveryAssignedAt || null,
  status: SHIPMENT_STATUSES.includes(shipment.status) ? shipment.status : shipment.status || '',
  shippedAt: shipment.shippedAt || null,
  deliveredAt: shipment.deliveredAt || null,
  estimatedDeliveryDate: shipment.estimatedDeliveryDate || null,
});

export const normalizeTrackingEvent = (event = {}) => ({
  ...event,
  id: event.id || event.trackingEventId || `${event.shipmentId || 'tracking'}:${event.eventTime || ''}:${event.status || ''}`,
  shipmentId: event.shipmentId || '',
  status: event.status || '',
  location: event.location || '',
  description: event.description || '',
  eventTime: event.eventTime || event.createdAt || '',
});
