// A failed or malformed lookup is unknown stock, never evidence of zero stock.
export const loadProductStock = async (lookup, identity) => {
  try {
    const value = await lookup(identity);
    const matches = String(value?.storeId) === String(identity.storeId) && String(value?.productId) === String(identity.productId)
      && String(value?.variantId ?? '') === String(identity.variantId ?? '');
    if (!matches || typeof value?.available !== 'boolean') {
      return { state: 'error' };
    }
    return { state: value.available ? 'available' : 'out' };
  } catch (error) {
    return { state: Number(error.status) === 404 ? 'missing' : 'error' };
  }
};
