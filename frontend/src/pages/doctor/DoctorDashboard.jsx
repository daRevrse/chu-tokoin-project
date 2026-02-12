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
  PersonSearch as PersonSearchIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  Folder as FolderIcon,
  PersonAdd as PersonAddIcon,
  Today as TodayIcon,
  HourglassEmpty as PendingIcon,
  ListAlt as TotalIcon,
  FactCheck as ValidateIcon,
  FilterList as FilterIcon,
  Clear as ClearIcon,
  Search as SearchIcon
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
      PAID: 'Payee',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminee',
      CANCELLED: 'Annulee'
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

  // Show PrescriptionDetail as a full view
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

  // Show PatientForm in edit mode
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

  // Show PatientForm as a full view
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

  // Show PrescriptionForm as a full view
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
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Tableau de Bord Medecin
        </Typography>
        <Typography color="textSecondary">
          Bienvenue, Dr. {user?.lastName} {user?.firstName}
        </Typography>
      </Box>

      {/* Statistiques */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: 4, borderColor: 'primary.main' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TodayIcon color="primary" sx={{ fontSize: 40 }} />
              <Box>
                <Typography color="textSecondary" variant="body2">
                  Prescriptions Aujourd'hui
                </Typography>
                <Typography variant="h3" color="primary">
                  {stats.today.prescriptions}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: 4, borderColor: 'warning.main' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <PendingIcon color="warning" sx={{ fontSize: 40 }} />
              <Box>
                <Typography color="textSecondary" variant="body2">
                  En Attente de Paiement
                </Typography>
                <Typography variant="h3" color="warning.main">
                  {stats.pending.prescriptions}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: 4, borderColor: 'info.main' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ValidateIcon color="info" sx={{ fontSize: 40 }} />
              <Box>
                <Typography color="textSecondary" variant="body2">
                  Resultats a Valider
                </Typography>
                <Typography variant="h3" color="info.main">
                  {stats.newResultsCount}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: 4, borderColor: 'success.main' }}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TotalIcon color="success" sx={{ fontSize: 40 }} />
              <Box>
                <Typography color="textSecondary" variant="body2">
                  Patients Distincts
                </Typography>
                <Typography variant="h3" color="success.main">
                  {stats.totals.patients}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Onglets */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab
            icon={<PersonSearchIcon />}
            label="Rechercher Patient"
            iconPosition="start"
          />
          <Tab
            icon={<AssignmentIcon />}
            label="Mes Prescriptions"
            iconPosition="start"
          />
          <Tab
            icon={<FolderIcon />}
            label="Dossiers Patients"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Contenu des onglets */}
      {activeTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Rechercher un Patient</Typography>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => setShowPatientForm(true)}
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
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Mes Prescriptions
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setActiveTab(0)}
            >
              Nouvelle Prescription
            </Button>
          </Box>

          {/* Filtres */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <FilterIcon color="action" />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Statut</InputLabel>
              <Select
                value={filters.status}
                label="Statut"
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="PENDING">En attente</MenuItem>
                <MenuItem value="PAID">Payee</MenuItem>
                <MenuItem value="IN_PROGRESS">En cours</MenuItem>
                <MenuItem value="COMPLETED">Terminee</MenuItem>
                <MenuItem value="CANCELLED">Annulee</MenuItem>
              </Select>
            </FormControl>
            <TextField
              size="small"
              type="date"
              label="Du"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
            />
            <TextField
              size="small"
              type="date"
              label="Au"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ width: 160 }}
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
              sx={{ width: 200 }}
            />
            {hasActiveFilters && (
              <Button
                size="small"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
              >
                Effacer
              </Button>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>N° Prescription</TableCell>
                      <TableCell>Patient</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Examens</TableCell>
                      <TableCell>Montant</TableCell>
                      <TableCell>Statut</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prescriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align="center">
                          <Box sx={{ py: 4 }}>
                            <AssignmentIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                            <Typography color="textSecondary">
                              {hasActiveFilters
                                ? 'Aucune prescription ne correspond aux filtres'
                                : 'Aucune prescription trouvee'}
                            </Typography>
                            {!hasActiveFilters && (
                              <Button
                                variant="outlined"
                                size="small"
                                sx={{ mt: 1 }}
                                onClick={() => setActiveTab(0)}
                              >
                                Creer une prescription
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
                          sx={{ cursor: 'pointer' }}
                          onClick={() => setSelectedPrescriptionId(prescription.id)}
                        >
                          <TableCell>
                            <Chip
                              label={prescription.prescriptionNumber}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight="medium">
                              {prescription.patient?.lastName} {prescription.patient?.firstName}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {prescription.patient?.patientNumber}
                            </Typography>
                          </TableCell>
                          <TableCell>{formatDate(prescription.createdAt)}</TableCell>
                          <TableCell>
                            {prescription.prescriptionExams?.length || 0} examen(s)
                          </TableCell>
                          <TableCell>
                            <Typography fontWeight="medium" color="primary">
                              {formatPrice(prescription.totalAmount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={getStatusLabel(prescription.status)}
                              color={getStatusColor(prescription.status)}
                              size="small"
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
                labelRowsPerPage="Lignes par page"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
              />
            </>
          )}
        </Paper>
      )}

      {activeTab === 2 && (
        <PatientRecord initialPatient={selectedPatient} />
      )}
    </Container>
  );
};

export default DoctorDashboard;
