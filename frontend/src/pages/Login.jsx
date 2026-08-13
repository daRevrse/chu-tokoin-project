import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Checkbox,
  FormControlLabel,
  Link,
  Divider,
  Grid
} from '@mui/material';
import {
  Email,
  Lock,
  Visibility,
  VisibilityOff,
  ArrowForward,
  HealthAndSafety,
  Security,
  AccessTime,
  BarChart,
  VerifiedUserOutlined
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext'; // Assurez-vous que ce chemin est correct
import { useHospital } from '../contexts/HospitalContext';
import { APP_IDENTITY } from '../config/appIdentity';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const { hospital, logoSrc } = useHospital();
  const navigate = useNavigate();
  const location = useLocation();
  const backgroundImage = '/images/background-login.jpg';
  const rootBackgroundImage = '/images/bg.png';

  // Redirection après connexion
  const getRedirectPath = (role) => {
    switch (role) {
      case 'RECEPTIONIST':
        return '/reception';
      case 'DOCTOR':
        return '/doctor';
      case 'CASHIER':
        return '/cashier';
      case 'RADIOLOGIST':
      case 'LAB_TECHNICIAN':
      case 'TECHNICIAN':
        return '/service';
      case 'ADMIN':
        return '/admin';
      default:
        return '/';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const user = await login(email, password);
      const from = location.state?.from?.pathname;
      const redirectPath = from || getRedirectPath(user.role);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7fb',
        backgroundImage: `url(${rootBackgroundImage})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat',
        p: 2
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          width: '1100px',
          maxWidth: '100%',
          minHeight: '600px',
          borderRadius: 4,
          overflow: 'hidden',
          boxShadow: '0px 10px 30px rgba(0,0,0,0.1)',
          backgroundColor: '#ffffff'
        }}
      >
        {/* --- PANNEAU GAUCHE (Présentation) --- */}
        <Box
          sx={{
            flex: 1,
            backgroundImage: `linear-gradient(135deg, rgba(13, 71, 161, 0.85) 0%, rgba(21, 101, 192, 0.85) 100%), url(${backgroundImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            color: 'white',
            p: 6,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          {/* Identité du produit : la même chez tous les établissements */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <img src={APP_IDENTITY.logoOnDark} alt={APP_IDENTITY.name} style={{ width: 50, height: 50 }} />
            <Box>
              <Typography variant="h6" fontWeight="bold" sx={{ lineHeight: 1 }}>
                {APP_IDENTITY.name}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                {APP_IDENTITY.tagline}
              </Typography>
            </Box>
          </Box>

          {/* Slogan */}
          <Box sx={{ my: 4 }}>
            <Typography variant="h3" fontWeight="bold" gutterBottom sx={{ lineHeight: 1.2 }}>
              Gérez. Suivez.<br />Optimisez.
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.9, mt: 2, maxWidth: '80%' }}>
              Une solution complète pour la gestion efficace des examens.
            </Typography>
          </Box>

          {/* Points forts (Footer gauche) */}
          <Grid container spacing={2} sx={{ mt: 'auto' }}>
            <Grid size={4}>
              <Security sx={{ mb: 1, fontSize: 28 }} />
              <Typography variant="subtitle2" fontWeight="bold">Sécurisé</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                Vos données<br />sont protégées
              </Typography>
            </Grid>
            <Grid size={4}>
              <AccessTime sx={{ mb: 1, fontSize: 28 }} />
              <Typography variant="subtitle2" fontWeight="bold">Rapide</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                Accédez rapidement<br />à l'essentiel
              </Typography>
            </Grid>
            <Grid size={4}>
              <BarChart sx={{ mb: 1, fontSize: 28 }} />
              <Typography variant="subtitle2" fontWeight="bold">Performant</Typography>
              <Typography variant="caption" sx={{ opacity: 0.8, display: 'block' }}>
                Des outils pour des<br />décisions éclairées
              </Typography>
            </Grid>
          </Grid>
        </Box>

        {/* --- PANNEAU DROIT (Formulaire) --- */}
        <Box
          sx={{
            flex: 1,
            p: { xs: 4, md: 8 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}
        >
          {/* En-tête formulaire : identité de l'établissement */}
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box
              sx={{
                bgcolor: logoSrc ? 'transparent' : '#1976d2',
                color: 'white',
                width: 60,
                height: 60,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto',
                mb: 2,
                overflow: 'hidden'
              }}
            >
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={hospital.name}
                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <HealthAndSafety sx={{ fontSize: 40 }} />
              )}
            </Box>
            <Typography variant="h5" component="h1" fontWeight="bold" gutterBottom>
              {hospital.name}
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              {APP_IDENTITY.description}
            </Typography>
            <Box sx={{ width: 40, height: 3, bgcolor: '#1976d2', margin: '0 auto', borderRadius: 1 }} />
          </Box>

          {/* Gestion des erreurs */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Formulaire */}
          <form onSubmit={handleSubmit}>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              Email *
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Entrez votre email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" fontSize="small" />
                  </InputAdornment>
                )
              }}
            />

            <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
              Mot de passe *
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Entrez votre mot de passe"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword(!showPassword)}
                      edge="end"
                      aria-label="toggle password visibility"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {/* Options secondaires */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1, mb: 4 }}>
              <FormControlLabel
                control={<Checkbox size="small" color="primary" />}
                label={<Typography variant="body2" color="textSecondary">Se souvenir de moi</Typography>}
              />
              <Link href="#" variant="body2" underline="hover" color="primary">
                Mot de passe oublié ?
              </Link>
            </Box>

            {/* Bouton de soumission */}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              endIcon={!loading && <ArrowForward />}
              disabled={loading || !email || !password}
              sx={{ py: 1.5, borderRadius: 2, textTransform: 'none', fontSize: '1rem' }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          {/* Séparateur et Footer */}
          <Divider sx={{ my: 4 }}>
            {/* <Typography variant="caption" color="textSecondary">ou</Typography> */}
          </Divider>
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, color: 'text.secondary' }}>
            <VerifiedUserOutlined fontSize="small" color="info" />
            <Typography variant="caption" align="center">
              Accès réservé au personnel autorisé
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;