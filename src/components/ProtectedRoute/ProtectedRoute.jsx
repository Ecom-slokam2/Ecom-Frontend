import { useContext } from 'react';
import { Box, Button, Typography } from '@mui/material';
import { Navigate, useLocation } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';

const ProtectedRoute = ({ children, roles }) => {
  const { isLoggedIn, user, authReady, authError } = useContext(AppContext);
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" replace state={{ ...location.state, from: location.pathname }} />;
  }
  if (!authReady || !user) {
    return <Box role="status" sx={{ minHeight: '40vh', display: 'grid', placeContent: 'center', gap: 1, textAlign: 'center', p: 3 }}>
      <Typography variant="h6">{authError ? 'Could not verify your session' : 'Restoring your session…'}</Typography>
      <Typography color="text.secondary">{authError || 'Checking your account and permissions.'}</Typography>
      {authError && <Button onClick={() => window.location.reload()}>Retry</Button>}
    </Box>;
  }
  if (roles?.length && !roles.includes(user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return children;
};

export default ProtectedRoute;
