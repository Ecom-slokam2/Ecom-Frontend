const ORDER_STATUS_ACTIONS = Object.freeze({
  CONFIRMED: 'CONFIRM',
  PROCESSING: 'PACKING',
  SHIPPED: 'SHIP',
  DELIVERED: 'DELIVER',
});

export const workflowActionForOrderStatus = (status) => ORDER_STATUS_ACTIONS[status] || null;

export const fulfillmentTypeForOrder = (order) => {
  const value = String(order?.fulfillmentType || '').trim().toUpperCase().replace(/[ -]/g, '_');
  if (value === 'GLOBAL' || value === 'INDIA_WIDE' || value === 'GLOBAL_STORE') return 'SHIP_TO_HOME';
  if (value === 'PICKUP' || value === 'STORE_PICKUP') return 'STORE_PICKUP';
  if (value === 'DIGITAL') return 'DIGITAL';
  return 'SHIP_TO_HOME';
};
