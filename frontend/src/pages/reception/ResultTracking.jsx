import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Chip,
  Alert,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  InputAdornment,
  CircularProgress
} from '@mui/material';
import {
  QrCode2Rounded as CodeIcon,
  CheckCircleRounded as ValidatedIcon,
  HourglassEmptyRounded as PendingIcon,
  RateReviewRounded as AwaitingValidationIcon,
  ConfirmationNumberRounded as TicketIcon,
  SearchRounded as SearchIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { formatExpectedResult, isExpectedResultPassed } from '../../utils/resultDelay';

// Trois etats distincts pour un examen. « Deposé » n'est pas « disponible » :
// tant que le medecin n'a pas valide, le patient ne doit pas etre rappele.
const RESULT_STATES = {
  VALIDATED: { label: 'Validé', color: 'success', Icon: ValidatedIcon },
  AWAITING_VALIDATION: { label: 'En attente de validation', color: 'info', Icon: AwaitingValidationIcon },
  PENDING: { label: 'Pas encore réalisé', color: 'default', Icon: PendingIcon }
};

/**
 * Retour du patient avec son numero de prescription.
 *
 * L'accueil saisit le numero, voit ou en est chaque examen, et ne peut remettre
 * un ticket que lorsque tous les resultats sont valides.
 */
const ResultTracking = ({ onVisitCreated }) => {
  const [number, setNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [tracking, setTracking] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const search = async (e) => {
    if (e) e.preventDefault();
    if (!number.trim()) return;

    setLoading(true);
    setError('');
    setTracking(null);

    try {
      const response = await api.get(`/visits/tracking/${encodeURIComponent(number.trim())}`);
      setTracking(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Prescription introuvable');
    } finally {
      setLoading(false);
    }
  };

  const openReviewVisit = async () => {
    setCreating(true);
    setError('');

    try {
      const response = await api.post('/visits', {
        patientId: tracking.patient.id,
        visitType: 'RESULT_REVIEW',
        reviewedPrescriptionId: tracking.prescription.id,
        reason: `Retour résultats ${tracking.prescription.prescriptionNumber}`
      });
      onVisitCreated(response.data.visit, response.data.consultationInvoice);
    } catch (err) {
      // 409 avec un passage existant = le patient est deja en file aujourd'hui
      setError(err.response?.data?.error || 'Erreur lors de l\'ouverture du passage');
    } finally {
      setCreating(false);
    }
  };

  const inputStyle = { '& .MuiOutlinedInput-root': { borderRadius: 2 } };

  const expectedLabel = tracking
    ? formatExpectedResult(tracking.prescription.expectedResultAt)
    : null;
  const expectedPassed = tracking
    ? isExpectedResultPassed(tracking.prescription.expectedResultAt)
    : false;

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Le patient présente le numéro figurant sur son ordonnance, remis à la caisse.
      </Typography>

      <form onSubmit={search}>
        <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
          <TextField
            autoFocus
            placeholder="PRE-202608-0001"
            value={number}
            onChange={(e) => { setNumber(e.target.value); setError(''); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CodeIcon color="action" />
                </InputAdornment>
              )
            }}
            sx={{ flexGrow: 1, minWidth: 260, ...inputStyle }}
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<SearchIcon />}
            disabled={loading || !number.trim()}
            sx={{ minWidth: 150, borderRadius: 2, textTransform: 'none', boxShadow: 'none', fontWeight: 'bold' }}
          >
            {loading ? 'Recherche...' : 'Rechercher'}
          </Button>
        </Box>
      </form>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {tracking && !loading && (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight="bold">
              {tracking.patient.lastName} {tracking.patient.firstName}
            </Typography>
            <Chip label={tracking.patient.patientNumber} size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
            <Chip label={tracking.prescription.prescriptionNumber} size="small" color="primary" sx={{ fontWeight: 'bold' }} />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {tracking.readiness.validated} examen{tracking.readiness.validated > 1 ? 's' : ''} validé
            {tracking.readiness.validated > 1 ? 's' : ''} sur {tracking.readiness.total}
          </Typography>

          <List disablePadding>
            {tracking.exams.map((exam) => {
              const state = RESULT_STATES[exam.resultState] || RESULT_STATES.PENDING;
              const { Icon } = state;

              return (
                <ListItem key={exam.prescriptionExamId} disableGutters sx={{ py: 1 }}>
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Icon color={state.color === 'default' ? 'disabled' : state.color} />
                  </ListItemIcon>
                  <ListItemText
                    primary={exam.name}
                    secondary={exam.service ? exam.service.name : null}
                    primaryTypographyProps={{ fontWeight: 'medium' }}
                  />
                  <Chip label={state.label} size="small" color={state.color} sx={{ fontWeight: 'bold' }} />
                </ListItem>
              );
            })}
          </List>

          <Divider sx={{ my: 3 }} />

          {tracking.activeVisit ? (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Ce patient est déjà dans la file aujourd'hui avec le ticket
              n° {String(tracking.activeVisit.ticketNumber).padStart(3, '0')}.
            </Alert>
          ) : tracking.readiness.ready ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
              <Alert severity="success" sx={{ borderRadius: 2, flexGrow: 1, py: 0 }}>
                Tous les résultats sont validés, le patient peut voir le médecin.
              </Alert>
              <Button
                variant="contained"
                size="large"
                startIcon={<TicketIcon />}
                disabled={creating}
                onClick={openReviewVisit}
                sx={{ borderRadius: 2, textTransform: 'none', px: 3, boxShadow: 'none', whiteSpace: 'nowrap' }}
              >
                {creating ? 'Ouverture...' : 'Mettre en file et imprimer'}
              </Button>
            </Box>
          ) : (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              Résultats incomplets. En attente de :{' '}
              <strong>
                {tracking.readiness.missing
                  .map(m => (m.service ? `${m.name} (${m.service})` : m.name))
                  .join(', ')}
              </strong>
              .{' '}
              {/* La date annoncee a la caisse sert de reponse au patient. Si
                  elle est deja passee, le dire franchement plutot que de la
                  repeter : c'est le delai qui a ete trop court. */}
              {expectedLabel
                ? (expectedPassed
                  ? `La date annoncée (${expectedLabel}) est dépassée : prévenir le service concerné.`
                  : `Le patient a été informé d'une disponibilité ${expectedLabel}.`)
                : 'Le patient doit repasser plus tard.'}
            </Alert>
          )}
        </Paper>
      )}
    </Box>
  );
};

export default ResultTracking;
