import { useContext } from 'react';
import { Box, Typography, Button, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import HomeIcon from '@mui/icons-material/Home';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/Header/Header';
import BottomNav from '../../components/BottomNav/BottomNav';
import { AppContext } from '../../context/AppContext';
import './SavedAddressesPage.css';
import { openStreetMapLocationUrl } from '../../services/openStreetMapService';

const SavedAddressesPage = () => {
  const navigate = useNavigate();
  const { addresses, deleteAddress, setDefaultAddress, selectedLocation } = useContext(AppContext);
  const addAddressState = {
    returnTo: '/saved-addresses',
    ...(selectedLocation ? { location: selectedLocation } : {}),
  };

  return (
    <Box className="saved-address-wrapper">
      <Header />

      {/* Header bar matching screenshot */}
      <Box className="saved-address-header">
        <IconButton onClick={() => navigate('/profile')} style={{ color: '#1e293b' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" className="saved-address-title">
          Your Saved Locations
        </Typography>
      </Box>

      {/* Locations List */}
      <Box className="saved-address-scroll">
        {addresses.length === 0 && <Typography sx={{ p: 3, textAlign: 'center', color: '#64748b' }}>No saved addresses yet.</Typography>}
        {addresses.map((loc) => (
          <Box key={loc.id} className="saved-loc-card">
            <Box className="loc-card-icon-box">
              {loc.type === 'Home' ? <HomeIcon className="loc-home-icon" /> : loc.type === 'Office' || loc.type === 'Work' ? <BusinessOutlinedIcon className="loc-home-icon" /> : <LocationOnOutlinedIcon className="loc-home-icon" />}
            </Box>

            <Box className="loc-card-details">
              <Typography className="loc-type-title">{loc.type}{loc.isDefault ? ' (Default)' : ''}</Typography>
              <Typography className="loc-address-text">{loc.address}</Typography>
              {!loc.isDefault && <Button size="small" onClick={() => setDefaultAddress(loc.id)}>Set as default address</Button>}
              {loc.coordinates && <Button size="small" component="a" href={openStreetMapLocationUrl(loc.coordinates)} target="_blank" rel="noreferrer" startIcon={<OpenInNewIcon />}>Open map</Button>}
              <Button size="small" color="error" onClick={() => deleteAddress(loc.id)}>Delete</Button>
            </Box>

            <Button size="small" aria-label={`Edit ${loc.type} address`} onClick={() => navigate('/address-form', { state: { editAddress: loc, returnTo: '/saved-addresses' } })}>
              Edit
            </Button>
          </Box>
        ))}
      </Box>

      {/* Sticky Bottom Add Address Button */}
      <Box className="saved-address-footer">
        <Button
          variant="outlined"
          fullWidth
          className="add-manual-address-btn"
          onClick={() => navigate('/address-form', { state: addAddressState })}
        >
          Add details
        </Button>
        <Button
          variant="contained"
          fullWidth
          className="add-new-address-btn"
          onClick={() => navigate('/address-form', { state: addAddressState })}
        >
          Add Address
        </Button>
      </Box>

      <BottomNav />
    </Box>
  );
};

export default SavedAddressesPage;
