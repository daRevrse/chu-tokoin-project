import React, { useState } from 'react';
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
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  EmergencyRounded as EmergencyIcon,
  PersonSearchRounded as SearchIcon,
  HelpOutlineRounded as UnknownIcon
} from '@mui/icons-material';
import api from '../../services/api';
import PatientSearch from '../../components/patient/PatientSearch';
import { TRIAGE_LEVELS, ARRIVAL_MODES } from './triage';

const VITALS = [
  { name: 'temperatureC', label: 'Température', unit: '°C', min: 25, max: 45, step: 0.1 },
  { name: 'bloodPressureSys', label: 'TA systolique', unit: 'mmHg', min: 30, max: 300, step: 1 },
  { name: 'bloodPressureDia', label: 'TA diastolique', unit: 'mmHg', min: 10, max: 200, step: 1 },
  { name: 'pulseBpm', label: 'Pouls', unit: 'bpm', min: 10, max: 300, step: 1 },
  { name: 'oxygenSaturation', label: 'SpO2', unit: '%', min: 10, max: 100, step: 1 },
  { name: 'weightKg', label: 'Poids', unit: 'kg', min: 0.5, max: 400, step: 0.1 }
];

const EMPTY_FORM = {
  provisionalLabel: '',
  arrivalMode: 'WALK_IN',
  chiefComplaint: '',
  triageLevel: '',
  triageNotes: '',
  temperatureC: '',
  bloodPressureSys: '',
  bloodPressureDia: '',
  pulseBpm: '',
  oxygenSaturation: '',
  weightKg: ''
};

/**
 * Admission aux urgences.
 *
 * Deux entrees possibles, et c'est le coeur du circuit : un patient connu qu'on
 * retrouve dans le dossier, ou un patient qu'on ne peut pas identifier et qu'on
 * decrit. La seconde n'est pas un cas degrade a eviter, c'est le cas normal
 * d'une arrivee en ambulance.
 */
const EmergencyAdmission = ({ onAdmitted }) => {
  const [mode, setMode] = useState('KNOWN');
  const [patient, setPatient] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const reset = () => {
    setFormData(EMPTY_FORM);
    setPatient(null);
  };

  const submit = async () => {
    setLoading(true);
    setError('');

    const payload = Object.entries(formData).reduce((acc, [key, value]) => {
      if (value !== '') acc[key] = value;
      return acc;
    }, {});

    if (mode === 'KNOWN') {
      payload.patientId = patient.id;
      delete payload.provisionalLabel;
    }

    try {
      const response = await api.post('/emergencies', payload);
      reset();
      onAdmitted(response.data.emergencyCase);
    } catch (err) {
      setError(err.response?.data?.error
        || err.response?.data?.errors?.[0]?.msg
        || 'Erreur lors de l\'ouverture du dossier');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };
  const canSubmit = mode === 'KNOWN' ? Boolean(patient) : formData.provisionalLabel.trim().length > 0;

  return (
    <Box>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
        Admettre un patient
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Le dossier s'ouvre sans attendre le règlement. La créance sera ouverte à
        l'identification du patient et régularisée à la caisse.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      <ToggleButtonGroup
        exclusive
        value={mode}
        onChange={(e, value) => { if (value) { setMode(value); setPatient(null); } }}
        sx={{ mb: 3 }}
      >
        <ToggleButton value="KNOWN" sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}>
          <SearchIcon sx={{ mr: 1 }} fontSize="small" />
          Patient identifié
        </ToggleButton>
        <ToggleButton value="UNKNOWN" sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}>
          <UnknownIcon sx={{ mr: 1 }} fontSize="small" />
          Identité inconnue
        </ToggleButton>
      </ToggleButtonGroup>

      {mode === 'KNOWN' && !patient && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <PatientSearch
            onSelectPatient={setPatient}
            onOpenVisit={setPatient}
            emptyHint="Si le patient n'est pas retrouvé, passez en « Identité inconnue » : il sera rattaché plus tard."
          />
        </Paper>
      )}

      {mode === 'KNOWN' && patient && (
        <Alert
          severity="success"
          sx={{ mb: 3, borderRadius: 2 }}
          action={<Button color="inherit" size="small" onClick={() => setPatient(null)}>Changer</Button>}
        >
          {patient.lastName} {patient.firstName}
          <Chip label={patient.patientNumber} size="small" sx={{ ml: 1 }} />
        </Alert>
      )}

      {(mode === 'UNKNOWN' || patient) && (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Grid container spacing={3}>
            {mode === 'UNKNOWN' && (
              <Grid size={12}>
                <TextField
                  fullWidth
                  required
                  label="Désignation provisoire"
                  name="provisionalLabel"
                  value={formData.provisionalLabel}
                  onChange={handleChange}
                  placeholder="Ex. Homme, environ 40 ans, amené inconscient"
                  helperText="Sert à nommer le patient dans la file. L'identité réelle sera rattachée dès qu'elle sera connue."
                  sx={inputStyle}
                />
              </Grid>
            )}

            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth sx={inputStyle}>
                <InputLabel>Mode d'arrivée</InputLabel>
                <Select
                  name="arrivalMode"
                  value={formData.arrivalMode}
                  label="Mode d'arrivée"
                  onChange={handleChange}
                  sx={{ borderRadius: 2 }}
                >
                  {ARRIVAL_MODES.map(m => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Motif d'admission"
                name="chiefComplaint"
                value={formData.chiefComplaint}
                onChange={handleChange}
                placeholder="Ex. douleur thoracique depuis 1 h, chute d'un toit..."
                sx={inputStyle}
              />
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Triage (optionnel à l'admission)
                </Typography>
              </Divider>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                Sans cotation, le dossier passe en tête de file en attente d'évaluation :
                un patient non trié est traité comme le plus grave, faute de savoir.
              </Typography>
            </Grid>

            <Grid size={12}>
              <FormControl fullWidth sx={inputStyle}>
                <InputLabel>Niveau de gravité</InputLabel>
                <Select
                  name="triageLevel"
                  value={formData.triageLevel}
                  label="Niveau de gravité"
                  onChange={handleChange}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value=""><em>À évaluer</em></MenuItem>
                  {TRIAGE_LEVELS.map(t => (
                    <MenuItem key={t.level} value={t.level}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: t.color }} />
                        {t.level} — {t.label} : {t.description}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
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
                  inputProps={{ min, max, step }}
                  InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                  sx={inputStyle}
                />
              </Grid>
            ))}

            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Observations du triage"
                name="triageNotes"
                value={formData.triageNotes}
                onChange={handleChange}
                sx={inputStyle}
              />
            </Grid>

            <Grid size={12}>
              <Button
                variant="contained"
                color="error"
                size="large"
                startIcon={<EmergencyIcon />}
                disabled={loading || !canSubmit}
                onClick={submit}
                sx={{ borderRadius: 2, textTransform: 'none', px: 4, py: 1.5, boxShadow: 'none' }}
              >
                {loading ? 'Ouverture...' : 'Ouvrir le dossier d\'urgence'}
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default EmergencyAdmission;
