import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import Introduction from "./pages/Introduction/Introduction";
import Register from "./pages/Register/Register";
import OTPVerification from "./components/OTPVerification/OTPVerification";
import Login from "./pages/Login/Login";
import Home from "./pages/Home/Home";
import BannerPage from "./pages/BannerPage";
import Profile from "./pages/Profile/Profile";
import CartPage from "./pages/CartPage/CartPage";
import ProductInfo from "./components/ProductInfo/ProductInfo";
import PaymentOptions from "./pages/PaymentOptions/PaymentOptions";
import CheckoutGroupPage from "./pages/CheckoutGroupPage";
import OrderPage from "./pages/OrderPage/OrderPage";
import SearchPage from "./pages/SearchPage/SearchPage";
import AddressMapPage from "./pages/AddressMapPage/AddressMapPage";
import AddressSearchPage from "./pages/AddressSearchPage/AddressSearchPage";
import AddressFormPage from "./pages/AddressFormPage/AddressFormPage";
import WishlistPage from "./pages/WishlistPage/WishlistPage";
import SavedForLaterPage from "./pages/SavedForLaterPage/SavedForLaterPage";
import OrdersListPage from "./pages/OrdersListPage/OrdersListPage";
import OrderDetailViewPage from "./pages/OrderDetailViewPage/OrderDetailViewPage";
import OrderReviewPage from "./pages/OrderReviewPage/OrderReviewPage";
import SavedAddressesPage from "./pages/SavedAddressesPage/SavedAddressesPage";
import HelpCenterPage from "./pages/HelpCenterPage/HelpCenterPage";
import DeleteAccountPage from "./pages/DeleteAccountPage/DeleteAccountPage";
import LegalPolicyPage from "./pages/LegalPolicyPage/LegalPolicyPage";
import CategoriesPage from "./pages/CategoriesPage/CategoriesPage";
import CustomerFeaturePage from "./pages/CustomerFeaturePage/CustomerFeaturePage";
import AdminWorkspace from "./pages/AdminWorkspace/AdminWorkspace";
import DeliveryWorkspace from "./pages/DeliveryWorkspace/DeliveryWorkspace";
import ProtectedRoute from "./components/ProtectedRoute/ProtectedRoute";
import StatusPage from "./pages/StatusPage/StatusPage";
import CheckoutPage from "./pages/CheckoutPage/CheckoutPage";
import RoleLoginPage from "./pages/RoleLoginPage/RoleLoginPage";
import DeliveryNavigationPage from "./pages/DeliveryNavigationPage/DeliveryNavigationPage";
import LanguageSelectionPage from "./pages/LanguageSelectionPage/LanguageSelectionPage";
import StorePage from "./pages/StorePage/StorePage";
import StoresListPage from "./pages/StoresListPage/StoresListPage";
import StoreManagerPortal from "./pages/StoreManager/StoreManagerPortal";

import { Navigate } from "react-router-dom";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { path: "forgot-password", element: <Login key="forgot" initialMode="forgot" /> },
      { path: "mobile-login", element: <Login key="mobile" initialMode="mobile" /> },
      {
        path: "",
        element: <Navigate to="/home" replace />,
      },
      {
        path: "intro",
        element: <Introduction />,
      },
      {
        path: "register",
        element: <Register />,
      },
      {
        path: "register-otp",
        element: <OTPVerification />,
      },
      {
        path: "login",
        element: <Login />,
      },
      {
        path: "home",
        element: <Home />,
      },
      {
        path: "search",
        element: <SearchPage />,
      },
      { path: "banners/:bannerId", element: <BannerPage /> },
      {
        path: "stores",
        element: <StoresListPage />,
      },
      {
        path: "stores/:storeId",
        element: <StorePage />,
      },
      {
        path: "categories",
        element: <CategoriesPage />,
      },
      {
        path: "product-info/:productId",
        element: <ProductInfo />,
      },
      {
        path: "product-info",
        element: <ProductInfo />,
      },
      {
        path: "cart",
        element: <CartPage />,
      },
      {
        path: "wishlist",
        element: <WishlistPage />,
      },
      {
        path: "saved-for-later",
        element: <SavedForLaterPage />,
      },
      {
        path: "orders",
        element: <OrdersListPage />,
      },
      { path: "checkout-group/:groupId", element: <CheckoutGroupPage /> },
      {
        path: "order-details",
        element: <OrderDetailViewPage />,
      },
      {
        path: "order-details/:orderId/review",
        element: <ProtectedRoute><OrderReviewPage /></ProtectedRoute>,
      },
      {
        path: "order-details/:orderId",
        element: <OrderDetailViewPage />,
      },
      {
        path: "saved-addresses",
        element: <SavedAddressesPage />,
      },
      {
        path: "help-center",
        element: <HelpCenterPage />,
      },
      {
        path: "delete-account",
        element: <DeleteAccountPage />,
      },
      {
        path: "privacy-policy",
        element: <LegalPolicyPage title="Privacy Policy" />,
      },
      {
        path: "terms-conditions",
        element: <LegalPolicyPage title="Terms & Conditions" />,
      },
      {
        path: "address-map",
        element: <AddressMapPage />,
      },
      {
        path: "address-search",
        element: <AddressSearchPage />,
      },
      {
        path: "address-form",
        element: <AddressFormPage />,
      },
      {
        path: "payment-options",
        element: <PaymentOptions />,
      },
      { path: "checkout", element: <CheckoutPage /> },
      {
        path: "order",
        element: <OrderPage />,
      },
      {
        path: "order/:orderId",
        element: <OrderPage />,
      },
      {
        path: "profile",
        element: <ProtectedRoute><Profile /></ProtectedRoute>,
      },
      { path: "language", element: <LanguageSelectionPage /> },
      { path: "notifications", element: <CustomerFeaturePage type="notifications" /> },
      { path: "reviews", element: <CustomerFeaturePage type="reviews" /> },
      { path: "rewards", element: <CustomerFeaturePage type="loyalty" /> },
      { path: "settings/language", element: <LanguageSelectionPage /> },
      { path: "tracking", element: <CustomerFeaturePage type="tracking" /> },
      { path: "about-us", element: <CustomerFeaturePage type="about" /> },
      { path: "contact-us", element: <CustomerFeaturePage type="contact" /> },
      { path: "team-login", element: <RoleLoginPage /> },
      { path: "admin/*", element: <ProtectedRoute roles={['super-admin', 'global-admin', 'location-admin', 'store-manager']}><AdminWorkspace /></ProtectedRoute> },
      { path: "store-manager/dashboard", element: <ProtectedRoute roles={['store-manager']}><StoreManagerPortal page="dashboard" /></ProtectedRoute> },
      { path: "store-manager/products", element: <ProtectedRoute roles={['store-manager']}><StoreManagerPortal page="products" /></ProtectedRoute> },
      { path: "store-manager/profile", element: <ProtectedRoute roles={['store-manager']}><StoreManagerPortal page="profile" /></ProtectedRoute> },
      { path: "store-manager/orders", element: <ProtectedRoute roles={['store-manager']}><Navigate to="/admin/orders" replace /></ProtectedRoute> },
      { path: "store-manager/delivery-partners", element: <ProtectedRoute roles={['store-manager']}><StoreManagerPortal page="delivery-partners" /></ProtectedRoute> },
      { path: "store-manager/delivery-radius", element: <ProtectedRoute roles={['store-manager']}><StoreManagerPortal page="delivery-radius" /></ProtectedRoute> },
      { path: "store-manager/delivery-settings", element: <ProtectedRoute roles={['store-manager']}><StoreManagerPortal page="delivery-settings" /></ProtectedRoute> },
      { path: "store-manager/change-password", element: <ProtectedRoute roles={['store-manager']}><StoreManagerPortal page="change-password" /></ProtectedRoute> },
      { path: "delivery", element: <ProtectedRoute roles={['delivery-partner']}><DeliveryWorkspace section="dashboard" /></ProtectedRoute> },
      { path: "delivery/orders", element: <ProtectedRoute roles={['delivery-partner']}><DeliveryWorkspace section="orders" /></ProtectedRoute> },
      { path: "delivery/history", element: <ProtectedRoute roles={['delivery-partner']}><DeliveryWorkspace section="history" /></ProtectedRoute> },
      { path: "delivery/navigation", element: <ProtectedRoute roles={['delivery-partner']}><DeliveryNavigationPage /></ProtectedRoute> },
      { path: "unauthorized", element: <StatusPage title="Access denied" message="Your account does not have permission to open this area." /> },
      { path: "*", element: <StatusPage title="Page not found" message="The page you requested does not exist." /> }
    ],
  },
]);

export default router;
