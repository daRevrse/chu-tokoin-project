import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button
} from '@mui/material';
import {
  CancelRounded as CancelIcon,
  RefreshRounded as RefreshIcon,
  EventBusyRounded as EmptyIcon
} from '@mui/icons-material';
import api from '../../services/api';
import useVisitQueue from '../../hooks/useVisitQueue';

const STATUS_LABELS = {
  WAITING: { label: 'En attente', color: 'warning' },
  IN_CONSULT: { label: 'En consultation', color: 'info' },
  COMPLETED: { label: 'Terminé', color: 'success' },
  CANCELLED: { label: 'Annulé', color: 'default' }
};

const formatTime = (value) => new Date(value).toLocaleTimeString('fr-FR', {
  hour: '2-digit',
  minute: '2-digit'
});

const waitedMinutes = (visit) => {
  const end = visit.startedAt ? new Date(visit.startedAt) : new Date();
  return Math.max(0, Math.round((end - new Date(visit.createdAt)) / 60000));
};

/**
 * File d'attente du jour, cote accueil.
 * Lecture seule, hormis l'annulation d'un passage.
 */
const QueueBoard = () => {
  const { visits, loading, error, refresh } = useVisitQueue();
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setCancelError('Le motif est requis');
      return;
    }

    setCancelling(true);
    setCancelError('');

    try {
      await api.patch(`/visits/${cancelTarget.id}/cancel`, { cancelReason });
      setCancelTarget(null);
      setCancelReason('');
      refresh();
    } catch (err) {
      setCancelError(err.response?.data?.error || 'Erreur lors de l\'annulation');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h6" fontWeight="bold">
          File d'attente du jour
          <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
            ({visits.length})
          </Typography>
        </Typography>
        <Tooltip title="Rafraîchir" arrow>
          <IconButton onClick={() => refresh()} sx={{ color: 'text.secondary' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#f8fafc' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold' }}>N°</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Motif</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Arrivée</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Attente</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Box sx={{ py: 6 }}>
                    <EmptyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                    <Typography color="textSecondary">
                      Aucun patient en attente
                    </Typography>
                  </Box>
                </TableCell>
              </TableRow>
            ) : (
              visits.map((visit) => {
                const status = STATUS_LABELS[visit.status] || { label: visit.status, color: 'default' };
                const isUrgent = visit.priority === 'URGENT';

                return (
                  <TableRow
                    key={visit.id}
                    hover
                    sx={{
                      bgcolor: isUrgent ? '#fff5f5' : 'inherit',
                      '&:last-child td, &:last-child th': { border: 0 }
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={String(visit.ticketNumber).padStart(3, '0')}
                        color={isUrgent ? 'error' : 'primary'}
                        sx={{ fontWeight: 'bold', fontSize: '1rem' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography fontWeight="bold" variant="body2">
                        {visit.patient?.lastName} {visit.patient?.firstName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {visit.patient?.patientNumber}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 240 }}>
                      <Typography variant="body2" noWrap title={visit.reason || ''}>
                        {visit.reason || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatTime(visit.createdAt)}</TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontWeight={waitedMinutes(visit) > 45 ? 'bold' : 'normal'}
                        color={waitedMinutes(visit) > 45 ? 'error.main' : 'text.secondary'}
                      >
                        {waitedMinutes(visit)} min
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={status.label} size="small" color={status.color} sx={{ fontWeight: 'bold' }} />
                      {visit.doctor && (
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Dr {visit.doctor.lastName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="Annuler le passage" arrow>
                        <IconButton
                          size="small"
                          onClick={() => { setCancelTarget(visit); setCancelError(''); }}
                          sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: '#ffebee' } }}
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          Annuler le passage n° {cancelTarget && String(cancelTarget.ticketNumber).padStart(3, '0')}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Le numéro ne sera pas réattribué.
          </Typography>
          {cancelError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{cancelError}</Alert>}
          <TextField
            fullWidth
            autoFocus
            multiline
            rows={2}
            label="Motif de l'annulation"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelTarget(null)} sx={{ textTransform: 'none' }}>
            Retour
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancel}
            disabled={cancelling}
            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
          >
            {cancelling ? 'Annulation...' : 'Confirmer'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default QueueBoard;
