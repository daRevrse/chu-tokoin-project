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
  Button,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Tooltip,
  IconButton
} from '@mui/material';
import {
  ConfirmationNumberRounded as TicketIcon,
  RefreshRounded as RefreshIcon,
  EventBusyRounded as EmptyIcon,
  PlayArrowRounded as TakeIcon,
  WarningAmberRounded as UrgentIcon
} from '@mui/icons-material';
import api from '../../services/api';
import useVisitQueue from '../../hooks/useVisitQueue';

const formatTime = (value) => new Date(value).toLocaleTimeString('fr-FR', {
  hour: '2-digit',
  minute: '2-digit'
});

const waitedMinutes = (visit) => Math.max(
  0,
  Math.round((Date.now() - new Date(visit.createdAt)) / 60000)
);

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
 * File d'attente du jour, cote medecin.
 *
 * Le chemin principal est le clic sur une ligne : le medecin voit qui attend
 * et depuis combien de temps. La saisie du numero de ticket reste disponible
 * comme raccourci, mais elle n'est pas le parcours nominal (une frappe erronee
 * ouvre le dossier d'un autre patient).
 */
const VisitQueue = ({ onTakeVisit }) => {
  const { visits, loading, error, refresh } = useVisitQueue({ status: 'WAITING' });
  const [ticketInput, setTicketInput] = useState('');
  const [ticketError, setTicketError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const takeVisit = async (visitId) => {
    setBusyId(visitId);
    setTicketError('');

    try {
      const response = await api.patch(`/visits/${visitId}/take`);
      onTakeVisit(response.data.visit);
    } catch (err) {
      // 409 = un confrere a pris le patient entre l'affichage et le clic
      setTicketError(err.response?.data?.error || 'Erreur lors de la prise en charge');
      refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleTicketSubmit = async (e) => {
    e.preventDefault();

    const number = ticketInput.trim();
    if (!number) return;

    setTicketError('');

    try {
      const response = await api.get(`/visits/today/${encodeURIComponent(number)}`);
      const visit = response.data.visit;

      if (visit.status !== 'WAITING') {
        setTicketError(
          visit.status === 'IN_CONSULT'
            ? `Le ticket n° ${number} est déjà pris en charge${visit.doctor ? ` par Dr ${visit.doctor.lastName}` : ''}`
            : `Le ticket n° ${number} n'est plus en attente`
        );
        return;
      }

      setTicketInput('');
      await takeVisit(visit.id);
    } catch (err) {
      setTicketError(err.response?.data?.error || 'Numéro introuvable');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" fontWeight="bold">
          Patients en attente
          <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
            ({visits.length})
          </Typography>
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <form onSubmit={handleTicketSubmit}>
            <TextField
              size="small"
              type="number"
              placeholder="N° ticket"
              value={ticketInput}
              onChange={(e) => { setTicketInput(e.target.value); setTicketError(''); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <TicketIcon fontSize="small" color="action" />
                  </InputAdornment>
                )
              }}
              inputProps={{ min: 1 }}
              sx={{ width: 160, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
          </form>
          <Tooltip title="Rafraîchir" arrow>
            <IconButton onClick={() => refresh()} sx={{ color: 'text.secondary' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {ticketError && <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>{ticketError}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>N°</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Motif</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Constantes</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Arrivée</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Box sx={{ py: 6 }}>
                      <EmptyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                      <Typography color="textSecondary">
                        Aucun patient en attente
                      </Typography>
                      <Typography variant="body2" color="text.disabled" sx={{ mt: 1 }}>
                        Les patients apparaissent ici dès leur enregistrement à l'accueil.
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                visits.map((visit) => {
                  const isUrgent = visit.priority === 'URGENT';
                  const age = calculateAge(visit.patient?.dateOfBirth);
                  const waited = waitedMinutes(visit);

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
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={String(visit.ticketNumber).padStart(3, '0')}
                            color={isUrgent ? 'error' : 'primary'}
                            sx={{ fontWeight: 'bold', fontSize: '1rem' }}
                          />
                          {isUrgent && (
                            <Tooltip title="Urgence" arrow>
                              <UrgentIcon color="error" fontSize="small" />
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="bold" variant="body2">
                          {visit.patient?.lastName} {visit.patient?.firstName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {visit.patient?.patientNumber}
                          {age !== null && ` · ${age} ans`}
                          {visit.patient?.gender && ` · ${visit.patient.gender === 'M' ? 'H' : 'F'}`}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        <Typography variant="body2" color="text.secondary" noWrap title={visit.reason || ''}>
                          {visit.reason || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {visit.temperatureC ? `${visit.temperatureC} °C` : null}
                          {visit.bloodPressureSys && visit.bloodPressureDia
                            ? ` · ${visit.bloodPressureSys}/${visit.bloodPressureDia}`
                            : null}
                          {visit.pulseBpm ? ` · ${visit.pulseBpm} bpm` : null}
                          {!visit.temperatureC && !visit.bloodPressureSys && !visit.pulseBpm && '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatTime(visit.createdAt)}
                        </Typography>
                        <Typography
                          variant="caption"
                          fontWeight={waited > 45 ? 'bold' : 'normal'}
                          color={waited > 45 ? 'error.main' : 'text.disabled'}
                        >
                          {waited} min d'attente
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          size="small"
                          color={isUrgent ? 'error' : 'primary'}
                          startIcon={<TakeIcon />}
                          disabled={busyId === visit.id}
                          onClick={() => takeVisit(visit.id)}
                          sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none', whiteSpace: 'nowrap' }}
                        >
                          {busyId === visit.id ? 'Ouverture...' : 'Prendre en charge'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default VisitQueue;
