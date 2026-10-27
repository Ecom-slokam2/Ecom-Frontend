const ALL = 'All';

export const loadReportOrders = async (fetchBackendOrders, adaptOrder = (order) => order) => {
  const response = await fetchBackendOrders();
  if (!Array.isArray(response)) throw new Error('Order service returned an invalid report collection.');
  const unique = new Map();
  response.forEach((order) => {
    const adapted = adaptOrder(order);
    const id = String(adapted?.id ?? '').trim();
    if (!id) throw new Error('Order service returned a report order without an ID.');
    unique.set(id, adapted);
  });
  return [...unique.values()];
};

export const loadStoreManagerReportOrders = (fetchBackendOrders, storeId, adaptOrder = (order) => order) => {
  if (!storeId) throw new Error('A verified store assignment is required to load Store Manager reports.');
  return loadReportOrders(() => fetchBackendOrders({ storeId }), adaptOrder);
};

const orderDate = (order) => String(order.createdAt || order.created_at || '').slice(0, 10);
export const orderTotal = (order) => {
  const total = Number(order?.totalAmount ?? order?.total ?? 0);
  return Number.isFinite(total) ? total : 0;
};
const orderStatus = (order) => String(order?.status || '').trim().toUpperCase();
export const isCancelledOrder = (order) => ['CANCELLED', 'CANCELED'].includes(orderStatus(order));

export const summarizeOrders = (orders) => ({
  total: orders.length,
  created: orders.filter((order) => orderStatus(order) === 'CREATED').length,
  delivered: orders.filter((order) => orderStatus(order) === 'DELIVERED').length,
  cancelled: orders.filter(isCancelledOrder).length,
  revenue: orders.filter((order) => !isCancelledOrder(order)).reduce((sum, order) => sum + orderTotal(order), 0),
});

export const reportProductCount = (products, mappings, storeId = null, locationScoped = false) => {
  if (!locationScoped || !storeId) return products.length;
  const mappedProductIds = new Set(mappings
    .filter((mapping) => String(mapping.storeId) === String(storeId) && mapping.available !== false)
    .map((mapping) => String(mapping.productId)));
  return products.filter((product) => mappedProductIds.has(String(product.productId || product.id))).length;
};

export const reportStockUnits = (inventory, storeId = null, locationScoped = false) => inventory
  .filter((item) => !locationScoped || !storeId || String(item.storeId) === String(storeId))
  .reduce((sum, item) => sum + Number(item.availableQuantity || 0), 0);
const orderStores = (order) => [
  order.sourceStore,
  order.store,
  ...(order.fulfilmentAssignments || []).map((assignment) => assignment.store),
];
const orderLocations = (order) => [order.sourceLocation, order.location];
const matchesFilter = (values, filter) => values.some((value) => String(value || '').trim().toLowerCase() === String(filter || '').trim().toLowerCase());

export const filterReportOrders = (orders, filters) => orders.filter((order) => {
  const date = orderDate(order);
  return (!filters.from || (date && date >= filters.from))
    && (!filters.to || (date && date <= filters.to))
    && (filters.location === ALL || matchesFilter(orderLocations(order), filters.location))
    && (filters.store === ALL || matchesFilter(orderStores(order), filters.store));
});

export const calculateStorePerformance = (stores, orders, sort = 'revenue') => stores
  .map((store) => {
    const rows = orders.filter((order) => orderStores(order).includes(store.name));
    return {
      name: store.name,
      location: store.location,
      orders: rows.length,
      revenue: rows.filter((order) => !isCancelledOrder(order))
        .reduce((sum, order) => sum + orderTotal(order), 0),
    };
  })
  .sort((left, right) => sort === 'name'
    ? left.name.localeCompare(right.name)
    : sort === 'orders' ? right.orders - left.orders : right.revenue - left.revenue);

// Exports deliberately omit customer contact details, addresses, payment data, and order items.
export const buildReportExport = ({ filters, orders, storePerformance }) => {
  const summary = summarizeOrders(orders);
  return {
    filters: { ...filters },
    summary: {
      orders: summary.total,
      revenue: summary.revenue,
      delivered: summary.delivered,
    },
    storePerformance,
    orders: orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber || null,
      createdAt: order.createdAt || order.created_at || null,
      status: order.status || null,
      total: orderTotal(order),
      store: order.sourceStore || order.store || null,
      location: order.sourceLocation || order.location || null,
      fulfillmentType: order.fulfillmentType || null,
    })),
  };
};

export const downloadJsonReport = (payload, { documentRef = document, urlApi = URL, now = new Date(), schedule = (callback) => window.setTimeout(callback, 1000) } = {}) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = urlApi.createObjectURL(blob);
  const link = documentRef.createElement('a');
  const date = now.toISOString().slice(0, 10);
  link.href = url;
  link.download = `scoped-report-${date}.json`;
  link.style.display = 'none';
  try {
    documentRef.body.appendChild(link);
    link.click();
    // Keep the URL live long enough for the browser to begin resolving the download.
    schedule(() => urlApi.revokeObjectURL(url));
  } catch (error) {
    urlApi.revokeObjectURL(url);
    throw new Error(`The browser could not start the JSON download: ${error.message || 'download was blocked'}`, { cause: error });
  } finally {
    link.remove();
  }
  return link.download;
};
