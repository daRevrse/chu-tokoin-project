import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from '@mui/material';
import {
  ArrowBackRounded as BackIcon,
  CancelRounded as CancelIcon,
  DownloadRounded as DownloadIcon,
  CheckCircleRounded as ValidatedIcon,
  PictureAsPdfRounded as PdfIcon,
  ImageRounded as ImageIcon,
  DescriptionRounded as FileIcon,
  PersonRounded as PersonIcon,
  CalendarTodayRounded as DateIcon,
  PaymentRounded as PaymentIcon,
  PrintRounded as PrintIcon,
  ScienceRounded as ExamIcon,
  FactCheckRounded as ResultIcon
} from '@mui/icons-material';
import api from '../../services/api';

// Libelle du service realisant l'examen. Repli sur l'ancienne categorie pour
// les examens qui ne sont pas encore rattaches a un service.
const getServiceLabel = (exam) => {
  if (exam?.service?.name) return exam.service.name;
  return exam?.category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire';
};

const getServiceColor = (exam) => {
  if (exam?.service?.color) return exam.service.color;
  return exam?.category === 'RADIOLOGY' ? '#0288d1' : '#9c27b0';
};

const PrescriptionDetail = ({ prescriptionId, onBack, onRefresh }) => {
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [examResults, setExamResults] = useState({});
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => {
    if (prescriptionId) {
      fetchPrescription();
    }
  }, [prescriptionId]);

  const fetchPrescription = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/prescriptions/${prescriptionId}`);
      setPrescription(response.data.prescription);

      // Fetch results for each exam
      const exams = response.data.prescription.prescriptionExams || [];
      const resultsMap = {};
      await Promise.all(
        exams.map(async (pe) => {
          try {
            const resResponse = await api.get(`/results/exam/${pe.id}`);
            resultsMap[pe.id] = resResponse.data.results || [];
          } catch {
            resultsMap[pe.id] = [];
          }
        })
      );
      setExamResults(resultsMap);
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur lors du chargement', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await api.patch(`/prescriptions/${prescriptionId}/cancel`);
      showSnackbar('Prescription annulée avec succès', 'success');
      setCancelDialog(false);
      fetchPrescription();
      if (onRefresh) onRefresh();
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur lors de l\'annulation', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const handleDownloadResult = async (resultId, fileName) => {
    try {
      const response = await api.get(`/results/${resultId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showSnackbar('Erreur lors du téléchargement', 'error');
    }
  };

  const handleValidateResult = async (resultId, peId) => {
    try {
      await api.patch(`/results/${resultId}/validate`);
      showSnackbar('Résultat validé avec succès', 'success');
      // Update local state
      setExamResults(prev => ({
        ...prev,
        [peId]: prev[peId].map(r =>
          r.id === resultId ? { ...r, isValidated: true, validatedAt: new Date().toISOString() } : r
        )
      }));
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur lors de la validation', 'error');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const response = await api.get(`/prescriptions/${prescriptionId}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `prescription-${prescription.prescriptionNumber}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showSnackbar('Erreur lors du téléchargement du PDF', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'PDF': return <PdfIcon sx={{ color: 'error.main' }} />;
      case 'IMAGE': return <ImageIcon sx={{ color: 'info.main' }} />;
      default: return <FileIcon sx={{ color: 'primary.main' }} />;
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!prescription) {
    return (
      <Alert severity="error" sx={{ borderRadius: 2 }}>Prescription non trouvée</Alert>
    );
  }

  // Styles partagés
  const paperStyle = {
    elevation: 0,
    sx: { p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Button
            startIcon={<BackIcon />}
            onClick={onBack}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
          >
            Retour
          </Button>
          <Typography variant="h5" fontWeight="bold">
            Prescription {prescription.prescriptionNumber}
          </Typography>
          <Chip
            label={getStatusLabel(prescription.status)}
            color={getStatusColor(prescription.status)}
            sx={{ fontWeight: 'bold' }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handleDownloadPdf}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
          >
            Imprimer PDF
          </Button>
          {prescription.status === 'PENDING' && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => setCancelDialog(true)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
            >
              Annuler
            </Button>
          )}
        </Box>
      </Box>

      {/* Patient & Doctor Info */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={0} sx={{ height: '100%', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ bgcolor: '#e3f2fd', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonIcon sx={{ fontSize: 22, color: '#1976d2' }} />
                </Box>
                <Typography variant="h6" fontWeight="bold">Patient</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Nom</Typography>
                  <Typography fontWeight="bold">
                    {prescription.patient?.lastName} {prescription.patient?.firstName}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">N° Patient</Typography>
                  <Typography fontWeight="bold">{prescription.patient?.patientNumber}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Téléphone</Typography>
                  <Typography fontWeight="bold">{prescription.patient?.phone || '-'}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Sexe</Typography>
                  <Typography fontWeight="bold">{prescription.patient?.gender === 'M' ? 'Homme' : 'Femme'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={0} sx={{ height: '100%', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ bgcolor: '#f3e5f5', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DateIcon sx={{ fontSize: 20, color: '#9c27b0' }} />
                </Box>
                <Typography variant="h6" fontWeight="bold">Informations</Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Date</Typography>
                  <Typography fontWeight="bold">{formatDate(prescription.createdAt)}</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Médecin</Typography>
                  <Typography fontWeight="bold">
                    Dr. {prescription.doctor?.lastName} {prescription.doctor?.firstName}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Montant Total</Typography>
                  <Typography fontWeight="bold" color="primary">
                    {formatPrice(prescription.totalAmount)}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Nb Examens</Typography>
                  <Typography fontWeight="bold">{prescription.prescriptionExams?.length || 0}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notes */}
      {prescription.notes && (
        <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mb: 1 }}>
            Notes / Observations
          </Typography>
          <Typography>{prescription.notes}</Typography>
        </Paper>
      )}

      {/* Examens */}
      <Paper {...paperStyle} sx={{ ...paperStyle.sx, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
          <ExamIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" fontWeight="bold">
            Examens Prescrits
          </Typography>
        </Box>
        <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Examen</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Catégorie</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Prix</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Réalisé par</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prescription.prescriptionExams?.map((pe) => (
                <TableRow key={pe.id} hover>
                  <TableCell>
                    <Chip label={pe.exam?.code} size="small" variant="outlined" sx={{ fontWeight: 'bold', bgcolor: '#f5f7fb' }} />
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight="bold" variant="body2">{pe.exam?.name}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getServiceLabel(pe.exam)}
                      size="small"
                      sx={{
                        fontWeight: 'bold',
                        bgcolor: `${getServiceColor(pe.exam)}22`,
                        color: getServiceColor(pe.exam)
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography fontWeight="bold" variant="body2">{formatPrice(pe.price)}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(pe.status)}
                      color={getStatusColor(pe.status)}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    {pe.performer
                      ? `${pe.performer.firstName} ${pe.performer.lastName}`
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow sx={{ bgcolor: '#f8fafc', '& td': { border: 0 } }}>
                <TableCell colSpan={3} />
                <TableCell align="right">
                  <Typography fontWeight="bold" color="primary">
                    Total : {formatPrice(prescription.totalAmount)}
                  </Typography>
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Resultats par examen */}
      {Object.entries(examResults).some(([, results]) => results.length > 0) && (
        <Paper {...paperStyle} sx={{ ...paperStyle.sx, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <ResultIcon sx={{ color: 'success.main' }} />
            <Typography variant="h6" fontWeight="bold">
              Résultats
            </Typography>
          </Box>
          {prescription.prescriptionExams?.map((pe, index) => {
            const results = examResults[pe.id] || [];
            if (results.length === 0) return null;

            return (
              <Box key={pe.id} sx={{ mb: 3 }}>
                {index > 0 && <Divider sx={{ mb: 3 }} />}
                <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1.5 }}>
                  {pe.exam?.name} ({pe.exam?.code})
                </Typography>
                {results.map((result) => (
                  <Box
                    key={result.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 2,
                      flexWrap: { xs: 'wrap', sm: 'nowrap' },
                      p: 2,
                      bgcolor: result.isValidated ? '#e8f5e9' : '#fff3e0',
                      border: '1px solid',
                      borderColor: result.isValidated ? '#c8e6c9' : '#ffe0b2',
                      borderRadius: 3,
                      mb: 1.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      {getFileIcon(result.fileType)}
                      <Box>
                        <Typography variant="body2" fontWeight="bold">{result.fileName}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          Par {result.uploader?.firstName} {result.uploader?.lastName} le {formatDate(result.uploadDate)}
                        </Typography>
                        {result.conclusion && (
                          <Typography variant="body2" sx={{ mt: 1 }}>
                            <Box component="span" fontWeight="bold">Conclusion : </Box>
                            {result.conclusion}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {result.isValidated ? (
                        <Chip icon={<ValidatedIcon />} label="Validé" size="small" color="success" sx={{ fontWeight: 'bold' }} />
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => handleValidateResult(result.id, pe.id)}
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
                        >
                          Valider
                        </Button>
                      )}
                      <Tooltip title="Télécharger" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadResult(result.id, result.fileName)}
                          sx={{ bgcolor: 'white', '&:hover': { bgcolor: '#e3f2fd' } }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
              </Box>
            );
          })}
        </Paper>
      )}

      {/* Paiements */}
      {prescription.payments && prescription.payments.length > 0 && (
        <Paper {...paperStyle}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
            <PaymentIcon sx={{ color: 'success.main' }} />
            <Typography variant="h6" fontWeight="bold">Paiements</Typography>
          </Box>
          <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Montant</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Mode</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Caissier</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prescription.payments.map((payment) => (
                  <TableRow key={payment.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>
                      <Typography fontWeight="bold" color="success.main" variant="body2">
                        {formatPrice(payment.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={payment.paymentMethod} size="small" variant="outlined" sx={{ bgcolor: '#f5f7fb' }} />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {payment.cashier
                        ? `${payment.cashier.firstName} ${payment.cashier.lastName}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={payment.paymentStatus === 'SUCCESS' ? 'Réussi' : payment.paymentStatus}
                        color={payment.paymentStatus === 'SUCCESS' ? 'success' : 'warning'}
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {/* Cancel Dialog */}
      <Dialog
        open={cancelDialog}
        onClose={() => setCancelDialog(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' } }}
      >
        <DialogTitle sx={{ fontWeight: 'bold' }}>Annuler la prescription</DialogTitle>
        <DialogContent>
          <Typography color="textSecondary">
            Êtes-vous sûr de vouloir annuler la prescription {prescription.prescriptionNumber} ?
            Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setCancelDialog(false)}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
          >
            Non
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={cancelling}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
          >
            {cancelling ? 'Annulation...' : 'Oui, annuler'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
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

export default PrescriptionDetail;
