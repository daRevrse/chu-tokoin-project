import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment
} from '@mui/material';
import api from '../../services/api';

export const formatAmount = (amount) =>
  new Intl.NumberFormat('fr-FR').format(Number(amount) || 0) + ' FCFA';

export const balanceOf = (invoice) =>
  Number(invoice.totalAmount) - Number(invoice.paidAmount);

/**
 * Encaissement d'une facture.
 *
 * Partage par la file des consultations du jour et par l'ecran des creances a
 * regulariser : c'est le meme geste, sur les memes factures, a des moments
 * differents du parcours.
 */
const InvoicePaymentDialog = ({ invoice, onClose, onPaid }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoice) return;
    // Pre-rempli au reste a payer : le reglement integral est le geste courant,
    // le caissier ne corrige que pour un versement partiel.
    setAmount(String(balanceOf(invoice)));
    setMethod('CASH');
    setError('');
  }, [invoice]);

  const submit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const response = await api.post('/payments', {
        invoiceId: invoice.id,
        amount: Number(amount),
        paymentMethod: method
      });

      onPaid(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'encaissement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={Boolean(invoice)} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Encaisser</DialogTitle>
      <DialogContent>
        {invoice && (
          <Box sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {invoice.patient?.lastName} {invoice.patient?.firstName} — facture {invoice.invoiceNumber}
            </Typography>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Reste à payer : {formatAmount(balanceOf(invoice))}
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

            <TextField
              fullWidth
              type="number"
              label="Montant versé"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputProps={{ min: 0, max: balanceOf(invoice), step: 50 }}
              InputProps={{ endAdornment: <InputAdornment position="end">FCFA</InputAdornment> }}
              helperText="Un montant inférieur enregistre un versement partiel."
              sx={{ mb: 3 }}
            />

            <FormControl fullWidth>
              <InputLabel>Mode de paiement</InputLabel>
              <Select value={method} label="Mode de paiement" onChange={(e) => setMethod(e.target.value)}>
                <MenuItem value="CASH">Espèces</MenuItem>
                <MenuItem value="MOBILE_MONEY">Mobile Money</MenuItem>
                <MenuItem value="CARD">Carte</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Annuler</Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={submitting || !(Number(amount) > 0)}
          sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
        >
          {submitting ? 'Encaissement...' : 'Valider'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default InvoicePaymentDialog;
