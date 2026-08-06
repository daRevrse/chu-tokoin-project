import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Grid,
  Typography,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  Switch
} from '@mui/material';
import {
  AddRounded as AddIcon,
  SearchRounded as SearchIcon,
  EditRounded as EditIcon,
  RefreshRounded as RefreshIcon,
  SearchOffRounded as NoResultIcon,
  ClearRounded as ClearIcon
} from '@mui/icons-material';
import api from '../../services/api';

const EMPTY_FORM = {
  code: '',
  name: '',
  serviceId: '',
  categoryId: '',
  price: '',
  description: '',
  isActive: true
};

// Libelle de repli pour les examens pas encore rattaches a un service
const legacyLabel = (exam) =>
  exam?.category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire';

const ExamManagement = () => {
  const [exams, setExams] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', serviceId: '', active: '' });

  const [formDialog, setFormDialog] = useState({ open: false, editing: null });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const formatPrice = (price) =>
    new Intl.NumberFormat('fr-FR').format(price || 0) + ' FCFA';

  const fetchExams = useCallback(async (overrides = {}) => {
    setLoading(true);
    try {
      const active = { ...filters, ...overrides };
      const params = new URLSearchParams();
      if (active.serviceId) params.set('serviceId', active.serviceId);
      // 'all' affiche aussi les examens desactives (mode administration)
      params.set('active', active.active === '' ? 'all' : active.active);

      const [examsRes, servicesRes] = await Promise.all([
        api.get(`/exams?${params.toString()}`),
        api.get('/admin/services?active=true')
      ]);
      setExams(examsRes.data.exams || []);
      setServices(servicesRes.data.services || []);
    } catch (err) {
      notify(err.response?.data?.error || 'Erreur lors du chargement des examens', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (field, value) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    if (field !== 'search') fetchExams(next);
  };

  const handleClearFilters = () => {
    const cleared = { search: '', serviceId: '', active: '' };
    setFilters(cleared);
    fetchExams(cleared);
  };

  const hasActiveFilters = filters.search || filters.serviceId || filters.active !== '';

  // Sous-categories du service selectionne dans le formulaire
  const formCategories = useMemo(() => {
    const service = services.find((s) => s.id === formData.serviceId);
    return service?.categories?.filter((c) => c.isActive) || [];
  }, [services, formData.serviceId]);

  // La recherche textuelle est appliquee cote client : l'API examens ne
  // propose pas de parametre de recherche.
  const visibleExams = useMemo(() => {
    if (!filters.search.trim()) return exams;
    const term = filters.search.toLowerCase();
    return exams.filter(
      (e) =>
        e.name.toLowerCase().includes(term) ||
        e.code.toLowerCase().includes(term)
    );
  }, [exams, filters.search]);

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
    setFormDialog({ open: true, editing: null });
  };

  const openEdit = (exam) => {
    setFormData({
      code: exam.code,
      name: exam.name,
      serviceId: exam.serviceId || '',
      categoryId: exam.categoryId || '',
      price: String(exam.price ?? ''),
      description: exam.description || '',
      isActive: exam.isActive
    });
    setFormErrors({});
    setFormError('');
    setFormDialog({ open: true, editing: exam });
  };

  const validateForm = () => {
    const errors = {};
    const isEdit = Boolean(formDialog.editing);

    if (!isEdit && !formData.code.trim()) errors.code = 'Le code est requis';
    if (!formData.name.trim()) errors.name = 'Le nom est requis';
    if (!formData.serviceId) errors.serviceId = 'Le service réalisant l\'examen est requis';
    if (formData.price === '' || formData.price === null) {
      errors.price = 'Le prix est requis';
    } else if (isNaN(Number(formData.price)) || Number(formData.price) < 0) {
      errors.price = 'Le prix doit être un nombre positif';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setFormError('');
    try {
      if (formDialog.editing) {
        // Le code n'est pas modifiable : il identifie l'examen dans les
        // prescriptions deja enregistrees. Le service, lui, peut changer
        // (reorganisation d'un service vers un autre).
        await api.put(`/exams/${formDialog.editing.id}`, {
          name: formData.name,
          price: Number(formData.price),
          description: formData.description || null,
          isActive: formData.isActive,
          serviceId: formData.serviceId,
          categoryId: formData.categoryId || null
        });
        notify('Examen mis à jour');
      } else {
        await api.post('/exams', {
          code: formData.code.trim().toUpperCase(),
          name: formData.name,
          serviceId: formData.serviceId,
          categoryId: formData.categoryId || null,
          price: Number(formData.price),
          description: formData.description || null
        });
        notify('Examen créé avec succès');
      }
      setFormDialog({ open: false, editing: null });
      fetchExams();
    } catch (err) {
      setFormError(
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        "Erreur lors de l'enregistrement"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (exam) => {
    try {
      await api.put(`/exams/${exam.id}`, { isActive: !exam.isActive });
      notify(exam.isActive ? 'Examen retiré du catalogue' : 'Examen réactivé');
      fetchExams();
    } catch (err) {
      notify(err.response?.data?.error || 'Erreur lors du changement de statut', 'error');
    }
  };

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  return (
    <Box>
      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight="bold">Catalogue des examens</Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => fetchExams()}
              disabled={loading}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', color: 'text.secondary' }}
            >
              Actualiser
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={openCreate}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
            >
              Nouvel Examen
            </Button>
          </Box>
        </Box>

        {/* Filtres */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Rechercher par nom ou code..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              )
            }}
            sx={{ width: 280, ...inputStyle }}
          />
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Service</InputLabel>
            <Select
              value={filters.serviceId}
              label="Service"
              onChange={(e) => handleFilterChange('serviceId', e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">Tous</MenuItem>
              {services.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Statut</InputLabel>
            <Select
              value={filters.active}
              label="Statut"
              onChange={(e) => handleFilterChange('active', e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">Tous</MenuItem>
              <MenuItem value="true">Actifs</MenuItem>
              <MenuItem value="false">Retirés</MenuItem>
            </Select>
          </FormControl>
          {hasActiveFilters && (
            <Button
              size="small"
              startIcon={<ClearIcon />}
              onClick={handleClearFilters}
              sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
            >
              Effacer
            </Button>
          )}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Examen</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Service</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Tarif</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleExams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Box sx={{ py: 6 }}>
                        <NoResultIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                        <Typography color="textSecondary">
                          {hasActiveFilters
                            ? 'Aucun examen ne correspond aux filtres'
                            : 'Aucun examen au catalogue'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleExams.map((exam) => {
                    const serviceName = exam.service?.name || legacyLabel(exam);
                    const serviceColor = exam.service?.color || '#607d8b';
                    return (
                      <TableRow key={exam.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>
                          <Chip
                            label={exam.code}
                            size="small"
                            variant="outlined"
                            sx={{ fontWeight: 'bold', bgcolor: '#f5f7fb' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">{exam.name}</Typography>
                          {exam.description && (
                            <Typography variant="caption" color="textSecondary">
                              {exam.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={serviceName}
                            size="small"
                            sx={{
                              fontWeight: 'bold',
                              bgcolor: `${serviceColor}22`,
                              color: serviceColor
                            }}
                          />
                          {exam.examCategory && (
                            <Typography variant="caption" color="textSecondary" display="block" sx={{ mt: 0.5 }}>
                              {exam.examCategory.name}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" fontWeight="bold" color="primary">
                            {formatPrice(exam.price)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={exam.isActive ? 'Actif' : 'Retiré'}
                            color={exam.isActive ? 'success' : 'default'}
                            size="small"
                            variant={exam.isActive ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 'bold' }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Modifier" arrow>
                            <IconButton
                              size="small"
                              onClick={() => openEdit(exam)}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: '#e3f2fd' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={exam.isActive ? 'Retirer du catalogue' : 'Réactiver'} arrow>
                            <Switch
                              size="small"
                              checked={exam.isActive}
                              onChange={() => handleToggleStatus(exam)}
                              sx={{ ml: 0.5 }}
                            />
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Dialogue creation / modification */}
      <Dialog
        open={formDialog.open}
        onClose={() => !saving && setFormDialog({ open: false, editing: null })}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', pt: 3 }}>
          {formDialog.editing ? 'Modifier l\'examen' : 'Nouvel examen'}
        </DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{formError}</Alert>}
          {formDialog.editing && (
            <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
              Le code n'est pas modifiable : il identifie l'examen dans les
              prescriptions déjà enregistrées. Le service, lui, peut changer.
            </Alert>
          )}
          <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Code"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                disabled={Boolean(formDialog.editing)}
                error={Boolean(formErrors.code)}
                helperText={formErrors.code || (formDialog.editing ? '' : 'Ex. : RX-THORAX')}
                sx={inputStyle}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required error={Boolean(formErrors.serviceId)}>
                <InputLabel>Service réalisant l'examen</InputLabel>
                <Select
                  value={formData.serviceId}
                  label="Service réalisant l'examen"
                  onChange={(e) => setFormData({
                    ...formData,
                    serviceId: e.target.value,
                    // La sous-categorie appartient au service : changer de
                    // service invalide la selection precedente.
                    categoryId: ''
                  })}
                  sx={{ borderRadius: 2 }}
                >
                  {services.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </Select>
                {formErrors.serviceId && (
                  <FormHelperText>{formErrors.serviceId}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth disabled={formCategories.length === 0}>
                <InputLabel>Sous-catégorie (optionnel)</InputLabel>
                <Select
                  value={formData.categoryId}
                  label="Sous-catégorie (optionnel)"
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  sx={{ borderRadius: 2 }}
                >
                  <MenuItem value="">Aucune</MenuItem>
                  {formCategories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  {!formData.serviceId
                    ? 'Choisissez d\'abord un service'
                    : formCategories.length === 0
                      ? 'Ce service n\'a pas de sous-catégorie'
                      : 'Précise le plateau technique au sein du service'}
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                required
                label="Nom de l'examen"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={Boolean(formErrors.name)}
                helperText={formErrors.name}
                sx={inputStyle}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                type="number"
                label="Tarif (FCFA)"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                error={Boolean(formErrors.price)}
                helperText={formErrors.price}
                InputProps={{ inputProps: { min: 0, step: 500 } }}
                sx={inputStyle}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description (optionnel)"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                sx={inputStyle}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setFormDialog({ open: false, editing: null })}
            disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3 }}
          >
            {saving ? 'Enregistrement...' : (formDialog.editing ? 'Mettre à jour' : 'Créer')}
          </Button>
        </DialogActions>
      </Dialog>

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

export default ExamManagement;
