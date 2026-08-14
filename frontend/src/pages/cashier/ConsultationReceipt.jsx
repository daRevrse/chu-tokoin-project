import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  Chip
} from '@mui/material';
import {
  PrintRounded as PrintIcon,
  ArrowForwardRounded as NextIcon
} from '@mui/icons-material';
import { useHospital } from '../../contexts/HospitalContext';
import { formatAmount } from '../../components/cashier/InvoicePaymentDialog';

/**
 * Recu remis au patient apres encaissement d'une consultation.
 *
 * Le paiement des examens produisait deja un recu ; la consultation n'en
 * produisait aucun. Le patient repartait sans preuve de paiement, et rien ne
 * permettait de trancher une contestation au guichet ou devant le medecin.
 *
 * Impression via `window.print()`, comme le ticket de passage : la feuille de
 * style @media print masque tout sauf le recu.
 */
const ConsultationReceipt = ({ payment, invoice, onNext }) => {
  const { hospital, logoSrc } = useHospital();

  if (!payment || !invoice) return null;

  const patient = invoice.patient || {};
  const visit = invoice.visit || {};
  const balance = Number(invoice.totalAmount) - Number(invoice.paidAmount);
  const settled = balance <= 0;

  const formattedDate = new Date(payment.paymentDate || payment.createdAt).toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  const methodLabels = { CASH: 'Espèces', MOBILE_MONEY: 'Mobile Money', CARD: 'Carte' };

  return (
    <Box>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #consultation-receipt, #consultation-receipt * { visibility: visible; }
          #consultation-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <Paper
        id="consultation-receipt"
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 420,
          mx: 'auto',
          textAlign: 'center',
          borderRadius: 4,
          border: '2px dashed',
          borderColor: settled ? 'divider' : 'warning.main'
        }}
      >
        {logoSrc && (
          <Box
            component="img"
            src={logoSrc}
            alt={hospital.name}
            sx={{ height: 48, maxWidth: '60%', objectFit: 'contain', mb: 1 }}
          />
        )}
        <Typography variant="overline" color="text.secondary" letterSpacing={2} display="block">
          {hospital.name}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Reçu de consultation
        </Typography>

        {!settled && (
          <Chip label="RÈGLEMENT PARTIEL" color="warning" sx={{ mb: 2, fontWeight: 'bold' }} />
        )}

        <Typography sx={{ fontSize: 40, fontWeight: 800, lineHeight: 1.2 }}>
          {formatAmount(payment.amount)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {methodLabels[payment.paymentMethod] || payment.paymentMethod}
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" fontWeight="bold">
          {patient.lastName} {patient.firstName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {patient.patientNumber}
        </Typography>

        {visit.ticketNumber && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Ticket :</strong> {String(visit.ticketNumber).padStart(3, '0')}
          </Typography>
        )}
        {visit.specialty && (
          <Typography variant="body2" sx={{ mb: 1 }}>
            <strong>Spécialité :</strong> {visit.specialty.name}
          </Typography>
        )}
        <Typography variant="body2" sx={{ mb: 2 }}>
          <strong>Facture :</strong> {invoice.invoiceNumber}
        </Typography>

        {/* Le reste a payer est imprime : un patient qui a verse une partie doit
            repartir avec le montant qui lui reste du, pas avec un recu muet. */}
        {!settled && (
          <Box sx={{ my: 2, py: 1.5, borderTop: '1px solid', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              Reste à payer
            </Typography>
            <Typography variant="h5" fontWeight="bold" color="warning.main">
              {formatAmount(balance)}
            </Typography>
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" display="block">
          Reçu n° {payment.paymentNumber} — {formattedDate}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          {settled
            ? 'Conservez ce reçu, il sera demandé par le médecin.'
            : 'Présentez ce reçu à la caisse pour régler le solde.'}
        </Typography>

        {[hospital.address, hospital.city].filter(Boolean).length > 0 && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            {[hospital.address, hospital.city].filter(Boolean).join(', ')}
          </Typography>
        )}
        {hospital.documentFooter && (
          <Typography variant="caption" color="text.secondary" display="block">
            {hospital.documentFooter}
          </Typography>
        )}
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }} className="no-print">
        <Button
          variant="contained"
          size="large"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          sx={{ borderRadius: 2, textTransform: 'none', px: 4, boxShadow: 'none' }}
        >
          Imprimer le reçu
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<NextIcon />}
          onClick={onNext}
          sx={{ borderRadius: 2, textTransform: 'none', px: 4 }}
        >
          Patient suivant
        </Button>
      </Box>
    </Box>
  );
};

export default ConsultationReceipt;
