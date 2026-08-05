import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Snackbar,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Cancel as CancelIcon,
  Download as DownloadIcon,
  CheckCircle as ValidateIcon,
  Print as PrintIcon
} from '@mui/icons-material';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const PrescriptionDetail = ({ prescriptionId, onBack, onRefresh }) => {
  const [prescription, setPrescription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null, data: null });

  useEffect(() => {
    fetchPrescription();
  }, [prescriptionId]);

  const fetchPrescription = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/prescriptions/${prescriptionId}`);
      setPrescription(response.data.prescription);
    } catch (err) {
      setError('Erreur lors du chargement de la prescription');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setConfirmDialog({
      open: true,
      action: 'cancel',
      data: null
    });
  };

  const handleValidateResult = (resultId) => {
    setConfirmDialog({
      open: true,
      action: 'validate',
      data: resultId
    });
  };

  const handleConfirm = async () => {
    const { action, data } = confirmDialog;
    setConfirmDialog({ open: false, action: null, data: null });

    try {
      if (action === 'cancel') {
        await api.patch(`/prescriptions/${prescriptionId}/cancel`);
        setSnackbar({ open: true, message: 'Prescription annulee avec succes', severity: 'success' });
        fetchPrescription();
        if (onRefresh) onRefresh();
      } else if (action === 'validate') {
        await api.patch(`/results/${data}/validate`);
        setSnackbar({ open: true, message: 'Resultat valide avec succes', severity: 'success' });
        fetchPrescription();
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Une erreur est survenue',
        severity: 'error'
      });
    }
  };

  const handleDownload = async (resultId, fileName) => {
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
    } catch (err) {
      setSnackbar({ open: true, message: 'Erreur lors du telechargement', severity: 'error' });
    }
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !prescription) {
    return (
      <Box>
        <Button startIcon={<BackIcon />} onClick={onBack} sx={{ mb: 2 }}>
          Retour
        </Button>
        <Alert severity="error">{error || 'Prescription introuvable'}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<BackIcon />} onClick={onBack}>
          Retour aux prescriptions
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {prescription.status === 'PENDING' && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<CancelIcon />}
              onClick={handleCancel}
            >
              Annuler
            </Button>
          )}
        </Box>
      </Box>

      {/* En-tete prescription */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h5" gutterBottom>
              Prescription {prescription.prescriptionNumber}
            </Typography>
            <Typography color="textSecondary">
              Creee le {formatDate(prescription.createdAt)}
            </Typography>
          </Grid>
          <Grid item xs={12} md={3}>
            <Chip
              label={getStatusLabel(prescription.status)}
              color={getStatusColor(prescription.status)}
              size="medium"
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Typography variant="h5" color="primary" align="right">
              {formatPrice(prescription.totalAmount)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Infos patient */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Patient
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography>
              <strong>Nom :</strong> {prescription.patient?.lastName} {prescription.patient?.firstName}
            </Typography>
            <Typography>
              <strong>N° :</strong> {prescription.patient?.patientNumber}
            </Typography>
            {prescription.patient?.phone && (
              <Typography>
                <strong>Tel :</strong> {prescription.patient?.phone}
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Infos paiement */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Paiement
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {prescription.payments && prescription.payments.length > 0 ? (
              prescription.payments.map((payment) => (
                <Box key={payment.id}>
                  <Typography>
                    <strong>Methode :</strong> {payment.paymentMethod}
                  </Typography>
                  <Typography>
                    <strong>Date :</strong> {payment.paymentDate ? formatDate(payment.paymentDate) : '-'}
                  </Typography>
                  <Typography>
                    <strong>Caissier :</strong> {payment.cashier?.lastName} {payment.cashier?.firstName}
                  </Typography>
                  <Chip
                    label={payment.paymentStatus === 'SUCCESS' ? 'Paye' : payment.paymentStatus}
                    color={payment.paymentStatus === 'SUCCESS' ? 'success' : 'warning'}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
              ))
            ) : (
              <Typography color="textSecondary">
                En attente de paiement
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Notes */}
      {prescription.notes && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Notes / Observations
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography>{prescription.notes}</Typography>
        </Paper>
      )}

      {/* Liste des examens */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Examens ({prescription.prescriptionExams?.length || 0})
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Examen</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Categorie</TableCell>
                <TableCell>Prix</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Technicien</TableCell>
                <TableCell>Resultats</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(prescription.prescriptionExams || []).map((pe) => (
                <TableRow key={pe.id}>
                  <TableCell>
                    <Typography fontWeight="medium">{pe.exam?.name}</Typography>
                  </TableCell>
                  <TableCell>{pe.exam?.code}</TableCell>
                  <TableCell>
                    <Chip
                      label={pe.exam?.category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{formatPrice(pe.price)}</TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(pe.status)}
                      color={getStatusColor(pe.status)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {pe.performer ? (
                      <>
                        <Typography variant="body2">
                          {pe.performer.lastName} {pe.performer.firstName}
                        </Typography>
                        {pe.performedAt && (
                          <Typography variant="caption" color="textSecondary">
                            {formatDate(pe.performedAt)}
                          </Typography>
                        )}
                      </>
                    ) : (
                      <Typography variant="body2" color="textSecondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {pe.results && pe.results.length > 0 ? (
                      pe.results.map((result) => (
                        <Box key={result.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                          <Tooltip title="Telecharger">
                            <IconButton
                              size="small"
                              onClick={() => handleDownload(result.id, result.fileName)}
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {result.isValidated ? (
                            <Chip label="Valide" color="success" size="small" />
                          ) : (
                            <Tooltip title="Valider ce resultat">
                              <IconButton
                                size="small"
                                color="primary"
                                onClick={() => handleValidateResult(result.id)}
                              >
                                <ValidateIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Typography variant="caption">{result.fileName}</Typography>
                        </Box>
                      ))
                    ) : (
                      <Typography variant="body2" color="textSecondary">-</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={confirmDialog.open && confirmDialog.action === 'cancel'}
        title="Annuler la prescription"
        message="Etes-vous sur de vouloir annuler cette prescription ? Cette action est irreversible."
        confirmText="Annuler la prescription"
        confirmColor="error"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmDialog({ open: false, action: null, data: null })}
      />

      <ConfirmDialog
        open={confirmDialog.open && confirmDialog.action === 'validate'}
        title="Valider le resultat"
        message="Etes-vous sur de vouloir valider ce resultat ? Il sera visible par le patient via le portail."
        confirmText="Valider"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmDialog({ open: false, action: null, data: null })}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default PrescriptionDetail;
