import { useState } from 'react';
import { Alert, Box, Button, MenuItem, Select, TextField, Typography } from '@mui/material';
import { buildReportExport, calculateStorePerformance, downloadJsonReport, filterReportOrders, reportProductCount, reportStockUnits, summarizeOrders } from './adminReportData.js';
import './AdminReports.css';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const AdminReports = ({ orders, customerTotal, customerError = '', showCustomerMetric = true, locationScope = '', storeScopeId = '', products, storeProductMappings = [], inventory, stores, loading = false, error = '', onRetry }) => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [location, setLocation] = useState(locationScope || 'All');
  const [store, setStore] = useState('All');
  const [sort, setSort] = useState('revenue');
  const [exportMessage, setExportMessage] = useState('');
  const locations = [...new Set(stores.map((item) => item.location).filter(Boolean))].sort();
  const fixedLocation = locationScope ? locations.find((name) => name.trim().toLowerCase() === locationScope.trim().toLowerCase()) || locationScope : '';
  const selectedLocation = locationScope ? fixedLocation : location;
  const selectableStores = stores.filter((item) => (storeScopeId ? String(item.id) === String(storeScopeId) : selectedLocation === 'All' || item.location === selectedLocation))
    .sort((left, right) => left.name.localeCompare(right.name));
  const selectedStore = storeScopeId ? selectableStores[0] : selectableStores.find((item) => item.name.trim().toLowerCase() === store.trim().toLowerCase());
  const effectiveStore = storeScopeId ? selectedStore?.name || '' : store;
  const filtered = filterReportOrders(orders, { from, to, location:selectedLocation, store:effectiveStore });
  const summary = summarizeOrders(filtered);
  const performance = calculateStorePerformance(
    selectableStores.filter((item) => store === 'All' || item.name === store), filtered, sort,
  );
  const reset = () => {
    setFrom(''); setTo(''); setLocation(fixedLocation || 'All'); setStore('All'); setSort('revenue'); setExportMessage('');
  };
  const exportReport = () => {
    try {
      const payload = buildReportExport({ filters: { from, to, location:selectedLocation, store:effectiveStore, sort }, orders: filtered, storePerformance: performance });
      const filename = downloadJsonReport(payload);
      setExportMessage(`Download started: ${filename}. Check your browser downloads.`);
    } catch (error) {
      setExportMessage(`Could not export the report. ${error.message || 'Please try again.'}`);
    }
  };

  if (loading) return <Box className="reports-dashboard"><Alert severity="info">Loading backend order data…</Alert></Box>;
  if (error) return <Box className="reports-dashboard"><Alert severity="error" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>{error}</Alert></Box>;

  return <Box className="reports-dashboard">
    <Box className="reports-filters">
      <TextField label="From" type="date" size="small" value={from} onChange={(event) => setFrom(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="To" type="date" size="small" value={to} onChange={(event) => setTo(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      {!storeScopeId && <Select size="small" value={selectedLocation} disabled={Boolean(locationScope)} onChange={(event) => { setLocation(event.target.value); setStore('All'); }}>
        {!locationScope && <MenuItem value="All">All locations</MenuItem>}{locations.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
      </Select>}
      {storeScopeId ? <TextField size="small" label="Assigned store" value={selectedStore?.name || 'Assigned store unavailable'} disabled/> : <Select size="small" value={store} onChange={(event) => setStore(event.target.value)}>
        <MenuItem value="All">All stores in location</MenuItem>{selectableStores.map((item) => <MenuItem key={item.id} value={item.name}>{item.name}</MenuItem>)}
      </Select>}
      <Select size="small" value={sort} onChange={(event) => setSort(event.target.value)}>
        <MenuItem value="revenue">Sort stores by revenue</MenuItem><MenuItem value="orders">Sort stores by orders</MenuItem><MenuItem value="name">Sort stores by name</MenuItem>
      </Select>
      <Button onClick={reset}>Reset</Button><Button variant="contained" onClick={exportReport}>Export JSON</Button>
    </Box>
    {exportMessage && <Alert role="status" severity={exportMessage.startsWith('Could not') ? 'error' : 'success'} sx={{ mt: 1 }}>{exportMessage}</Alert>}
    {filtered.length === 0 && <Alert severity="info" sx={{ mt: 1 }}>No orders match the selected report filters.</Alert>}
    <Box className="reports-kpis">{[
      ['Revenue', money(summary.revenue)], ['Orders', summary.total], ['Delivered', summary.delivered], ...(showCustomerMetric ? [['Customers', customerTotal ?? '—']] : []),
      ['Products', reportProductCount(products, storeProductMappings, selectedStore?.id, Boolean(locationScope || storeScopeId))],
      ['Stock Units', reportStockUnits(inventory, selectedStore?.id, Boolean(locationScope || storeScopeId))],
    ].map(([label, value]) => <Box className="reports-kpi" key={label}><Typography>{label}</Typography><Typography variant="h5">{value}</Typography><small>{label === 'Customers' ? (customerError || 'Registered customer profiles; independent of report filters') : storeScopeId ? selectedStore?.name || 'Assigned store' : store !== 'All' ? store : locationScope ? `All stores in ${locationScope}` : selectedLocation !== 'All' ? selectedLocation : 'All business data'}</small></Box>)}</Box>
    <Box className="report-card" sx={{ mt: 2 }}><Typography variant="h6" fontWeight={800}>Store performance</Typography>
      <Box className="analytics-table"><header><span>Store and location</span><span>Orders</span><span>Revenue</span></header>
        {performance.map((item) => <div key={item.name}><span>{item.name}<small style={{ display: 'block' }}>{item.location}</small></span><span>{item.orders}</span><strong>{money(item.revenue)}</strong></div>)}
      </Box>
    </Box>
  </Box>;
};

export default AdminReports;
