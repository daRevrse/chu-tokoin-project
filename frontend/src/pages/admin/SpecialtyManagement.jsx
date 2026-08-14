import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  CircularProgress,
  InputAdornment,
  Grid
} from '@mui/material';
import {
  AddRounded as AddIcon,
  LocalHospitalRounded as SpecialtyIcon,
  PaymentsRounded as TariffIcon
} from '@mui/icons-material';
import api from '../../services/api';

const formatAmount = (amount) =>
  new Intl.NumberFormat('fr-FR').format(Number(amount) || 0) + ' FCFA';

const VISIT_TYPE_LABELS = {
  CONSULTATION: 'Consultation',
  RESULT_REVIEW: 'Retour résultats',
  EMERGENCY: 'Admission aux urgences'
};

const EMPTY_SPECIALTY = { code: '', name: '', description: '', color: '', displayOrder: 0 };
const EMPTY_TARIFF = { specialtyId: '', visitType: 'CONSULTATION', amount: '', label: '', validityDays: 0 };

/**
 * Specialites cliniques et grille des frais de consultation.
 *
 * La grille est vide a l'installation : aucun montant n'est livre par defaut,
 * les tarifs relevant de chaque etablissement. Tant qu'elle l'est, aucun frais
 * n'est reclame et le circuit fonctionne comme avant.
 */
const SpecialtyManagement = () => {
  const [specialties, setSpecialties] = useState([]);
  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const [specialtyDialog, setSpecialtyDialog] = useState(null);
  const [tariffDialog, setTariffDialog] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [specialtyRes, tariffRes] = await Promise.all([
        api.get('/specialties?active=all'),
        api.get('/specialties/tariffs')
      ]);
      setSpecialties(specialtyRes.data.specialties || []);
      setTariffs(tariffRes.data.tariffs || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const saveSpecialty = async () => {
    setSaving(true);
    setDialogError('');

    try {
      if (specialtyDialog.id) {
        await api.put(`/specialties/${specialtyDialog.id}`, specialtyDialog);
      } else {
        await api.post('/specialties', specialtyDialog);
      }
      setSpecialtyDialog(null);
      setFeedback('Spécialité enregistrée');
      await fetchAll();
    } catch (err) {
      setDialogError(err.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialty = async (specialty) => {
    try {
      await api.put(`/specialties/${specialty.id}`, { isActive: !specialty.isActive });
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    }
  };

  const saveTariff = async () => {
    setSaving(true);
    setDialogError('');

    try {
      if (tariffDialog.id) {
        await api.put(`/specialties/tariffs/${tariffDialog.id}`, {
          amount: tariffDialog.amount,
          label: tariffDialog.label,
          validityDays: tariffDialog.validityDays,
          isActive: tariffDialog.isActive
        });
      } else {
        await api.post('/specialties/tariffs', {
          ...tariffDialog,
          specialtyId: tariffDialog.specialtyId || null
        });
      }
      setTariffDialog(null);
      setFeedback('Tarif enregistré');
      await fetchAll();
    } catch (err) {
      setDialogError(err.response?.data?.error || 'Erreur lors de l\'enregistrement');
    } finally {
      setSaving(false);
    }
  };

  const toggleTariff = async (tariff) => {
    try {
      await api.put(`/specialties/tariffs/${tariff.id}`, { isActive: !tariff.isActive });
      await fetchAll();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la mise à jour');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  return (
    <Box>
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
      {feedback && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setFeedback('')}>
          {feedback}
        </Alert>
      )}

      {/* --- Specialites --- */}
      <Paper elevation={0} sx={{ p: 4, mb: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              <SpecialtyIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Spécialités cliniques
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Elles déterminent la file d'attente du patient et le tarif de sa consultation.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setSpecialtyDialog({ ...EMPTY_SPECIALTY }); setDialogError(''); }}
            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
          >
            Nouvelle spécialité
          </Button>
        </Box>

        {specialties.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Aucune spécialité déclarée. Les patients rejoignent une file unique et ne sont pas orientés.
          </Alert>
        ) : (
          <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Nom</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Médecins</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Active</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {specialties.map((specialty) => (
                  <TableRow key={specialty.id} hover>
                    <TableCell>
                      <Chip label={specialty.code} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>{specialty.name}</TableCell>
                    <TableCell align="center">
                      {/* Une specialite sans medecin recoit des patients que
                          personne n'appellera : l'information doit sauter aux yeux. */}
                      <Chip
                        label={specialty.doctorCount}
                        size="small"
                        color={specialty.doctorCount === 0 ? 'warning' : 'default'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={specialty.isActive}
                        onChange={() => toggleSpecialty(specialty)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => { setSpecialtyDialog({ ...specialty }); setDialogError(''); }}
                        sx={{ textTransform: 'none' }}
                      >
                        Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* --- Grille tarifaire --- */}
      <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">
              <TariffIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
              Frais de consultation
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Un tarif sans spécialité s'applique par défaut à tous les passages non couverts.
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setTariffDialog({ ...EMPTY_TARIFF }); setDialogError(''); }}
            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
          >
            Nouveau tarif
          </Button>
        </Box>

        {tariffs.length === 0 ? (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            Aucun tarif défini : aucune consultation n'est facturée et les patients passent
            directement de l'accueil au médecin.
          </Alert>
        ) : (
          <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Spécialité</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Type de passage</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Libellé imprimé</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Validité</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Montant</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actif</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tariffs.map((tariff) => (
                  <TableRow key={tariff.id} hover>
                    <TableCell>
                      {tariff.specialty
                        ? tariff.specialty.name
                        : <Chip label="Tarif par défaut" size="small" color="primary" variant="outlined" />}
                    </TableCell>
                    <TableCell>{VISIT_TYPE_LABELS[tariff.visitType] || tariff.visitType}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{tariff.label || '—'}</TableCell>
                    <TableCell>
                      {tariff.validityDays > 0 ? (
                        <Chip label={`${tariff.validityDays} j`} size="small" color="success" variant="outlined" />
                      ) : (
                        <Typography variant="caption" color="text.secondary">Chaque passage</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography fontWeight="bold">{formatAmount(tariff.amount)}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Switch
                        checked={tariff.isActive}
                        onChange={() => toggleTariff(tariff)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        onClick={() => { setTariffDialog({ ...tariff }); setDialogError(''); }}
                        sx={{ textTransform: 'none' }}
                      >
                        Modifier
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* --- Dialogue specialite --- */}
      <Dialog open={Boolean(specialtyDialog)} onClose={() => setSpecialtyDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{specialtyDialog?.id ? 'Modifier la spécialité' : 'Nouvelle spécialité'}</DialogTitle>
        <DialogContent>
          {specialtyDialog && (
            <Grid container spacing={2} sx={{ pt: 1 }}>
              {dialogError && (
                <Grid size={12}>
                  <Alert severity="error" sx={{ borderRadius: 2 }}>{dialogError}</Alert>
                </Grid>
              )}
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  fullWidth
                  label="Code"
                  value={specialtyDialog.code}
                  // Le code identifie la specialite de facon stable : le modifier
                  // apres coup romprait les references deja etablies.
                  disabled={Boolean(specialtyDialog.id)}
                  onChange={(e) => setSpecialtyDialog({ ...specialtyDialog, code: e.target.value.toUpperCase() })}
                  sx={inputStyle}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 8 }}>
                <TextField
                  fullWidth
                  label="Nom"
                  value={specialtyDialog.name}
                  onChange={(e) => setSpecialtyDialog({ ...specialtyDialog, name: e.target.value })}
                  sx={inputStyle}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  label="Description"
                  value={specialtyDialog.description || ''}
                  onChange={(e) => setSpecialtyDialog({ ...specialtyDialog, description: e.target.value })}
                  sx={inputStyle}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Ordre d'affichage"
                  value={specialtyDialog.displayOrder ?? 0}
                  onChange={(e) => setSpecialtyDialog({ ...specialtyDialog, displayOrder: Number(e.target.value) })}
                  sx={inputStyle}
                />
              </Grid>
              <Grid size={{ xs: 6 }}>
                <TextField
                  fullWidth
                  label="Couleur"
                  placeholder="#1976d2"
                  value={specialtyDialog.color || ''}
                  onChange={(e) => setSpecialtyDialog({ ...specialtyDialog, color: e.target.value })}
                  sx={inputStyle}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSpecialtyDialog(null)} sx={{ textTransform: 'none' }}>Annuler</Button>
          <Button
            variant="contained"
            onClick={saveSpecialty}
            disabled={saving || !specialtyDialog?.code || !specialtyDialog?.name}
            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Dialogue tarif --- */}
      <Dialog open={Boolean(tariffDialog)} onClose={() => setTariffDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{tariffDialog?.id ? 'Modifier le tarif' : 'Nouveau tarif'}</DialogTitle>
        <DialogContent>
          {tariffDialog && (
            <Grid container spacing={2} sx={{ pt: 1 }}>
              {dialogError && (
                <Grid size={12}>
                  <Alert severity="error" sx={{ borderRadius: 2 }}>{dialogError}</Alert>
                </Grid>
              )}

              {tariffDialog.id && (
                <Grid size={12}>
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    Les factures déjà émises conservent leur montant : le nouveau tarif
                    ne vaut que pour les passages ouverts ensuite.
                  </Alert>
                </Grid>
              )}

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth sx={inputStyle}>
                  <InputLabel>Spécialité</InputLabel>
                  <Select
                    value={tariffDialog.specialtyId || ''}
                    label="Spécialité"
                    disabled={Boolean(tariffDialog.id)}
                    onChange={(e) => setTariffDialog({ ...tariffDialog, specialtyId: e.target.value })}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value=""><em>Tarif par défaut</em></MenuItem>
                    {specialties.filter(s => s.isActive).map((specialty) => (
                      <MenuItem key={specialty.id} value={specialty.id}>{specialty.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth sx={inputStyle}>
                  <InputLabel>Type de passage</InputLabel>
                  <Select
                    value={tariffDialog.visitType}
                    label="Type de passage"
                    disabled={Boolean(tariffDialog.id)}
                    onChange={(e) => setTariffDialog({ ...tariffDialog, visitType: e.target.value })}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="CONSULTATION">Consultation</MenuItem>
                    <MenuItem value="RESULT_REVIEW">Retour résultats</MenuItem>
                    {/* Le forfait d'urgences ne se rattache a aucune specialite :
                        il s'applique a toute admission au service. */}
                    <MenuItem value="EMERGENCY">Admission aux urgences</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Montant"
                  value={tariffDialog.amount}
                  onChange={(e) => setTariffDialog({ ...tariffDialog, amount: e.target.value })}
                  inputProps={{ min: 0, step: 50 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">FCFA</InputAdornment> }}
                  helperText="Un montant à 0 produit une facture soldée : la gratuité reste tracée."
                  sx={inputStyle}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  type="number"
                  label="Validité du ticket"
                  value={tariffDialog.validityDays ?? 0}
                  onChange={(e) => setTariffDialog({ ...tariffDialog, validityDays: Number(e.target.value) })}
                  inputProps={{ min: 0, max: 365, step: 1 }}
                  InputProps={{ endAdornment: <InputAdornment position="end">jours</InputAdornment> }}
                  helperText="Un patient qui revient dans ce délai voir la même spécialité ne repaie pas. 0 = chaque passage est facturé."
                  sx={inputStyle}
                />
              </Grid>

              <Grid size={12}>
                <TextField
                  fullWidth
                  label="Libellé imprimé (optionnel)"
                  placeholder="Ex. Consultation pédiatrie"
                  value={tariffDialog.label || ''}
                  onChange={(e) => setTariffDialog({ ...tariffDialog, label: e.target.value })}
                  sx={inputStyle}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTariffDialog(null)} sx={{ textTransform: 'none' }}>Annuler</Button>
          <Button
            variant="contained"
            onClick={saveTariff}
            disabled={saving || tariffDialog?.amount === '' || tariffDialog?.amount === null}
            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
          >
            Enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SpecialtyManagement;
