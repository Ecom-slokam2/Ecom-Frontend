import { useContext, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import StarBorderOutlinedIcon from '@mui/icons-material/StarBorderOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import BottomNav from '../../components/BottomNav/BottomNav';
import pickleJarImg from '../../assets/images/pickel-removebg-preview.png';
import { AppContext } from '../../context/AppContext';
import { getCustomerOrders, isOrderServiceUnavailable, normalizeOrder } from '../../services/orderApi';
import './OrdersHistoryPage.css';

const STATUS_FILTERS = [
  ['ALL', 'All Orders'], ['PROCESSING', 'Processing'], ['SHIPPED', 'Shipped'],
  ['OUT_FOR_DELIVERY', 'Out for Delivery'], ['DELIVERED', 'Delivered'], ['CANCELLED', 'Cancelled'],
];
const steps = ['CREATED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
const statusLabel = (status) => ({ CREATED: 'Order Placed', CONFIRMED: 'Confirmed', PROCESSING: 'Packed', SHIPPED: 'Shipped', OUT_FOR_DELIVERY: 'Out for Delivery', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' }[status] || status?.replaceAll('_', ' '));
const statusClass = (status) => String(status || '').toLowerCase().replaceAll('_', '-');
const statusMatches = (order, filter) => filter === 'ALL' || (filter === 'PROCESSING' ? ['CREATED', 'CONFIRMED', 'PROCESSING'].includes(order.status) : filter === 'OUT_FOR_DELIVERY' ? ['OUT_FOR_DELIVERY', 'PICKED_UP'].includes(order.status) : order.status === filter);

const OrdersHistoryPage = () => {
  const navigate = useNavigate();
  const { formatCurrency, user, addToCart } = useContext(AppContext);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('30');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('recent');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [now, setNow] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [reordering, setReordering] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;
    let ignore = false;
    Promise.resolve().then(() => {
      if (ignore) return null;
      setLoading(true); setError('');
      return getCustomerOrders(user.id);
    })
      .then((payload) => {
        if (!ignore && payload !== null) {
          const rows = Array.isArray(payload) ? payload : payload?.orders || payload?.content || [];
          setOrders(rows.map(normalizeOrder)); setUnavailable(false);
        }
      })
      .catch((apiError) => {
        if (!ignore) { setOrders([]); setUnavailable(isOrderServiceUnavailable(apiError)); setError(isOrderServiceUnavailable(apiError) ? 'Order Service is unavailable. Please try again when backend is online.' : apiError.message); }
      })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [user?.id]);

  const counts = useMemo(() => Object.fromEntries(STATUS_FILTERS.map(([key]) => [key, orders.filter((order) => statusMatches(order, key)).length])), [orders]);
  const visibleOrders = useMemo(() => {
    const cutoff = dateFilter === 'all' || dateFilter === 'custom' || now === null ? null : now - Number(dateFilter) * 86400000;
    const filtered = orders.filter((order) => {
      const created = new Date(order.createdAt || order.updatedAt || 0).getTime();
      const text = `${order.id} ${order.orderNumber || ''} ${order.items.map((item) => item.title).join(' ')}`.toLowerCase();
      const lowerBound = dateFilter === 'custom' && fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : cutoff;
      const upperBound = dateFilter === 'custom' && toDate ? new Date(`${toDate}T23:59:59.999`).getTime() : null;
      return statusMatches(order, activeFilter) && (!lowerBound || (created && created >= lowerBound)) && (!upperBound || created <= upperBound) && (!query || text.includes(query.toLowerCase()));
    });
    return filtered.sort((a, b) => sort === 'oldest' ? new Date(a.createdAt || 0) - new Date(b.createdAt || 0) : sort === 'amount' ? b.totalAmount - a.totalAmount : new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [orders, activeFilter, dateFilter, query, sort, now, fromDate, toDate]);

  const openDetails = (order) => navigate(`/order-details/${encodeURIComponent(order.id)}`, { state: { orderId: order.id } });
  const reorder = async (order) => {
    if (!addToCart || reordering) return;
    setReordering(order.id); setNotice('');
    try {
      for (const item of order.items) {
        if (!item.productId || !(Number(item.unitPrice) > 0)) continue;
        await addToCart({ productId: item.productId, variantId: item.variantId ?? null, title: item.title, productName: item.title, price: item.unitPrice, unitPrice: item.unitPrice, storeId: item.storeId || order.storeId });
      }
      setNotice('Available items from this order were added to your cart.');
    } catch (e) { setNotice(e.message || 'Could not add these items to your cart.'); }
    finally { setReordering(''); }
  };

  return (
    <Box className="orders-history-wrapper">
      <Header />
      <Box className="orders-history-hero"><Box><Typography variant="h5">My Orders</Typography><Typography variant="body2">Track, manage and reorder your purchases</Typography></Box></Box>
      <Box className="orders-history-layout">
        <Box component="aside" className="orders-filter-panel">
          <Box className="status-filter-list">{STATUS_FILTERS.map(([key, label]) => <Button key={key} className={`status-filter ${activeFilter === key ? 'active' : ''}`} onClick={() => setActiveFilter(key)} startIcon={activeFilter === key ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />}><span>{label}</span><span>{counts[key] || 0}</span></Button>)}</Box>
          <Box className="date-filter"><Typography variant="subtitle2">Order Date</Typography>{[['30', 'Last 30 days'], ['90', 'Last 3 months'], ['180', 'Last 6 months'], ['365', 'Last 1 year'], ['all', 'All time'], ['custom', 'Custom range']].map(([value, label]) => <Button key={value} className={`date-filter-option ${dateFilter === value ? 'selected' : ''}`} onClick={() => setDateFilter(value)} startIcon={dateFilter === value ? <CheckCircleOutlineIcon /> : <RadioButtonUncheckedIcon />}>{label}</Button>)}{dateFilter === 'custom' && <Box className="custom-date-fields"><TextField size="small" type="date" label="From" value={fromDate} onChange={(event) => setFromDate(event.target.value)} InputLabelProps={{ shrink: true }} /><TextField size="small" type="date" label="To" value={toDate} onChange={(event) => setToDate(event.target.value)} InputLabelProps={{ shrink: true }} /></Box>}</Box>
        </Box>
        <Box className="orders-results">
          <Box className="orders-toolbar"><TextField size="small" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your orders by product name, order ID or more..." InputProps={{ startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1, color: '#718078' }} /> }} /><FormControl size="small"><InputLabel id="order-sort-label">Sort by</InputLabel><Select labelId="order-sort-label" label="Sort by" value={sort} onChange={(event) => setSort(event.target.value)}><MenuItem value="recent">Most Recent</MenuItem><MenuItem value="oldest">Oldest</MenuItem><MenuItem value="amount">Highest Amount</MenuItem></Select></FormControl></Box>
          {notice && <Alert severity="info" sx={{ mb: 1 }}>{notice}</Alert>}
          {loading && <Typography role="status" className="orders-empty">Loading your orders...</Typography>}
          {!loading && (error || !user?.id) && <Alert severity={unavailable ? 'error' : 'info'}>{error || 'Log in to view your orders.'}</Alert>}
          {!loading && !error && visibleOrders.length === 0 && <Typography className="orders-empty">No orders match these filters.</Typography>}
          {!loading && !error && visibleOrders.map((order) => {
            const current = order.status === 'PICKED_UP' ? 'OUT_FOR_DELIVERY' : order.status;
            const currentIndex = steps.indexOf(current);
            const count = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            const item = order.items[0];
            return <Box key={order.id} className="customer-order-card">
              <Box className="order-product-thumb"><img src={item?.image || pickleJarImg} alt={item?.title || 'Order item'} /></Box>
              <Box className="customer-order-main">
                <Box className="customer-order-heading"><Box><Typography className="customer-order-name">{item?.title || `${count} items`}</Typography><Typography className="customer-order-meta">{count} item{count === 1 ? '' : 's'}{item?.weight ? ` | ${item.weight}` : ''}</Typography><Typography className="customer-order-id">Order ID: {order.orderNumber || order.id}</Typography><Typography className="customer-order-date">Placed: {order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date unavailable'}</Typography></Box><Box className="order-card-total"><Typography>{formatCurrency(order.totalAmount)}</Typography><Chip size="small" className={`order-status-chip ${statusClass(order.status)}`} label={statusLabel(order.status)} /></Box></Box>
                {order.status === 'CANCELLED' ? <Alert severity="error" className="cancelled-order-alert">Order Cancelled</Alert> : <Box className="order-progress">{steps.map((step, index) => <Box key={step} className={`order-progress-step ${index <= currentIndex ? 'complete' : ''}`}><Box className="progress-dot">{index < currentIndex ? '✓' : ''}</Box><Typography>{statusLabel(step)}</Typography>{index < steps.length - 1 && <Box className="progress-line" />}</Box>)}</Box>}
              </Box>
              <Box className="order-card-actions"><Button variant="contained" onClick={() => openDetails(order)}>View Details</Button>{order.status === 'DELIVERED' ? <Button variant="outlined" startIcon={<ShoppingCartOutlinedIcon />} disabled={Boolean(reordering)} onClick={() => reorder(order)}>{reordering === order.id ? 'Adding…' : 'Reorder'}</Button> : order.status === 'CANCELLED' ? <Button variant="outlined" startIcon={<ShoppingCartOutlinedIcon />} disabled={Boolean(reordering)} onClick={() => reorder(order)}>{reordering === order.id ? 'Adding…' : 'Reorder'}</Button> : <Button variant="outlined" startIcon={<LocalShippingOutlinedIcon />} onClick={() => openDetails(order)}>Track Order</Button>}{order.status === 'DELIVERED' && <Button variant="outlined" startIcon={<StarBorderOutlinedIcon />} onClick={() => navigate(`/order-details/${encodeURIComponent(order.id)}/review`)}>Write a Review</Button>}</Box>
            </Box>;
          })}
        </Box>
      </Box>
      <BottomNav />
    </Box>
  );
};

export default OrdersHistoryPage;
