import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  TextField,
  Divider
} from '@mui/material';
import {
  CloseRounded as CloseIcon,
  CheckCircleRounded as DoneIcon,
  RadioButtonUncheckedRounded as PendingIcon,
  PlayCircleRounded as CurrentIcon,
  SkipNextRounded as SkipIcon,
  FlagRounded as FinalIcon
} from '@mui/icons-material';
import api from '../../services/api';

/**
 * Circuit de realisation d'un examen : affiche les etapes configurees pour le
 * service et permet de les cloturer une par une.
 */
const ExamSteps = ({ open, onClose, examId, examName, patientName, onCompleted }) => {
  const [steps, setSteps] = useState([]);
  const [examStatus, setExamStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');

  const fetchSteps = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/services/exams/${examId}/steps`);
      setSteps(res.data.steps || []);
      setExamStatus(res.data.examStatus);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement du circuit');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    if (open) {
      setNotes('');
      fetchSteps();
    }
  }, [open, fetchSteps]);

  const handleComplete = async (step, skip = false) => {
    setSaving(true);
    setError('');
    try {
      const res = await api.patch(`/services/exams/${examId}/steps/${step.id}`, {
        notes: notes || undefined,
        skip
      });
      setNotes('');
      await fetchSteps();
      if (res.data.examCompleted && onCompleted) onCompleted();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de la clôture de l\'étape');
    } finally {
      setSaving(false);
    }
  };

  const current = steps.find((s) => s.status === 'IN_PROGRESS');
  const allDone = steps.length > 0 && steps.every((s) => s.status === 'COMPLETED' || s.status === 'SKIPPED');

  const iconFor = (status) => {
    if (status === 'COMPLETED') return <DoneIcon sx={{ color: 'success.main' }} />;
    if (status === 'SKIPPED') return <SkipIcon sx={{ color: 'text.disabled' }} />;
    if (status === 'IN_PROGRESS') return <CurrentIcon sx={{ color: 'primary.main' }} />;
    return <PendingIcon sx={{ color: 'text.disabled' }} />;
  };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pt: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">Circuit de réalisation</Typography>
          <Typography variant="body2" color="textSecondary">
            {examName}{patientName ? ` — ${patientName}` : ''}
          </Typography>
        </Box>
        <IconButton onClick={onClose} disabled={saving} sx={{ color: 'text.secondary' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : steps.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Aucune étape configurée pour ce service : l'examen suit le circuit court
            (démarré puis terminé).
          </Alert>
        ) : (
          <>
            {steps.map((step, index) => {
              const isCurrent = step.status === 'IN_PROGRESS';
              return (
                <Box
                  key={step.id}
                  sx={{
                    display: 'flex',
                    gap: 2,
                    p: 2,
                    mb: 1.5,
                    borderRadius: 3,
                    bgcolor: isCurrent ? '#e3f2fd' : '#f8fafc',
                    border: '1px solid',
                    borderColor: isCurrent ? '#90caf9' : 'divider'
                  }}
                >
                  <Box sx={{ pt: 0.3 }}>{iconFor(step.status)}</Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" fontWeight="bold">
                        {index + 1}. {step.name}
                      </Typography>
                      {step.producesResult && (
                        <Chip icon={<FinalIcon />} label="Clôture l'examen" size="small" color="success"
                          variant="outlined" sx={{ fontWeight: 'bold' }} />
                      )}
                      {!step.isRequired && (
                        <Chip label="Facultative" size="small" variant="outlined" sx={{ bgcolor: 'white' }} />
                      )}
                    </Box>
                    {step.performedBy && (
                      <Typography variant="caption" color="textSecondary" display="block">
                        {step.status === 'SKIPPED' ? 'Ignorée' : 'Réalisée'} par {step.performedBy}
                        {step.completedAt && ` le ${new Date(step.completedAt).toLocaleString('fr-FR')}`}
                      </Typography>
                    )}
                    {step.notes && (
                      <Typography variant="caption" color="textSecondary" display="block" sx={{ fontStyle: 'italic' }}>
                        « {step.notes} »
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}

            {current && (
              <>
                <Divider sx={{ my: 3 }} />
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  Étape en cours : {current.name}
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  size="small"
                  placeholder="Observations (optionnel)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  sx={{ mt: 1, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
                <Box sx={{ display: 'flex', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<DoneIcon />}
                    onClick={() => handleComplete(current, false)}
                    disabled={saving}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
                  >
                    {saving ? 'En cours...' : (current.producesResult ? 'Terminer l\'examen' : 'Étape terminée')}
                  </Button>
                  {!current.isRequired && (
                    <Button
                      startIcon={<SkipIcon />}
                      onClick={() => handleComplete(current, true)}
                      disabled={saving}
                      sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
                    >
                      Ignorer
                    </Button>
                  )}
                </Box>
              </>
            )}

            {allDone && (
              <Alert severity="success" sx={{ mt: 3, borderRadius: 2, fontWeight: 'bold' }}>
                Circuit terminé — examen {examStatus === 'COMPLETED' ? 'clôturé' : 'en attente de clôture'}.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button onClick={onClose} disabled={saving}
          sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}>
          Fermer
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ExamSteps;
