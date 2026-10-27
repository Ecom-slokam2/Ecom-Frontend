import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { assignGlobalStore, getGlobalStoreAssignmentOptions, getOrder } from '../../services/orderApi';

const GLOBAL_STORE_ID = 'global-store';
const errorState = (error) => {
  if (Number(error?.status) === 404) return { title: 'Order not found', detail: 'This backend order could not be found.' };
  if (Number(error?.status) === 401 || Number(error?.status) === 403) return { title: 'Access denied', detail: 'Your account is not authorized to review this global order.' };
  return { title: 'Unable to load Global Store inventory', detail: error?.message || 'The order or Global Store inventory could not be loaded.' };
};

const GlobalStoreAssignment = ({ orderId }) => {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [option, setOption] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedOrder, inventoryOptions] = await Promise.all([
        getOrder(orderId), getGlobalStoreAssignmentOptions(orderId),
      ]);
      setOrder(loadedOrder);
      setOption((Array.isArray(inventoryOptions) ? inventoryOptions : []).find((item) => item.storeId === GLOBAL_STORE_ID) || null);
    } catch (loadError) {
      setError(errorState(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { load(); }, 0);
    return () => clearTimeout(timer);
  }, [orderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async () => {
    setSaving(true);
    setError(null);
    try {
      await assignGlobalStore(orderId, GLOBAL_STORE_ID);
      navigate('/admin/orders', { replace: true });
    } catch (approvalError) {
      setError({ title: Number(approvalError?.status) === 403 ? 'Access denied' : 'Approval failed', detail: approvalError?.message || 'Global order approval could not be saved.' });
      if (Number(approvalError?.status) === 404) setOrder(null);
      if (Number(approvalError?.status) === 409) await load();
    } finally {
      setSaving(false);
    }
  };

  return <Box sx={{ position: 'fixed', inset: 0, zIndex: 1400, bgcolor: 'rgba(15,23,42,.6)', p: { xs: 2, md: 4 }, overflowY: 'auto' }}>
    <Box sx={{ maxWidth: 900, mx: 'auto', bgcolor: 'white', p: { xs: 2, md: 4 }, borderRadius: 3, boxShadow: 24 }}>
      <Button onClick={() => navigate('/admin/orders')}>Close</Button>
      <Typography variant="h4" fontWeight={800} mt={2}>Review Global Store order</Typography>
      <Typography color="text.secondary">Global orders are fulfilled from the India-wide Global Store. Local stores are not involved.</Typography>
      {loading ? <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 4 }}><CircularProgress size={22} /><Typography>Loading order and Global Store stock…</Typography></Box> : error ? <Alert severity="error" sx={{ mt: 3 }} action={<Button color="inherit" onClick={load}>Retry</Button>}><strong>{error.title}.</strong> {error.detail}</Alert> : !order ? <Alert severity="error" sx={{ mt: 3 }}>Order not found.</Alert> : <>
        <Box sx={{ display: 'grid', gridTemplateColumns: { md: '1fr 1fr' }, gap: 2, my: 3 }}>
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}><Typography fontWeight={800}>Order</Typography><Typography>{order.orderNumber || order.id}</Typography><Typography>Status: {order.status}</Typography><Typography>Payment: {order.paymentStatus}</Typography><Chip sx={{ mt: 1 }} label={order.globalApproval || 'Pending approval'} /></Box>
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}><Typography fontWeight={800}>Global Store stock</Typography>{order.items?.map((item) => { const stock = option?.items?.find((entry) => entry.productName === (item.productName || item.title)); return <Typography key={item.id}>{item.productName || item.title} × {item.quantity} — {stock ? `${stock.availableQuantity} available` : 'not available'}</Typography>; })}</Box>
        </Box>
        {order.globalAssignedStoreId === GLOBAL_STORE_ID || order.globalApproval === 'Approved' ? <Alert severity="info">This order is approved for fulfillment by Global Store.</Alert> : !option ? <Alert severity="warning">Global Store does not have enough active stock for every item in this order.</Alert> : <Button sx={{ mt: 1 }} variant="contained" disabled={saving} onClick={approve}>{saving ? 'Approving…' : 'Approve Global Store fulfillment'}</Button>}
      </>}
    </Box>
  </Box>;
};

export default GlobalStoreAssignment;
