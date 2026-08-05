import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  Button,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment
} from '@mui/material';
import {
  PersonSearchRounded as PersonSearchIcon,
  AssignmentRounded as AssignmentIcon,
  AddRounded as AddIcon,
  FolderRounded as FolderIcon,
  PersonAddRounded as PersonAddIcon,
  TodayRounded as TodayIcon,
  HourglassEmptyRounded as PendingIcon,
  ListAltRounded as TotalIcon,
  FactCheckRounded as ValidateIcon,
  FilterListRounded as FilterIcon,
  ClearRounded as ClearIcon,
  SearchRounded as SearchIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PatientSearch from './PatientSearch';
import PatientForm from './PatientForm';
import PrescriptionForm from './PrescriptionForm';
import PatientRecord from './PatientRecord';
import PrescriptionDetail from './PrescriptionDetail';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState(null);
  const [stats, setStats] = useState({
    today: { prescriptions: 0, patients: 0 },
    pending: { prescriptions: 0, awaitingResults: 0 },
    totals: { prescriptions: 0, patients: 0 },
    newResultsCount: 0
  });

  // Filters
  const [filters, setFilters] = useState({
    status: '',
    startDate: '',
    endDate: '',
    patientSearch: ''
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchPrescriptions();
    fetchStats();
  }, []);

  const fetchPrescriptions = useCallback(async (filterOverrides = {}, pageNum = page, perPage = rowsPerPage) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const activeFilters = { ...filters, ...filterOverrides };

      params.set('page', pageNum + 1); // API is 1-indexed
      params.set('limit', perPage);

      if (activeFilters.status) params.set('status', activeFilters.status);
      if (activeFilters.startDate) params.set('startDate', activeFilters.startDate);
      if (activeFilters.endDate) params.set('endDate', activeFilters.endDate);
      if (activeFilters.patientSearch) params.set('patientSearch', activeFilters.patientSearch);

      const response = await api.get(`/prescriptions/my-prescriptions?${params.toString()}`);
      setPrescriptions(response.data.prescriptions || []);
      setTotalCount(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Erreur chargement prescriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, page, rowsPerPage]);

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats/doctor');
      setStats(response.data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    setPage(0);
    fetchPrescriptions(newFilters, 0);
  };

  const handleClearFilters = () => {
    const emptyFilters = { status: '', startDate: '', endDate: '', patientSearch: '' };
    setFilters(emptyFilters);
    setPage(0);
    fetchPrescriptions(emptyFilters, 0);
  };

  const handlePageChange = (event, newPage) => {
    setPage(newPage);
    fetchPrescriptions({}, newPage);
  };

  const handleRowsPerPageChange = (event) => {
    const newPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newPerPage);
    setPage(0);
    fetchPrescriptions({}, 0, newPerPage);
  };

  const hasActiveFilters = filters.status || filters.startDate || filters.endDate || filters.patientSearch;

  const handleCreatePrescription = (patient) => {
    setSelectedPatient(patient);
    setShowPrescriptionForm(true);
  };

  const handlePrescriptionSuccess = () => {
    setShowPrescriptionForm(false);
    setSelectedPatient(null);
    fetchPrescriptions();
    fetchStats();
    setActiveTab(1);
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setActiveTab(2);
  };

  const handlePatientCreated = (patient) => {
    setShowPatientForm(false);
    setSelectedPatient(patient);
    setShowPrescriptionForm(true);
  };

  const handleEditPatient = (patient) => {
    setEditingPatient(patient);
  };

  const handlePatientUpdated = () => {
    setEditingPatient(null);
  };

  const getStatusColor = (status) => {
    const colors = {
      PENDING: 'warning',
      PAID: 'info',
      IN_PROGRESS: 'primary',
      COMPLETED: 'success',
      CANCELLED: 'error'
    };
    return colors[status] || 'default';
  };

  const getStatusLabel = (status) => {
    const labels = {
      PENDING: 'En attente',
      PAID: 'Payée',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminée',
      CANCELLED: 'Annulée'
    };
    return labels[status] || status;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Styles communs pour les cartes
  const cardStyle = {
    elevation: 0,
    sx: {
      borderRadius: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      height: '100%',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 12px 30px rgba(0,0,0,0.08)'
      }
    }
  };

  // Vues conditionnelles
  if (selectedPrescriptionId) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PrescriptionDetail
          prescriptionId={selectedPrescriptionId}
          onBack={() => setSelectedPrescriptionId(null)}
          onRefresh={() => {
            fetchPrescriptions();
            fetchStats();
          }}
        />
      </Container>
    );
  }

  if (editingPatient) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PatientForm
          patient={editingPatient}
          onBack={() => setEditingPatient(null)}
          onSuccess={handlePatientUpdated}
        />
      </Container>
    );
  }

  if (showPatientForm) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PatientForm
          onBack={() => setShowPatientForm(false)}
          onSuccess={handlePatientCreated}
        />
      </Container>
    );
  }

  if (showPrescriptionForm && selectedPatient) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PrescriptionForm
          patient={selectedPatient}
          onBack={() => {
            setShowPrescriptionForm(false);
            setSelectedPatient(null);
          }}
          onSuccess={handlePrescriptionSuccess}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Espace Médecin
        </Typography>
        {/* <Typography variant="body1" color="textSecondary">
          Bienvenue, Dr. {user?.lastName} {user?.firstName}
        </Typography> */}
      </Box>

      {/* Statistiques Modernisées */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card {...cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ bgcolor: '#e3f2fd', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <TodayIcon sx={{ fontSize: 32, color: '#1976d2' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="textPrimary">
                  {stats.today.prescriptions}
                </Typography>
                <Typography color="textSecondary" variant="body2" fontWeight="medium">
                  Prescriptions (Aujourd'hui)
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card {...cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ bgcolor: '#fff3e0', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <PendingIcon sx={{ fontSize: 32, color: '#ed6c02' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="textPrimary">
                  {stats.pending.prescriptions}
                </Typography>
                <Typography color="textSecondary" variant="body2" fontWeight="medium">
                  En Attente de Paiement
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card {...cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ bgcolor: '#e8f5e9', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <ValidateIcon sx={{ fontSize: 32, color: '#2e7d32' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="textPrimary">
                  {stats.newResultsCount}
                </Typography>
                <Typography color="textSecondary" variant="body2" fontWeight="medium">
                  Résultats à Valider
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card {...cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ bgcolor: '#f3e5f5', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <TotalIcon sx={{ fontSize: 32, color: '#9c27b0' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="textPrimary">
                  {stats.totals.patients}
                </Typography>
                <Typography color="textSecondary" variant="body2" fontWeight="medium">
                  Patients Distincts
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Onglets */}
      <Paper elevation={0} sx={{ mb: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
          sx={{
            px: 2,
            pt: 1,
            '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minHeight: 60, fontSize: '1rem' }
          }}
        >
          <Tab icon={<PersonSearchIcon />} label="Rechercher Patient" iconPosition="start" />
          <Tab icon={<AssignmentIcon />} label="Mes Prescriptions" iconPosition="start" />
          <Tab icon={<FolderIcon />} label="Dossiers Patients" iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Contenu des onglets */}
      {activeTab === 0 && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            {/* <Typography variant="h6" fontWeight="bold">Rechercher un Patient</Typography> */}
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => setShowPatientForm(true)}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Nouveau Patient
            </Button>
          </Box>
          <PatientSearch
            onSelectPatient={handleSelectPatient}
            onCreatePrescription={handleCreatePrescription}
            onEditPatient={handleEditPatient}
          />
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6" fontWeight="bold">
              Mes Prescriptions
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setActiveTab(0)}
              sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
            >
              Nouvelle Prescription
            </Button>
          </Box>

          {/* Filtres */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ bgcolor: '#f5f7fb', p: 1, borderRadius: 2, display: 'flex' }}>
              <FilterIcon color="action" />
            </Box>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Statut</InputLabel>
              <Select
                value={filters.status}
                label="Statut"
                onChange={(e) => handleFilterChange('status', e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="PENDING">En attente</MenuItem>
                <MenuItem value="PAID">Payée</MenuItem>
                <MenuItem value="IN_PROGRESS">En cours</MenuItem>
                <MenuItem value="COMPLETED">Terminée</MenuItem>
                <MenuItem value="CANCELLED">Annulée</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="date"
              label="Du"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              size="small"
              type="date"
              label="Au"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              size="small"
              placeholder="Rechercher patient..."
              value={filters.patientSearch}
              onChange={(e) => handleFilterChange('patientSearch', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
              sx={{ width: 220, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
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
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <Table>
                  <TableHead sx={{ bgcolor: '#f8fafc' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>N° Prescription</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Examens</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Montant</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prescriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Box sx={{ py: 6 }}>
                            <AssignmentIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                            <Typography color="textSecondary">
                              {hasActiveFilters
                                ? 'Aucune prescription ne correspond aux filtres'
                                : 'Aucune prescription trouvée'}
                            </Typography>
                            {!hasActiveFilters && (
                              <Button
                                variant="outlined"
                                size="small"
                                sx={{ mt: 2, borderRadius: 2, textTransform: 'none' }}
                                onClick={() => setActiveTab(0)}
                              >
                                Créer une prescription
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : (
                      prescriptions.map((prescription) => (
                        <TableRow
                          key={prescription.id}
                          hover
                          sx={{ cursor: 'pointer', '&:last-child td, &:last-child th': { border: 0 } }}
                          onClick={() => setSelectedPrescriptionId(prescription.id)}
                        >
                          <TableCell>
                            <Chip
                              label={prescription.prescriptionNumber}
                              size="small"
                              color="primary"
                              variant="outlined"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight="bold" variant="body2">
                              {prescription.patient?.lastName} {prescription.patient?.firstName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {prescription.patient?.patientNumber}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{formatDate(prescription.createdAt)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={`${prescription.prescriptionExams?.length || 0} examen(s)`} />
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight="bold" color="primary">
                              {formatPrice(prescription.totalAmount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusLabel(prescription.status)}
                              color={getStatusColor(prescription.status)}
                              size="small"
                              sx={{ fontWeight: 'bold' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={handlePageChange}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[10, 20, 50]}
                labelRowsPerPage="Lignes par page :"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
                sx={{ mt: 2 }}
              />
            </>
          )}
        </Paper>
      )}

      {activeTab === 2 && (
        <Box sx={{ mt: 2 }}>
          <PatientRecord initialPatient={selectedPatient} />
        </Box>
      )}
    </Container>
  );
};

export default DoctorDashboard;