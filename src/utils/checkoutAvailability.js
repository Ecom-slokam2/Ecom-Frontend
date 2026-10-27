export const validateCheckoutAvailability = async (stores, lookup) => {
  const unavailable = [];
  for (const store of stores) for (const item of store.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error('Choose a valid item quantity before checkout.');
    let stock;
    try { stock = await lookup({ storeId: store.storeId, productId: item.productId, variantId: item.variantId }); }
    catch (reason) {
      if (Number(reason.status) === 404) {
        unavailable.push(`${item.productName || 'Item'}: no stock record at ${store.storeId}`);
        continue;
      }
      if ([401, 403].includes(Number(reason.status))) throw reason;
      throw new Error('Inventory availability could not be checked. No new checkout was submitted.', { cause: reason });
    }
    const selectedVariant = item.variantId ?? null;
    const variantMatches = String(stock?.variantId ?? '') === String(selectedVariant ?? '');
    if (String(stock?.storeId) !== String(store.storeId) || String(stock?.productId) !== String(item.productId) || !variantMatches) {
      throw new Error('Inventory response does not match the selected store and variant.');
    }
    if (typeof stock.available !== 'boolean') throw new Error('Inventory availability could not be verified.');
    if (!stock.available) unavailable.push(`${item.productName || 'Item'}: unavailable at ${store.storeId}`);
  }
  if (unavailable.length) throw new Error(`${unavailable.join('; ')}. No new checkout was submitted. An authorized inventory update is required for these items.`);
  // This is a read-only preflight; the backend's locked reservations remain authoritative.
};

