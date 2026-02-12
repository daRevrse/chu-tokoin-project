import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  FormHelperText
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PatientForm = ({ patient, onBack, onSuccess }) => {
  const isEditMode = Boolean(patient);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    phone: '',
    address: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (patient) {
      setFormData({
        firstName: patient.firstName || '',
        lastName: patient.lastName || '',
        dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.split('T')[0] : '',
        gender: patient.gender || '',
        phone: patient.phone || '',
        address: patient.address || '',
        email: patient.email || ''
      });
    }
  }, [patient]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.lastName.trim()) errors.lastName = 'Le nom est requis';
    if (!formData.firstName.trim()) errors.firstName = 'Le prenom est requis';
    if (!formData.gender) errors.gender = 'Le sexe est requis';

    // Date of birth validation
    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'La date de naissance est requise';
    } else {
      const dob = new Date(formData.dateOfBirth);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (dob > today) {
        errors.dateOfBirth = 'La date de naissance ne peut pas etre dans le futur';
      }
      const minDate = new Date();
      minDate.setFullYear(minDate.getFullYear() - 150);
      if (dob < minDate) {
        errors.dateOfBirth = 'Date de naissance invalide';
      }
    }

    // Phone validation (Togolese format)
    if (!formData.phone.trim()) {
      errors.phone = 'Le telephone est requis';
    } else {
      const phoneClean = formData.phone.replace(/[\s\-.]/g, '');
      const validFormats = /^(\+228|00228)?[0-9]{8}$/;
      if (!validFormats.test(phoneClean)) {
        errors.phone = 'Format invalide (ex: +228 90 00 00 00)';
      }
    }

    // Email validation (optional field)
    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        errors.email = 'Adresse email invalide';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      let response;
      if (isEditMode) {
        response = await api.put(`/patients/${patient.id}`, formData);
        setSuccess('Patient mis a jour avec succes!');
      } else {
        response = await api.post('/patients', formData);
        setSuccess('Patient enregistre avec succes!');
      }
      setTimeout(() => {
        if (onSuccess) onSuccess(response.data.patient);
      }, 1500);
    } catch (err) {
      console.error('Erreur patient:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Erreur lors de l\'enregistrement du patient');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Button
        startIcon={<BackIcon />}
        onClick={onBack}
        sx={{ mb: 2 }}
      >
        Retour
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h5">
          {isEditMode ? 'Modifier le Patient' : 'Nouveau Patient'}
        </Typography>
        {isEditMode && (
          <Chip label={patient.patientNumber} color="primary" variant="outlined" />
        )}
      </Box>

      <Paper sx={{ p: 3, maxWidth: 800 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Nom"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                error={Boolean(fieldErrors.lastName)}
                helperText={fieldErrors.lastName}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Prenom"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                error={Boolean(fieldErrors.firstName)}
                helperText={fieldErrors.firstName}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                type="date"
                label="Date de naissance"
                name="dateOfBirth"
                value={formData.dateOfBirth}
                onChange={handleChange}
                InputLabelProps={{ shrink: true }}
                error={Boolean(fieldErrors.dateOfBirth)}
                helperText={fieldErrors.dateOfBirth}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth required error={Boolean(fieldErrors.gender)}>
                <InputLabel>Sexe</InputLabel>
                <Select
                  name="gender"
                  value={formData.gender}
                  label="Sexe"
                  onChange={handleChange}
                >
                  <MenuItem value="M">Homme</MenuItem>
                  <MenuItem value="F">Femme</MenuItem>
                </Select>
                {fieldErrors.gender && (
                  <FormHelperText>{fieldErrors.gender}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="Telephone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+228 90 00 00 00"
                error={Boolean(fieldErrors.phone)}
                helperText={fieldErrors.phone || 'Format: +228 XX XX XX XX'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                type="email"
                label="Email (optionnel)"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={Boolean(fieldErrors.email)}
                helperText={fieldErrors.email}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Adresse (optionnel)"
                name="address"
                value={formData.address}
                onChange={handleChange}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                startIcon={<SaveIcon />}
                disabled={loading}
              >
                {loading
                  ? (isEditMode ? 'Mise a jour...' : 'Enregistrement...')
                  : (isEditMode ? 'Mettre a jour' : 'Enregistrer le Patient')}
              </Button>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  );
};

export default PatientForm;
