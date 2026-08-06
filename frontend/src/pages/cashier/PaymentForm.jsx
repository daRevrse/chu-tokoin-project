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
  ArrowBackRounded as BackIcon,
  PaymentRounded as PaymentIcon,
  CheckCircleRounded as SuccessIcon,
  PhoneAndroidRounded as MobileIcon,
  QrCode2Rounded as QrIcon,
  DownloadRounded as DownloadIcon,
  PersonRounded as PersonIcon,
  AssignmentRounded as PrescriptionIcon
} from '@mui/icons-material';
import api from '../../services/api';
import MobileMoneyPayment from '../../components/cashier/MobileMoneyPayment';

const PaymentForm = ({ prescription, onBack, onSuccess }) => {
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentResult, setPaymentResult] = useState(null);
  const [mobileMoneyDialogOpen, setMobileMoneyDialogOpen] = useState(false);

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
    // Si Mobile Money, ouvrir le dialog specifique
    if (paymentMethod === 'MOBILE_MONEY') {
      setMobileMoneyDialogOpen(true);
      return;
    }

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

  const handleMobileMoneySuccess = (qrCode) => {
    // Creer un objet de resultat similaire pour l'affichage
    setPaymentResult({
      payment: {
        paymentNumber: `MM-${Date.now()}`,
        amount: prescription.totalAmount,
        paymentMethod: 'MOBILE_MONEY',
        qrCode: qrCode
      }
    });
    if (onSuccess) {
      onSuccess({ payment: { qrCode } });
    }
  };

  // Affichage du resultat de paiement avec QR code
  if (paymentResult) {
    return (
      <Box>
        <Alert
          severity="success"
          sx={{ mb: 3, borderRadius: 3, fontWeight: 'bold', alignItems: 'center' }}
          icon={<SuccessIcon />}
        >
          Paiement effectué avec succès !
        </Alert>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, height: '100%', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ bgcolor: '#e8f5e9', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <SuccessIcon sx={{ fontSize: 22, color: '#2e7d32' }} />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  Détails du Paiement
                </Typography>
              </Box>

              <List sx={{ p: 0 }}>
                <ListItem sx={{ px: 0, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ListItemText
                    primary="Numéro de paiement"
                    secondary={paymentResult.payment.paymentNumber}
                    primaryTypographyProps={{ variant: 'caption', color: 'textSecondary', fontWeight: 'bold' }}
                    secondaryTypographyProps={{ variant: 'body1', color: 'textPrimary', fontWeight: 'bold' }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ListItemText
                    primary="Montant"
                    secondary={formatPrice(paymentResult.payment.amount)}
                    primaryTypographyProps={{ variant: 'caption', color: 'textSecondary', fontWeight: 'bold' }}
                    secondaryTypographyProps={{ variant: 'body1', color: 'success.main', fontWeight: 'bold' }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <ListItemText
                    primary="Méthode"
                    secondary={paymentResult.payment.paymentMethod === 'CASH' ? 'Espèces' :
                      paymentResult.payment.paymentMethod === 'MOBILE_MONEY' ? 'Mobile Money' : 'Carte'}
                    primaryTypographyProps={{ variant: 'caption', color: 'textSecondary', fontWeight: 'bold' }}
                    secondaryTypographyProps={{ variant: 'body1', color: 'textPrimary', fontWeight: 'bold' }}
                  />
                </ListItem>
                <ListItem sx={{ px: 0, py: 1.5 }}>
                  <ListItemText
                    primary="Statut"
                    secondary={<Chip label="Payé" color="success" size="small" sx={{ fontWeight: 'bold', mt: 0.5 }} />}
                    primaryTypographyProps={{ variant: 'caption', color: 'textSecondary', fontWeight: 'bold' }}
                    secondaryTypographyProps={{ component: 'div' }}
                  />
                </ListItem>
              </List>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 3 }}>
                <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Patient</Typography>
                <Typography fontWeight="bold" sx={{ mb: 1.5 }}>
                  {prescription.patient?.lastName} {prescription.patient?.firstName}
                </Typography>
                <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Prescription</Typography>
                <Typography fontWeight="bold">
                  {prescription.prescriptionNumber}
                </Typography>
              </Box>

              <Box sx={{ mt: 3 }}>
                <Button
                  variant="outlined"
                  startIcon={<BackIcon />}
                  onClick={onBack}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
                >
                  Retour à la liste
                </Button>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, height: '100%', textAlign: 'center', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, mb: 1 }}>
                <QrIcon sx={{ color: 'primary.main' }} />
                <Typography variant="h6" fontWeight="bold">
                  QR Code du Paiement
                </Typography>
              </Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
                À présenter aux services de radiologie ou laboratoire
              </Typography>

              {paymentResult.payment.qrCode && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    mb: 3
                  }}
                >
                  <Box
                    sx={{
                      p: 2,
                      bgcolor: 'white',
                      borderRadius: 4,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
                    }}
                  >
                    <img
                      src={paymentResult.payment.qrCode}
                      alt="QR Code Paiement"
                      style={{ maxWidth: '250px', display: 'block' }}
                    />
                  </Box>
                </Box>
              )}

              <Typography variant="caption" color="textSecondary" display="block" sx={{ mb: 3 }}>
                Ce QR code contient les informations du paiement et des examens à effectuer
              </Typography>

              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = paymentResult.payment.qrCode;
                  link.download = `qr-${paymentResult.payment.paymentNumber}.png`;
                  link.click();
                }}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3, py: 1.2 }}
              >
                Télécharger le QR Code
              </Button>
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
        sx={{ mb: 3, borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
      >
        Retour
      </Button>

      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Traitement du Paiement
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        {/* Info Prescription */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={0} sx={{ mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ bgcolor: '#e3f2fd', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PersonIcon sx={{ fontSize: 22, color: '#1976d2' }} />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  Informations Patient
                </Typography>
              </Box>
              <Grid container spacing={2}>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Nom complet</Typography>
                  <Typography fontWeight="bold">
                    {prescription.patient?.lastName} {prescription.patient?.firstName}
                  </Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>N° Patient</Typography>
                  <Chip label={prescription.patient?.patientNumber} color="primary" variant="outlined" size="small" sx={{ fontWeight: 'bold' }} />
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Âge</Typography>
                  <Typography fontWeight="bold">{calculateAge(prescription.patient?.dateOfBirth)} ans</Typography>
                </Grid>
                <Grid size={6}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Téléphone</Typography>
                  <Typography fontWeight="bold">{prescription.patient?.phone}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
                <Box sx={{ bgcolor: '#fff3e0', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PrescriptionIcon sx={{ fontSize: 22, color: '#ed6c02' }} />
                </Box>
                <Typography variant="h6" fontWeight="bold">
                  Prescription
                </Typography>
              </Box>

              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>N° Prescription</Typography>
              <Chip
                label={prescription.prescriptionNumber}
                color="warning"
                sx={{ mb: 3, fontWeight: 'bold' }}
              />

              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">
                Médecin prescripteur
              </Typography>
              <Typography fontWeight="bold" sx={{ mb: 3 }}>
                Dr. {prescription.doctor?.lastName} {prescription.doctor?.firstName}
              </Typography>

              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mb: 1 }}>
                Examens prescrits
              </Typography>
              <List dense sx={{ p: 0 }}>
                {prescription.prescriptionExams?.map((pe) => (
                  <ListItem key={pe.id} sx={{ bgcolor: '#f8fafc', borderRadius: 2, mb: 1, py: 1.5 }}>
                    <ListItemText
                      primary={pe.exam?.name}
                      secondary={`${pe.exam?.code} — ${formatPrice(pe.exam?.price)}`}
                      primaryTypographyProps={{ fontWeight: 'bold', variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Formulaire de paiement */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', position: 'sticky', top: 20 }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Encaissement
            </Typography>

            <Box
              sx={{
                background: 'linear-gradient(135deg, #1976d2 0%, #115293 100%)',
                color: 'white',
                p: 3,
                borderRadius: 4,
                mb: 3,
                boxShadow: '0 8px 24px rgba(25, 118, 210, 0.2)'
              }}
            >
              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 'bold' }}>
                Montant à payer
              </Typography>
              <Typography variant="h3" fontWeight="bold" sx={{ mt: 0.5 }}>
                {formatPrice(prescription.totalAmount)}
              </Typography>
            </Box>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Mode de paiement</InputLabel>
              <Select
                value={paymentMethod}
                label="Mode de paiement"
                onChange={(e) => setPaymentMethod(e.target.value)}
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="CASH">Espèces</MenuItem>
                <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>
                <MenuItem value="CARD">Carte bancaire</MenuItem>
              </Select>
            </FormControl>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography color="textSecondary">Nombre d'examens</Typography>
              <Typography fontWeight="bold">
                {prescription.prescriptionExams?.length || 0}
              </Typography>
            </Box>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                p: 2,
                bgcolor: '#f8fafc',
                borderRadius: 3
              }}
            >
              <Typography variant="subtitle1" fontWeight="bold">Total</Typography>
              <Typography variant="h6" fontWeight="bold" color="primary">
                {formatPrice(prescription.totalAmount)}
              </Typography>
            </Box>

            <Button
              fullWidth
              variant="contained"
              color={paymentMethod === 'MOBILE_MONEY' ? 'warning' : 'success'}
              size="large"
              startIcon={paymentMethod === 'MOBILE_MONEY' ? <MobileIcon /> : <PaymentIcon />}
              onClick={handlePayment}
              disabled={loading}
              sx={{ borderRadius: 2, textTransform: 'none', py: 1.5, fontWeight: 'bold', fontSize: '1rem', boxShadow: 'none' }}
            >
              {loading ? 'Traitement...' : paymentMethod === 'MOBILE_MONEY' ? 'Payer via Mobile Money' : 'Confirmer le Paiement'}
            </Button>
          </Paper>
        </Grid>
      </Grid>

      {/* Dialog Mobile Money */}
      <MobileMoneyPayment
        open={mobileMoneyDialogOpen}
        onClose={() => setMobileMoneyDialogOpen(false)}
        prescription={prescription}
        onSuccess={handleMobileMoneySuccess}
      />
    </Box>
  );
};

export default PaymentForm;
