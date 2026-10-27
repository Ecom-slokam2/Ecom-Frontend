import { useContext, useEffect, useMemo, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import AddLocationAltOutlinedIcon from '@mui/icons-material/AddLocationAltOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { hasCompleteProfile } from '../../utils/profileCompletion';
import { checkoutReviewError } from '../../utils/checkoutPolicy';
import { calculateCouponDiscount, cartPromotionContext, consumePendingCouponCode, validateCouponCode } from '../../services/couponService';
import { getCachedStoreDeliveryQuote } from '../../services/catalogApi';
import { resolveProductStore } from '../../services/productStoreResolver';
import { totalDeliveryCharge } from '../../services/cartDeliveryLines';
import { deliveryMethodId, isGlobalProduct, isGlobalStore, preferredDeliveryMethod, sortDeliveryMethods } from '../../utils/storeDelivery';
import { openStreetMapEmbedUrl } from '../../services/openStreetMapService';
import { formatIndianMobile, isValidIndianMobile } from '../../utils/phoneValidation';
import SafeProductImage from '../../components/SafeProductImage/SafeProductImage';
import DigitalTimePicker from './DigitalTimePicker';
import './CheckoutPage.css';

const normalizeAddressText = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
const displayAddressType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'home') return 'Home';
  if (normalized === 'office' || normalized === 'work') return 'Office';
  if (normalized === 'other') return 'Other';
  return 'Home';
};

const formatClockTime = (minutes) => {
  const hour24 = Math.floor(minutes / 60);
  const hour12 = hour24 % 12 || 12;
  const minute = String(minutes % 60).padStart(2, '0');
  return { value: `${String(hour24).padStart(2, '0')}:${minute}`, label: `${hour12}:${minute} ${hour24 < 12 ? 'AM' : 'PM'}` };
};
const formatSlotValue = (value) => value ? formatClockTime(Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))).label : '';

const localDateValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const COMPLETED_CHECKOUT_RETURN_KEY = 'freshcart.completedCheckoutReturnToCart';
const selectionForStore = (selections, storeId, initialMode = 'delivery') => selections[storeId] || { fulfillment: initialMode, deliveryMethod: '', pickupTiming: 'asap', date: '', slot: '' };
const updateStoreSelection = (setSelections, storeId, patch) => setSelections((current) => ({
  ...current,
  [storeId]: { ...selectionForStore(current, storeId), ...patch },
}));

const generateRequestedTimes = ({ date }) => {
  void date;
  return Array.from({ length: 96 }, (_, index) => formatClockTime(index * 15));
};

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cartItems, deliveryAddress, setDeliveryAddress, user, addresses, orderAddresses, setDefaultAddress, formatCurrency, userCity, catalogProducts, catalogStores, selectedLocation, clearSelectedLocation } = useContext(AppContext);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressPickerOpen, setAddressPickerOpen] = useState(false);
  const [fulfillmentByStore, setFulfillmentByStore] = useState({});
  const [savedFulfillmentByStore, setSavedFulfillmentByStore] = useState({});
  const [expandedStoreId, setExpandedStoreId] = useState(null);
  const [deliveryQuotesByStore, setDeliveryQuotesByStore] = useState({});
  const [scheduleDateOffsets, setScheduleDateOffsets] = useState({});

  const [notes, setNotes] = useState('');
  const [deliveryInstructionsOpen, setDeliveryInstructionsOpen] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState('');
  const [deliveryPhotos, setDeliveryPhotos] = useState([]);
  const [coupon, setCoupon] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (sessionStorage.getItem(COMPLETED_CHECKOUT_RETURN_KEY)) navigate('/cart', { replace: true });
  }, [navigate]);
  const selectableAddresses = useMemo(() => {
    const savedKeys = new Set(addresses.map((item) => normalizeAddressText(item.address)));
    const past = (orderAddresses || []).filter((item) => !savedKeys.has(normalizeAddressText(item.address)));
    return { saved: addresses, past, all: [...addresses, ...past] };
  }, [addresses, orderAddresses]);
  useEffect(() => {
    if (selectedLocation?.address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAddressId('selected-location');
      if (deliveryAddress !== selectedLocation.address) {
         
        setDeliveryAddress(selectedLocation.address);
      }
      return;
    }
    if (selectedAddressId && selectableAddresses.all.some((item) => item.id === selectedAddressId)) return;
    const preferred = addresses.find((item) => item.isDefault) || selectableAddresses.all[0];
    if (preferred) {
       
      setSelectedAddressId(preferred.id);
       
      setDeliveryAddress(preferred.address);
    }
  }, [selectableAddresses, selectedAddressId, addresses, setDeliveryAddress, selectedLocation, deliveryAddress]);
  const matchingSavedAddress = selectedLocation?.address
    ? addresses.find((item) => normalizeAddressText(item.address) === normalizeAddressText(selectedLocation.address))
    : null;
  const selectedLocationAddress = selectedLocation ? {
    id: 'selected-location',
    type: matchingSavedAddress?.type || 'Home',
    address: selectedLocation.address || selectedLocation.city || selectedLocation.title || '',
    coordinates: { lat: selectedLocation.latitude, lng: selectedLocation.longitude },
    latitude: selectedLocation.latitude,
    longitude: selectedLocation.longitude,
  } : null;
  const selectedAddress = selectedLocationAddress || selectableAddresses.all.find((item) => item.id === selectedAddressId)
    || addresses.find((item) => item.isDefault) || addresses[0] || {};
  const displayedAddresses = selectedLocationAddress?.id === selectedAddressId
    ? [selectedLocationAddress, ...selectableAddresses.all.filter((item) => item.id !== selectedLocationAddress.id)].slice(0, 3)
    : selectableAddresses.all.slice(0, 3);
  const initialContactPhone = user?.phone || user?.mobile || selectedAddress.phone || '';
  const [contactPhone, setContactPhone] = useState(initialContactPhone);
  const [contactDraft, setContactDraft] = useState(initialContactPhone);
  const [contactEditing, setContactEditing] = useState(false);
  const [contactError, setContactError] = useState('');
  const customerLat = Number(selectedAddress.coordinates?.lat ?? selectedAddress.latitude);
  const customerLng = Number(selectedAddress.coordinates?.lng ?? selectedAddress.longitude);
  useEffect(() => {
    if (sessionStorage.getItem(COMPLETED_CHECKOUT_RETURN_KEY)) return;
    if (!hasCompleteProfile(user, [{}])) {
      navigate('/profile', { replace: true, state: { completeProfile: true, returnTo: '/checkout' } });
    }
  }, [user, selectableAddresses, selectedLocation, navigate]);
  const cartStoreGroups = useMemo(() => cartItems.reduce((groups, item) => {
    const source = resolveProductStore(item, catalogProducts) || {};
    const store = catalogStores.find((entry) => (source.storeId && entry.id === source.storeId)
      || (source.store && entry.name === source.store)
      || (source.storeName && entry.name === source.storeName)) || null;
    const global = isGlobalProduct(item) || isGlobalStore(store || source);
    const storeId = global ? (store?.id || source.storeId || item.storeId || 'global-store') : (store?.id || source.storeId || item.storeId || source.store || source.storeName || item.storeName || item.store || 'store');
    const key = String(storeId);
    let group = groups.find((entry) => entry.id === key);
    if (!group) {
      group = { id: key, storeId: store?.id || source.storeId || item.storeId || key, name: store?.name || source.storeName || source.store || item.storeName || item.store || item.sourceStore || key, store: store || {}, global, items: [], subtotal: 0, source };
      groups.push(group);
    }
    group.items.push(item);
    group.subtotal += Number(item.price || item.unitPrice || 0) * Number(item.quantity || 0);
    return groups;
  }, []), [cartItems, catalogProducts, catalogStores]);
  const sourceStoreId = cartStoreGroups[0]?.storeId || '';
  const sourceStoreName = cartStoreGroups[0]?.name || '';
  const selectedStore = cartStoreGroups[0]?.store || null;
  const subtotal = useMemo(() => cartItems.reduce((sum, item) => sum + Number(item.price || item.unitPrice || 0) * Number(item.quantity || 0), 0), [cartItems]);
  const initialFulfillment = 'delivery';
  const deliveryGroupsForQuote = useMemo(() => cartStoreGroups.filter((group) => !group.global && selectionForStore(fulfillmentByStore, group.id, initialFulfillment).fulfillment === 'delivery'), [cartStoreGroups, fulfillmentByStore, initialFulfillment]);
  const deliveryQuoteRequestKey = JSON.stringify(deliveryGroupsForQuote.map((group) => ({ id: group.id, storeId: group.storeId, name: group.name, subtotal: group.subtotal, contextKey: `${customerLat}:${customerLng}:${group.subtotal}` })));
  const quoteLoading = deliveryGroupsForQuote.some((group) => {
    const contextKey = `${customerLat}:${customerLng}:${group.subtotal}`;
    return deliveryQuotesByStore[group.id]?.loading || deliveryQuotesByStore[group.id]?.contextKey !== contextKey;
  });

  useEffect(() => {
    let cancelled = false;
    const requestedGroups = JSON.parse(deliveryQuoteRequestKey);
    if (!Number.isFinite(customerLat) || !Number.isFinite(customerLng)) {
      Promise.resolve().then(() => {
        if (!cancelled) setDeliveryQuotesByStore((current) => ({ ...current, ...Object.fromEntries(requestedGroups.map((group) => [group.id, { contextKey: group.contextKey, error: 'Select a saved delivery address with map coordinates to check this store.' }])) }));
      });
      return () => { cancelled = true; };
    }
    Promise.resolve().then(() => {
      if (!cancelled) setDeliveryQuotesByStore((current) => ({
        ...current,
        ...Object.fromEntries(requestedGroups.map((group) => [group.id, { ...current[group.id], contextKey: group.contextKey, loading: true, error: '' }])),
      }));
    });
    Promise.all(requestedGroups.map(async (group) => {
      try {
        const quote = await getCachedStoreDeliveryQuote(group.storeId, { latitude: customerLat, longitude: customerLng, orderTotal: group.subtotal });
        return [group.id, { quote, contextKey: group.contextKey, loading: false, error: '' }];
      } catch (reason) {
        return [group.id, { quote: null, contextKey: group.contextKey, loading: false, error: reason.message || `Could not check delivery for ${group.name}.` }];
      }
    })).then((entries) => {
      if (!cancelled) setDeliveryQuotesByStore((current) => ({ ...current, ...Object.fromEntries(entries) }));
    });
    return () => { cancelled = true; };
  }, [deliveryQuoteRequestKey, customerLat, customerLng]);

  const deliveryLines = useMemo(() => cartStoreGroups.flatMap((group) => {
    const selection = savedFulfillmentByStore[group.id];
    const cachedQuoteState = deliveryQuotesByStore[group.id] || {};
    const contextKey = `${customerLat}:${customerLng}:${group.subtotal}`;
    const quoteState = cachedQuoteState.contextKey === contextKey ? cachedQuoteState : { loading: true };
    const quote = quoteState.quote || null;
    const baseLine = (item) => ({
      key: `${group.id}:${item.productId || item.id}:${item.variantId ?? 'product'}`,
      productId: item.productId || item.id || '', variantId: item.variantId ?? null,
      title: item.title || item.productName || item.name || 'Product', quantity: Number(item.quantity || 0),
      itemTotal: Number(item.price || item.unitPrice || 0) * Number(item.quantity || 0),
      storeId: group.storeId, storeName: group.name, sourceLocation: group.store.location || '',
    });
    if (group.global) return group.items.map((item) => ({ ...baseLine(item), deliveryType: 'global', deliveryLabel: 'Global Delivery', estimatedDelivery: '7-10 days delivery', deliveryCharge: 0, fulfillmentType: 'global', globalApproval: 'Pending', quote }));
    if (!selection) return group.items.map((item) => ({ ...baseLine(item), deliveryType: '', deliveryLabel: '', estimatedDelivery: '', deliveryCharge: 0, fulfillmentType: 'nearby', globalApproval: 'Not Required', quoteUnavailable: true, notConfigured: true }));
    if (selection.fulfillment === 'pickup') return group.items.map((item) => ({
      ...baseLine(item), deliveryType: 'pickup', deliveryLabel: 'Store Pickup', estimatedDelivery: '', deliveryCharge: 0,
      fulfillmentType: 'nearby', globalApproval: 'Not Required', quote: null,
      scheduleDate: selection.pickupTiming === 'scheduled' ? selection.date || '' : '', scheduleSlot: selection.pickupTiming === 'scheduled' ? selection.slot || '' : '', pickupDetails: group.store.address || group.store.location || '',
    }));
    const requestedMethod = selection.deliveryMethod || preferredDeliveryMethod({ ...quote, deliveryAvailable: true });
    const chosen = quote?.methods?.find((entry) => entry.enabled !== false && entry.deliveryType === requestedMethod);
    const meetsMinimum = quote?.minimumOrder == null || group.subtotal >= Number(quote.minimumOrder);
    const available = Boolean(quote?.deliveryZoneId && chosen && meetsMinimum && (quote.deliveryAvailable !== false || quote.minimumOrder != null));
    const charge = Number(chosen?.deliveryCharge ?? quote?.deliveryCharge ?? 0);
    return group.items.map((item) => ({
      ...baseLine(item), deliveryType: chosen?.deliveryType || selection.deliveryMethod || 'standard',
      deliveryLabel: chosen?.deliveryType || 'Delivery',
      estimatedDelivery: chosen?.estimatedTime || (quote?.estimatedDeliveryMin && quote?.estimatedDeliveryMax ? `${quote.estimatedDeliveryMin}-${quote.estimatedDeliveryMax} min` : ''),
      deliveryCharge: charge, fulfillmentType: 'nearby', globalApproval: 'Not Required', quote,
      quoteUnavailable: !available || Boolean(quoteState.error), scheduleDate: deliveryMethodId(chosen?.deliveryType || '') === 'scheduled' ? selection.date || '' : '', scheduleSlot: deliveryMethodId(chosen?.deliveryType || '') === 'scheduled' ? selection.slot || '' : '',
    }));
  }), [cartStoreGroups, deliveryQuotesByStore, savedFulfillmentByStore, customerLat, customerLng]);
  const isGlobalReview = deliveryLines.some((line) => line.fulfillmentType === 'global');
  const hasGlobalDelivery = cartStoreGroups.some((group) => group.global);
  const hasDraftDeliverySelection = hasGlobalDelivery || cartStoreGroups.some((group) => !group.global && selectionForStore(fulfillmentByStore, group.id, initialFulfillment).fulfillment === 'delivery');
  const hasDeliverySelection = cartStoreGroups.some((group) => !group.global && savedFulfillmentByStore[group.id]?.fulfillment === 'delivery');
  const requiresDeliveryAddress = hasGlobalDelivery || hasDeliverySelection;
  const deliveryFee = totalDeliveryCharge(deliveryLines);
  const handlingFee = cartStoreGroups.length * 5;
  const deliveryGroups = deliveryLines.reduce((groups, line) => {
    const key = `${line.fulfillmentType || 'checking'}:${line.storeId || 'store'}:${line.deliveryType || 'delivery'}`;
    const existing = groups.find((group) => group.key === key);
    const group = existing || { key, line, lines: [] };
    group.lines.push(line);
    if (!existing) groups.push(group);
    return groups;
  }, []);
  const summaryStoreGroups = cartStoreGroups.map((group) => ({ ...group, key: group.id, lines: deliveryLines.filter((line) => line.storeId === group.storeId) }));
  const discount = appliedCoupon ? calculateCouponDiscount(appliedCoupon, subtotal) : 0;
  const total = subtotal + deliveryFee + handlingFee - discount;
  const chooseSavedAddress = (address) => {
    clearSelectedLocation();
    setSelectedAddressId(address.id);
    setDeliveryAddress(address.address);
    setAddressPickerOpen(false);
    setError('');
  };
  const chooseCheckoutAddress = (address) => {
    if (address.id === 'selected-location') {
      setSelectedAddressId(address.id);
      setDeliveryAddress(address.address);
      setAddressPickerOpen(false);
      setError('');
      return;
    }
    chooseSavedAddress(address);
  };
  const checkoutMapUrl = Number.isFinite(customerLat) && Number.isFinite(customerLng) ? openStreetMapEmbedUrl({ lat: customerLat, lng: customerLng, delta: 0.006 }) : '';
  const scheduleDatesFor = (group) => {
    const today = new Date();
    const offset = scheduleDateOffsets[group.id] || 0;
    return Array.from({ length: 3 }, (_, index) => {
      const day = new Date(today);
      day.setDate(today.getDate() + offset + index);
      return { value: localDateValue(day), title: offset + index === 0 ? 'Today' : offset + index === 1 ? 'Tomorrow' : day.toLocaleDateString('en-IN', { weekday: 'short' }), subtitle: day.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) };
    });
  };
  const quoteForStore = (group) => {
    const state = deliveryQuotesByStore[group.id];
    return state?.contextKey === `${customerLat}:${customerLng}:${group.subtotal}` ? state.quote : null;
  };
  const methodsForStore = (group) => {
    const quote = quoteForStore(group);
    return sortDeliveryMethods((quote?.methods || []).filter((item) => item.enabled !== false && deliveryMethodId(item.deliveryType) !== 'pickup'));
  };
  const selectedDeliveryMethodFor = (group) => {
    const selection = selectionForStore(fulfillmentByStore, group.id, initialFulfillment);
    const options = methodsForStore(group);
    const quote = quoteForStore(group);
    const preferred = selection.deliveryMethod || (quote ? preferredDeliveryMethod({ ...quote, deliveryAvailable: true }) : '');
    return options.find((item) => item.deliveryType === preferred) || null;
  };
  const scheduleSlotsFor = (group) => {
    const selection = selectionForStore(fulfillmentByStore, group.id, initialFulfillment);
    const date = selection.date || scheduleDatesFor(group)[0]?.value;
    return generateRequestedTimes({ date });
  };
  const chosenSlotFor = (group) => {
    const selection = selectionForStore(fulfillmentByStore, group.id, initialFulfillment);
    return scheduleSlotsFor(group).find((item) => item.value === selection.slot) || null;
  };
  const saveStoreSelection = (group) => {
    const selection = selectionForStore(fulfillmentByStore, group.id, initialFulfillment);
    if (selection.fulfillment === 'pickup') {
      if (group.store.pickup === 'No' || group.store.pickupEnabled === false) return setError(`${group.name} does not support store pickup.`);
      if (selection.pickupTiming === 'scheduled' && (!selection.date || !selection.slot || !scheduleSlotsFor(group).some((item) => item.value === selection.slot))) return setError(`Choose a preferred pickup date and time for ${group.name}.`);
    } else {
      if (!(selectedLocation?.address || deliveryAddress)) return setError(`Select a delivery address for ${group.name}.`);
      const state = deliveryQuotesByStore[group.id];
      const contextKey = `${customerLat}:${customerLng}:${group.subtotal}`;
      if (state?.contextKey !== contextKey || state.loading) return setError(`Delivery availability is still loading for ${group.name}.`);
      if (state.error || !state.quote?.deliveryZoneId) return setError(state.error || `Delivery is unavailable for ${group.name} at this address.`);
      const method = selectedDeliveryMethodFor(group);
      const meetsMinimum = state.quote.minimumOrder == null || group.subtotal >= Number(state.quote.minimumOrder);
      if (!method || !meetsMinimum) return setError(state.quote.message || `Choose an available delivery method for ${group.name}.`);
      if (deliveryMethodId(method.deliveryType) === 'scheduled' && (!selection.date || !selection.slot || !scheduleSlotsFor(group).some((item) => item.value === selection.slot))) return setError(`Choose a preferred delivery date and time for ${group.name}.`);
    }
    setSavedFulfillmentByStore((current) => ({
      ...current,
      [group.id]: { ...selection, addressContext: selection.fulfillment === 'delivery' ? `${customerLat}:${customerLng}` : '' },
    }));
    setError('');
    setExpandedStoreId('');
  };
  const showNextScheduleDates = (group) => {
    setScheduleDateOffsets((offsets) => ({ ...offsets, [group.id]: (offsets[group.id] || 0) + 1 }));
    updateStoreSelection(setFulfillmentByStore, group.id, { date: '', slot: '' });
  };
  const showPreviousScheduleDates = (group) => {
    setScheduleDateOffsets((offsets) => ({ ...offsets, [group.id]: Math.max((offsets[group.id] || 0) - 1, 0) }));
    updateStoreSelection(setFulfillmentByStore, group.id, { date: '', slot: '' });
  };

  const applyCouponCode = async (value) => {
    const code = String(value || '').trim().toUpperCase();
    const customerLocation = selectedLocation?.city || selectedAddress.manualLocation?.city || userCity || '';
    const context = cartPromotionContext({ cartItems, catalogProducts, fallbackLocation: customerLocation, fallbackStore: selectedStore?.name || sourceStoreName || '' });
    setCoupon(code);
    if(!code){setAppliedCoupon(null);setCouponMessage('Enter a coupon code.');return false;}
    setCouponBusy(true);setCouponMessage('Checking coupon...');
    const result=await validateCouponCode(code,{subtotal,location:context.location||customerLocation,store:context.store});
    if (!result.valid) {
      setAppliedCoupon(null);
      setCouponMessage(result.message);
      setCouponBusy(false);
      return false;
    }
    setAppliedCoupon(result.coupon);
    setCouponMessage(result.message);
    setCouponBusy(false);
    return true;
  };

  const applyCoupon = () => { void applyCouponCode(coupon); };

  useEffect(() => {
    const pending = consumePendingCouponCode();
    if (!pending) return undefined;
    const timer = window.setTimeout(() => applyCouponCode(pending), 0);
    return () => window.clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const proceed = () => {
    if (!cartItems.length) return setError('Your cart is empty.');
    const policyError = checkoutReviewError({ groupCount: deliveryGroups.length, handlingFee, discount, coupon: appliedCoupon?.name, promotionVerified:Boolean(appliedCoupon) });
    if (policyError) return setError(policyError);
    if (requiresDeliveryAddress && !(selectedLocation?.address || deliveryAddress)) return setError('Select a delivery address before continuing.');
    if (quoteLoading) return setError('Store delivery availability is still loading.');
    for (const group of cartStoreGroups) {
      if (group.global) continue;
      const selection = savedFulfillmentByStore[group.id];
      if (!selection) {
        setExpandedStoreId(group.id);
        return setError(`Save a fulfillment selection for ${group.name} before continuing.`);
      }
      if (selection.fulfillment === 'delivery' && selection.addressContext !== `${customerLat}:${customerLng}`) {
        setExpandedStoreId(group.id);
        return setError(`Review the delivery selection for ${group.name}; the delivery address changed.`);
      }
      if (selection.fulfillment === 'pickup') {
        if (group.store.pickup === 'No' || group.store.pickupEnabled === false) return setError(`${group.name} does not support store pickup.`);
        if (selection.pickupTiming === 'scheduled' && (!selection.date || !selection.slot || !scheduleSlotsFor(group).some((item) => item.value === selection.slot))) return setError(`Choose a preferred pickup date and time for ${group.name}.`);
        continue;
      }
      const lines = deliveryLines.filter((line) => line.storeId === group.storeId);
      if (!lines.length || lines.some((line) => line.quoteUnavailable)) return setError(`Delivery is unavailable or could not be verified for ${group.name}.`);
      if (lines.some((line) => deliveryMethodId(line.deliveryType) === 'scheduled') && (!selection.date || selection.date !== (scheduleDatesFor(group).find((item) => item.value === selection.date)?.value) || !selection.slot || !scheduleSlotsFor(group).some((item) => item.value === selection.slot))) return setError(`Choose a preferred delivery date and time for ${group.name}.`);
    }
    if (contactEditing) return setError('Save the Contact Number before continuing.');
    if (!isValidIndianMobile(contactPhone)) return setError('Enter a valid 10-digit Contact Number.');
    const firstLine = deliveryLines[0] || {};
    const deliveryModeForCheckout = cartStoreGroups.some((group) => !group.global && savedFulfillmentByStore[group.id]?.fulfillment === 'pickup')
      ? (hasDeliverySelection || hasGlobalDelivery ? 'mixed' : 'pickup') : 'delivery';
    const firstSelection = cartStoreGroups[0] ? (savedFulfillmentByStore[cartStoreGroups[0].id] || {}) : {};
    navigate('/payment-options', { state: { checkout: {
      method: deliveryLines.length === 1 ? firstLine.deliveryType : 'mixed', deliveryMode: deliveryModeForCheckout,
      fulfillmentType: isGlobalReview ? 'mixed' : 'nearby', channel: isGlobalReview ? 'Global Fulfillment' : 'Nearby Store',
      globalApproval: isGlobalReview ? 'Pending' : 'Not Required', deliveryLines,
      sourceStoreId: sourceStoreId, sourceStore: sourceStoreName, sourceLocation: selectedStore?.location || '', sourceState: selectedStore?.state || '',
      date: firstLine.scheduleDate || '', slot: firstLine.scheduleSlot || '',
      notes: notes.trim(), coupon: appliedCoupon?.name || '', discount, promotionVerified:Boolean(appliedCoupon), subtotal, deliveryFee,
      handlingFee, total, deliveryAddress: requiresDeliveryAddress ? (selectedLocation?.address || deliveryAddress) : '',
      contactNumber: contactPhone, customerLocation: String(selectedLocation?.city || userCity || '').trim().slice(0, 150),
      deliveryQuote: deliveryLines.find((line) => line.fulfillmentType !== 'global' && line.quote)?.quote || null,
      customerLatitude: Number.isFinite(customerLat) ? customerLat : null, customerLongitude: Number.isFinite(customerLng) ? customerLng : null,
      storeLatitude: selectedStore?.latitude ?? null, storeLongitude: selectedStore?.longitude ?? null,
      storeSelections: Object.fromEntries(cartStoreGroups.map((group) => [group.id, savedFulfillmentByStore[group.id] || selectionForStore(fulfillmentByStore, group.id, initialFulfillment)])),
      pickupStore: firstSelection.fulfillment === 'pickup' ? sourceStoreName : '',
    } } });
  };
  const editContactNumber = () => {
    setContactDraft(contactPhone);
    setContactError('');
    setContactEditing(true);
  };
  const saveContactNumber = () => {
    const normalized = formatIndianMobile(contactDraft);
    if (!normalized) {
      setContactError('Enter a valid 10-digit mobile number.');
      return;
    }
    setContactPhone(normalized);
    setContactDraft(normalized);
    setContactError('');
    setContactEditing(false);
    setError('');
  };

  if (sessionStorage.getItem(COMPLETED_CHECKOUT_RETURN_KEY)) return <Box role="status" sx={{ p: 3 }}>Returning to your cart…</Box>;

  return <Box className="checkout-page">
    <Box component="header" className="checkout-header">
      <Box className="checkout-breadcrumb"><button type="button" onClick={() => navigate('/home')}>Home</button><span>›</span><button type="button" onClick={() => navigate('/cart')}>Cart</button><span>›</span><strong>Checkout</strong></Box>
      <Box component="nav" aria-label="Checkout progress" className="checkout-stepper">
        <Box className="checkout-step complete"><span><CheckCircleOutlineOutlinedIcon /></span><b>Cart</b></Box><i />
        <Box className="checkout-step current" aria-current="step"><span>2</span><b>Checkout</b></Box><i />
        <Box className="checkout-step"><span>3</span><b>Payment</b></Box><i />
        <Box className="checkout-step"><span>4</span><b>Confirmation</b></Box>
      </Box>
    </Box>

    <Box className="checkout-scroll">
      <Box className="checkout-layout">
        <Box className="checkout-main-column">
          {error && <Typography className="checkout-error" role="alert">{error}</Typography>}

          <Box component="section" className="checkout-panel">
            <Box className="checkout-section-heading">
              <span className="checkout-section-icon"><LocationOnOutlinedIcon /></span>
              <Box><Typography component="h2">1. Delivery address</Typography><small>{hasGlobalDelivery ? 'Required for Global delivery and stores offering delivery' : hasDraftDeliverySelection ? 'Used by each store offering delivery' : 'No delivery address is needed for store pickup'}</small></Box>
              {hasDraftDeliverySelection && <Button onClick={() => navigate('/address-form', { state: { returnTo: '/checkout', location: selectedLocation } })}><AddLocationAltOutlinedIcon /> Add New Address</Button>}
            </Box>
            {hasDraftDeliverySelection ? <Box className="checkout-address-layout">
              <Box className="checkout-address-grid">
                {displayedAddresses.map((address) => <Box className="checkout-address-choice" key={address.id}>
                  <button type="button" className={`checkout-address-card ${selectedAddressId === address.id ? 'selected' : ''}`} aria-pressed={selectedAddressId === address.id} onClick={() => chooseCheckoutAddress(address)}>
                    <span className="checkout-radio" /><span className="checkout-address-copy"><span className="checkout-address-label">{displayAddressType(address.type)}{address.isDefault && <b>Default</b>}</span><strong>{address.address}</strong></span>
                  </button>
                  {!address.isDefault && address.id && !address.fromOrder && <Button className="checkout-set-default" onClick={() => setDefaultAddress(address.id).catch((reason) => setError(reason.message || 'Could not update your default address.'))}>Set as default</Button>}
                </Box>)}
                {selectableAddresses.all.length > 3 && <Button className="checkout-more-addresses" onClick={() => setAddressPickerOpen(true)}>More saved addresses</Button>}
              </Box>
              <Box className="checkout-address-map">{checkoutMapUrl ? <iframe title="Delivery location map" src={checkoutMapUrl} /> : <Box className="checkout-map-placeholder"><LocationOnOutlinedIcon /></Box>}</Box>
              <Button className="checkout-instructions-link" onClick={() => setDeliveryInstructionsOpen(true)}><HomeOutlinedIcon />{deliveryInstructions || deliveryPhotos.length ? 'Delivery instructions added' : 'Add delivery instructions & photos'}</Button>
            </Box> : <Typography className="checkout-muted">Choose delivery for a store below to use a saved address.</Typography>}
          </Box>

          <Box component="section" className="checkout-panel">
            <Box className="checkout-section-heading">
              <span className="checkout-section-icon"><LocalShippingOutlinedIcon /></span>
              <Box><Typography component="h2">2. Fulfillment by store</Typography><small>Each store has an independent delivery or pickup selection</small></Box>
            </Box>
            <Box className="checkout-store-fulfillment-list">
              {cartStoreGroups.map((group) => {
                const selection = selectionForStore(fulfillmentByStore, group.id, initialFulfillment);
                const savedSelection = savedFulfillmentByStore[group.id];
                const savedLine = deliveryLines.find((line) => line.storeId === group.storeId);
                const hasUnsavedChanges = savedSelection && ['fulfillment', 'deliveryMethod', 'pickupTiming', 'date', 'slot'].some((key) => selection[key] !== savedSelection[key]);
                const requiresReview = hasUnsavedChanges || savedSelection?.fulfillment === 'delivery' && savedSelection.addressContext !== `${customerLat}:${customerLng}`;
                const expanded = expandedStoreId === null
                  ? group.id === cartStoreGroups.find((item) => !item.global)?.id
                  : expandedStoreId === group.id;
                const rawQuoteState = deliveryQuotesByStore[group.id] || {};
                const quoteState = rawQuoteState.contextKey === `${customerLat}:${customerLng}:${group.subtotal}` ? rawQuoteState : { loading: selection.fulfillment === 'delivery' };
                const methods = methodsForStore(group);
                const selectedMethod = selectedDeliveryMethodFor(group);
                const pickupAvailableForStore = !group.global && group.store.pickup !== 'No' && group.store.pickupEnabled !== false && group.store.active !== false && String(group.store.status || 'Active').toLowerCase() === 'active';
                const scheduledDelivery = selection.fulfillment === 'delivery' && deliveryMethodId(selectedMethod?.deliveryType || '') === 'scheduled';
                const scheduledPickup = selection.fulfillment === 'pickup' && selection.pickupTiming === 'scheduled';
                const scheduling = scheduledDelivery || scheduledPickup;
                const dates = scheduleDatesFor(group);
                const selectedDate = selection.date || dates[0]?.value || '';
                const slots = scheduleSlotsFor(group);
                const selectedSlot = chosenSlotFor(group);
                const pickupReady = group.store.pickupPreparationTime || group.store.pickupPreparationMinutes && `${group.store.pickupPreparationMinutes} min` || '';
                return <Box className={`checkout-store-accordion ${expanded ? 'expanded' : ''}`} key={group.id}>
                  <button type="button" className="checkout-store-accordion-heading" aria-expanded={expanded} onClick={() => setExpandedStoreId(expanded ? '' : group.id)}>
                    <Box className="checkout-store-accordion-title"><strong>{group.name}</strong><small>{group.items.length} item{group.items.length === 1 ? '' : 's'} · {formatCurrency(group.subtotal)}</small>
                      {group.global ? <small>Global delivery</small> : savedSelection ? <small>{requiresReview ? hasUnsavedChanges ? 'Unsaved changes' : 'Delivery address changed — review this selection' : savedSelection.fulfillment === 'pickup' ? `Store pickup${savedSelection.slot ? ` · ${formatSlotValue(savedSelection.slot)}` : ''}` : `${savedSelection.deliveryMethod || savedLine?.deliveryLabel || 'Delivery'}${savedSelection.slot ? ` · ${formatSlotValue(savedSelection.slot)}` : ''}`}</small> : <small>Configure fulfillment</small>}
                    </Box>
                    <span className={`checkout-store-save-status ${group.global || savedSelection && !requiresReview ? 'saved' : ''}`}>{group.global || savedSelection && !requiresReview ? 'Saved' : savedSelection ? 'Review changes' : 'Not configured'}</span>
                    <ChevronRightIcon className="checkout-store-chevron" />
                  </button>
                  {expanded && <Box className="checkout-store-accordion-content">
                  <Box className="checkout-store-fulfillment-heading"><Box><strong>{group.name}</strong><small>{group.items.length} item{group.items.length === 1 ? '' : 's'} in this store</small></Box><b>{formatCurrency(group.subtotal)}</b></Box>
                  {group.global ? <Box className="checkout-global-fulfillment"><LocalShippingOutlinedIcon /><Box><strong>Global delivery</strong><small>Estimated delivery: 7-10 days - No local pickup</small></Box></Box> : <>
                    <Box className="checkout-mode-switch" role="group" aria-label={`${group.name} fulfillment`}>
                      <button type="button" className={selection.fulfillment === 'delivery' ? 'selected' : ''} aria-pressed={selection.fulfillment === 'delivery'} onClick={() => { updateStoreSelection(setFulfillmentByStore, group.id, { fulfillment: 'delivery', date: '', slot: '' }); setError(''); }}><LocalShippingOutlinedIcon /> Delivery</button>
                      <button type="button" disabled={!pickupAvailableForStore} className={selection.fulfillment === 'pickup' ? 'selected' : ''} aria-pressed={selection.fulfillment === 'pickup'} onClick={() => { updateStoreSelection(setFulfillmentByStore, group.id, { fulfillment: 'pickup', pickupTiming: 'asap', date: '', slot: '' }); setError(''); }}><StorefrontOutlinedIcon /> Store pickup</button>
                    </Box>
                    {selection.fulfillment === 'delivery' ? <>
                      {quoteState.loading && <Typography className="checkout-muted" role="status">Checking delivery for this store-</Typography>}
                      {quoteState.error && <Typography className="checkout-delivery-note error" role="alert">{quoteState.error}</Typography>}
                      {quoteState.quote && quoteState.quote.deliveryZoneId && quoteState.quote.minimumOrder != null && group.subtotal < Number(quoteState.quote.minimumOrder) && <Typography className="checkout-delivery-note error">Minimum order for this delivery area is {formatCurrency(quoteState.quote.minimumOrder)}.</Typography>}
                      <Box className="checkout-time-options">
                        {methods.map((item) => {
                          const active = selectedMethod?.deliveryType === item.deliveryType;
                          const amount = Number(item.deliveryCharge ?? quoteState.quote?.deliveryCharge ?? 0);
                          const caption = [item.estimatedTime, amount > 0 ? formatCurrency(amount) : 'Free delivery'].filter(Boolean).join(' - ');
                          return <button type="button" key={`${group.id}:${item.id || item.deliveryType}`} className={`checkout-time-card ${active ? 'selected' : ''}`} aria-pressed={active} onClick={() => { updateStoreSelection(setFulfillmentByStore, group.id, { fulfillment: 'delivery', deliveryMethod: item.deliveryType, date: deliveryMethodId(item.deliveryType) === 'scheduled' ? selection.date || '' : '', slot: deliveryMethodId(item.deliveryType) === 'scheduled' ? selection.slot || '' : '' }); setError(''); }}>
                            <span className="checkout-method-check">{active ? '✓' : ''}</span><span><strong>{item.deliveryType}</strong><small>{caption || 'Availability confirmed for this address'}</small></span>
                          </button>;
                        })}
                        {!quoteState.loading && !quoteState.error && !methods.length && <Typography className="checkout-muted">{quoteState.quote?.message || 'No delivery methods are available for this store and address.'}</Typography>}
                      </Box>
                      {quoteState.quote && <Typography className="checkout-delivery-note">{quoteState.quote.distanceKm != null ? `${quoteState.quote.distanceKm} km from store` : ''}{quoteState.quote.freeDeliveryApplied ? ' - Free delivery applied' : ''}</Typography>}
                    </> : <Box className="checkout-pickup-details">
                      <StorefrontOutlinedIcon /><Box><strong>{group.name}</strong><span>{group.store.address || group.store.location || 'Store pickup location'}</span>{pickupReady && <small>Preparation estimate: {pickupReady}</small>}{(group.store.pickupInstructions || group.store.deliveryNotes) && <small>{group.store.pickupInstructions || group.store.deliveryNotes}</small>}</Box>
                    </Box>}
                    {selection.fulfillment === 'pickup' && <Box className="checkout-pickup-options">
                      <Button variant={selection.pickupTiming !== 'scheduled' ? 'contained' : 'outlined'} onClick={() => { updateStoreSelection(setFulfillmentByStore, group.id, { pickupTiming: 'asap', date: '', slot: '' }); setError(''); }}>Pickup when ready<small>{pickupReady ? `Preparation estimate - ${pickupReady}` : 'Ready time confirmed by store'}</small></Button>
                      <Button variant={selection.pickupTiming === 'scheduled' ? 'contained' : 'outlined'} onClick={() => { updateStoreSelection(setFulfillmentByStore, group.id, { pickupTiming: 'scheduled', date: selection.date || dates[0]?.value || '', slot: '' }); setError(''); }}>Schedule pickup<small>Request a preferred pickup time</small></Button>
                    </Box>}
                    {scheduling && <Box className="checkout-schedule-panel">
                      <Typography component="h3">{scheduledPickup ? 'Schedule pickup' : 'Schedule delivery'}</Typography>
                      <Box className="checkout-schedule-dates">
                        <Button aria-label={`Show previous ${group.name} dates`} disabled={(scheduleDateOffsets[group.id] || 0) === 0} onClick={() => showPreviousScheduleDates(group)}><ChevronLeftIcon /></Button>
                        {dates.map((item) => <Button key={`${group.id}:${item.value}`} className={selectedDate === item.value ? 'selected' : ''} onClick={() => { updateStoreSelection(setFulfillmentByStore, group.id, { date: item.value, slot: '' }); setError(''); }}><strong>{item.title}</strong><small>{item.subtitle}</small></Button>)}
                        <Button aria-label={`Show next ${group.name} dates`} onClick={() => showNextScheduleDates(group)}><ChevronRightIcon /></Button>
                      </Box>
                      <DigitalTimePicker slots={slots} value={selection.slot} onChange={(value) => { updateStoreSelection(setFulfillmentByStore, group.id, { date: selectedDate, slot: value }); setError(''); }} label={scheduledPickup ? 'Preferred pickup time' : 'Preferred delivery time'} />
                      <Typography className="checkout-schedule-notice">This is your requested time. If it is unavailable, the store manager will contact you to arrange another time.</Typography>
                      {selectedSlot && <Typography className="checkout-schedule-summary">{selectedDate}, {selectedSlot.label}</Typography>}
                    </Box>}
                  </>}
                  {!group.global && <Button className="checkout-save-store-selection" variant="contained" onClick={() => saveStoreSelection(group)}>Save Selection</Button>}
                  </Box>}
                </Box>;
              })}
            </Box>
          </Box>
          <Box component="section" className="checkout-panel">
            <Box className="checkout-section-heading">
              <span className="checkout-section-icon"><PersonOutlineOutlinedIcon /></span>
              <Box><Typography component="h2">3. Contact Details</Typography><small>Used for delivery updates about this order</small></Box>
              <Button onClick={() => navigate('/profile', { state: { returnTo: '/checkout' } })}><EditOutlinedIcon /> Update from Profile</Button>
            </Box>
            <Box className="checkout-contact-grid">
              <label><span>Full Name</span><input value={user?.name || user?.fullName || ''} readOnly placeholder="Name on account" /></label>
              <label><span>Phone Number</span>{contactEditing ? <TextField autoFocus size="small" fullWidth value={contactDraft} onChange={(event) => { setContactDraft(event.target.value); setContactError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); saveContactNumber(); } if (event.key === 'Escape') { setContactEditing(false); setContactError(''); } }} error={Boolean(contactError)} helperText={contactError || 'Enter a 10-digit Indian mobile number'} inputProps={{ inputMode: 'tel', maxLength: 16 }} /> : <Box className="checkout-phone-field"><input value={contactPhone} readOnly placeholder="Add contact number" /><Button onClick={editContactNumber}>Edit</Button></Box>}</label>
              <label><span>Email</span><input value={user?.email || ''} readOnly placeholder="Email on account" /></label>
              {contactEditing && <Box className="checkout-contact-actions"><Button variant="contained" onClick={saveContactNumber}>Save</Button><Button onClick={() => { setContactEditing(false); setContactError(''); }}>Cancel</Button></Box>}
            </Box>
          </Box>

          <Box component="section" className="checkout-panel checkout-notes-panel">
            <Box className="checkout-section-heading">
              <span className="checkout-section-icon"><EditOutlinedIcon /></span>
              <Box><Typography component="h2">4. Order Notes <small>(Optional)</small></Typography><small>Anything we should know before delivery?</small></Box>
            </Box>
            <TextField fullWidth className="checkout-notes-field" placeholder="Add special instructions for delivery (e.g. gate code, landmark, leave at door, etc.)" multiline minRows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            <Box className="checkout-coupon-row"><TextField fullWidth size="small" label="Coupon code" value={coupon} onChange={(event) => { setCoupon(event.target.value.toUpperCase()); setAppliedCoupon(null); setCouponMessage(''); }} helperText={couponMessage || 'Try TEST10 or TEST100.'} error={Boolean(couponMessage && !appliedCoupon && !couponBusy)} color={appliedCoupon ? 'success' : 'primary'} /><Button variant="outlined" onClick={applyCoupon} disabled={couponBusy}>{couponBusy?'Checking...':appliedCoupon ? 'Applied' : 'Apply'}</Button></Box>
          </Box>
        </Box>

        <Box component="aside" className="checkout-summary">
          <Box className="checkout-summary-heading"><ShoppingCartOutlinedIcon /><Box><Typography component="h2">Order Summary</Typography><small>{cartItems.length} item{cartItems.length === 1 ? '' : 's'} from {summaryStoreGroups.length} store{summaryStoreGroups.length === 1 ? '' : 's'}</small></Box></Box>
          <Box className="checkout-summary-stores">
            {summaryStoreGroups.map((group) => {
              const isGlobalStore = group.lines.some((line) => line.fulfillmentType === 'global');
              const isConfigured = isGlobalStore || Boolean(savedFulfillmentByStore[group.id]);
              const isPickupStore = group.lines.length > 0 && group.lines.every((line) => line.deliveryType === 'pickup');
              const storeLine = group.lines[0] || {};
              const storeCharge = isGlobalStore || isPickupStore ? 0 : Number(storeLine.deliveryCharge || 0);
              const scheduledLabel = storeLine.scheduleSlot ? `${storeLine.scheduleDate}, ${formatClockTime(Number(storeLine.scheduleSlot.slice(0, 2)) * 60 + Number(storeLine.scheduleSlot.slice(3, 5))).label}` : '';
              const storeSubtotal = group.items.reduce((sum, item) => sum + Number(item.price || item.unitPrice || 0) * Number(item.quantity || 0), 0);
              return <Box className="checkout-summary-store" key={group.key}>
                <Box className="checkout-summary-store-heading"><StorefrontOutlinedIcon /><strong>{group.name}</strong><span className={`checkout-fulfillment-pill ${isGlobalStore ? 'global' : ''}`}>{isGlobalStore ? 'Global' : isConfigured ? isPickupStore ? 'Pick-up' : 'Delivery' : 'Not configured'}</span></Box>
                {group.items.map((item) => <Box className="checkout-summary-item" key={`${item.storeId}:${item.productId}:${item.variantId}`}>
                  <SafeProductImage className="checkout-summary-image" src={item.image} alt={item.title} />
                  <Box className="checkout-summary-item-copy"><strong>{item.title}</strong><small>{item.weight || 'Product'} · {item.quantity} × {formatCurrency(Number(item.price ?? item.unitPrice ?? 0))}</small><b>{formatCurrency(Number(item.price ?? item.unitPrice ?? 0) * Number(item.quantity))}</b></Box>
                  <span className="checkout-summary-quantity">{item.quantity}</span>
                </Box>)}
                <Box className="checkout-summary-store-service"><span>{isConfigured ? storeLine.deliveryLabel || 'Fulfillment' : 'Choose a fulfillment option'}</span><strong>{isConfigured && storeCharge ? formatCurrency(storeCharge) : isConfigured ? 'No charge' : ''}</strong></Box>
                {scheduledLabel && <small className="checkout-summary-schedule">{isPickupStore ? 'Scheduled pickup' : 'Scheduled delivery'}: {scheduledLabel}</small>}
                <Box className="checkout-summary-store-subtotal"><span>Store subtotal</span><strong>{formatCurrency(storeSubtotal)}</strong></Box>
              </Box>;
            })}
          </Box>
          {appliedCoupon && <Box className="checkout-summary-discount"><LocalOfferOutlinedIcon /><span>Coupon {appliedCoupon.code || appliedCoupon.couponCode || 'applied'}</span><strong>Applied</strong></Box>}
          <Box className="checkout-summary-totals">
            <Box><span>Subtotal ({cartItems.length} items)</span><strong>{formatCurrency(subtotal)}</strong></Box>
            <Box><span>Delivery Fee</span><strong>{quoteLoading ? 'Calculating…' : formatCurrency(deliveryFee)}</strong></Box>
            <Box><span>Store Handling Charges</span><strong>{formatCurrency(handlingFee)}</strong></Box>
            <Box><span>Discount</span><strong>-{formatCurrency(discount)}</strong></Box>
            <Box className="checkout-summary-total"><span>Total Amount</span><strong>{formatCurrency(total)}</strong></Box>
          </Box>
          <Box className="checkout-secure-note"><CheckCircleOutlineOutlinedIcon /><Box><strong>Secure Checkout</strong><small>Your payment information is encrypted and secure.</small></Box></Box>
          {error && <Typography className="checkout-summary-error" role="alert">{error}</Typography>}
          <Button className="checkout-place-order" variant="contained" onClick={proceed}>Place Order <ChevronRightIcon /></Button>
          <Typography className="checkout-redirect-note">You will be redirected to the payment page</Typography>
        </Box>
      </Box>
    </Box>

    <Dialog open={addressPickerOpen} onClose={() => setAddressPickerOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Select delivery address</DialogTitle>
      <DialogContent className="checkout-address-dialog">
        <Typography>Choose a saved address for this order.</Typography>
        {selectableAddresses.all.map((address) => <Box key={address.id}>
          <Button fullWidth variant={address.id === selectedAddressId ? 'contained' : 'outlined'} onClick={() => chooseCheckoutAddress(address)}><LocationOnOutlinedIcon /><span><strong>{address.type || (address.fromOrder ? 'Previously used' : 'Saved address')}{address.isDefault ? ' · Default' : ''}</strong><small>{address.address}</small></span></Button>
          {!address.isDefault && address.id && !address.fromOrder && <Button size="small" onClick={() => setDefaultAddress(address.id).catch((reason) => setError(reason.message || 'Could not update your default address.'))}>Set as default address</Button>}
        </Box>)}
        {selectableAddresses.saved.map((address) => <Button key={`edit:${address.id}`} onClick={() => navigate('/address-form', { state: { editAddress: address, returnTo: '/checkout' } })}>Edit {address.type || 'saved address'}</Button>)}
        <Button onClick={() => { setAddressPickerOpen(false); navigate('/address-form', { state: { returnTo: '/checkout', location: selectedLocation } }); }}>+ Add a new address</Button>
      </DialogContent>
    </Dialog>
    <Dialog open={deliveryInstructionsOpen} onClose={() => setDeliveryInstructionsOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Delivery instructions</DialogTitle>
      <DialogContent className="checkout-instructions-dialog">
        <TextField label="Instructions for delivery partner" placeholder="For example: call on arrival or leave at the front door" multiline minRows={3} value={deliveryInstructions} onChange={(event) => setDeliveryInstructions(event.target.value)} />
        <Button component="label" variant="outlined">Add photos<input hidden type="file" accept="image/*" multiple onChange={(event) => setDeliveryPhotos(Array.from(event.target.files || []))} /></Button>
        {deliveryPhotos.length > 0 && <Typography>{deliveryPhotos.length} photo{deliveryPhotos.length === 1 ? '' : 's'} selected</Typography>}
      </DialogContent>
      <DialogActions><Button onClick={() => setDeliveryInstructionsOpen(false)}>Cancel</Button><Button variant="contained" onClick={() => setDeliveryInstructionsOpen(false)}>Save</Button></DialogActions>
    </Dialog>
  </Box>;
};

export default CheckoutPage;
