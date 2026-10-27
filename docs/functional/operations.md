# Store and delivery operations

## S01 — Store Manager entry and dashboard

Sources: [portal](../../src/pages/StoreManager/StoreManagerPortal.jsx), [navigation](../../src/config/storeManagerNavigation.js).

Store Manager signs in and lands on `/store-manager/dashboard`. Assigned store resolves from user store ID or matching cached store data. Missing/unavailable assignment produces an explicit configuration/error state, with some cached-store fallback behavior.

Dashboard summarizes the assigned store and local order collection and links to radius/orders. It is not guaranteed to be a live server-order dashboard. Products, banners, inventory and orders navigate into the scoped admin workspace.

`/store-manager/orders` redirects to `/admin/orders`. The separate StoreOrdersPage implementation is not the route's current target. Coupons/reports are allowed in access configuration but not shown in the dedicated sidebar.

## S02 — Store profile, settings and password

Profile edits store information, contacts, address and operational settings. Delivery settings manage the store's delivery/pickup configuration. Save calls catalog store operations where applicable. Required store/address/location prerequisites must be satisfied for downstream zone creation.

Password screen asks for current password, new password and confirmation, with a six-character frontend minimum. It calls the **local `staffProfileStore`**, comparing against a locally available password and updating local staff records. It does not call the organization access password endpoint. Consequently it may reject a valid backend password or fail to change the real login credential. Delivery Partner password editing uses a different, backend-backed path.

A store loaded only from cached data does not establish that the catalog database contains it. Radius saving contains an explicit store-resolution/create recovery path; failure asks the manager to complete store address and coordinates.

## S03 — Delivery radius rules

Source: [portal radius page](../../src/pages/StoreManager/StoreManagerPortal.jsx).

Manager adds/edits/deletes radius rules and previews them on a map. Each rule includes radius, ETA bounds, delivery charge, free-delivery threshold, minimum order, state and per-method settings.

Radius must be greater than zero and unique among the store's rules. Saving sorts radii and builds contiguous bands from zero: for example radii 3 and 8 produce 0–3 and 3–8 km. Normalized rules are saved sequentially, so an intermediate failure needs reload/reconciliation. Success clears delivery-quote cache and reloads rules.

Delivery methods include Standard, Instant, Express, Scheduled and Pickup, with enabled flags and method-specific charge/configuration. Enabling a setting does not bypass checkout's own supported-method rules.

## S04 — Quote behavior

Source: [StoreDeliveryService](../../../ecom-backend/catalog-service/src/main/java/com/metaarch/catalog/store/StoreDeliveryService.java).

The catalog backend uses a driving-route provider to obtain distance/time/geometry. Store and customer coordinates are required. An active matching distance band is selected, then the delivery method and minimum order are evaluated.

If order total reaches free-delivery threshold, delivery charge becomes zero for non-pickup. Pickup also has zero charge. Out-of-area, unavailable method and insufficient minimum order return unavailable quote details/messages. Routing failure is not equivalent to a zero-distance free quote.

Bands include both bounds in matching; shared-boundary results depend on the query ordering/first match. Test exact boundary distances.

## S05 — Create and manage delivery partners

Sources: [partner page](../../src/pages/StoreManager/DeliveryPartners.jsx), [partner API](../../src/services/deliveryPartnerApi.js), [controller](../../../ecom-backend/Ecom-Org-access/src/main/java/com/metaarch/orgaccess/identity/DeliveryPartnerController.java).

Manager views partners for the store, sees active counts, refreshes on error, creates a partner and toggles active state.

Create fields: name, mobile, username, email, password, vehicle type/number, licence number, optional address and active flag. UI requires all listed text fields except address; password minimum is eight characters. Mobile HTML validation allows the configured phone-character pattern/length. Server validation is authoritative.

Created partner is assigned to the manager's store automatically. Save returns the record into a sorted list. Status changes persist through the partner API. Deactivating a partner and being currently on delivery are different concepts; assignment filters evaluate active/status/store.

## S06 — Assign or retry a delivery

Source: [DeliveryPartnerAssignment](../../src/pages/AdminWorkspace/DeliveryPartnerAssignment.jsx).

1. Open a saved order's delivery assignment action.
2. Load order/items, shipment and available partners.
3. Filter to active partners whose store ID equals the order store.
4. Select partner; prepare fulfillment/shipment when necessary.
5. Assign partner details to the saved shipment and show success.

Order must have a valid database UUID. Delivered, cancelled and returned shipments cannot be reassigned. FAILED shipment can be reset to CREATED and assigned for a retry. Shipment/partner loading failures disable assignment; operators can refresh availability.

Backend ownership of the order-items endpoint may differ from broad staff read permission; verify actual staff authorization. Global parcel orders are not ordinary local-partner assignments.

## D01 — Delivery dashboard, availability and profile

Sources: [DeliveryWorkspace](../../src/pages/DeliveryWorkspace/DeliveryWorkspace.jsx), [staff profile controller](../../../ecom-backend/Ecom-Org-access/src/main/java/com/metaarch/orgaccess/identity/StaffProfileController.java).

Delivery Partner opens `/delivery`. Profile and delivery feeds load independently; a delivery-service failure need not hide the partner profile. Profile availability is refreshed periodically. Partner can switch availability and submit current GPS location.

Profile includes name, phone, email, vehicle information, address/location, emergency contact and licence; password change uses current/new/confirmation. `mustChangePassword` opens the profile/password dialog on entry.

## D02 — Assigned orders and progression

Entry `/delivery/orders`. Only the partner's assigned deliveries are returned through the dedicated operations endpoint. Cards show order ID/source store, order value, customer contact, address and items. Terminal outcomes are separated into history.

The workflow exposes acceptance, pickup, start delivery, OTP completion and cancellation with reason. Backend checks assignment ownership and shipment state. Accept and Start use dedicated fulfillment endpoints; start requires pickup/acceptance conditions enforced by those endpoints.

Cancellation requires a reason. Before out-for-delivery it requests CANCELLED; during out-for-delivery it records FAILED, allowing an operational retry. Finalized shipments reject further progress.

## D03 — Customer OTP completion

Source: [DeliveryOperationsController](../../../ecom-backend/Ecom-Org-access/src/main/java/com/metaarch/orgaccess/identity/DeliveryOperationsController.java).

After starting delivery, partner requests a six-digit OTP, created as a backend PUSH notification for the customer/order. The UI permits entry/resend and completion.

Backend rules:

- Shipment must be OUT_FOR_DELIVERY and assigned to this partner.
- OTP expires after 15 minutes.
- A new OTP cannot be requested within 60 seconds of issuance.
- Maximum five verification attempts for the current challenge.
- Code is checked against its stored hash and consumed after success.
- Wrong, expired, consumed or locked code cannot complete delivery.

Success changes shipment to DELIVERED and adds a tracking event. This is independent of the demonstration deletion code and any local demo-delivery OTP.

## D04 — History and performance

Entry `/delivery/history`. Delivered, failed, cancelled and returned outcomes have separate labels/colors. Partner can filter/search/sort history and expand details, including the authorized shipment tracking-event timeline. The dashboard provides outcome/performance charts.

Time aggregation selects daily buckets up to 31 days, weekly up to 98 and monthly thereafter. History date uses delivered timestamp or shipment update time, falling back to creation. These charts summarize returned assignments, not earnings or payroll.

## D05 — Navigation

Source: [DeliveryNavigationPage](../../src/pages/DeliveryNavigationPage/DeliveryNavigationPage.jsx).

`/delivery/navigation` accepts an order through navigation state, reads a shipping address, attempts browser GPS and geocodes destination. It displays an OpenStreetMap embed and external directions links.

Displayed distance is straight-line distance; estimated time assumes 25 km/h with minimum five minutes. It is not the catalog driving-route quote.

Navigation requires an assigned order in route state, a usable shipping destination, and a valid browser GPS reading. If GPS is denied/unavailable or the destination cannot be resolved, the page reports the problem instead of displaying a route based on fallback coordinates. Displayed distance is straight-line distance; estimated time assumes 25 km/h with minimum five minutes. It is not the catalog driving-route quote.
