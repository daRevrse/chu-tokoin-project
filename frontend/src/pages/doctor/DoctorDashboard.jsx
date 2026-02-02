import React, { useState, useEffect } from 'react';
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
  Button
} from '@mui/material';
import {
  PersonSearch as PersonSearchIcon,
  Assignment as AssignmentIcon,
  Add as AddIcon,
  Folder as FolderIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PatientSearch from './PatientSearch';
import PrescriptionForm from './PrescriptionForm';
import PatientRecord from './PatientRecord';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [recentPrescriptions, setRecentPrescriptions] = useState([]);
  const [stats, setStats] = useState({
    todayPrescriptions: 0,
    pendingPrescriptions: 0,
    totalPatients: 0
  });

  useEffect(() => {
    fetchRecentPrescriptions();
    fetchStats();
  }, []);

  const fetchRecentPrescriptions = async () => {
    try {
      const response = await api.get('/prescriptions/my-prescriptions');
      setRecentPrescriptions(response.data.prescriptions || []);
    } catch (error) {
      console.error('Erreur chargement prescriptions:', error);
    }
  };

  const fetchStats = async () => {
    try {
      // Dans une vraie app, on aurait une route stats dediee
      const response = await api.get('/prescriptions/my-prescriptions');
      const prescriptions = response.data.prescriptions || [];

      const today = new Date().toDateString();
      const todayPrescriptions = prescriptions.filter(
        p => new Date(p.createdAt).toDateString() === today
      ).length;

      const pendingPrescriptions = prescriptions.filter(
        p => p.status === 'PENDING'
      ).length;

      setStats({
        todayPrescriptions,
        pendingPrescriptions,
        totalPatients: prescriptions.length
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
        <Grid item xs={12} sm={4}>
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
        <Grid item xs={12} sm={4}>
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
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Prescriptions
              </Typography>
              <Typography variant="h3" color="success.main">
                {recentPrescriptions.length}
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
          <PatientSearch
            onSelectPatient={setSelectedPatient}
            onCreatePrescription={handleCreatePrescription}
          />
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Mes Prescriptions Recentes
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setActiveTab(0)}
            >
              Nouvelle Prescription
            </Button>
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
                    <TableRow key={prescription.id} hover>
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
        </Paper>
      )}

      {activeTab === 2 && (
        <PatientRecord />
      )}
    </Container>
  );
};

export default DoctorDashboard;
