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
  QrCodeScannerRounded as ScanIcon,
  ListAltRounded as ListIcon,
  AssignmentRounded as MyExamsIcon,
  HourglassEmptyRounded as PendingIcon,
  PlayCircleRounded as InProgressIcon,
  CheckCircleRounded as CompletedIcon,
  RefreshRounded as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import QRScanner from './QRScanner';
import ExamQueue from './ExamQueue';
import PatientExamCard from './PatientExamCard';
import ResultUpload from './ResultUpload';
import ResultsViewer from './ResultsViewer';
import ExamSteps from './ExamSteps';

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
  const [uploadDialog, setUploadDialog] = useState({ open: false, examId: null, examName: '' });
  const [viewResultsDialog, setViewResultsDialog] = useState({ open: false, examId: null, examName: '' });
  const [stepsDialog, setStepsDialog] = useState({ open: false, examId: null, examName: '', patientName: '' });

  // Nom du service d'affectation ; repli sur le role pour les comptes qui
  // n'ont pas encore de service rattache.
  const serviceName = user?.service?.name
    || (user?.role === 'RADIOLOGIST' ? 'Radiologie' : 'Laboratoire');

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
      showSnackbar('Patient trouvé avec succès', 'success');
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
      showSnackbar('Examen démarré avec succès', 'success');

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
      showSnackbar(error.response?.data?.error || 'Erreur lors du démarrage', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteExam = async (examId) => {
    setLoading(true);
    try {
      const response = await api.patch(`/services/exams/${examId}/complete`);
      showSnackbar('Examen terminé avec succès', 'success');

      if (response.data.prescriptionCompleted) {
        showSnackbar('Tous les examens de la prescription sont terminés !', 'info');
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
      showSnackbar(error.response?.data?.error || 'Erreur lors de la complétion', 'error');
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

  const handleUploadResult = (examId, examName) => {
    setUploadDialog({ open: true, examId, examName });
  };

  const handleViewResults = (examId, examName) => {
    setViewResultsDialog({ open: true, examId, examName });
  };

  const handleShowSteps = (exam) => {
    setStepsDialog({
      open: true,
      examId: exam.id,
      examName: exam.examName || exam.name,
      patientName: exam.patientName || ''
    });
  };

  const handleUploadSuccess = () => {
    showSnackbar('Résultat téléversé avec succès', 'success');
    fetchData();
  };

  // Styles partagés pour les cartes statistiques
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

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      {/* En-tete */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Service {serviceName}
          </Typography>
          <Typography variant="body1" color="textSecondary">
            Bienvenue, {user?.firstName} {user?.lastName} 👋
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          disabled={loading}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
        >
          Actualiser
        </Button>
      </Box>

      {/* Statistiques Modernisées */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#fff3e0', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <PendingIcon sx={{ fontSize: 32, color: '#ed6c02' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">
                    {stats.summary.pending}
                  </Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    En attente
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#e3f2fd', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <InProgressIcon sx={{ fontSize: 32, color: '#1976d2' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">
                    {stats.summary.inProgress}
                  </Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    En cours
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#e8f5e9', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <CompletedIcon sx={{ fontSize: 32, color: '#2e7d32' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">
                    {stats.summary.myCompletedToday}
                  </Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    Mes terminés (aujourd'hui)
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Onglets */}
      <Paper elevation={0} sx={{ mb: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{
            px: 2,
            pt: 1,
            '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minHeight: 60, fontSize: '1rem' }
          }}
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
          <Grid size={{ xs: 12, md: 5 }}>
            <QRScanner
              onScanSuccess={handleScanSuccess}
              onScanError={(err) => showSnackbar(err, 'error')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 7 }}>
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
              <Paper
                elevation={0}
                sx={{
                  p: 5,
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 4,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                }}
              >
                <Box>
                  <Box sx={{ bgcolor: '#f8fafc', width: 96, height: 96, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', mb: 3 }}>
                    <ScanIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
                  </Box>
                  <Typography color="textSecondary" variant="h6" fontWeight="bold">
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
          onViewResults={handleViewResults}
          onShowSteps={handleShowSteps}
          loading={loading}
        />
      )}

      {activeTab === 2 && (
        <ExamQueue
          title="Examens en cours"
          exams={inProgressExams}
          onCompleteExam={handleCompleteExam}
          onUploadResult={handleUploadResult}
          onViewResults={handleViewResults}
          onShowSteps={handleShowSteps}
          onRefresh={fetchInProgressExams}
          loading={loading}
        />
      )}

      {activeTab === 3 && (
        <ExamQueue
          title="Mes examens"
          exams={myExams}
          onCompleteExam={handleCompleteExam}
          onUploadResult={handleUploadResult}
          onViewResults={handleViewResults}
          onShowSteps={handleShowSteps}
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
          sx={{ borderRadius: 2, fontWeight: 'bold' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Dialog d'upload de resultat */}
      <ResultUpload
        open={uploadDialog.open}
        onClose={() => setUploadDialog({ open: false, examId: null, examName: '' })}
        prescriptionExamId={uploadDialog.examId}
        examName={uploadDialog.examName}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* Circuit de realisation configure pour le service */}
      <ExamSteps
        open={stepsDialog.open}
        onClose={() => setStepsDialog({ open: false, examId: null, examName: '', patientName: '' })}
        examId={stepsDialog.examId}
        examName={stepsDialog.examName}
        patientName={stepsDialog.patientName}
        onCompleted={() => {
          showSnackbar('Examen clôturé par l\'étape finale', 'success');
          fetchData();
        }}
      />

      {/* Dialog de visualisation des resultats */}
      <ResultsViewer
        open={viewResultsDialog.open}
        onClose={() => setViewResultsDialog({ open: false, examId: null, examName: '' })}
        prescriptionExamId={viewResultsDialog.examId}
        examName={viewResultsDialog.examName}
      />
    </Container>
  );
};

export default ServiceDashboard;
