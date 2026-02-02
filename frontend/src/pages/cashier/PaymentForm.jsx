import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Payment as PaymentIcon,
  CheckCircle as SuccessIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PaymentForm = ({ prescription, onBack, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  };

  const calculateAge = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const handlePayment = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/payments', {
        prescriptionId: prescription.id,
        amount: prescription.totalAmount,
        paymentMethod
      });

      setPaymentResult(response.data);
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (error) {
      console.error('Erreur paiement:', error);
      setError(error.response?.data?.message || 'Erreur lors du traitement du paiement');
    } finally {
      setLoading(false);
    }
  };

  // Affichage du resultat de paiement avec QR code
  if (paymentResult) {
    return (
      <Box>
        <Alert severity="success" sx={{ mb: 3 }} icon={<SuccessIcon />}>
          Paiement effectue avec succes!
        </Alert>

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom color="success.main">
                Details du Paiement
              </Typography>

              <List>
                <ListItem>
                  <ListItemText
                    primary="Numero de paiement"
                    secondary={paymentResult.payment.paymentNumber}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Montant"
                    secondary={formatPrice(paymentResult.payment.amount)}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Methode"
                    secondary={paymentResult.payment.paymentMethod === 'CASH' ? 'Especes' :
                      paymentResult.payment.paymentMethod === 'MOBILE_MONEY' ? 'Mobile Money' : 'Carte'}
                  />
                </ListItem>
                <ListItem>
                  <ListItemText
                    primary="Statut"
                    secondary={<Chip label="Paye" color="success" size="small" />}
                  />
                </ListItem>
              </List>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" gutterBottom>
                Patient: {prescription.patient?.lastName} {prescription.patient?.firstName}
              </Typography>
              <Typography variant="subtitle2" gutterBottom>
                Prescription: {prescription.prescriptionNumber}
              </Typography>

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<BackIcon />}
                  onClick={onBack}
                >
                  Retour a la liste
                </Button>
              </Box>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="h6" gutterBottom>
                QR Code du Paiement
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                A presenter aux services de radiologie ou laboratoire
              </Typography>

              {paymentResult.payment.qrCode && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 2
                  }}
                >
                  <img
                    src={paymentResult.payment.qrCode}
                    alt="QR Code Paiement"
                    style={{
                      maxWidth: '250px',
                      border: '1px solid #ddd',
                      borderRadius: '8px',
                      padding: '10px',
                      background: 'white'
                    }}
                  />
                </Box>
              )}

              <Typography variant="caption" color="textSecondary">
                Ce QR code contient les informations du paiement et des examens a effectuer
              </Typography>

              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = paymentResult.payment.qrCode;
                    link.download = `qr-${paymentResult.payment.paymentNumber}.png`;
                    link.click();
                  }}
                >
                  Telecharger QR Code
                </Button>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <Button
        startIcon={<BackIcon />}
        onClick={onBack}
        sx={{ mb: 2 }}
      >
        Retour
      </Button>

      <Typography variant="h5" gutterBottom>
        Traitement du Paiement
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Info Prescription */}
        <Grid item xs={12} md={6}>
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Informations Patient
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">Nom complet</Typography>
                  <Typography fontWeight="medium">
                    {prescription.patient?.lastName} {prescription.patient?.firstName}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">N° Patient</Typography>
                  <Chip label={prescription.patient?.patientNumber} color="primary" size="small" />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">Age</Typography>
                  <Typography>{calculateAge(prescription.patient?.dateOfBirth)} ans</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2" color="textSecondary">Telephone</Typography>
                  <Typography>{prescription.patient?.phone}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom color="primary">
                Prescription
              </Typography>
              <Typography variant="subtitle2" color="textSecondary">N° Prescription</Typography>
              <Chip
                label={prescription.prescriptionNumber}
                color="warning"
                sx={{ mb: 2 }}
              />

              <Typography variant="subtitle2" color="textSecondary" sx={{ mt: 1 }}>
                Medecin prescripteur
              </Typography>
              <Typography sx={{ mb: 2 }}>
                Dr. {prescription.doctor?.lastName} {prescription.doctor?.firstName}
              </Typography>

              <Typography variant="subtitle2" color="textSecondary">
                Examens prescrits
              </Typography>
              <List dense>
                {prescription.prescriptionExams?.map((pe) => (
                  <ListItem key={pe.id} sx={{ py: 0 }}>
                    <ListItemText
                      primary={pe.exam?.name}
                      secondary={`${pe.exam?.code} - ${formatPrice(pe.exam?.price)}`}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Formulaire de paiement */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, position: 'sticky', top: 20 }}>
            <Typography variant="h6" gutterBottom>
              Encaissement
            </Typography>

            <Box sx={{ bgcolor: 'primary.light', p: 2, borderRadius: 2, mb: 3 }}>
              <Typography variant="subtitle2" color="primary.contrastText">
                Montant a payer
              </Typography>
              <Typography variant="h3" color="primary.contrastText">
                {formatPrice(prescription.totalAmount)}
              </Typography>
            </Box>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Mode de paiement</InputLabel>
              <Select
                value={paymentMethod}
                label="Mode de paiement"
                onChange={(e) => setPaymentMethod(e.target.value)}
              >
                <MenuItem value="CASH">Especes</MenuItem>
                <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>
                <MenuItem value="CARD">Carte bancaire</MenuItem>
              </Select>
            </FormControl>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Typography>Nombre d'examens:</Typography>
              <Typography fontWeight="medium">
                {prescription.prescriptionExams?.length || 0}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">Total:</Typography>
              <Typography variant="h6" color="primary">
                {formatPrice(prescription.totalAmount)}
              </Typography>
            </Box>

            <Button
              fullWidth
              variant="contained"
              color="success"
              size="large"
              startIcon={<PaymentIcon />}
              onClick={handlePayment}
              disabled={loading}
            >
              {loading ? 'Traitement...' : 'Confirmer le Paiement'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PaymentForm;
