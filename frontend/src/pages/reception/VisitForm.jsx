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
  Divider,
  InputAdornment
} from '@mui/material';
import {
  ConfirmationNumberRounded as TicketIcon,
  ArrowBackRounded as BackIcon,
  WarningAmberRounded as UrgentIcon
} from '@mui/icons-material';
import api from '../../services/api';

// Bornes alignees sur la validation serveur (routes/visits.js) : elles
// attrapent les fautes de frappe, pas les cas pathologiques.
const VITALS = [
  { name: 'weightKg', label: 'Poids', unit: 'kg', min: 0.5, max: 400, step: 0.1 },
  { name: 'heightCm', label: 'Taille', unit: 'cm', min: 20, max: 250, step: 1 },
  { name: 'temperatureC', label: 'Température', unit: '°C', min: 30, max: 45, step: 0.1 },
  { name: 'bloodPressureSys', label: 'Tension systolique', unit: 'mmHg', min: 40, max: 300, step: 1 },
  { name: 'bloodPressureDia', label: 'Tension diastolique', unit: 'mmHg', min: 20, max: 200, step: 1 },
  { name: 'pulseBpm', label: 'Pouls', unit: 'bpm', min: 20, max: 250, step: 1 }
];

const formatAmount = (amount) =>
  new Intl.NumberFormat('fr-FR').format(Number(amount) || 0) + ' FCFA';

const EMPTY_FORM = {
  reason: '',
  priority: 'NORMAL',
  specialtyId: '',
  weightKg: '',
  heightCm: '',
  temperatureC: '',
  bloodPressureSys: '',
  bloodPressureDia: '',
  pulseBpm: ''
};

/**
 * Ouverture d'un passage pour un patient deja identifie.
 * Motif, priorite et constantes relevees a l'accueil.
 */
const VisitForm = ({ patient, onBack, onSuccess }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  // Passage deja ouvert aujourd'hui : on demande confirmation avant d'en
  // ouvrir un second (retour dans la journee pour un autre motif).
  const [duplicateVisit, setDuplicateVisit] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [tariffs, setTariffs] = useState([]);

  useEffect(() => {
    // Les deux listes ensemble : l'orientation et son tarif sont annonces au
    // patient dans le meme geste, il n'y a pas de raison de les charger a des
    // moments differents.
    const load = async () => {
      try {
        const [specialtyRes, tariffRes] = await Promise.all([
          api.get('/specialties?active=true'),
          api.get('/specialties/tariffs')
        ]);
        setSpecialties(specialtyRes.data.specialties || []);
        setTariffs((tariffRes.data.tariffs || []).filter(t => t.isActive));
      } catch (err) {
        // Une grille indisponible ne doit pas empecher d'enregistrer un patient :
        // le serveur facturera de toute facon, l'accueil perd seulement
        // l'affichage du montant.
        console.error('Erreur chargement specialites:', err);
      }
    };
    load();
  }, []);

  // Meme resolution que le serveur (services/consultationFeeService.js) : tarif
  // propre a la specialite, puis tarif par defaut. L'accueil doit annoncer le
  // montant que la caisse reclamera, pas une approximation.
  const resolveTariff = () => {
    const visitType = 'CONSULTATION';
    return tariffs.find(t => t.specialtyId === formData.specialtyId && t.visitType === visitType)
      || tariffs.find(t => !t.specialtyId && t.visitType === visitType)
      || null;
  };

  const tariff = resolveTariff();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};

    VITALS.forEach(({ name, label, min, max, unit }) => {
      const raw = formData[name];
      if (raw === '') return;

      const value = Number(raw);
      if (Number.isNaN(value) || value < min || value > max) {
        errors[name] = `${label} : ${min} à ${max} ${unit}`;
      }
    });

    const sys = Number(formData.bloodPressureSys);
    const dia = Number(formData.bloodPressureDia);
    if (formData.bloodPressureSys && formData.bloodPressureDia && dia >= sys) {
      errors.bloodPressureDia = 'La diastolique doit être inférieure à la systolique';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (force = false) => {
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    // Les constantes vides ne sont pas envoyees : le serveur distingue
    // "non releve" (null) de "releve a zero".
    const payload = Object.entries(formData).reduce((acc, [key, value]) => {
      if (value !== '') acc[key] = value;
      return acc;
    }, { patientId: patient.id });

    if (force) payload.force = true;

    try {
      const response = await api.post('/visits', payload);
      onSuccess(response.data.visit, response.data.consultationInvoice);
    } catch (err) {
      if (err.response?.status === 409 && err.response.data?.visit) {
        setDuplicateVisit(err.response.data.visit);
      } else {
        console.error('Erreur ouverture passage:', err);
        setError(err.response?.data?.error || 'Erreur lors de l\'ouverture du passage');
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };
  const isUrgent = formData.priority === 'URGENT';

  return (
    <Box>
      <Button
        startIcon={<BackIcon />}
        onClick={onBack}
        sx={{ mb: 3, borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
      >
        Retour
      </Button>

      <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
        Ouvrir un passage
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h6" color="text.secondary">
          {patient.lastName} {patient.firstName}
        </Typography>
        <Chip label={patient.patientNumber} size="small" color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} />
      </Box>

      <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, maxWidth: 800, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

        {duplicateVisit && (
          <Alert
            severity="warning"
            sx={{ mb: 3, borderRadius: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => { setDuplicateVisit(null); submit(true); }}>
                Ouvrir quand même
              </Button>
            }
          >
            Ce patient a déjà le ticket n° {duplicateVisit.ticketNumber} aujourd'hui
            {duplicateVisit.status === 'IN_CONSULT' ? ' (en consultation)' : ' (en attente)'}.
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid size={12}>
            <TextField
              fullWidth
              multiline
              rows={2}
              label="Motif de la visite"
              name="reason"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Ex. fièvre depuis 3 jours, contrôle post-opératoire..."
              sx={inputStyle}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth sx={inputStyle}>
              <InputLabel>Spécialité</InputLabel>
              <Select
                name="specialtyId"
                value={formData.specialtyId}
                label="Spécialité"
                onChange={handleChange}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">
                  <em>Non orienté</em>
                </MenuItem>
                {specialties.map((specialty) => (
                  <MenuItem key={specialty.id} value={specialty.id}>
                    {specialty.name}
                    {specialty.doctorCount === 0 && ' (aucun médecin)'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
            {tariff ? (
              <Alert severity="info" sx={{ borderRadius: 2, width: '100%', py: 0 }}>
                Frais de consultation : <strong>{formatAmount(tariff.amount)}</strong> — à régler à la caisse
              </Alert>
            ) : (
              <Alert severity="success" sx={{ borderRadius: 2, width: '100%', py: 0 }}>
                Aucun frais de consultation
              </Alert>
            )}
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth sx={inputStyle}>
              <InputLabel>Priorité</InputLabel>
              <Select
                name="priority"
                value={formData.priority}
                label="Priorité"
                onChange={handleChange}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="NORMAL">Normale</MenuItem>
                <MenuItem value="URGENT">Urgence</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {isUrgent && (
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Alert severity="warning" icon={<UrgentIcon />} sx={{ borderRadius: 2, width: '100%', py: 0 }}>
                Placé en tête de file
              </Alert>
            </Grid>
          )}

          <Grid size={12}>
            <Divider sx={{ my: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Constantes (optionnelles)
              </Typography>
            </Divider>
          </Grid>

          {VITALS.map(({ name, label, unit, min, max, step }) => (
            <Grid size={{ xs: 6, sm: 4 }} key={name}>
              <TextField
                fullWidth
                type="number"
                label={label}
                name={name}
                value={formData[name]}
                onChange={handleChange}
                error={Boolean(fieldErrors[name])}
                helperText={fieldErrors[name]}
                inputProps={{ min, max, step }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">{unit}</InputAdornment>
                }}
                sx={inputStyle}
              />
            </Grid>
          ))}

          <Grid size={12} sx={{ mt: 2 }}>
            <Button
              variant="contained"
              size="large"
              color={isUrgent ? 'error' : 'primary'}
              startIcon={<TicketIcon />}
              disabled={loading}
              onClick={() => submit(false)}
              sx={{ borderRadius: 2, textTransform: 'none', px: 4, py: 1.5, boxShadow: 'none' }}
            >
              {loading ? 'Ouverture...' : 'Ouvrir le passage et imprimer le ticket'}
            </Button>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default VisitForm;
