import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  InputAdornment,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
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
  PersonAddRounded as AddUserIcon,
  SearchRounded as SearchIcon,
  EditRounded as EditIcon,
  LockResetRounded as ResetPasswordIcon,
  RefreshRounded as RefreshIcon,
  PersonOffRounded as NoUserIcon,
  GroupRounded as GroupIcon,
  CheckCircleRounded as ActiveIcon,
  BlockRounded as InactiveIcon,
  ClearRounded as ClearIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const ROLES = [
  { value: 'RECEPTIONIST', label: 'Accueil', color: 'secondary' },
  { value: 'DOCTOR', label: 'Médecin', color: 'primary' },
  { value: 'CASHIER', label: 'Caissier', color: 'success' },
  { value: 'RADIOLOGIST', label: 'Radiologue', color: 'info' },
  { value: 'LAB_TECHNICIAN', label: 'Laborantin', color: 'warning' },
  { value: 'TECHNICIAN', label: 'Technicien', color: 'info' },
  { value: 'ADMIN', label: 'Administrateur', color: 'error' }
];

const getRole = (value) => ROLES.find((r) => r.value === value) || { label: value, color: 'default' };

// Roles portant une affectation a un service technique.
const SERVICE_ROLES = ['RADIOLOGIST', 'LAB_TECHNICIAN', 'TECHNICIAN'];

// Pour un TECHNICIAN, le service n'est pas decoratif : c'est lui qui definit
// quels examens le compte peut traiter. Les deux roles historiques gardent un
// perimetre deductible de leur role, le service y reste facultatif.
const requiresService = (role) => role === 'TECHNICIAN';

const EMPTY_FORM = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  role: 'DOCTOR',
  phone: '',
  serviceId: ''
};

const UserManagement = () => {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', role: '', active: '' });

  const [formDialog, setFormDialog] = useState({ open: false, editing: null });
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [passwordDialog, setPasswordDialog] = useState({ open: false, user: null });
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const notify = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const fetchUsers = useCallback(async (overrides = {}) => {
    setLoading(true);
    try {
      const active = { ...filters, ...overrides };
      const params = new URLSearchParams();
      if (active.search) params.set('search', active.search);
      if (active.role) params.set('role', active.role);
      if (active.active !== '') params.set('active', active.active);

      const [usersRes, statsRes, servicesRes] = await Promise.all([
        api.get(`/users?${params.toString()}`),
        api.get('/users/stats'),
        api.get('/admin/services')
      ]);
      setUsers(usersRes.data.users || []);
      setStats(statsRes.data);
      setServices(servicesRes.data.services || []);
    } catch (err) {
      notify(err.response?.data?.error || 'Erreur lors du chargement des utilisateurs', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (field, value) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    fetchUsers(next);
  };

  const handleClearFilters = () => {
    const cleared = { search: '', role: '', active: '' };
    setFilters(cleared);
    fetchUsers(cleared);
  };

  const hasActiveFilters = filters.search || filters.role || filters.active !== '';

  const openCreate = () => {
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
    setFormDialog({ open: true, editing: null });
  };

  const openEdit = (u) => {
    setFormData({
      email: u.email,
      password: '',
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      phone: u.phone || '',
      serviceId: u.serviceId || ''
    });
    setFormErrors({});
    setFormError('');
    setFormDialog({ open: true, editing: u });
  };

  const validateForm = () => {
    const errors = {};
    const isEdit = Boolean(formDialog.editing);

    if (!formData.lastName.trim()) errors.lastName = 'Le nom est requis';
    if (!formData.firstName.trim()) errors.firstName = 'Le prénom est requis';
    if (!formData.email.trim()) {
      errors.email = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email invalide';
    }
    if (!isEdit) {
      if (!formData.password) errors.password = 'Le mot de passe est requis';
      else if (formData.password.length < 6) errors.password = 'Au moins 6 caractères';
    }
    if (!formData.role) errors.role = 'Le rôle est requis';
    if (requiresService(formData.role) && !formData.serviceId) {
      errors.serviceId = 'Un technicien doit être affecté à un service';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    setFormError('');
    try {
      // `null` et non `''` : le serveur attend un UUID ou l'absence de valeur.
      // Le backend remet de toute facon l'affectation a null pour un role non
      // technique, mais l'envoyer explicitement evite un aller-retour inutile.
      const serviceId = SERVICE_ROLES.includes(formData.role)
        ? (formData.serviceId || null)
        : null;

      if (formDialog.editing) {
        await api.put(`/users/${formDialog.editing.id}`, {
          email: formData.email,
          firstName: formData.firstName,
          lastName: formData.lastName,
          role: formData.role,
          phone: formData.phone || null,
          serviceId
        });
        notify('Utilisateur mis à jour');
      } else {
        await api.post('/users', { ...formData, serviceId });
        notify('Utilisateur créé avec succès');
      }
      setFormDialog({ open: false, editing: null });
      fetchUsers();
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

  const handleToggleStatus = async (u) => {
    try {
      await api.patch(`/users/${u.id}/status`, { isActive: !u.isActive });
      notify(u.isActive ? 'Utilisateur désactivé' : 'Utilisateur activé');
      fetchUsers();
    } catch (err) {
      notify(err.response?.data?.error || 'Erreur lors du changement de statut', 'error');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/users/${passwordDialog.user.id}/reset-password`, {
        password: newPassword
      });
      notify('Mot de passe réinitialisé');
      setPasswordDialog({ open: false, user: null });
      setNewPassword('');
      setPasswordError('');
    } catch (err) {
      setPasswordError(err.response?.data?.error || 'Erreur lors de la réinitialisation');
    } finally {
      setSaving(false);
    }
  };

  const cardStyle = {
    elevation: 0,
    sx: {
      borderRadius: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      height: '100%',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 30px rgba(0,0,0,0.08)' }
    }
  };

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  return (
    <Box>
      {/* Statistiques */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#e3f2fd', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <GroupIcon sx={{ fontSize: 32, color: '#1976d2' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{stats.total}</Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    Comptes au total
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#e8f5e9', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <ActiveIcon sx={{ fontSize: 32, color: '#2e7d32' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{stats.active}</Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    Comptes actifs
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#ffebee', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <InactiveIcon sx={{ fontSize: 32, color: '#d32f2f' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{stats.inactive}</Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    Comptes désactivés
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight="bold">Comptes utilisateurs</Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => fetchUsers()}
              disabled={loading}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', color: 'text.secondary' }}
            >
              Actualiser
            </Button>
            <Button
              variant="contained"
              startIcon={<AddUserIcon />}
              onClick={openCreate}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
            >
              Nouvel Utilisateur
            </Button>
          </Box>
        </Box>

        {/* Filtres */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Rechercher par nom ou email..."
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
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <InputLabel>Rôle</InputLabel>
            <Select
              value={filters.role}
              label="Rôle"
              onChange={(e) => handleFilterChange('role', e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="">Tous</MenuItem>
              {ROLES.map((r) => (
                <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
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
              <MenuItem value="false">Désactivés</MenuItem>
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
                  <TableCell sx={{ fontWeight: 'bold' }}>Nom complet</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Rôle</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Téléphone</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Box sx={{ py: 6 }}>
                        <NoUserIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                        <Typography color="textSecondary">
                          {hasActiveFilters
                            ? 'Aucun utilisateur ne correspond aux filtres'
                            : 'Aucun utilisateur enregistré'}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => {
                    const role = getRole(u.role);
                    const isSelf = currentUser?.id === u.id;
                    return (
                      <TableRow key={u.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {u.lastName} {u.firstName}
                            {isSelf && (
                              <Chip label="Vous" size="small" sx={{ ml: 1, fontWeight: 'bold', bgcolor: '#e3f2fd' }} />
                            )}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{u.email}</TableCell>
                        <TableCell>
                          <Chip label={role.label} color={role.color} size="small" sx={{ fontWeight: 'bold' }} />
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{u.phone || '—'}</TableCell>
                        <TableCell>
                          <Chip
                            label={u.isActive ? 'Actif' : 'Désactivé'}
                            color={u.isActive ? 'success' : 'default'}
                            size="small"
                            variant={u.isActive ? 'filled' : 'outlined'}
                            sx={{ fontWeight: 'bold' }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Modifier" arrow>
                            <IconButton
                              size="small"
                              onClick={() => openEdit(u)}
                              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: '#e3f2fd' } }}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Réinitialiser le mot de passe" arrow>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setPasswordDialog({ open: true, user: u });
                                setNewPassword('');
                                setPasswordError('');
                              }}
                              sx={{ ml: 0.5, color: 'text.secondary', '&:hover': { color: 'warning.main', bgcolor: '#fff3e0' } }}
                            >
                              <ResetPasswordIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip
                            title={isSelf ? 'Action impossible sur votre propre compte' : (u.isActive ? 'Désactiver' : 'Activer')}
                            arrow
                          >
                            <span>
                              <Switch
                                size="small"
                                checked={u.isActive}
                                disabled={isSelf}
                                onChange={() => handleToggleStatus(u)}
                                sx={{ ml: 0.5 }}
                              />
                            </span>
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
          {formDialog.editing ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}
        </DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{formError}</Alert>}
          <Grid container spacing={2.5} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Nom"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                error={Boolean(formErrors.lastName)}
                helperText={formErrors.lastName}
                sx={inputStyle}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                required
                label="Prénom"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                error={Boolean(formErrors.firstName)}
                helperText={formErrors.firstName}
                sx={inputStyle}
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                required
                type="email"
                label="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={Boolean(formErrors.email)}
                helperText={formErrors.email}
                sx={inputStyle}
              />
            </Grid>
            {!formDialog.editing && (
              <Grid size={12}>
                <TextField
                  fullWidth
                  required
                  type="password"
                  label="Mot de passe initial"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  error={Boolean(formErrors.password)}
                  helperText={formErrors.password || 'Au moins 6 caractères. À communiquer à l\'utilisateur.'}
                  sx={inputStyle}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth required error={Boolean(formErrors.role)}>
                <InputLabel>Rôle</InputLabel>
                <Select
                  value={formData.role}
                  label="Rôle"
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  sx={{ borderRadius: 2 }}
                >
                  {ROLES.map((r) => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Téléphone"
                placeholder="+228 90 00 00 00"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                sx={inputStyle}
              />
            </Grid>
            {SERVICE_ROLES.includes(formData.role) && (
              <Grid size={12}>
                <FormControl
                  fullWidth
                  required={requiresService(formData.role)}
                  error={Boolean(formErrors.serviceId)}
                >
                  <InputLabel>Service d'affectation</InputLabel>
                  <Select
                    value={formData.serviceId}
                    label="Service d'affectation"
                    onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                    sx={{ borderRadius: 2 }}
                  >
                    {!requiresService(formData.role) && (
                      <MenuItem value="">
                        <em>Aucun (périmètre déduit du rôle)</em>
                      </MenuItem>
                    )}
                    {services.map((s) => (
                      <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    {formErrors.serviceId
                      || (requiresService(formData.role)
                        ? 'Détermine les examens que ce compte pourra traiter.'
                        : 'Facultatif : ce rôle a un périmètre par défaut.')}
                  </FormHelperText>
                </FormControl>
              </Grid>
            )}
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

      {/* Dialogue reinitialisation de mot de passe */}
      <Dialog
        open={passwordDialog.open}
        onClose={() => !saving && setPasswordDialog({ open: false, user: null })}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold', pt: 3 }}>Réinitialiser le mot de passe</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
            Définir un nouveau mot de passe pour{' '}
            <Box component="span" fontWeight="bold">
              {passwordDialog.user?.lastName} {passwordDialog.user?.firstName}
            </Box>
            . Il devra lui être communiqué directement.
          </Typography>
          {passwordError && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{passwordError}</Alert>}
          <TextField
            fullWidth
            required
            autoFocus
            type="password"
            label="Nouveau mot de passe"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helperText="Au moins 6 caractères"
            sx={inputStyle}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
          <Button
            onClick={() => setPasswordDialog({ open: false, user: null })}
            disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleResetPassword}
            disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
          >
            {saving ? 'En cours...' : 'Réinitialiser'}
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

export default UserManagement;
