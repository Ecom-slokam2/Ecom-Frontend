import { useContext, useMemo, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, IconButton, InputAdornment, TextField, Typography } from '@mui/material';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import GoogleLocationPicker from '../GoogleLocationPicker/GoogleLocationPicker';
import './LocationSelectionModal.css';

const cleanText = (value) => String(value || '').split(',').map((part) => part.trim()).filter((part) => part && !/^(undefined|null)$/i.test(part)).join(', ').replace(/\s+/g, ' ').trim();

export default function LocationSelectionModal() {
  const navigate = useNavigate();
  const { showLocationModal, setShowLocationModal, saveSelectedLocation, isLoggedIn, addresses, orderAddresses, selectedLocation, deleteAddress } = useContext(AppContext);
  const [selected, setSelected] = useState(selectedLocation || null);
  const [search, setSearch] = useState('');
  const [activePane, setActivePane] = useState('saved');
  const [error, setError] = useState('');

  const savedOptions = useMemo(() => {
    const seen = new Set();
    const options = [...(addresses || []), ...(orderAddresses || [])].reduce((list, entry) => {
      const address = cleanText(entry.address);
      const latitude = Number(entry.coordinates?.lat ?? entry.latitude);
      const longitude = Number(entry.coordinates?.lng ?? entry.longitude);
      const key = address.toLowerCase();
      if (!key || seen.has(key) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return list;
      seen.add(key);
      list.push({ ...entry, title: entry.type || 'Saved address', address, latitude, longitude, coordinates: { lat: latitude, lng: longitude }, source: 'manual' });
      return list;
    }, []);
    const query = search.trim().toLowerCase();
    return query ? options.filter((entry) => `${entry.type || ''} ${entry.address}`.toLowerCase().includes(query)) : options;
  }, [addresses, orderAddresses, search]);

  const close = () => { sessionStorage.removeItem('locationPickerManualOpen'); setSelected(selectedLocation || null); setSearch(''); setActivePane('saved'); setError(''); setShowLocationModal(false); };
  const save = () => {
    if (!selected) return;
    try {
      sessionStorage.removeItem('locationPickerManualOpen');
      saveSelectedLocation({ ...selected, address: cleanText(selected.address || selected.subtitle), city: cleanText(selected.city), title: cleanText(selected.title), pincode: cleanText(selected.pincode) });
    } catch (reason) { setError(reason.message || 'Your browser could not save this location.'); }
  };
  const editAddress = (entry) => {
    setShowLocationModal(false);
    navigate('/address-form', { state: { editAddress: entry, returnTo: '/home', location: selectedLocation || undefined } });
  };
  const addAddress = () => {
    setShowLocationModal(false);
    navigate('/address-form', { state: { returnTo: '/home', ...(selected ? { location: selected } : {}) } });
  };
  const removeAddress = async (entry) => {
    try { await deleteAddress(entry.id); }
    catch (reason) { setError(reason.message || 'The saved address could not be deleted.'); }
  };

  return <Dialog open={showLocationModal} onClose={close} aria-labelledby="choose-location-title" className="choose-location-dialog" fullWidth maxWidth="lg">
    <DialogContent>
      <Box className="location-modal-heading">
        <Box className="location-modal-title-group">
          <Box className="choose-location-icon"><LocationOnOutlinedIcon /></Box>
          <Box><Typography id="choose-location-title" component="h2">Select delivery location</Typography><Typography id="choose-location-description">Search, use GPS, or move the map pin to choose your delivery address.</Typography></Box>
        </Box>
        <IconButton className="choose-location-close" aria-label="Close location popup" onClick={close}><CloseIcon /></IconButton>
      </Box>
      {error && <Alert severity="warning" sx={{ my: 1 }}>{error}</Alert>}
      <Box className="choose-location-layout" data-active-pane={activePane}>
        <Box className="choose-location-sidebar">
          <Box className="location-mode-tabs" role="tablist" aria-label="Location selection method">
            <Button role="tab" aria-selected={activePane === 'saved'} className={activePane === 'saved' ? 'active' : ''} onClick={() => setActivePane('saved')}><LocationOnOutlinedIcon />Saved addresses</Button>
            <Button role="tab" aria-selected={activePane === 'map'} className={activePane === 'map' ? 'active' : ''} onClick={() => { setActivePane('map'); document.querySelector('.choose-location-map-column')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }}>Map</Button>
          </Box>
          {isLoggedIn && <TextField className="saved-address-search" size="small" fullWidth placeholder="Search saved addresses" value={search} onChange={(event) => setSearch(event.target.value)} inputProps={{ 'aria-label': 'Search saved addresses' }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />}
          {isLoggedIn ? <Box className="choose-location-saved-list" role="list" aria-label="Saved addresses">
            {savedOptions.map((entry) => {
              const active = selected?.id === entry.id || selected?.address === entry.address;
              return <Box key={`${entry.fromOrder ? 'order' : 'saved'}:${entry.id || entry.address}`} className={`saved-location-card ${active ? 'selected' : ''}`} role="listitem">
                <Button className="saved-location-select" onClick={() => setSelected(entry)} aria-pressed={active}>
                  <span className="saved-location-radio" aria-hidden="true">{active ? '●' : '○'}</span>
                  <span className="choose-location-saved-text"><strong>{entry.type || (entry.fromOrder ? 'Previously used' : 'Saved address')}</strong><span>{entry.address}</span></span>
                </Button>
                {!entry.fromOrder && <Box className="saved-location-actions"><Button size="small" onClick={() => editAddress(entry)}>Edit</Button><Button size="small" color="error" onClick={() => removeAddress(entry)}>Delete</Button></Box>}
                {entry.fromOrder && <HistoryOutlinedIcon className="saved-location-history" fontSize="small" />}
              </Box>;
            })}
            {!savedOptions.length && <Typography className="saved-address-empty">{search ? 'No saved address matches your search.' : 'No saved addresses yet.'}</Typography>}
          </Box> : <Typography className="location-signin-note">Sign in to choose or manage saved addresses.</Typography>}
          {isLoggedIn && <Button className="location-add-address" startIcon={<AddIcon />} onClick={addAddress}>Add new address</Button>}
        </Box>
        <Box className="choose-location-map-column" aria-label="Choose a point on the map">
          <GoogleLocationPicker value={selected} onChange={setSelected} onConfirm={undefined} confirmLabel="" />
        </Box>
      </Box>
      <Box className="location-modal-footer">
        <Box className="location-selected-summary"><Box className="location-selected-pin"><LocationOnOutlinedIcon /></Box><Box><Typography className="location-selected-label">Selected location</Typography><Typography className="location-selected-address">{selected?.address || selected?.subtitle || 'Choose a saved address or select a point on the map.'}</Typography></Box></Box>
        <Button className="location-confirm-button" variant="contained" disabled={!selected} onClick={save}>Confirm Location <span aria-hidden="true">→</span></Button>
      </Box>
    </DialogContent>
  </Dialog>;
}
