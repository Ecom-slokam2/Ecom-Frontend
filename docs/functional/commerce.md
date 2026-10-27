# Checkout, payments and orders

## O01 — Review checkout

Sources: [CheckoutPage](../../src/pages/CheckoutPage/CheckoutPage.jsx), [policy](../../src/utils/checkoutPolicy.js), [delivery lines](../../src/services/cartDeliveryLines.js).

Entry `/checkout`: review cart groups, recipient/contact information, delivery/pickup choices, notes, schedule, coupon entry and price breakdown. Delivery methods depend on store quotes; global goods are presented with an indicative 5–7 day delivery label.

Before proceeding, the page checks: nonempty cart; at least one delivery group; valid totals; verified delivery availability; selected address when delivery is used; quote completion; schedule date/slot for scheduled delivery or scheduled pickup; pickup store; saved contact edits; valid Indian contact mobile. Global products cannot use pickup.

Legacy express/same-day restored methods are normalized to standard in this page. Method options in settings are therefore not proof that every configured method is selectable in every checkout branch.

## O02 — Delivery quotes and grouping

Sources: [delivery charges](../../src/utils/deliveryCharges.js), [delivery utilities](../../src/utils/storeDelivery.js), [fulfillment selection](../../src/utils/storeFulfillment.js).

Per-item delivery lines retain supplying store, variant, fulfillment type, method, charge and quote details. Group identity includes fulfillment type, store and delivery method. Store-specific pickup choices are supported; a pickup line has no delivery charge.

For the shared `totalDeliveryCharge` calculation, non-global lines are grouped by store and method and the maximum charge in each group is counted once. Invalid or negative charges fail. Global lines are skipped by that helper.

The backend revalidates local delivery using store, coordinates, subtotal and method. It records matched zone, distance, route metrics, ETA, free-delivery decision and location. Discovery radius estimates are not authoritative quotes.

## O03 — Pricing and promotions

Sources: [coupon service](../../src/services/couponService.js), [order service](../../../ecom-backend/order-service/src/main/java/com/metaarch/order/order/OrderService.java).

Backend order total = verified item totals + delivery charge + handling fee, rounded to two decimal places. Current backend handling fee is **INR 5 per order**. Pickup delivery charge is zero. New orders begin with pending payment.

Catalog verification supplies product/variant pricing; duplicate item identity is rejected. New orders cannot claim a completed payment state.

Coupon entry and admin coupon configuration exist. Store Managers may configure coupons scoped only to their assigned store; the Catalog API derives that store from authenticated identity and enforces the same boundary on reads and writes. Coupon redemption remains disabled by the Catalog Service setting `app.promotions.redemption-enabled` (default `false`); validation returns no discount while it is off. Checkout policy also rejects unverified discounts. UI suggestions such as `SAVE10` do not make coupons redeemable.

Dormant coupon calculation supports fixed/percentage discounts, maximum discount and subtotal cap. Other dormant checks cover active status, dates, scope, minimum order and product/category targets. They are not an active promotion engine.

## O04 — Order creation and retry

Sources: [payment page](../../src/pages/PaymentOptions/PaymentOptions.jsx), [cart preparation](../../src/utils/checkoutCart.js), [order attempts](../../src/utils/orderCreationAttempt.js), [backend creation](../../../ecom-backend/order-service/src/main/java/com/metaarch/order/order/OrderCreation.java).

The payment page is also the order-submission page. It requires customer identity, supported method, cart items and a resolved store. Existing-order mode loads that saved order.

Before creating a new order, frontend prepares a server cart and checks global-product eligibility where applicable. Order payload includes items, address snapshots, notes, delivery and schedule details. Global groups use `global-store` as their order store in the split branch.

Backend idempotency keys must contain 16–128 letters, digits, underscores or hyphens. Reusing a key with different request content is rejected. A cart already ordered cannot silently produce a different order.

The screen suppresses duplicate submissions in its COD/group branches. This does not make every split operation atomic; see O05.

## O05 — Multiple stores and checkout groups

Sources: [persisted checkout](../../src/utils/persistedStoreCheckout.js), [group helper](../../src/utils/checkoutGroup.js), [group page](../../src/pages/CheckoutGroupPage.jsx), [group result](../../src/components/CheckoutGroupResult.jsx).

`VITE_PERSISTED_MULTI_STORE_CHECKOUT` is enabled unless its value is exactly `false`. If disabled, a multigroup cart is blocked before submission.

The persisted group helper validates one customer, distinct stores and nonempty items, prepares store carts, checks inventory, retains an intent/idempotency record in session storage, and looks up an existing attempt before submitting again. A changed unresolved attempt must be reconciled. Reset helpers only permit replacement of the customer's fully compensated failed checkout and avoid clearing unrelated store-cart attempts.

**Actual branch priority matters:** new-order COD executes before the persisted-group branch. COD with global/multiple groups calls `createOrLoadOrder`, which creates child orders with `Promise.all`. It is not the same atomic/coordinated flow as `persistStoreCheckout`. A child failure can leave another child created. The success object includes child orders but payment lookup is for the leading order.

`/checkout-group/:groupId` is the persisted group result/recovery route. Document and test its outcomes separately from COD split-order outcomes.

The page verifies group ID and customer ownership, polls unresolved states every three seconds, and attempts to resume PREPARED once on load. States presented are PREPARED, RESERVING, COMMITTING, COMPENSATING, COMPLETED and FAILED. “Orders saved” requires COMPLETED, no recovery flag, every child CONFIRMED with an order ID, and a valid positive persisted aggregate total. A fresh checkout is offered only when FAILED children are all RELEASED without order IDs and no recovery is required. Retrying never means simply presenting partial children as success.

## O06 — Payment options and payment records

Sources: [payment page](../../src/pages/PaymentOptions/PaymentOptions.jsx), [payment API](../../src/services/paymentApi.js), [backend controller](../../../ecom-backend/payment-service/src/main/java/com/metaarch/payment/payment/PaymentController.java).

The code defines UPI, card and COD choices using `DEMO_UPI`, `DEMO_CARD`, `DEMO_COD`. COD is selected by default. Online availability depends on capabilities.

Current Payment Service capabilities return `processingEnabled: false`. Public initiation, demo processing and demo refund methods are explicitly denied by controller authorization. Consequently this baseline does **not** provide working online payment collection or customer refund processing.

New COD creates a saved order and attempts to read its payment record up to four times. Success may display a pending placeholder when no payment record is returned. COD order success is not payment success. Cart cleanup follows successful order creation.

The non-COD branch checks processing capabilities, saved order identity/total, payment identity and server status reads. It checks handling fee and displayed-vs-server totals before initiating payment. Those controls do not activate the disabled provider.

Payment reads expose saved record, status and transactions subject to ownership. Receipts must not label an unverified pending order as paid.

## O07 — Order history, detail and cancellation

Sources: [orders list](../../src/pages/OrdersListPage/OrdersListPage.jsx), [detail](../../src/pages/OrderDetailViewPage/OrderDetailViewPage.jsx), [order page](../../src/pages/OrderPage/OrderPage.jsx), [backend controller](../../../ecom-backend/order-service/src/main/java/com/metaarch/order/order/OrderController.java).

`/orders` loads customer order history and supports search/status/time filtering. `/order-details/:orderId` loads order, items and associated payment/fulfillment information. `/order` and `/order/:orderId` provide order presentation; parameterless pages depend on navigation/context state.

Detail displays current status, products, address and delivery metadata, financial summary, tracking and available actions. Pending orders refresh; terminal status stops relevant polling. Backend outages produce an unavailable/error state.

Customer cancellation is confirmed in a dialog and rechecked by the server. SHIPPED and DELIVERED cannot be cancelled. Repeating cancellation on an already-cancelled order is idempotent. Customer ownership is required.

The detail-page REORDER button currently adds the **first item**, not an automatic reconstruction of the full order. Current cart/store resolution and availability still apply.

## O08 — Tracking, notifications and documents

Sources: [tracking hook](../../src/hooks/useFulfillmentTracking.js), [tracking panel](../../src/components/FulfillmentTrackingPanel/FulfillmentTrackingPanel.jsx), [notifications](../../src/components/NotificationHistoryPanel/NotificationHistoryPanel.jsx), [documents](../../src/components/OrderDocuments.jsx).

Tracking combines order, fulfillment, shipment and events. `/tracking` chooses the first fetched history order; it is not a multi-order tracking selector. Order detail is the specific-order route.

Backend notification history is distinct from C15's local inbox. Missing fulfillment/shipment can mean not yet created; it should not be fabricated as delivered. Demo tracking components also exist and are not live courier telemetry.

Order documents expose invoice PDF download and an order summary/receipt view. Both explicitly state that they are not a tax invoice or proof of payment. Payment labels should be based on a verified matching payment record, including customer/order/amount checks where used.

## O09 — Delivered-order review

Sources: [review page](../../src/pages/OrderReviewPage/OrderReviewPage.jsx), [review backend](../../../ecom-backend/order-service/src/main/java/com/metaarch/order/order/OrderReviewService.java).

Entry `/order-details/:orderId/review`, login protected. The page loads order, existing review, fulfillment and shipment. It enables the form when order or delivery state indicates DELIVERED; otherwise it explains review eligibility.

Customer submits a 1–5 star rating, optional comment and up to three images smaller than 120 KB each. Existing reviews can be edited. Backend persists one review per order and updates it on resubmission. Accepted photo values are image data URLs or HTTPS URLs.

Backend owner authorization applies. However the backend service rejects cancelled orders rather than independently requiring completed delivery; this is weaker than the UI rule. General local product reviews (C14) are not this database-backed review feature.
