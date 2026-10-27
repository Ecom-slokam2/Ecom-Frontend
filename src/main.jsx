import { StrictMode } from 'react'
import { createTheme, ThemeProvider } from '@mui/material/styles';

const brandTheme = createTheme({ palette: { primary: { main: '#087454', dark: '#065d43' }, secondary: { main: '#087454' } } });
import { createRoot } from 'react-dom/client'
import { RouterProvider } from "react-router-dom";
import './index.css'
import router from './router.jsx';

import { AppProvider } from './context/AppContext';
import { languageCode } from './i18n/index';
import { readLanguage } from './i18n/preferences';

document.documentElement.lang = languageCode(readLanguage());

// Keep scoped browser state intact. Checkout retries and idempotency keys live
// in sessionStorage, while location and guest-cart transfer state use
// localStorage. Clearing either storage on every page load can duplicate work
// or discard a customer's in-progress checkout.

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={brandTheme}><AppProvider>
      <RouterProvider router={router} />
    </AppProvider></ThemeProvider>
  </StrictMode>,
)
