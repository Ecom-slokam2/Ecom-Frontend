import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleAltOutlined';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import TuneOutlinedIcon from '@mui/icons-material/TuneOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';

export const storeManagerNavItems = [
  ['dashboard', 'Dashboard', DashboardOutlinedIcon, '/store-manager/dashboard'],
  ['products', 'Products', Inventory2OutlinedIcon, '/store-manager/products'],
  ['banners', 'Banners', ImageOutlinedIcon, '/admin/banners'],
  ['coupons', 'Coupons', LocalOfferOutlinedIcon, '/admin/coupons'],
  ['inventory', 'Inventory', Inventory2OutlinedIcon, '/admin/inventory'],
  ['orders', 'Orders', ShoppingBagOutlinedIcon, '/admin/orders'],
  ['delivery-partners', 'Delivery Partners', PeopleOutlineIcon, '/store-manager/delivery-partners'],
  ['delivery-radius', 'Delivery Radius', MapOutlinedIcon, '/store-manager/delivery-radius'],
  ['delivery-settings', 'Delivery Settings', TuneOutlinedIcon, '/store-manager/delivery-settings'],
  ['change-password', 'Change Password', LockOutlinedIcon, '/store-manager/change-password'],
  ['profile', 'Profile', StorefrontOutlinedIcon, '/store-manager/profile'],
  ['logout', 'Logout', LogoutOutlinedIcon, 'logout'],
];
