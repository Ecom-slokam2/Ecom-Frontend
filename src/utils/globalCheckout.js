import { isGlobalProduct } from './storeDelivery.js';

export const validateGlobalCheckout = async (groups, lookup) => {
  const items = groups.filter(({ line = {} }) =>
    line.fulfillmentType === 'global' || line.deliveryType === 'global' || line.storeId === 'global-store',
  ).flatMap(group => group.items);
  const products = new Map();
  for (const item of items) {
    const id = item.productId || item.id;
    if (!products.has(id)) products.set(id, await lookup(id));
    if (!isGlobalProduct(products.get(id))) {
      throw new Error(`${item.productName || item.title || 'This product'} is not eligible for global delivery. Remove it from global checkout or choose an available local store.`);
    }
  }
};

export const validateCartProducts = async (items = [], lookup) => {
  const checked = new Map();
  const missing = [];
  for (const item of items) {
    const id = item.productId || item.id;
    if (!id) {
      missing.push(item.productName || item.title || 'Product');
      continue;
    }
    if (!checked.has(id)) {
      try {
        checked.set(id, await lookup(id));
      } catch (error) {
        if (Number(error?.status) === 404) checked.set(id, null);
        else throw error;
      }
    }
    if (!checked.get(id)) missing.push(item.productName || item.title || id);
  }
  if (missing.length) {
    const names = [...new Set(missing)];
    throw new Error(`${names.join(', ')} ${names.length === 1 ? 'is' : 'are'} no longer available in the catalog. Remove ${names.length === 1 ? 'it' : 'them'} from your cart and add the current catalog item before placing the order.`);
  }
};

export const checkoutErrorMessage = (reason) => {
  const fields = reason?.payload?.fields;
  if (fields && typeof fields === 'object') {
    const details = Object.entries(fields).map(([field, message]) => `${field}: ${message}`).join('; ');
    if (details) return `${reason.payload.message || 'Checkout validation failed'}: ${details}`;
  }
  if (typeof reason?.payload?.message === 'string' && reason.payload.message.trim()) return reason.payload.message;
  if (reason?.name === 'TypeError' || Number(reason?.status) >= 500) return 'Checkout could not be completed. A service may be unavailable. Please try again shortly.';
  return reason?.message || 'Payment could not be completed.';
};
