import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  Button,
  TextField,
  Alert,
  Snackbar,
  Divider,
  CircularProgress,
  Chip
} from '@mui/material';
import {
  ApartmentRounded as HospitalIcon,
  PhotoCameraRounded as CameraIcon,
  DeleteOutlineRounded as DeleteIcon,
  SaveRounded as SaveIcon,
  LockRounded as LockIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { useHospital } from '../../contexts/HospitalContext';
import { APP_IDENTITY } from '../../config/appIdentity';

// Un champ absent en base vaut chaine vide dans le formulaire : les champs
// controles de MUI n'acceptent pas `null`.
const toFormState = (hospital) => ({
  name: hospital?.name || '',
  fullName: hospital?.fullName || '',
  address: hospital?.address || '',
  city: hospital?.city || '',
  country: hospital?.country || '',
  phone: hospital?.phone || '',
  email: hospital?.email || '',
  website: hospital?.website || '',
  documentFooter: hospital?.documentFooter || ''
});

/**
 * Identité de l'établissement : nom, logo et coordonnées imprimés sur les
 * tickets, ordonnances et rapports. L'identité du produit (H360) n'y figure
 * qu'en lecture seule — elle est la même chez tous les clients.
 */
const HospitalSettings = () => {
  const { hospital, logoSrc, applyHospital } = useHospital();
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(toFormState(hospital));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // L'identité est chargée par le contexte au démarrage : le formulaire se
  // remplit dès qu'elle arrive.
  useEffect(() => {
    setForm(toFormState(hospital));
  }, [hospital]);

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const handleChange = (field) => (event) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError("Le nom de l'établissement est requis");
      return;
    }

    setSaving(true);
    try {
      const response = await api.put('/settings/hospital', form);
      applyHospital(response.data.hospital);
      notify('Identité de l\'établissement mise à jour');
    } catch (err) {
      setError(
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        'Erreur lors de l\'enregistrement'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSelectLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setLogoError('');

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setLogoError('Format non autorisé. Utilisez une image JPEG, PNG, WEBP ou SVG.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('Image trop volumineuse. Taille maximum : 2 Mo.');
      return;
    }

    const formData = new FormData();
    formData.append('logo', file);

    setUploading(true);
    try {
      const response = await api.post('/settings/hospital/logo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      applyHospital(response.data.hospital);
      notify('Logo mis à jour');
    } catch (err) {
      setLogoError(err.response?.data?.error || "Erreur lors de l'envoi du logo");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteLogo = async () => {
    setLogoError('');
    setUploading(true);
    try {
      const response = await api.delete('/settings/hospital/logo');
      applyHospital(response.data.hospital);
      notify('Logo supprimé');
    } catch (err) {
      setLogoError(err.response?.data?.error || 'Erreur lors de la suppression');
    } finally {
      setUploading(false);
    }
  };

  const paperStyle = {
    elevation: 0,
    sx: { p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', height: '100%' }
  };

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  return (
    <Box>
      <Grid container spacing={3}>
        {/* Logo */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper {...paperStyle}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <Box sx={{ bgcolor: '#e3f2fd', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HospitalIcon sx={{ fontSize: 20, color: '#1976d2' }} />
              </Box>
              <Typography variant="h6" fontWeight="bold">
                Logo de l'établissement
              </Typography>
            </Box>

            <Box
              sx={{
                height: 180,
                borderRadius: 3,
                border: '1px dashed',
                borderColor: 'divider',
                bgcolor: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 3,
                mb: 3
              }}
            >
              {logoSrc ? (
                <Box
                  component="img"
                  src={logoSrc}
                  alt={hospital.name}
                  sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                />
              ) : (
                <Typography variant="body2" color="textSecondary">
                  Aucun logo — l'icône par défaut est utilisée
                </Typography>
              )}
            </Box>

            <input
              type="file"
              ref={fileInputRef}
              hidden
              accept="image/jpeg,image/png,image/webp,image/svg+xml"
              onChange={handleSelectLogo}
            />

            {logoError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {logoError}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="outlined"
                startIcon={uploading ? <CircularProgress size={16} /> : <CameraIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
              >
                {hospital.logoUrl ? 'Remplacer le logo' : 'Ajouter un logo'}
              </Button>
              {hospital.logoUrl && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={handleDeleteLogo}
                  disabled={uploading}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
                >
                  Retirer
                </Button>
              )}
            </Box>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 2 }}>
              JPEG, PNG, WEBP ou SVG — 2 Mo maximum. Les ordonnances PDF n'impriment
              que les logos JPEG et PNG.
            </Typography>

            <Divider sx={{ my: 4 }} />

            {/* Identite du logiciel : lecture seule */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <LockIcon color="action" fontSize="small" />
              <Typography variant="subtitle2" fontWeight="bold">
                Identité de l'application
              </Typography>
            </Box>
            <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box component="img" src={APP_IDENTITY.logo} alt={APP_IDENTITY.name} sx={{ width: 44, height: 44 }} />
              <Box>
                <Typography fontWeight="bold">{APP_IDENTITY.name}</Typography>
                <Typography variant="caption" color="textSecondary">
                  {APP_IDENTITY.tagline}
                </Typography>
              </Box>
              <Chip label="Non modifiable" size="small" sx={{ ml: 'auto', fontWeight: 'bold' }} />
            </Box>
            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 2 }}>
              {APP_IDENTITY.name} est le nom du logiciel, identique chez tous les
              établissements. Seule l'identité de votre établissement est modifiable ici.
            </Typography>
          </Paper>
        </Grid>

        {/* Coordonnees */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper {...paperStyle}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
              Informations de l'établissement
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Ces informations apparaissent sur les tickets de passage, les ordonnances
              et les rapports imprimés.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Grid container spacing={2.5}>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    required
                    label="Nom de l'établissement"
                    value={form.name}
                    onChange={handleChange('name')}
                    helperText="Nom d'usage, affiché dans l'application et en tête des documents"
                    sx={inputStyle}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Dénomination complète"
                    value={form.fullName}
                    onChange={handleChange('fullName')}
                    helperText="Raison sociale, imprimée sous le nom d'usage"
                    sx={inputStyle}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Adresse"
                    value={form.address}
                    onChange={handleChange('address')}
                    sx={inputStyle}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Ville"
                    value={form.city}
                    onChange={handleChange('city')}
                    sx={inputStyle}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Pays"
                    value={form.country}
                    onChange={handleChange('country')}
                    sx={inputStyle}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label="Téléphone"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    sx={inputStyle}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    type="email"
                    label="Email"
                    value={form.email}
                    onChange={handleChange('email')}
                    sx={inputStyle}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    label="Site web"
                    value={form.website}
                    onChange={handleChange('website')}
                    sx={inputStyle}
                  />
                </Grid>
                <Grid size={12}>
                  <TextField
                    fullWidth
                    multiline
                    minRows={2}
                    label="Mention de pied de page"
                    value={form.documentFooter}
                    onChange={handleChange('documentFooter')}
                    helperText="Mention légale imprimée en bas des documents (agrément, RCCM…)"
                    sx={inputStyle}
                  />
                </Grid>
              </Grid>

              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                disabled={saving}
                sx={{ mt: 4, borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 4, py: 1.3 }}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
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
    </Box>
  );
};

export default HospitalSettings;
