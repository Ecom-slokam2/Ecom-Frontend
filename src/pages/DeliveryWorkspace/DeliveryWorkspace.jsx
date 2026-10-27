import { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Select, Switch, TextField, Typography } from '@mui/material';
import { Bar, BarChart, CartesianGrid, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import NavigationOutlinedIcon from '@mui/icons-material/NavigationOutlined';
import MyLocationOutlinedIcon from '@mui/icons-material/MyLocationOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { getMyDeliveryProfile, getMyDeliveries, updateMyDeliveryProfile, setMyAvailability, saveMyDeliveryLocation, deliveryAction, requestDeliveryOtp } from '../../services/deliveryPartnerApi';
import { orgAccessService } from '../../services/orgAccessService';
import { orderedTrackingEvents, passwordChangeErrors } from './deliveryWorkspacePolicy.js';
import { readBrowserPosition } from '../DeliveryNavigationPage/deliveryNavigation.js';
import { deliveryPartnerLocation } from '../../services/deliveryPartnerLocation.js';
import logo from '../../assets/images/logo.png';
import './DeliveryWorkspace.css';

const initialProfile = (user = {}) => ({
  name: user.name || '',
  phone: user.phone || '',
  email: user.email || '',
  vehicleNumber: user.vehicleNumber || '',
  vehicleType: user.vehicleType || 'Bike',
  address: user.address || '',
  location: user.location || '',
  emergencyContact: user.emergencyContact || '',
  licenseNumber: user.licenseNumber || '',
  current: '',
  next: '',
  confirm: '',
});

const NAV_ITEMS = [
  ['dashboard', 'Dashboard', DashboardOutlinedIcon, '/delivery'],
  ['orders', 'Orders', LocalShippingOutlinedIcon, '/delivery/orders'],
  ['history', 'History', HistoryOutlinedIcon, '/delivery/history'],
];

const OUTCOME_LABELS = { DELIVERED: 'Delivered', FAILED: 'Failed', CANCELLED: 'Cancelled', RETURNED: 'Returned' };
const OUTCOME_COLORS = { Delivered: '#0b6e4f', Failed: '#c0392b', Cancelled: '#e67e22', Returned: '#7f8c8d' };
const outcomeOf = (order) => OUTCOME_LABELS[order.status];
const historyDate = (order) => order.deliveredAt || order.shipment?.updatedAt || order.createdAt;
const bucketUnit = (days) => (days <= 31 ? 'day' : days <= 98 ? 'week' : 'month');
const bucketKey = (value, unit) => {
  const date = new Date(value);
  if (unit === 'month') return date.toISOString().slice(0, 7);
  if (unit === 'week') { const shifted = new Date(date); shifted.setDate(date.getDate() - ((date.getDay() + 6) % 7)); return shifted.toISOString().slice(0, 10); }
  return date.toISOString().slice(0, 10);
};
const bucketLabel = (key, unit) => (unit === 'month'
  ? new Date(`${key}-01`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
  : new Date(key).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));

const shippingAddressOf = (order) => order.shippingAddress
  || (order.addresses || []).find((address) => address.addressType === 'SHIPPING')
  || (order.addresses || [])[0]
  || null;
const addressTextOf = (order) => {
  const address = shippingAddressOf(order);
  const parts = address && [address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode].filter(Boolean);
  return (parts && parts.join(', ')) || order.checkout?.deliveryAddress || order.deliveryAddress || order.address || '';
};
const customerNameOf = (order) => shippingAddressOf(order)?.recipientName || order.customer?.name || order.customerName || '';
const customerPhoneOf = (order) => shippingAddressOf(order)?.recipientPhone || order.customer?.phone || order.customerPhone || '';
const orderTotalOf = (order) => Number(order.total ?? order.totalAmount ?? 0);
const money = (value) => `Rs ${Number(value || 0).toLocaleString('en-IN')}`;

const OrderDetails = ({ order }) => {
  const name = customerNameOf(order);
  const phone = customerPhoneOf(order);
  const isCashOnDelivery = /^(COD|CASH_ON_DELIVERY)$/i.test(String(order.paymentMethod || order.paymentMode || ''));
  return <Box className="dw-order-details">
    <Box className="dw-detail-grid">
      <Box>
        <span className="dw-detail-label">Order</span>
        <Typography fontWeight={700}>{order.orderNumber || order.id}</Typography>
        <Typography variant="caption" color="text.secondary">{order.sourceStore || '-'}</Typography>
      </Box>
      <Box>
        <span className="dw-detail-label">Order value</span>
        <Typography fontWeight={700}>{money(orderTotalOf(order))}</Typography>
        {Number(order.deliveryCharge || 0) > 0 && <Typography variant="caption" color="text.secondary">Delivery {money(order.deliveryCharge)}</Typography>}
        {isCashOnDelivery && <Typography variant="body2" color="text.secondary">Cash to collect {money(orderTotalOf(order))}</Typography>}
      </Box>
      <Box>
        <span className="dw-detail-label">Customer</span>
        <Typography fontWeight={700}>{name || 'Name not provided'}</Typography>
        <Typography variant="body2">{phone || 'Phone not provided'}</Typography>
      </Box>
      <Box>
        <span className="dw-detail-label">Delivery address</span>
        <Typography variant="body2">{addressTextOf(order) || 'Address not available'}</Typography>
      </Box>
    </Box>
    {Boolean(order.items?.length) && <Box className="dw-detail-items">
      <span className="dw-detail-label">Items</span>
      {order.items.map((item, index) => <Typography key={item.id || index} variant="body2">
        {(item.productName || item.title || item.name || 'Item')} &times; {item.quantity}
        {Number(item.totalPrice || item.unitPrice) ? ` — ${money(item.totalPrice || Number(item.unitPrice) * Number(item.quantity || 1))}` : ''}
      </Typography>)}
    </Box>}
    {Boolean(order.trackingEvents?.length) && <Box className="dw-detail-items">
      <span className="dw-detail-label">Delivery status history</span>
      {orderedTrackingEvents(order.trackingEvents).map((event, index) => <Box key={event.id || `${event.eventTime}-${index}`} sx={{ display: 'grid', gridTemplateColumns: { sm: '150px 1fr' }, gap: 1, py: 0.5 }}>
        <Typography variant="caption" color="text.secondary">{event.eventTime ? new Date(event.eventTime).toLocaleString('en-IN') : 'Time unavailable'}</Typography>
        <Typography variant="body2"><strong>{event.status}</strong>{event.description ? ` — ${event.description}` : ''}{event.location ? ` (${event.location})` : ''}</Typography>
      </Box>)}
    </Box>}
  </Box>;
};

const DeliveryWorkspace = ({ section = 'dashboard' }) => {
  const navigate = useNavigate();
  const { user, setUser, logout } = useContext(AppContext);
  const [allOrders, setAllOrders] = useState([]);
  const orders = allOrders.filter(order => !['DELIVERED', 'CANCELLED', 'RETURNED', 'FAILED'].includes(order.status));
  const [message, setMessage] = useState('');
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatus, setOrdersStatus] = useState('All');
  const [cancelOrder, setCancelOrder] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [days, setDays] = useState(30);
  const [reportNow] = useState(() => Date.now());
  const [historySearch, setHistorySearch] = useState('');
  const [historySort, setHistorySort] = useState('newest');
  const [historyOutcome, setHistoryOutcome] = useState('All');
  const [expandedId, setExpandedId] = useState(null);
  const [profileOpen, setProfileOpen] = useState(Boolean(user?.mustChangePassword));
  const [profile, setProfile] = useState(() => initialProfile(user));
  const [errors, setErrors] = useState({});
  const [latestPartner, setLatestPartner] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const available = latestPartner?.status === 'Active';
  const sharedLocation = deliveryPartnerLocation(latestPartner);
  const refresh = async () => {
    const rows = await getMyDeliveries();
    setAllOrders(Array.isArray(rows) ? rows : []);
    setOrdersError('');
    getMyDeliveryProfile().then((account) => setLatestPartner((current) => ({ ...current, ...account,
      deliveryLatitude: account.deliveryLatitude ?? current?.deliveryLatitude,
      deliveryLongitude: account.deliveryLongitude ?? current?.deliveryLongitude,
      deliveryLocationUpdatedAt: account.deliveryLocationUpdatedAt ?? current?.deliveryLocationUpdatedAt,
    }))).catch(() => {});
  };
  // The partner profile (org-access only) loads independently of the deliveries feed,
  // which also depends on the order + fulfillment services.
  useEffect(() => {
    let ignore = false;
    getMyDeliveryProfile().then((account) => { if (!ignore) setLatestPartner((current) => ({ ...current, ...account })); }).catch(() => {});
    const timer = setInterval(() => { getMyDeliveryProfile().then((account) => { if (!ignore) setLatestPartner((current) => ({ ...current, ...account,
      deliveryLatitude: account.deliveryLatitude ?? current?.deliveryLatitude,
      deliveryLongitude: account.deliveryLongitude ?? current?.deliveryLongitude,
      deliveryLocationUpdatedAt: account.deliveryLocationUpdatedAt ?? current?.deliveryLocationUpdatedAt,
    })); }).catch(() => {}); }, 30000);
    return () => { ignore = true; clearInterval(timer); };
  }, []);
  useEffect(() => {
    let ignore = false;
    let inFlight = false;
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      return getMyDeliveries().then((rows) => {
      if (ignore) return;
      setAllOrders(Array.isArray(rows) ? rows : []);
      setOrdersError('');
    }).catch((error) => {
      if (!ignore) setOrdersError(error.message || 'Could not load deliveries.');
    }).finally(() => { inFlight = false; if (!ignore) setLoading(false); });
    };
    load();
    const timer = setInterval(load, 15000);
    return () => { ignore = true; clearInterval(timer); };
  }, [reloadKey]);
  const retryOrders = () => { setOrdersError(''); setLoading(true); setReloadKey((value) => value + 1); };
  const act = async (order, action, extra = {}) => {
    setBusy(true);
    try { await deliveryAction(order.id, action, extra); await refresh(); setMessage('Delivery updated.'); }
    catch (error) { setMessage(error.message); throw error; }
    finally { setBusy(false); }
  };
  const accept = order => act(order, 'ACCEPT').catch(() => {});
  const pickup = order => act(order, 'PICKUP').catch(() => {});
  const start = async order => {
    try { await act(order, 'START'); }
    catch (error) { setMessage(error.message); return; }
    try { await requestDeliveryOtp(order.id); setMessage('Delivery started. The customer OTP is saved in notifications.'); }
    catch (error) { setMessage(`Delivery started. Customer OTP could not be sent: ${error.message}`); }
  };
  const changeAvailability = async event => {
    setBusy(true);
    try { const updated = await setMyAvailability(event.target.checked); setLatestPartner(updated); setUser(updated); }
    catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  };
  const cancelAssignedDelivery = async () => {
    try { await act(cancelOrder, 'CANCEL', { reason: cancelReason.trim() }); setCancelOrder(null); setCancelReason(''); }
    catch { /* Error is displayed by act. */ }
  };
  const locate = async () => {
    setLocationBusy(true);
    try {
      const position = await readBrowserPosition();
      await saveMyDeliveryLocation(position.lat, position.lng);
      const savedAt = new Date().toISOString();
      setLatestPartner((current) => ({ ...current, deliveryLatitude: position.lat, deliveryLongitude: position.lng, deliveryLocationUpdatedAt: savedAt }));
      getMyDeliveryProfile().then((account) => setLatestPartner((current) => ({ ...current, ...account,
        deliveryLatitude: account.deliveryLatitude ?? current?.deliveryLatitude,
        deliveryLongitude: account.deliveryLongitude ?? current?.deliveryLongitude,
        deliveryLocationUpdatedAt: account.deliveryLocationUpdatedAt ?? current?.deliveryLocationUpdatedAt,
      }))).catch(() => {});
      setMessage('Live location saved and displayed in your delivery profile.');
    } catch (error) { setMessage(error.message); }
    finally { setLocationBusy(false); }
  };
  const openProfile = () => {
    const latest = latestPartner || {};
    setProfile(initialProfile({ ...user, ...latest, vehicleNumber: latest.vehicleNumber || latest.vehicle }));
    setErrors({});
    setProfileOpen(true);
  };
  const saveProfile = async () => {
    const next = {};
    if (!profile.name.trim()) next.name = 'Name is required.';
    if (!profile.phone.trim()) next.phone = 'Mobile number is required.';
    else if (!/^[+0-9 ()-]{7,30}$/.test(profile.phone.trim())) next.phone = 'Enter a valid mobile number.';
    if (!profile.vehicleNumber.trim()) next.vehicleNumber = 'Vehicle number is required.';
    if (!profile.email.trim()) next.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) next.email = 'Enter a valid email address.';
    Object.assign(next, passwordChangeErrors({ current: profile.current, next: profile.next, confirm: profile.confirm }));
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const updated = await updateMyDeliveryProfile({
        name: profile.name.trim(), phone: profile.phone.trim(), email: profile.email.trim(),
        vehicleNumber: profile.vehicleNumber.trim(), vehicleType: profile.vehicleType,
        address: profile.address, location: profile.location,
        emergencyContact: profile.emergencyContact, licenseNumber: profile.licenseNumber,
      });
      setLatestPartner(updated); setUser(updated);
      if (profile.next) {
        try { await orgAccessService.changePassword({ currentPassword: profile.current, newPassword: profile.next }); }
        catch (error) {
          setProfile(initialProfile(updated));
          setErrors({ form: `Profile saved. Password was not changed: ${error.message}` });
          return;
        }
      }
      setProfile(initialProfile(updated));
      setProfileOpen(false);
      setMessage('Profile settings saved.');
    } catch (error) {
      setErrors({ form: error.message });
    }
  };

  const finishedOrders = useMemo(
    () => allOrders.filter(outcomeOf).sort((a, b) => new Date(historyDate(b)) - new Date(historyDate(a))),
    [allOrders],
  );
  const period = useMemo(
    () => finishedOrders.filter((order) => new Date(historyDate(order)) >= new Date(reportNow - days * 86400000)),
    [finishedOrders, days, reportNow],
  );
  const delivered = period.filter((order) => outcomeOf(order) === 'Delivered');
  const today = delivered.filter((order) => new Date(historyDate(order)).toDateString() === new Date(reportNow).toDateString()).length;
  const successRate = period.length ? Math.round((delivered.length / period.length) * 100) : 0;

  const outcomeData = useMemo(
    () => Object.values(OUTCOME_LABELS)
      .map((name) => ({ name, value: period.filter((order) => outcomeOf(order) === name).length, fill: OUTCOME_COLORS[name] }))
      .filter((slice) => slice.value > 0),
    [period],
  );

  const trendData = useMemo(() => {
    const unit = bucketUnit(days);
    const step = unit === 'day' ? 1 : unit === 'week' ? 7 : 30;
    const buckets = new Map();
    for (let offset = 0; offset <= days; offset += step) {
      const key = bucketKey(reportNow - offset * 86400000, unit);
      if (!buckets.has(key)) buckets.set(key, { key, label: bucketLabel(key, unit), Delivered: 0, Failed: 0 });
    }
    period.forEach((order) => {
      const key = bucketKey(historyDate(order), unit);
      const bucket = buckets.get(key) || { key, label: bucketLabel(key, unit), Delivered: 0, Failed: 0 };
      if (outcomeOf(order) === 'Delivered') bucket.Delivered += 1; else bucket.Failed += 1;
      buckets.set(key, bucket);
    });
    return [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key));
  }, [period, days, reportNow]);

  const historyView = useMemo(() => {
    let rows = period;
    if (historyOutcome !== 'All') rows = rows.filter((order) => outcomeOf(order) === historyOutcome);
    const query = historySearch.trim().toLowerCase();
    if (query) rows = rows.filter((order) => [customerNameOf(order), order.orderNumber, order.id, order.sourceStore]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
    return [...rows].sort((a, b) => (historySort === 'name'
      ? customerNameOf(a).localeCompare(customerNameOf(b))
      : historySort === 'oldest'
        ? new Date(historyDate(a)) - new Date(historyDate(b))
        : new Date(historyDate(b)) - new Date(historyDate(a))));
  }, [period, historyOutcome, historySearch, historySort]);

  const activeStatuses = ['Picked Up', 'Out for Delivery'];
  const visibleOrders = useMemo(() => {
    const term=ordersSearch.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesStatus=ordersStatus==='All'||order.status===ordersStatus;
      const matchesTerm=!term||[order.orderNumber,order.id,customerNameOf(order),customerPhoneOf(order),order.sourceStore,addressTextOf(order)]
        .filter(Boolean).some((value)=>String(value).toLowerCase().includes(term));
      return matchesStatus&&matchesTerm;
    });
  },[orders,ordersSearch,ordersStatus]);
  const sectionTitle = { dashboard: 'Dashboard', orders: 'Assigned Deliveries', history: 'Delivery History' }[section] || 'Dashboard';

  const periodSelect = <Select size="small" value={days} onChange={(event) => setDays(Number(event.target.value))}>
    <MenuItem value={15}>15 days</MenuItem><MenuItem value={30}>30 days</MenuItem><MenuItem value={70}>10 weeks</MenuItem><MenuItem value={365}>1 year</MenuItem>
  </Select>;

  return <Box className="dw-shell">
    <aside className="dw-sidebar">
      <Box className="dw-brand"><img src={logo} alt="Spices and Pickles" /><Box><Typography variant="h6">{latestPartner?.name || user?.name || 'Delivery Partner'}</Typography><Typography variant="caption">{latestPartner?.vehicleNumber || user?.vehicleNumber} - Delivery Partner</Typography></Box></Box>
      <nav className="dw-nav">
        {NAV_ITEMS.map(([id, label, Icon, path]) => <Button key={id} className={section === id ? 'active' : ''} startIcon={<Icon />} onClick={() => navigate(path)}><span>{label}</span></Button>)}
      </nav>
      <Box className="dw-sidebar-footer">
        <FormControlLabel control={<Switch disabled={busy || !latestPartner} checked={available} onChange={changeAvailability} color="default" />} label={available ? 'Active' : 'Inactive'} />
        <Box className="dw-location-summary" aria-live="polite">
          <Typography variant="caption" fontWeight={800}>Your delivery area</Typography>
          <Typography variant="caption">Assigned store: {latestPartner?.store || 'Not assigned'}</Typography>
          <Typography variant="caption">Store base: {latestPartner?.storeLocation || latestPartner?.storeAddress || 'Not recorded'}</Typography>
          <Typography variant="caption">Service region: {latestPartner?.location ? String(latestPartner.location).replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not assigned'}</Typography>
          <Typography variant="caption" fontWeight={800} sx={{ mt: 0.5 }}>Your shared GPS location</Typography>
          {sharedLocation ? <>
            <Typography variant="caption">{sharedLocation.latitude.toFixed(6)}, {sharedLocation.longitude.toFixed(6)}</Typography>
            <Typography variant="caption">Updated {sharedLocation.updatedAt ? new Date(sharedLocation.updatedAt).toLocaleString() : 'time unavailable'}</Typography>
            <Button size="small" component="a" href={sharedLocation.mapUrl} target="_blank" rel="noopener noreferrer">View map</Button>
          </> : <Typography variant="caption">Not shared yet. Use Share GPS to update.</Typography>}
        </Box>
        <Button startIcon={<MyLocationOutlinedIcon />} disabled={locationBusy} onClick={locate}><span>{locationBusy ? 'Locating…' : 'Share GPS'}</span></Button>
        <Button onClick={openProfile}><span>Profile</span></Button>
        <Button onClick={() => { logout(); navigate('/team-login'); }}><span>Sign out</span></Button>
      </Box>
    </aside>

    <main className="dw-main">
      <header className="dw-topbar"><Typography variant="h5" fontWeight={800}>{sectionTitle}</Typography></header>
      {message && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
      {ordersError && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" disabled={loading} onClick={retryOrders}>Retry</Button>}>{ordersError}</Alert>}
      {loading && !ordersError && <Typography sx={{ mb: 2 }} color="text.secondary">Loading deliveries...</Typography>}

      {section === 'dashboard' && <Box className="delivery-history">
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}><Box><Typography variant="h6">Delivery Performance</Typography><Typography variant="body2" color="text.secondary">Charts and delivery outcomes for the selected period.</Typography></Box><Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{periodSelect}<Button variant="outlined" onClick={() => navigate('/delivery/history')}>View historical delivery details</Button></Box></Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2,1fr)', sm: 'repeat(3,1fr)', xl: 'repeat(6,1fr)' }, gap: 2, my: 2 }}>
          <Box><Typography variant="h5">{allOrders.length}</Typography><span>Assigned</span></Box>
          <Box><Typography variant="h5">{orders.length}</Typography><span>Active</span></Box>
          <Box><Typography variant="h5">{today}</Typography><span>Delivered today</span></Box>
          <Box><Typography variant="h5">{delivered.length}</Typography><span>Delivered</span></Box>
          <Box><Typography variant="h5">{successRate}%</Typography><span>Success rate</span></Box>
          <Box><Typography variant="h5">{money(delivered.reduce((sum, order) => sum + orderTotalOf(order), 0))}</Typography><span>Value handled</span></Box>
        </Box>
        {!period.length ? <Box><Typography color="text.secondary">No completed deliveries in this period.</Typography><Button sx={{ mt: 1 }} onClick={() => navigate('/delivery/history')}>Open delivery history</Button></Box> : <Box className="delivery-charts">
          <Box className="delivery-chart">
            <Typography variant="subtitle2">Deliveries over time</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Delivered" stackId="a" fill={OUTCOME_COLORS.Delivered} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Failed" name="Failed / cancelled" stackId="a" fill={OUTCOME_COLORS.Failed} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <Box className="delivery-chart">
            <Typography variant="subtitle2">Success vs failed / cancelled</Typography>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={outcomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(slice) => `${slice.name}: ${slice.value}`} />
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Box>
        </Box>}
      </Box>}

      {section === 'orders' && <>
        <Box className="dw-orders-toolbar">
          <TextField size="small" label="Search order, customer, phone or address" value={ordersSearch} onChange={(event)=>setOrdersSearch(event.target.value)} />
          <Select size="small" value={ordersStatus} onChange={(event)=>setOrdersStatus(event.target.value)} aria-label="Filter deliveries by status">
            {['All',...new Set(orders.map((order)=>order.status))].map((status)=><MenuItem key={status} value={status}>{status==='All'?'All statuses':status}</MenuItem>)}
          </Select>
          <Typography variant="body2" color="text.secondary">{visibleOrders.length} of {orders.length} active deliveries</Typography>
        </Box>
        {!loading && !ordersError && !visibleOrders.length && <Typography color="text.secondary">{orders.length?'No deliveries match your search or status filter.':'No active deliveries.'}</Typography>}
        {visibleOrders.map((order) => <Box className="delivery-order-card" key={order.id}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap' }}>
            <Typography fontWeight={800}>{order.orderNumber || order.id}</Typography>
            <Chip label={order.status} />
          </Box>
          {order.deliveryPartner && <Typography variant="body2" color="text.secondary">Assigned to {order.deliveryPartner.name} - {order.deliveryPartner.vehicleNumber}</Typography>}
          <OrderDetails order={order} />
          {order.deliveryCancelReason && <Alert severity="warning" sx={{ mt: 2 }}>Cancelled reason: {order.deliveryCancelReason}</Alert>}
          <Box className="delivery-actions" component="fieldset" disabled={busy}>
            {!order.deliveryAcceptedAt && <Button variant="contained" onClick={() => accept(order)}>Accept Assignment</Button>}
            {order.deliveryAcceptedAt && !activeStatuses.includes(order.status) && <Button variant="contained" onClick={() => pickup(order)}>Mark Picked Up</Button>}
            {order.status === 'Picked Up' && <Button variant="contained" onClick={() => start(order)}>Mark Out for Delivery</Button>}
            {order.status === 'Out for Delivery' && <Button variant="contained" startIcon={<NavigationOutlinedIcon />} onClick={() => navigate('/delivery/navigation', { state: { order } })}>Navigate &amp; verify OTP</Button>}
            <Button color="error" disabled={['DELIVERED', 'CANCELLED'].includes(order.status)} onClick={() => { setCancelOrder(order); setCancelReason(''); }}>Cancel Delivery</Button>
          </Box>
        </Box>)}
      </>}

      {section === 'history' && <Box className="delivery-history">
        <Box sx={{ mb: 2 }}><Typography variant="h6">Historical delivery details</Typography><Typography variant="body2" color="text.secondary">Search and filter completed or unsuccessful deliveries, then open any row for customer, address, item, and status event details.</Typography></Box>
        <Box className="dw-history-toolbar">
          <TextField size="small" label="Search customer / order" value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} />
          <Select size="small" value={historySort} onChange={(event) => setHistorySort(event.target.value)}>
            <MenuItem value="newest">Newest first</MenuItem><MenuItem value="oldest">Oldest first</MenuItem><MenuItem value="name">Customer name</MenuItem>
          </Select>
          <Select size="small" value={historyOutcome} onChange={(event) => setHistoryOutcome(event.target.value)}>
            {['All', ...Object.values(OUTCOME_LABELS)].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
          </Select>
          {periodSelect}
        </Box>
        <Typography variant="caption" color="text.secondary">{historyView.length} {historyView.length === 1 ? 'delivery' : 'deliveries'}</Typography>
        {!historyView.length ? <Typography color="text.secondary" sx={{ mt: 1 }}>No deliveries match these filters.</Typography> : <Box className="delivery-history-list">
          {historyView.map((order) => <Box key={order.id} className="delivery-history-row-wrap">
            <Box className="delivery-history-row" role="button" tabIndex={0} onClick={() => setExpandedId(expandedId === order.id ? null : order.id)} onKeyDown={(event) => { if (event.key === 'Enter') setExpandedId(expandedId === order.id ? null : order.id); }}>
              <Box>
                <Typography fontWeight={700}>{customerNameOf(order) || order.orderNumber || order.id}</Typography>
                <Typography variant="caption" color="text.secondary">{(order.orderNumber || order.id)} &middot; {order.sourceStore} &middot; {new Date(historyDate(order)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Typography>
              </Box>
              <Chip size="small" label={outcomeOf(order)} sx={{ bgcolor: OUTCOME_COLORS[outcomeOf(order)], color: '#fff', fontWeight: 700 }} />
            </Box>
            {expandedId === order.id && <OrderDetails order={order} />}
          </Box>)}
        </Box>}
      </Box>}
    </main>

    <Dialog open={Boolean(cancelOrder)} onClose={() => setCancelOrder(null)} fullWidth maxWidth="sm"><DialogTitle>Cancel delivery</DialogTitle><DialogContent><Typography color="text.secondary" mb={2}>The reason will be visible in customer tracking and saved with this order.</Typography><TextField autoFocus fullWidth multiline minRows={3} label="Cancellation reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} /></DialogContent><DialogActions><Button onClick={() => setCancelOrder(null)}>Close</Button><Button color="error" variant="contained" disabled={!cancelReason.trim()} onClick={cancelAssignedDelivery}>Cancel Delivery</Button></DialogActions></Dialog>
    <Dialog open={profileOpen} onClose={() => !user?.mustChangePassword && setProfileOpen(false)} fullWidth maxWidth="md">
      <DialogTitle>Delivery Partner Profile</DialogTitle>
      <DialogContent sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr' }, gap: 2, pt: '12px !important' }}>
        <TextField label="Name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} error={Boolean(errors.name)} helperText={errors.name} />
        <TextField label="Mobile number" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} error={Boolean(errors.phone)} helperText={errors.phone} />
        <TextField required label="Email" type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} error={Boolean(errors.email)} helperText={errors.email} />
        <TextField disabled label="Location" value={profile.location} onChange={(event) => setProfile({ ...profile, location: event.target.value })} />
        <TextField label="Vehicle number" value={profile.vehicleNumber} onChange={(event) => setProfile({ ...profile, vehicleNumber: event.target.value.toUpperCase() })} error={Boolean(errors.vehicleNumber)} helperText={errors.vehicleNumber} />
        <Select value={profile.vehicleType} onChange={(event) => setProfile({ ...profile, vehicleType: event.target.value })}><MenuItem value="Bike">Bike</MenuItem><MenuItem value="Scooter">Scooter</MenuItem><MenuItem value="Electric Bike">Electric Bike</MenuItem><MenuItem value="Van">Van</MenuItem></Select>
        <TextField label="Emergency contact" value={profile.emergencyContact} onChange={(event) => setProfile({ ...profile, emergencyContact: event.target.value })} />
        <TextField label="Driving licence number" value={profile.licenseNumber} onChange={(event) => setProfile({ ...profile, licenseNumber: event.target.value })} />
        <TextField sx={{ gridColumn: '1 / -1' }} label="Address" multiline minRows={2} value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} />
        <Typography sx={{ gridColumn: '1 / -1', fontWeight: 800 }}>Change password</Typography>
        <TextField label="Current password" type="password" value={profile.current} onChange={(event) => setProfile({ ...profile, current: event.target.value })} error={Boolean(errors.current || errors.form)} helperText={errors.current || errors.form} />
        <TextField label="New password" type="password" value={profile.next} onChange={(event) => setProfile({ ...profile, next: event.target.value })} error={Boolean(errors.next)} helperText={errors.next} inputProps={{ minLength: 8, maxLength: 100, autoComplete: 'new-password' }} />
        <TextField label="Confirm password" type="password" autoComplete="new-password" value={profile.confirm} onChange={(event) => setProfile({ ...profile, confirm: event.target.value })} error={Boolean(errors.confirm)} helperText={errors.confirm} />
      </DialogContent>
      <DialogActions><Button onClick={() => !user?.mustChangePassword && setProfileOpen(false)}>Cancel</Button><Button variant="contained" onClick={saveProfile}>Save Profile</Button></DialogActions>
    </Dialog>
  </Box>;
};

export default DeliveryWorkspace;
