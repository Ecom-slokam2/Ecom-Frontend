import { addTrackingEvent, createFulfillment, createShipment, getFulfillmentByOrderId, getShipmentByOrderId, isFulfillmentNotFound, updateFulfillmentStatus, updateShipmentStatus } from './fulfillmentApi';
import { createNotification, sendNotification } from './notificationApi';
import { updateOrderStatus } from './orderApi';
import { shipmentRequest } from '../utils/shipmentRequest';
import { fulfillmentTypeForOrder } from './orderWorkflowRouting.js';

const notificationFor = async (order, type, subject, message) => {
  if (!order?.customerId || !order?.id) return;
  const payload = {
    customerId: order.customerId,
    orderId: order.id,
    notificationType: type,
    channel: 'EMAIL',
    recipient: order.customer?.email || order.customer?.phone || 'pickle.customer@example.com',
    subject,
    message,
  };
  const notification = await createNotification(payload);
  await sendNotification(notification.id);
};

const getShippingAddressId = (order) =>
  order?.shippingAddress?.id || order?.addresses?.find((address) => address.addressType === 'SHIPPING')?.id || order?.addresses?.[0]?.id;

const getOrCreateFulfillment = async (order) => {
  try {
    return await getFulfillmentByOrderId(order.id);
  } catch (error) {
    if (!isFulfillmentNotFound(error)) throw error;
    const shippingAddressId = getShippingAddressId(order);
    if (!shippingAddressId) throw new Error('Shipping address is required before creating fulfillment.', { cause: error });
    const fulfillment = await createFulfillment({
      orderId: order.id,
      customerId: order.customerId,
      storeId: order.storeId,
      shippingAddressId,
      fulfillmentType: fulfillmentTypeForOrder(order),
    });
    await notificationFor(order, 'FULFILLMENT_CREATED', `Fulfillment created for ${order.orderNumber || order.id}`, 'Your order is now in fulfillment.');
    return fulfillment;
  }
};

const progressFulfillmentToReady = async (order) => {
  let fulfillment = await getOrCreateFulfillment(order);
  if (fulfillment.status === 'PENDING') fulfillment = await updateFulfillmentStatus(fulfillment.id, 'ALLOCATED');
  if (fulfillment.status === 'ALLOCATED') fulfillment = await updateFulfillmentStatus(fulfillment.id, 'PACKING');
  if (fulfillment.status === 'PACKING') await updateFulfillmentStatus(fulfillment.id, 'READY_TO_SHIP');
  return getFulfillmentByOrderId(order.id);
};

const getOrCreateShipment = async (order) => {
  try {
    return await getShipmentByOrderId(order.id);
  } catch (error) {
    if (!isFulfillmentNotFound(error)) throw error;
    const fulfillment = await progressFulfillmentToReady(order);
    const shipment = await createShipment(shipmentRequest(order, fulfillment));
    await notificationFor(order, 'SHIPMENT_CREATED', `Shipment created for ${order.orderNumber || order.id}`, `Tracking number ${shipment.trackingNumber} has been created.`);
    return shipment;
  }
};

const addTracking = async (order, shipment, status, description) =>
  addTrackingEvent(shipment.id, {
    status,
    location: order.shippingAddress?.city || 'Hyderabad',
    description,
    eventTime: new Date().toISOString(),
  });

const progressOrderStatus = async (order, target) => {
  let status = order.status;
  const apply = async (next) => {
    if (status === next) return;
    await updateOrderStatus(order.id, next);
    status = next;
  };
  if (target === 'CONFIRMED') await apply('CONFIRMED');
  if (target === 'PROCESSING') {
    if (status === 'CREATED') await apply('CONFIRMED');
    await apply('PROCESSING');
  }
  if (target === 'SHIPPED') {
    if (status === 'CREATED') await apply('CONFIRMED');
    if (status === 'CONFIRMED') await apply('PROCESSING');
    await apply('SHIPPED');
  }
  if (target === 'DELIVERED') {
    if (status === 'CREATED') await apply('CONFIRMED');
    if (status === 'CONFIRMED') await apply('PROCESSING');
    if (status === 'PROCESSING') await apply('SHIPPED');
    await apply('DELIVERED');
  }
};

export const runOrderServiceWorkflow = async (order, action) => {
  if (action === 'CONFIRM') {
    await progressOrderStatus(order, 'CONFIRMED');
    const fulfillment = await getOrCreateFulfillment(order);
    if (fulfillment.status === 'PENDING') await updateFulfillmentStatus(fulfillment.id, 'ALLOCATED');
    await notificationFor(order, 'ORDER_STATUS_UPDATED', `Order ${order.orderNumber || order.id} confirmed`, 'Your order has been confirmed.');
  }

  if (action === 'PACKING') {
    await progressOrderStatus(order, 'PROCESSING');
    const fulfillment = await getOrCreateFulfillment(order);
    const allocated = fulfillment.status === 'PENDING' ? await updateFulfillmentStatus(fulfillment.id, 'ALLOCATED') : fulfillment;
    if (allocated.status === 'ALLOCATED') await updateFulfillmentStatus(allocated.id, 'PACKING');
    await notificationFor(order, 'ORDER_STATUS_UPDATED', `Order ${order.orderNumber || order.id} is packing`, 'Your order is being packed.');
  }

  if (action === 'READY') {
    await progressFulfillmentToReady(order);
    await notificationFor(order, 'ORDER_STATUS_UPDATED', `Order ${order.orderNumber || order.id} is ready to ship`, 'Your order is packed and ready for shipment.');
  }

  if (action === 'SHIP') {
    let shipment = await getOrCreateShipment(order);
    if (shipment.status === 'CREATED') shipment = await updateShipmentStatus(shipment.id, 'IN_TRANSIT');
    await progressOrderStatus(order, 'SHIPPED');
    await addTracking(order, shipment, 'IN_TRANSIT', order.fulfillmentType === 'global' ? 'Shipment handed to carrier for nationwide delivery.' : 'Shipment picked up for store delivery.');
    await notificationFor(order, 'SHIPMENT_CREATED', `Order ${order.orderNumber || order.id} shipped`, order.fulfillmentType === 'global' ? 'Your order has shipped from the India-wide Global Store.' : 'Your order has shipped with Store Delivery.');
  }

  if (action === 'OUT_FOR_DELIVERY') {
    let shipment = await getOrCreateShipment(order);
    if (shipment.status === 'CREATED') shipment = await updateShipmentStatus(shipment.id, 'IN_TRANSIT');
    if (shipment.status === 'IN_TRANSIT') shipment = await updateShipmentStatus(shipment.id, 'OUT_FOR_DELIVERY');
    await addTracking(order, shipment, 'OUT_FOR_DELIVERY', 'Shipment is out for delivery.');
    await notificationFor(order, 'ORDER_STATUS_UPDATED', `Order ${order.orderNumber || order.id} is out for delivery`, 'Your order is out for delivery.');
  }

  if (action === 'DELIVER') {
    let shipment = await getOrCreateShipment(order);
    if (shipment.status === 'CREATED') shipment = await updateShipmentStatus(shipment.id, 'IN_TRANSIT');
    if (order.status !== 'SHIPPED' && order.status !== 'DELIVERED') await progressOrderStatus(order, 'SHIPPED');
    if (shipment.status === 'IN_TRANSIT') shipment = await updateShipmentStatus(shipment.id, 'OUT_FOR_DELIVERY');
    if (shipment.status === 'OUT_FOR_DELIVERY') shipment = await updateShipmentStatus(shipment.id, 'DELIVERED');
    if (order.status !== 'DELIVERED') await progressOrderStatus({ ...order, status: 'SHIPPED' }, 'DELIVERED');
    await addTracking(order, shipment, 'DELIVERED', 'Shipment delivered successfully.');
    await notificationFor(order, 'SHIPMENT_DELIVERED', `Order ${order.orderNumber || order.id} delivered`, 'Your order was delivered successfully.');
  }
};

export const prepareShipmentForAssignment = (order) => getOrCreateShipment(order);
