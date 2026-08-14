import React, { useState, useEffect } from 'react';
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
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ConfirmationNumberRounded as TicketIcon,
  RefreshRounded as RefreshIcon,
  EventBusyRounded as EmptyIcon,
  PlayArrowRounded as TakeIcon,
  WarningAmberRounded as UrgentIcon,
  MoneyOffRounded as UnpaidIcon
} from '@mui/icons-material';
import api from '../../services/api';
import useVisitQueue from '../../hooks/useVisitQueue';
import { useAuth } from '../../contexts/AuthContext';

const formatTime = (value) => new Date(value).toLocaleTimeString('fr-FR', {
  hour: '2-digit',
  minute: '2-digit'
});

const formatAmount = (amount) =>
  new Intl.NumberFormat('fr-FR').format(Number(amount) || 0) + ' FCFA';

/**
 * Facture de consultation non soldee du passage, s'il y en a une.
 *
 * La file joint la facture de consultation (`invoices`) : une facture absente
 * signifie qu'aucun tarif n'est defini, donc rien a reclamer.
 */
const unpaidInvoice = (visit) =>
  (visit.invoices || []).find(invoice => invoice.status !== 'PAID') || null;

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
  const { user } = useAuth();
  // Le medecin ouvre sa journee sur sa propre file. Sans ce filtre par defaut,
  // il verrait les patients de toutes les specialites et devrait trier lui-meme.
  const [specialtyFilter, setSpecialtyFilter] = useState(user?.specialtyId || 'ALL');
  const [specialties, setSpecialties] = useState([]);

  const { visits, loading, error, refresh } = useVisitQueue({
    status: 'WAITING',
    specialtyId: specialtyFilter === 'ALL' ? undefined : specialtyFilter
  });
  const [ticketInput, setTicketInput] = useState('');
  const [ticketError, setTicketError] = useState('');
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/specialties?active=true');
        setSpecialties(response.data.specialties || []);
      } catch (err) {
        console.error('Erreur chargement specialites:', err);
      }
    };
    load();
  }, []);

  const takeVisit = async (visitId) => {
    setBusyId(visitId);
    setTicketError('');

    try {
      const response = await api.patch(`/visits/${visitId}/take`);
      onTakeVisit(response.data.visit);
    } catch (err) {
      // 402 = frais de consultation non regles ; 409 = un confrere a pris le
      // patient entre l'affichage et le clic.
      if (err.response?.status === 402) {
        const balance = err.response.data?.invoice?.balance;
        setTicketError(
          `Frais de consultation non réglés${balance ? ` (${formatAmount(balance)} dus)` : ''}. `
          + 'Le patient doit passer à la caisse.'
        );
      } else {
        setTicketError(err.response?.data?.error || 'Erreur lors de la prise en charge');
      }
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <InputLabel>Spécialité</InputLabel>
            <Select
              value={specialtyFilter}
              label="Spécialité"
              onChange={(e) => setSpecialtyFilter(e.target.value)}
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="ALL">Toutes les files</MenuItem>
              {specialties.map((specialty) => (
                <MenuItem key={specialty.id} value={specialty.id}>
                  {specialty.name}
                </MenuItem>
              ))}
              {/* Sans cette entree, un patient que l'accueil a oublie d'orienter
                  n'apparaitrait dans la file d'aucune specialite. */}
              <MenuItem value="none">Non orientés</MenuItem>
            </Select>
          </FormControl>

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
                <TableCell sx={{ fontWeight: 'bold' }}>Spécialité</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Motif</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Constantes</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Arrivée</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Action</TableCell>
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
                  const unpaid = unpaidInvoice(visit);

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
                      <TableCell>
                        {visit.specialty ? (
                          <Chip
                            label={visit.specialty.name}
                            size="small"
                            variant="outlined"
                            sx={{ borderColor: visit.specialty.color || undefined }}
                          />
                        ) : (
                          <Typography variant="caption" color="text.disabled">—</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 220 }}>
                        {/* Un retour resultats n'est pas une consultation : sans
                            cette distinction, il se noie parmi les malades qui
                            arrivent et le medecin ne sait pas ce qui l'attend. */}
                        {visit.visitType === 'RESULT_REVIEW' ? (
                          <>
                            <Chip
                              label="Retour résultats"
                              size="small"
                              color="info"
                              sx={{ fontWeight: 'bold', mb: 0.5 }}
                            />
                            <Typography variant="caption" color="text.secondary" display="block">
                              {visit.reviewedPrescription?.prescriptionNumber}
                            </Typography>
                          </>
                        ) : (
                          <Typography variant="body2" color="text.secondary" noWrap title={visit.reason || ''}>
                            {visit.reason || '—'}
                          </Typography>
                        )}
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
                        {/* Le bouton reste actif sur une urgence impayee : la
                            prise en charge est autorisee, la creance sera
                            marquee a regulariser. */}
                        <Button
                          variant="contained"
                          size="small"
                          color={isUrgent ? 'error' : 'primary'}
                          startIcon={<TakeIcon />}
                          disabled={busyId === visit.id || (Boolean(unpaid) && !isUrgent)}
                          onClick={() => takeVisit(visit.id)}
                          sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none', whiteSpace: 'nowrap' }}
                        >
                          {busyId === visit.id ? 'Ouverture...' : 'Prendre en charge'}
                        </Button>
                        {unpaid && (
                          <Tooltip
                            title={`Reste à payer : ${formatAmount(Number(unpaid.totalAmount) - Number(unpaid.paidAmount))}`}
                            arrow
                          >
                            <Chip
                              icon={<UnpaidIcon />}
                              label={isUrgent ? 'À régulariser' : 'Non réglé'}
                              size="small"
                              color="warning"
                              sx={{ mt: 1, display: 'flex' }}
                            />
                          </Tooltip>
                        )}
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
