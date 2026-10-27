import { useContext, useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, Chip, IconButton } from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { getCachedStoreDeliveryQuote } from '../../services/catalogApi';
import { deliverySummary } from '../../utils/storeDelivery';
import fallbackProductImage from '../../assets/images/mango_pickle_jar.png';
import './ProductCard.css';
import { getPublicInventoryAvailability } from '../../services/inventoryApi';
import { loadProductStock } from '../../utils/productStock.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dbVariantId = (value) => UUID_PATTERN.test(String(value || '')) ? value : null;

const ProductCard = ({ title, weight, price, image, ...details }) => {
  const navigate = useNavigate();
  const { cartItems, addToCart, updateQuantity, setSelectedProduct, wishlistItems, toggleWishlist, formatCurrency, sameCatalogItem, addresses, selectedLocation, catalogStores, t, user, cartLoading } = useContext(AppContext);
  const cardImage = image || '';
  const [imageSrc, setImageSrc] = useState(cardImage || fallbackProductImage);
  const productVariants = (Array.isArray(details.variants) && details.variants.length ? details.variants : [details.selectedVariant || details]).filter((variant) => variant?.active !== false);
  const productVariantsRef = useRef(productVariants);
  useEffect(() => { productVariantsRef.current = productVariants; }, [productVariants]);
  const baseVariant = details.selectedVariant || productVariants[0] || {};
  const productId = details.productId || details.id || baseVariant.productId;
  const variantScope = productVariants.map((variant) => `${variant.variantId || variant.id || 'product'}:${variant.active !== false}`).join(',');
  const [availableVariantResult, setAvailableVariantResult] = useState(null);
  const [stock, setStock] = useState(null);
  const [stockAttempt, setStockAttempt] = useState(0);
  const stockStoreId = catalogStores.find((item) => details.storeId ? item.id === details.storeId : item.name === details.store || item.name === details.storeName)?.id || details.storeId;
  const stockScope = `${user?.id}:${stockStoreId}:${productId}:${variantScope}`;
  const stockForScope = stock?.scope === stockScope && stock?.attempt === stockAttempt ? stock : null;
  const selectedVariant = availableVariantResult?.scope === stockScope ? availableVariantResult.variant : baseVariant;
  const variantId = selectedVariant.variantId ?? selectedVariant.id ?? details.variantId ?? null;
  const hasProductIdentity = Boolean(productId) && variantId !== undefined;
  const store = catalogStores.find((item) => details.storeId ? item.id === details.storeId : item.name === details.store || item.name === details.storeName);
  const delivery = deliverySummary(store || details, formatCurrency);
  const [cardQuote, setCardQuote] = useState(null);
  const defaultAddress = addresses.find((address) => address.isDefault) || addresses[0] || {};
  const customerLat = Number(selectedLocation?.latitude ?? defaultAddress.coordinates?.lat ?? defaultAddress.latitude);
  const customerLng = Number(selectedLocation?.longitude ?? defaultAddress.coordinates?.lng ?? defaultAddress.longitude);
  const quoteScope = `${store?.id || details.storeId}:${customerLat}:${customerLng}`;
  const cardRef = useRef(null);
  const [inView, setInView] = useState(typeof IntersectionObserver === 'undefined');
  useEffect(() => {
    if (!inView || !stockStoreId || !productId) return undefined;
    let active = true;
    (async () => {
      let firstUnavailable = null;
      let lookupFailed = false;
      for (const variant of productVariantsRef.current) {
        const candidateId = variant.variantId ?? variant.id ?? null;
        const result = await loadProductStock(getPublicInventoryAvailability, { storeId: stockStoreId, productId, variantId: dbVariantId(candidateId) });
        if (!active) return;
        if (result.state === 'available') {
          setAvailableVariantResult({ scope: stockScope, variant });
          setStock({ scope: stockScope, attempt: stockAttempt, ...result });
          return;
        }
        if (result.state === 'error') lookupFailed = true;
        if (!firstUnavailable) firstUnavailable = result;
      }
      if (active) setStock({ scope: stockScope, attempt: stockAttempt, ...(lookupFailed ? { state: 'error' } : firstUnavailable || { state: 'missing' }) });
    })();
    return () => { active = false; };
  }, [user?.id, inView, stockStoreId, productId, variantScope, stockScope, stockAttempt]);
  const currentStock = stockForScope;
  const checkingStock = Boolean(!currentStock);
  const stockError = Boolean(currentStock?.state === 'error');
  const noStock = Boolean(currentStock && currentStock.state !== 'available');
  useEffect(() => {
    const node = cardRef.current;
    if (!node || inView) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setInView(true); observer.disconnect(); }
    }, { rootMargin: '250px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);
  useEffect(() => {
    const quoteStoreId = store?.id || details.storeId;
    if (details.deliveryQuote || !inView || !quoteStoreId || !Number.isFinite(customerLat) || !Number.isFinite(customerLng)) return undefined;
    let ignore = false;
    getCachedStoreDeliveryQuote(quoteStoreId, { latitude:customerLat, longitude:customerLng })
      .then((payload) => { if (!ignore) setCardQuote({ scope: quoteScope, value: payload }); })
      .catch(() => { if (!ignore) setCardQuote({ scope: quoteScope, value: null }); });
    return () => { ignore = true; };
  }, [inView, details.deliveryQuote, details.storeId, store?.id, customerLat, customerLng, quoteScope]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setImageSrc(cardImage || fallbackProductImage);
  }, [cardImage]);
  const quote = details.deliveryQuote || (cardQuote?.scope === quoteScope ? cardQuote.value : null);
  const primaryMethod = quote?.methods?.find((method) => method.deliveryType === quote.selectedDeliveryMethod) || quote?.methods?.[0];
  const estimate = details.deliveryEstimate;
  const rawEtaLabel = details.deliveryLabel || (Object.hasOwn(details, 'deliveryEstimate')
    ? estimate ? `${estimate.min === estimate.max ? estimate.max : `${estimate.min}–${estimate.max}`} min delivery` : 'Delivery ETA not set'
    : delivery.etaLabel);
  const etaLabel = rawEtaLabel === 'Delivery ETA not set' || !rawEtaLabel ? 'Delivery estimate shown at checkout' : rawEtaLabel;
  const quoteDistance = Number(quote?.distanceKm);
  const quoteCharge = Number(primaryMethod?.deliveryCharge ?? quote?.deliveryCharge ?? 0);
  const deliveryLine = quote?.deliveryAvailable
    ? [Number.isFinite(quoteDistance) && quoteDistance > 0 ? `${quoteDistance} KM by road` : '', primaryMethod?.deliveryType || 'Delivery', primaryMethod?.estimatedTime || '', quoteCharge > 0 ? formatCurrency(quoteCharge) : 'Free delivery'].filter(Boolean).join(' | ')
    : quote?.deliveryAvailable === false ? 'Delivery unavailable' : `${etaLabel} | ${delivery.chargeLabel}`;

  const variantWeight = selectedVariant.weight || selectedVariant.label || weight;
  const variantPrice = selectedVariant.price ?? price;
  const product = { ...details, id: productId, productId, variantId, selectedVariant, title, name:details.name || title, weight:variantWeight, price: Number(variantPrice), image: cardImage, storeId:store?.id || details.storeId, store:store?.name || details.store || details.storeName };
  const cartItem = cartItems.find((item) => sameCatalogItem(item, product));
  const quantity = cartItem ? cartItem.quantity : 0;
  const isWishlisted = wishlistItems.some((item) => sameCatalogItem(item, product));

  if (user?.id && quantity === 0 && ['missing', 'out'].includes(currentStock?.state)) return null;

  const handleCardClick = () => {
    const resolvedProduct = {
      ...details,
      id: productId,
      productId,
      variantId,
      selectedVariant,
      title: title || details.name || 'Product',
      subtitle: details.subtitle || details.category || '',
      description: details.description || '',
      highlights: details.highlights || [],
      aboutSource: details.aboutSource || '',
      price: Number(variantPrice || 0),
      weight: variantWeight,
      weights: details.weights || [variantWeight || '250g'],
      image: cardImage,
      gallery: details.gallery || [],
      storeId: store?.id || details.storeId,
      store: store?.name || details.store || details.storeName,
      storeName: store?.name || details.storeName || details.store,
    };
    setSelectedProduct(resolvedProduct);
    const targetId = resolvedProduct.productId || resolvedProduct.id || title;
    navigate(`/product-info/${encodeURIComponent(targetId)}`, { state: { product: resolvedProduct } });
  };

  const handleAdd = (e) => {
    e.stopPropagation();
    if (!checkingStock && !noStock && hasProductIdentity && Number(product.price) > 0) addToCart(product);
  };

  const handleIncrement = (e) => {
    e.stopPropagation();
    if (!checkingStock && !noStock && hasProductIdentity && Number(product.price) > 0) addToCart(product);
  };

  const handleDecrement = (e) => {
    e.stopPropagation();
    updateQuantity(productId, variantId, -1, product.storeId);
  };

  return (
    <Box ref={cardRef} className="product-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <Box className="product-image-container">
        <img
          src={imageSrc}
          alt={title}
          className="product-card-img"
          onError={() => setImageSrc(fallbackProductImage)}
        />
        <IconButton
          aria-label={isWishlisted ? `Remove ${title} from wishlist` : `Add ${title} to wishlist`}
          onClick={(event) => { event.stopPropagation(); toggleWishlist(product); }}
          sx={{ position: 'absolute', top: 4, right: 4, color: isWishlisted ? '#ef4444' : '#64748b' }}
        >
          {isWishlisted ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
        </IconButton>
      </Box>
      <Box className="product-info">
        <Typography className="product-title">{title}</Typography>
        {(store?.name || details.storeName || details.store) && <Typography className="product-store-line">{store?.name || details.storeName || details.store}</Typography>}
        <Typography className="product-delivery-line">{deliveryLine}</Typography>
        {details.offerType==='Buy X Get Y'&&<Chip size="small" color="success" label={`Buy ${details.buyQuantity||1}, get ${details.freeQuantity||1} free`} sx={{my:.5}}/>}
        <Box className="product-actions">
          <Box className="product-details">
            <Typography className="product-weight">{variantWeight}</Typography>
            <Typography className="product-price">{Number(variantPrice) > 0 ? formatCurrency(variantPrice) : t('unavailable')}</Typography>
          </Box>
          {quantity === 0 ? (
            <Button variant="contained" className="add-btn" disabled={cartLoading || checkingStock || (noStock && !stockError) || details.active === false || !hasProductIdentity || !(Number(product.price) > 0)} onClick={(event) => { if (stockError) { event.stopPropagation(); setStockAttempt((attempt) => attempt + 1); } else handleAdd(event); }}>
              {stockError ? 'Check availability' : currentStock?.state === 'missing' ? t('out') : noStock || details.active === false || !hasProductIdentity || !(Number(product.price) > 0) ? t('out') : t('add')}
            </Button>
          ) : (
            <Box className="qty-control-box">
              <button type="button" className="qty-action-btn" disabled={cartLoading} onClick={handleDecrement}>
                -
              </button>
              <Typography className="qty-count-text">{quantity}</Typography>
              <button type="button" className="qty-action-btn" disabled={cartLoading || checkingStock || noStock} onClick={handleIncrement}>
                +
              </button>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default ProductCard;
