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
  ArrowBack as BackIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  CheckCircle as ValidatedIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as FileIcon,
  Person as PersonIcon,
  CalendarToday as DateIcon,
  Payment as PaymentIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import api from '../../services/api';

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
      showSnackbar('Prescription annulee avec succes', 'success');
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
      showSnackbar('Erreur lors du telechargement', 'error');
    }
  };

  const handleValidateResult = async (resultId, peId) => {
    try {
      await api.patch(`/results/${resultId}/validate`);
      showSnackbar('Resultat valide avec succes', 'success');
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
      showSnackbar('Erreur lors du telechargement du PDF', 'error');
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
      PAID: 'Payee',
      IN_PROGRESS: 'En cours',
      COMPLETED: 'Terminee',
      CANCELLED: 'Annulee'
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
      <Alert severity="error">Prescription non trouvee</Alert>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<BackIcon />} onClick={onBack}>
            Retour
          </Button>
          <Typography variant="h5">
            Prescription {prescription.prescriptionNumber}
          </Typography>
          <Chip
            label={getStatusLabel(prescription.status)}
            color={getStatusColor(prescription.status)}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handleDownloadPdf}
          >
            Imprimer PDF
          </Button>
          {prescription.status === 'PENDING' && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={() => setCancelDialog(true)}
            >
              Annuler
            </Button>
          )}
        </Box>
      </Box>

      {/* Patient & Doctor Info */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <PersonIcon color="primary" />
                <Typography variant="h6">Patient</Typography>
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Nom</Typography>
                  <Typography fontWeight="bold">
                    {prescription.patient?.lastName} {prescription.patient?.firstName}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">N° Patient</Typography>
                  <Typography>{prescription.patient?.patientNumber}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Telephone</Typography>
                  <Typography>{prescription.patient?.phone || '-'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Sexe</Typography>
                  <Typography>{prescription.patient?.gender === 'M' ? 'Homme' : 'Femme'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <DateIcon color="primary" />
                <Typography variant="h6">Informations</Typography>
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Date</Typography>
                  <Typography>{formatDate(prescription.createdAt)}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Medecin</Typography>
                  <Typography>
                    Dr. {prescription.doctor?.lastName} {prescription.doctor?.firstName}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Montant Total</Typography>
                  <Typography fontWeight="bold" color="primary">
                    {formatPrice(prescription.totalAmount)}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="textSecondary">Nb Examens</Typography>
                  <Typography>{prescription.prescriptionExams?.length || 0}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Notes */}
      {prescription.notes && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" color="textSecondary" gutterBottom>
            Notes / Observations
          </Typography>
          <Typography>{prescription.notes}</Typography>
        </Paper>
      )}

      {/* Examens */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Examens Prescrits
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Examen</TableCell>
                <TableCell>Categorie</TableCell>
                <TableCell align="right">Prix</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Realise par</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prescription.prescriptionExams?.map((pe) => (
                <TableRow key={pe.id}>
                  <TableCell>
                    <Chip label={pe.exam?.code} size="small" variant="outlined" />
                  </TableCell>
                  <TableCell>{pe.exam?.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={pe.exam?.category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire'}
                      size="small"
                      color={pe.exam?.category === 'RADIOLOGY' ? 'info' : 'secondary'}
                    />
                  </TableCell>
                  <TableCell align="right">{formatPrice(pe.price)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(pe.status)}
                      color={getStatusColor(pe.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {pe.performer
                      ? `${pe.performer.firstName} ${pe.performer.lastName}`
                      : '-'}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} />
                <TableCell align="right">
                  <Typography fontWeight="bold" color="primary">
                    Total: {formatPrice(prescription.totalAmount)}
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
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Resultats
          </Typography>
          {prescription.prescriptionExams?.map((pe) => {
            const results = examResults[pe.id] || [];
            if (results.length === 0) return null;

            return (
              <Box key={pe.id} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {pe.exam?.name} ({pe.exam?.code})
                </Typography>
                {results.map((result) => (
                  <Box
                    key={result.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      bgcolor: result.isValidated ? 'success.50' : 'warning.50',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getFileIcon(result.fileType)}
                      <Box>
                        <Typography variant="body2">{result.fileName}</Typography>
                        <Typography variant="caption" color="textSecondary">
                          Par {result.uploader?.firstName} {result.uploader?.lastName} le {formatDate(result.uploadDate)}
                        </Typography>
                        {result.conclusion && (
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            Conclusion: {result.conclusion}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {result.isValidated ? (
                        <Chip icon={<ValidatedIcon />} label="Valide" size="small" color="success" />
                      ) : (
                        <Button
                          size="small"
                          variant="contained"
                          color="success"
                          onClick={() => handleValidateResult(result.id, pe.id)}
                        >
                          Valider
                        </Button>
                      )}
                      <Tooltip title="Telecharger">
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadResult(result.id, result.fileName)}
                        >
                          <DownloadIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                ))}
                <Divider sx={{ mt: 1 }} />
              </Box>
            );
          })}
        </Paper>
      )}

      {/* Paiements */}
      {prescription.payments && prescription.payments.length > 0 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <PaymentIcon color="primary" />
            <Typography variant="h6">Paiements</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Montant</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell>Caissier</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {prescription.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.paymentDate)}</TableCell>
                    <TableCell>{formatPrice(payment.amount)}</TableCell>
                    <TableCell>{payment.paymentMethod}</TableCell>
                    <TableCell>
                      {payment.cashier
                        ? `${payment.cashier.firstName} ${payment.cashier.lastName}`
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={payment.paymentStatus === 'SUCCESS' ? 'Reussi' : payment.paymentStatus}
                        color={payment.paymentStatus === 'SUCCESS' ? 'success' : 'warning'}
                        size="small"
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
      <Dialog open={cancelDialog} onClose={() => setCancelDialog(false)}>
        <DialogTitle>Annuler la prescription</DialogTitle>
        <DialogContent>
          <Typography>
            Etes-vous sur de vouloir annuler la prescription {prescription.prescriptionNumber} ?
            Cette action est irreversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialog(false)}>Non</Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={cancelling}
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
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PrescriptionDetail;
