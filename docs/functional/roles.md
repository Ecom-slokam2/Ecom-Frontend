# Roles and permissions

Sources: [access configuration](../../src/config/accessControl.js), [router](../../src/router.jsx), [route guard](../../src/components/ProtectedRoute/ProtectedRoute.jsx), [staff authentication](../../src/services/orgAccessService.js).

## Account types

| Role | Functional responsibility | Default staff landing |
|---|---|---|
| Customer | Own profile, shopping, addresses, orders and reviews | Customer home |
| Super Admin | Broad administration, location setup and higher-level staff management | `/admin` |
| Global Admin | Global commercial operations and global-order coordination | `/admin` |
| Location Admin | Stores and operations associated with a location | `/admin` |
| Store Manager | Assigned store, stock, orders, delivery settings and partners | `/store-manager/dashboard` |
| Delivery Partner | Own assignments, delivery progress and profile | `/delivery` |

Guest browsing is supported but Guest is not an account role. Role strings are normalized from forms such as `ROLE_STORE_MANAGER` to `store-manager`.

Team login (`/team-login`) takes username/password, calls organization authentication and loads `/api/users/me`, then stores the session and redirects by normalized role. Errors remain on the login screen. Unlike the shared customer Login fallback, this screen does not explicitly reject unexpected roles before redirect; destination route guards still apply. See [RoleLoginPage](../../src/pages/RoleLoginPage/RoleLoginPage.jsx).

## Configured admin module access

These are frontend module permissions, not a guarantee that each API action is authorized.

| Module | Super Admin | Global Admin | Location Admin | Store Manager |
|---|:---:|:---:|:---:|:---:|
| Dashboard | Yes | Yes | Yes | Yes |
| Locations | Yes | No | No | No |
| Users | Yes | No | No | No |
| Categories | Yes | No | No | No |
| Stores | Yes | No | Yes | Own-store portal |
| Products | Yes | Yes | Yes | Yes |
| Banners | Yes | Yes | Yes | Yes |
| Inventory | Yes | Yes | Yes | Yes |
| Orders | Yes | Yes | Yes | Yes |
| Payments | Yes | Yes | Yes | No |
| Delivery | Yes | No | Yes | Yes |
| Notifications | Yes | Yes | No | No |
| Customers | Yes | Yes | No | No |
| Reviews | Yes | Yes | No | No |
| Coupons | Yes | Yes | Yes | Yes |
| Reports | Yes | Yes | Yes | Yes |
| Security | Yes | No | No | No |
| Audit logs | Yes | Yes | No | No |

Store Manager banner and coupon permission is explicitly approved: managers may list/read, create, edit, activate/deactivate, and delete records scoped to their assigned store. The Catalog API derives the store from the authenticated `SCOPE_STORE:<id>` authority, validates that the store exists, rejects conflicting scope/store/location values, and filters list/detail/mutations to that store. Location/global promotion records and other stores are not visible or manageable by Store Managers. These permissions do not enable coupon redemption; checkout continues to reject coupon discounts while server redemption is disabled.

## Ownership and scope

Super Admin bypasses the shared record-scope filter. Global Admin's shared filter restricts order-like collections containing items to global fulfillment; it does not universally restrict all collections.

Location Admin scope uses location and associated stores/products. Order matching also checks source location and fulfillment assignments. Store Manager order matching includes store IDs, store names and item/assignment references. Unapproved global orders are excluded by the shared scoped-order filter for these lower roles.

These filters support presentation. Backend access remains authoritative. Core order controllers use `orderAccess` checks for customer ownership, store access, read and manage operations. Customer cancellation, order items and order reviews use owner checks.

## Staff creation differences

Frontend `MANAGEABLE_ROLES` specifies:

- Super Admin: Global Admin and Location Admin.
- Location Admin: Store Manager and Delivery Partner.

However, Location Admin has no Users module. The general backend `/api/users` POST requires Super Admin or Global Admin **and** `PERM_USER_WRITE`. Global Admin has no frontend Users module or manageable-role list. These are implementation differences, not a working hierarchy to assume.

Store Manager partner creation is a separate supported path through the Delivery Partners portal and its dedicated backend controller. Do not confuse it with general user creation.

## Route behavior

Unauthenticated protected-route access redirects to `/login`, retaining a return path. A signed-in account with a mismatched role goes to `/unauthorized`.

`/admin/*` admits the four administrative roles, followed by module checks. Dedicated Store Manager routes require Store Manager specifically. Delivery routes require Delivery Partner specifically. Super Admin does not automatically inherit these dedicated routes.

Profile and order-review routes use a login guard without a customer-only role list. Many other customer routes do not have a router-level guard; their page logic or backend requests enforce login/ownership. Public route visibility must not be interpreted as public API access.

## Acceptance

For each role, verify allowed modules, direct URL attempts, cross-store/cross-customer reads, and attempted writes. Test valid-but-forbidden sessions separately from expired sessions. Resolve the documented staff-management mismatch before describing an end-to-end staff hierarchy as operational.
