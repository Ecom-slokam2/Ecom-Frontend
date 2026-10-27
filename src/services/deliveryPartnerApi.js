import { serviceBaseUrl } from '../config/serviceRoutes.js';
import { apiRequest } from './apiClient';
const base = serviceBaseUrl('orgAccess', import.meta.env);
export const getDeliveryPartners = () => apiRequest(base, '/api/delivery-partners');
export const createDeliveryPartner = (partner) => apiRequest(base, '/api/delivery-partners', { method: 'POST', body: JSON.stringify(partner) });
export const updateDeliveryPartner = (id, partner) => apiRequest(base, `/api/delivery-partners/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(partner) });
export const setDeliveryPartnerActive = (id, active) => apiRequest(base, `/api/delivery-partners/${encodeURIComponent(id)}/status`, { method: 'PUT', body: JSON.stringify({ active }) });

export const getMyDeliveryProfile = () => apiRequest(base, '/api/users/me');
export const updateMyDeliveryProfile = (profile) => apiRequest(base, '/api/users/me', { method:'PUT', body:JSON.stringify(profile) });
export const setMyAvailability = (active) => apiRequest(base, '/api/users/me/availability', { method:'PUT', body:JSON.stringify({ active }) });
export const saveMyDeliveryLocation = (latitude, longitude) => apiRequest(base, '/api/users/me/delivery-location', { method:'PUT', body:JSON.stringify({ latitude, longitude }) });

export const getMyDeliveries = async () => {
  let claims;
  try {
    const token = sessionStorage.getItem('authToken') || '';
    claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  } catch { /* The identity API remains authoritative for invalid tokens. */ }
  if (claims && !claims.deliveryPartnerId) {
    const message = 'Please sign in again to load your updated delivery assignments.';
    sessionStorage.setItem('signInNotice', message);
    window.dispatchEvent(new Event('customer-session-expired'));
    throw new Error(message);
  }
  try { return await apiRequest(base, '/api/delivery/me/orders', { expireSession: false }); }
  catch (error) {
    if (error.status === 401) {
      // This endpoint can surface an upstream Order/Fulfillment authentication failure.
      // Revalidate the partner session against the identity service before logging out.
      await getMyDeliveryProfile();
      throw new Error('Delivery orders are temporarily unavailable. Please retry.', { cause: error });
    }
    throw error;
  }
};
export const assignDatabasePartner = (orderId, partnerId) => apiRequest(base, `/api/delivery/orders/${encodeURIComponent(orderId)}/partner/${encodeURIComponent(partnerId)}`, { method:'PUT' });
export const deliveryAction = (orderId, action, extra = {}) => apiRequest(base, `/api/delivery/me/orders/${encodeURIComponent(orderId)}/actions`, { method:'POST', body:JSON.stringify({ action, ...extra }) });
export const requestDeliveryOtp = (orderId) => apiRequest(base, `/api/delivery/me/orders/${encodeURIComponent(orderId)}/otp`, { method:'POST' });
export const getCustomerDeliveryLocation = (orderId) => apiRequest(base, `/api/delivery/orders/${encodeURIComponent(orderId)}/live-location`);

