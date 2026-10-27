export const STAFF_ROLES = ['super-admin', 'global-admin', 'location-admin', 'store-manager', 'delivery-partner'];

export const ROLE_LABELS = {
  customer: 'Customer',
  'super-admin': 'Super Admin',
  'global-admin': 'Global Admin',
  'location-admin': 'Location Admin',
  'store-manager': 'Store Manager',
  'delivery-partner': 'Delivery Partner',
};

export const ROLE_HIERARCHY = {
  'super-admin': ['global-admin', 'location-admin'],
  'location-admin': ['store-manager', 'delivery-partner'],
};

export const ROLE_MODULES = {
  'super-admin': ['dashboard','locations','users','stores','categories','products','banners','inventory','orders','payments','delivery','notifications','customers','reviews','coupons','reports','security','audit-logs'],
  'global-admin': ['dashboard','products','banners','inventory','orders','payments','customers','reviews','coupons','notifications','reports','audit-logs'],
  'location-admin': ['dashboard','users','stores','products','banners','inventory','orders','payments','delivery','coupons','reports'],
  'store-manager': ['dashboard','stores','products','banners','inventory','orders','delivery','coupons','reports'],
};

export const canAccessModule = (role, module) => Boolean(ROLE_MODULES[role]?.includes(module));
const sameText = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();

export const MANAGEABLE_ROLES = {
  'super-admin': ['global-admin','location-admin'],
  'location-admin': ['store-manager','delivery-partner'],
};

export const scopeRecords = (records, user, stores = [], products = []) => {
  if (!Array.isArray(records) || !user || user.role==='super-admin') return records || [];
  if (user.role==='global-admin') return records.some((record)=>(record.items||[]).length) ? records.filter((record)=>record.fulfillmentType==='global') : records;
  const ownStore = stores.find((store)=>sameText(store.id,user.storeId) || sameText(store.name,user.store));
  const permittedStores = user.store ? [user.store, ownStore?.name, ownStore?.id].filter(Boolean) : stores.filter((store) => sameText(store.location, user.location)).flatMap((store) => [store.name, store.id]);
  const permittedProducts = products.filter((product) => permittedStores.some((store)=>sameText(product.store,store) || sameText(product.storeId,store))).map((product) => product.id);
  return records.filter((record) => {
    const itemIds = (record.items || []).map((item) => item.id);
    if (itemIds.length && record.fulfillmentType==='global' && record.globalApproval!=='Approved') return false;
    if (itemIds.length && user.role==='location-admin') {
      const storeRefs=[
      record.storeId, record.sourceStoreId, record.assignedStoreId, record.store, record.sourceStore,
      ...(record.fulfilmentAssignments || []).flatMap((assignment)=>[assignment.storeId, assignment.store]),
      ...record.items.flatMap((item)=>[item.storeId, item.sourceStoreId, item.store, item.sourceStore]),
      ].filter(Boolean);
      if(storeRefs.length) return permittedStores.some((store)=>storeRefs.some((value)=>sameText(value,store)));
      return [record.sourceLocation,record.location,...(record.fulfilmentAssignments||[]).map((assignment)=>assignment.location),...record.items.map((item)=>item.sourceLocation)].some((value)=>sameText(value,user.location));
    }
    if (itemIds.length && user.role==='store-manager') return sameText(record.sourceStoreId,user.storeId) || sameText(record.storeId,user.storeId) || sameText(record.sourceStore,user.store) || sameText(record.store,user.store) || record.fulfilmentAssignments?.some((assignment)=>sameText(assignment.storeId,user.storeId) || sameText(assignment.store,user.store)) || record.items.some((item)=>sameText(item.storeId,user.storeId) || sameText(item.sourceStore,user.store) || sameText(item.store,user.store));
    if (user.store && sameText(record.name,user.store)) return true;
    if (record.role && record.location) return sameText(record.location, user.location) && (!user.store || sameText(record.store,user.store));
    if (record.store) return permittedStores.some((store)=>sameText(record.store,store));
    if (record.storeId) return permittedStores.some((store)=>sameText(record.storeId,store));
    if (record.location) return sameText(record.location, user.location);
    if (record.productId) return permittedProducts.includes(record.productId);
    if (itemIds.length) return itemIds.some((id) => permittedProducts.includes(id));
    return user.role === 'location-admin';
  });
};
