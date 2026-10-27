import { useContext, useEffect, useState } from 'react';
import { Box, Button, Chip, InputAdornment, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../../components/Header/Header';
import BottomNav from '../../components/BottomNav/BottomNav';
import ProductCard from '../../components/ProductCard/ProductCard';
import CampaignCarousel from '../../components/CampaignCarousel/CampaignCarousel';
import { AppContext } from '../../context/AppContext';
import { promotionApplies } from '../../services/promotionScope';
import { getCachedStoreDeliveryQuote, getPublicStoreProducts } from '../../services/catalogApi';
import { adaptStoreProductList } from '../../services/catalogAdapter';
import { deliverySummary, isGlobalProduct, isGlobalStore, isProductEligibleForStore, storeDeliversTo } from '../../utils/storeDelivery';
import StoreServiceAreaMap from '../../components/StoreServiceAreaMap/StoreServiceAreaMap';
import './StorePage.css';

const lineStringCoordinates = (geometry) => {
  if (!geometry) return [];
  if (geometry.type === 'LineString' && Array.isArray(geometry.coordinates)) return geometry.coordinates;
  if (geometry.type === 'MultiLineString' && Array.isArray(geometry.coordinates)) return geometry.coordinates.flat();
  return [];
};

const StorePage = () => {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const { userCity, catalogProducts, catalogBanners, formatCurrency, addresses, selectedLocation, setShowLocationModal, catalogStores, catalogLoading, deliveryMode, setDeliveryMode, cartCount, selectStore } = useContext(AppContext);
  const [storeProducts, setStoreProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    let ignore = false;
    getPublicStoreProducts(storeId, { status: 'ACTIVE' })
      .then((payload) => {
        if (!ignore) setStoreProducts(adaptStoreProductList(payload || []).map((item) => ({ ...item, storeId: item.storeId || storeId })));
      })
      .catch(() => {
        if (!ignore) setStoreProducts([]);
      });
    return () => { ignore = true; };
  }, [storeId]);

  const store = catalogStores.find((item) => item.id === storeId) || null;
  const globalStore = isGlobalStore(store);
  useEffect(() => {
    if (store?.id) selectStore(store);
  }, [store?.id, store?.name]); // eslint-disable-line react-hooks/exhaustive-deps
  const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0] || {};
  const customerLat = Number(selectedLocation?.latitude ?? defaultAddress.coordinates?.lat ?? defaultAddress.latitude);
  const customerLng = Number(selectedLocation?.longitude ?? defaultAddress.coordinates?.lng ?? defaultAddress.longitude);
  useEffect(() => {
    if (!storeId || !Number.isFinite(customerLat) || !Number.isFinite(customerLng)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuote(null);
      return undefined;
    }
    let ignore = false;
    getCachedStoreDeliveryQuote(storeId, { latitude:customerLat, longitude:customerLng })
      .then((payload) => { if (!ignore) setQuote(payload); })
      .catch(() => { if (!ignore) setQuote(null); });
    return () => { ignore = true; };
  }, [storeId, customerLat, customerLng]);
  const banners = store ? catalogBanners.filter((item) => item.status === 'Active' && item.image && promotionApplies(item, { location: store.location, store: store.name })) : [];
  const mappedProductIds = new Set(storeProducts.filter((item) => item.storeId === storeId && item.status !== 'INACTIVE' && item.available !== false).map((item) => item.productId));
  const mappedProducts = storeProducts
    .filter((item) => item.product)
    .map((item) => ({ ...item.product, storeId: item.storeId, store: item.storeName || store?.name, storeName: item.storeName || store?.name }));
  const products = store ? [
    ...mappedProducts.filter((product) => isProductEligibleForStore(product, store)),
    ...catalogProducts.filter((item) => mappedProductIds.has(item.productId) || item.storeId === storeId || item.store === store.name || item.storeName === store.name || (globalStore && isGlobalProduct(item)))
      .filter((product) => isProductEligibleForStore(product, store)),
  ].filter((product, index, items) => product.active !== false && items.findIndex((item) => (item.productId ?? item.id) === (product.productId ?? product.id)) === index) : [];
  const normalizedProductSearch = productSearch.trim().toLowerCase();
  const visibleProducts = normalizedProductSearch
    ? products.filter((product) => [product.title, product.name, product.description, product.category?.name || product.category, product.sku]
      .some((value) => String(value || '').toLowerCase().includes(normalizedProductSearch)))
    : products;

  if (catalogLoading) return <Box className="store-page"><Header /><Typography>Loading store...</Typography></Box>;
  if (!store) return <Box className="store-page"><Header /><Box className="store-empty"><Typography variant="h6">Store not found</Typography><Button onClick={() => navigate('/home')}>Return home</Button></Box><BottomNav /></Box>;

  if (!globalStore && !storeDeliversTo(store, selectedLocation)) return <Box className="store-page"><Header /><Box className="store-empty"><Typography variant="h6">This store does not deliver to your selected location.</Typography><Button onClick={() => setShowLocationModal(true)}>Change location</Button><Button onClick={() => navigate('/home')}>See available stores</Button></Box><BottomNav /></Box>;

  const delivery = deliverySummary(store, formatCurrency);
  const quoteMethods = quote?.methods || [];
  const quoteEta = quote?.estimatedDeliveryMin && quote?.estimatedDeliveryMax ? `${quote.estimatedDeliveryMin}-${quote.estimatedDeliveryMax} min` : '';
  const quoteZone = quote?.matchedZoneLabel ? `${quote.matchedZoneLabel} service area` : '';
  const deliveryModes = quoteMethods.filter((method) => method.available !== false).map((method) => ({
    name: method.deliveryType,
    label: [method.deliveryType, method.estimatedTime, Number(method.deliveryCharge || 0) > 0 ? formatCurrency(method.deliveryCharge) : 'Free'].filter(Boolean).join(' - '),
  }));
  const lat = Number(store.latitude);
  const lng = Number(store.longitude);
  const hasMapPoint = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const routePoints = lineStringCoordinates(quote?.routeGeometry);
  const customerPoint = Number.isFinite(customerLat) && Number.isFinite(customerLng) && Math.abs(customerLat) <= 90 && Math.abs(customerLng) <= 180 ? { latitude: customerLat, longitude: customerLng } : null;
  const deliveryLocationLabel = selectedLocation?.address || selectedLocation?.subtitle || selectedLocation?.title || defaultAddress.address || '';
  const deliveryChargeLabel = quote?.deliveryCharge != null ? formatCurrency(quote.deliveryCharge) : delivery.chargeLabel;
  const serviceMethodsLabel = quoteMethods.length ? quoteMethods.map((method) => method.deliveryType).join(', ') : delivery.modesLabel;

  return <Box className="store-page">
    <Header />
    <Box className="store-banner">
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>Back</Button>
      <Box className="store-heading"><StorefrontOutlinedIcon /><Box><Typography variant="h5">{store.name}</Typography><Typography>{store.address || store.location || userCity}</Typography></Box></Box>
      <Box className="store-badges">
        {quote?.distanceKm && <Chip label={`${quote.distanceKm} KM by road`} />}
        {quote?.routeDurationMinutes && <Chip label={`Road travel ~${quote.routeDurationMinutes} min`} />}
        {store.delivery !== 'No' && <Chip label={quote?.deliveryAvailable ? 'Delivery available' : delivery.radiusLabel} />}
        {store.delivery !== 'No' && <Chip label={quoteEta || delivery.etaLabel} />}
        {store.delivery !== 'No' && <Chip label={quote?.deliveryCharge != null ? `${formatCurrency(quote.deliveryCharge)} delivery charge` : delivery.chargeLabel} />}
        {store.pickup === 'Yes' && <Chip label="Pickup available" />}
      </Box>
      <Box sx={{ display:'flex', gap:1, mt:2, alignItems:'center', flexWrap:'wrap' }}>
        <Button variant={deliveryMode === 'delivery' ? 'contained' : 'outlined'} disabled={store.delivery === 'No'} onClick={() => setDeliveryMode('delivery')}>Delivery</Button>
        <Button variant={deliveryMode === 'pickup' ? 'contained' : 'outlined'} disabled={store.pickup === 'No'} onClick={() => setDeliveryMode('pickup')}>Pick-up</Button>
        <Button sx={{ ml:{ xs:0, sm:'auto' } }} variant="contained" color="success" onClick={() => navigate('/cart')}>View basket · {cartCount}</Button>
      </Box>
    </Box>
    <CampaignCarousel banners={banners} onNavigate={navigate} />
    <Box className="store-service-panel">
      <Box className="store-service-content">
        <Box className="store-service-heading">
          <Box className="store-service-heading-icon"><PlaceOutlinedIcon /></Box>
          <Box><Typography variant="h6">Store service area</Typography><Typography>{store.name}</Typography></Box>
          <Chip label={delivery.radiusLabel} size="small" />
        </Box>
        <Typography className="store-service-address">{store.address || [store.area, store.city || store.location, store.state, store.pincode].filter(Boolean).join(', ')}</Typography>
        {deliveryLocationLabel && <Typography className="store-selected-location">Delivering to: {deliveryLocationLabel}</Typography>}
        <Box className="store-service-metrics">
          <Box><AccessTimeOutlinedIcon /><span><small>Delivery time</small><b>{quoteEta || delivery.etaLabel}</b></span></Box>
          <Box><LocalShippingOutlinedIcon /><span><small>Delivery fee</small><b>{deliveryChargeLabel}</b></span></Box>
          <Box><PaymentsOutlinedIcon /><span><small>Free delivery</small><b>{delivery.freeLabel.replace('Free ', '')}</b></span></Box>
        </Box>
        {(quoteZone || quote?.distanceKm || quote?.routeDurationMinutes) && <Typography className="store-service-quote">{[quoteZone, quote?.distanceKm ? `${quote.distanceKm} km by road` : '', quote?.routeDurationMinutes ? `~${quote.routeDurationMinutes} min drive` : ''].filter(Boolean).join(' · ')}</Typography>}
        {store.deliveryNotes && <Typography className="store-service-notes">{store.deliveryNotes}</Typography>}
        {deliveryModes.length > 0 && <Box className="store-service-modes">{deliveryModes.map((mode) => <Chip key={mode.name} label={mode.label} size="small" />)}</Box>}
        {!deliveryModes.length && <Typography className="store-service-methods">Service types: {serviceMethodsLabel}</Typography>}
      </Box>
      {hasMapPoint ? <StoreServiceAreaMap
        key={`${store.id}:${customerPoint?.latitude ?? ''}:${customerPoint?.longitude ?? ''}`}
        store={store}
        radiusKm={store.deliveryRadiusKm}
        routePoints={routePoints}
        customerPoint={customerPoint}
      /> : <Box className="store-radius-map store-map-empty">Store coordinates are not available for this map.</Box>}
    </Box>
    <Box className="store-products">
      <Box className="store-products-toolbar">
        <Typography variant="h6">Products in this store ({visibleProducts.length})</Typography>
        <TextField
          className="store-product-search"
          size="small"
          value={productSearch}
          onChange={(event) => setProductSearch(event.target.value)}
          placeholder="Search products in this store"
          inputProps={{ 'aria-label': 'Search products in this store' }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlinedIcon /></InputAdornment> }}
        />
      </Box>
      {visibleProducts.length ? <Box className="store-product-grid">{visibleProducts.map((product) => <ProductCard key={product.productId || product.id} {...product} storeId={store.id} store={store.name} storeName={store.name} deliveryQuote={quote} deliveryMode={deliveryMode} />)}</Box> : <Box className="store-empty"><Typography>{normalizedProductSearch ? `No products match “${productSearch.trim()}” in this store.` : 'No products are currently assigned to this store.'}</Typography></Box>}
    </Box>
    <BottomNav />
  </Box>;
};

export default StorePage;
