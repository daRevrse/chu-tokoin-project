import React, { useState, useRef } from 'react';
import {
  Box,
  Container,
  Paper,
  Grid,
  Typography,
  Avatar,
  Button,
  TextField,
  Chip,
  Divider,
  Alert,
  Snackbar,
  IconButton,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import {
  PhotoCameraRounded as CameraIcon,
  DeleteOutlineRounded as DeleteIcon,
  LockRounded as LockIcon,
  VisibilityRounded as ShowIcon,
  VisibilityOffRounded as HideIcon,
  BadgeRounded as BadgeIcon
} from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const API_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const ROLE_LABELS = {
  RECEPTIONIST: 'Accueil',
  DOCTOR: 'Médecin',
  CASHIER: 'Caissier',
  RADIOLOGIST: 'Radiologue',
  LAB_TECHNICIAN: 'Laborantin',
  TECHNICIAN: 'Technicien',
  ADMIN: 'Administrateur'
};

const ROLE_COLORS = {
  RECEPTIONIST: 'secondary',
  DOCTOR: 'primary',
  CASHIER: 'success',
  RADIOLOGIST: 'info',
  LAB_TECHNICIAN: 'warning',
  TECHNICIAN: 'info',
  ADMIN: 'error'
};

const Profile = () => {
  const { user, applyUser } = useAuth();
  const fileInputRef = useRef(null);

  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const initials = `${user?.firstName?.charAt(0) || ''}${user?.lastName?.charAt(0) || ''}`;
  const avatarSrc = user?.avatarUrl ? `${API_ORIGIN}${user.avatarUrl}` : undefined;

  const handleSelectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setAvatarError('');

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAvatarError('Format non autorisé. Utilisez une image JPEG, PNG ou WEBP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError('Image trop volumineuse. Taille maximum : 2 Mo.');
      return;
    }

    const formData = new FormData();
    formData.append('avatar', file);

    setUploading(true);
    try {
      const res = await api.post('/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      applyUser(res.data.user);
      notify('Photo de profil mise à jour');
    } catch (err) {
      setAvatarError(err.response?.data?.error || "Erreur lors de l'envoi de la photo");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAvatar = async () => {
    setAvatarError('');
    setUploading(true);
    try {
      const res = await api.delete('/auth/avatar');
      applyUser(res.data.user);
      notify('Photo de profil supprimée');
    } catch (err) {
      setAvatarError(err.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setUploading(false);
    }
  };

  const validatePasswords = () => {
    const errors = {};
    if (!passwords.currentPassword) errors.currentPassword = 'Le mot de passe actuel est requis';
    if (!passwords.newPassword) {
      errors.newPassword = 'Le nouveau mot de passe est requis';
    } else if (passwords.newPassword.length < 6) {
      errors.newPassword = 'Au moins 6 caractères';
    } else if (passwords.newPassword === passwords.currentPassword) {
      errors.newPassword = 'Le nouveau mot de passe doit être différent de l\'actuel';
    }
    if (passwords.confirmPassword !== passwords.newPassword) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    if (!validatePasswords()) return;

    setSavingPassword(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordErrors({});
      notify('Mot de passe modifié avec succès');
    } catch (err) {
      setPasswordError(
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        'Erreur lors de la modification du mot de passe'
      );
    } finally {
      setSavingPassword(false);
    }
  };

  const paperStyle = {
    elevation: 0,
    sx: { p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', height: '100%' }
  };

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Mon Profil
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Gérez votre photo de profil et votre mot de passe.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Identite et photo */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper {...paperStyle}>
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                <Avatar
                  src={avatarSrc}
                  sx={{
                    width: 140,
                    height: 140,
                    bgcolor: 'primary.main',
                    fontSize: '3rem',
                    fontWeight: 'bold',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.08)'
                  }}
                >
                  {initials}
                </Avatar>
                <IconButton
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  sx={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
                    bgcolor: 'white',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                    '&:hover': { bgcolor: '#e3f2fd' }
                  }}
                >
                  {uploading ? <CircularProgress size={20} /> : <CameraIcon fontSize="small" />}
                </IconButton>
              </Box>

              <input
                type="file"
                ref={fileInputRef}
                hidden
                accept="image/jpeg,image/png,image/webp"
                onChange={handleSelectFile}
              />

              <Typography variant="h6" fontWeight="bold">
                {user?.firstName} {user?.lastName}
              </Typography>
              <Chip
                label={ROLE_LABELS[user?.role] || user?.role}
                color={ROLE_COLORS[user?.role] || 'default'}
                size="small"
                sx={{ mt: 1, fontWeight: 'bold' }}
              />

              {avatarError && (
                <Alert severity="error" sx={{ mt: 3, borderRadius: 2, textAlign: 'left' }}>
                  {avatarError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', mt: 3, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<CameraIcon />}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
                >
                  Changer la photo
                </Button>
                {user?.avatarUrl && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDeleteAvatar}
                    disabled={uploading}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Retirer
                  </Button>
                )}
              </Box>
              <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 2 }}>
                JPEG, PNG ou WEBP — 2 Mo maximum
              </Typography>
            </Box>

            <Divider sx={{ my: 4 }} />

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <BadgeIcon color="action" fontSize="small" />
              <Typography variant="subtitle2" fontWeight="bold">
                Informations du compte
              </Typography>
            </Box>
            <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 3 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">
                Email
              </Typography>
              <Typography fontWeight="bold" sx={{ mb: 2, wordBreak: 'break-all' }}>
                {user?.email}
              </Typography>
              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">
                Téléphone
              </Typography>
              <Typography fontWeight="bold">{user?.phone || '—'}</Typography>
            </Box>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 2 }}>
              Ces informations sont modifiables par un administrateur.
            </Typography>
          </Paper>
        </Grid>

        {/* Changement de mot de passe */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper {...paperStyle}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Box sx={{ bgcolor: '#fff3e0', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LockIcon sx={{ fontSize: 20, color: '#ed6c02' }} />
              </Box>
              <Typography variant="h6" fontWeight="bold">
                Changer le mot de passe
              </Typography>
            </Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Pour des raisons de sécurité, votre mot de passe actuel est demandé.
            </Typography>

            {passwordError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                {passwordError}
              </Alert>
            )}

            <form onSubmit={handleChangePassword}>
              <TextField
                fullWidth
                required
                type={showPassword ? 'text' : 'password'}
                label="Mot de passe actuel"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                error={Boolean(passwordErrors.currentPassword)}
                helperText={passwordErrors.currentPassword}
                sx={{ mb: 3, ...inputStyle }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                        {showPassword ? <HideIcon fontSize="small" /> : <ShowIcon fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  )
                }}
              />

              <Divider sx={{ mb: 3 }} />

              <TextField
                fullWidth
                required
                type={showPassword ? 'text' : 'password'}
                label="Nouveau mot de passe"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                error={Boolean(passwordErrors.newPassword)}
                helperText={passwordErrors.newPassword || 'Au moins 6 caractères'}
                sx={{ mb: 3, ...inputStyle }}
              />

              <TextField
                fullWidth
                required
                type={showPassword ? 'text' : 'password'}
                label="Confirmer le nouveau mot de passe"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                error={Boolean(passwordErrors.confirmPassword)}
                helperText={passwordErrors.confirmPassword}
                sx={{ mb: 4, ...inputStyle }}
              />

              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<LockIcon />}
                disabled={savingPassword}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 4, py: 1.3 }}
              >
                {savingPassword ? 'Modification...' : 'Modifier le mot de passe'}
              </Button>
            </form>
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ borderRadius: 2, fontWeight: 'bold' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default Profile;
