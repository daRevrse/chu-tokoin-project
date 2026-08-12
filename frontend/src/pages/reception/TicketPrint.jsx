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
  PersonAddRounded as NextPatientIcon
} from '@mui/icons-material';

/**
 * Ticket remis au patient a l'issue de l'enregistrement.
 *
 * L'impression passe par `window.print()` : la feuille de style @media print
 * masque tout sauf le ticket, ce qui evite d'imprimer la navigation.
 */
const TicketPrint = ({ visit, onNext }) => {
  if (!visit) return null;

  const patient = visit.patient || {};
  const isUrgent = visit.priority === 'URGENT';

  const formattedDate = new Date(visit.createdAt).toLocaleString('fr-FR', {
    dateStyle: 'long',
    timeStyle: 'short'
  });

  return (
    <Box>
      {/* Masque tout sauf le ticket au moment de l'impression */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ticket-print, #ticket-print * { visibility: visible; }
          #ticket-print {
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
        id="ticket-print"
        elevation={0}
        sx={{
          p: 4,
          maxWidth: 420,
          mx: 'auto',
          textAlign: 'center',
          borderRadius: 4,
          border: '2px dashed',
          borderColor: isUrgent ? 'error.main' : 'divider'
        }}
      >
        <Typography variant="overline" color="text.secondary" letterSpacing={2}>
          CHU Tokoin
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Ticket de passage
        </Typography>

        {isUrgent && (
          <Chip label="URGENCE" color="error" sx={{ mb: 2, fontWeight: 'bold' }} />
        )}

        {visit.visitType === 'RESULT_REVIEW' && (
          <Chip label="RETOUR RÉSULTATS" color="info" sx={{ mb: 2, fontWeight: 'bold' }} />
        )}

        <Typography
          sx={{
            fontSize: 96,
            fontWeight: 800,
            lineHeight: 1,
            color: isUrgent ? 'error.main' : 'primary.main'
          }}
        >
          {String(visit.ticketNumber).padStart(3, '0')}
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Typography variant="h6" fontWeight="bold">
          {patient.lastName} {patient.firstName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {patient.patientNumber}
        </Typography>

        {visit.reviewedPrescription ? (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Ordonnance :</strong> {visit.reviewedPrescription.prescriptionNumber}
          </Typography>
        ) : visit.reason && (
          <Typography variant="body2" sx={{ mb: 2 }}>
            <strong>Motif :</strong> {visit.reason}
          </Typography>
        )}

        <Typography variant="caption" color="text.secondary" display="block">
          {formattedDate}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
          Conservez ce ticket, il sera demandé par le médecin.
        </Typography>
      </Paper>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 4 }} className="no-print">
        <Button
          variant="contained"
          size="large"
          startIcon={<PrintIcon />}
          onClick={() => window.print()}
          sx={{ borderRadius: 2, textTransform: 'none', px: 4, boxShadow: 'none' }}
        >
          Imprimer le ticket
        </Button>
        <Button
          variant="outlined"
          size="large"
          startIcon={<NextPatientIcon />}
          onClick={onNext}
          sx={{ borderRadius: 2, textTransform: 'none', px: 4 }}
        >
          Patient suivant
        </Button>
      </Box>
    </Box>
  );
};

export default TicketPrint;
