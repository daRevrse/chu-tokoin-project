import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Snackbar,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import {
  AddRounded as AddIcon,
  EditRounded as EditIcon,
  RefreshRounded as RefreshIcon,
  ExpandMoreRounded as ExpandMoreIcon,
  ArrowUpwardRounded as UpIcon,
  ArrowDownwardRounded as DownIcon,
  FlagRounded as ResultIcon,
  ScienceRounded as ServiceIcon,
  CategoryRounded as CategoryIcon,
  RouteRounded as StepIcon
} from '@mui/icons-material';
import api from '../../services/api';

const EMPTY_SERVICE = { code: '', name: '', description: '', color: '#1976d2', displayOrder: 0 };
const EMPTY_STEP = { code: '', name: '', description: '', isRequired: true, producesResult: false };
const EMPTY_CATEGORY = { code: '', name: '', description: '' };

const ServiceManagement = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterActive, setFilterActive] = useState('all');

  const [serviceDialog, setServiceDialog] = useState({ open: false, editing: null });
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE);

  const [stepDialog, setStepDialog] = useState({ open: false, service: null, editing: null });
  const [stepForm, setStepForm] = useState(EMPTY_STEP);

  const [categoryDialog, setCategoryDialog] = useState({ open: false, service: null, editing: null });
  const [categoryForm, setCategoryForm] = useState(EMPTY_CATEGORY);

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const fetchServices = useCallback(async (active = filterActive) => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/services?active=${active}`);
      setServices(res.data.services || []);
    } catch (err) {
      notify(err.response?.data?.error || 'Erreur lors du chargement des services', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterActive]);

  useEffect(() => {
    fetchServices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilter = (value) => {
    setFilterActive(value);
    fetchServices(value);
  };

  // ---- Services ----
  const openServiceDialog = (service = null) => {
    setServiceForm(service
      ? {
        code: service.code,
        name: service.name,
        description: service.description || '',
        color: service.color || '#1976d2',
        displayOrder: service.displayOrder
      }
      : { ...EMPTY_SERVICE, displayOrder: services.length + 1 });
    setFormError('');
    setServiceDialog({ open: true, editing: service });
  };

  const saveService = async () => {
    if (!serviceForm.name.trim() || (!serviceDialog.editing && !serviceForm.code.trim())) {
      setFormError('Le code et le nom sont requis');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (serviceDialog.editing) {
        await api.put(`/admin/services/${serviceDialog.editing.id}`, {
          name: serviceForm.name,
          description: serviceForm.description || null,
          color: serviceForm.color,
          displayOrder: Number(serviceForm.displayOrder)
        });
        notify('Service mis à jour');
      } else {
        await api.post('/admin/services', {
          ...serviceForm,
          displayOrder: Number(serviceForm.displayOrder)
        });
        notify('Service créé');
      }
      setServiceDialog({ open: false, editing: null });
      fetchServices();
    } catch (err) {
      setFormError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const toggleService = async (service) => {
    try {
      await api.put(`/admin/services/${service.id}`, { isActive: !service.isActive });
      notify(service.isActive ? 'Service désactivé' : 'Service activé');
      fetchServices();
    } catch (err) {
      notify(err.response?.data?.error || 'Erreur lors du changement de statut', 'error');
    }
  };

  // ---- Etapes ----
  const openStepDialog = (service, step = null) => {
    setStepForm(step
      ? {
        code: step.code,
        name: step.name,
        description: step.description || '',
        isRequired: step.isRequired,
        producesResult: step.producesResult
      }
      : EMPTY_STEP);
    setFormError('');
    setStepDialog({ open: true, service, editing: step });
  };

  const saveStep = async () => {
    if (!stepForm.name.trim() || (!stepDialog.editing && !stepForm.code.trim())) {
      setFormError('Le code et le nom sont requis');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (stepDialog.editing) {
        await api.put(`/admin/services/steps/${stepDialog.editing.id}`, {
          name: stepForm.name,
          description: stepForm.description || null,
          isRequired: stepForm.isRequired,
          producesResult: stepForm.producesResult
        });
        notify('Étape mise à jour');
      } else {
        await api.post(`/admin/services/${stepDialog.service.id}/steps`, stepForm);
        notify('Étape créée');
      }
      setStepDialog({ open: false, service: null, editing: null });
      fetchServices();
    } catch (err) {
      setFormError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const moveStep = async (service, index, direction) => {
    const steps = [...service.steps];
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    [steps[index], steps[target]] = [steps[target], steps[index]];

    try {
      await api.patch(`/admin/services/${service.id}/steps/reorder`, {
        order: steps.map((s) => s.id)
      });
      fetchServices();
    } catch (err) {
      notify(err.response?.data?.error || 'Erreur lors du réordonnancement', 'error');
    }
  };

  // ---- Categories ----
  const openCategoryDialog = (service, category = null) => {
    setCategoryForm(category
      ? { code: category.code, name: category.name, description: category.description || '' }
      : EMPTY_CATEGORY);
    setFormError('');
    setCategoryDialog({ open: true, service, editing: category });
  };

  const saveCategory = async () => {
    if (!categoryForm.name.trim() || (!categoryDialog.editing && !categoryForm.code.trim())) {
      setFormError('Le code et le nom sont requis');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (categoryDialog.editing) {
        await api.put(`/admin/services/categories/${categoryDialog.editing.id}`, {
          name: categoryForm.name,
          description: categoryForm.description || null
        });
        notify('Catégorie mise à jour');
      } else {
        await api.post(`/admin/services/${categoryDialog.service.id}/categories`, categoryForm);
        notify('Catégorie créée');
      }
      setCategoryDialog({ open: false, service: null, editing: null });
      fetchServices();
    } catch (err) {
      setFormError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };
  const dialogPaper = { sx: { borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' } };

  return (
    <Box>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6" fontWeight="bold">Services et circuits d'examens</Typography>
            <Typography variant="body2" color="textSecondary">
              Chaque service définit ses propres étapes de réalisation.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <InputLabel>Statut</InputLabel>
              <Select value={filterActive} label="Statut" onChange={(e) => handleFilter(e.target.value)} sx={{ borderRadius: 2 }}>
                <MenuItem value="all">Tous</MenuItem>
                <MenuItem value="true">Actifs</MenuItem>
                <MenuItem value="false">Désactivés</MenuItem>
              </Select>
            </FormControl>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => fetchServices()}
              disabled={loading}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', color: 'text.secondary' }}
            >
              Actualiser
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => openServiceDialog()}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
            >
              Nouveau Service
            </Button>
          </Box>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : services.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <ServiceIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
            <Typography color="textSecondary">Aucun service</Typography>
          </Box>
        ) : (
          services.map((service) => (
            <Accordion
              key={service.id}
              elevation={0}
              disableGutters
              sx={{
                mb: 2,
                borderRadius: 3,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'transparent',
                '&:before': { display: 'none' },
                opacity: service.isActive ? 1 : 0.6
              }}
            >
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc', px: 2.5, minHeight: 76 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', pr: 2, flexWrap: 'wrap' }}>
                  <Box sx={{
                    bgcolor: service.color ? `${service.color}22` : '#e3f2fd',
                    width: 44, height: 44, borderRadius: 2,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <ServiceIcon sx={{ fontSize: 22, color: service.color || '#1976d2' }} />
                  </Box>
                  <Box sx={{ flexGrow: 1, minWidth: 180 }}>
                    <Typography fontWeight="bold">{service.name}</Typography>
                    <Typography variant="caption" color="textSecondary">{service.code}</Typography>
                  </Box>
                  <Chip size="small" label={`${service.steps?.length || 0} étape(s)`} sx={{ fontWeight: 'bold', bgcolor: 'white' }} />
                  <Chip size="small" label={`${service.examCount} examen(s)`} sx={{ fontWeight: 'bold', bgcolor: 'white' }} />
                  <Chip size="small" label={`${service.staffCount} agent(s)`} sx={{ fontWeight: 'bold', bgcolor: 'white' }} />
                  {!service.isActive && <Chip size="small" label="Désactivé" color="default" variant="outlined" sx={{ fontWeight: 'bold' }} />}
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', gap: 1.5, mb: 3, flexWrap: 'wrap' }}>
                  <Button size="small" startIcon={<EditIcon />} onClick={() => openServiceDialog(service)}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}>
                    Modifier le service
                  </Button>
                  <FormControlLabel
                    control={<Switch size="small" checked={service.isActive} onChange={() => toggleService(service)} />}
                    label={<Typography variant="body2">{service.isActive ? 'Actif' : 'Désactivé'}</Typography>}
                  />
                </Box>

                <Grid container spacing={3}>
                  {/* Circuit */}
                  <Grid size={{ xs: 12, md: 7 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <StepIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight="bold">Circuit de réalisation</Typography>
                      </Box>
                      <Button size="small" startIcon={<AddIcon />} onClick={() => openStepDialog(service)}
                        sx={{ borderRadius: 2, textTransform: 'none' }}>
                        Étape
                      </Button>
                    </Box>

                    {(service.steps || []).length === 0 ? (
                      <Alert severity="info" sx={{ borderRadius: 2 }}>
                        Aucune étape : les examens de ce service suivront le circuit court
                        (démarré → terminé).
                      </Alert>
                    ) : (
                      service.steps.map((step, index) => (
                        <Box key={step.id} sx={{
                          display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, mb: 1,
                          bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid', borderColor: 'divider'
                        }}>
                          <Chip label={index + 1} size="small" sx={{ fontWeight: 'bold', bgcolor: 'white' }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              {step.name}
                              {step.producesResult && (
                                <Tooltip title="Cette étape clôture l'examen" arrow>
                                  <ResultIcon sx={{ fontSize: 16, ml: 0.8, color: 'success.main', verticalAlign: 'middle' }} />
                                </Tooltip>
                              )}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {step.code}{!step.isRequired && ' — facultative'}
                            </Typography>
                          </Box>
                          <IconButton size="small" disabled={index === 0} onClick={() => moveStep(service, index, -1)}>
                            <UpIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" disabled={index === service.steps.length - 1} onClick={() => moveStep(service, index, 1)}>
                            <DownIcon fontSize="small" />
                          </IconButton>
                          <IconButton size="small" onClick={() => openStepDialog(service, step)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      ))
                    )}
                  </Grid>

                  {/* Sous-categories */}
                  <Grid size={{ xs: 12, md: 5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CategoryIcon fontSize="small" color="action" />
                        <Typography variant="subtitle2" fontWeight="bold">Sous-catégories</Typography>
                      </Box>
                      <Button size="small" startIcon={<AddIcon />} onClick={() => openCategoryDialog(service)}
                        sx={{ borderRadius: 2, textTransform: 'none' }}>
                        Catégorie
                      </Button>
                    </Box>

                    {(service.categories || []).length === 0 ? (
                      <Typography variant="body2" color="textSecondary" sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                        Aucune sous-catégorie : les examens sont rattachés directement au service.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {service.categories.map((cat) => (
                          <Chip
                            key={cat.id}
                            label={cat.name}
                            onClick={() => openCategoryDialog(service, cat)}
                            variant="outlined"
                            sx={{ fontWeight: 'medium', bgcolor: '#f8fafc' }}
                          />
                        ))}
                      </Box>
                    )}
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))
        )}
      </Paper>

      {/* Dialogue service */}
      <Dialog open={serviceDialog.open} onClose={() => !saving && setServiceDialog({ open: false, editing: null })}
        maxWidth="sm" fullWidth PaperProps={dialogPaper}>
        <DialogTitle sx={{ fontWeight: 'bold', pt: 3 }}>
          {serviceDialog.editing ? 'Modifier le service' : 'Nouveau service'}
        </DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{formError}</Alert>}
          <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="Code" value={serviceForm.code}
                disabled={Boolean(serviceDialog.editing)}
                onChange={(e) => setServiceForm({ ...serviceForm, code: e.target.value })}
                helperText={serviceDialog.editing ? '' : 'Ex. : CARDIOLOGIE'} sx={inputStyle} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="Nom" value={serviceForm.name}
                onChange={(e) => setServiceForm({ ...serviceForm, name: e.target.value })} sx={inputStyle} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline rows={2} label="Description" value={serviceForm.description}
                onChange={(e) => setServiceForm({ ...serviceForm, description: e.target.value })} sx={inputStyle} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="number" label="Ordre d'affichage" value={serviceForm.displayOrder}
                onChange={(e) => setServiceForm({ ...serviceForm, displayOrder: e.target.value })} sx={inputStyle} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth type="color" label="Couleur" value={serviceForm.color}
                InputLabelProps={{ shrink: true }}
                onChange={(e) => setServiceForm({ ...serviceForm, color: e.target.value })} sx={inputStyle} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setServiceDialog({ open: false, editing: null })} disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}>Annuler</Button>
          <Button variant="contained" onClick={saveService} disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3 }}>
            {saving ? 'Enregistrement...' : (serviceDialog.editing ? 'Mettre à jour' : 'Créer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue etape */}
      <Dialog open={stepDialog.open} onClose={() => !saving && setStepDialog({ open: false, service: null, editing: null })}
        maxWidth="sm" fullWidth PaperProps={dialogPaper}>
        <DialogTitle sx={{ fontWeight: 'bold', pt: 3 }}>
          {stepDialog.editing ? 'Modifier l\'étape' : 'Nouvelle étape'}
          <Typography variant="body2" color="textSecondary" fontWeight="normal">
            {stepDialog.service?.name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{formError}</Alert>}
          <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="Code" value={stepForm.code}
                disabled={Boolean(stepDialog.editing)}
                onChange={(e) => setStepForm({ ...stepForm, code: e.target.value })}
                helperText={stepDialog.editing ? '' : 'Ex. : PRELEVEMENT'} sx={inputStyle} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth required label="Nom" value={stepForm.name}
                onChange={(e) => setStepForm({ ...stepForm, name: e.target.value })} sx={inputStyle} />
            </Grid>
            <Grid size={12}>
              <TextField fullWidth multiline rows={2} label="Description" value={stepForm.description}
                onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} sx={inputStyle} />
            </Grid>
            <Grid size={12}>
              <Divider sx={{ mb: 1 }} />
              <FormControlLabel
                control={<Switch checked={stepForm.isRequired}
                  onChange={(e) => setStepForm({ ...stepForm, isRequired: e.target.checked })} />}
                label={<Typography variant="body2">Étape obligatoire (non ignorable)</Typography>}
              />
              <FormControlLabel
                control={<Switch checked={stepForm.producesResult}
                  onChange={(e) => setStepForm({ ...stepForm, producesResult: e.target.checked })} />}
                label={<Typography variant="body2">Étape finale : clôture l'examen</Typography>}
              />
              {stepForm.producesResult && (
                <Alert severity="info" sx={{ mt: 1, borderRadius: 2 }}>
                  Un service n'a qu'une seule étape finale : désigner celle-ci libérera l'étape actuelle.
                </Alert>
              )}
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setStepDialog({ open: false, service: null, editing: null })} disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}>Annuler</Button>
          <Button variant="contained" onClick={saveStep} disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3 }}>
            {saving ? 'Enregistrement...' : (stepDialog.editing ? 'Mettre à jour' : 'Créer')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialogue categorie */}
      <Dialog open={categoryDialog.open} onClose={() => !saving && setCategoryDialog({ open: false, service: null, editing: null })}
        maxWidth="xs" fullWidth PaperProps={dialogPaper}>
        <DialogTitle sx={{ fontWeight: 'bold', pt: 3 }}>
          {categoryDialog.editing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          <Typography variant="body2" color="textSecondary" fontWeight="normal">
            {categoryDialog.service?.name}
          </Typography>
        </DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{formError}</Alert>}
          <TextField fullWidth required label="Code" value={categoryForm.code}
            disabled={Boolean(categoryDialog.editing)}
            onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
            sx={{ mt: 1, mb: 2.5, ...inputStyle }} />
          <TextField fullWidth required label="Nom" value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            sx={{ mb: 2.5, ...inputStyle }} />
          <TextField fullWidth multiline rows={2} label="Description" value={categoryForm.description}
            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} sx={inputStyle} />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button onClick={() => setCategoryDialog({ open: false, service: null, editing: null })} disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}>Annuler</Button>
          <Button variant="contained" onClick={saveCategory} disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3 }}>
            {saving ? 'Enregistrement...' : (categoryDialog.editing ? 'Mettre à jour' : 'Créer')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2, fontWeight: 'bold' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ServiceManagement;
