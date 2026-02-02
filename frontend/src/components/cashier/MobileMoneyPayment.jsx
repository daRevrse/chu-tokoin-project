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
  Phone,
  CheckCircle,
  Error as ErrorIcon,
  PhoneAndroid
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const steps = ['Provider', 'Telephone', 'Confirmation', 'Resultat'];

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
            setError('Le paiement a ete refuse');
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <PhoneAndroid sx={{ mr: 1 }} />
        Paiement Mobile Money
      </DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} sx={{ my: 3 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Etape 0: Selection du provider */}
        {activeStep === 0 && (
          <Box>
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Selectionnez le service Mobile Money a utiliser
            </Typography>
            <FormControl fullWidth>
              <InputLabel>Provider Mobile Money</InputLabel>
              <Select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                label="Provider Mobile Money"
              >
                <MenuItem value="TMONEY">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 30, height: 30, bgcolor: '#FF6B00', borderRadius: 1, mr: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                      TM
                    </Box>
                    T-Money (Togocel)
                  </Box>
                </MenuItem>
                <MenuItem value="FLOOZ">
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Box sx={{ width: 30, height: 30, bgcolor: '#00A651', borderRadius: 1, mr: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: 12 }}>
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
            <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
              Entrez le numero de telephone {provider === 'TMONEY' ? 'Togocel' : 'Moov'} du patient
            </Typography>
            <TextField
              fullWidth
              label="Numero de telephone"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
              placeholder="90 XX XX XX"
              InputProps={{
                startAdornment: (
                  <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                    <Phone sx={{ color: 'action.active', mr: 0.5 }} />
                    <Typography color="textSecondary">+228</Typography>
                  </Box>
                )
              }}
              helperText="Entrez le numero sans le prefixe +228"
            />
          </Box>
        )}

        {/* Etape 2: Confirmation */}
        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h6" gutterBottom>Confirmer le paiement</Typography>

            <Box sx={{ bgcolor: 'grey.100', p: 3, borderRadius: 2, my: 2 }}>
              <Typography color="textSecondary">Provider</Typography>
              <Typography variant="h6" sx={{ mb: 2 }}>
                {provider === 'TMONEY' ? 'T-Money' : 'Flooz'}
              </Typography>

              <Typography color="textSecondary">Telephone</Typography>
              <Typography variant="h6" sx={{ mb: 2 }}>+228 {phoneNumber}</Typography>

              <Typography color="textSecondary">Prescription</Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {prescription?.prescriptionNumber}
              </Typography>

              <Typography color="textSecondary">Montant a payer</Typography>
              <Typography variant="h4" color="primary">
                {prescription?.totalAmount?.toLocaleString('fr-FR')} FCFA
              </Typography>
            </Box>

            <Alert severity="info" sx={{ textAlign: 'left' }}>
              En cliquant sur "Payer", une demande de paiement sera envoyee au numero {phoneNumber}.
              Le patient devra confirmer le paiement sur son telephone.
            </Alert>
          </Box>
        )}

        {/* Etape 3: Resultat */}
        {activeStep === 3 && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {paymentStatus === 'PROCESSING' && (
              <>
                <CircularProgress size={60} sx={{ mb: 2 }} />
                <Typography variant="h6">Paiement en cours...</Typography>
                <Typography color="textSecondary" sx={{ mb: 2 }}>
                  En attente de confirmation du client
                </Typography>
                <Alert severity="info">
                  Le client doit confirmer le paiement sur son telephone en composant son code secret {provider === 'TMONEY' ? 'T-Money' : 'Flooz'}.
                </Alert>
              </>
            )}
            {paymentStatus === 'SUCCESS' && (
              <>
                <CheckCircle sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />
                <Typography variant="h5" color="success.main" gutterBottom>
                  Paiement reussi !
                </Typography>
                <Typography color="textSecondary" sx={{ mb: 2 }}>
                  Le paiement de {prescription?.totalAmount?.toLocaleString('fr-FR')} FCFA a ete effectue avec succes.
                </Typography>
                {qrCode && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>QR Code de validation:</Typography>
                    <img src={qrCode} alt="QR Code" style={{ maxWidth: 200 }} />
                  </Box>
                )}
              </>
            )}
            {paymentStatus === 'FAILED' && (
              <>
                <ErrorIcon sx={{ fontSize: 80, color: 'error.main', mb: 2 }} />
                <Typography variant="h5" color="error.main" gutterBottom>
                  Paiement echoue
                </Typography>
                <Typography color="textSecondary">
                  Le paiement n'a pas pu etre effectue. Veuillez reessayer ou utiliser un autre mode de paiement.
                </Typography>
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        {activeStep < 3 && activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Retour
          </Button>
        )}
        <Button onClick={handleClose}>
          {paymentStatus === 'SUCCESS' ? 'Fermer' : 'Annuler'}
        </Button>
        {activeStep < 3 && (
          <Button
            variant="contained"
            onClick={handleNext}
            disabled={isNextDisabled() || loading}
            color={activeStep === 2 ? 'success' : 'primary'}
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
