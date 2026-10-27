import { getDeliveryPartners } from '../../services/deliveryPartnerApi';
import { useContext, useEffect, useState } from 'react';
import { Alert,Box,Button,Dialog,DialogContent,MenuItem,Select,Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { addTrackingEvent, assignShipmentDeliveryPartner, getShipmentByOrderId, retryCarrierShipment } from '../../services/fulfillmentApi';
import { getOrder, getOrderItems, normalizeOrder } from '../../services/orderApi';
import { prepareShipmentForAssignment } from '../../services/orderServiceWorkflow';
import { assignDeliveryPartnerForShipment, retryFailedCarrierDelivery } from './deliveryPartnerAssignmentWorkflow';

const FINAL_SHIPMENT_STATUSES = ['DELIVERED', 'CANCELLED', 'RETURNED'];
const RETRYABLE_SHIPMENT_STATUSES = ['FAILED'];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DeliveryPartnerAssignment=({orderId})=>{
  const navigate=useNavigate();const {user}=useContext(AppContext);const [order,setOrder]=useState(null);const [partnerId,setPartnerId]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(!order);
  useEffect(()=>{let ignore=false;Promise.all([getOrder(orderId),getOrderItems(orderId)]).then(([payload,itemsPayload])=>{if(ignore)return;const items=Array.isArray(itemsPayload)?itemsPayload:itemsPayload?.items;setOrder(normalizeOrder(items?{...payload,items}:payload));}).catch(reason=>{if(!ignore)setError(reason.message);}).finally(()=>{if(!ignore)setLoading(false);});return()=>{ignore=true;};},[orderId]);
  const [shipment,setShipment]=useState(null);
  const [shipmentLoading,setShipmentLoading]=useState(true);
  const [shipmentError,setShipmentError]=useState('');
  useEffect(()=>{let ignore=false;getShipmentByOrderId(orderId).then(row=>{if(!ignore)setShipment(row);}).catch(reason=>{if(!ignore&&reason.status!==404)setShipmentError(reason.message);}).finally(()=>{if(!ignore)setShipmentLoading(false);});return()=>{ignore=true;};},[orderId]);
  const finalized=FINAL_SHIPMENT_STATUSES.includes(shipment?.status);
  const retryable=RETRYABLE_SHIPMENT_STATUSES.includes(shipment?.status);
  const [partnerRows,setPartnerRows]=useState([]);
  const [partnerError,setPartnerError]=useState('');
  const [reload,setReload]=useState(0);
  const storeId=order?.storeId||order?.sourceStoreId||user?.storeId;
  const partners=partnerRows.filter(p=>p.status==='Active'&&Boolean(p.active)&&Boolean(storeId)&&String(p.storeId)===String(storeId));
  const [partnersLoading,setPartnersLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [success,setSuccess]=useState('');
  const [retryOutcome,setRetryOutcome]=useState('');
  const [retryKey,setRetryKey]=useState('');
  useEffect(()=>{let ignore=false;getDeliveryPartners().then(rows=>{if(ignore)return;setPartnerRows(rows);setPartnerError('');}).catch(reason=>{if(!ignore){setPartnerRows([]);setPartnerError(reason.message);}}).finally(()=>{if(!ignore)setPartnersLoading(false);});return()=>{ignore=true;};},[reload]);
  if(loading&&!order)return <Box p={4}>Loading order...</Box>;
  if(!order)return <Box p={4}><Alert severity="error">{error || 'Order not found'}</Alert><Button onClick={()=>navigate('/admin/orders')}>Back to Orders</Button></Box>;
  const assign=async()=>{setSaving(true);setError('');try{
    const partner=partners.find(item=>item.id===partnerId);
    if(!partner)throw new Error('Select an active delivery partner.');
    const backendId=order.backendOrderId||order.id;
    if(!UUID_PATTERN.test(backendId))throw new Error('This order must be saved in the database before assigning a delivery partner.');
    const currentShipment=await prepareShipmentForAssignment({...order,id:backendId});
    setShipment(currentShipment);
    const status=currentShipment.status;
    if(FINAL_SHIPMENT_STATUSES.includes(status))throw new Error(`This shipment is ${status}. Finalized shipments cannot be reassigned.`);
    if(status==='FAILED'&&user?.role==='location-admin'){
      let idempotencyKey=retryKey;
      if(!idempotencyKey){
        if(!globalThis.crypto?.randomUUID)throw new Error('This browser cannot create a safe retry request ID.');
        idempotencyKey=globalThis.crypto.randomUUID();
        setRetryKey(idempotencyKey);
      }
      setRetryOutcome('RETRYING');
      const result=await retryFailedCarrierDelivery({shipment:currentShipment,partner,idempotencyKey,retryCarrierShipment});
      setRetryOutcome(result.outcome);
      if(result.outcome==='SUCCEEDED'){
        const saved=await getShipmentByOrderId(backendId);
        setShipment(saved);
        setSuccess(`Carrier accepted the retry for ${partner.name}.`);
        return;
      }
      const message=result.outcome==='UNKNOWN'
        ? 'Carrier outcome is unknown. Do not retry again until the shipment is reconciled by an operator.'
        : result.outcome==='EXHAUSTED'
          ? 'Carrier retry limit reached. Operator review is required.'
          : ['CARRIER_NOT_CONFIGURED','IDEMPOTENCY_NOT_SUPPORTED'].includes(result.history?.at(-1)?.errorCode)
            ? 'Carrier retry is not configured in this environment.'
            : `Carrier retry ended with ${result.outcome}. Review the attempt details before taking further action.`;
      throw new Error(message);
    }
    const assignedShipment=await assignDeliveryPartnerForShipment({
      shipment:currentShipment,order,partner,assignShipmentDeliveryPartner,addTrackingEvent,
    });
    setShipment(assignedShipment);
    setSuccess(`Order assigned to ${partner.name}.`);
  }catch(reason){if(retryOutcome==='RETRYING'&&(!reason.status||Number(reason.status)>=500))setRetryOutcome('UNKNOWN');setError(reason.message);}finally{setSaving(false);}};
  return <Dialog open fullWidth maxWidth="sm" aria-labelledby="delivery-assignment-title" onClose={()=>{if(!saving)navigate('/admin/orders');}}>
    <DialogContent sx={{p:3}}>
      <Button disabled={saving} onClick={()=>navigate('/admin/orders')}>Close</Button>
      <Typography id="delivery-assignment-title" variant="h5" fontWeight={800} mt={2}>Assign delivery partner</Typography>
      <Typography color="text.secondary" mb={2}>Active delivery partners for {order.sourceStore||user?.store||user?.location}.</Typography>
      {shipment?.deliveryPartnerName && !success && <Alert severity="info" sx={{mb:2}}>Currently assigned to {shipment.deliveryPartnerName}.</Alert>}
      <Button disabled={partnersLoading} onClick={()=>{setPartnersLoading(true);setReload(value=>value+1);}}>Refresh availability</Button>
      {partnersLoading ? <Typography>Loading partner availability...</Typography> : partnerError ?
        <Alert severity="error">{partnerError}</Alert> : <>
          <Typography sx={{my:1}}>{partners.length} active delivery {partners.length===1?'partner':'partners'}</Typography>
          {!partners.length ? <Alert severity="info">No partners are currently active for this store. Update availability in Delivery Partners, then refresh.</Alert> :
            <Select fullWidth displayEmpty disabled={saving} inputProps={{'aria-label':'Delivery partner'}} value={partners.some(p=>p.id===partnerId)?partnerId:''} onChange={event=>{setPartnerId(event.target.value);setSuccess('');}}>
              <MenuItem value="" disabled>Select delivery partner by name</MenuItem>
              {partners.map(partner=><MenuItem key={partner.id} value={partner.id}>{partner.name} - {partner.vehicleType} - Active</MenuItem>)}
            </Select>}
        </>}
      {shipmentLoading && <Typography sx={{mt:2}}>Checking shipment...</Typography>}
      {shipmentError && <Alert severity="error" sx={{mt:2}}>{shipmentError}</Alert>}
      {finalized && <Alert severity="warning" sx={{mt:2}}>Shipment status: {shipment.status}. Partner availability is shown above. This shipment cannot be reassigned.</Alert>}
      {retryable && <Alert severity="info" sx={{mt:2}}>{user?.role==='location-admin'?'The previous delivery attempt failed. Select an active partner to submit a safe, idempotent carrier retry.':'The previous delivery attempt failed. Select a delivery partner and assign the order to retry delivery.'}</Alert>}
      {retryOutcome==='RETRYING' && <Alert severity="info" sx={{mt:2}}>Carrier retry is in progress.</Alert>}
      {success ? <><Alert severity="success" sx={{mt:2}}>{success}</Alert><Button variant="contained" sx={{mt:2}} onClick={()=>navigate('/admin/orders',{replace:true})}>View orders</Button></> : <Button variant="contained" sx={{mt:3}} disabled={!partners.some(p=>p.id===partnerId)||saving||partnersLoading||shipmentLoading||finalized||Boolean(shipmentError)||Boolean(partnerError)||['UNKNOWN','PERMANENT_FAILURE','EXHAUSTED'].includes(retryOutcome)} onClick={assign}>{saving?(retryable?'Retrying...':'Assigning...'):(retryable?'Retry delivery':'Assign order')}</Button>}
      {error && <Alert severity={retryOutcome==='UNKNOWN'?'warning':'error'} sx={{mt:2}}>{error}</Alert>}
    </DialogContent>
  </Dialog>;
};
export default DeliveryPartnerAssignment;
