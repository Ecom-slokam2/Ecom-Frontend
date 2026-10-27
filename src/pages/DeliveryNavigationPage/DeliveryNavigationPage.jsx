import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, TextField, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import NavigationIcon from '@mui/icons-material/Navigation';
import RouteIcon from '@mui/icons-material/Route';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useLocation, useNavigate } from 'react-router-dom';
import { deliveryAction, requestDeliveryOtp, saveMyDeliveryLocation } from '../../services/deliveryPartnerApi';
import { openStreetMapDirectionsUrl, reverseGeocodeOpenStreetMap } from '../../services/openStreetMapService';
import DeliveryRouteMap from '../../components/DeliveryRouteMap.jsx';
import logo from '../../assets/images/logo.png';
import './DeliveryNavigationPage.css';
import { deliveryAddressOf, distanceKm, navigationPrerequisiteMessage, resolveDeliveryDestination, validCoordinates } from './deliveryNavigation.js';

const otpValue = (value) => value.replace(/\D/g, '').slice(0, 6);
const DeliveryNavigationPage = () => {
  const navigate = useNavigate();
  const order = useLocation().state?.order;
  const [retryCount, setRetryCount] = useState(0);
  const address = deliveryAddressOf(order);
  const prerequisiteMessage = navigationPrerequisiteMessage(order, address);
  const destinationKey = JSON.stringify([order?.id, address, order?.customerLatitude, order?.customerLongitude, order?.destinationLatitude, order?.destinationLongitude, retryCount]);
  const [origin, setOrigin] = useState(null);
  const [currentPlace, setCurrentPlace] = useState('Waiting for GPS location');
  const [destinationRecord, setDestinationRecord] = useState(null);
  const [routeMetrics, setRouteMetrics] = useState(null);
  const [originErrorState, setOriginErrorState] = useState('');
  const [locationSavedAt, setLocationSavedAt] = useState(null);
  const [locationSaveError, setLocationSaveError] = useState('');
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpNotice, setOtpNotice] = useState('');
  const [otpBusy, setOtpBusy] = useState(false);
  const [completed, setCompleted] = useState(false);
  const destinationMatches = destinationRecord?.key === destinationKey;
  const destination = destinationMatches ? destinationRecord.destination : null;
  const destinationError = destinationMatches ? destinationRecord.error : prerequisiteMessage;
  const originError = originErrorState || (!navigator.geolocation?.watchPosition ? 'Location is unavailable in this browser. Allow GPS access and retry.' : '');

  useEffect(() => {
    let cancelled = false;
    if (!order?.id || prerequisiteMessage) return undefined;
    const requestKey = destinationKey;
    Promise.resolve().then(() => resolveDeliveryDestination(order)).then((result) => {
      if (cancelled) return;
      const coords = validCoordinates(result?.lat, result?.lng);
      if (!coords) {
        setDestinationRecord({ key: requestKey, destination: null, error: 'The delivery address could not be located. Check the address before navigating.' });
        return;
      }
      setDestinationRecord({ key: requestKey, destination: { ...result, ...coords, label: result.label || address }, error: '' });
    }).catch((error) => {
      if (!cancelled) setDestinationRecord({ key: requestKey, destination: null, error: `${error.message} Check the address and retry.` });
    });
    return () => { cancelled = true; };
  }, [address, destinationKey, order, prerequisiteMessage]);

  useEffect(() => {
    if (!order?.id) return undefined;
    if (!navigator.geolocation?.watchPosition) return undefined;
    let cancelled = false;
    let lastSavedAt = 0;
    let lastGeocoded = null;
    const watchId = navigator.geolocation.watchPosition(async ({ coords }) => {
      if (cancelled) return;
      const position = validCoordinates(coords?.latitude, coords?.longitude);
      if (!position) { setOriginErrorState('The browser returned invalid GPS coordinates.'); return; }
      setOrigin(position);
      setOriginErrorState('');
      const shouldResolveName = !lastGeocoded || distanceKm(lastGeocoded, position) > 0.15;
      if (shouldResolveName) {
        lastGeocoded = position;
        reverseGeocodeOpenStreetMap(position.lat, position.lng).then((place) => {
          if (!cancelled && place) setCurrentPlace([place.title, place.city, place.state].filter(Boolean).join(', ') || place.address || 'Current location');
        }).catch(() => { if (!cancelled) setCurrentPlace('Current GPS location'); });
      }
      if (Date.now() - lastSavedAt < 10000) return;
      lastSavedAt = Date.now();
      try {
        await saveMyDeliveryLocation(position.lat, position.lng);
        if (!cancelled) { setLocationSavedAt(new Date().toISOString()); setLocationSaveError(''); }
      } catch (error) {
        if (!cancelled) setLocationSaveError(error.message || 'Could not share live location.');
      }
    }, (error) => {
      if (!cancelled) setOriginErrorState(error.code === 1 ? 'Allow location access to share your live position with the customer.' : 'Current location is unavailable. Retry when GPS is available.');
    }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
    return () => { cancelled = true; navigator.geolocation.clearWatch(watchId); };
  }, [order?.id, retryCount]);

  const onRouteMetrics = useCallback((metrics) => setRouteMetrics(metrics), []);
  const distance = origin && destination ? routeMetrics?.distanceKm ?? distanceKm(origin, destination) : null;
  const directions = origin && destination
    ? openStreetMapDirectionsUrl({ origin: `${origin.lat},${origin.lng}`, destination: `${destination.lat},${destination.lng}` })
    : '';
  const estimate = useMemo(() => routeMetrics?.durationMinutes || (distance ? Math.max(5, Math.ceil(distance / 25 * 60)) : 0), [distance, routeMetrics]);
  const customerName = order?.customer?.name || order?.customerName || order?.shippingAddress?.recipientName || 'Customer';
  const customerPhone = order?.customer?.phone || order?.customerPhone || order?.shippingAddress?.recipientPhone || '';
  const verify = async () => {
    if (otp.length !== 6 || otpBusy) return;
    setOtpBusy(true); setOtpError(''); setOtpNotice('');
    try {
      await deliveryAction(order.id, 'VERIFY', { otp });
      setCompleted(true); setOtp(''); setOtpNotice('Delivery completed. The customer OTP was verified.');
    } catch (error) {
      const message = String(error.message || 'Could not verify the OTP.');
      setOtpError(/incorrect|invalid.*otp|otp.*invalid/i.test(message) ? 'Invalid OTP. Check the six-digit code and try again.' : message);
    } finally { setOtpBusy(false); }
  };
  const resend = async () => {
    if (otpBusy) return;
    setOtpBusy(true); setOtpError(''); setOtpNotice('');
    try { await requestDeliveryOtp(order.id); setOtpNotice('A new OTP request was accepted. Check the customer notification channel.'); }
    catch (error) { setOtpError(error.message || 'Could not request another OTP.'); }
    finally { setOtpBusy(false); }
  };

  if (!order?.id) return <Box className="nav-shell"><Alert severity="warning" sx={{ m: 3 }}>Open navigation from an active delivery to see its customer details and OTP verification.</Alert><Button sx={{ ml: 3 }} startIcon={<ArrowBackIcon />} onClick={() => navigate('/delivery/orders')}>Back to deliveries</Button></Box>;

  return <Box className="nav-shell">
    <Box className="nav-header">
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/delivery/orders')}>Back to deliveries</Button>
      <Box className="nav-brand"><img src={logo} alt="Spices and Pickles" /><Box><Typography fontWeight={800}>Delivery navigation</Typography><Typography variant="caption">Order {order.orderNumber || order.id} · live route</Typography></Box></Box>
      <Button startIcon={<NavigationIcon />} disabled={!directions} onClick={() => window.open(directions, '_blank', 'noopener,noreferrer')}>Open directions</Button>
    </Box>
    <Box className="nav-layout">
      <Box className="nav-map-card">
        <Box className="nav-map-heading"><Box><Typography variant="h6">Live route</Typography><Typography variant="body2">{destination?.source === 'geocoded' ? 'Customer location is an approximate address match' : 'Your GPS position and the customer’s saved delivery location'}</Typography></Box><Box className="nav-map-legend"><span><i className="partner-dot" /> You</span><span><i className="customer-dot" /> Customer</span></Box></Box>
        {destination || origin ? <Box className="nav-map"><DeliveryRouteMap origin={origin} destination={destination} height="100%" onRouteMetrics={onRouteMetrics} /></Box> : <Box className="nav-loading"><NavigationIcon sx={{ fontSize: 52, color: '#075f40' }} /><Typography>{originError || destinationError || prerequisiteMessage || 'Waiting for GPS and delivery location...'}</Typography></Box>}
        {destinationError && <Alert severity="warning" sx={{ m: 2 }} action={<Button color="inherit" size="small" onClick={() => setRetryCount((value) => value + 1)}>Retry</Button>}>{destinationError}</Alert>}
        {destination?.source === 'geocoded' && <Alert severity="info" sx={{ m: 2 }}>No precise coordinates were saved with this order. Confirm the pin against the full delivery address.</Alert>}
        {!destination && !destinationError && <Alert severity="info" sx={{ m: 2 }}>Finding the customer’s saved map location…</Alert>}
        <Box className="nav-live-strip">
          <MyLocationIcon />
          <Box><Typography fontWeight={800}>Your current location</Typography><Typography variant="body2">{currentPlace}{origin ? ` · ${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}` : ''}</Typography></Box>
          <Chip size="small" color={locationSaveError ? 'error' : locationSavedAt ? 'success' : 'default'} label={locationSaveError ? 'Sharing issue' : locationSavedAt ? 'Live sharing on' : originError ? 'GPS unavailable' : 'Finding GPS'} />
        </Box>
        {locationSaveError && <Alert severity="warning" sx={{ m: 2 }}>{locationSaveError}</Alert>}
      </Box>
      <Box className="nav-details">
        <Box className="nav-page-title"><Box><Typography variant="h5">Delivery details</Typography><Typography color="text.secondary">Review the destination and verify the customer OTP here.</Typography></Box><Chip color={completed ? 'success' : 'primary'} label={completed ? 'Delivered' : order.status || 'Out for Delivery'} /></Box>
        {originError && <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={() => setRetryCount((value) => value + 1)}>Retry GPS</Button>}>{originError}</Alert>}
        <Box className="nav-stat-grid">
          <Box><RouteIcon /><span><strong>{distance != null ? `${distance.toFixed(1)} km` : '—'}</strong><small>{routeMetrics ? 'Road route distance' : 'Approx. direct distance'}</small></span></Box>
          <Box><AccessTimeIcon /><span><strong>{estimate ? `~${estimate} min` : '—'}</strong><small>{routeMetrics ? 'Road route estimate' : 'Approx. travel time'}</small></span></Box>
        </Box>
        <Box className="nav-customer-card"><Typography className="nav-section-label"><PersonOutlineOutlinedIcon /> Customer</Typography><Typography fontWeight={800}>{customerName}</Typography>{customerPhone && <Typography variant="body2">{customerPhone}</Typography>}<Typography variant="body2" color="text.secondary">{address}</Typography></Box>
        <Box className="nav-order-card"><Typography className="nav-section-label"><Inventory2OutlinedIcon /> Order</Typography><Typography fontWeight={800}>{order.orderNumber || order.id}</Typography><Typography variant="body2">{order.items?.map((item) => `${item.productName || item.title || item.name || 'Item'} × ${item.quantity}`).join(', ') || 'Order items unavailable'}</Typography><Typography variant="body2" color="text.secondary">Order total: Rs {Number(order.total ?? order.totalAmount ?? 0).toLocaleString('en-IN')}</Typography></Box>
        <Box className="nav-route-summary">
          <Box className="nav-stop"><MyLocationIcon /><span><small>Pickup / current position</small><strong>{origin ? currentPlace : originError || 'Waiting for GPS permission'}</strong></span></Box>
          <Box className="nav-route-line" />
          <Box className="nav-stop destination"><NavigationIcon /><span><small>Delivery destination</small><strong>{destination?.label || address}</strong></span></Box>
        </Box>
        <Box className="nav-otp-card">
          <Typography variant="h6">Confirm delivery</Typography>
          <Typography variant="body2" color="text.secondary">Enter the six-digit code shared by the customer after handing over the order.</Typography>
          {completed ? <Alert severity="success" sx={{ mt: 2 }}>{otpNotice}</Alert> : <>
            {otpError && <Alert severity="error" sx={{ mt: 2 }} role="alert">{otpError}</Alert>}
            {otpNotice && <Alert severity="info" sx={{ mt: 2 }}>{otpNotice}</Alert>}
            <TextField fullWidth autoFocus sx={{ mt: 2 }} label="Customer OTP" value={otp} error={Boolean(otpError)} helperText={otpError || 'Six digits'} slotProps={{ htmlInput: { inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6, autoComplete: 'one-time-code' } }} onChange={(event) => { setOtp(otpValue(event.target.value)); setOtpError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') verify(); }} />
            <Box className="nav-otp-actions"><Button variant="outlined" disabled={otpBusy} onClick={resend}>Resend OTP</Button><Button variant="contained" disabled={otpBusy || otp.length !== 6} onClick={verify}>{otpBusy ? 'Checking…' : 'Verify and complete'}</Button></Box>
          </>}
        </Box>
      </Box>
    </Box>
  </Box>;
};

export default DeliveryNavigationPage;
