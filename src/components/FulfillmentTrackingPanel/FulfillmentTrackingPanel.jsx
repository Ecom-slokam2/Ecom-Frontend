import { Box, Button, Chip, CircularProgress, Typography } from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import DemoTrackingMap from '../DemoTrackingMap';
import CustomerLiveDeliveryLocation from '../CustomerLiveDeliveryLocation.jsx';
import { customerDeliveryStatus } from '../../utils/fulfillmentStatus';
import { isGlobalOrder } from '../../services/orderApi';

const FulfillmentTrackingPanel = ({ order, fulfillment, shipment, trackingEvents = [], loading = {}, errors = {}, refresh }) => {
  const isGlobal = isGlobalOrder(order);
  const globalPending = isGlobal && String(order?.globalApproval || 'pending').toLowerCase() === 'pending' && !order?.fulfillment && !order?.shipment;
  const deliveryStatus = globalPending ? 'Awaiting assignment' : customerDeliveryStatus({ fulfillment, shipment, order, trackingEvents });
  const statusTone = ['Delivered', 'Cancelled', 'Failed', 'Returned'].includes(deliveryStatus) ? 'default' : 'success';
  const busy = Boolean(loading.fulfillment || loading.shipment);
  const error = errors.fulfillment || errors.shipment;
  const shipmentState = String(shipment?.status || '').toUpperCase().replace(/\s+/g, '_');
  const livePartnerAssigned = ['IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(shipmentState) && Boolean(shipment?.deliveryPartnerId);

  return <Box component="section" aria-label="Order tracking status" sx={{ bgcolor: 'white', border: '1px solid #dfe8e3', borderRadius: 2, p: 2.5, display: 'grid', gap: 2 }}>
    {!isGlobal && !livePartnerAssigned && <DemoTrackingMap demo={false} store={{ latitude: order?.storeLatitude, longitude: order?.storeLongitude, name: order?.sourceStore || 'Store' }} destination={{ latitude: order?.customerLatitude, longitude: order?.customerLongitude }} />}
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LocalShippingOutlinedIcon sx={{ color: '#075F40' }} />
        <Typography component="h2" variant="h6" fontWeight={800}>Order status</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {busy && <CircularProgress size={16} aria-label="Refreshing order status" />}
        <Chip label={deliveryStatus} color={statusTone} />
        {refresh && <Button size="small" variant="outlined" startIcon={<RefreshOutlinedIcon />} disabled={busy} onClick={refresh} sx={{ borderColor: '#d5e5dc', color: '#075F40', textTransform: 'none' }}>Refresh</Button>}
      </Box>
    </Box>
    {isGlobal && <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, borderRadius: 1.5, bgcolor: '#f0f8f3', px: 1.5, py: 1 }}>
      <Typography variant="body2" fontWeight={700} color="#075F40">{globalPending ? 'Global fulfillment' : 'Global delivery estimate'}</Typography>
      <Typography variant="body2" color="text.secondary">7–10 days</Typography>
      {globalPending && <Typography variant="body2" color="text.secondary">Awaiting fulfillment assignment</Typography>}
    </Box>}
    {error && !globalPending && <Typography role="alert" color="error">{error}</Typography>}
    <CustomerLiveDeliveryLocation order={order} orderId={order?.id} shipment={shipment} />
  </Box>;
};

export default FulfillmentTrackingPanel;
