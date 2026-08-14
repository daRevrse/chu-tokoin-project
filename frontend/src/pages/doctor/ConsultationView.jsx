import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Grid,
  Divider,
  Alert,
  Snackbar
} from '@mui/material';
import {
  ArrowBackRounded as BackIcon,
  DoneAllRounded as CompleteIcon,
  WarningAmberRounded as UrgentIcon
} from '@mui/icons-material';
import api from '../../services/api';
import PrescriptionForm from './PrescriptionForm';

const calculateAge = (dateOfBirth) => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birth = new Date(dateOfBirth);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
};

/**
 * Consultation d'un patient pris en charge depuis la file d'attente.
 *
 * Affiche d'abord ce que l'accueil a releve (motif, constantes), puis le
 * formulaire de prescription rattache au passage.
 */
const ConsultationView = ({ visit, onBack, onCompleted }) => {
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState('');
  const [prescriptionDone, setPrescriptionDone] = useState(false);
  const [review, setReview] = useState(null);

  const patient = visit.patient || {};
  const age = calculateAge(patient.dateOfBirth);
  const isUrgent = visit.priority === 'URGENT';
  const isReview = visit.visitType === 'RESULT_REVIEW';

  // Le patient revient chercher une interpretation : on charge le detail des
  // examens concernes plutot que de laisser le medecin le rechercher.
  useEffect(() => {
    if (!isReview || !visit.reviewedPrescription) return;

    let cancelled = false;
    api.get(`/visits/tracking/${encodeURIComponent(visit.reviewedPrescription.prescriptionNumber)}`)
      .then((response) => { if (!cancelled) setReview(response.data); })
      .catch(() => { /* Le bandeau reste sans detail, la consultation continue. */ });

    return () => { cancelled = true; };
  }, [isReview, visit.reviewedPrescription]);

  const vitals = [
    { label: 'Poids', value: visit.weightKg, unit: 'kg' },
    { label: 'Taille', value: visit.heightCm, unit: 'cm' },
    { label: 'Température', value: visit.temperatureC, unit: '°C' },
    {
      label: 'Tension',
      value: visit.bloodPressureSys && visit.bloodPressureDia
        ? `${visit.bloodPressureSys}/${visit.bloodPressureDia}`
        : null,
      unit: 'mmHg'
    },
    { label: 'Pouls', value: visit.pulseBpm, unit: 'bpm' }
  ].filter(v => v.value !== null && v.value !== undefined && v.value !== '');

  const handleComplete = async () => {
    setCompleting(true);
    setError('');

    try {
      await api.patch(`/visits/${visit.id}/complete`);
      onCompleted();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la clôture de la consultation');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <Box>
      <Button
        startIcon={<BackIcon />}
        onClick={onBack}
        sx={{ mb: 3, borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
      >
        Retour à la file d'attente
      </Button>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {/* Ce que l'accueil a releve */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 4,
          borderRadius: 4,
          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
          borderLeft: '6px solid',
          borderColor: isUrgent ? 'error.main' : 'primary.main'
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Chip
            label={String(visit.ticketNumber).padStart(3, '0')}
            color={isUrgent ? 'error' : 'primary'}
            sx={{ fontWeight: 'bold', fontSize: '1.1rem', height: 40, px: 1 }}
          />
          <Typography variant="h5" fontWeight="bold">
            {patient.lastName} {patient.firstName}
          </Typography>
          <Chip label={patient.patientNumber} size="small" variant="outlined" sx={{ fontWeight: 'bold' }} />
          {age !== null && (
            <Typography color="text.secondary">
              {age} ans · {patient.gender === 'M' ? 'Homme' : 'Femme'}
            </Typography>
          )}
          {isUrgent && <Chip icon={<UrgentIcon />} label="Urgence" color="error" size="small" sx={{ fontWeight: 'bold' }} />}
          {isReview && <Chip label="Retour résultats" color="info" size="small" sx={{ fontWeight: 'bold' }} />}
        </Box>

        {isReview && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Vient chercher l'interprétation de l'ordonnance{' '}
              <strong>{visit.reviewedPrescription?.prescriptionNumber}</strong>
            </Typography>
            {review && (
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {review.exams.map((exam) => (
                  <Chip
                    key={exam.prescriptionExamId}
                    label={exam.service ? `${exam.name} · ${exam.service.name}` : exam.name}
                    size="small"
                    variant="outlined"
                    color="success"
                  />
                ))}
              </Box>
            )}
          </Box>
        )}

        {!isReview && visit.reason && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              Motif relevé à l'accueil
            </Typography>
            <Typography sx={{ mb: 2 }}>{visit.reason}</Typography>
          </>
        )}

        {vitals.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Constantes
            </Typography>
            <Grid container spacing={2}>
              {vitals.map(({ label, value, unit }) => (
                <Grid size={{ xs: 6, sm: 4, md: 2.4 }} key={label}>
                  <Box sx={{ bgcolor: '#f8fafc', borderRadius: 3, p: 2, textAlign: 'center' }}>
                    <Typography variant="h6" fontWeight="bold">
                      {value}
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                        {unit}
                      </Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {label}
                    </Typography>
                  </Box>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        <Divider sx={{ my: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="outlined"
            color="success"
            startIcon={<CompleteIcon />}
            disabled={completing}
            onClick={handleComplete}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            {completing ? 'Clôture...' : 'Terminer la consultation'}
          </Button>
        </Box>
      </Paper>

      <PrescriptionForm
        patient={patient}
        visitId={visit.id}
        onBack={onBack}
        onSuccess={() => setPrescriptionDone(true)}
      />

      <Snackbar
        open={prescriptionDone}
        autoHideDuration={6000}
        onClose={() => setPrescriptionDone(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" sx={{ borderRadius: 2 }} onClose={() => setPrescriptionDone(false)}>
          Prescription enregistrée. Pensez à clôturer la consultation pour libérer la file.
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ConsultationView;
