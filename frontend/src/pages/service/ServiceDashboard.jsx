import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Tabs,
  Tab,
  Box,
  Card,
  CardContent,
  Alert,
  Snackbar,
  Button
} from '@mui/material';
import {
  QrCodeScanner as ScanIcon,
  List as ListIcon,
  Assignment as MyExamsIcon,
  HourglassEmpty as PendingIcon,
  PlayCircle as InProgressIcon,
  CheckCircle as CompletedIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import QRScanner from './QRScanner';
import ExamQueue from './ExamQueue';
import PatientExamCard from './PatientExamCard';

const ServiceDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [pendingExams, setPendingExams] = useState([]);
  const [inProgressExams, setInProgressExams] = useState([]);
  const [myExams, setMyExams] = useState([]);
  const [scannedPatient, setScannedPatient] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const serviceName = user?.role === 'RADIOLOGIST' ? 'Radiologie' : 'Laboratoire';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([
      fetchPendingExams(),
      fetchInProgressExams(),
      fetchMyExams(),
      fetchStats()
    ]);
  };

  const fetchPendingExams = async () => {
    try {
      const response = await api.get('/services/pending');
      setPendingExams(response.data.exams || []);
    } catch (error) {
      console.error('Error fetching pending exams:', error);
    }
  };

  const fetchInProgressExams = async () => {
    try {
      const response = await api.get('/services/in-progress');
      setInProgressExams(response.data.exams || []);
    } catch (error) {
      console.error('Error fetching in-progress exams:', error);
    }
  };

  const fetchMyExams = async () => {
    try {
      const response = await api.get('/services/my-exams');
      setMyExams(response.data.exams || []);
    } catch (error) {
      console.error('Error fetching my exams:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/stats/service');
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleScanSuccess = async (qrData) => {
    setLoading(true);
    try {
      const response = await api.post('/services/verify-qr', { qrData });
      setScannedPatient(response.data);
      showSnackbar('Patient trouve avec succes', 'success');
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'QR code invalide ou erreur de lecture';
      showSnackbar(errorMsg, 'error');
      setScannedPatient(null);
    } finally {
      setLoading(false);
    }
  };

  const handleStartExam = async (examId) => {
    setLoading(true);
    try {
      await api.patch(`/services/exams/${examId}/start`);
      showSnackbar('Examen demarre avec succes', 'success');

      // Mettre a jour les listes
      fetchData();

      // Mettre a jour le patient scanne si present
      if (scannedPatient) {
        setScannedPatient(prev => ({
          ...prev,
          exams: prev.exams.map(e =>
            e.id === examId ? { ...e, status: 'IN_PROGRESS' } : e
          )
        }));
      }
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur lors du demarrage', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteExam = async (examId) => {
    setLoading(true);
    try {
      const response = await api.patch(`/services/exams/${examId}/complete`);
      showSnackbar('Examen termine avec succes', 'success');

      if (response.data.prescriptionCompleted) {
        showSnackbar('Tous les examens de la prescription sont termines!', 'info');
      }

      // Mettre a jour les listes
      fetchData();

      // Mettre a jour le patient scanne
      if (scannedPatient) {
        setScannedPatient(prev => ({
          ...prev,
          exams: prev.exams.map(e =>
            e.id === examId ? { ...e, status: 'COMPLETED' } : e
          )
        }));
      }
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur lors de la completion', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* En-tete */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Service {serviceName}
          </Typography>
          <Typography color="textSecondary">
            Bienvenue, {user?.firstName} {user?.lastName}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          disabled={loading}
        >
          Actualiser
        </Button>
      </Box>

      {/* Statistiques */}
      {stats && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: 'warning.light' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                <PendingIcon sx={{ fontSize: 48, color: 'warning.dark', mr: 2 }} />
                <Box>
                  <Typography variant="h3" color="warning.dark">
                    {stats.summary.pending}
                  </Typography>
                  <Typography color="warning.dark">En attente</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: 'info.light' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                <InProgressIcon sx={{ fontSize: 48, color: 'info.dark', mr: 2 }} />
                <Box>
                  <Typography variant="h3" color="info.dark">
                    {stats.summary.inProgress}
                  </Typography>
                  <Typography color="info.dark">En cours</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Card sx={{ bgcolor: 'success.light' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                <CompletedIcon sx={{ fontSize: 48, color: 'success.dark', mr: 2 }} />
                <Box>
                  <Typography variant="h3" color="success.dark">
                    {stats.summary.myCompletedToday}
                  </Typography>
                  <Typography color="success.dark">Mes termines (aujourd'hui)</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Onglets */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            icon={<ScanIcon />}
            label="Scanner QR"
            iconPosition="start"
          />
          <Tab
            icon={<ListIcon />}
            label={`File d'attente (${pendingExams.length})`}
            iconPosition="start"
          />
          <Tab
            icon={<InProgressIcon />}
            label={`En cours (${inProgressExams.length})`}
            iconPosition="start"
          />
          <Tab
            icon={<MyExamsIcon />}
            label="Mes examens"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Contenu des onglets */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <QRScanner
              onScanSuccess={handleScanSuccess}
              onScanError={(err) => showSnackbar(err, 'error')}
            />
          </Grid>
          <Grid item xs={12} md={7}>
            {scannedPatient ? (
              <PatientExamCard
                patient={scannedPatient.patient}
                prescriptionNumber={scannedPatient.prescriptionNumber}
                paymentNumber={scannedPatient.paymentNumber}
                paidAt={scannedPatient.paidAt}
                exams={scannedPatient.exams}
                onStartExam={handleStartExam}
                onCompleteExam={handleCompleteExam}
                loading={loading}
              />
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box>
                  <ScanIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                  <Typography color="textSecondary" variant="h6">
                    Scannez un QR code pour afficher les informations du patient
                  </Typography>
                </Box>
              </Paper>
            )}
          </Grid>
        </Grid>
      )}

      {activeTab === 1 && (
        <ExamQueue
          title="Examens en attente"
          exams={pendingExams}
          onStartExam={handleStartExam}
          onRefresh={fetchPendingExams}
          loading={loading}
        />
      )}

      {activeTab === 2 && (
        <ExamQueue
          title="Examens en cours"
          exams={inProgressExams}
          onCompleteExam={handleCompleteExam}
          onRefresh={fetchInProgressExams}
          loading={loading}
        />
      )}

      {activeTab === 3 && (
        <ExamQueue
          title="Mes examens"
          exams={myExams}
          onCompleteExam={handleCompleteExam}
          onRefresh={fetchMyExams}
          loading={loading}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleCloseSnackbar}
          severity={snackbar.severity}
          variant="filled"
          elevation={6}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ServiceDashboard;
