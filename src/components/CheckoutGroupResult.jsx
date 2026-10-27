import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { checkoutGroupView } from '../utils/checkoutGroup';
import PersistedPaymentReference from './PersistedPaymentReference';

export default function CheckoutGroupResult({ group, error, onRetry, onNewCheckout, onOrder, onCart, formatCurrency }) {
  const view = checkoutGroupView(group);
  const storeNames = { 'global-store': 'India-wide Global Store', 'india-store-1-1': 'Hyderabad Main Store', 'india-store-1-3': 'SR Nagar Store' };
  return <Box sx={{ width: '100%', py: { xs: 2, md: 4 } }} aria-live="polite">
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3, flexWrap: 'wrap', mb: 3 }}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          {view.complete && <CheckCircleOutlineIcon sx={{ color: '#087454', fontSize: 36 }} />}
          <Typography variant="h5" fontWeight={700}>{view.label}</Typography>
        </Box>
        <Typography color="text.secondary" sx={{ fontSize: 13, overflowWrap: 'anywhere' }}>Checkout {group?.id}</Typography>
      </Box>
      {view.complete && <Box><Typography color="text.secondary" fontSize={13}>Checkout total</Typography><Typography variant="h4" fontWeight={700}>{formatCurrency(view.total)}</Typography><Typography color="text.secondary" fontSize={13}>{view.children.length} store orders</Typography></Box>}
    </Box>
    {view.failed && <Alert severity="warning" sx={{ mb: 3 }}>Checkout did not complete. Reservations were released; no money was charged. Review stock availability and delivery before starting a new checkout.</Alert>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {!view.complete && !view.failed && <Alert severity="info" sx={{ mb:2 }}>Checkout is not complete. Order details become available after the orders are saved. No payment completion is confirmed.</Alert>}
    <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Store orders</Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 3 }}>
    {view.children.map((child) => <Box component="section" key={child.storeId} sx={{ p: { xs: 2, md: 3 }, minWidth: 0, bgcolor: '#fff', border: '1px solid #dce6e2', borderRadius: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}><StorefrontIcon sx={{ color: '#087454' }} /><Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>{child.storeName || storeNames[child.storeId] || child.storeId}</Typography><Chip size="small" label={child.state} color={child.state === 'CONFIRMED' ? 'success' : 'default'} variant="outlined" /></Box>
      <Typography color="text.secondary" fontSize={12} sx={{ mb: 1 }}>{child.storeId}</Typography>
      {child.orderId && <Typography sx={{ overflowWrap: 'anywhere', fontSize: 13, pb: 2, borderBottom: '1px solid #edf1ef' }}>Order UID: {child.orderId}</Typography>}
      <Box sx={{ py: 2, '& > p': { display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1, fontSize: 14 } }}>
      <Typography>{view.failed ? 'Handling not charged' : <><span>Handling</span><span>{formatCurrency(child.handlingFee)}</span></>}</Typography>
      {child.total != null && <>
        <Typography><span>Subtotal</span><span>{formatCurrency(child.subtotal)}</span></Typography>
        <Typography><span>Delivery</span><span>{formatCurrency(child.deliveryFee)}</span></Typography>
      {Number(child.discountAmount)>0 && <Typography sx={{ color:'#087454' }}><span>{child.couponCode || 'Coupon'} discount</span><span>-{formatCurrency(child.discountAmount)}</span></Typography>}
        <Typography fontWeight={700}><span>Store total</span><span>{formatCurrency(child.total)}</span></Typography>
      </>}
      </Box>
      {child.total != null && <Typography fontSize={13} color="text.secondary" sx={{ mb: 2 }}>{child.orderStatus}</Typography>}
      {view.complete && child.orderId && <Button variant="contained" fullWidth startIcon={<LocalShippingOutlinedIcon />} sx={{ bgcolor: '#087454', boxShadow: 'none', textTransform: 'none', minHeight: 44, '&:hover': { bgcolor: '#065d43', boxShadow: 'none' } }} onClick={() => onOrder(child.orderId)}>View Order Details &amp; Tracking</Button>}
      {view.complete && child.orderId && <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #edf1ef', '& p': { fontSize: 13, color: '#52635c' } }}><PersistedPaymentReference orderId={child.orderId} customerId={group.customerId} total={child.total} showStatus={false} /></Box>}
    </Box>)}
    </Box>
    {!view.complete && !view.failed && <Button onClick={onRetry}>Check Checkout Status</Button>}
    {view.complete && onCart && <Button variant="outlined" onClick={onCart}>Start another order</Button>}
    {view.canStartNew && onNewCheckout && <Button variant="outlined" onClick={onNewCheckout}>Review Cart &amp; Retry</Button>}
  </Box>;
}
