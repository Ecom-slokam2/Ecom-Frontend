# Administration

Sources: [AdminWorkspace](../../src/pages/AdminWorkspace/AdminWorkspace.jsx), [access configuration](../../src/config/accessControl.js), [local data store](../../src/services/localDataService.js). Refer to [roles](roles.md) for who can open each module.

## A01 — Workspace, navigation and common actions

`/admin/*` selects modules within one workspace. Navigation is filtered by role. Lists support search, status filtering and pagination where rendered; records open in detail/create/edit dialogs. Common actions include create, edit, activate/deactivate and delete; products and coupons also expose duplicate. Confirmation is used for deletion/rejection.

These controls share UI machinery but do not share one persistence guarantee. Catalog/inventory actions call services; many other collections use local browser storage. A generic “saved” record must not be assumed available to another operator on another computer.

View dialogs display record fields. Image upload checks image MIME and a 2 MB limit for the single-image handler. Multi-image upload filters accepted files. Required fields, URL validation, role eligibility and module-specific validations run before save.

## A02 — Dashboard

Summarizes scoped operational data and offers navigation into management areas. Metrics use loaded/cached collections and orders. Availability depends on the underlying services and local data. Treat them as operational UI totals, not audited financial statements.

## A03 — Locations

Super Admin maintains location name, code, address, city, state, country, PIN, coordinates, telephone, email and assigned-admin information. Name, code, address and city are required in the schema.

Create/edit/status/delete use the workspace's collection behavior. Location labels participate in scope matching; inconsistent spelling can affect what Location Admin sees. This is not a verified geographic-boundary management service.

## A04 — Staff users

User entry includes name, username, email, mobile, role, location/store assignment, password and Active/Blocked state. Name, email, mobile, role and password are required by the schema. Username may be derived when absent.

Location Admin assignment requires a location. Store Manager creation requires an existing store or new-store details; new-store location and address are validated. Role creation is constrained by `MANAGEABLE_ROLES`. Backend creation calls the organization access service.

General user management has the frontend/backend mismatch described in [roles](roles.md). A local status edit is not evidence that the authentication service blocked the account. Validate each mutation's persistence independently.

## A05 — Categories

Category fields: name, description, thumbnail URL and Active/Inactive state. Name/status required; image URL must be HTTP(S). Catalog API supports category lifecycle. Category links and selected category affect customer product discovery.

Deletion/inactivation must be tested with linked products; the presence of a delete button alone does not define cascading behavior.

## A06 — Stores

Fields include store name/code, description, manager name, map location/address components, contact numbers/email, GST number, rating, opening/closing time, logo URL, delivery/pickup flags, Active/Inactive/Temporarily Closed status, radius, ETA, delivery charge, free-delivery threshold, methods and notes.

Name, location, delivery/pickup flags, status, radius and ETA are marked required. Validation also requires address and a selected map point; negative radius and ETA are rejected. Location search and current map point support address entry. An embedded map and radius visualization aid review.

Catalog create/update persists store details. Own-store manager editing has a separate portal. Opening hours, GST and rating fields should not be assumed to drive enforcement or tax calculation merely because they can be entered.

## A07 — Products, variants and images

Product schema includes name, master SKU, category/subcategory, description, brand, ingredients, specifications, pack/type/shelf life, tags, highlights, source description, default price, image URL and merchandising flags (featured, special, new arrival, bestseller). State choices are Active, Inactive and Draft.

Required: name, SKU, category, description, price and status. Variant input uses one line per `Label | SKU | Price`. Catalog service has product, variant, image and store-product endpoints. Store mappings determine which store sells the product; master catalog presence alone does not ensure customer availability.

Actions include create/edit/status handling, duplicate and delete where rendered. A duplicate requires checking SKU/variant uniqueness against server validation. Images and variants may require multiple service calls; partial-save errors need operator review.

## A08 — Banners and campaigns

Entry includes title, description, desktop image, optional mobile image, start/end dates, sort order, target URL and Active/Scheduled/Inactive status. Desktop image/title/status required. Store Managers may read and manage banners only for their assigned store. The form omits scope/location/store controls; the API derives and enforces the assigned store from authenticated identity and rejects attempts to target another store or broader scope. Location Admin can optionally target a specific store. Catalog banner calls persist banner records. Customer visibility also depends on dates/status/scope and storefront selection.

## A09 — Inventory

Fields: product, optional variant, store, available quantity, reserved quantity, reorder threshold and ACTIVE/INACTIVE/OUT_OF_STOCK state. Product, store, current quantity and state are required.

The workspace loads inventory and adapts product/store references, opens current inventory for editing, supports adjustments, and has stock +10 and stock -1 shortcuts. Inventory API also supports reserve/release operations. Reserved quantity must not be confused with freely available stock.

Store Managers are scoped to their assigned store. Missing assignment prevents relevant operations. Server inventory responses and stock movements govern actual availability; local display changes do not authorize overselling.

## A10 — Orders and fulfillment controls

Orders can be searched/fetched, inspected and progressed using actions such as Confirm, Pack, Ready, Ship, Out and Delivered where rendered. These may update Order, Fulfillment, Shipment and Notification services via the workflow adapter.

Order status, fulfillment status and shipment status differ. Ready is a fulfillment state; Out for Delivery is a shipment state. Do not expect a one-to-one order-status label for every operational action.

Assignment routes are `/admin/orders/assign/:orderId` for the local global-store assignment view and `/admin/orders/delivery/:orderId` for backend delivery partner assignment.

For Store Manager backend workflow failure is surfaced. Some non-manager actions can continue using a local demo order after a backend failure; the UI reports this fallback. Such success is not a database update.

Reject/cancel actions need backend authorization/status validation. The general status endpoint refuses CANCELLED and requires the dedicated cancel API. A visible Reject button is not proof that a staff account can cancel via the customer-owned cancellation endpoint.

## A11 — Global approval and stocked-store assignment

Sources: [GlobalStoreAssignment](../../src/pages/AdminWorkspace/GlobalStoreAssignment.jsx), [local order store](../../src/services/localDataService.js).

The global assignment screen reads a local order and lists candidate active stores able to fulfill its complete product group, ordered by the local distance logic. Operator selects a store and confirms. Reassignment after approval is rejected. No stocked candidate gives an explicit unavailable state.

The local order store contains approve/transfer, carrier/tracking entry and parcel-status operations. Local dispatch requires approval, a prepared state and carrier/tracking number. These functions are not proof of an integrated carrier booking API.

This screen mutates local order state. Separately, AdminWorkspace has backend status paths for global orders. End-to-end global approval/assignment must not be described as a single consistently persisted service workflow.

## A12 — Payments

Payment-related operational records are accessible to configured admin roles. Their display must be reconciled with the actual Payment Service record rather than treated as settlement evidence.

Online processing and public demo refund are disabled by Payment Service. There is no confirmed working operator refund workflow in this baseline. Reporting a pending COD order as settled would be incorrect.

## A13 — Delivery module

For non-Store-Manager roles, the general schema is partner name, mobile, email, vehicle number/type, address, location, emergency contact, licence, temporary password and state.

For Store Manager the same module switches to delivery-zone schema: minimum/maximum radius, ETA bounds, charge, free-delivery threshold, minimum order, allowed methods, state and map. Maximum radius must exceed minimum radius.

The dedicated Store Manager Delivery Partners page uses backend partner APIs; it is distinct from generic local delivery collections.

## A14 — Customer records

General customer management includes name/mobile, email, location, spending, notes and Active/Blocked state. Name and mobile required. These workspace records are collection-backed; editing them does not establish that the customer's authentication account/profile/spend ledger has changed.

## A15 — Review moderation

Local review records include customer/product, review text, rating, approval state, response and images. Operators can inspect, approve/reject, edit, activate/deactivate and remove records through common controls. Approved active reviews drive C14's visible review set.

This moderation flow is separate from backend order reviews. There is no demonstrated synchronization that makes moderating one automatically moderate the other.

## A16 — Coupon configuration

Fields include code, name, description, fixed/percentage discount, value, minimum order, maximum discount, start/expiry dates, usage/per-user limits, product/category targeting, eligibility and state. Code/name/type/value/dates/usage limit/eligibility/state are required in schema. Store Managers may read and manage coupons only for their assigned store; scope is derived and enforced by the API from authenticated identity, and the form does not offer scope/location/store overrides. Location Admin can select a target store within its assigned location.

Expiry cannot precede start date. Duplicate is available. Local configuration does not activate customer redemption: checkout coupons remain disabled. Usage/eligibility fields should not be represented as server-enforced redemption rules.

## A17 — Notifications

Operators enter title, message, audience (all customers, customer, store or delivery partner), optional location, type and schedule. The general workspace notification behavior uses local storage.

Creating or scheduling such a record is not evidence of scheduled delivery to a real recipient. Service-backed order notifications and delivery OTP creation are separate integrations.

## A18 — Reports and export

Source: [AdminReports](../../src/pages/AdminWorkspace/AdminReports.jsx).

Reports offer date, location and store filters; sorting stores by revenue, order count or name; reset; and JSON export named `scoped-report.json`. KPIs include revenue, orders, delivered, customers, products and stock units.

Current revenue sums order totals excluding the exact title-case `Cancelled`; delivered counts exact `Delivered`. Uppercase backend statuses need normalization to avoid inconsistent results. This is not a paid-revenue computation.

Store performance uses the supplied full orders collection rather than the date-filtered collection. Customer/product/stock counts are also not recalculated from the selected order dates. The “All stores in location” option value differs from the `All` sentinel used by filtering. These differences are recorded in the gaps register.

## A19 — Security settings

Super Admin can manage local setting records with name, description, type (RBAC, 2FA, Session, IP Restriction), value and Enabled/Disabled state.

These records are not evidence that backend authentication actually enables 2FA, enforces an IP allowlist or changes session policy. Enforcement requires a separate trace to consuming security code.

## A20 — Audit records, profile and hidden schemas

Local collection operations write audit entries for create/update/save/delete. Audit viewing is configured for Super/Global Admin. This is a browser activity record, not a tamper-resistant centralized audit trail.

Admin profile/settings dialog edits staff information and passwords through local staff-profile logic; Store Manager may also update store catalog data. The dedicated Store Manager password screen also uses the local staff store; Delivery Partner password changes use the organization access API. Treat these as separate paths.

`cms` and `settings` schemas exist but are absent from the active module list/access configuration. Do not document them as accessible admin capabilities. Static customer legal/about pages do not establish a working CMS.
