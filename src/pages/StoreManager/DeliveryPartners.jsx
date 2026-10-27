import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField, Typography } from '@mui/material';
import { createDeliveryPartner, getDeliveryPartners, setDeliveryPartnerActive } from '../../services/deliveryPartnerApi';
import DeliveryPartnerDetailsDialog from '../../components/DeliveryPartnerDetailsDialog.jsx';

const initial = { name: '', mobile: '', username: '', email: '', password: '', vehicleType: 'Bike', vehicleNumber: '', licenceNumber: '', address: '', active: true };
const fields = [
  ['name', 'Name', 'text', 180], ['mobile', 'Mobile number', 'tel', 30],
  ['username', 'Login username', 'text', 190], ['email', 'Email', 'email', 255],
  ['password', 'Password', 'password', 100], ['vehicleType', 'Vehicle type', 'text', 40],
  ['vehicleNumber', 'Bike / vehicle number', 'text', 40], ['licenceNumber', 'Licence number', 'text', 60],
  ['address', 'Address', 'text', 700],
];
export default function DeliveryPartners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState('');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const load = async () => {
    setLoading(true); setError('');
    try { setPartners(await getDeliveryPartners()); }
    catch (reason) { setError(reason.message); }
    finally { setLoading(false); }
  };
  useEffect(() => {
    let ignore = false;
    getDeliveryPartners().then(rows => { if (!ignore) setPartners(rows); })
      .catch(reason => { if (!ignore) setError(reason.message); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, []);
  const create = async (event) => {
    event.preventDefault(); setBusy('create'); setFormError('');
    try {
      const saved = await createDeliveryPartner(form);
      setPartners(current => [...current, saved].sort((a,b) => a.name.localeCompare(b.name)));
      setOpen(false); setForm(initial);
    } catch (reason) { setFormError(reason.message); }
    finally { setBusy(''); }
  };
  const toggle = async (partner, active) => {
    setBusy(partner.id); setError('');
    try {
      const saved = await setDeliveryPartnerActive(partner.id, active);
      setPartners(current => current.map(item => item.id === saved.id ? saved : item));
    } catch (reason) { setError(reason.message); }
    finally { setBusy(''); }
  };
  return <>
    <Box className="sm-page-title"><Typography variant="h4">Delivery Partners</Typography><Box display="flex" gap={2} alignItems="center"><Chip label={`${partners.filter(p => p.status === 'Active').length}/${partners.length} active`} /><Button variant="contained" onClick={() => { setForm(initial); setFormError(''); setOpen(true); }}>Create Delivery Partner</Button></Box></Box>
    {error && <Alert severity="error" action={<Button onClick={load}>Retry</Button>}>{error}</Alert>}
    {loading ? <Typography>Loading delivery partners...</Typography> : <Box className="sm-orders-list">
      {partners.map(partner => <Box className="sm-order-card" key={partner.id}>
        <Box><Typography fontWeight={900}>{partner.name}</Typography><Typography>{partner.mobile}</Typography><Typography>{partner.email}</Typography><Typography>Username: {partner.username}</Typography><Typography>{partner.address}</Typography></Box>
        <Box><Typography>{partner.vehicleType || 'Vehicle type not recorded'}</Typography><Typography>Bike / vehicle: {partner.vehicleNumber || 'Not recorded'}</Typography><Typography>Licence: {partner.licenceNumber || 'Not recorded'}</Typography><Typography>Store location: {partner.storeLocation || 'Not recorded'}</Typography><Typography>Service region: {partner.location ? String(partner.location).replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Not assigned'}</Typography></Box>
        <Box display="flex" alignItems="center" gap={1} flexWrap="wrap"><Button size="small" onClick={() => setSelectedPartner(partner)}>View full details</Button><FormControlLabel label={partner.status} control={<Switch checked={partner.status === 'Active'} disabled={Boolean(busy)} onChange={(_, active) => toggle(partner, active)} inputProps={{ 'aria-label': `Active status for ${partner.name}` }} />} /></Box>
      </Box>)}
      {!partners.length && !error && <Typography>No delivery partners for this store yet.</Typography>}
    </Box>}
    <Dialog open={open} onClose={() => !busy && setOpen(false)} fullWidth maxWidth="md">
      <Box component="form" onSubmit={create}>
        <DialogTitle>Create Delivery Partner</DialogTitle>
        <DialogContent><Typography mb={2}>The partner will be assigned to your store automatically.</Typography>{formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
          <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2} pt={1}>
            {fields.map(([key,label,type,maxLength]) => <TextField key={key} label={label} type={type} required={key !== 'address'} value={form[key]} disabled={Boolean(busy)} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} slotProps={{ htmlInput: { maxLength, ...(key === 'password' ? { minLength: 8 } : {}), ...(key === 'mobile' ? { pattern: '[+0-9 ()-]{7,30}' } : {}) } }} autoComplete={key === 'password' ? 'new-password' : 'off'} />)}
            <FormControlLabel label={form.active ? 'Active' : 'Inactive'} control={<Switch checked={form.active} disabled={Boolean(busy)} onChange={(_,active) => setForm(current => ({ ...current, active }))} />} />
          </Box>
        </DialogContent>
        <DialogActions><Button disabled={Boolean(busy)} onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={Boolean(busy)}>{busy === 'create' ? 'Saving...' : 'Create Delivery Partner'}</Button></DialogActions>
      </Box>
    </Dialog>
    <DeliveryPartnerDetailsDialog partner={selectedPartner} onClose={() => setSelectedPartner(null)} />
  </>;
}
