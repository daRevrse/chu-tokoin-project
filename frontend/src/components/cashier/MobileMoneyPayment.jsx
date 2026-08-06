import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import {
  PhoneRounded as Phone,
  CheckCircleRounded as CheckCircle,
  ErrorRounded as ErrorIcon,
  PhoneAndroidRounded as PhoneAndroid
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const steps = ['Opérateur', 'Téléphone', 'Confirmation', 'Résultat'];

const MobileMoneyPayment = ({ open, onClose, prescription, onSuccess }) => {
  const [activeStep, setActiveStep] = useState(0);
  const [provider, setProvider] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentId, setPaymentId] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [qrCode, setQrCode] = useState(null);

  const api = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });

  // Polling pour verifier le statut
  useEffect(() => {
    let interval;
    if (paymentId && paymentStatus === 'PROCESSING') {
      interval = setInterval(async () => {
        try {
          const response = await api.get(`/payments/mobile-money/${paymentId}/status`);
          if (response.data.status === 'SUCCESS') {
            setPaymentStatus('SUCCESS');
            setQrCode(response.data.qrCode);
            setActiveStep(3);
            clearInterval(interval);
          } else if (response.data.status === 'FAILED') {
            setPaymentStatus('FAILED');
            setError('Le paiement a été refusé');
            clearInterval(interval);
          }
        } catch (err) {
          console.error('Status check error:', err);
        }
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [paymentId, paymentStatus]);

  const handleNext = async () => {
    if (activeStep === 2) {
      // Initier le paiement
      setLoading(true);
      setError(null);
      try {
        const response = await api.post('/payments/mobile-money/initiate', {
          prescriptionId: prescription.id,
          provider,
          phoneNumber
        });
        setPaymentId(response.data.paymentId);
        setPaymentStatus('PROCESSING');
        setActiveStep(3);

        // En mode developpement, simuler automatiquement le callback apres 5 secondes
        if (process.env.NODE_ENV === 'development') {
          setTimeout(async () => {
            try {
              await api.post(`/payments/mobile-money/${response.data.paymentId}/simulate-callback`, {
                status: 'SUCCESS'
              });
            } catch (err) {
              console.error('Simulation error:', err);
            }
          }, 5000);
        }
      } catch (err) {
        setError(err.response?.data?.error || 'Erreur lors du paiement');
      } finally {
        setLoading(false);
      }
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleClose = () => {
    if (paymentStatus === 'SUCCESS') {
      onSuccess(qrCode);
    }
    onClose();
    // Reset state
    setActiveStep(0);
    setProvider('');
    setPhoneNumber('');
    setPaymentId(null);
    setPaymentStatus(null);
    setQrCode(null);
    setError(null);
  };

  const isNextDisabled = () => {
    if (activeStep === 0 && !provider) return true;
    if (activeStep === 1 && (!phoneNumber || phoneNumber.length < 8)) return true;
    return false;
  };

  const formatPhoneNumber = (value) => {
    // Nettoyer et formater le numero
    const cleaned = value.replace(/\D/g, '');
    return cleaned;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, fontWeight: 'bold', pt: 3 }}>
        <Box sx={{ bgcolor: '#fff3e0', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PhoneAndroid sx={{ fontSize: 22, color: '#ed6c02' }} />
        </Box>
        Paiement Mobile Money
      </DialogTitle>
      <DialogContent>
        <Stepper
          activeStep={activeStep}
          sx={{ my: 4, '& .MuiStepLabel-label': { fontWeight: 'bold', fontSize: '0.8rem' } }}
        >
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Etape 0: Selection du provider */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Sélectionnez le service Mobile Money à utiliser
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Opérateur Mobile Money</InputLabel>
              <Select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                label="Opérateur Mobile Money"
                sx={{ borderRadius: 2 }}
              >
                <MenuItem value="TMONEY">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 32, height: 32, bgcolor: '#FF6B00', borderRadius: 2, mr: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                      TM
                    </Box>
                    T-Money (Togocel)
                  </Box>
                </MenuItem>
                <MenuItem value="FLOOZ">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 32, height: 32, bgcolor: '#00A651', borderRadius: 2, mr: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                      FL
                    </Box>
                    Flooz (Moov Africa)
                  </Box>
                </MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Etape 1: Numero de telephone */}
        {activeStep === 1 && (
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
              Entrez le numéro de téléphone {provider === 'TMONEY' ? 'Togocel' : 'Moov'} du patient
            </Typography>
            <TextField
              fullWidth
              label="Numéro de téléphone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
              placeholder="90 XX XX XX"
              InputProps={{
                startAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    <Phone sx={{ color: 'action.active', mr: 0.5 }} />
                    <Typography color="textSecondary" fontWeight="bold">+228</Typography>
                  </Box>
                )
              }}
              helperText="Entrez le numéro sans le préfixe +228"
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </Box>
        )}

        {/* Etape 2: Confirmation */}
        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography variant="h6" fontWeight="bold" gutterBottom>Confirmer le paiement</Typography>

            <Box sx={{ bgcolor: '#f8fafc', p: 3, borderRadius: 3, my: 3 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">Opérateur</Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                {provider === 'TMONEY' ? 'T-Money' : 'Flooz'}
              </Typography>

              <Typography variant="caption" color="textSecondary" fontWeight="bold">Téléphone</Typography>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>+228 {phoneNumber}</Typography>

              <Typography variant="caption" color="textSecondary" fontWeight="bold">Prescription</Typography>
              <Typography variant="body1" fontWeight="bold" sx={{ mb: 2 }}>
                {prescription?.prescriptionNumber}
              </Typography>

              <Typography variant="caption" color="textSecondary" fontWeight="bold">Montant à payer</Typography>
              <Typography variant="h4" fontWeight="bold" color="primary">
                {prescription?.totalAmount?.toLocaleString('fr-FR')} FCFA
              </Typography>
            </Box>

            <Alert severity="info" sx={{ textAlign: 'left', borderRadius: 2 }}>
              En cliquant sur « Payer », une demande de paiement sera envoyée au numéro {phoneNumber}.
              Le patient devra confirmer le paiement sur son téléphone.
            </Alert>
          </Box>
        )}

        {/* Etape 3: Resultat */}
        {activeStep === 3 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {paymentStatus === 'PROCESSING' && (
              <>
                <CircularProgress size={60} sx={{ mb: 3 }} />
                <Typography variant="h6" fontWeight="bold">Paiement en cours...</Typography>
                <Typography color="textSecondary" sx={{ mb: 3 }}>
                  En attente de confirmation du client
                </Typography>
                <Alert severity="info" sx={{ textAlign: 'left', borderRadius: 2 }}>
                  Le client doit confirmer le paiement sur son téléphone en composant son code secret {provider === 'TMONEY' ? 'T-Money' : 'Flooz'}.
                </Alert>
              </>
            )}
            {paymentStatus === 'SUCCESS' && (
              <>
                <Box sx={{ bgcolor: '#e8f5e9', width: 96, height: 96, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', mb: 3 }}>
                  <CheckCircle sx={{ fontSize: 56, color: '#2e7d32' }} />
                </Box>
                <Typography variant="h5" fontWeight="bold" color="success.main" gutterBottom>
                  Paiement réussi !
                </Typography>
                <Typography color="textSecondary" sx={{ mb: 3 }}>
                  Le paiement de {prescription?.totalAmount?.toLocaleString('fr-FR')} FCFA a été effectué avec succès.
                </Typography>
                {qrCode && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom>QR Code de validation</Typography>
                    <Box sx={{ display: 'inline-block', p: 2, bgcolor: 'white', borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                      <img src={qrCode} alt="QR Code" style={{ maxWidth: 200, display: 'block' }} />
                    </Box>
                  </Box>
                )}
              </>
            )}
            {paymentStatus === 'FAILED' && (
              <>
                <Box sx={{ bgcolor: '#ffebee', width: 96, height: 96, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', mb: 3 }}>
                  <ErrorIcon sx={{ fontSize: 56, color: '#d32f2f' }} />
                </Box>
                <Typography variant="h5" fontWeight="bold" color="error.main" gutterBottom>
                  Paiement échoué
                </Typography>
                <Typography color="textSecondary">
                  Le paiement n'a pas pu être effectué. Veuillez réessayer ou utiliser un autre mode de paiement.
                </Typography>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 3, pt: 2 }}>
        {activeStep < 3 && activeStep > 0 && (
          <Button
            onClick={handleBack}
            disabled={loading}
            sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
          >
            Retour
          </Button>
        )}
        <Button
          onClick={handleClose}
          sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
        >
          {paymentStatus === 'SUCCESS' ? 'Fermer' : 'Annuler'}
        </Button>
        {activeStep < 3 && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isNextDisabled() || loading}
            color={activeStep === 2 ? 'success' : 'primary'}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : activeStep === 2 ? (
              'Payer'
            ) : (
              'Suivant'
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default MobileMoneyPayment;
