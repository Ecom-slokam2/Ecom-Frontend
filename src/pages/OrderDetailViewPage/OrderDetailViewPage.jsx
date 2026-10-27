import { useCallback, useContext, useEffect, useState } from 'react';
import { Box, Typography, Button, IconButton, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import LocalPhoneOutlinedIcon from '@mui/icons-material/LocalPhoneOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import Header from '../../components/Header/Header';
import BottomNav from '../../components/BottomNav/BottomNav';
import ProductCard from '../../components/ProductCard/ProductCard';
import { AppContext } from '../../context/AppContext';
import pickleJarImg from '../../assets/images/pickel-removebg-preview.png';
import { cancelOrder, getOrder, getOrderItems, isOrderServiceUnavailable, normalizeOrder } from '../../services/orderApi';
import { getPaymentByOrder, isPaymentServiceUnavailable, normalizePayment } from '../../services/paymentApi';
import OrderDocuments from '../../components/OrderDocuments';
import FulfillmentTrackingPanel from '../../components/FulfillmentTrackingPanel/FulfillmentTrackingPanel';
import NotificationHistoryPanel from '../../components/NotificationHistoryPanel/NotificationHistoryPanel';
import { useFulfillmentTracking } from '../../hooks/useFulfillmentTracking';
import './OrderDetailViewPage.css';

const formatAddress = (address) => address ? [address.addressLine1, address.city, address.state, address.country, address.postalCode].filter(Boolean).join(', ') : '';
const OrderDetailViewPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { orderId: routeOrderId } = useParams();
  const { addToCart, catalogProducts, formatCurrency, formatDateTime, user } = useContext(AppContext);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(Boolean(routeOrderId || location.state?.orderId || location.state?.order?.id));
  const [error, setError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [payment, setPayment] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [dismissedReviewOrderId, setDismissedReviewOrderId] = useState(null);
  const requestedOrderId = routeOrderId || location.state?.orderId || location.state?.order?.id;
  const fulfillmentTracking = useFulfillmentTracking(order?.id || requestedOrderId, order);
  const deliveryCompleted = ['DELIVERED', 'Delivered'].includes(order?.status)
    || ['DELIVERED', 'Delivered'].includes(fulfillmentTracking.shipment?.status)
    || ['DELIVERED', 'Delivered'].includes(fulfillmentTracking.fulfillment?.status);
  const reviewPromptOpen = Boolean(deliveryCompleted && order?.id === requestedOrderId && dismissedReviewOrderId !== order?.id);
  const loadOrder = useCallback(async ({ silent = false } = {}) => {
    if (!requestedOrderId) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [orderResponse, itemsResponse] = await Promise.all([getOrder(requestedOrderId), getOrderItems(requestedOrderId).catch(() => null)]);
      const items = Array.isArray(itemsResponse) ? itemsResponse : itemsResponse?.items;
      const next = normalizeOrder(items ? { ...orderResponse, items } : orderResponse);
      setOrder(next);
      setUnavailable(false);
      setError('');
    } catch (apiError) {
      if (!silent || [401,403,404].includes(apiError.status)) {
        setOrder(null);
        setUnavailable(isOrderServiceUnavailable(apiError));
        setError(isOrderServiceUnavailable(apiError) ? 'Order Service is unavailable. Please try again when backend is online.' : apiError.message);
      } else {
        setError('Order updates are unavailable. Showing the last recorded details.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requestedOrderId]);

  useEffect(() => {
    if (!requestedOrderId) {
      return undefined;
    }
    const timer = window.setTimeout(() => loadOrder(), 0);
    return () => window.clearTimeout(timer);
  }, [loadOrder, requestedOrderId]);

  useEffect(() => {
    if (!requestedOrderId || ['DELIVERED', 'CANCELLED'].includes(order?.status)) return undefined;
    const refresh = () => loadOrder({ silent: true });
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, 8000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadOrder, requestedOrderId, order?.status]);

  useEffect(() => {
    if (!requestedOrderId) return undefined;
    let ignore = false;
    Promise.resolve().then(() => {
      if (!ignore) setPaymentError('');
      return getPaymentByOrder(requestedOrderId);
    })
      .then((payload) => {
        if (!ignore) setPayment(normalizePayment(payload));
      })
      .catch((apiError) => {
        if (ignore) return;
        setPayment(null);
        if (apiError.status !== 404) setPaymentError(isPaymentServiceUnavailable(apiError) ? 'Payment Service is unavailable.' : apiError.message);
      });
    return () => { ignore = true; };
  }, [requestedOrderId]);


  const dismissReviewPrompt = () => {
    setDismissedReviewOrderId(order.id);
  };

  const handleCancel = async () => {
    if (!order?.id || canceling) return;
    setConfirmCancel(false);
    setCanceling(true);
    setError('');
    try {
      const updated = normalizeOrder(await cancelOrder(order.id));
      setOrder(updated);
      navigate('/orders');
    } catch (apiError) {
      setUnavailable(isOrderServiceUnavailable(apiError));
      setError(isOrderServiceUnavailable(apiError) ? 'Order Service is unavailable. Please try again when backend is online.' : apiError.message);
    } finally {
      setCanceling(false);
    }
  };

  if (loading) return <Box className="order-detail-wrapper"><Header /><Box className="order-detail-header"><IconButton aria-label="Back to orders" onClick={() => navigate('/orders', { replace: true })} style={{ color: '#ffffff' }}><ArrowBackIcon /></IconButton><Typography variant="h6" className="order-detail-title">Order Details</Typography></Box><Box sx={{ p: 3 }}><Typography role="status">Loading order details...</Typography></Box><BottomNav /></Box>;
  if (error && !order) return <Box className="order-detail-wrapper"><Header /><Box className="order-detail-header"><IconButton onClick={() => navigate('/orders')} style={{ color: '#ffffff' }}><ArrowBackIcon /></IconButton><Typography variant="h6" className="order-detail-title">Order Details</Typography></Box><Box sx={{ p: 3 }}><Typography role="alert" color={unavailable ? 'error' : 'text.secondary'}>{error}</Typography><Button sx={{ mt: 2 }} onClick={() => navigate('/orders')}>View Orders</Button></Box><BottomNav /></Box>;
  if (!order) return <Box sx={{ p: 4, textAlign: 'center' }}><Typography variant="h6">No order selected</Typography><Button onClick={() => navigate('/orders')}>View Orders</Button></Box>;

  const firstItem = order.items[0] || {};
  const title = firstItem.title || 'Order';
  const price = order.totalAmount;
  const date = order.createdAt ? formatDateTime(order.createdAt, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Date unavailable';
  const image = firstItem.image || pickleJarImg;
  const customer = order.customer || user || {};
  const deliveryAddress = order.checkout?.deliveryAddress || order.deliveryAddress || formatAddress(order.shippingAddress);
  const localPaymentStatus = order.paymentStatus || order.payment?.status || (order.paymentMethod ? 'Payment recorded' : '');
  const paymentStatus = payment?.status || localPaymentStatus || 'Payment confirmation unavailable';
  const visiblePaymentError = paymentError && !localPaymentStatus ? paymentError : '';
  const suggestions = catalogProducts.filter((product) => product.productId !== firstItem.productId).slice(0, 3);
  const siblingOrders = Array.isArray(order.childOrders) ? order.childOrders : [];
  const itemSubtotal = order.items.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const deliveryCharge = Number(order.deliveryCharge || 0);
  const handlingFee = Number(order.handlingFee || 0);
  const discountAmount = Number(order.discountAmount || 0);
  const otherCharges = Math.max(0, Number(price || 0) - itemSubtotal - deliveryCharge - handlingFee + discountAmount);

  return (
    <Box className="order-detail-wrapper">
      <Header />
      <Box className="order-detail-header">
        <IconButton aria-label="Back to orders" onClick={() => navigate('/orders', { replace: true })} style={{ color: '#ffffff' }}><ArrowBackIcon /></IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h6" className="order-detail-title" sx={{ overflowWrap: 'anywhere' }}>Order #{order.orderNumber || order.id}</Typography>
          <Typography variant="caption">{date} | {order.items.length} item{order.items.length === 1 ? '' : 's'} | {formatCurrency(price)}</Typography>
        </Box>
        <Button sx={{ ml: 'auto', color: 'white' }} onClick={() => navigate('/help-center')}>Get Help</Button>
      </Box>

      <Box className="order-detail-scroll">
        {error && <Typography role="alert" color={unavailable ? 'error' : 'text.secondary'}>{error}</Typography>}
        <FulfillmentTrackingPanel order={order} {...fulfillmentTracking} />
        <Box className="product-summary-card">
          <Box className="card-item-left"><img src={image} alt={title} className="purchased-img" /></Box>
          <Box className="card-item-info">
            <Typography className="purchased-title">{title}</Typography>
            <Typography className="purchased-weight">{order.items.length} item{order.items.length === 1 ? '' : 's'}</Typography>
            <Typography className="purchased-price">{formatCurrency(price)}</Typography>
            <Typography className="purchased-id">Order ID :{order.id}</Typography>
            <Button variant="contained" className="reorder-primary-btn" disabled={!firstItem.productId} onClick={() => addToCart({ productId: firstItem.productId, variantId: firstItem.variantId ?? null, title: firstItem.title, price: firstItem.unitPrice })}>REORDER</Button>
          </Box>
        </Box>

        <Box component="section" sx={{ bgcolor: 'white', p: 2 }}>
          <Typography variant="h6" fontWeight={700}>Your Order</Typography>
          {order.items.map((item, index) => <Box key={item.id || index} sx={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 1.5, alignItems: 'center', py: 1.5, borderBottom: '1px solid #e2e8f0' }}>
            <Box component="img" src={item.image || pickleJarImg} alt={item.title} sx={{ width: 48, height: 48, objectFit: 'contain' }} />
            <Box><Typography fontWeight={700}>{item.title}</Typography><Typography variant="body2">Quantity: {item.quantity}</Typography></Box>
            <Typography>{formatCurrency(item.totalPrice)}</Typography>
          </Box>)}
          <Box sx={{ display: 'grid', gap: 0.75, maxWidth: 360, ml: 'auto', pt: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}><Typography variant="body2" color="text.secondary">Items subtotal</Typography><Typography variant="body2">{formatCurrency(itemSubtotal)}</Typography></Box>
            {deliveryCharge > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}><Typography variant="body2" color="text.secondary">Delivery</Typography><Typography variant="body2">{formatCurrency(deliveryCharge)}</Typography></Box>}
            {handlingFee > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}><Typography variant="body2" color="text.secondary">Handling fee</Typography><Typography variant="body2">{formatCurrency(handlingFee)}</Typography></Box>}
            {otherCharges > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}><Typography variant="body2" color="text.secondary">Other charges</Typography><Typography variant="body2">{formatCurrency(otherCharges)}</Typography></Box>}
            {discountAmount > 0 && <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}><Typography variant="body2" color="text.secondary">Discount</Typography><Typography variant="body2">-{formatCurrency(discountAmount)}</Typography></Box>}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, borderTop: '1px solid #e2e8f0', pt: 0.75 }}><Typography fontWeight={700}>Order total</Typography><Typography fontWeight={700}>{formatCurrency(price)}</Typography></Box>
          </Box>
        </Box>

        <Box className="delivery-status-card">
          <Box className="status-card-left">
            <span className="box-icon">BOX</span>
            <Box className="status-text-col">
              <Typography className="delivered-bold-title">Order {order.status}</Typography>
              <Typography className="delivered-date-sub">Ordered on : {date}</Typography>
            </Box>
          </Box>
          <Box className="delivered-stamp">{order.status}</Box>
        </Box>

        {deliveryCompleted && (
          <Box component="section" sx={{ bgcolor: '#fff', px: 2, py: 2.5, borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
            <Box><Typography fontWeight={700}>How was your order?</Typography><Typography variant="body2" color="text.secondary">Your feedback helps us improve.</Typography></Box>
            <Button variant="contained" onClick={() => navigate(`/order-details/${encodeURIComponent(order.id)}/review`)}>Rate order</Button>
          </Box>
        )}

        {siblingOrders.length > 1 && (
          <Box className="receiver-info-card">
            <Typography className="info-value-bold">Same payment split orders</Typography>
            {siblingOrders.map((child) => (
              <Box className="info-detail-row" key={child.id}>
                <Box className="info-col">
                  <Typography className="info-value-bold">{child.id}</Typography>
                  <Typography className="info-label-sub">{child.sourceStore || child.store} | {child.deliveryLabel || child.estimatedDelivery || 'Delivery estimate unavailable'}</Typography>
                  <Typography className="info-label-sub">{child.items?.length || 0} item{child.items?.length === 1 ? '' : 's'} | {child.status}</Typography>
                </Box>
                {child.id !== order.id && <Button size="small" onClick={() => navigate(`/order-details/${encodeURIComponent(child.id)}`, { state: { orderId: child.id } })}>View</Button>}
              </Box>
            ))}
          </Box>
        )}

        <Box className="receiver-info-card">
          <Typography className="info-value-bold">Delivery split</Typography>
          {order.items.map((item, index) => <Box className="info-detail-row" key={`${item.productId || index}:${item.variantId ?? 'product'}`}><Box className="info-col"><Typography className="info-label-sub">{item.title}</Typography><Typography className="info-value-bold">{item.deliveryLabel || item.estimatedDelivery || order.deliveryLabel || 'Delivery estimate unavailable'}</Typography><Typography className="info-label-sub">{item.sourceStore || order.sourceStore || ''}</Typography></Box></Box>)}
        </Box>

        <Box className="you-may-like-wrap">
          <Typography className="section-heading-bold">You May Also Like</Typography>
          <Box className="like-items-row">
            {suggestions.map((product) => <ProductCard key={product.productId || product.id} {...product} />)}
          </Box>
        </Box>

        <Box className="receiver-info-card">
          <Box className="info-detail-row"><PersonOutlineOutlinedIcon className="info-row-icon" /><Box className="info-col"><Typography className="info-label-sub">Delivery To</Typography><Typography className="info-value-bold">{customer.name || 'Customer'}</Typography></Box></Box>
          <Box className="info-detail-row"><LocalPhoneOutlinedIcon className="info-row-icon" /><Box className="info-col"><Typography className="info-label-sub">Contact details</Typography><Typography className="info-value-bold">{customer.phone || 'Unavailable'}</Typography></Box></Box>
          <Box className="info-detail-row"><HomeOutlinedIcon className="info-row-icon" /><Box className="info-col"><Typography className="info-label-sub">Delivery Address</Typography><Typography className="info-value-bold">{deliveryAddress || 'Unavailable'}</Typography></Box></Box>
        </Box>

        <NotificationHistoryPanel orderId={order.id} order={order} formatDateTime={formatDateTime} />

        <Box className="total-order-card">
          <Box className="price-top-row">
            <Typography className="total-price-label">Total Order Price</Typography>
            <Box className="total-price-value-wrap"><Typography className="total-price-val">{formatCurrency(price)}</Typography><KeyboardArrowDownIcon className="arrow-down" /></Box>
          </Box>
          <Box className="payment-method-bar"><span className="upi-icon">PAY</span><Typography className="upi-text">{visiblePaymentError || paymentStatus}</Typography></Box>
          <OrderDocuments order={order} payment={payment} formatCurrency={formatCurrency} />
          {!['SHIPPED', 'DELIVERED', 'CANCELLED'].includes(order.status) && <Button color="error" fullWidth disabled={canceling} onClick={() => setConfirmCancel(true)}>{canceling ? 'Cancelling...' : 'Cancel Order'}</Button>}
        </Box>
      </Box>

      <BottomNav />
      <Dialog open={confirmCancel} onClose={() => setConfirmCancel(false)}>
        <DialogTitle>Cancel this order?</DialogTitle>
        <DialogContent>Your cancellation will be checked against the current order status.</DialogContent>
        <DialogActions><Button onClick={() => setConfirmCancel(false)}>Keep Order</Button><Button color="error" disabled={canceling} onClick={handleCancel}>Cancel Order</Button></DialogActions>
      </Dialog>
      <Dialog open={reviewPromptOpen} onClose={dismissReviewPrompt} maxWidth="xs" fullWidth>
        <DialogTitle>How was your order?</DialogTitle>
        <DialogContent>
          Your order has been delivered. Please share your rating and feedback.
        </DialogContent>
        <DialogActions>
          <Button onClick={dismissReviewPrompt}>Later</Button>
          <Button variant="contained" onClick={() => { dismissReviewPrompt(); navigate(`/order-details/${encodeURIComponent(order.id)}/review`); }}>
            Write review
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrderDetailViewPage;
