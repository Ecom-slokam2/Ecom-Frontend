import { translate, normalizeLanguage, languageCode } from '../i18n/index';
import { readLanguage, persistLanguage } from '../i18n/preferences';
import { customerAuthService } from '../services/customerAuthService';
import { orgAccessService } from '../services/orgAccessService';
import { createContext, useState, useEffect, useMemo, useRef } from 'react';
import { readSelectedLocation, storeSelectedLocation, clearSelectedLocation as resetSelectedLocation } from '../utils/selectedLocation';
import { customerProfileService } from '../services/customerProfileService';
import { getCustomerOrders, normalizeOrder, orderDeliveryAddress } from '../services/orderApi';
import { getProducts, getCategories, getCategoryProducts, getPublicStoreProducts, getStoreProducts, getStores, getBanners } from '../services/catalogApi';
import { adaptProductList, adaptCategoryList, adaptStoreProductList, adaptBannerList } from '../services/catalogAdapter';
import { addCartItem, calculateCartTotal, clearCartItems, createCart, getActiveCart, getActiveCarts, getCart, moveSavedCartItemToCart, removeCartItem, saveCartItemForLater, updateCartItem } from '../services/cartApi';
import { rememberProductStore, resolveProductStore } from '../services/productStoreResolver';
import { cleanDisplayText } from '../utils/textEncoding';
import { getPublicInventoryAvailability } from '../services/inventoryApi';
import { migrateGuestCart } from '../utils/migrateGuestCart.js';
import { loadCustomerCart } from '../utils/loadCustomerCart.js';
import { planCartLineMutation, sameCartLine } from '../utils/cartLineMutation.js';
import { mutateAuthenticatedCart } from '../utils/authenticatedCart.js';
import { mergeCartResponseItems } from '../utils/mergeCartResponseItems.js';
import { logCartDiagnostic, logCartSnapshot } from '../utils/cartDiagnostics.js';
import { validateCheckoutAvailability } from '../utils/checkoutAvailability';
import { isCustomerSession, resolveCustomerId } from '../utils/customerSession.js';

// eslint-disable-next-line react-refresh/only-export-components
export const AppContext = createContext();

const GUEST_CART_ID = 'guest-local-cart';
const cleanLocationText = (value) => String(value || '')
  .split(',')
  .map((part) => part.trim())
  .filter((part) => part && !/^undefined$/i.test(part) && !/^null$/i.test(part))
  .join(', ')
  .replace(/\s+/g, ' ')
  .trim();

const tokenCustomerId = () => {
  try {
    const token = sessionStorage.getItem('authToken') || '';
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.customerId || null;
  } catch { return null; }
};

export const AppProvider = ({ children }) => {
  const [sessionToken, setSessionToken] = useState(() => {
    try { return sessionStorage.getItem('authToken') || ''; }
    catch { return ''; }
  });
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    try {
      const token = sessionStorage.getItem('authToken');
      const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return claims.exp * 1000 > Date.now();
    } catch { return false; }
  });
  const [authReady, setAuthReady] = useState(() => !isLoggedIn);
  const [authError, setAuthError] = useState('');

  const guestCartItemsRef = useRef([]);
  const readGuestCartItems = () => guestCartItemsRef.current;
  const [cartItems, setCartItems] = useState([]);
  const [activeCart, setActiveCart] = useState(null);
  const [cartLoading, setCartLoading] = useState(false);
  const cartMutationPending = useRef(false);
  const cartHydrationRequest = useRef(0);
  const cartHydrationPromise = useRef(null);
  const [cartError, setCartError] = useState('');
  const [cartUnavailable, setCartUnavailable] = useState(false);

  const [user, setUser] = useState(null);
  const [wishlistItems, setWishlistItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [savedForLater, setSavedForLater] = useState([]);
  // Delivery addresses derived from this customer's previous orders (not persisted, refreshed on login).
  const [orderAddresses, setOrderAddresses] = useState([]);

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [catalogStoreProducts, setCatalogStoreProducts] = useState([]);
  const [catalogStores, setCatalogStores] = useState([]);
  const [catalogCategories, setCatalogCategories] = useState([]);
  const [catalogBanners, setCatalogBanners] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(() => readSelectedLocation());
  const [userCity, setUserCity] = useState(() => readSelectedLocation()?.city || '');
  const [homeSearchQuery, setHomeSearchQuery] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState(() => {
    const savedLocation = readSelectedLocation();
    return savedLocation ? cleanLocationText(savedLocation.address || [savedLocation.title, savedLocation.city].filter(Boolean).join(', ')) : '';
  });
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [deliveryMode, setDeliveryModeState] = useState('delivery');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const setDeliveryMode = (mode) => {
    const next = mode === 'pickup' ? 'pickup' : 'delivery';
    setDeliveryModeState(next);
  };

  const cartCount = cartItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const localCartTotal = (items = cartItems) => items.reduce((sum, item) => sum + Number(item.price || item.unitPrice || 0) * Number(item.quantity || 0), 0);
  // activeCart represents only one store. Sum visible lines for a multi-store cart.
  const cartTotal = localCartTotal();
  const activeCustomerId = useMemo(() => resolveCustomerId({ role: user?.role, tokenCustomerId: tokenCustomerId(), userId: user?.id }), [user?.id, user?.role]);
  const currentCustomerId = () => activeCustomerId;

  const resolveProductIdentity = (product) => {
    const variant = product?.variant || product?.selectedVariant || product?.variants?.[0] || {};
    return {
      productId: product?.productId || product?.id || variant?.productId || null,
      variantId: product?.variantId ?? variant?.variantId ?? variant?.id ?? null,
    };
  };

  const sameCatalogItem = sameCartLine;

  const catalogItemKey = (item) => `${item?.storeId || 'store'}:${item?.productId || ''}:${item?.variantId ?? 'product'}`;

  const adaptCartItem = (item, cart = null) => {
    const cartStore = cart?.storeId
      ? {
          storeId: cart.storeId,
          store: cart.storeName || cart.store || item?.store || item?.storeName || cart.storeId,
          storeName: cart.storeName || cart.store || item?.storeName || item?.store || cart.storeId,
        }
      : {};
    const source = resolveProductStore({ ...cartStore, ...item }, catalogProducts) || {};
    const cartPrice = Number(item?.unitPrice ?? item?.price ?? 0);
    const storeMapping = catalogStoreProducts.find((mapping) =>
      String(mapping.productId || '') === String(item?.productId || '')
      && String(mapping.storeId || '') === String(item?.storeId || cartStore.storeId || ''),
    );
    const catalogProduct = storeMapping?.product
      || catalogProducts.find((product) => String(product.productId || product.id || '') === String(item?.productId || ''));
    const catalogVariant = catalogProduct?.variants?.find((variant) =>
      String(variant.variantId || variant.id || '') === String(item?.variantId || ''),
    );
    const mappedPrice = Number(storeMapping?.priceOverride);
    const catalogPrice = mappedPrice > 0
      ? mappedPrice
      : Number(catalogVariant?.price ?? (item?.variantId == null ? catalogProduct?.price : 0));
    // Old cart records can retain a zero price after catalog products load.
    // Keep a valid cart price, but recover missing/invalid prices from the
    // selected store mapping or the matching catalog variant.
    const unitPrice = Number.isFinite(cartPrice) && cartPrice > 0
      ? cartPrice
      : Number.isFinite(catalogPrice) && catalogPrice > 0 ? catalogPrice : 0;
    return {
      ...source,
      ...cartStore,
      ...item,
      storeId: item?.storeId || cartStore.storeId || source.storeId,
      store: item?.store || item?.storeName || cartStore.store || source.store,
      storeName: item?.storeName || item?.store || cartStore.storeName || source.storeName,
      id: item?.id || null,
      cartId: item?.cartId || cart?.id || null,
      productId: item?.productId || null,
      variantId: item?.variantId ?? null,
      productName: cleanDisplayText(item?.productName || item?.title || 'Product'),
      quantity: Number(item?.quantity || 0),
      unitPrice,
      totalPrice: unitPrice * Number(item?.quantity || 0),
      title: cleanDisplayText(item?.productName || item?.title || 'Product'),
      price: unitPrice,
      weight: cleanDisplayText(item?.weight || (item?.variantId == null ? 'Product-level item' : String(item.variantId))),
    };
  };

  const cartItemsFromResponse = (cart) => {
    const items = Array.isArray(cart?.items) ? cart.items : Array.isArray(cart?.cartItems) ? cart.cartItems : [];
    return items.map((item) => adaptCartItem(item, cart));
  };

  const savedItemsFromResponse = (cart) => (Array.isArray(cart?.savedForLaterItems) ? cart.savedForLaterItems : [])
    .map((item) => adaptCartItem(item, cart));

  useEffect(() => {
    if (!catalogProducts.length && !catalogStoreProducts.length) return undefined;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setCartItems((current) => {
        let repaired = false;
        const next = current.map((item) => {
          if (Number(item.unitPrice ?? item.price) > 0) return item;
          const refreshed = adaptCartItem(item);
          if (refreshed.unitPrice <= 0) return item;
          repaired = true;
          return refreshed;
        });
        return repaired ? next : current;
      });
    });
    return () => { active = false; };
  // The adapter intentionally uses the latest catalog snapshots; including its
  // per-render function identity here would cause a repeated effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogProducts, catalogStoreProducts]);

  const applyCartResponse = (cart) => {
    setActiveCart(cart || null);
    setCartItems(cartItemsFromResponse(cart));
    if (cart?.id) setSavedForLater((items) => [...items.filter((item) => item.cartId !== cart.id), ...savedItemsFromResponse(cart)]);
    setCartUnavailable(false);
    setCartError('');
    return cart;
  };

  const mergeCartResponse = (cart) => {
    const incoming = cartItemsFromResponse(cart);
    const storeId = cart?.storeId || incoming.find((item) => item.storeId)?.storeId || '';
    const cartId = cart?.id || '';
    setActiveCart(cart || null);
    if (cartId) setSavedForLater((items) => [...items.filter((item) => item.cartId !== cartId), ...savedItemsFromResponse(cart)]);
    setCartItems((current) => mergeCartResponseItems(current, incoming, { cartId, storeId }));
    setCartUnavailable(false);
    setCartError('');
    return cart;
  };

  const applyGuestCartItems = (items) => {
    const normalized = items.map(adaptCartItem).filter((item) => item.productId && item.quantity > 0);
    guestCartItemsRef.current = normalized;
    setCartItems(normalized);
    setActiveCart(normalized.length ? { id: GUEST_CART_ID, status: 'GUEST', totalAmount: localCartTotal(normalized) } : null);
    setCartUnavailable(false);
    setCartError('');
    return normalized;
  };

  const upsertGuestCartItem = (itemPayload) => {
    const items = readGuestCartItems().map(adaptCartItem);
    logCartSnapshot('guest.add.before', items, 'guest in-memory cart');
    const existingIndex = items.findIndex((item) => sameCatalogItem(item, itemPayload));
    const nextItems = [...items];
    if (existingIndex >= 0) {
      const current = nextItems[existingIndex];
      const quantity = Number(current.quantity || 0) + 1;
      nextItems[existingIndex] = { ...current, quantity, totalPrice: Number(current.unitPrice || current.price || 0) * quantity };
    } else {
      nextItems.push({ ...itemPayload, quantity: 1, totalPrice: itemPayload.unitPrice });
    }
    const updated = applyGuestCartItems(nextItems);
    logCartSnapshot('guest.add.after', updated, 'guest in-memory cart');
    return updated;
  };

  const isCartServiceUnavailable = (error) => error?.name === 'TypeError' || Number(error?.status) >= 500;

  const buildCartItem = (product) => {
    if (!product) return null;
    const identity = resolveProductIdentity(product);
    if (!identity.productId) return null;
    const variant = product.variant || product.selectedVariant || product.variants?.find((item) => (item.variantId || item.id) === identity.variantId) || product.variants?.[0] || {};
    const source = rememberProductStore(product) || resolveProductStore(product, catalogProducts) || {};
    return {
      ...source,
      ...product,
      storeId: product.storeId || source.storeId,
      store: product.store || source.store,
      storeName: product.storeName || source.storeName,
      id: identity.productId,
      productId: identity.productId,
      variantId: identity.variantId,
      productName: cleanDisplayText(product.productName || product.title || product.name || 'Product'),
      title: cleanDisplayText(product.title || product.name || 'Product'),
      weight: cleanDisplayText(product.weight || variant.label || variant.weight || variant.name || ''),
      unitPrice: Number(product.unitPrice ?? product.price ?? variant.price ?? 0),
      price: Number(product.unitPrice ?? product.price ?? variant.price ?? 0),
      image: product.image || variant.image || '',
    };
  };

  const resolveCartStoreId = (product) => {
    if (product?.storeId) return product.storeId;
    const selectedStore = selectedStoreId;
    const stores = catalogStores;
    const match = stores.find((store) => store.id === selectedStore || store.name === selectedStore);
    return match?.id || stores.find((store) => store.status !== 'Inactive' && store.active !== false)?.id || null;
  };

  const cartScopeFor = (product) => ({
    customerId: currentCustomerId(),
    storeId: resolveCartStoreId(product),
  });

  const catalogRequest = useRef(null);
  const loadCatalog = () => {
    if (catalogRequest.current) return catalogRequest.current;
    setCatalogLoading(true);
    setCatalogError(null);
    // Render products as soon as they arrive; metadata cannot block the product grid.
    const productsRequest = getProducts({ status: 'ACTIVE' })
      .then((response) => {
        const products = adaptProductList(response || []);
        setCatalogProducts(products);
        return products;
      })
      .catch((error) => {
        setCatalogError(error.status >= 500 ? 'Products are temporarily unavailable. Please retry in a moment.' : error.message || 'Products are unavailable. Please retry.');
        throw error;
      });
    const categoriesRequest = getCategories()
      .then((response) => setCatalogCategories(adaptCategoryList(response || [])))
      .catch((error) => console.warn('Could not refresh categories:', error.message));
    const bannersRequest = getBanners()
      .then((response) => setCatalogBanners(adaptBannerList(response || [])))
      .catch((error) => console.warn('Could not refresh banners:', error.message));
    const storesRequest = getStores()
      .then((response) => {
        setCatalogStores((Array.isArray(response) ? response : response?.content || response?.items || []).filter((store) => !String(store.id || '').startsWith('location-')));
      })
      .catch(() => {
        setCatalogStores([]);
        setCatalogError('Delivery stores could not be loaded. Please retry in a moment.');
      });
    const storeRequest = getPublicStoreProducts('', { status: 'ACTIVE' });
    const mappingsRequest = Promise.all([productsRequest, storeRequest])
      .then(([products, response]) => {
        const byId = new Map(products.map((product) => [product.productId, product]));
        const storeProducts = adaptStoreProductList(response || [])
          .filter((item) => item.available !== false)
          .map((item) => ({ ...item, product: item.product || byId.get(item.productId) || null }));
        setCatalogStoreProducts(storeProducts);
      })
      .catch(() => {
        setCatalogStoreProducts([]);
        setCatalogError('Products and delivery availability could not be loaded. Please retry in a moment.');
      });
    catalogRequest.current = Promise.allSettled([productsRequest, categoriesRequest, bannersRequest, mappingsRequest, storesRequest])
      .finally(() => { catalogRequest.current = null; setCatalogLoading(false); });
    return catalogRequest.current;
  };

  const loadCatalogProducts = async (params = {}) => {
    const response = await getProducts(params);
    const products = adaptProductList(response || []);
    setCatalogProducts(products);
    return products;
  };

  const updateCatalogStore = (store) => {
    setCatalogStores((current) => current.some((item) => item.id === store.id)
      ? current.map((item) => item.id === store.id ? store : item)
      : [...current, store]);
  };
  const removeCatalogStore = (storeId) => {
    setCatalogStores((current) => current.filter((item) => item.id !== storeId));
  };

  const loadCategoryProducts = async (categoryId, params = {}) => {
    const response = await getCategoryProducts(categoryId, params);
    return adaptProductList(response || []);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCatalog();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const token = sessionToken;
    if (!isLoggedIn || !token) return undefined;
    const customerId = tokenCustomerId();
    const request = customerId ? customerAuthService.me() : orgAccessService.me();
    request.then((account) => {
      if (!active) return;
      setUser({ ...account, id: customerId || account.id, role: customerId ? 'customer' : account.role });
      setAuthReady(true);
    }).catch((error) => {
      if (!active) return;
      if (error.status === 401) {
        sessionStorage.removeItem('authToken');
        setSessionToken('');
        setIsLoggedIn(false);
        setUser(null);
        setAuthError('');
      } else setAuthError('Your account could not be verified right now. Retry after the identity service is available.');
      setAuthReady(true);
      // Keep the session token during a temporary service outage; the account
      // can be loaded again from its database after the service recovers.
    });
    return () => { active = false; };
  }, [isLoggedIn, sessionToken]);
  useEffect(() => {
    if (user?.role !== 'location-admin') return undefined;
    let active = true;
    getStoreProducts().then((response) => {
      if (!active) return;
      const productsById = new Map(catalogProducts.map((product) => [String(product.productId || product.id), product]));
      const mappings = adaptStoreProductList(response || [])
        .filter((mapping) => mapping.available !== false)
        .map((mapping) => ({ ...mapping, product: mapping.product || productsById.get(String(mapping.productId)) || null }));
      setCatalogStoreProducts(mappings);
      setCatalogError(null);
    }).catch((error) => {
      if (!active) return;
      setCatalogError(error.message || 'Location product mappings could not be loaded. Please retry.');
    });
    return () => { active = false; };
  }, [user?.role, user?.id, catalogProducts]);
  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    if (!isLoggedIn || !isCustomerSession({ role: user?.role, tokenCustomerId: tokenCustomerId() }) || !token || token.startsWith('local-')) return;
    customerProfileService.addresses().then((items) => {
      const mapped = items.map((item) => ({ ...item, isDefault: item.defaultAddress, coordinates: item.latitude != null && item.longitude != null ? { lat:item.latitude, lng:item.longitude } : null, manualLocation: item.street ? { street:item.street, city:item.city || '', state:item.state || '', pincode:item.pincode || '' } : null }));
      setAddresses(mapped);
    }).catch((error) => console.warn('Could not load addresses:', error.message));
  }, [isLoggedIn, user?.role]);
  useEffect(() => {
    const token = sessionStorage.getItem('authToken');
    const customerId = activeCustomerId;
    if (!isLoggedIn || !isCustomerSession({ role: user?.role, tokenCustomerId: tokenCustomerId() }) || !token || token.startsWith('local-') || !customerId) return;
    getCustomerOrders(customerId, { expireSession: false }).then((orders) => {
      const seen = new Set();
      const derived = (Array.isArray(orders) ? orders : [])
        .map((order) => orderDeliveryAddress(normalizeOrder(order)))
        .filter(Boolean)
        .sort((a, b) => new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0))
        .reduce((list, entry) => {
          const key = entry.address.toLowerCase().replace(/\s+/g, ' ');
          if (seen.has(key)) return list;
          seen.add(key);
          list.push({ ...entry, id: `order-address-${list.length}`, type: 'Previous order', fromOrder: true });
          return list;
        }, []);
      setOrderAddresses(derived);
    }).catch((error) => { console.warn('Could not load previous order addresses:', error.message); setOrderAddresses([]); });
  }, [activeCustomerId, isLoggedIn, user?.id, user?.role]);
  const login = (authenticatedUser, token) => {
    cartHydrationRequest.current += 1;
    setCartLoading(false);
    const nextToken = token || sessionStorage.getItem('authToken') || '';
    if (token) sessionStorage.setItem('authToken', token);
    setSessionToken(nextToken);
    const customerId = tokenCustomerId();
    const accountUser = customerId ? { ...authenticatedUser, id: customerId } : authenticatedUser;
    if (isLoggedIn && accountUser?.id !== user?.id) {
      setCartItems(readGuestCartItems());
      setActiveCart(null);
    }
    setWishlistItems(isLoggedIn && accountUser?.id !== user?.id ? [] : wishlistItems);
    setSavedForLater([]);
    setAddresses([]);
    setOrderAddresses([]);
    setUser(accountUser || null);
    setAuthError('');
    setAuthReady(true);
    if (accountUser?.locale) updateLocale(accountUser.locale);
    setIsLoggedIn(true);
  };
  const logout = () => {
    cartHydrationRequest.current += 1;
    setCartLoading(false);
    const token = sessionStorage.getItem('authToken');
    if (token && !token.startsWith('local-')) customerAuthService.logout().catch(() => {});
    setWishlistItems([]); setSavedForLater([]); setAddresses([]); setOrderAddresses([]);
    setIsLoggedIn(false);
    setUser(null);
    setAuthError('');
    setAuthReady(true);
    sessionStorage.removeItem('authToken');
    setSessionToken('');
    setCartItems([]);
    guestCartItemsRef.current = [];
    setActiveCart(null);
  };

  useEffect(() => {
    const expire = () => logout();
    window.addEventListener('customer-session-expired', expire);
    let timer;
    if (isLoggedIn) {
      try {
        const token = sessionToken;
        const claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        timer = setTimeout(expire, Math.max(0, claims.exp * 1000 - Date.now()));
      } catch { timer = setTimeout(expire, 0); }
    }
    return () => { clearTimeout(timer); window.removeEventListener('customer-session-expired', expire); };
  }, [isLoggedIn, sessionToken]);

  const [addedToCartPopup, setAddedToCartPopup] = useState(null);

  const triggerAddedPopup = (item) => {
    setAddedToCartPopup({
      show: true,
      product: item,
      timestamp: Date.now(),
    });
  };

  const closeAddedPopup = () => {
    setAddedToCartPopup(null);
  };

  // eslint-disable-next-line no-unused-vars
  const loadCart = async (scopeProduct) => {
    const scope = cartScopeFor(scopeProduct);
    if (!scope.customerId || !scope.storeId) {
      setActiveCart(null);
      setCartItems(readGuestCartItems());
      setCartUnavailable(false);
      setCartError(scope.customerId ? 'Select a store before using the cart.' : '');
      return null;
    }
    setCartLoading(true);
    try {
      const cart = await getActiveCart(scope);
      return applyCartResponse(cart);
    } catch (error) {
      setActiveCart(null);
      setCartItems([]);
      if (error.status === 404) {
        setCartUnavailable(false);
        setCartError('');
        return null;
      }
      setCartUnavailable(isCartServiceUnavailable(error));
      setCartError(error.message || 'Cart Service is unavailable.');
      return null;
    } finally {
      setCartLoading(false);
    }
  };

  const ensureCart = async (scopeProduct, options = {}) => {
    const scope = cartScopeFor(scopeProduct);
    if (!scope.customerId) throw new Error('Log in to use your cart.');
    if (!scope.storeId) throw new Error('Select a store before using the cart.');
    if (!options.forceRefresh && activeCart?.id && activeCart.customerId === scope.customerId && activeCart.storeId === scope.storeId && activeCart.status === 'ACTIVE') return activeCart;
    try {
      const cart = await getActiveCart(scope);
      if (options.preserveVisibleItems) {
        setActiveCart(cart);
        setCartUnavailable(false);
        setCartError('');
        return cart;
      }
      return applyCartResponse(cart);
    } catch (error) {
      if (error.status !== 404) throw error;
      const cart = await createCart({ customerId: scope.customerId, storeId: scope.storeId });
      if (options.preserveVisibleItems) {
        setActiveCart(cart);
        setCartUnavailable(false);
        setCartError('');
        return cart;
      }
      return applyCartResponse(cart);
    }
  };

  const refreshCartTotal = async (cartId, options = {}) => {
    let cart = await calculateCartTotal(cartId);
    if (!Array.isArray(cart?.items) && !Array.isArray(cart?.cartItems)) cart = await getCart(cartId);
    if (options.mergeStoreItems) return mergeCartResponse(cart);
    return applyCartResponse(cart);
  };

  useEffect(() => {
    const requestId = ++cartHydrationRequest.current;
    const token = sessionStorage.getItem('authToken') || '';
    const customerId = currentCustomerId();
    if (!isLoggedIn || !customerId || !token || token.startsWith('local-')) {
      return undefined;
    }

    const previousHydration = cartHydrationPromise.current;
    const isCurrent = () => requestId === cartHydrationRequest.current;
    const hydrate = async () => {
      // Finish an in-flight guest acknowledgement before a new account or
      // catalog-triggered load reads the same guest storage.
      if (previousHydration) await previousHydration;
      if (!isCurrent()) return;
      setCartLoading(true);
      setCartError('');
      const readGuestItems = () => readGuestCartItems().map((item) => {
        const adapted = adaptCartItem(item);
        return { ...adapted, storeId: adapted.storeId || resolveCartStoreId(adapted) };
      }).filter((item) => item.productId && item.quantity > 0);
      logCartSnapshot('cart.hydration.guest.read', readGuestItems(), 'guest in-memory cart');
      const result = await loadCustomerCart({
        customerId, readGuestItems, isCurrent,
        api: { getActiveCart, getActiveCarts, createCart, addCartItem },
        onGuestItemMigrated: (item) => { guestCartItemsRef.current = guestCartItemsRef.current.filter((entry) => !sameCatalogItem(entry, item)); },
        persistGuestItems: false,
      });
      if (!result || !isCurrent()) return;
      const { carts, guestItems: failedGuestItems, errors: failures } = result;
      const serverItems = carts.flatMap(cartItemsFromResponse);
      setSavedForLater(carts.flatMap(savedItemsFromResponse));
      logCartSnapshot('cart.hydration.server', serverItems, 'server API');
      logCartSnapshot('cart.hydration.unmigrated-guest', failedGuestItems, 'guest in-memory cart');
      const visibleItems = [...serverItems, ...failedGuestItems];
      const populatedCarts = carts.filter((cart) => cartItemsFromResponse(cart).length > 0);
      setCartItems(visibleItems);
      setActiveCart(populatedCarts[populatedCarts.length - 1] || carts[carts.length - 1] || null);
      setCartUnavailable(failures.some(isCartServiceUnavailable));
      setCartError(failures[0]?.message || (failedGuestItems.length ? 'Some saved items could not be synced. Please retry.' : ''));
    };

    cartHydrationPromise.current = hydrate().catch((error) => {
      if (requestId === cartHydrationRequest.current) {
        setCartUnavailable(isCartServiceUnavailable(error));
        setCartError(error.message || 'Could not load your saved cart.');
      }
    }).finally(() => {
      if (requestId === cartHydrationRequest.current) setCartLoading(false);
    });
    return () => { if (requestId === cartHydrationRequest.current) cartHydrationRequest.current += 1; };
  }, [isLoggedIn, user?.id, catalogStores]); // eslint-disable-line react-hooks/exhaustive-deps

  const addToCart = async (product) => {
    // Serialize every cart mutation before React can disable the controls.
    if (cartMutationPending.current) return false;
    cartMutationPending.current = true;
    setCartLoading(true);
    setCartError('');
    try {
      if (isLoggedIn && cartHydrationPromise.current) await cartHydrationPromise.current;
      const itemPayload = buildCartItem(product);
      if (!itemPayload) throw new Error('This product is not ready to add. Please reload it.');
      if (!Number.isFinite(itemPayload.unitPrice) || itemPayload.unitPrice < 0) throw new Error('This product has an invalid price.');
      if (isLoggedIn && !currentCustomerId()) throw new Error('Your customer session is incomplete. Please sign in again.');
      logCartDiagnostic('cart.add.explicit', {
        storeId: itemPayload.storeId,
        productId: itemPayload.productId,
        variantId: itemPayload.variantId,
        quantity: 1,
        source: isLoggedIn ? 'server API' : 'guest in-memory cart',
      });
      if (isLoggedIn && currentCustomerId()) {
        itemPayload.storeId = resolveCartStoreId(itemPayload);
        if (!itemPayload.storeId) throw new Error('Select a store before using the cart.');
        let cart = await ensureCart(itemPayload, { preserveVisibleItems: true, forceRefresh: true });
        const guestItems = readGuestCartItems().map(adaptCartItem);
        if (guestItems.some(item => item.storeId === cart.storeId)) {
          await migrateGuestCart(cart, guestItems, addCartItem, sessionStorage, () => true, (item) => { guestCartItemsRef.current = guestCartItemsRef.current.filter((entry) => !sameCatalogItem(entry, item)); }, false);
          cart = await getActiveCart({ customerId: currentCustomerId(), storeId: itemPayload.storeId });
        }
        const mutation = planCartLineMutation([...cartItemsFromResponse(cart), ...cartItems], itemPayload, 1, cart.id);
        const nextQuantity = mutation.quantity;
        logCartDiagnostic(`cart.add.plan.${mutation.type}`, {
          storeId: itemPayload.storeId,
          productId: itemPayload.productId,
          variantId: itemPayload.variantId,
          cartItemId: mutation.line?.id,
          quantity: nextQuantity,
          source: 'server API',
        });
        await validateCheckoutAvailability([{ storeId: itemPayload.storeId, items: [{ ...itemPayload, quantity: nextQuantity }] }], getPublicInventoryAvailability);
        if (mutation.type === 'update') {
          await updateCartItem(cart.id, mutation.line.id, { quantity: nextQuantity });
        } else {
          await addCartItem(cart.id, {
            productId: itemPayload.productId,
            variantId: itemPayload.variantId,
            productName: itemPayload.productName,
            quantity: 1,
            unitPrice: itemPayload.unitPrice,
          });
        }
        await refreshCartTotal(cart.id, { mergeStoreItems: true });
      } else {
        upsertGuestCartItem(itemPayload);
      }
      triggerAddedPopup(itemPayload);
      return true;
    } catch (error) {
      setCartUnavailable(isCartServiceUnavailable(error));
      setCartError(error.message || 'Could not add this product to your cart.');
      return false;
    } finally {
      cartMutationPending.current = false;
      setCartLoading(false);
    }
  };

  const updateQuantity = async (productId, variantId, delta, storeId = '') => {
    if (cartMutationPending.current) return false;
    const match = { productId, variantId, storeId };
    const current = cartItems.find((item) => sameCatalogItem(item, match));
    const nextQuantity = Number(current?.quantity || 0) + Number(delta || 0);
    logCartDiagnostic('cart.quantity.change', {
      storeId: current?.storeId || storeId,
      productId,
      variantId,
      cartItemId: current?.id,
      quantity: nextQuantity,
      source: isLoggedIn && current?.cartId ? 'server API' : 'guest in-memory cart',
    });
    if (!isLoggedIn || !current?.cartId) {
      logCartSnapshot('guest.quantity.before', cartItems, 'guest in-memory cart');
      applyGuestCartItems(cartItems.flatMap((item) => {
        if (!sameCatalogItem(item, match)) return [item];
        return nextQuantity > 0 ? [{ ...item, quantity: nextQuantity, totalPrice: Number(item.unitPrice || item.price || 0) * nextQuantity }] : [];
      }));
      logCartSnapshot('guest.quantity.after', readGuestCartItems().map(adaptCartItem), 'guest in-memory cart');
      return true;
    }
    const targetStoreId = current.storeId || storeId || resolveCartStoreId(current);
    if (!targetStoreId) return false;
    cartMutationPending.current = true;
    setCartLoading(true);
    try {
      setCartError('');
      const result = await mutateAuthenticatedCart({
        customerId: currentCustomerId(), storeId: targetStoreId,
        item: { ...current, quantity: Number(current.quantity || 1) },
        operation: 'update', delta: Number(delta || 0),
        api: { getActiveCart, createCart, addCartItem, updateCartItem, removeCartItem, clearCartItems },
        checkInventory: (stores) => validateCheckoutAvailability(stores, getPublicInventoryAvailability),
        onReconciled: mergeCartResponse,
      });
      mergeCartResponse(result);
    } catch (error) {
      setCartUnavailable(isCartServiceUnavailable(error));
      setCartError(error.message || 'Cart Service is unavailable.');
      return false;
    } finally {
      cartMutationPending.current = false;
      setCartLoading(false);
    }
    return true;
  };

  const removeFromCart = async (productId, variantId, storeId = '') => {
    if (cartMutationPending.current) return false;
    const match = { productId, variantId, storeId };
    const current = cartItems.find((item) => sameCatalogItem(item, match));
    logCartDiagnostic('cart.remove', {
      storeId: current?.storeId || storeId,
      productId,
      variantId,
      cartItemId: current?.id,
      quantity: current?.quantity,
      source: isLoggedIn && current?.cartId ? 'server API' : 'guest in-memory cart',
    });
    if (!isLoggedIn || !current?.cartId) {
      logCartSnapshot('guest.remove.before', cartItems, 'guest in-memory cart');
      applyGuestCartItems(cartItems.filter((item) => !sameCatalogItem(item, match)));
      logCartSnapshot('guest.remove.after', readGuestCartItems().map(adaptCartItem), 'guest in-memory cart');
      return true;
    }
    const targetStoreId = current.storeId || storeId || resolveCartStoreId(current);
    if (!targetStoreId) return false;
    cartMutationPending.current = true;
    setCartLoading(true);
    try {
      const result = await mutateAuthenticatedCart({
        customerId: currentCustomerId(), storeId: targetStoreId,
        item: { ...current, quantity: Number(current.quantity || 1) }, operation: 'remove',
        api: { getActiveCart, createCart, addCartItem, updateCartItem, removeCartItem, clearCartItems },
        checkInventory: (stores) => validateCheckoutAvailability(stores, getPublicInventoryAvailability),
        onReconciled: mergeCartResponse,
      });
      mergeCartResponse(result);
    } catch (error) {
      setCartUnavailable(isCartServiceUnavailable(error));
      setCartError(error.message || 'Cart Service is unavailable.');
      return false;
    } finally {
      cartMutationPending.current = false;
      setCartLoading(false);
    }
    return true;
  };

  const clearCart = async () => {
    if (cartMutationPending.current) return false;
    if (!isLoggedIn || cartItems.every((item) => !item.cartId || item.cartId === GUEST_CART_ID)) {
      logCartSnapshot('guest.clear.before', cartItems, 'guest in-memory cart');
      applyGuestCartItems([]);
      logCartSnapshot('guest.clear.after', [], 'guest in-memory cart');
      return true;
    }
    cartMutationPending.current = true;
    setCartLoading(true);
    try {
      const activeCarts = await getActiveCarts(currentCustomerId());
      if (!Array.isArray(activeCarts)) throw new Error('Cart Service returned an invalid active-cart list.');
      const cartsToClear = activeCarts.filter((cart) => cart?.status === 'ACTIVE' && cartItemsFromResponse(cart).length > 0);
      if (!cartsToClear.length) {
        setCartItems([]);
        guestCartItemsRef.current = [];
        setActiveCart(null);
        setCartError('');
        setCartUnavailable(false);
        return true;
      }
      const results = await Promise.allSettled(cartsToClear.map((cart) => clearCartItems(cart.id)));
      const clearedCartIds = cartsToClear.filter((_, index) => results[index].status === 'fulfilled').map((cart) => cart.id);
      setCartItems((items) => items.filter((item) => !clearedCartIds.includes(item.cartId)));
      if (clearedCartIds.length === cartsToClear.length) {
        guestCartItemsRef.current = [];
        setCartItems([]);
        setActiveCart(null);
        setCartError('');
        setCartUnavailable(false);
        return true;
      }
      const failure = results.find((result) => result.status === 'rejected')?.reason;
      setCartUnavailable(isCartServiceUnavailable(failure));
      setCartError(failure?.message || 'Some store carts could not be cleared.');
      return false;
    } catch (error) {
      setCartUnavailable(isCartServiceUnavailable(error));
      setCartError(error.message || 'Cart Service is unavailable.');
      return false;
    } finally {
      cartMutationPending.current = false;
      setCartLoading(false);
    }
  };
  const clearCartAfterCheckout = () => {
    // A successfully claimed checkout cart is immutable on the server. Clear
    // the local cart view after order creation without sending DELETE against
    // that CHECKED_OUT cart.
    guestCartItemsRef.current = [];
    setCartItems([]);
    setActiveCart(null);
    setCartError('');
    setCartUnavailable(false);
    return true;
  };
  const toggleWishlist = (product) => setWishlistItems((items) => {
    const itemPayload = buildCartItem(product);
    if (!itemPayload) return items;
    const exists = items.some((item) => sameCatalogItem(item, itemPayload));
    return exists ? items.filter((item) => !sameCatalogItem(item, itemPayload)) : [...items, itemPayload];
  });
  const moveWishlistToCart = async (product) => {
    const added = await addToCart(product);
    if (!added) return false;
    const itemPayload = buildCartItem(product);
    setWishlistItems((items) => items.filter((item) => !sameCatalogItem(item, itemPayload)));
    return true;
  };
  const saveItemForLater = async (product) => {
    const itemPayload = adaptCartItem(product);
    if (!itemPayload?.productId) return;
    if (isLoggedIn && itemPayload.storeId) {
      try {
        const active = await getActiveCart({ customerId: currentCustomerId(), storeId: itemPayload.storeId });
        const activeLine = cartItemsFromResponse(active).find((item) => sameCatalogItem(item, itemPayload));
        if (!activeLine?.id) throw new Error('This item is no longer in an active cart. Refresh your cart and try again.');
        // A customer can have one active cart per store. Replacing the whole
        // visible cart from this response dropped every other store's lines.
        mergeCartResponse(await saveCartItemForLater(active.id, activeLine.id));
        return true;
      } catch (error) {
        setCartError(error.message || 'Could not save this item for later.');
        return false;
      }
    }
    const removed = await removeFromCart(itemPayload.productId, itemPayload.variantId, itemPayload.storeId);
    if (!removed) return false;
    setSavedForLater((items) => {
      const existingIndex = items.findIndex((item) => sameCatalogItem(item, itemPayload));
      if (existingIndex < 0) return [...items, itemPayload];
      return items.map((item, index) => index === existingIndex ? { ...item, ...itemPayload } : item);
    });
    return true;
  };
  const removeSavedForLater = async (product) => {
    const itemPayload = adaptCartItem(product);
    if (!itemPayload?.productId) return;
    if (isLoggedIn && itemPayload.storeId) {
      try {
        const active = await getActiveCart({ customerId: currentCustomerId(), storeId: itemPayload.storeId });
        const savedLine = savedItemsFromResponse(active).find((item) => sameCatalogItem(item, itemPayload));
        if (!savedLine?.id) throw new Error('This saved item is no longer available. Refresh and try again.');
        const cart = await removeCartItem(active.id, savedLine.id);
        setSavedForLater((items) => items.filter((item) => !sameCatalogItem(item, itemPayload)));
        mergeCartResponse(cart);
        return true;
      } catch (error) {
        setCartError(error.message || 'Could not remove this saved item.');
        return false;
      }
    }
    setSavedForLater((items) => items.filter((item) => !sameCatalogItem(item, itemPayload)));
    return true;
  };
  const restoreSavedItem = async (product) => {
    if (cartMutationPending.current) return false;
    const itemPayload = adaptCartItem(product);
    if (!itemPayload?.productId) return;
    const quantity = Math.max(1, Number(itemPayload.quantity || 1));
    if (isLoggedIn && itemPayload.storeId) {
      try {
        const active = await getActiveCart({ customerId: currentCustomerId(), storeId: itemPayload.storeId });
        const savedLine = savedItemsFromResponse(active).find((item) => sameCatalogItem(item, itemPayload));
        if (!savedLine?.id) throw new Error('This saved item is no longer available. Refresh and try again.');
        mergeCartResponse(await moveSavedCartItemToCart(active.id, savedLine.id));
        return true;
      } catch (error) {
        setCartError(error.message || 'Could not move item back to cart.');
        return false;
      }
    }
    if (!isLoggedIn || activeCart?.id === GUEST_CART_ID) {
      const items = readGuestCartItems().map(adaptCartItem);
      const existingIndex = items.findIndex((item) => sameCatalogItem(item, itemPayload));
      const nextItems = [...items];
      if (existingIndex >= 0) {
        const current = nextItems[existingIndex];
        const nextQuantity = Number(current.quantity || 0) + quantity;
        nextItems[existingIndex] = { ...current, quantity: nextQuantity, totalPrice: Number(current.unitPrice || current.price || 0) * nextQuantity };
      } else {
        nextItems.push({ ...itemPayload, quantity, totalPrice: Number(itemPayload.unitPrice || itemPayload.price || 0) * quantity });
      }
      applyGuestCartItems(nextItems);
      setSavedForLater((items) => items.filter((item) => !sameCatalogItem(item, itemPayload)));
      return true;
    }
    cartMutationPending.current = true;
    setCartLoading(true);
    try {
      itemPayload.storeId = resolveCartStoreId(itemPayload);
      const cart = await ensureCart(itemPayload, { preserveVisibleItems: true, forceRefresh: true });
      const guestItems = readGuestCartItems().map(adaptCartItem);
      if (guestItems.some((item) => item.storeId === cart.storeId)) {
        await migrateGuestCart(cart, guestItems, addCartItem, sessionStorage, () => true, (item) => { guestCartItemsRef.current = guestCartItemsRef.current.filter((entry) => !sameCatalogItem(entry, item)); }, false);
      }
      const latestCart = await getActiveCart({ customerId: currentCustomerId(), storeId: cart.storeId });
      const mutation = planCartLineMutation(cartItemsFromResponse(latestCart), itemPayload, quantity, latestCart.id);
      if (mutation.type === 'update') await updateCartItem(latestCart.id, mutation.line.id, { quantity: mutation.quantity });
      else await addCartItem(latestCart.id, {
        productId: itemPayload.productId,
        variantId: itemPayload.variantId,
        productName: itemPayload.productName,
        quantity,
        unitPrice: itemPayload.unitPrice,
      });
      await refreshCartTotal(latestCart.id, { mergeStoreItems: true });
      setSavedForLater((items) => items.filter((item) => !sameCatalogItem(item, itemPayload)));
      return true;
    } catch (error) {
      setCartUnavailable(isCartServiceUnavailable(error));
      setCartError(error.message || 'Could not move item back to cart.');
      return false;
    } finally {
      cartMutationPending.current = false;
      setCartLoading(false);
    }
  };
  const addAddress = async (address) => {
    const duplicate = addresses.find((item) => cleanLocationText(item.address).toLowerCase() === cleanLocationText(address.address).toLowerCase());
    if (duplicate) throw new Error('This address is already saved. Choose it from your saved addresses or edit it.');
    const saved = await customerProfileService.createAddress(address);
    const next = { ...saved, isDefault:Boolean(saved.defaultAddress ?? address.isDefault), coordinates:saved.latitude != null ? {lat:saved.latitude,lng:saved.longitude}:null, manualLocation:saved.street?{street:saved.street,city:saved.city||'',state:saved.state||'',pincode:saved.pincode||''}:null };
    setAddresses((items) => [...items.map((item)=>({...item,isDefault:next.isDefault ? false : item.isDefault})),next]);
    setDeliveryAddress(next.address);
    return next;
  };
  const deleteAddress = async (id) => { await customerProfileService.deleteAddress(id); const remaining=addresses.filter((item)=>item.id!==id); if(remaining.length&&!remaining.some((item)=>item.isDefault))remaining[0]={...remaining[0],isDefault:true}; setAddresses(remaining); setDeliveryAddress((remaining.find((item)=>item.isDefault)||remaining[0])?.address||''); };
  const setDefaultAddress = async (id) => { const saved=await customerProfileService.setDefaultAddress(id); setAddresses((items)=>items.map((item)=>({...item,isDefault:item.id===id}))); setDeliveryAddress(saved.address); };
  const updateAddress = async (id,address) => { const saved=await customerProfileService.updateAddress(id,{...address,isDefault:addresses.find((item)=>item.id===id)?.isDefault}); const next={...saved,isDefault:saved.defaultAddress,coordinates:saved.latitude!=null?{lat:saved.latitude,lng:saved.longitude}:null,manualLocation:saved.street?{street:saved.street,city:saved.city||'',state:saved.state||'',pincode:saved.pincode||''}:null}; setAddresses((items)=>items.map((item)=>item.id===id?next:item)); if(next.isDefault)setDeliveryAddress(next.address); return next; };

  const [locale, setLocale] = useState(() => ({ language:readLanguage(), currency:'INR', timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone }));
  const updateLocale = (next) => {
    const value = { ...locale, ...next, language: normalizeLanguage(next.language || locale.language) };
    setLocale(value);
    persistLanguage(null,value.language);
    document.documentElement.lang = languageCode(value.language);
  };
  const t = (key, values) => translate(locale.language, key, values);
  const formatCurrency = (amount) => cleanDisplayText(new Intl.NumberFormat(locale.language === 'Hindi' ? 'hi-IN' : locale.language === 'Telugu' ? 'te-IN' : 'en-IN', { style:'currency',currency:locale.currency }).format(Number(amount)));
  const formatDateTime = (value, options = {}) => new Intl.DateTimeFormat(locale.language === 'Hindi' ? 'hi-IN' : locale.language === 'Telugu' ? 'te-IN' : 'en-IN', { timeZone:locale.timeZone, ...options }).format(new Date(value));

  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  const saveSelectedLocation = (value) => {
    const next = {
      ...value,
      title: cleanLocationText(value.title),
      city: cleanLocationText(value.city),
      address: cleanLocationText(value.address),
      pincode: cleanLocationText(value.pincode),
    };
    const locationAddress = cleanLocationText(next.address || [next.title && next.title !== next.city ? next.title : '', next.city].filter(Boolean).join(', '));
    storeSelectedLocation(next);
    setSelectedLocation(next);
    setUserCity(locationAddress || cleanLocationText([next.title && next.title !== next.city ? next.title : '', next.city].filter(Boolean).join(', ')));
    setDeliveryAddress(locationAddress);
    // A selected delivery point is temporary UI state. Saved addresses are
    // created only through Customer Profile Service and persisted in MySQL.
    setShowLocationModal(false);
  };

  const clearSelectedLocation = () => {
    resetSelectedLocation();
    setSelectedLocation(null);
    setUserCity('');
    setDeliveryAddress('');
    setShowLocationModal(false);
  };
  const selectStore = (store) => setSelectedStoreId(String(store?.id || store || ''));
  return (
    <AppContext.Provider
      value={{
        isLoggedIn,
        authReady,
        authError,
        user,
        setUser,
        login,
        logout,
        cartCount,
        cartItems,
        activeCart,
        cartTotal,
        cartLoading,
        cartError,
        cartUnavailable,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        clearCartAfterCheckout,
        catalogProducts,
        catalogStoreProducts,
        catalogCategories,
        catalogBanners,
        catalogStores,
        updateCatalogStore,
        removeCatalogStore,
        catalogLoading,
        catalogError,
        loadCatalog,
        loadCatalogProducts,
        loadCategoryProducts,
        resolveProductIdentity,
        sameCatalogItem,
        catalogItemKey,
        wishlistItems,
        toggleWishlist,
        moveWishlistToCart,
        savedForLater,
        saveItemForLater,
        restoreSavedItem,
        removeSavedForLater,
        addresses,
        orderAddresses,
        addAddress,
        deleteAddress,
        setDefaultAddress,
        updateAddress,
        addedToCartPopup,
        triggerAddedPopup,
        closeAddedPopup,
        isCartOpen,
        openCart,
        closeCart,
        selectedCategory,
        setSelectedCategory,
        selectedProduct,
        setSelectedProduct,
        userCity,
        setUserCity,
        homeSearchQuery,
        setHomeSearchQuery,
        deliveryAddress,
        setDeliveryAddress,
        showLocationModal,
        setShowLocationModal,
        selectedLocation,
        selectedStoreId,
        selectStore,
        deliveryMode,
        setDeliveryMode,
        saveSelectedLocation,
        clearSelectedLocation,
        locale,
        updateLocale,
        t,
        formatCurrency,
        formatDateTime,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};



