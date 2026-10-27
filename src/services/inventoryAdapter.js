const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return value.content || value.items || value.data || value.inventories || [];
};

const optionalId = (value) => {
  const text = String(value ?? '').trim();
  return text ? text : null;
};

const numberValue = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const inventoryStatus = (value) => {
  const status = String(value || 'ACTIVE').toUpperCase();
  return ['ACTIVE', 'INACTIVE', 'OUT_OF_STOCK'].includes(status) ? status : 'ACTIVE';
};

export const adaptInventory = (inventory, context = {}) => {
  const stores = context.stores || [];
  const products = context.products || [];
  const store = stores.find((item) => item.id === inventory?.storeId);
  const status = inventoryStatus(inventory?.status);
  const productId = inventory?.productId || null;
  const variantId = inventory?.variantId ?? null;
  const product = products.find((item) => item.productId === productId || item.id === productId);
  const variant = product?.variants?.find((item) => item.variantId === variantId || item.id === variantId);
  const storeId = inventory?.storeId || null;
  const availableQuantity = numberValue(inventory?.availableQuantity);
  const reservedQuantity = numberValue(inventory?.reservedQuantity);
  const reorderLevel = numberValue(inventory?.reorderLevel);

  return {
    id: inventory?.id || null,
    productId,
    variantId,
    storeId,
    availableQuantity,
    reservedQuantity,
    reorderLevel,
    status,
    createdAt: inventory?.createdAt || null,
    updatedAt: inventory?.updatedAt || null,
    version: inventory?.version,
    name: product?.name || product?.title || (productId ? 'Catalog product missing' : 'Inventory record'),
    sku: variant?.sku || variant?.label || variant?.name || (product ? variantId || 'Product-level' : productId || variantId || 'Product-level'),
    store: store?.name || storeId || '',
    location: store?.location || '',
    stock: availableQuantity,
    reserved: reservedQuantity,
    lowStockAt: reorderLevel,
    available: status === 'ACTIVE' ? 'Available' : 'Unavailable',
  };
};

export const adaptInventoryList = (payload, context = {}) => asArray(payload).map((item) => adaptInventory(item, context));

export const adaptStockMovement = (movement) => ({
  id: movement?.id || null,
  inventoryId: movement?.inventoryId || movement?.inventory?.id || null,
  quantity: numberValue(movement?.quantity),
  movementType: movement?.movementType || null,
  reason: movement?.reason || '',
  createdAt: movement?.createdAt || null,
});

export const adaptStockMovementList = (payload) => asArray(payload).map(adaptStockMovement);

export const toInventoryCreatePayload = (form) => ({
  productId: optionalId(form.productId),
  variantId: optionalId(form.variantId),
  storeId: optionalId(form.storeId),
  availableQuantity: numberValue(form.availableQuantity),
  reservedQuantity: numberValue(form.reservedQuantity),
  reorderLevel: numberValue(form.reorderLevel),
  status: inventoryStatus(form.status),
});

export const toInventoryUpdatePayload = (form) => {
  const payload = {
    availableQuantity: numberValue(form.availableQuantity),
    reservedQuantity: numberValue(form.reservedQuantity),
    reorderLevel: numberValue(form.reorderLevel),
    status: inventoryStatus(form.status),
  };
  return payload;
};

export const toStockOperationPayload = (quantity, reason) => ({
  quantity: numberValue(quantity),
  reason: String(reason || '').trim(),
});
