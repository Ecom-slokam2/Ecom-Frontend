import { useContext, useState } from 'react';
import { Alert, Box, Button, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { orgAccessService, teamLandingPath } from '../../services/orgAccessService';
import { STAFF_ROLES } from '../../config/accessControl';
import logo from '../../assets/images/logo.png';
import './RoleLoginPage.css';

const RoleLoginPage = () => {
  const navigate = useNavigate();
  const { login } = useContext(AppContext);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    try {
      const result = await orgAccessService.login(email, password);
      const role = result.user?.role || 'customer';
      if (!STAFF_ROLES.includes(role)) {
        throw new Error('This account does not have a team portal role. Sign in through the customer app.');
      }
      login(result.user, result.token);

      navigate(teamLandingPath(role));
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
  };

  return (
    <Box className="team-login-shell">
      <Box className="team-login-card">
        <Box className="team-login-brand">
          <img src={logo} alt="Spices and Pickles" />
          <Box>
            <Typography variant="h5">Team Portal</Typography>
            <Typography>Spices & Pickles</Typography>
          </Box>
        </Box>

        <TextField label="Username" type="text" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

        {error && <Alert severity="error">{error}</Alert>}

        <Button className="team-primary" variant="contained" onClick={submit}>Sign in securely</Button>
        <Button onClick={() => navigate('/home')}>Back to customer app</Button>
      </Box>
    </Box>
  );
};

export default RoleLoginPage;
