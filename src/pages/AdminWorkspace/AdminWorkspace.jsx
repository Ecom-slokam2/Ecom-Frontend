import { storeManagerNavItems } from '../../config/storeManagerNavigation';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Autocomplete, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputBase, MenuItem, Select, TextField, Tooltip, Typography } from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleAltOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import StarOutlineIcon from '@mui/icons-material/StarOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { collectionStore, notificationStore, orderStore, staffProfileStore, subscribeToLocalData } from '../../services/localDataService';
import { createBanner, createCategory, createCoupon, createImage, createLocation, createLocationProduct, createProduct, createStore, createStoreDeliveryZone, createStoreProduct, createVariant, deleteBanner, deleteCategory, deleteCoupon, deleteImage, deleteLocation, deleteLocationProduct, deleteProduct, deleteStore, deleteStoreDeliveryZone, deleteStoreProduct, deleteVariant, getBanners, getCategories, getCoupons, getLocations, getLocationProducts, getProductImages, getProducts, getProductVariants, getStoreDeliveryZones, getStores, getStoreProducts, getStoreManagerProducts, setBannerStatus, setCouponStatus, setLocationProductAvailability, updateBanner, updateCategory, updateCoupon, updateImage, updateLocation, updateLocationProduct, updateProduct, updateStore, updateStoreDeliveryZone, updateStoreProduct, updateVariant } from '../../services/catalogApi';
import { adaptProductList, adaptStoreProductList, adaptLocation, adaptLocationList } from '../../services/catalogAdapter';
import { createInventory, getAllInventories, getInventories, getInventory, increaseStock, decreaseStock, reserveStock, releaseStock, updateInventory } from '../../services/inventoryApi';
import { adaptInventory, adaptInventoryList, toInventoryCreatePayload, toInventoryUpdatePayload, toStockOperationPayload } from '../../services/inventoryAdapter';
import { filterInventoryRecords, paginateInventoryRecords } from '../../utils/inventoryList.js';
import { orgAccessService } from '../../services/orgAccessService';
import { getAllCustomers, getCustomerTotal } from '../../services/adminCustomerApi.js';
import { getAuditLogs } from '../../services/adminAuditApi.js';
import { formatAdminOrderDetailValue } from './adminOrderDetail.js';
import { validateStaffPasswordChange } from '../../utils/staffPasswordValidation.js';
import { applyStatusFilterChange } from './adminWorkspaceFilters.js';
import { ORDER_STATUSES, cancelOrder, getOrder, getOrderItems, getOrders, normalizeOrder, updateOrderStatus } from '../../services/orderApi';
import { runOrderServiceWorkflow } from '../../services/orderServiceWorkflow';
import { workflowActionForOrderStatus } from '../../services/orderWorkflowRouting.js';
import { getFulfillmentByOrderId, getShipmentByOrderId, getTrackingEvents, isFulfillmentNotFound } from '../../services/fulfillmentApi';
import { getNotificationsByOrder } from '../../services/notificationApi';
import { geocodeOpenStreetMap, openStreetMapEmbedUrl, openStreetMapLocationUrl } from '../../services/openStreetMapService';
import { DELIVERY_MODE_OPTIONS, isGlobalStore } from '../../utils/storeDelivery';
import { bannerImageFor, categoryImageFor, productImageFor } from '../../services/categoryImages';
import logo from '../../assets/images/logo.png';
import BrandLoader from '../../components/BrandLoader/BrandLoader';
import SafeProductImage from '../../components/SafeProductImage/SafeProductImage';
import LocationMapPicker from '../../components/LocationMapPicker/LocationMapPicker';
import AdminReports from './AdminReports';
import { isCancelledOrder, loadReportOrders, loadStoreManagerReportOrders, orderTotal, summarizeOrders } from './adminReportData.js';
import { countLowStockInventory, getLowStockInventory } from './adminDashboardData.js';
import GlobalStoreAssignment from './GlobalStoreAssignment';
import DeliveryPartnerAssignment from './DeliveryPartnerAssignment';
import AdminDeliveryPartners from './AdminDeliveryPartners.jsx';
import { orderAssignmentPath } from '../../utils/orderAssignmentRoute.js';
import { toCouponPayload } from './adminCoupon.js';
import { toBannerPayload } from './adminBanner.js';
import { canAccessModule, MANAGEABLE_ROLES, ROLE_LABELS, scopeRecords } from '../../config/accessControl';
import AdminReviewsPanel from './AdminReviewsPanel';
import './AdminWorkspace.css';
import './AdminWorkspaceFinish.css';
import './AdminFormFixes.css';

const modules = ['dashboard','locations','users','categories','stores','products','banners','inventory','orders','payments','delivery','notifications','customers','reviews','coupons','reports','security','audit-logs'];
const titles = Object.fromEntries(modules.map((name) => [name, name.split('-').map((word) => word[0].toUpperCase()+word.slice(1)).join(' ')]));
const navIcons = { dashboard:<DashboardOutlinedIcon/>,locations:<LocationOnOutlinedIcon/>,users:<PeopleOutlineIcon/>,categories:<CategoryOutlinedIcon/>,stores:<StorefrontOutlinedIcon/>,products:<Inventory2OutlinedIcon/>,banners:<ImageOutlinedIcon/>,inventory:<Inventory2OutlinedIcon/>,orders:<ShoppingBagOutlinedIcon/>,payments:<AccountBalanceWalletOutlinedIcon/>,delivery:<LocalShippingOutlinedIcon/>,notifications:<NotificationsNoneOutlinedIcon/>,customers:<PeopleOutlineIcon/>,reviews:<StarOutlineIcon/>,coupons:<LocalOfferOutlinedIcon/>,reports:<AssessmentOutlinedIcon/>,cms:<DescriptionOutlinedIcon/>,security:<SecurityOutlinedIcon/>,'audit-logs':<HistoryOutlinedIcon/>,settings:<SettingsOutlinedIcon/> };
const navGroups = [['Main',['dashboard']],['Management',['locations','users','stores','products','categories','banners','inventory']],['Orders & Payments',['orders','payments','delivery']],['Customer',['customers','reviews','coupons','notifications']],['Analytics',['reports']],['System',['security','audit-logs']]];
const schemas = {
  locations: [['name','Location name','text',true],['code','Code','text',true],['address','Address','textarea',true],['city','City','text',true],['state','State'],['country','Country'],['pincode','Pincode'],['latitude','Latitude','number'],['longitude','Longitude','number'],['mapPicker','Location map','locationMap'],['phone','Contact number'],['email','Email','email'],['admin','Assigned admin']],
  users: [['name','Name','text',true],['username','Login username','text'],['email','Email','email',true],['mobile','Mobile','text',true],['role','Role','select',true,['global-admin','location-admin','store-manager']],['location','Location','lookup'],['store','Store','lookup'],['storeName','New store name','text'],['storeLocation','New store location','osmLocation'],['storeAddress','New store address','textarea'],['password','Password','password',true],['status','Status','select',true,['Active','Inactive','Blocked']]],
  categories: [['name','Category name','text',true],['description','Description','textarea'],['thumbnailUrl','Thumbnail URL','url'],['status','Status','select',true,['Active','Inactive']]],
  stores: [['name','Store name','text',true],['storeCode','Store code','text'],['description','Store description','textarea'],['adminName','Store manager name','text'],['location','Location','osmLocation',true],['address','Address','textarea'],['doorNumber','Door number','text'],['streetName','Street / road name','text'],['area','Area','text'],['landmark','Landmark','text'],['city','City','text'],['district','District','text'],['state','State','text'],['pincode','Pincode','text'],['phone','Store mobile number','text'],['alternatePhone','Alternate mobile number','text'],['email','Store email','email'],['gstNumber','GST number','text'],['storeRating','Store rating','number'],['logoUrl','Store logo/image URL','url'],['delivery','Delivery available','select',true,['Yes','No']],['pickup','Pickup available','select',true,['Yes','No']],['status','Store status','select',true,['Active','Inactive','Temporarily Closed']],['deliveryRadiusKm','Order radius in KM','number',true],['deliveryEtaMinutes','Delivery ETA minutes','number',true],['deliveryCharge','Delivery charge','number'],['freeDeliveryAbove','Free delivery above order value','number'],['deliveryModes','Delivery modes (comma separated)','textarea'],['deliveryNotes','Delivery notes','textarea'],['currentPassword','Current password','password'],['newPassword','New password','password']],
  products: [['name','Product name','text',true],['sku','Master SKU','text',true],['category','Category','lookup',true],['subcategory','Sub-category'],['description','Description','textarea',true],['brand','Brand'],['ingredients','Ingredients','textarea'],['specifications','Specifications','textarea'],['pack','Pack'],['type','Type'],['shelfLife','Shelf life'],['tags','Tags'],['highlights','Highlights','textarea'],['aboutSource','About the Source','textarea'],['variants','Variants (one per line: Label | SKU | Price)','textarea'],['price','Default price','number',true],['image','Main image URL','url'],['featured','Featured product','select',false,['Yes','No']],['special','Special product','select',false,['Yes','No']],['newArrival','New arrival','select',false,['Yes','No']],['bestSeller','Best seller','select',false,['Yes','No']],['status','Status','select',true,['Active','Inactive','Draft']]],
  banners: [['name','Banner title','text',true],['description','Description','textarea'],['image','Desktop image','image',true],['mobileImage','Mobile image','image'],['startDate','Start date','date'],['endDate','End date','date'],['location','Location','lookup'],['store','Store','lookup'],['sortOrder','Sort order','number'],['targetUrl','Target URL','url'],['status','Status','select',true,['Active','Scheduled','Inactive']]],
  inventory: [['productId','Product ID','lookup',true],['variantId','Variant ID','select',false,[]],['storeId','Store','select',true,[]],['availableQuantity','Current stock','number',true],['reservedQuantity','Reserved stock','number'],['reorderLevel','Low-stock threshold','number'],['status','Availability','select',true,['ACTIVE','INACTIVE','OUT_OF_STOCK']]],
  delivery: [['name','Partner name','text',true],['phone','Mobile number','text',true],['email','Email','email'],['vehicleNumber','Vehicle number','text',true],['vehicleType','Vehicle type','select',true,['Bike','Scooter','Electric Bike','Van']],['address','Full address','textarea',true],['location','Location','text',true],['emergencyContact','Emergency contact'],['licenseNumber','Driving licence number'],['password','Temporary password','password',true],['status','Status','select',true,['Active','Inactive','On Delivery']]],
  notifications: [['name','Title','text',true],['message','Message','textarea',true],['audience','Audience','select',true,['All Customers','Customer','Store','Delivery Partner']],['location','Location'],['type','Type','select',true,['Order placed','Order confirmed','Preparing','Out for delivery','Delivered','Cancelled','Promotion']],['schedule','Schedule','datetime-local']],
  customers: [['name','Name','text',true],['phone','Mobile','text',true],['email','Email','email'],['location','Location'],['spending','Total spending','number'],['notes','Customer notes','textarea'],['status','Status','select',true,['Active','Inactive','Blocked']]],
  reviews: [['name','Customer','text',true],['product','Product','text',true],['text','Review','textarea',true],['rating','Rating (1-5)','number',true],['location','Location'],['status','Approval status','select',true,['Pending','Approved','Rejected']],['reply','Admin reply','textarea'],['image','Primary review image','image'],['images','Review images','images']],
  coupons: [['name','Coupon code','text',true],['couponName','Coupon name','text',true],['description','Description','textarea'],['discountType','Discount type','select',true,['Percentage','Fixed']],['discount','Discount value','number',true],['minimumOrder','Minimum order','number'],['maximumDiscount','Maximum discount','number'],['startDate','Start date','date',true],['expiry','Expiry date','date',true],['usageLimit','Usage limit','number',true],['perUserLimit','Per-user limit','number'],['location','Location','lookup'],['store','Store','lookup'],['product','Product','lookup'],['category','Category','lookup'],['eligibility','Customer eligibility','select',true,['All customers','New customers','Returning customers','VIP customers','First order only','Selected customers']],['status','Status','select',true,['Active','Inactive']]],
  cms: [['name','Page','select',true,['About Us','Privacy Policy','Terms & Conditions','Contact Us','FAQ','Support']],['content','Content','textarea',true],['status','Status','select',true,['Published','Draft']]],
  security: [['name','Setting name','text',true],['description','Description','textarea'],['type','Type','select',true,['RBAC','2FA','Session','IP Restriction']],['value','Value'],['status','Status','select',true,['Enabled','Disabled']]],
  settings: [['name','Setting name','text',true],['description','Description','textarea'],['value','Value','text',true],['status','Status','select',true,['Enabled','Disabled']]],
  'audit-logs': [],
};

schemas.coupons.splice(2,0,['scope','Coupon scope','select',true,['Global','Location','Store']]);
schemas.banners.splice(2,0,['scope','Banner scope','select',true,['Global','Location','Store']]);
schemas.banners=schemas.banners.filter(([key])=>!['scope','location','store'].includes(key));
const baseBannerSchema=[...schemas.banners];
const fullCouponSchema=[...schemas.coupons];
const baseDeliverySchema=[...schemas.delivery];
const storeManagerDeliverySchema = [
  ['minRadiusKm','Minimum distance KM','number',true],
  ['maxRadiusKm','Maximum distance KM','number',true],
  ['estimatedDeliveryMin','Min delivery minutes','number'],
  ['estimatedDeliveryMax','Max delivery minutes','number'],
  ['deliveryCharge','Delivery charge','number',true],
  ['freeDeliveryAbove','Free delivery above','number'],
  ['minimumOrder','Minimum order value','number'],
  ['methods','Delivery methods','checks',true,DELIVERY_MODE_OPTIONS],
  ['status','Status','select',true,['Active','Inactive']],
  ['radiusMap','Radius map','radiusMap'],
];

const slugify = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const usernameFrom = (data) => slugify(data.username || String(data.email || '').split('@')[0] || data.name).replace(/-/g, '') || `user${Date.now()}`;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storeIdFromName = (name) => `store-${slugify(name) || Date.now()}`;
const adminCategory = (item) => ({ ...item, image:item.thumbnailUrl || item.image || item.imageUrl || categoryImageFor(item), status:item.active ? 'Active' : 'Inactive' });
const BANNER_STATUS_FROM_API = { ACTIVE:'Active', SCHEDULED:'Scheduled', INACTIVE:'Inactive' };
const BANNER_SCOPE_FROM_API = { GLOBAL:'Global', LOCATION:'Location', STORE:'Store' };
const adminCoupon = (item) => ({
  ...item,
  _databaseRecord:true,
  name:item.code || item.name || '',
  couponName:item.couponName || item.code || item.name || '',
  discountType:String(item.discountType || 'PERCENTAGE').toUpperCase()==='FIXED'?'Fixed':'Percentage',
  scope:BANNER_SCOPE_FROM_API[String(item.scope || 'GLOBAL').toUpperCase()] || item.scope || 'Global',
  status:String(item.status || (item.active===false?'INACTIVE':'ACTIVE')).toUpperCase()==='INACTIVE'?'Inactive':'Active',
  startDate:item.startDate || '',
  expiry:item.expiry || '',
});
const adminBanner = (item) => ({
  ...item,
  name:item.title || item.name || '',
  image:item.imageUrl || item.image || bannerImageFor(item),
  mobileImage:item.mobileImageUrl || item.mobileImage || item.imageUrl || item.image || bannerImageFor(item),
  startDate:item.startsOn || item.startDate || '',
  endDate:item.endsOn || item.endDate || '',
  sortOrder:item.sortOrder ?? 0,
  targetUrl:item.targetUrl || '',
  scope:BANNER_SCOPE_FROM_API[item.scope] || item.scope || 'Global',
  location:item.locationId || item.location || '',
  store:item.storeId || item.store || '',
  status:BANNER_STATUS_FROM_API[item.status] || item.status || 'Active',
});
const adminProduct = (item) => ({
  ...item,
  category:item.categoryName,
  status:item.ownerLocation&&item.locationAvailable!=null?(item.locationAvailable?'Active':'Inactive'):item.status === 'ACTIVE' ? 'Active' : item.status === 'INACTIVE' ? 'Inactive' : 'Draft',
  featured:(item.featured ?? item.is_featured) ? 'Yes' : 'No',
  special:(item.special ?? item.is_special) ? 'Yes' : 'No',
  newArrival:(item.newArrival ?? item.new_arrival) ? 'Yes' : 'No',
  bestSeller:(item.bestSeller ?? item.best_seller) ? 'Yes' : 'No',
  price:item.variants?.[0]?.price ?? 0,
  variants:(item.variants || []).map((variant) => `${variant.name} | ${variant.sku} | ${variant.price}`).join('\n'),
  _variantSnapshot:(item.variants || []).map(({id,name,sku})=>({id,name,sku})),
  image:(item.images || []).find((image) => image.primaryImage)?.url || item.images?.[0]?.url || item.image || item.imageUrl || productImageFor(item),
});
const looksLikeGlobalStoreRef = (value) => /india[\s-]?wide|global[\s-]?store/i.test(String(value || ''));
const adminOrder = (order, stores = []) => {
  const store = stores.find((item)=>item.id === order.storeId || item.name === order.storeId);
  // An order that belongs to a physical store is owned by that store's manager, even when the
  // customer picked long-distance (5-7 day / "global") delivery. Only orders for the India-wide
  // Global Store are managed by the global admin.
  const globalOrder = store
    ? isGlobalStore(store)
    : order.fulfillmentType === 'global'
      || String(order.deliveryMethod || '').toLowerCase() === 'global'
      || looksLikeGlobalStoreRef(order.storeId);
  return {
    ...order,
    fulfillmentType: globalOrder ? 'global' : (order.fulfillmentType === 'global' ? 'nearby' : order.fulfillmentType),
    globalApproval: globalOrder ? order.globalApproval || 'Pending' : order.globalApproval || 'Not Required',
    deliveryLabel: globalOrder ? order.deliveryLabel || '7-10 days delivery' : order.deliveryLabel,
    estimatedDelivery: globalOrder ? order.estimatedDelivery || '7-10 days' : order.estimatedDelivery,
    store:store?.name || order.store || order.storeId,
    sourceStore:store?.name || order.sourceStore || order.storeId,
    location:store?.location || order.location || '',
    sourceLocation:store?.location || order.sourceLocation || '',
  };
};
const sameText = (left, right) => String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
// Trust the fulfilment type resolved by adminOrder(): a bare deliveryMethod of "global" on a
// physical-store order does not make it a global-admin order.
const isGlobalOrder = (order = {}) => order.fulfillmentType === 'global';
const ORDER_STATUS_FLOW = ['CREATED', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
const getOrderStatus = (order = {}) => String(order.status || '').toUpperCase();
const refreshBackendRecord = async (record, stores = []) => UUID_PATTERN.test(record?.id) ? fetchBackendOrder(record.id, stores) : record;
const updateBackendOrderStatusSafely = async (orderId, targetStatus, currentStatus) => {
  if (targetStatus === 'CANCELLED') return cancelOrder(orderId);
  const latest = await getOrder(orderId).catch(() => null);
  const fromStatus = latest?.status || currentStatus;
  if (fromStatus === targetStatus) return latest;
  const fromIndex = ORDER_STATUS_FLOW.indexOf(fromStatus);
  const targetIndex = ORDER_STATUS_FLOW.indexOf(targetStatus);
  if (fromIndex === -1 || targetIndex === -1 || targetIndex < fromIndex) {
    throw new Error(`Invalid order status transition from ${fromStatus} to ${targetStatus}`);
  }
  let updated = latest;
  for (const nextStatus of ORDER_STATUS_FLOW.slice(fromIndex + 1, targetIndex + 1)) {
    updated = await updateOrderStatus(orderId, nextStatus);
  }
  return updated;
};
const orderBelongsToStore = (order, storeId, storeName) =>
  sameText(order.storeId, storeId)
  || sameText(order.sourceStoreId, storeId)
  || sameText(order.assignedStoreId, storeId)
  || sameText(order.store, storeName)
  || sameText(order.sourceStore, storeName)
  || (order.items || []).some((item) =>
    sameText(item.storeId, storeId)
    || sameText(item.sourceStoreId, storeId)
    || sameText(item.store, storeName)
    || sameText(item.sourceStore, storeName)
  );
const fetchBackendOrder = async (orderId, stores = []) => {
  const [orderResponse, itemsResponse] = await Promise.all([getOrder(orderId), getOrderItems(orderId)]);
  const items = Array.isArray(itemsResponse) ? itemsResponse : itemsResponse?.items;
  const order = adminOrder(normalizeOrder(items ? { ...orderResponse, items } : orderResponse), stores);
  const shouldFetchFulfillment = true;
  const shouldFetchShipment = true;
  const missingAsNull = (request) => request.catch((error) => {
    if (isFulfillmentNotFound(error)) return null;
    throw error;
  });
  const [fulfillment, shipment, notificationPayload] = await Promise.all([
    shouldFetchFulfillment ? missingAsNull(getFulfillmentByOrderId(orderId)) : Promise.resolve(null),
    shouldFetchShipment ? missingAsNull(getShipmentByOrderId(orderId)) : Promise.resolve(null),
    getNotificationsByOrder(orderId).catch(() => null),
  ]);
  const trackingEvents = shipment?.id ? await getTrackingEvents(shipment.id) : [];
  const notifications = Array.isArray(notificationPayload)
    ? notificationPayload
    : notificationPayload?.content || notificationPayload?.items || [];
  const trackingHistory = trackingEvents.map((event) =>
    [event.status, event.location, event.description, event.eventTime].filter(Boolean).join(' | '));
  const notificationHistory = notifications.map((notification) =>
    [notification.notificationType, notification.status, notification.subject, notification.createdAt].filter(Boolean).join(' | '));
  return { ...order, fulfillment, shipment, deliveryPartnerId:shipment?.deliveryPartnerId || '', deliveryPartner:shipment?.deliveryPartnerId ? {id:shipment.deliveryPartnerId,name:shipment.deliveryPartnerName,vehicleNumber:shipment.deliveryPartnerVehicleNumber} : null, trackingHistory, notificationHistory };
};
// eslint-disable-next-line no-unused-vars
const OrderOperationsSummary = ({ order }) => (
  <Box sx={{ gridColumn: '1 / -1', display: 'grid', gap: 1.25, mb: 1 }}>
    <Typography variant="h6">Service status</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
      <Box sx={{ border: '1px solid #dfe8e3', p: 1.25, borderRadius: 1 }}><Typography variant="caption">Order Service</Typography><Typography fontWeight={700}>{order.status}</Typography></Box>
      <Box sx={{ border: '1px solid #dfe8e3', p: 1.25, borderRadius: 1 }}><Typography variant="caption">Fulfillment Service</Typography><Typography fontWeight={700}>{order.fulfillment?.status || 'Not created'}</Typography></Box>
      <Box sx={{ border: '1px solid #dfe8e3', p: 1.25, borderRadius: 1 }}><Typography variant="caption">Shipment</Typography><Typography fontWeight={700}>{order.shipment?.status || 'Not created'}</Typography></Box>
    </Box>
    <Typography variant="body2" color="text.secondary">
      Tracking events: {order.trackingEvents?.length || 0} | Notifications in DB: {order.notifications?.length || 0}
    </Typography>
  </Box>
);
const variantRows = (value, fallbackSku, fallbackPrice) => {
  const rows=String(value || '').split(/\r?\n/).map((line)=>line.trim()).filter(Boolean).map((line)=>{const [name,sku,price]=line.split('|').map((part)=>part.trim());return { name:name || 'Default',sku:sku || fallbackSku,price:Number(price || fallbackPrice),compareAtPrice:Number(price || fallbackPrice),attributes:JSON.stringify({ label:name || 'Default' }),active:true };});
  return rows.length ? rows : [{ name:'Default',sku:fallbackSku,price:Number(fallbackPrice),compareAtPrice:Number(fallbackPrice),attributes:JSON.stringify({ label:'Default' }),active:true }];
};
const inventoryFormRecord = (record) => ({
  ...record,
  productId: record.productId ?? null,
  variantId: record.variantId ?? null,
  storeId: record.storeId ?? null,
  availableQuantity: record.availableQuantity ?? record.stock ?? 0,
  reservedQuantity: record.reservedQuantity ?? record.reserved ?? 0,
  reorderLevel: record.reorderLevel ?? record.lowStockAt ?? 0,
  status: record.status || 'ACTIVE',
});

const AdminWorkspace = () => {
  const navigate = useNavigate(); const location = useLocation(); const { user, setUser, logout, catalogCategories, catalogProducts, catalogStoreProducts, catalogLoading, catalogError, catalogStores: backendStores, updateCatalogStore, removeCatalogStore } = useContext(AppContext);
  // Role-specific form descriptors are refreshed for the currently authenticated portal.
  schemas.banners=user?.role==='location-admin'?[...baseBannerSchema,['targetStore','Specific store (optional)','lookup']]:baseBannerSchema;
  // Location Admin store targeting is constrained to the assigned location by the API.
  schemas.coupons=user?.role==='location-admin'
    ? [...fullCouponSchema.filter(([key])=>!['scope','location','store'].includes(key)),['targetStore','Target store (optional)','lookup']]
    : user?.role==='store-manager'
      ? fullCouponSchema.filter(([key])=>!['scope','location','store'].includes(key))
    : fullCouponSchema;
  schemas.delivery=user?.role==='store-manager'?storeManagerDeliverySchema:baseDeliverySchema;
  const pathModule = location.pathname.split('/')[2] || 'dashboard';
  const active = modules.includes(pathModule) ? pathModule : 'dashboard';
  const visibleModules = modules.filter((name) => canAccessModule(user?.role,name));
  const canViewCustomerMetrics = canAccessModule(user?.role, 'customers');
  const [records,setRecords] = useState([]); const [query,setQuery] = useState(''); const [statusFilter,setStatusFilter] = useState('All'); const [sort,setSort] = useState('newest'); const [page,setPage] = useState(1);
  const [dialog,setDialog] = useState(null); const [form,setForm] = useState({}); const [errors,setErrors] = useState({}); const [message,setMessage] = useState(''); const [saving,setSaving] = useState(false); const [stockBusy,setStockBusy] = useState(''); const [confirm,setConfirm] = useState(null); const [passwordResetValue,setPasswordResetValue]=useState('');
  const [collapsed,setCollapsed] = useState(false); const [loading,setLoading] = useState(true); const [profileOpen,setProfileOpen] = useState(false); const [profileDialog,setProfileDialog] = useState(false); const [profileForm,setProfileForm] = useState({}); const [profileErrors,setProfileErrors] = useState({});
  const [assignment,setAssignmentState]=useState(null); const [partnerId,setPartnerId]=useState('');
  const [workflowBusy,setWorkflowBusy]=useState('');
  const [inventoryRecords,setInventoryRecords] = useState([]);
  const [customerLoadError,setCustomerLoadError] = useState('');
  const [reportOrdersError,setReportOrdersError] = useState('');
  const [dashboardOrdersError,setDashboardOrdersError] = useState('');
  const [dashboardMetricsLoaded,setDashboardMetricsLoaded] = useState(false);
  const [dashboardCustomerTotal,setDashboardCustomerTotal] = useState(null);
  const [dashboardCustomerError,setDashboardCustomerError] = useState('');
  const [dashboardInventoryError,setDashboardInventoryError] = useState('');
  const [auditTotalPages,setAuditTotalPages] = useState(0);
  const [orphanInventoryProductCount,setOrphanInventoryProductCount] = useState(0);
  const [productMappings,setProductMappings] = useState([]);
  const [productMappingStoreIds,setProductMappingStoreIds] = useState([]);
  const [productMappingEdits,setProductMappingEdits] = useState({});
  const [productMappingsLoading,setProductMappingsLoading] = useState(false);
  const [productMappingsError,setProductMappingsError] = useState('');
  const [mappingProductId,setMappingProductId] = useState('');
  const [inventoryStoreLinks,setInventoryStoreLinks] = useState([]);
  const [inventoryStoresLoading,setInventoryStoresLoading] = useState(false);
  const [storeManagerInventoryProducts,setStoreManagerInventoryProducts] = useState([]);
  const [storeLocationSearch,setStoreLocationSearch] = useState('');
  const [storeLocationBusy,setStoreLocationBusy] = useState(false);
  const pageSize=6;
  const storageName=active === 'audit-logs' ? 'audit logs' : active;
  const knownStores = useCallback(() => {
    const stores = new Map(collectionStore.list('stores').map((store) => [store.id, store]));
    backendStores.forEach((store) => stores.set(store.id, store));
    return [...stores.values()];
  }, [backendStores]);
  const inventoryStoreId = () => user?.role === 'store-manager' ? knownStores().find((store) => store.name === user.store)?.id || null : null;
  const managerStoreId = () => user?.storeId || knownStores().find((store) => store.name === user?.store || store.id === user?.store)?.id || null;
  const loadInventoryRecords = async ({ allPages = false } = {}) => {
    setInventoryRecords([]);
    const stores = knownStores();
    const ownedProducts = user?.role==='store-manager'
      ? adaptProductList(await getStoreManagerProducts({size:200,sort:'name,asc'})).map((product)=>({...product,storeId:managerStoreId(),store:user.store,storeName:user.store}))
      : [];
    if(user?.role==='store-manager')setStoreManagerInventoryProducts(ownedProducts);
    const inventoryProducts=[...catalogProducts,...storeManagerInventoryProducts,...ownedProducts];
    const uniqueProducts=[...new Map(inventoryProducts.map((product)=>[String(product.id||product.productId),product])).values()];
    const params = { ...(inventoryStoreId() ? { storeId: inventoryStoreId() } : {}), status: allPages ? undefined : 'ACTIVE', size: 50 };
    const payload = allPages ? await getAllInventories(params) : await getInventories(params);
    const records = scopeRecords(adaptInventoryList(payload, { stores, products: uniqueProducts }), user, stores, uniqueProducts);
    setInventoryRecords(records);
    return records;
  };
  const load = async () => {
    if (user && !canAccessModule(user.role, active)) {
      setRecords([]);
      setMessage('You do not have access to this section.');
      setLoading(false);
      return;
    }
    if(active==='reviews') { setRecords([]); setMessage(''); setLoading(false); return; }
    if(active==='customers'){
      setRecords([]);
      setCustomerLoadError('');
      setMessage('');
      setLoading(true);
      try {
        const customers = await getAllCustomers();
        setRecords(customers.map((customer)=>({id:customer.id,name:customer.name,username:customer.username,phone:customer.phone,email:customer.email,createdAt:customer.createdAt})));
      } catch(error) {
        setCustomerLoadError(error.message || 'Unable to load customers.');
        throw error;
      } finally { setLoading(false); }
      return;
    }
    if(active==='audit-logs'){
      setRecords([]); setMessage(''); setLoading(true);
      try {
        const result=await getAuditLogs({page:page-1,size:pageSize,actor:query,action:statusFilter==='All'?'':statusFilter,sortBy:sort==='name'?'actor':'createdAt',direction:sort==='oldest'?'asc':'desc'});
        if(!Array.isArray(result?.content)||!Number.isInteger(Number(result.totalPages))) throw new Error('Audit service returned an invalid paginated response.');
        setRecords(result.content); setAuditTotalPages(Number(result.totalPages));
      } finally { setLoading(false); }
      return;
    }
    if(active==='users'){
      setRecords([]);
      const response=await orgAccessService.listUsers();
      const staffList=Array.isArray(response)?response:response?.content||response?.items||response?.data||[];
      const users=staffList.map((staff)=>{
        const backendId=staff.id??staff.userId??staff.backendUserId??staff.orgAccessUserId;
        return {...staff,id:backendId,orgAccessUserId:backendId,role:String(staff.role||'').toLowerCase().replace(/_/g,'-'),name:staff.name||'',mobile:staff.mobile||'',status:staff.status||'Active'};
      }).filter((staff)=>/^\d+$/.test(String(staff.orgAccessUserId||'')));
      setRecords(scopeRecords(users,user,knownStores(),collectionStore.list('products')));
      if(users.length<staffList.length)setMessage('Some staff records were hidden because Org Access did not provide a valid backend account ID. Refresh the list or check the Org Access response.');
      return;
    }
    if(active==='categories'){setRecords((await getCategories()).map(adminCategory));return;}
    if(active==='banners'){setRecords((await getBanners({all:true}, {auth:true})).map(adminBanner));return;}
    if(active==='coupons'){
      const databaseCoupons=(await getCoupons()).map(adminCoupon);
      if(user?.role==='store-manager'){setRecords(databaseCoupons);return;}
      const databaseCodes=new Set(databaseCoupons.map((coupon)=>String(coupon.name).toUpperCase()));
      const legacyCoupons=collectionStore.list('coupons').filter((coupon)=>!databaseCodes.has(String(coupon.name||coupon.code||'').toUpperCase()));
      setRecords(scopeRecords([...databaseCoupons,...legacyCoupons],user,knownStores(),collectionStore.list('products')));
      return;
    }
    if(active==='products'){
      setOrphanInventoryProductCount(0);
      if(user?.role==='location-admin'){
        const productRows=((await getLocationProducts({size:200})).content || []).map(adminProduct);
        setRecords(productRows);
      }else if(user?.role==='store-manager'){
        const storeId=managerStoreId();
        if(!storeId)throw new Error('No store is assigned to this manager.');
        setRecords(((await getProducts({size:200,storeId},{auth:true})).content || []).map(adminProduct));
      }else {
        const productRows=((await getProducts({size:200,...(user?.role==='global-admin'?{globalProduct:true}:{})},{auth:true})).content || []).map(adminProduct);
        setRecords(productRows);
        if(['super-admin','global-admin'].includes(user?.role)){
          try {
            const inventoryRows=await getAllInventories({size:200,...(user?.role==='global-admin'?{storeId:'global-store'}:{})});
            const productIds=new Set(productRows.map((product)=>String(product.id||product.productId)));
            setOrphanInventoryProductCount(new Set(inventoryRows.map((row)=>String(row.productId||'')).filter((id)=>id&&!productIds.has(id))).size);
          } catch { setOrphanInventoryProductCount(0); }
        }
      }
      return;
    }
    if(active==='inventory'){setRecords([]);setMessage('');setRecords(await loadInventoryRecords({allPages:true}));return;}
    if(active==='delivery'&&user?.role==='store-manager'){const storeId=managerStoreId();if(!storeId){setRecords([]);setMessage('No store is assigned to this manager.');return;}const zones=await getStoreDeliveryZones(storeId,{auth:true});setRecords((zones||[]).map((zone)=>({...zone,name:`${zone.minRadiusKm}-${zone.maxRadiusKm} KM`,methods:(zone.methods||[]).filter((method)=>method.enabled).map((method)=>method.deliveryType),status:zone.status||'Active'})));return;}
    if(active==='delivery'){setRecords([]);return;}
    if(active==='stores'){
      const response=await getStores({},user?.role==='store-manager'?{auth:true}:{});
      const stores=(Array.isArray(response)?response:response?.content||response?.items||[]).filter((store)=>!String(store.id||'').startsWith('location-')).map((store)=>({...store,status:store.status|| (store.active?'Active':'Inactive'),delivery:store.deliveryEnabled?'Yes':'No',pickup:store.pickupEnabled?'Yes':'No',admin:store.adminName||store.admin}));
      setRecords(scopeRecords(stores,user,stores,collectionStore.list('products')));
      return;
    }
    if(active==='locations'){setRecords(adaptLocationList(await getLocations({}, {auth:true})));return;}
    if(active==='dashboard'){
      setRecords([]); setDashboardOrdersError(''); setDashboardMetricsLoaded(false); setDashboardCustomerTotal(null); setDashboardCustomerError(''); setDashboardInventoryError('');
      const stores=knownStores();
      const results=await Promise.allSettled([
        user?.role==='store-manager'
          ? loadStoreManagerReportOrders(getOrders,managerStoreId(),(order)=>adminOrder(normalizeOrder(order),stores))
          : loadReportOrders(getOrders,(order)=>adminOrder(normalizeOrder(order),stores)),
        loadInventoryRecords({allPages:true}),
        canViewCustomerMetrics ? getCustomerTotal() : Promise.resolve(null),
      ]);
      if(results[0].status==='fulfilled') setRecords(scopeRecords(results[0].value,user,stores,collectionStore.list('products')));
      else {
        const error=results[0].reason;
        setDashboardOrdersError(error?.status===403
          ? 'Your session is active, but this account is not authorized to load location order data. Ask an administrator to verify the Order Service location permissions.'
          : error?.status===401
            ? 'Your session has expired. Sign in again to load order data.'
            : error?.message||'Unable to load dashboard orders.');
      }
      if(results[1].status==='rejected') {setDashboardInventoryError(results[1].reason?.message||'Incomplete inventory response.');setMessage(`Inventory metric unavailable: ${results[1].reason?.message||'incomplete inventory response'}`);}
      if(canViewCustomerMetrics) {
        if(results[2].status==='fulfilled') setDashboardCustomerTotal(results[2].value);
        else setDashboardCustomerError(results[2].reason?.message||'Unable to load customer total.');
      }
      setDashboardMetricsLoaded(true);
      return;
    }
    if(active==='reports'){
      setDashboardInventoryError('');
      try { await loadInventoryRecords({allPages:true}); }
      catch(error) { setDashboardInventoryError(error.message||'Inventory data is incomplete.'); }
    }
    if(active==='reports'){
      setRecords([]);
      setReportOrdersError('');
      setDashboardCustomerTotal(null);
      setDashboardCustomerError('');
      setMessage('');
      setLoading(true);
      try {
        const stores = knownStores();
        const [ordersResult, customerResult] = await Promise.allSettled([
          user?.role==='store-manager'
            ? loadStoreManagerReportOrders(getOrders, managerStoreId(), (order)=>adminOrder(normalizeOrder(order), stores))
            : loadReportOrders(getOrders, (order)=>adminOrder(normalizeOrder(order), stores)),
          canViewCustomerMetrics ? getCustomerTotal() : Promise.resolve(null),
        ]);
        if (ordersResult.status === 'rejected') throw ordersResult.reason;
        setRecords(scopeRecords(ordersResult.value,user,stores,collectionStore.list('products')));
        if (canViewCustomerMetrics) {
          if (customerResult.status === 'fulfilled') setDashboardCustomerTotal(customerResult.value);
          else setDashboardCustomerError(customerResult.reason?.message || 'Unable to load customer total.');
        }
      } catch(error) {
        setReportOrdersError(error.message || 'Unable to load report orders.');
        throw error;
      } finally { setLoading(false); }
      return;
    }
    let source = active === 'orders' ? orderStore.list() : active === 'notifications' ? notificationStore.list() : collectionStore.list(storageName);
    if(active==='orders'){
      const stores = knownStores();
      const storeId = managerStoreId();
      const storeName = stores.find((store)=>sameText(store.id, storeId) || sameText(store.name, user?.store))?.name || user?.store || '';
      if(user?.role==='store-manager'&&!storeId)throw new Error('No store is assigned to this manager.');
      try {
        const backendOrders = (await getOrders(user?.role==='store-manager'&&storeId?{storeId}:{})).map((order)=>adminOrder(normalizeOrder(order), stores));
        source = backendOrders;
      } catch (error) {
        setMessage(error.message);
      }
      if (user?.role === 'store-manager') {
        setRecords(source.filter((order)=>orderBelongsToStore(order, storeId, storeName)));
        return;
      }
    }
    setRecords(scopeRecords(source,user,knownStores(),collectionStore.list('products')));
  };
  const locationProductDependency=user?.role==='location-admin'&&active==='products'?catalogStoreProducts:null;
  const locationProductLoading=user?.role==='location-admin'&&active==='products'&&catalogLoading;
  useEffect(() => { if(location.pathname.includes('/orders/delivery/')) return undefined; const start=setTimeout(()=>setLoading(true),0); const timer=setTimeout(() => { load().catch((error)=>setMessage(error.message)).finally(()=>setLoading(false)); setQuery(''); setStatusFilter('All'); setPage(1); setMessage(''); },220); return()=>{clearTimeout(start);clearTimeout(timer);}; },[active,location.pathname,locationProductDependency,locationProductLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if(active!=='audit-logs') return; load().catch((error)=>setMessage(error.message)); },[active,page,query,statusFilter,sort]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if(active==='stores') return undefined;
    return subscribeToLocalData(({key}) => {
    const expected = active === 'orders' ? 'orders' : active === 'notifications' ? 'notifications' : `local:${storageName}`;
    if (!location.pathname.includes('/orders/delivery/') && (!key || key === expected || (active === 'orders' && key === 'local:orders'))) load().catch(error=>setMessage(error.message));
    });
  }, [active,location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (active !== 'orders' || location.pathname.includes('/orders/delivery/')) return undefined;
    let refreshing=false;
    const refresh = async () => {if(refreshing || document.hidden)return;refreshing=true;try{await load();}catch(error){setMessage(error.message);}finally{refreshing=false;}};
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [active, location.pathname, user?.id, user?.storeId, user?.store]); // eslint-disable-line react-hooks/exhaustive-deps
  const statuses=useMemo(()=>['All',...new Set(records.map((r)=>active==='audit-logs'?r.action:r.status).filter(Boolean))],[active,records]);
  const filtered=useMemo(()=>active==='audit-logs'?records:active==='inventory'
    ? filterInventoryRecords(records,{query,status:statusFilter,sort})
    : records.filter((r)=>JSON.stringify(r).toLowerCase().includes(query.toLowerCase())).filter((r)=>statusFilter==='All'||r.status===statusFilter).sort((a,b)=>sort==='name'?String(a.name||a.id).localeCompare(String(b.name||b.id)):sort==='oldest'?String(a.createdAt).localeCompare(String(b.createdAt)):String(b.createdAt).localeCompare(String(a.createdAt))),[active,records,query,statusFilter,sort]);
  const pages=active==='audit-logs'?Math.max(1,auditTotalPages):Math.max(1,Math.ceil(filtered.length/pageSize)); const shown=active==='audit-logs'?records:active==='inventory'?paginateInventoryRecords(filtered,page,pageSize):filtered.slice((page-1)*pageSize,page*pageSize);
  const open=async(mode,record={})=>{const defaults=mode==='create'?{location:active==='users'?'':user?.location||'',store:active==='users'?'':user?.store||'',...(active==='delivery'&&user?.role==='store-manager'?{minRadiusKm:0,maxRadiusKm:10,estimatedDeliveryMin:20,estimatedDeliveryMax:30,deliveryCharge:35,freeDeliveryAbove:499,minimumOrder:0,methods:['Standard Delivery','Store Pickup'],status:'Active'}:{})}:{};setErrors({});setMessage('');setProductMappingsError('');setProductMappings([]);setProductMappingStoreIds([]);setProductMappingEdits({});try{if(active==='orders'&&mode==='view'&&UUID_PATTERN.test(record.id)){const local=orderStore.list().find((order)=>sameText(order.id,record.id)||sameText(order.backendOrderId,record.id));if(local&&user?.role!=='store-manager'){setDialog(mode);setForm(local);return;}const latest=await fetchBackendOrder(record.id,knownStores());setDialog(mode);setForm(latest);return;}if(active==='inventory'&&mode!=='create'&&record.id){const latest=await getInventory(record.id);const products=[...catalogProducts,...storeManagerInventoryProducts];const adapted=adaptInventory(latest,{stores:knownStores(),products});setDialog(mode);setForm(inventoryFormRecord(adapted));return;}const canEditProductMappings=active==='products'&&mode!=='view'&&(['super-admin','global-admin'].includes(user?.role)||(user?.role==='location-admin'&&(!record.id||sameText(record.ownerLocation,user.location))));if(canEditProductMappings){setProductMappingsLoading(true);if(record.id){const links=await getStoreProducts(null,{productId:record.id});if(!Array.isArray(links))throw new Error('Catalog returned an invalid product mapping response.');const scopedLinks=user?.role==='global-admin'?links.filter((link)=>String(link.storeId)==='global-store'):links;setProductMappings(scopedLinks);setProductMappingStoreIds(scopedLinks.map((link)=>String(link.storeId)));setProductMappingEdits(Object.fromEntries(scopedLinks.map((link)=>[String(link.storeId),{available:link.available!==false,priceOverride:link.priceOverride??''}])));}else{setProductMappings([]);setProductMappingStoreIds([]);setProductMappingEdits({});}}setDialog(mode);const couponRecord=active==='coupons'&&user?.role==='location-admin'?{...record,targetStore:knownStores().find((store)=>String(store.id)===String(record.store)||sameText(store.name,record.store))?.name||''}:record;const locationProductRecord=active==='products'&&user?.role==='location-admin'?{...record,image:(record.images||[]).find((image)=>image.primaryImage)?.url||record.images?.[0]?.url||''}:record;setForm(active==='notifications'&&record.title?{...defaults,...record,name:record.title}:active==='inventory'?inventoryFormRecord({...defaults,...record}):{...defaults,...(active==='products'&&user?.role==='location-admin'?locationProductRecord:couponRecord),...(active==='products'&&user?.role==='location-admin'&&mode==='create'?{status:'Active'}:{})});}catch(error){setProductMappingsError(error.message);setMessage(error.message);}finally{setProductMappingsLoading(false);}};
  const openProductMappings=async(record)=>{
    setProductMappingsLoading(true);setProductMappingsError('');setProductMappings([]);setProductMappingStoreIds([]);setProductMappingEdits({});
    try{
      const assignedIds=new Set(user?.role==='global-admin'?['global-store']:knownStores().filter((store)=>sameText(store.location,user?.location)).map((store)=>String(store.id)));
      const response=await getStoreProducts(null,{productId:record.id});
      if(!Array.isArray(response))throw new Error('Catalog returned an invalid product mapping response.');
      const mappings=response.filter((mapping)=>assignedIds.has(String(mapping.storeId)));
      setProductMappings(mappings);
      setProductMappingStoreIds(mappings.map((mapping)=>String(mapping.storeId)));
      setProductMappingEdits(Object.fromEntries(mappings.map((mapping)=>[String(mapping.storeId),{available:mapping.available!==false,priceOverride:mapping.priceOverride??''}])));
      setForm(record);setDialog('mapping');
    }catch(error){setProductMappingsError(error.message||'Unable to load store mappings.');setMessage(error.message||'Unable to load store mappings.');}
    finally{setProductMappingsLoading(false);}
  };
  const saveProductMappings=async()=>{
    const assignedIds=new Set(user?.role==='global-admin'?['global-store']:knownStores().filter((store)=>sameText(store.location,user?.location)).map((store)=>String(store.id)));
    const selected=new Set([...productMappingStoreIds.map(String),...(user?.role==='global-admin'?['global-store']:[])]);
    if([...selected].some((storeId)=>!assignedIds.has(storeId))){setProductMappingsError('A selected store is outside your assigned location.');return;}
    const existingByStore=new Map(productMappings.map((mapping)=>[String(mapping.storeId),mapping]));
    setSaving(true);setProductMappingsError('');
    try{
      for(const mapping of productMappings){
        const storeId=String(mapping.storeId);
        if(!selected.has(storeId)){await deleteStoreProduct(mapping.id);continue;}
        const edit=productMappingEdits[storeId]||{};
        const priceOverride=edit.priceOverride===''||edit.priceOverride==null?null:Number(edit.priceOverride);
        if((mapping.available!==false)!==(edit.available!==false)||Number(mapping.priceOverride??-1)!==Number(priceOverride??-1))
          await updateStoreProduct(mapping.id,{storeId:mapping.storeId,storeName:mapping.storeName||'',productId:form.id,available:edit.available!==false,priceOverride});
      }
      for(const storeId of selected){
        if(existingByStore.has(storeId))continue;
        const store=knownStores().find((item)=>String(item.id)===storeId);
        await createStoreProduct({storeId,storeName:storeId==='global-store'?'Global Store':store?.name||'',productId:form.id,available:true,priceOverride:null});
      }
      setDialog(null);setMessage(user?.role==='global-admin'?'Global Store product mapping saved.':'Store mappings saved for your assigned location.');
      await load();
    }catch(error){setProductMappingsError(error.message||'Unable to save store mappings.');}
    finally{setSaving(false);}
  };
  const continueProductMapping=()=>{
    const product=catalogProducts.find((item)=>String(item.id)===String(mappingProductId));
    if(!product){setProductMappingsError('Select a Catalog product first.');return;}
    openProductMappings(adminProduct(product));
  };
  useEffect(()=>{
    if(active!=='inventory'||user?.role!=='store-manager'){setStoreManagerInventoryProducts([]);return undefined;}
    let cancelled=false;
    getStoreManagerProducts({size:200,sort:'name,asc'}).then((payload)=>{
      if(cancelled)return;
      const storeId=managerStoreId();
      const storeName=knownStores().find((store)=>String(store.id)===String(storeId))?.name||user.store||'';
      setStoreManagerInventoryProducts(adaptProductList(payload).map((product)=>({...product,storeId,store:storeName,storeName})));
    }).catch((error)=>{if(!cancelled)setMessage(error.message||'Store products could not be loaded for inventory.');});
    return()=>{cancelled=true;};
  },[active,user?.role,user?.store,user?.storeId,backendStores]);
  const inventoryProductOptions=useMemo(()=>{
    const source=user?.role==='store-manager'?[...catalogProducts,...storeManagerInventoryProducts]:catalogProducts;
    const unique=new Map(source.map((product)=>[String(product.id||product.productId),product]));
    return scopeRecords([...unique.values()],user,knownStores(),catalogProducts);
  },[catalogProducts,storeManagerInventoryProducts,user,knownStores]);
  const selectedInventoryProduct=inventoryProductOptions.find((item)=>item.id===form.productId||item.productId===form.productId)||null;
  const selectedInventoryVariants=useMemo(()=>selectedInventoryProduct?.variants || [],[selectedInventoryProduct]);
  const inventoryStoreOptions=useMemo(()=>{const stores=knownStores();const namesById=new Map(inventoryStoreLinks.filter((item)=>item.storeId).map((item)=>[item.storeId,item.storeName]));const ids=[...new Set([...inventoryStoreLinks.map((item)=>item.storeId),...inventoryRecords.filter((item)=>item.productId===form.productId).map((item)=>item.storeId),form.storeId].filter(Boolean))];return ids.map((id)=>stores.find((store)=>store.id===id)||{id,name:namesById.get(id)||'Store '+id,location:''});},[inventoryStoreLinks,inventoryRecords,form.productId,form.storeId,knownStores]);
  const chooseInventoryProduct=(product)=>{const variants=product?.variants || [];const firstVariant=variants.find((item)=>item.active!==false) || variants[0];setInventoryStoreLinks([]);setForm((current)=>({...current,productId:product?.productId || product?.id || '',variantId:firstVariant?.variantId || firstVariant?.id || '',storeId:''}));};
  useEffect(()=>{if(active!=='inventory'||!dialog||!form.productId)return;let cancelled=false;Promise.resolve().then(()=>{if(!cancelled)setInventoryStoresLoading(true);return getStoreProducts(null,{productId:form.productId});}).then((storePayload)=>{if(cancelled)return;const links=adaptStoreProductList(storePayload).filter((item)=>item.available!==false&&item.status!=='INACTIVE');const optionIds=[...new Set(links.map((item)=>item.storeId).filter(Boolean))];const managerStoreId=inventoryStoreId();setInventoryStoreLinks(links);setForm((current)=>{if(managerStoreId&&optionIds.includes(managerStoreId))return {...current,storeId:managerStoreId};if(current.storeId&&optionIds.includes(current.storeId))return current;if(optionIds.length===1)return {...current,storeId:optionIds[0]};return {...current,storeId:''};});}).catch((error)=>{if(!cancelled){setInventoryStoreLinks([]);setMessage(error.message);}}).finally(()=>{if(!cancelled)setInventoryStoresLoading(false);});return()=>{cancelled=true;};},[active,dialog,form.productId,user,catalogProducts]); // eslint-disable-line react-hooks/exhaustive-deps
  const toStorePayload=(data)=>({id:data.id || storeIdFromName(data.name),name:String(data.name||data.storeName||'').trim(),storeCode:data.storeCode || null,logoUrl:data.logoUrl || data.image || null,description:data.description || null,location:String(data.location||data.storeLocation||data.city||'').trim(),address:String(data.address||data.storeAddress||[data.doorNumber,data.streetName,data.area,data.city,data.state,data.pincode].filter(Boolean).join(', ')||'').trim(),doorNumber:data.doorNumber || null,streetName:data.streetName || null,area:data.area || null,landmark:data.landmark || null,city:data.city || null,district:data.district || null,state:data.state || null,pincode:data.pincode || null,latitude:data.latitude===''||data.latitude==null?null:Number(data.latitude),longitude:data.longitude===''||data.longitude==null?null:Number(data.longitude),provider:data.provider || 'OPENSTREETMAP',providerPlaceId:data.providerPlaceId || null,providerOsmType:data.providerOsmType || null,providerOsmId:data.providerOsmId || null,locationAccuracyMeters:data.locationAccuracyMeters || null,phone:data.phone || data.mobile || null,alternatePhone:data.alternatePhone || null,email:data.email || null,adminName:data.adminName || data.admin || data.name || null,storeRating:data.storeRating===''||data.storeRating==null?null:Number(data.storeRating),gstNumber:data.gstNumber || null,status:data.status || 'Active',deliveryEnabled:data.delivery !== 'No',pickupEnabled:data.pickup !== 'No',deliveryRadiusKm:data.deliveryRadiusKm===''||data.deliveryRadiusKm==null?null:Number(data.deliveryRadiusKm),deliveryEtaMinutes:data.deliveryEtaMinutes===''||data.deliveryEtaMinutes==null?null:Number(data.deliveryEtaMinutes),deliveryCharge:data.deliveryCharge===''||data.deliveryCharge==null?null:Number(data.deliveryCharge),freeDeliveryAbove:data.freeDeliveryAbove===''||data.freeDeliveryAbove==null?null:Number(data.freeDeliveryAbove),deliveryModes:String(data.deliveryModes||DELIVERY_MODE_OPTIONS.slice(0,3).join(',')).trim(),deliveryNotes:data.deliveryNotes || null,active:data.status !== 'Inactive'});
  const saveStoreRecord=async(data,forceCreate=false)=>{const payload=toStorePayload(data);const saved=forceCreate||!data.id?await createStore(payload):await updateStore(payload.id,payload);const local={...data,...saved,status:saved.status||data.status||(saved.active?'Active':'Inactive'),delivery:saved.deliveryEnabled?'Yes':'No',pickup:saved.pickupEnabled?'Yes':'No',admin:saved.adminName||data.admin};updateCatalogStore(local);return local;};
  const toLocationPayload=(data)=>({
    ...toStorePayload({
      ...data,
      id:data.id||`location-${slugify(data.code||data.name)}`,
      name:String(data.name||'').trim(),
      storeCode:String(data.code||'').trim(),
      location:String(data.name||'').trim(),
      address:String(data.address||'').trim(),
      adminName:data.admin||null,
      status:data.status||'Active',
      delivery:'No',pickup:'No',deliveryRadiusKm:'',deliveryEtaMinutes:'',
      deliveryCharge:'',freeDeliveryAbove:'',deliveryModes:'',deliveryNotes:'',
    }),
    active:data.status!=='Inactive',
    deliveryEnabled:false,
    pickupEnabled:false,
    deliveryRadiusKm:null,
    deliveryEtaMinutes:null,
    deliveryCharge:null,
    freeDeliveryAbove:null,
    deliveryModes:null,
    deliveryNotes:null,
  });
  const currentManagerStore=()=>knownStores().find((store)=>store.id===managerStoreId()||store.name===user?.store)||{};
  const openProfileDialog=()=>{const store=currentManagerStore();setProfileErrors({});setProfileForm({name:user?.name||'',email:user?.email||'',mobile:user?.mobile||user?.phone||'',location:user?.location||store.location||'',store:store.name||user?.store||'',storeId:store.id||user?.storeId||'',storePhone:store.phone||'',storeEmail:store.email||'',storeAddress:store.address||'',delivery:user?.role==='store-manager'?(store.delivery||'Yes'):'',pickup:user?.role==='store-manager'?(store.pickup||'Yes'):'',deliveryRadiusKm:store.deliveryRadiusKm??'',deliveryEtaMinutes:store.deliveryEtaMinutes??'',deliveryCharge:store.deliveryCharge??'',freeDeliveryAbove:store.freeDeliveryAbove??'',deliveryModes:store.deliveryModes||DELIVERY_MODE_OPTIONS.slice(0,3).join(','),deliveryNotes:store.deliveryNotes||'',currentPassword:'',newPassword:'',confirmPassword:''});setProfileOpen(false);setProfileDialog(true);};
  const saveProfile=async()=>{
    if(user?.role==='super-admin'||user?.role==='global-admin'){
      const name=String(profileForm.name||'').trim();
      if(!name){setProfileErrors({name:'Name is required.'});return;}
      setProfileErrors({});
      setSaving(true);
      try{
        await orgAccessService.updateMyName(name);
        const refreshed=await orgAccessService.me();
        setUser({...user,...refreshed});
        setProfileDialog(false);
        setMessage('Profile settings saved.');
      }catch(error){setProfileErrors({form:error.message});}
      finally{setSaving(false);}
      return;
    }
    const next={};if(!String(profileForm.name||'').trim())next.name='Name is required.';if(profileForm.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email))next.email='Enter a valid email address.';Object.assign(next,validateStaffPasswordChange(profileForm));if(user?.role==='store-manager'){if(!String(profileForm.store||'').trim())next.store='Store name is required.';if(Number(profileForm.deliveryRadiusKm)<0)next.deliveryRadiusKm='Radius cannot be negative.';if(Number(profileForm.deliveryEtaMinutes)<0)next.deliveryEtaMinutes='ETA cannot be negative.';}setProfileErrors(next);if(Object.keys(next).length)return;setSaving(true);try{const store=currentManagerStore();let savedStore=store;if(user?.role==='store-manager'&&store.id){savedStore=await saveStoreRecord({...store,name:profileForm.store,phone:profileForm.storePhone,email:profileForm.storeEmail,address:profileForm.storeAddress,delivery:profileForm.delivery,pickup:profileForm.pickup,deliveryRadiusKm:profileForm.deliveryRadiusKm,deliveryEtaMinutes:profileForm.deliveryEtaMinutes,deliveryCharge:profileForm.deliveryCharge,freeDeliveryAbove:profileForm.freeDeliveryAbove,deliveryModes:profileForm.deliveryModes,deliveryNotes:profileForm.deliveryNotes,status:store.status||'Active'});}const updated=await staffProfileStore.update({name:profileForm.name,email:profileForm.email,mobile:profileForm.mobile,phone:profileForm.mobile,location:profileForm.location,store:user?.role==='store-manager'?(savedStore.name||profileForm.store):user?.store,storeId:savedStore.id||user?.storeId,currentPassword:profileForm.currentPassword,newPassword:profileForm.newPassword,confirmPassword:profileForm.confirmPassword,storePatch:user?.role==='store-manager'&&savedStore.id?savedStore:null});setUser(updated);setProfileDialog(false);setMessage('Profile settings saved.');await load();}catch(error){setProfileErrors({form:error.message});}finally{setSaving(false);}};
  const toDeliveryZonePayload=(data)=>({minRadiusKm:Number(data.minRadiusKm||0),maxRadiusKm:Number(data.maxRadiusKm||0),estimatedDeliveryMin:data.estimatedDeliveryMin===''||data.estimatedDeliveryMin==null?null:Number(data.estimatedDeliveryMin),estimatedDeliveryMax:data.estimatedDeliveryMax===''||data.estimatedDeliveryMax==null?null:Number(data.estimatedDeliveryMax),deliveryCharge:Number(data.deliveryCharge||0),freeDeliveryAbove:data.freeDeliveryAbove===''||data.freeDeliveryAbove==null?null:Number(data.freeDeliveryAbove),minimumOrder:data.minimumOrder===''||data.minimumOrder==null?null:Number(data.minimumOrder),status:data.status||'Active',methods:(Array.isArray(data.methods)?data.methods:[]).map((method)=>({deliveryType:method,enabled:true,deliveryCharge:Number(data.deliveryCharge||0),estimatedTime:[data.estimatedDeliveryMin,data.estimatedDeliveryMax].filter(Boolean).join('-')+(data.estimatedDeliveryMin||data.estimatedDeliveryMax?' min':''),settingsConfiguration:'{}'}))});
  const applyStoreLocation=(place={})=>setForm((current)=>({...current,location:place.city || place.title || current.location || '',storeLocation:place.city || place.title || current.storeLocation || '',address:place.address || place.subtitle || current.address || '',storeAddress:place.address || place.subtitle || current.storeAddress || '',latitude:place.lat ?? current.latitude ?? '',longitude:place.lng ?? current.longitude ?? '',provider:place.provider || current.provider || 'OPENSTREETMAP',providerPlaceId:place.providerPlaceId ?? current.providerPlaceId ?? '',providerOsmType:place.providerOsmType ?? current.providerOsmType ?? '',providerOsmId:place.providerOsmId ?? current.providerOsmId ?? '',locationAccuracyMeters:place.locationAccuracyMeters ?? current.locationAccuracyMeters ?? ''}));
  const searchStoreLocation=async()=>{if(!storeLocationSearch.trim())return setErrors({...errors,storeLocation:'Enter a location to search.'});setStoreLocationBusy(true);try{const place=await geocodeOpenStreetMap(storeLocationSearch);if(!place)throw new Error('No matching location found.');applyStoreLocation(place);setErrors((current)=>({...current,storeLocation:''}));}catch(error){setErrors((current)=>({...current,storeLocation:error.message}));}finally{setStoreLocationBusy(false);}};
  const useCurrentStoreLocation=()=>{if(!navigator.geolocation)return setErrors({...errors,storeLocation:'Browser location is not available.'});setStoreLocationBusy(true);navigator.geolocation.getCurrentPosition(({coords})=>{applyStoreLocation({title:'Selected map point',subtitle:`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,address:`${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`,lat:coords.latitude,lng:coords.longitude,provider:'BROWSER_GEOLOCATION',locationAccuracyMeters:coords.accuracy});setStoreLocationBusy(false);},error=>{setErrors((current)=>({...current,storeLocation:error.message}));setStoreLocationBusy(false);},{enableHighAccuracy:true,timeout:10000});};
  const renderStoreLocationPicker=()=>{const lat=Number(form.latitude);const lng=Number(form.longitude);const hasPoint=Number.isFinite(lat)&&Number.isFinite(lng);const radius=Number(form.deliveryRadiusKm||0);const radiusSize=`${Math.max(18,Math.min(92,radius*4))}%`;return <Box sx={{gridColumn:'1 / -1',display:'grid',gap:1.25,p:1.5,border:'1px solid #dce9e3',borderRadius:1,bgcolor:'#f8fafc'}}><Typography fontWeight={700}>Store map location</Typography><Box sx={{display:'flex',gap:1,flexWrap:'wrap'}}><TextField size="small" fullWidth label="Search store location" value={storeLocationSearch} onChange={(e)=>setStoreLocationSearch(e.target.value)} error={Boolean(errors.storeLocation)} helperText={errors.storeLocation || 'Search with area, city, landmark or full address.'}/><Button variant="outlined" disabled={storeLocationBusy} onClick={searchStoreLocation}>{storeLocationBusy?'Searching...':'Search'}</Button><Button variant="outlined" disabled={storeLocationBusy} onClick={useCurrentStoreLocation}>Use current map point</Button>{hasPoint&&<Button variant="text" onClick={()=>window.open(openStreetMapLocationUrl({lat,lng}),'_blank','noopener,noreferrer')}>Open map</Button>}</Box>{hasPoint&&<Box sx={{height:220,border:'1px solid #cbd5e1',borderRadius:1,overflow:'hidden',bgcolor:'#fff',position:'relative'}}><iframe title="Store location map" src={openStreetMapEmbedUrl({lat,lng})} style={{border:0,width:'100%',height:'100%'}} />{radius>0&&<Box component="span" sx={{position:'absolute',left:'50%',top:'50%',width:radiusSize,height:radiusSize,transform:'translate(-50%, -50%)',border:'2px solid #087451',borderRadius:'999px',bgcolor:'rgba(8,116,81,.16)',color:'#064e3b',fontWeight:800,fontSize:12,display:'grid',placeItems:'center',pointerEvents:'none'}}>{radius} km</Box>}</Box>}<Box sx={{display:'grid',gridTemplateColumns:{md:'1fr 1fr'},gap:1}}><TextField label="Latitude" type="number" value={form.latitude||''} onChange={(e)=>setForm({...form,latitude:e.target.value})}/><TextField label="Longitude" type="number" value={form.longitude||''} onChange={(e)=>setForm({...form,longitude:e.target.value})}/></Box></Box>;};
  const renderDeliveryZoneMap=()=>{const store=knownStores().find((item)=>item.id===managerStoreId()||item.name===user?.store);const lat=Number(store?.latitude);const lng=Number(store?.longitude);const hasPoint=Number.isFinite(lat)&&Number.isFinite(lng);const circles=[...records.map((zone)=>Number(zone.maxRadiusKm)),Number(form.maxRadiusKm)].filter((value)=>value>0);const maxCircle=Math.max(...circles,1);return <Box sx={{gridColumn:'1 / -1',display:'grid',gap:1.25,p:1.5,border:'1px solid #dce9e3',borderRadius:1,bgcolor:'#f8fafc'}}><Typography fontWeight={800}>Delivery radius map</Typography>{!hasPoint?<Typography color="text.secondary">Add latitude and longitude in Store Profile to see the radius map.</Typography>:<Box sx={{height:260,border:'1px solid #cbd5e1',borderRadius:1,overflow:'hidden',bgcolor:'#fff',position:'relative'}}><iframe title="Delivery radius map" src={openStreetMapEmbedUrl({lat,lng})} style={{border:0,width:'100%',height:'100%'}} />{circles.map((radius,index)=><Box key={`${radius}-${index}`} component="span" sx={{position:'absolute',left:'50%',top:'50%',width:`${Math.max(18,Math.min(92,(radius/maxCircle)*86))}%`,height:`${Math.max(18,Math.min(92,(radius/maxCircle)*86))}%`,transform:'translate(-50%, -50%)',border:'2px solid #087451',borderRadius:'999px',bgcolor:index===circles.length-1?'rgba(8,116,81,.18)':'rgba(8,116,81,.08)',color:'#064e3b',fontWeight:800,fontSize:12,display:'grid',placeItems:'center',pointerEvents:'none'}}>{radius} km</Box>)}</Box>}</Box>;};
  const renderInventoryField=(key,label,type,required,options)=>{if(dialog==='edit'&&['productId','variantId','storeId'].includes(key))return <TextField fullWidth label={key==='productId'?'Product ID':key==='variantId'?'Variant ID':'Store ID'} value={form[key]||'Not set'} disabled/>;if(key==='productId')return <Autocomplete options={inventoryProductOptions} getOptionLabel={(item)=>`${item.name || item.title || item.id} (${item.productId || item.id})`} value={selectedInventoryProduct} onChange={(_,value)=>chooseInventoryProduct(value)} renderInput={(params)=><TextField {...params} label="Product" required={required} error={Boolean(errors.productId)} helperText={errors.productId || 'Product ID fills from the selected catalog product.'}/>}/>;if(key==='variantId')return <Select fullWidth displayEmpty disabled={!selectedInventoryProduct} value={form.variantId||''} onChange={(e)=>setForm({...form,variantId:e.target.value})}><MenuItem value="">{selectedInventoryProduct?'Product-level stock':'Select product first'}</MenuItem>{selectedInventoryVariants.map((variant)=><MenuItem key={variant.variantId || variant.id} value={variant.variantId || variant.id}>{variant.label || variant.name || variant.sku || variant.id} ({variant.variantId || variant.id})</MenuItem>)}</Select>;if(key==='storeId')return <Box><Select fullWidth displayEmpty disabled={!form.productId||inventoryStoresLoading||inventoryStoreOptions.length===0} value={form.storeId||''} onChange={(e)=>setForm({...form,storeId:e.target.value})} error={Boolean(errors.storeId)}><MenuItem value="" disabled>{inventoryStoresLoading?'Loading stores...':form.productId?'Select mapped store':'Select product first'}</MenuItem>{inventoryStoreOptions.map((store)=><MenuItem key={store.id} value={store.id}>{store.name} ({store.id})</MenuItem>)}</Select>{errors.storeId&&<Typography variant="caption" color="error">{errors.storeId}</Typography>}</Box>;return type==='select'?<Select fullWidth displayEmpty value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}><MenuItem value="" disabled>{label}</MenuItem>{options.map(option=><MenuItem key={option} value={option}>{option}</MenuItem>)}</Select>:<TextField fullWidth label={label} required={required} type={type==='textarea'?'text':type} multiline={type==='textarea'} minRows={type==='textarea'?3:undefined} value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})} error={Boolean(errors[key])} helperText={errors[key]}/>;};
  const validate=()=>{const next={};visibleFormFields.filter(([key])=>!(active==='inventory'&&dialog==='edit'&&['productId','variantId','storeId'].includes(key))).forEach(([key,label,type,required])=>{const optionalStaffEditMobile=active==='users'&&dialog==='edit'&&key==='mobile';if(required&&!optionalStaffEditMobile&&(type==='checks'?!(form[key]||[]).length:!String(form[key]??'').trim()))next[key]=`${label} is required.`;if(type==='url'&&form[key]){try{const parsed=new URL(form[key]);if(!['http:','https:'].includes(parsed.protocol))throw new Error();}catch{next[key]=`${label} must be a valid web URL.`;}}});if(active==='locations'){const lat=String(form.latitude??'').trim();const lng=String(form.longitude??'').trim();if(Boolean(lat)!==Boolean(lng)){next.latitude='Enter both latitude and longitude, or leave both blank.';next.longitude='Enter both latitude and longitude, or leave both blank.';}else if(lat&&lng){if(!Number.isFinite(Number(lat))||Number(lat)<-90||Number(lat)>90)next.latitude='Latitude must be between -90 and 90.';if(!Number.isFinite(Number(lng))||Number(lng)<-180||Number(lng)>180)next.longitude='Longitude must be between -180 and 180.';}}if(active==='delivery'&&user?.role==='store-manager'&&Number(form.maxRadiusKm)<=Number(form.minRadiusKm))next.maxRadiusKm='Maximum distance must be greater than minimum distance.';if(active==='users'&&!MANAGEABLE_ROLES[user?.role]?.includes(form.role))next.role='You cannot create or change this role.';if(active==='users'&&form.role==='location-admin'&&!form.location)next.location='Select the location this admin will manage.';if(active==='users'&&form.role==='store-manager'&&!form.store&&!form.storeName)next.store='Select an existing store or enter a new store name.';if(active==='users'&&form.role==='store-manager'&&form.storeName&&!String(form.location||form.storeLocation||'').trim())next.storeLocation='Search and select the new store location.';if(active==='users'&&form.role==='store-manager'&&form.storeName&&!String(form.address||form.storeAddress||'').trim())next.storeAddress='Enter the new store address.';if(active==='users'&&form.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form.email).trim()))next.email='Enter a valid email address.';if(active==='users'&&form.mobile&&!/^(?:\+?91[\s-]?)?[6-9]\d{9}$/.test(String(form.mobile).trim()))next.mobile='Enter a valid 10-digit Indian mobile number.';if(active==='stores'&&!String(form.address||'').trim())next.address='Enter the store address.';if(active==='stores'&&(!form.latitude||!form.longitude))next.storeLocation='Search and select the store map location.';if(active==='stores'&&Number(form.deliveryRadiusKm)<0)next.deliveryRadiusKm='Radius cannot be negative.';if(active==='stores'&&Number(form.deliveryEtaMinutes)<0)next.deliveryEtaMinutes='ETA cannot be negative.';if(active==='stores'&&form.newPassword&&!form.currentPassword)next.currentPassword='Enter current password to change it.';if(active==='stores'&&form.newPassword&&String(form.newPassword).length<8)next.newPassword='New password must be at least 8 characters.';if(active==='users'&&user?.role==='location-admin'&&form.location!==user.location)next.location='Staff must belong to your assigned location.';if(active==='coupons'&&form.startDate&&form.expiry&&form.expiry<form.startDate)next.expiry='Expiry must be after the start date.';if(active==='coupons'&&Number(form.discount)<=0)next.discount='Discount must be greater than zero.';if(active==='products'&&Number(form.stock)<0)next.stock='Stock cannot be negative.';if(active==='reviews'&&(Number(form.rating)<1||Number(form.rating)>5))next.rating='Rating must be between 1 and 5.';if(active==='inventory'&&dialog!=='edit'){if(!selectedInventoryProduct)next.productId='Select a Catalog product.';if(form.variantId&&!selectedInventoryVariants.some((variant)=>(variant.variantId||variant.id)===form.variantId))next.variantId='Select a variant from the selected product.';if(form.productId&&!inventoryStoresLoading&&!inventoryStoreOptions.length)next.storeId='This product is not mapped to any store.';if(form.storeId&&inventoryStoreOptions.length&&!inventoryStoreOptions.some((store)=>store.id===form.storeId))next.storeId='Select a store mapped to this product.';}setErrors(next);return next;};
  const save=async()=>{if(active==='products'&&dialog==='mapping')return saveProductMappings();const validationErrors=validate();if(Object.keys(validationErrors).length){if(active==='users')setMessage(Object.values(validationErrors)[0]);return;}if(active==='products'&&user?.role==='location-admin'&&['create','edit'].includes(dialog)&&!productMappingStoreIds.length){setMessage('Select at least one store in your assigned location.');return;}setSaving(true);let scopedForm={...form,...(user?.role==='store-manager'&&active!=='stores'?{store:user.store,location:user.location}:{}),...(user?.role==='location-admin'?{location:user.location}:{}),assignedBy:user?.id};try{
    if(active==='categories'){const payload={name:scopedForm.name.trim(),slug:scopedForm.slug || slugify(scopedForm.name),description:scopedForm.description || null,thumbnailUrl:scopedForm.thumbnailUrl || scopedForm.image || null,active:scopedForm.status!=='Inactive'};if(scopedForm.id)await updateCategory(scopedForm.id,payload);else await createCategory(payload);}
    else if(active==='products'){
      const categories=await getCategories();
      const category=categories.find((item)=>item.id===scopedForm.categoryId||item.name===scopedForm.category);
      if(!category)throw new Error('Select an existing Catalog category.');
      const globalCatalogProduct=['global-admin','super-admin'].includes(user?.role);
      const payload={categoryId:category.id,subcategory:scopedForm.subcategory || 'Other',name:scopedForm.name.trim(),slug:scopedForm.slug || slugify(scopedForm.name),sku:scopedForm.sku.trim(),description:scopedForm.description,brand:scopedForm.brand || null,ingredients:scopedForm.ingredients || null,specifications:scopedForm.specifications || null,pack:scopedForm.pack || null,type:scopedForm.type || null,shelfLife:scopedForm.shelfLife || null,tags:scopedForm.tags || null,highlights:scopedForm.highlights || null,aboutSource:scopedForm.aboutSource || null,featured:scopedForm.featured==='Yes',special:scopedForm.special==='Yes',newArrival:scopedForm.newArrival==='Yes',bestSeller:scopedForm.bestSeller==='Yes',globalProduct:globalCatalogProduct,fulfillmentType:globalCatalogProduct?'global':null,deliveryMethod:globalCatalogProduct?'global':null,status:scopedForm.status==='Inactive'?'INACTIVE':scopedForm.status==='Draft'?'DRAFT':'ACTIVE'};
      const locationProductBody={product:payload,storeIds:productMappingStoreIds,available:scopedForm.status!=='Inactive'};const product=user?.role==='location-admin'?(scopedForm.id?await updateLocationProduct(scopedForm.id,locationProductBody):await createLocationProduct(locationProductBody)):(scopedForm.id?await updateProduct(scopedForm.id,payload):await createProduct(payload));
      const desired=variantRows(scopedForm.variants,scopedForm.sku,scopedForm.price);
      const existing=await getProductVariants(product.id);
      const existingById=new Map(existing.map((variant)=>[String(variant.id),variant]));
      const originalVariants=Array.isArray(scopedForm._variantSnapshot)?scopedForm._variantSnapshot:[];
      const matchedVariants=new Array(desired.length).fill(null);
      const usedVariantIds=new Set();
      const findOriginal=(matches)=>{
        for(const original of originalVariants){
          const id=String(original.id||'');
          const current=existingById.get(id);
          if(!id||!current||usedVariantIds.has(id)||!matches(original))continue;
          return current;
        }
        return null;
      };
      // Resolve unchanged rows by their original identity before processing edits or inserts.
      desired.forEach((variant,index)=>{
        const match=findOriginal((original)=>original.sku===variant.sku&&original.name===variant.name)
          ||findOriginal((original)=>original.sku===variant.sku)
          ||findOriginal((original)=>original.name===variant.name);
        if(match){matchedVariants[index]=match;usedVariantIds.add(String(match.id));}
      });
      // Keep the remaining edited rows attached to their prior variant where possible.
      desired.forEach((_,index)=>{
        if(matchedVariants[index])return;
        const originalAtIndex=originalVariants[index];
        const positional=originalAtIndex?existingById.get(String(originalAtIndex.id)):existing[index];
        const match=positional&&!usedVariantIds.has(String(positional.id))
          ? positional
          : (originalVariants.length?originalVariants.map((original)=>existingById.get(String(original.id))):existing).find((candidate)=>candidate&&!usedVariantIds.has(String(candidate.id)));
        if(match){matchedVariants[index]=match;usedVariantIds.add(String(match.id));}
      });
      for(let index=0;index<desired.length;index+=1){
        const existingVariant=matchedVariants[index];
        if(existingVariant)await updateVariant(existingVariant.id,desired[index]);
        else await createVariant(product.id,desired[index]);
      }
      for(const variant of existing){if(!usedVariantIds.has(String(variant.id)))await deleteVariant(variant.id);}
      const images=await getProductImages(product.id);
      if(scopedForm.image){const imagePayload={url:scopedForm.image,altText:scopedForm.name,displayOrder:0,primaryImage:true};if(images[0])await updateImage(images[0].id,imagePayload);else await createImage(product.id,imagePayload);}
      else for(const image of images)await deleteImage(image.id);
      if(['global-admin','super-admin'].includes(user?.role)){
        const selected=new Set([...productMappingStoreIds.map(String),...(user?.role==='global-admin'?['global-store']:[])]);
        const existingByStore=new Map(productMappings.map((mapping)=>[String(mapping.storeId),mapping]));
        try {
          for(const mapping of productMappings){
            const storeId=String(mapping.storeId);
            if(!selected.has(storeId)){await deleteStoreProduct(mapping.id);continue;}
            const edit=productMappingEdits[storeId]||{};
            const priceOverride=edit.priceOverride===''||edit.priceOverride==null?null:Number(edit.priceOverride);
            if((mapping.available!==false)!==(edit.available!==false)||Number(mapping.priceOverride??-1)!==Number(priceOverride??-1))
              await updateStoreProduct(mapping.id,{storeId:mapping.storeId,storeName:mapping.storeName||'',productId:product.id,available:edit.available!==false,priceOverride});
          }
          for(const storeId of selected){if(existingByStore.has(storeId))continue;const store=knownStores().find((item)=>String(item.id)===storeId);await createStoreProduct({storeId,storeName:storeId==='global-store'?'India-wide Global Store':store?.name||'',productId:product.id,available:true,priceOverride:null});}
        } catch(mappingError){throw new Error(`Product details were saved, but store mappings were only partially saved: ${mappingError.message}`,{cause:mappingError});}
      }
      if(user?.role==='store-manager'){const storeId=managerStoreId();if(storeId){try{await createStoreProduct({storeId,storeName:user.store,productId:product.id,available:true,priceOverride:null});}catch(error){if(!String(error.message||'').toLowerCase().includes('exists'))throw error;}}}
    }
    else if(active==='users'){if(scopedForm.role==='store-manager'&&scopedForm.storeName){const storeName=scopedForm.storeName.trim();const storeRecord=await saveStoreRecord({id:storeIdFromName(storeName),name:storeName,location:scopedForm.storeLocation||scopedForm.location,address:scopedForm.storeAddress||scopedForm.address,latitude:scopedForm.latitude,longitude:scopedForm.longitude,provider:scopedForm.provider,providerPlaceId:scopedForm.providerPlaceId,providerOsmType:scopedForm.providerOsmType,providerOsmId:scopedForm.providerOsmId,locationAccuracyMeters:scopedForm.locationAccuracyMeters,phone:scopedForm.mobile,email:scopedForm.email,admin:scopedForm.name,status:'Active',active:true,delivery:'Yes',pickup:'Yes',deliveryRadiusKm:10,deliveryEtaMinutes:20,deliveryCharge:35,freeDeliveryAbove:499,deliveryModes:DELIVERY_MODE_OPTIONS.slice(0,3).join(','),deliveryNotes:'Standard delivery within service radius.'},true);scopedForm={...scopedForm,store:storeName,storeId:storeRecord.id,location:storeRecord.location,address:storeRecord.address,storeLocation:storeRecord.location,storeAddress:storeRecord.address};}else if(scopedForm.role==='store-manager'&&scopedForm.store){const matchedStore=knownStores().find((item)=>item.name===scopedForm.store||item.id===scopedForm.store);if(matchedStore)scopedForm={...scopedForm,store:matchedStore.name,storeId:matchedStore.id,storeLocation:matchedStore.location,storeAddress:matchedStore.address,latitude:matchedStore.latitude,longitude:matchedStore.longitude,provider:matchedStore.provider,providerPlaceId:matchedStore.providerPlaceId,providerOsmType:matchedStore.providerOsmType,providerOsmId:matchedStore.providerOsmId,locationAccuracyMeters:matchedStore.locationAccuracyMeters};}const username=usernameFrom(scopedForm);if(scopedForm.id){const backendId=scopedForm.orgAccessUserId||scopedForm.backendUserId||scopedForm.id;if(!/^\d+$/.test(String(backendId)))throw new Error('This staff record is missing its backend account ID. Refresh the Users list and try again.');await orgAccessService.updateUser(backendId,scopedForm);}else{await orgAccessService.createUser({...scopedForm,username,email:scopedForm.email,password:scopedForm.password,role:scopedForm.role});}}
    else if(active==='notifications'){const data={title:scopedForm.name,message:scopedForm.message,audience:scopedForm.audience,location:scopedForm.location,type:scopedForm.type,schedule:scopedForm.schedule};if(scopedForm.id)notificationStore.update(scopedForm.id,data);else notificationStore.add(data);}
    else if(active==='inventory'){const saved=scopedForm.id?await updateInventory(scopedForm.id,toInventoryUpdatePayload(scopedForm)):await createInventory(toInventoryCreatePayload(scopedForm));setRecords((items)=>[adaptInventory(saved,{stores:knownStores(),products:[...catalogProducts,...storeManagerInventoryProducts]}),...items.filter((item)=>item.id!==saved.id)]);}
    else if(active==='delivery'&&user?.role==='store-manager'){const storeId=managerStoreId();if(!storeId)throw new Error('No store is assigned to this manager.');if(scopedForm.id)await updateStoreDeliveryZone(storeId,scopedForm.id,toDeliveryZonePayload(scopedForm));else await createStoreDeliveryZone(storeId,toDeliveryZonePayload(scopedForm));}
    else if(active==='stores'){await saveStoreRecord(scopedForm);if(user?.role==='store-manager'&&scopedForm.newPassword){await orgAccessService.changePassword({currentPassword:scopedForm.currentPassword,newPassword:scopedForm.newPassword});}}
    else if(active==='locations'){const payload=toLocationPayload(scopedForm);const saved=scopedForm.id?await updateLocation(payload.id,payload):await createLocation(payload);const locationRecord=adaptLocation({...payload,...saved,adminName:saved.adminName||payload.adminName});setRecords((current)=>[locationRecord,...current.filter((item)=>item.id!==locationRecord.id)]);}
    else if(active==='banners'){const payload=toBannerPayload(scopedForm,user,managerStoreId());if(scopedForm.id)await updateBanner(scopedForm.id,payload);else await createBanner(payload);}
    else if(active==='coupons'){
      let couponForm=scopedForm;
      if(user?.role==='location-admin'&&scopedForm.targetStore){
        const targetStore=knownStores().find((store)=>String(store.id)===String(scopedForm.targetStore)||sameText(store.name,scopedForm.targetStore));
        if(!targetStore||!sameText(targetStore.location,user.location))throw new Error('Choose a store within your assigned location.');
        couponForm={...scopedForm,targetStore:String(targetStore.id)};
      }
      const payload=toCouponPayload(couponForm,user,managerStoreId());
      const isDatabaseRecord=Boolean(scopedForm._databaseRecord);
      const saved=isDatabaseRecord?await updateCoupon(scopedForm.id,payload):await createCoupon(payload);
      const legacy=collectionStore.list('coupons').filter((coupon)=>String(coupon.name||coupon.code||'').toUpperCase()!==payload.code);
      collectionStore.replace?.('coupons',legacy);
      if(!collectionStore.replace)collectionStore.set?.('coupons',legacy);
      setRecords((items)=>[adminCoupon(saved),...items.filter((item)=>item.id!==saved.id&&String(item.name||'').toUpperCase()!==payload.code)]);
    }
    else if(scopedForm.id)collectionStore.update(storageName,scopedForm.id,scopedForm);else collectionStore.add(storageName,{...scopedForm,status:scopedForm.status||'Active',...(active==='delivery'?{vehicleNumber:String(scopedForm.vehicleNumber).trim().toUpperCase(),mustChangePassword:true}: {})});
    setDialog(null);setMessage(active==='delivery'?'Delivery partner created. They can sign in with the vehicle number and temporary password.':'Saved successfully.');await load();
  }catch(error){const fieldErrors=error.payload?.fields;if(active==='users'&&fieldErrors&&typeof fieldErrors==='object'){setErrors((current)=>({...current,...fieldErrors}));setMessage(error.payload?.message||'Correct the highlighted fields and try again.');}else setMessage(error.message);}finally{setSaving(false);}};
  const remove=async()=>{try{if(active==='categories')await deleteCategory(confirm.id);else if(active==='banners')await deleteBanner(confirm.id);else if(active==='coupons'&&confirm._databaseRecord)await deleteCoupon(confirm.id);else if(active==='products'&&user?.role==='location-admin'){if(!sameText(confirm.ownerLocation,user.location))throw new Error('Shared catalog products are read-only for Location Admin.');await deleteLocationProduct(confirm.id);}else if(active==='products')await deleteProduct(confirm.id);else if(active==='stores'){await deleteStore(confirm.id);removeCatalogStore(confirm.id);}else if(active==='locations')await deleteLocation(confirm.id);else if(active==='inventory')throw new Error('Inventory Service does not expose a delete endpoint. Set status to INACTIVE instead.');else if(active==='delivery'&&user?.role==='store-manager')await deleteStoreDeliveryZone(managerStoreId(),confirm.id);else if(active==='notifications')notificationStore.remove(confirm.id);else if(active==='users')await orgAccessService.deleteUser(confirm.orgAccessUserId||confirm.backendUserId||confirm.id);else collectionStore.remove(storageName,confirm.id);setConfirm(null);setMessage('Deleted successfully.');await load();}catch(error){setMessage(error.message);setConfirm(null);}};
  const toggle=async(record)=>{try{const activate=record.status==='Inactive'||record.status==='Blocked'||record.status==='INACTIVE';if(active==='locations'){const current={...record,...toLocationPayload(record)};await updateLocation(record.id,{...current,status:activate?'Active':'Inactive',active:!activate});}else if(active==='categories')await updateCategory(record.id,{name:record.name,slug:record.slug,description:record.description,thumbnailUrl:record.thumbnailUrl || record.image || null,active:activate});else if(active==='banners')await setBannerStatus(record.id,activate?'ACTIVE':'INACTIVE');else if(active==='coupons'&&record._databaseRecord)await setCouponStatus(record.id,activate?'ACTIVE':'INACTIVE');else if(active==='products'&&user?.role==='location-admin'){if(!sameText(record.ownerLocation,user.location))throw new Error('Shared catalog products are read-only for Location Admin.');await setLocationProductAvailability(record.id,activate);}else if(active==='products')await updateProduct(record.id,{categoryId:record.categoryId,name:record.name,slug:record.slug,sku:record.sku,description:record.description,brand:record.brand,ingredients:record.ingredients || null,specifications:record.specifications || null,pack:record.pack || null,type:record.type || null,shelfLife:record.shelfLife || null,tags:Array.isArray(record.tags)?record.tags.join(', '):record.tags || null,highlights:Array.isArray(record.highlights)?record.highlights.join('\n'):record.highlights || null,aboutSource:record.aboutSource || null,status:activate?'ACTIVE':'INACTIVE'});else if(active==='stores')await saveStoreRecord({...record,status:activate?'Active':'Inactive'});else if(active==='inventory')await updateInventory(record.id,toInventoryUpdatePayload({...record,status:activate?'ACTIVE':'INACTIVE'}));else if(active==='notifications')notificationStore.markRead(record.id);else if(active==='users')throw new Error('Staff status changes must be performed through the authorized user management service.');else collectionStore.update(storageName,record.id,{status:activate?'Active':'Inactive'});await load();}catch(error){setMessage(error.message);}};
  const duplicate=async(record)=>{try{if(active==='products'){
      const suffix=`C${Date.now().toString(36).toUpperCase()}`;
      const sourceVariants=Array.isArray(record.catalogVariants)&&record.catalogVariants.length
        ? record.catalogVariants
        : variantRows(record.variants,record.sku,record.price);
      const productSku=String(record.sku||sourceVariants[0]?.sku||'PRODUCT').slice(0,70);
      const copyName=`${record.name} Copy`;
      const product=await createProduct({
        categoryId:record.categoryId,
        subcategory:record.subcategory||'Other',
        name:copyName,
        slug:`${slugify(copyName)}-${suffix.toLowerCase()}`,
        sku:`${productSku}-C${suffix}`,
        description:record.description||'',brand:record.brand||null,ingredients:record.ingredients||null,
        specifications:record.specifications||null,pack:record.pack||null,type:record.type||null,
        shelfLife:record.shelfLife||null,tags:Array.isArray(record.tags)?record.tags.join(', '):record.tags||null,
        highlights:Array.isArray(record.highlights)?record.highlights.join('\n'):record.highlights||null,
        aboutSource:record.aboutSource||null,featured:record.featured==='Yes',special:record.special==='Yes',
        newArrival:record.newArrival==='Yes',bestSeller:record.bestSeller==='Yes',
        status:record.status==='Inactive'?'INACTIVE':record.status==='Draft'?'DRAFT':'ACTIVE',
      });
      if(!product?.id)throw new Error('The catalog service did not confirm a new product ID.');
      for(let index=0;index<sourceVariants.length;index+=1){
        const variant=sourceVariants[index];
        const variantSku=`${String(variant.sku||productSku).slice(0,70)}-C${suffix}${index?`-${index+1}`:''}`;
        await createVariant(product.id,{
          name:variant.name||variant.label||'Default',sku:variantSku,
          price:Number(variant.price??record.price??0),
          compareAtPrice:Number(variant.compareAtPrice??variant.price??record.price??0),
          attributes:typeof variant.attributes==='string'?variant.attributes:JSON.stringify(variant.attributes||{}),
          active:variant.active!==false,
        });
      }
      const sourceImages=await getProductImages(record.id);
      for(const image of sourceImages||[]){
        await createImage(product.id,{url:image.url||image.imageUrl,altText:image.altText||copyName,displayOrder:image.displayOrder||0,primaryImage:Boolean(image.primaryImage)});
      }
      const refreshedProducts=await getProducts({size:200});
      const visibleProducts=(refreshedProducts.content||[]).map(adminProduct);
      if(!visibleProducts.some((item)=>String(item.id)===String(product.id)))throw new Error('The duplicate was created but did not appear after refreshing the Catalog list.');
      setRecords(visibleProducts);setStatusFilter('All');setQuery(copyName);setPage(1);
      setMessage(`Product duplicated as ${copyName} with SKU ${productSku}-C${suffix}.`);
      return;
    }if(active==='coupons'){
      const payload=toCouponPayload({...record,name:`${record.name}-COPY`,couponName:`${record.couponName || record.name} Copy`,status:'Inactive'},user,managerStoreId());
      const saved=await createCoupon(payload);
      await load();setMessage(`Coupon duplicated as ${saved.code}.`);return;
    }
    const copy={...record,name:`${record.name} Copy`};delete copy.id;collectionStore.add(storageName,copy);await load();setMessage('Duplicated successfully.');
  }catch(error){setMessage(error.message);}};
  const resetStaffPassword=async()=>{
    if(String(passwordResetValue).length<8){setMessage('New password must be at least 8 characters.');return;}
    const id=confirm?.orgAccessUserId||confirm?.backendUserId||confirm?.id;
    if(!/^\d+$/.test(String(id||''))){setMessage('This staff record is missing its backend account ID. Refresh the Users list and try again.');return;}
    setSaving(true);
    try{await orgAccessService.resetUserPassword(id,passwordResetValue);setConfirm(null);setPasswordResetValue('');setMessage(`Password reset for ${confirm.name||confirm.username}.`);await load();}
    catch(error){setMessage(error.message);}
    finally{setSaving(false);}
  };
  const stock=async(record,operation,quantity,reason)=>{if(!record.id)return setMessage('Inventory record ID is required for stock operations.');const busyKey=`${record.id}:${operation}:${quantity}`;setStockBusy(busyKey);try{const payload=toStockOperationPayload(quantity,reason);const handlers={increase:increaseStock,decrease:decreaseStock,reserve:reserveStock,release:releaseStock};await handlers[operation](record.id,payload);const saved=await getInventory(record.id);const adapted=adaptInventory(saved,{stores:knownStores(),products:[...catalogProducts,...storeManagerInventoryProducts]});setRecords((items)=>items.map((item)=>item.id===record.id?adapted:item));setInventoryRecords((items)=>items.map((item)=>item.id===record.id?adapted:item));setMessage('Stock updated successfully.');}catch(error){setMessage(error.message);}finally{setStockBusy('');}};
  const orderStatus=async(record,status)=>{try{const globalOrder=isGlobalOrder(record);if(globalOrder&&user?.role!=='global-admin'){setMessage('Global admin approval pending. Store managers cannot change global order status.');return;}if(globalOrder&&status==='CONFIRMED'&&record.globalApproval!=='Approved'){navigate(`/admin/orders/assign/${encodeURIComponent(record.id)}`);return;}if(UUID_PATTERN.test(record.id)){if(status==='CANCELLED')await cancelOrder(record.id);else{const action=workflowActionForOrderStatus(status);if(action){await serviceWorkflow(record,action);return;}await updateBackendOrderStatusSafely(record.id,status,record.status);}}else orderStore.updateStatus(record.id,status);setMessage(`Order updated to ${status}.`);load();}catch(error){setMessage(error.message);}};
  const serviceWorkflow=async(record,action)=>{const key=`${record.id}:${action}`;setWorkflowBusy(key);try{if(!UUID_PATTERN.test(record.id))throw new Error('This order is not stored in the MySQL-backed Order Service.');const globalOrder=isGlobalOrder(record);if(globalOrder){if(user?.role!=='global-admin'){setMessage('Global admin approval pending. Store managers cannot run local fulfillment for global orders.');return;}if(record.globalApproval!=='Approved'){navigate(`/admin/orders/assign/${encodeURIComponent(record.id)}`);setMessage('Assign and approve this global order before fulfillment.');return;}}if(action==='CONFIRM'&&!globalOrder){const latestBefore=await refreshBackendRecord(record,knownStores());if(getOrderStatus(latestBefore)!=='CREATED'){if(dialog==='view')setForm(latestBefore);setRecords((items)=>[latestBefore,...items.filter((item)=>item.id!==latestBefore.id)]);setMessage(`Order is already ${latestBefore.status}. Use the next available action.`);return;}}await runOrderServiceWorkflow(record,action);const latest=await fetchBackendOrder(record.id,knownStores());if(dialog==='view')setForm(latest);setRecords((items)=>[latest,...items.filter((item)=>item.id!==latest.id)]);setMessage('Order, fulfillment and notification services updated in MySQL.');await load();}catch(error){setMessage(error.message);}finally{setWorkflowBusy('');}};
  const fetchOrderSearch=async()=>{const value=query.trim();if(!value)return setMessage('Enter an order ID or number to fetch.');setLoading(true);try{const stores=knownStores();const backendOrders=(await getOrders(user?.role==='store-manager'&&managerStoreId()?{storeId:managerStoreId()}:{})).map((order)=>adminOrder(normalizeOrder(order),stores));const match=backendOrders.find((order)=>String(order.id).toLowerCase()===value.toLowerCase()||String(order.orderNumber||'').toLowerCase()===value.toLowerCase());if(!match)throw new Error('No matching MySQL order was found.');setRecords((items)=>[match,...items.filter((item)=>item.id!==match.id)]);setStatusFilter('All');setQuery('');setPage(1);setMessage(`Fetched order ${match.orderNumber||match.id} from MySQL.`);}catch(error){setMessage(error.message);}finally{setLoading(false);}};  const setAssignment=(record)=>{setAssignmentState(null);if(!record)return;const path=orderAssignmentPath(record,user?.role);if(path){navigate(path);return;}setMessage(record.fulfillmentType==='global'?'Global orders must be assigned by a Super Admin or Global Admin.':'You do not have permission to assign delivery partners.');};
  const assignOrder=()=>{try{const partner=collectionStore.list('delivery').find((item)=>item.id===partnerId);orderStore.assignPartner(assignment.id,partner);setAssignment(null);setPartnerId('');load();setMessage(`Order assigned to ${partner.name}.`);}catch(error){setMessage(error.message);}};
  const lookupOptions=(key)=>key==='productId'?inventoryProductOptions.map((item)=>item.productId||item.id):['store','targetStore'].includes(key)?knownStores().filter((item)=>!(user?.location||form.location)||sameText(item.location,user?.location||form.location)).map((item)=>item.name):key==='category'?catalogCategories.map((item)=>item.name):key==='product'?scopeRecords(collectionStore.list('products'),user,knownStores(),collectionStore.list('products')).map((item)=>item.name):[...new Set([...collectionStore.list('locations').map((item)=>item.name||item.city),...knownStores().map((item)=>item.location)].filter(Boolean))];
  const upload=(key,file)=>{if(!file?.type.startsWith('image/'))return setErrors({...errors,[key]:'Select a valid image.'});if(file.size>2*1024*1024)return setErrors({...errors,[key]:'Image must be under 2 MB.'});const reader=new FileReader();reader.onload=()=>setForm({...form,[key]:reader.result});reader.readAsDataURL(file);};
  const uploadMany=(key,files)=>{const selected=[...files].filter((file)=>file.type.startsWith('image/')&&file.size<=2*1024*1024);Promise.all(selected.map((file)=>new Promise((resolve)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);}))).then((images)=>setForm((current)=>({...current,[key]:images})));};
  const allStores=knownStores(); const allProducts=catalogProducts;
  const orders=['orders','reports','dashboard'].includes(active)?records:scopeRecords(orderStore.list(),user,allStores,allProducts); const orderSummary=summarizeOrders(orders); const sales=orderSummary.revenue; const revenueOrders=orders.filter((order)=>!isCancelledOrder(order)); const stores=scopeRecords(allStores,user,allStores,allProducts); const assignedStoreIds=new Set(stores.map((store)=>String(store.id))); const locationProductIds=new Set(catalogStoreProducts.filter((mapping)=>assignedStoreIds.has(String(mapping.storeId))&&mapping.available!==false).map((mapping)=>String(mapping.productId))); const products=user?.role==='location-admin'?allProducts.filter((product)=>locationProductIds.has(String(product.id))):scopeRecords(allProducts,user,allStores,allProducts); const inventory=inventoryRecords;
  const managerMappedProductIds=new Set(catalogStoreProducts.filter((mapping)=>String(mapping.storeId)===String(managerStoreId())&&mapping.available!==false).map((mapping)=>String(mapping.productId)));
  const reportProducts=user?.role==='store-manager'?allProducts.filter((product)=>managerMappedProductIds.has(String(product.id))):products;
  const reportInventory=user?.role==='store-manager'?inventory.filter((item)=>String(item.storeId)===String(managerStoreId())):inventory;
  const locationProductCount=user?.role==='location-admin'
    ? (catalogLoading||catalogError ? null : new Set(catalogStoreProducts
      .filter((mapping)=>stores.some((store)=>String(store.id)===String(mapping.storeId)))
      .map((mapping)=>String(mapping.productId||''))
      .filter(Boolean)).size)
    : products.length;
  const exportData=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(filtered,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`${active}-export.json`;a.click();URL.revokeObjectURL(url);};
  const visibleFormFields=(schemas[active]||[]).filter(([key])=>(active!=='users'||form.role==='store-manager'||!['storeName','storeLocation','storeAddress'].includes(key))&&(active!=='users'||dialog!=='edit'||key!=='password')&&(active!=='users'||user?.role!=='location-admin'||dialog!=='edit'||!['username','role','location','store','storeName','storeLocation','storeAddress','password'].includes(key))&&(active!=='stores'||user?.role==='store-manager'||!['currentPassword','newPassword'].includes(key))).map((field)=>active==='users'&&field[0]==='role'?[field[0],field[1],field[2],field[3],MANAGEABLE_ROLES[user?.role]||field[4]]:active==='products'&&field[0]==='status'&&user?.role==='location-admin'?[field[0],'Location availability','select',true,['Active','Inactive']]:field);

  if(['super-admin','global-admin'].includes(user?.role)&&location.pathname.includes('/orders/assign/')) return <GlobalStoreAssignment orderId={decodeURIComponent(location.pathname.split('/').at(-1))}/>;
  if(['super-admin','global-admin','location-admin','store-manager'].includes(user?.role)&&location.pathname.includes('/orders/delivery/')) return <DeliveryPartnerAssignment orderId={decodeURIComponent(location.pathname.split('/').at(-1))}/>;
  if(!canAccessModule(user?.role,active)) return <Box p={4}><Typography variant="h5">Access denied</Typography><Typography color="text.secondary">Your {ROLE_LABELS[user?.role]} role cannot access this module.</Typography><Button onClick={()=>navigate('/admin/dashboard')}>Dashboard</Button></Box>;
  return <Box className={`admin-shell ${collapsed?'admin-collapsed':''}`}><Box className="admin-sidebar" component="nav"><Box className="admin-brand"><img src={logo} alt="Spices and Pickles"/><Box><Typography variant="h6">{ROLE_LABELS[user?.role]} Portal</Typography><Typography variant="caption">{user?.store || user?.location || 'All locations'}</Typography></Box><IconButton onClick={()=>setCollapsed((value)=>!value)} aria-label={collapsed?'Expand sidebar':'Collapse sidebar'}>{collapsed?<MenuIcon/>:<ChevronLeftIcon/>}</IconButton></Box><Box className="admin-nav-scroll">{user?.role==='store-manager' ? storeManagerNavItems.map(([id,label,Icon,path])=><Tooltip key={id} title={collapsed?label:''} placement="right"><Button className={active===id?'admin-nav-active':''} fullWidth startIcon={<Icon/>} onClick={()=>{if(path==='logout'){logout();navigate('/team-login');}else{navigate(path);}}}><span>{label}</span></Button></Tooltip>) : navGroups.map(([group,items])=>{const allowed=items.filter((name)=>visibleModules.includes(name));return allowed.length?<Box className="admin-nav-group" key={group}><Typography>{group}</Typography>{allowed.map((name)=><Tooltip key={name} title={collapsed?titles[name]:''} placement="right"><Button className={active===name?'admin-nav-active':''} fullWidth startIcon={navIcons[name]} onClick={()=>navigate(`/admin/${name}`)}><span>{titles[name]}</span></Button></Tooltip>)}</Box>:null})}</Box><Button className="admin-customer-link" onClick={()=>navigate('/home')}>View Customer App</Button></Box><Box className="admin-workspace admin-main" component="main"><Box className="admin-topbar"><Box className="admin-topbar-title"><IconButton onClick={()=>setCollapsed((value)=>!value)}><MenuIcon/></IconButton><span>{ROLE_LABELS[user?.role]} / <strong>{titles[active]}</strong></span></Box><Box className="admin-topbar-actions"><Box className="admin-global-search"><SearchIcon/><InputBase placeholder="Search portal" value={query} onChange={(event)=>setQuery(event.target.value)}/></Box><IconButton onClick={()=>navigate('/admin/notifications')} aria-label="Notifications"><NotificationsNoneOutlinedIcon/></IconButton><Button className="admin-profile-button" onClick={()=>setProfileOpen((value)=>!value)}><Avatar>{(user?.name||'A')[0]}</Avatar><span>{user?.name||'Admin'}</span></Button>{profileOpen&&<Box className="admin-profile-menu"><Button onClick={()=>user?.role==='store-manager'?navigate('/store-manager/profile'):openProfileDialog()}>Profile & Settings</Button>{canAccessModule(user?.role,'security')&&<Button onClick={()=>navigate('/admin/security')}>Security</Button>}<Button onClick={()=>navigate('/home')}>Customer App</Button><Button color="error" onClick={()=>{logout();navigate('/team-login');}}>Sign out</Button></Box>}</Box></Box><Box className="admin-page-heading"><Box><Typography variant="h4">{active==='dashboard'?`Welcome back, ${user?.name||'Admin'}`:titles[active]}</Typography><Typography>{active==='dashboard'?`Live operational data for ${user?.store || user?.location || 'the full business'}.`:`Manage ${titles[active].toLowerCase()} within your assigned scope.`}</Typography></Box><Button variant="outlined" onClick={()=>navigate('/home')}>View Customer App</Button></Box>{loading&&<BrandLoader size="medium" label={`Loading ${titles[active]}...`}/>} 
    {active==='dashboard'&&<>{dashboardOrdersError&&<Alert severity="error" sx={{mb:2}}>{dashboardOrdersError}</Alert>}{dashboardCustomerError&&<Alert severity="error" sx={{mb:2}}>Customer metric unavailable: {dashboardCustomerError}</Alert>}<Box className="admin-stat-grid">{[["Total Orders",!dashboardMetricsLoaded||dashboardOrdersError?'â€”':orderSummary.total,<ShoppingBagOutlinedIcon/>],["Created Orders",!dashboardMetricsLoaded||dashboardOrdersError?'â€”':orderSummary.created,<HistoryOutlinedIcon/>],["Completed Orders",!dashboardMetricsLoaded||dashboardOrdersError?'â€”':orderSummary.delivered,<CheckCircleOutlinedIcon/>],["Cancelled Orders",!dashboardMetricsLoaded||dashboardOrdersError?'â€”':orderSummary.cancelled,<ErrorOutlinedIcon/>],...(canViewCustomerMetrics?[["Customers",!dashboardMetricsLoaded||dashboardCustomerError?'â€”':dashboardCustomerTotal,<PeopleOutlineIcon/>]]:[]),["Products",locationProductCount??'â€”',<Inventory2OutlinedIcon/>],["Low Stock",!dashboardMetricsLoaded||dashboardInventoryError?'â€”':countLowStockInventory(inventory),<LocalOfferOutlinedIcon/>],["Revenue",!dashboardMetricsLoaded||dashboardOrdersError?'â€”':`â‚¹${sales.toLocaleString('en-IN')}`,<AssessmentOutlinedIcon/>]].map(([label,value,icon])=><Box className={`admin-stat-card ${label==='Revenue'?'revenue':''}`} key={label}><Box className="admin-stat-icon">{icon}</Box><Typography>{label}</Typography><Typography variant="h5">{value}</Typography><Typography variant="caption">{label==='Products'&&user?.role==='location-admin'?'Mapped to assigned stores':'Backend data'}</Typography></Box>)}</Box><Box className="admin-insight-grid"><Box className="admin-widget"><Box className="admin-widget-head"><Typography variant="h6">Revenue Overview</Typography><Typography variant="caption">Order totals</Typography></Box><Box className="revenue-bars">{!dashboardMetricsLoaded||dashboardOrdersError?<Typography color="text.secondary">Revenue chart unavailable until authorized order data is available.</Typography>:revenueOrders.slice(0,8).reverse().map((order,index)=><span key={order.id} style={{height:`${Math.max(12,Math.min(100,orderTotal(order)/(Math.max(...revenueOrders.map(item=>orderTotal(item)),1))*100))}%`}} title={`${order.id}: ${orderTotal(order)}`}><i>{index+1}</i></span>)}</Box></Box><Box className="admin-widget"><Box className="admin-widget-head"><Typography variant="h6">Order Status</Typography><Typography variant="caption">Live distribution</Typography></Box>{!dashboardMetricsLoaded||dashboardOrdersError?<Typography color="text.secondary">Order status metrics unavailable until authorized order data is available.</Typography>:ORDER_STATUSES.map((status)=>{const count=orders.filter(order=>order.status===status).length;return <Box className="status-progress" key={status}><span>{status}<strong>{count}</strong></span><i><b style={{width:`${orders.length?count/orders.length*100:0}%`}}/></i></Box>})}</Box></Box><Box className="admin-dashboard-grid"><Box className="admin-widget"><Box className="admin-widget-head"><Typography variant="h6">Recent Orders</Typography><Button onClick={()=>navigate('/admin/orders')}>View All</Button></Box>{!dashboardMetricsLoaded?<Typography color="text.secondary">Loading order dataâ€¦</Typography>:dashboardOrdersError?<Typography color="error">Order data unavailable because the account cannot currently read location orders.</Typography>:orders.length?orders.slice(0,5).map(order=><Box className="admin-order-row" key={order.id}><ShoppingBagOutlinedIcon/><span><strong>{order.id}</strong><small>{order.items?.[0]?.title||'Customer order'}</small></span><Chip size="small" label={order.status}/><strong>â‚¹{orderTotal(order).toLocaleString('en-IN')}</strong></Box>):<Box className="admin-empty"><ShoppingBagOutlinedIcon/><Typography>No orders yet</Typography><span>Customer orders will appear here.</span></Box>}</Box><Box className="admin-widget"><Box className="admin-widget-head"><Typography variant="h6">Low Stock Products</Typography><Button onClick={()=>navigate('/admin/inventory')}>View Inventory</Button></Box>{!dashboardMetricsLoaded?<Typography color="text.secondary">Loading inventory metricsâ€¦</Typography>:dashboardInventoryError?<Typography color="error">Low-stock list unavailable: {dashboardInventoryError}</Typography>:getLowStockInventory(inventory).length?getLowStockInventory(inventory).slice(0,5).map(item=><Box className="stock-row" key={item.id}><span><strong>{item.name}</strong><small>{item.sku}</small></span><Chip size="small" color="warning" label={`${item.stock} left`}/></Box>):<Box className="admin-empty stocked"><CheckCircleOutlinedIcon/><Typography>Inventory looks healthy</Typography><span>All products are sufficiently stocked.</span></Box>}</Box></Box></>}
    {active==='reports'&&<AdminReports orders={orders} customerTotal={dashboardCustomerTotal} customerError={dashboardCustomerError} showCustomerMetric={canViewCustomerMetrics} locationScope={user?.role==='location-admin'?user.location:''} storeScopeId={user?.role==='store-manager'?managerStoreId():''} products={reportProducts} storeProductMappings={catalogStoreProducts} inventory={reportInventory} stores={user?.role==='store-manager'?stores.filter((store)=>String(store.id)===String(managerStoreId())):stores} loading={loading} error={reportOrdersError} onRetry={()=>load().catch(()=>{})}/>}
    {active==='reviews'&&<AdminReviewsPanel role={user?.role}/>}
    {active==='delivery'&&user?.role!=='store-manager'&&<AdminDeliveryPartners user={user} stores={knownStores()}/>}{!['dashboard','reports','reviews'].includes(active)&&!(active==='delivery'&&user?.role!=='store-manager')&&<Box sx={{bgcolor:'white',p:2,borderRadius:2}}><Box sx={{display:'flex',gap:1,flexWrap:'wrap',mb:2}}><TextField size="small" label={active==='orders'?'Search or paste order ID':'Search'} value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}}/>{active==='orders'&&<Button variant="outlined" onClick={fetchOrderSearch}>Fetch Order</Button>}<Select size="small" value={statusFilter} onChange={e=>applyStatusFilterChange({value:e.target.value,role:user?.role,setStatusFilter,setPage})}>{statuses.map(s=><MenuItem key={s} value={s}>{s}</MenuItem>)}</Select><Select size="small" value={sort} onChange={e=>setSort(e.target.value)}><MenuItem value="newest">Newest</MenuItem><MenuItem value="oldest">Oldest</MenuItem><MenuItem value="name">Name</MenuItem></Select>{active==='products'&&['location-admin','global-admin'].includes(user?.role)?<><Button variant="contained" onClick={()=>open('create')}>Create Product</Button><Button variant="outlined" onClick={()=>{setMappingProductId('');setProductMappingsError('');setDialog('select-map-product');}}>Map Product</Button></>:!(user?.role==='store-manager'&&['products','banners','coupons'].includes(active))&&!['orders','audit-logs','customers'].includes(active)&&!(active==='stores'&&user?.role==='global-admin')&&!(active==='users'&&user?.role==='location-admin')&&<Button variant="contained" onClick={()=>open('create')}>{active==='locations'?'Create Location':'Create'}</Button>}{active==='customers'&&<Button onClick={()=>load().catch(()=>{})}>Retry</Button>}{active!=='customers'&&<Button onClick={exportData}>Export</Button>}</Box>{customerLoadError&&<Alert severity="error" sx={{mb:2}}>{customerLoadError}</Alert>}{active==='products'&&orphanInventoryProductCount>0&&<Alert severity="warning" sx={{mb:2}}>{orphanInventoryProductCount} product {orphanInventoryProductCount===1?'ID is':'IDs are'} present in inventory but missing from the catalog. Inventory stock records do not create product records. Recreate the products in this page before assigning new stock.</Alert>}{message&&!customerLoadError&&<Typography role="status" color="#075F40" mb={2}>{message}</Typography>}{shown.length===0?<Typography color="text.secondary">{user?.role==='store-manager'&&['banners','coupons'].includes(active)?'No records are available to this Store Manager account under the current permissions.':'No matching records. Use Create to add the first record.'}</Typography>:shown.map(record=><Box key={record.id} sx={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:2,p:1.5,borderBottom:'1px solid #e2e8f0'}}><Box>{(record.image||record.logoUrl)&&<SafeProductImage src={record.image||record.logoUrl} fallback={active==='banners'?bannerImageFor(record):active==='products'?productImageFor(record):active==='categories'?categoryImageFor(record):logo} alt="" style={{width:44,height:44,objectFit:'cover',borderRadius:6,float:'left',marginRight:10}}/>}<Typography fontWeight={700}>{record.orderNumber||record.name||record.title||record.id}</Typography><Typography variant="body2" color="text.secondary">{active==='orders'?[record.sourceStore||record.store,record.deliveryLabel||record.estimatedDelivery,record.fulfillment?.status?`Fulfillment ${record.fulfillment.status}`:'',record.shipment?.status?`Shipment ${record.shipment.status}`:''].filter(Boolean).join(' Â· ')||record.status:record.phone||record.sku||record.email||record.city||record.type||record.status||record.action||record.message||record.id||'Local record'}</Typography>{active==='orders'&&record.deliveryPartner&&<Typography variant="caption" color="text.secondary">Assigned to {record.deliveryPartner.name} Â· {record.deliveryPartner.vehicleNumber}</Typography>}</Box><Box sx={{display:'flex',gap:.5,flexWrap:'wrap'}}>{(user?.role!=='store-manager'||active!=='products')&&<Button onClick={()=>open('view',record)}>View</Button>}{active==='orders'?<><Select size="small" value={record.status} onChange={e=>orderStatus(record,e.target.value)} disabled={isGlobalOrder(record)&&user?.role!=='global-admin'}>{ORDER_STATUSES.map(s=><MenuItem key={s} value={s}>{s}</MenuItem>)}</Select>{!isGlobalOrder(record)&&getOrderStatus(record)==='CREATED'&&<Button disabled={workflowBusy===`${record.id}:CONFIRM`} onClick={()=>serviceWorkflow(record,'CONFIRM')}>Accept</Button>}{!isGlobalOrder(record)&&['CONFIRMED','PROCESSING','SHIPPED'].includes(record.status)&&<Button disabled={workflowBusy===`${record.id}:PACKING`} onClick={()=>serviceWorkflow(record,'PACKING')}>Pack</Button>}{!isGlobalOrder(record)&&['CONFIRMED','PROCESSING'].includes(record.status)&&<Button disabled={workflowBusy===`${record.id}:READY`} onClick={()=>serviceWorkflow(record,'READY')}>Ready</Button>}{!isGlobalOrder(record)&&['CONFIRMED','PROCESSING'].includes(record.status)&&<Button disabled={workflowBusy===`${record.id}:SHIP`} onClick={()=>serviceWorkflow(record,'SHIP')}>Ship</Button>}{!isGlobalOrder(record)&&record.status==='SHIPPED'&&<Button disabled={workflowBusy===`${record.id}:OUT_FOR_DELIVERY`} onClick={()=>serviceWorkflow(record,'OUT_FOR_DELIVERY')}>Out</Button>}{!isGlobalOrder(record)&&record.status==='SHIPPED'&&<Button disabled={workflowBusy===`${record.id}:DELIVER`} onClick={()=>serviceWorkflow(record,'DELIVER')} variant="contained">Delivered</Button>}{isGlobalOrder(record)&&user?.role==='global-admin'&&record.globalApproval!=='Approved'&&<Button onClick={()=>navigate(`/admin/orders/assign/${encodeURIComponent(record.id)}`)}>Review Global Stock</Button>}{isGlobalOrder(record)&&user?.role==='global-admin'&&record.globalApproval==='Approved'&&record.status==='CONFIRMED'&&<Button disabled={workflowBusy===`${record.id}:PACKING`} onClick={()=>serviceWorkflow(record,'PACKING')}>Pack</Button>}{isGlobalOrder(record)&&user?.role==='global-admin'&&record.globalApproval==='Approved'&&record.status==='PROCESSING'&&<><Button disabled={workflowBusy===`${record.id}:READY`} onClick={()=>serviceWorkflow(record,'READY')}>Ready to ship</Button><Button disabled={workflowBusy===`${record.id}:SHIP`} onClick={()=>serviceWorkflow(record,'SHIP')}>Ship</Button></>}{isGlobalOrder(record)&&user?.role==='global-admin'&&record.globalApproval==='Approved'&&record.status==='SHIPPED'&&<Button disabled={workflowBusy===`${record.id}:DELIVER`} onClick={()=>serviceWorkflow(record,'DELIVER')} variant="contained">Delivered</Button>}{!isGlobalOrder(record)&&<Button variant="contained" startIcon={<LocalShippingOutlinedIcon/>} onClick={()=>setAssignment(record)}>Assign delivery partner</Button>}<Button color="error" onClick={()=>setConfirm({...record,orderReject:true})}>Reject</Button></>:active==='inventory'?<><Button disabled={stockBusy===`${record.id}:increase:10`} onClick={()=>stock(record,'increase',10,'Manual stock in')}>Stock +10</Button><Button disabled={stockBusy===`${record.id}:decrease:1`} onClick={()=>stock(record,'decrease',1,'Manual stock out')}>Stock -1</Button><Button onClick={()=>open('edit',record)}>Adjust</Button></>:active==='products'&&user?.role==='location-admin'?<>{sameText(record.ownerLocation,user.location)?<><Button onClick={()=>open('edit',record)}>Edit</Button><Button onClick={()=>toggle(record)}>{record.status==='Inactive'?'Make available':'Make unavailable'}</Button><Button color="error" onClick={()=>setConfirm(record)}>Delete</Button></>:null}<Button onClick={()=>openProductMappings(record)}>Manage stores</Button></>:active==='users'&&user?.role==='location-admin'?<><Button onClick={()=>open('edit',record)}>Edit</Button><Button onClick={()=>{setPasswordResetValue('');setConfirm({...record,passwordReset:true});}}>Reset Password</Button><Button color="error" onClick={()=>setConfirm(record)}>Delete</Button></>:active==='products'&&user?.role==='store-manager'?<Button onClick={()=>open('view',record)}>View</Button>:active!=='audit-logs'&&active!=='customers'&&<><Button onClick={()=>open('edit',record)}>Edit</Button>{['products','coupons'].includes(active)&&<Button onClick={()=>duplicate(record)}>Duplicate</Button>}<Button onClick={()=>toggle(record)}>{record.status==='Inactive'||record.status==='Blocked'?'Activate':'Deactivate'}</Button><Button color="error" onClick={()=>setConfirm(record)}>Delete</Button></>}</Box></Box>)}<Box sx={{display:'flex',justifyContent:'center',gap:1,mt:2}}><Button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Previous</Button><Typography sx={{pt:1}}>Page {page} of {pages}</Typography><Button disabled={page===pages} onClick={()=>setPage(p=>p+1)}>Next</Button></Box></Box>}
    </Box><Dialog open={Boolean(dialog)} onClose={()=>setDialog(null)} fullWidth maxWidth="md"><DialogTitle>{dialog==='mapping'?'Manage store mappings':dialog==='select-map-product'?'Select product to map':dialog==='view'?'Details':dialog==='edit'?'Edit':'Create'} {dialog==='mapping'?form.name:titles[active]}</DialogTitle><DialogContent sx={{display:'grid',gridTemplateColumns:{md:'1fr 1fr'},gap:2,pt:'12px !important'}}>{(profileErrors.form||message)&&dialog!=='view'&&<Alert severity="error" sx={{gridColumn:'1 / -1'}}>{profileErrors.form||message}</Alert>}{dialog==='select-map-product'&&<Autocomplete options={catalogProducts.filter((product)=>String(product.status||'ACTIVE').toUpperCase()==='ACTIVE')} getOptionLabel={(product)=>String(product.name||product.title||product.id)+' ('+product.id+')'} value={catalogProducts.find((product)=>String(product.id)===String(mappingProductId))||null} onChange={(_,value)=>setMappingProductId(value?.id||'')} renderInput={(params)=><TextField {...params} label="Catalog product" helperText={productMappingsError||'Select a product to map to the Global Store or your assigned stores.'}/>} sx={{gridColumn:'1 / -1'}}/>}{dialog==='mapping'||dialog==='select-map-product'?null:dialog==='view'?Object.entries(form).filter(([key])=>!['id','password'].includes(key)&&!key.startsWith('_')).map(([key,value])=><Box key={key}><Typography variant="caption" color="text.secondary">{key}</Typography>{String(value).startsWith('data:image')?<img src={value} alt={key} style={{maxWidth:180,display:'block'}}/>:<Typography sx={{wordBreak:'break-word',whiteSpace:'pre-line'}}>{formatAdminOrderDetailValue(key,value)}</Typography>}</Box>):visibleFormFields.map(([key,label,type='text',required,options])=><Box key={key} sx={['osmLocation','radiusMap','checks','locationMap'].includes(type)?{gridColumn:'1 / -1'}:undefined}>{active==='inventory'?renderInventoryField(key,label,type,required,options):type==='radiusMap'?renderDeliveryZoneMap():type==='checks'?<Box><Typography fontWeight={700} mb={1}>{label}</Typography><Box sx={{display:'flex',gap:1,flexWrap:'wrap'}}>{options.map((option)=>{const checked=(form[key]||[]).includes(option);return <Button key={option} variant={checked?'contained':'outlined'} onClick={()=>setForm({...form,[key]:checked?(form[key]||[]).filter((item)=>item!==option):[...(form[key]||[]),option]})}>{option}</Button>;})}</Box>{errors[key]&&<Typography variant="caption" color="error">{errors[key]}</Typography>}</Box>:type==='locationMap'?(dialog==='view'?<Typography sx={{gridColumn:'1 / -1'}}>Saved coordinates: {form.latitude||'â€”'}, {form.longitude||'â€”'}</Typography>:<LocationMapPicker latitude={form.latitude} longitude={form.longitude} onCoordinatesChange={(latitude,longitude)=>setForm(current=>({...current,latitude,longitude}))} onApplyAddress={(place)=>setForm(current=>({...current,address:place.address||place.subtitle||current.address,city:place.city||current.city,state:place.state||current.state,country:place.country||current.country,pincode:place.pincode||current.pincode}))}/>):type==='osmLocation'?renderStoreLocationPicker():type==='lookup'?<Autocomplete freeSolo options={lookupOptions(key)} value={form[key]||''} onChange={(_,value)=>setForm({...form,[key]:value||''})} onInputChange={(_,value)=>setForm({...form,[key]:value})} renderInput={(params)=><TextField {...params} label={label} placeholder={`Search ${label.toLowerCase()}`}/>} />:type==='select'?<Select fullWidth displayEmpty value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})}><MenuItem value="" disabled>{label}</MenuItem>{options.map(option=><MenuItem key={option} value={option}>{option}</MenuItem>)}</Select>:type==='image'?<Box><Button component="label" variant="outlined">Select {label}<input hidden type="file" accept="image/*" onChange={e=>upload(key,e.target.files?.[0])}/></Button>{form[key]&&<Box><img src={form[key]} alt={`${label} preview`} style={{width:100,height:70,objectFit:'cover',display:'block',marginTop:8}}/><Button color="error" onClick={()=>setForm({...form,[key]:''})}>Remove</Button></Box>}</Box>:type==='images'?<Box><Button component="label" variant="outlined">Select {label}<input hidden multiple type="file" accept="image/*" onChange={e=>uploadMany(key,e.target.files)}/></Button><Box sx={{display:'flex',gap:1,mt:1}}>{(form[key]||[]).map((src,index)=><img key={index} src={src} alt={`${label} ${index+1}`} style={{width:70,height:55,objectFit:'cover'}}/>)}</Box>{form[key]?.length>0&&<Button color="error" onClick={()=>setForm({...form,[key]:[]})}>Remove All</Button>}</Box>:<TextField fullWidth label={label} required={required} type={type==='textarea'?'text':type} multiline={type==='textarea'} minRows={type==='textarea'?3:undefined} value={form[key]||''} onChange={e=>setForm({...form,[key]:e.target.value})} error={Boolean(errors[key])} helperText={errors[key]}/>}</Box>)}{active==='products'&&(user?.role==='super-admin'&&dialog!=='view'||user?.role==='global-admin'&&['mapping','create','edit'].includes(dialog)||user?.role==='location-admin'&&['mapping','create','edit'].includes(dialog))&&<Box sx={{gridColumn:'1 / -1',border:'1px solid #d8e4df',borderRadius:2,p:2,display:'grid',gap:1.5}}><Typography fontWeight={700}>{user?.role==='location-admin'?'Store availability in your assigned location':'Store availability and pricing'}</Typography>{productMappingsError&&<Alert severity="error">{productMappingsError}</Alert>}<Autocomplete multiple options={user?.role==='global-admin'?[{id:'global-store',name:'India-wide Global Store'}]:[...(user?.role==='location-admin'&&['create','edit'].includes(dialog)?backendStores.filter((store)=>store.id&&sameText(store.location,user.location)):user?.role==='location-admin'?knownStores().filter((store)=>store.id&&sameText(store.location,user.location)):knownStores().filter((store)=>store.id)),...productMappings.filter((mapping)=>!knownStores().some((store)=>String(store.id)===String(mapping.storeId))).map((mapping)=>({id:mapping.storeId,name:mapping.storeName||mapping.storeId}))]} getOptionLabel={(store)=>`${store.name||store.id} (${store.id})`} value={productMappingStoreIds.map((storeId)=>knownStores().find((store)=>String(store.id)===storeId)||(storeId==='global-store'?{id:'global-store',name:'Global Store'}:null)||productMappings.find((mapping)=>String(mapping.storeId)===storeId)&&({id:storeId,name:productMappings.find((mapping)=>String(mapping.storeId)===storeId)?.storeName||storeId})).filter(Boolean)} onChange={(_,value)=>setProductMappingStoreIds(value.map((store)=>String(store.id)))} renderInput={(params)=><TextField {...params} label="Mapped stores" placeholder="Select stores" helperText={productMappingsLoading?'Loading current mappings...':user?.role==='global-admin'?'Global products are assigned to Global Store only.':user?.role==='location-admin'?'Only stores in your assigned location are available.':'Select stores to assign; remove a selection to unassign.'}/>} disabled={productMappingsLoading||saving}/>{productMappingStoreIds.map((storeId)=>{if(user?.role==='location-admin'&&['create','edit'].includes(dialog))return <Typography key={storeId} variant="body2">{knownStores().find((store)=>String(store.id)===storeId)?.name||storeId}: included in this location product.</Typography>;const mapping=productMappings.find((item)=>String(item.storeId)===storeId);if(!mapping)return <Typography key={storeId} variant="body2">{knownStores().find((store)=>String(store.id)===storeId)?.name||storeId}: will be assigned when saved.</Typography>;const edit=productMappingEdits[storeId]||{available:mapping.available!==false,priceOverride:mapping.priceOverride??''};return <Box key={storeId} sx={{display:'flex',alignItems:'center',gap:1,flexWrap:'wrap'}}><Typography sx={{minWidth:160}}>{mapping.storeName||storeId}</Typography><Button size="small" variant={edit.available?'contained':'outlined'} onClick={()=>setProductMappingEdits((current)=>({...current,[storeId]:{...edit,available:!edit.available}}))}>{edit.available?'Available':'Unavailable'}</Button><TextField size="small" type="number" label="Price override" value={edit.priceOverride} onChange={(event)=>setProductMappingEdits((current)=>({...current,[storeId]:{...edit,priceOverride:event.target.value}}))} inputProps={{min:0,step:'0.01'}} helperText="Leave blank for product price."/></Box>;})}</Box>}</DialogContent><DialogActions sx={{justifyContent:'space-between',gap:1,flexWrap:'wrap'}}>{active==='orders'&&dialog==='view'&&form.id&&<Box sx={{display:'flex',gap:.75,flexWrap:'wrap'}}>{!isGlobalOrder(form)&&getOrderStatus(form)==='CREATED'&&<Button disabled={workflowBusy===`${form.id}:CONFIRM`} onClick={()=>serviceWorkflow(form,'CONFIRM')}>Confirm</Button>}{!isGlobalOrder(form)&&<Button disabled={workflowBusy===`${form.id}:PACKING`} onClick={()=>serviceWorkflow(form,'PACKING')}>Pack</Button>}{!isGlobalOrder(form)&&<Button disabled={workflowBusy===`${form.id}:READY`} onClick={()=>serviceWorkflow(form,'READY')}>Ready</Button>}{!isGlobalOrder(form)&&<Button disabled={workflowBusy===`${form.id}:SHIP`} onClick={()=>serviceWorkflow(form,'SHIP')}>Ship</Button>}{!isGlobalOrder(form)&&<Button disabled={workflowBusy===`${form.id}:OUT_FOR_DELIVERY`} onClick={()=>serviceWorkflow(form,'OUT_FOR_DELIVERY')}>Out</Button>}{!isGlobalOrder(form)&&<Button variant="contained" disabled={workflowBusy===`${form.id}:DELIVER`} onClick={()=>serviceWorkflow(form,'DELIVER')}>Delivered</Button>}</Box>}<Box sx={{display:'flex',gap:1,ml:'auto'}}><Button onClick={()=>setDialog(null)}>Cancel</Button>{dialog==='select-map-product'&&<Button variant="contained" disabled={!mappingProductId} onClick={continueProductMapping}>Continue</Button>}{dialog!=='view'&&dialog!=='select-map-product'&&<Button variant="contained" disabled={saving} onClick={save}>{saving?'Saving...':'Save'}</Button>}</Box></DialogActions></Dialog><Dialog open={profileDialog} onClose={()=>setProfileDialog(false)} fullWidth maxWidth="md"><DialogTitle>Profile & Settings</DialogTitle><DialogContent sx={{display:'grid',gridTemplateColumns:{md:'1fr 1fr'},gap:2,pt:'12px !important'}}><TextField label="Name" value={profileForm.name||''} onChange={(e)=>setProfileForm({...profileForm,name:e.target.value})} error={Boolean(profileErrors.name)} helperText={profileErrors.name}/><TextField label="Email" type="email" disabled={user?.role==='super-admin'||user?.role==='global-admin'} value={profileForm.email||''} onChange={(e)=>setProfileForm({...profileForm,email:e.target.value})} error={Boolean(profileErrors.email)} helperText={profileErrors.email}/><TextField label="Mobile number" disabled={user?.role==='super-admin'||user?.role==='global-admin'} value={profileForm.mobile||''} onChange={(e)=>setProfileForm({...profileForm,mobile:e.target.value})}/><TextField label="Location" value={profileForm.location||''} disabled={user?.role==='super-admin'||user?.role==='global-admin'||user?.role==='location-admin'||user?.role==='store-manager'} onChange={(e)=>setProfileForm({...profileForm,location:e.target.value})}/>{user?.role==='store-manager'&&<><TextField label="Store name" value={profileForm.store||''} onChange={(e)=>setProfileForm({...profileForm,store:e.target.value})} error={Boolean(profileErrors.store)} helperText={profileErrors.store}/><TextField label="Store phone number" value={profileForm.storePhone||''} onChange={(e)=>setProfileForm({...profileForm,storePhone:e.target.value})}/><TextField label="Store email" type="email" value={profileForm.storeEmail||''} onChange={(e)=>setProfileForm({...profileForm,storeEmail:e.target.value})}/><TextField label="Store address" multiline minRows={2} value={profileForm.storeAddress||''} onChange={(e)=>setProfileForm({...profileForm,storeAddress:e.target.value})}/><Select value={profileForm.delivery||'Yes'} onChange={(e)=>setProfileForm({...profileForm,delivery:e.target.value})}><MenuItem value="Yes">Delivery available</MenuItem><MenuItem value="No">Delivery unavailable</MenuItem></Select><Select value={profileForm.pickup||'Yes'} onChange={(e)=>setProfileForm({...profileForm,pickup:e.target.value})}><MenuItem value="Yes">Pickup available</MenuItem><MenuItem value="No">Pickup unavailable</MenuItem></Select><TextField label="Order radius in KM" type="number" value={profileForm.deliveryRadiusKm||''} onChange={(e)=>setProfileForm({...profileForm,deliveryRadiusKm:e.target.value})} error={Boolean(profileErrors.deliveryRadiusKm)} helperText={profileErrors.deliveryRadiusKm}/><TextField label="Delivery ETA minutes" type="number" value={profileForm.deliveryEtaMinutes||''} onChange={(e)=>setProfileForm({...profileForm,deliveryEtaMinutes:e.target.value})} error={Boolean(profileErrors.deliveryEtaMinutes)} helperText={profileErrors.deliveryEtaMinutes}/><TextField label="Delivery charge" type="number" value={profileForm.deliveryCharge||''} onChange={(e)=>setProfileForm({...profileForm,deliveryCharge:e.target.value})}/><TextField label="Free delivery above" type="number" value={profileForm.freeDeliveryAbove||''} onChange={(e)=>setProfileForm({...profileForm,freeDeliveryAbove:e.target.value})}/><TextField sx={{gridColumn:'1 / -1'}} label="Delivery modes" multiline minRows={2} value={profileForm.deliveryModes||''} onChange={(e)=>setProfileForm({...profileForm,deliveryModes:e.target.value})}/><TextField sx={{gridColumn:'1 / -1'}} label="Delivery notes" multiline minRows={2} value={profileForm.deliveryNotes||''} onChange={(e)=>setProfileForm({...profileForm,deliveryNotes:e.target.value})}/></>}{user?.role!=='store-manager'&&<><Typography sx={{gridColumn:'1 / -1',fontWeight:800}}>Change password</Typography><TextField label="Current password" type="password" disabled={user?.role==='super-admin'||user?.role==='global-admin'} value={profileForm.currentPassword||''} onChange={(e)=>setProfileForm({...profileForm,currentPassword:e.target.value})} error={Boolean(profileErrors.form)} helperText={profileErrors.form}/><TextField label="New password" type="password" disabled={user?.role==='super-admin'||user?.role==='global-admin'} value={profileForm.newPassword||''} onChange={(e)=>setProfileForm({...profileForm,newPassword:e.target.value})} error={Boolean(profileErrors.newPassword)} helperText={profileErrors.newPassword}/><TextField label="Confirm password" type="password" disabled={user?.role==='super-admin'||user?.role==='global-admin'} value={profileForm.confirmPassword||''} onChange={(e)=>setProfileForm({...profileForm,confirmPassword:e.target.value})} error={Boolean(profileErrors.confirmPassword)} helperText={profileErrors.confirmPassword}/></>}</DialogContent><DialogActions><Button onClick={()=>setProfileDialog(false)}>Cancel</Button><Button variant="contained" disabled={saving} onClick={saveProfile}>{saving?'Saving...':'Save Profile'}</Button></DialogActions></Dialog><Dialog open={Boolean(assignment)} onClose={()=>setAssignment(null)} fullWidth maxWidth="sm"><DialogTitle>Assign delivery partner</DialogTitle><DialogContent><Typography mb={2}>Choose an active partner for {assignment?.id}.</Typography><Autocomplete options={collectionStore.list('delivery').filter((item)=>item.status==='Active')} getOptionLabel={(item)=>`${item.name} â€” ${item.vehicleNumber||item.vehicle} (${item.location})`} value={collectionStore.list('delivery').find((item)=>item.id===partnerId)||null} onChange={(_,value)=>setPartnerId(value?.id||'')} renderInput={(params)=><TextField {...params} label="Search delivery partner"/>}/></DialogContent><DialogActions><Button onClick={()=>setAssignment(null)}>Cancel</Button><Button variant="contained" disabled={!partnerId} onClick={assignOrder}>Assign order</Button></DialogActions></Dialog><Dialog open={Boolean(confirm)} onClose={()=>setConfirm(null)}><DialogTitle>{confirm?.passwordReset?'Reset staff password':'Confirm action'}</DialogTitle><DialogContent>{confirm?.passwordReset?<><Typography sx={{mb:2}}>Set a new temporary password for {confirm.name||confirm.username}. They will use it at their next sign in.</Typography><TextField fullWidth autoFocus type="password" label="New temporary password" value={passwordResetValue} onChange={(event)=>setPasswordResetValue(event.target.value)} helperText="Use at least 8 characters."/></>:<Typography>{confirm?.orderReject?'Reject this order?':active==='users'?'Permanently delete this staff account and its staff memberships? This cannot be undone.':active==='products'&&user?.role==='location-admin'?'Permanently delete this location-owned product, its assigned stores, variants, and images? This cannot be undone.':'Delete this record? This action updates local data immediately.'}</Typography>}</DialogContent><DialogActions><Button onClick={()=>setConfirm(null)}>Cancel</Button><Button color="error" variant="contained" disabled={saving||Boolean(confirm?.passwordReset&&passwordResetValue.length<8)} onClick={()=>confirm?.orderReject?(orderStatus(confirm,'CANCELLED'),setConfirm(null)):confirm?.passwordReset?resetStaffPassword():remove()}>{confirm?.passwordReset?'Reset Password':'Confirm'}</Button></DialogActions></Dialog></Box>;
};
export default AdminWorkspace;

