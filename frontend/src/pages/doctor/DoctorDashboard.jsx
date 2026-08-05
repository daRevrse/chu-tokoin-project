import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Chip,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TablePagination,
  Alert,
  Snackbar,
  Skeleton,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  PersonSearch as PersonSearchIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  Folder as FolderIcon,
  PersonAdd as PersonAddIcon,
  PendingActions as PendingActionsIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PatientSearch from './PatientSearch';
import PrescriptionForm from './PrescriptionForm';
import PatientForm from './PatientForm';
import PatientRecord from './PatientRecord';
import PrescriptionDetail from './PrescriptionDetail';
import PendingResults from './PendingResults';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editPatient, setEditPatient] = useState(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState(null);
  const [recentPrescriptions, setRecentPrescriptions] = useState([]);
  const [stats, setStats] = useState({
    todayPrescriptions: 0,
    pendingPrescriptions: 0,
    totalPrescriptions: 0,
    resultsAwaitingValidation: 0
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Pagination et filtres
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [totalPrescriptions, setTotalPrescriptions] = useState(0);

  // Patient pre-selectionne pour l'onglet dossiers
  const [initialRecordPatient, setInitialRecordPatient] = useState(null);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchRecentPrescriptions();
  }, [statusFilter, page, rowsPerPage]);

  const fetchRecentPrescriptions = async () => {
    try {
      const params = new URLSearchParams();
      params.set('page', page + 1);
      params.set('limit', rowsPerPage);
      if (statusFilter) params.set('status', statusFilter);
      const response = await api.get(`/prescriptions/my-prescriptions?${params.toString()}`);
      setRecentPrescriptions(response.data.prescriptions || []);
      setTotalPrescriptions(response.data.pagination?.total || 0);
    } catch (error) {
      console.error('Erreur chargement prescriptions:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats/doctor');
      setStats({
        todayPrescriptions: response.data.todayPrescriptions || 0,
        pendingPrescriptions: response.data.pendingPrescriptions || 0,
        totalPrescriptions: response.data.totalPrescriptions || 0,
        resultsAwaitingValidation: response.data.resultsAwaitingValidation || 0
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const handleCreatePrescription = (patient) => {
    setSelectedPatient(patient);
    setShowPrescriptionForm(true);
  };

  const handlePrescriptionSuccess = () => {
    setShowPrescriptionForm(false);
    setSelectedPatient(null);
    fetchRecentPrescriptions();
    fetchStats();
    setActiveTab(1);
  };

  const handlePatientCreated = (patient) => {
    setShowPatientForm(false);
    setSnackbar({ open: true, message: 'Patient enregistre avec succes', severity: 'success' });
    handleCreatePrescription(patient);
  };

  const handleEditPatient = (patient) => {
    setEditPatient(patient);
    setShowPatientForm(true);
  };

  const handlePatientUpdated = () => {
    setShowPatientForm(false);
    setEditPatient(null);
    setSnackbar({ open: true, message: 'Patient mis a jour avec succes', severity: 'success' });
  };

  const handleViewPatientRecord = (patient) => {
    setInitialRecordPatient(patient);
    setActiveTab(2);
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

  // Affichage formulaire prescription
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

  // Affichage formulaire patient
  if (showPatientForm) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PatientForm
          patient={editPatient}
          onBack={() => {
            setShowPatientForm(false);
            setEditPatient(null);
          }}
          onSuccess={editPatient ? handlePatientUpdated : handlePatientCreated}
        />
      </Container>
    );
  }

  // Affichage detail prescription
  if (selectedPrescriptionId) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PrescriptionDetail
          prescriptionId={selectedPrescriptionId}
          onBack={() => setSelectedPrescriptionId(null)}
          onRefresh={() => {
            fetchRecentPrescriptions();
            fetchStats();
          }}
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
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Prescriptions Aujourd'hui
              </Typography>
              <Typography variant="h3" color="primary">
                {stats.todayPrescriptions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                En Attente de Paiement
              </Typography>
              <Typography variant="h3" color="warning.main">
                {stats.pendingPrescriptions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Prescriptions
              </Typography>
              <Typography variant="h3" color="success.main">
                {stats.totalPrescriptions}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => setActiveTab(3)}
          >
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Resultats a Valider
              </Typography>
              <Typography variant="h3" color="error.main">
                {stats.resultsAwaitingValidation}
              </Typography>
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
          variant="scrollable"
          scrollButtons="auto"
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
          <Tab
            icon={<PendingActionsIcon />}
            label="Resultats a Valider"
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
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setShowPatientForm(true)}
            >
              Nouveau Patient
            </Button>
          </Box>
          <PatientSearch
            onSelectPatient={setSelectedPatient}
            onCreatePrescription={handleCreatePrescription}
            onEditPatient={handleEditPatient}
            onViewRecord={handleViewPatientRecord}
          />
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Mes Prescriptions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={statusFilter}
                  label="Statut"
                  onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
                >
                  <MenuItem value="">Tous</MenuItem>
                  <MenuItem value="PENDING">En attente</MenuItem>
                  <MenuItem value="PAID">Payee</MenuItem>
                  <MenuItem value="IN_PROGRESS">En cours</MenuItem>
                  <MenuItem value="COMPLETED">Terminee</MenuItem>
                  <MenuItem value="CANCELLED">Annulee</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setActiveTab(0)}
              >
                Nouvelle Prescription
              </Button>
            </Box>
          </Box>

          <TableContainer>
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
                {recentPrescriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="textSecondary" sx={{ py: 3 }}>
                        Aucune prescription trouvee
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPrescriptions.map((prescription) => (
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
                        <Typography
                          fontWeight="medium"
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { textDecoration: 'underline', color: 'primary.main' }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (prescription.patient) handleViewPatientRecord(prescription.patient);
                          }}
                        >
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
            count={totalPrescriptions}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 20, 50]}
            labelRowsPerPage="Lignes par page"
            labelDisplayedRows={({ from, to, count }) => `${from}-${to} sur ${count}`}
          />
        </Paper>
      )}

      {activeTab === 2 && (
        <PatientRecord
          initialPatient={initialRecordPatient}
          onCreatePrescription={handleCreatePrescription}
        />
      )}

      {activeTab === 3 && (
        <PendingResults onRefresh={fetchStats} />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default DoctorDashboard;
