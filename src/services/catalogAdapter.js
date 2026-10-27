import { numericValue } from '../utils/productBrowsing.js';
import { normalizeProductImageUrl, normalizeWeightLabel, parseVariantAttributes, variantChoiceLabel } from '../utils/productVariantData.js';
import { bannerImageFor, categoryImageFor, productImageFor } from './categoryImages';
export { parseVariantAttributes, variantChoiceLabel } from '../utils/productVariantData.js';

const safeImageUrl = normalizeProductImageUrl;

const asArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return [value];
};

const normaliseStatus = (value) => {
  if (!value) return 'ACTIVE';
  const text = String(value).toUpperCase();
  if (['ACTIVE', 'PUBLISHED', 'AVAILABLE'].includes(text)) return 'ACTIVE';
  if (['INACTIVE', 'DRAFT', 'DISABLED'].includes(text)) return 'INACTIVE';
  return text;
};

const pickPrice = (value) => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const firstImageUrl = (images = []) => {
  const primary = images.find((item) => item.primaryImage || item.isPrimary) || images[0];
  return safeImageUrl(primary?.url || primary?.imageUrl || primary?.path);
};

const extractWeight = (variant, fallback) => {
  const candidate = parseVariantAttributes(variant?.attributes);
  const weight = candidate.weight || candidate.size || candidate.label || candidate.name || candidate.variantName || variant?.name || fallback || '';
  return String(weight).trim();
};

const subcategoryName = (product = {}) => {
  const candidate = product.subcategory ?? product.subCategory
    ?? product.subcategoryName ?? product.subCategoryName
    ?? product.metadata?.subcategory ?? product.attributes?.subcategory;
  if (candidate && typeof candidate === 'object') return candidate.name || candidate.title || '';
  return String(candidate || '').trim();
};

export const adaptCategory = (category) => ({
  id: category.id || category.categoryId || category.slug || category.name,
  name: category.name || category.title || 'Category',
  title: category.title || category.name || 'Category',
  image: categoryImageFor(category) || safeImageUrl(category.thumbnailUrl || category.image || category.imageUrl || category.thumbnail),
  thumbnailUrl: categoryImageFor(category) || safeImageUrl(category.thumbnailUrl || category.image || category.imageUrl || category.thumbnail),
  description: category.description || '',
  status: normaliseStatus(category.status),
  active: normaliseStatus(category.status) !== 'INACTIVE',
  sortOrder: Number(category.sortOrder ?? category.displayOrder ?? 0),
  slug: category.slug || category.name,
  parentCategoryId: category.parentCategoryId || category.parentId || null,
});

export const adaptVariant = (variant, fallbackProduct = {}) => {
  const attributes = parseVariantAttributes(variant?.attributes);
  const price = pickPrice(variant?.price ?? variant?.sellingPrice ?? variant?.mrp ?? 0);
  const compareAt = pickPrice(variant?.compareAtPrice ?? variant?.mrp ?? variant?.price ?? 0);
  const id = variant?.variantId || variant?.id || null;
  const label = variantChoiceLabel({ ...variant, attributes }) || variant?.name || attributes.weight || attributes.size || '';
  return {
    id,
    variantId: id,
    productId: variant?.productId || fallbackProduct.productId || fallbackProduct.id || null,
    sku: variant?.sku || fallbackProduct.sku || '',
    name: variant?.name || extractWeight(variant, fallbackProduct.weight || ''),
    label,
    price,
    priceKnown: numericValue(variant?.price ?? variant?.sellingPrice ?? variant?.mrp) !== null,
    attributes,
    active: variant?.active ?? true,
    weight: normalizeWeightLabel(extractWeight(variant, fallbackProduct.weight || '')),
    image: safeImageUrl(variant?.image || fallbackProduct.image),
    compareAtPrice: compareAt > price ? compareAt : price,
  };
};

export const adaptImage = (image, productId) => {
  const url = safeImageUrl(typeof image === 'string' ? image : image?.url || image?.imageUrl || image?.path);
  const displayOrder = Number(image?.displayOrder ?? 0);
  return {
    id: image?.id || image?.imageId || `${productId || 'product'}-image-${displayOrder}-${url}`,
    productId: image?.productId || productId || null,
    url,
    altText: image?.altText || image?.caption || '',
    displayOrder,
    primaryImage: Boolean(image?.primaryImage ?? image?.isPrimary),
  };
};

export const adaptStoreProduct = (storeProduct) => {
  const storeId = storeProduct?.storeId || storeProduct?.store?.id || null;
  const storeName = storeProduct?.storeName || storeProduct?.store?.name || '';
  const adaptedProduct = storeProduct?.product ? adaptProduct(storeProduct.product) : null;
  return {
    id: storeProduct?.id || storeProduct?.mappingId || storeProduct?.storeProductId || null,
    storeId,
    storeName,
    productId: storeProduct?.productId || storeProduct?.product?.id || null,
    product: adaptedProduct ? { ...adaptedProduct, storeId, store: storeName, storeName } : null,
    available: storeProduct?.available ?? true,
    priceOverride: pickPrice(storeProduct?.priceOverride ?? storeProduct?.overridePrice),
    status: storeProduct?.status || 'ACTIVE',
  };
};

// Location master records use the Catalog store endpoint as their durable store,
// with an explicit ID prefix so they never appear as retail stores.
export const adaptLocation = (location = {}) => ({
  ...location,
  id: location.id || location.storeId,
  name: location.name || location.title || '',
  code: location.code || location.storeCode || '',
  address: location.address || '',
  city: location.city || '',
  state: location.state || '',
  country: location.country || '',
  pincode: location.pincode || '',
  latitude: location.latitude,
  longitude: location.longitude,
  phone: location.phone || '',
  email: location.email || '',
  admin: location.adminName || location.admin || '',
  status: location.status || (location.active === false ? 'Inactive' : 'Active'),
  _isLocationRecord: true,
});

export const isLocationRecord = (record = {}) => String(record.id || '').startsWith('location-');
export const adaptLocationList = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.content || payload?.items || payload?.data || [];
  return items.filter(isLocationRecord).map(adaptLocation);
};

export const adaptProduct = (product) => {
  const variants = asArray(product?.variants || product?.variantList || product?.items).map((variant) => adaptVariant(variant, product));
  const productId = product?.productId || product?.id || product?.slug || product?.sku || product?.name;
  const images = asArray(product?.images || product?.imageList || product?.gallery || product?.productImages).map((image) => adaptImage(image, productId));
  const primaryImage = firstImageUrl(images) || safeImageUrl(product?.image || product?.thumbnail || product?.featuredImage) || productImageFor(product);
  const categoryName = product?.category?.name || product?.categoryName || product?.category || product?.categoryId || 'General';
  const variant = variants[0] || {
    id: product?.variantId || product?.defaultVariantId || null,
    variantId: product?.variantId || product?.defaultVariantId || null,
    productId,
    sku: product?.sku || product?.productCode || '',
    name: product?.name || product?.title || 'Default',
    label: product?.name || product?.title || 'Default',
    price: pickPrice(product?.price ?? product?.offerPrice ?? 0),
    priceKnown: numericValue(product?.price ?? product?.offerPrice) !== null,
    compareAtPrice: pickPrice(product?.compareAtPrice ?? product?.price ?? 0),
    attributes: product?.attributes || {},
    active: true,
    weight: product?.weight || '500g',
  };

  return {
    id: productId,
    productId,
    name: product?.name || product?.title || 'Product',
    title: product?.title || product?.name || 'Product',
    subtitle: product?.subtitle || [product?.brand, categoryName].filter(Boolean).join(' · '),
    slug: product?.slug || product?.name,
    category: categoryName,
    categoryId: product?.category?.id || product?.categoryId || null,
    subcategory: subcategoryName(product),
    description: product?.description || '',
    brand: product?.brand || '',
    ingredients: product?.ingredients || '',
    specifications: product?.specifications || '',
    pack: product?.pack || '',
    type: product?.type || '',
    shelfLife: product?.shelfLife || '',
    tags: product?.tags ? String(product.tags).split(',').map((tag) => tag.trim()).filter(Boolean) : [],
    highlights: product?.highlights ? String(product.highlights).split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean) : [],
    aboutSource: product?.aboutSource || '',
    status: normaliseStatus(product?.status),
    active: normaliseStatus(product?.status) !== 'INACTIVE',
    image: primaryImage,
    images: images.map((image) => image.url).filter(Boolean),
    gallery: images.map((image) => image.url).filter(Boolean),
    price: pickPrice(variant?.price ?? 0),
    priceKnown: variant.priceKnown,
    offerPrice: pickPrice(variant?.price ?? 0),
    compareAtPrice: pickPrice(variant?.compareAtPrice ?? variant?.price ?? 0),
    sku: variant?.sku || product?.sku || product?.productCode || '',
    weight: normalizeWeightLabel(variant?.weight || extractWeight(variant, product?.weight || '500g')),
    variantId: variant?.variantId || variant?.id || null,
    variants: variants.length ? variants : [variant],
    catalogVariants: variants,
    catalogVariantsKnown: Array.isArray(product?.variants) || Array.isArray(product?.variantList),
    attributes: product?.attributes || {},
    metadata: product?.metadata || {},
    storeId: product?.storeId || product?.store?.id || (product?.globalProduct === true || product?.fulfillmentType === 'global' ? 'global-store' : null),
    store: product?.store || product?.storeName || product?.store?.name || (product?.globalProduct === true || product?.fulfillmentType === 'global' ? 'India-wide Global Store' : ''),
    storeName: product?.storeName || product?.store || product?.store?.name || (product?.globalProduct === true || product?.fulfillmentType === 'global' ? 'India-wide Global Store' : ''),
    pickup: product?.pickupEnabled ?? product?.pickup ?? product?.store?.pickupEnabled ?? product?.store?.pickup,
    deliveryLabel: product?.deliveryLabel || (product?.globalProduct === true || product?.fulfillmentType === 'global' ? '7–10 days delivery' : undefined),
    deliveryQuote: product?.deliveryQuote,
    deliveryRadiusKm: product?.deliveryRadiusKm ?? product?.store?.deliveryRadiusKm ?? null,
    deliveryEtaMinutes: product?.deliveryEtaMinutes ?? product?.deliveryMinutes ?? product?.store?.deliveryEtaMinutes ?? null,
    deliveryCharge: product?.deliveryCharge ?? product?.store?.deliveryCharge ?? null,
    freeDeliveryAbove: product?.freeDeliveryAbove ?? product?.store?.freeDeliveryAbove ?? null,
    deliveryModes: product?.deliveryModes || product?.store?.deliveryModes || '',
    deliveryNotes: product?.deliveryNotes || product?.store?.deliveryNotes || '',
    available: product?.available ?? true,
    globalProduct: product?.globalProduct === true,
    rating: product?.rating || 0,
    featured: (product?.featured ?? false) ? 'Yes' : 'No',
    special: (product?.special ?? false) ? 'Yes' : 'No',
    newArrival: (product?.newArrival ?? product?.new_arrival ?? false) ? 'Yes' : 'No',
    bestSeller: (product?.bestSeller ?? product?.best_seller ?? false) ? 'Yes' : 'No',
    createdAt: product?.createdAt || null,
  };
};

export const adaptProductList = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.content || payload?.items || payload?.data || payload?.products || [];
  return items.map((product) => adaptProduct(product));
};

export const adaptCategoryList = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.content || payload?.items || payload?.data || payload?.categories || [];
  return items.map((category) => adaptCategory(category));
};

const BANNER_STATUS = { ACTIVE: 'Active', SCHEDULED: 'Scheduled', INACTIVE: 'Inactive' };
const BANNER_SCOPE = { GLOBAL: 'Global', LOCATION: 'Location', STORE: 'Store' };

export const adaptBanner = (banner = {}) => ({
  id: banner.id || banner.bannerId,
  name: banner.title || banner.name || 'Banner',
  title: banner.title || banner.name || 'Banner',
  description: banner.description || '',
    image: safeImageUrl(banner.imageUrl || banner.image) || bannerImageFor(banner),
    mobileImage: safeImageUrl(banner.mobileImageUrl || banner.mobileImage) || safeImageUrl(banner.imageUrl || banner.image) || bannerImageFor(banner),
  targetUrl: banner.targetUrl || '',
  sortOrder: Number(banner.sortOrder ?? 0),
  status: BANNER_STATUS[String(banner.status || '').toUpperCase()] || banner.status || 'Active',
  scope: BANNER_SCOPE[String(banner.scope || '').toUpperCase()] || banner.scope || 'Global',
  location: banner.locationId || banner.location || '',
  store: banner.storeId || banner.store || '',
  startDate: banner.startsOn || banner.startDate || '',
  endDate: banner.endsOn || banner.endDate || '',
  active: String(banner.status || '').toUpperCase() !== 'INACTIVE',
});

export const adaptBannerList = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.content || payload?.items || payload?.data || payload?.banners || [];
  return items.map((banner) => adaptBanner(banner));
};

export const adaptStoreProductList = (payload) => {
  const items = Array.isArray(payload) ? payload : payload?.content || payload?.items || payload?.data || payload?.storeProducts || payload?.value || [];
  return items.map((storeProduct) => adaptStoreProduct(storeProduct));
};
