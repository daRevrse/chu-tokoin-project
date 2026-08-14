import React, { useState, useEffect, useCallback } from 'react';
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
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  IconButton,
  InputAdornment
} from '@mui/material';
import {
  RefreshRounded as RefreshIcon,
  PlayArrowRounded as TakeIcon,
  LogoutRounded as DischargeIcon,
  MonitorHeartRounded as TriageIcon,
  PersonSearchRounded as IdentifyIcon,
  DirectionsRunRounded as LeftIcon,
  CheckCircleOutlineRounded as EmptyIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import PatientSearch from '../../components/patient/PatientSearch';
import {
  TRIAGE_LEVELS,
  OUTCOMES,
  STATUS_LABELS,
  getTriage,
  waitedMinutes,
  isOverdue,
  displayName
} from './triage';

const POLL_INTERVAL_MS = 15000;

const VITALS = [
  { name: 'temperatureC', label: 'Température', unit: '°C', min: 25, max: 45, step: 0.1 },
  { name: 'bloodPressureSys', label: 'TA systolique', unit: 'mmHg', min: 30, max: 300, step: 1 },
  { name: 'bloodPressureDia', label: 'TA diastolique', unit: 'mmHg', min: 10, max: 200, step: 1 },
  { name: 'pulseBpm', label: 'Pouls', unit: 'bpm', min: 10, max: 300, step: 1 },
  { name: 'oxygenSaturation', label: 'SpO2', unit: '%', min: 10, max: 100, step: 1 }
];

/**
 * File des urgences.
 *
 * Elle n'est pas ordonnee par l'heure d'arrivee mais par la gravite, et les
 * dossiers non tries passent devant tout le monde — personne ne les a encore
 * evalues. Le temps d'attente est affiche a cote du niveau : c'est le
 * croisement des deux qui signale un probleme, pas l'un des deux seul.
 */
const EmergencyQueue = () => {
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [triageDialog, setTriageDialog] = useState(null);
  const [dischargeDialog, setDischargeDialog] = useState(null);
  const [identifyDialog, setIdentifyDialog] = useState(null);

  const fetchQueue = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get('/emergencies/queue');
      setCases(response.data.emergencyCases || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de charger la file des urgences');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchQueue({ silent: true });
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const act = async (id, path, body) => {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/emergencies/${id}/${path}`, body || {});
      await fetchQueue({ silent: true });
      return true;
    } catch (err) {
      setError(err.response?.data?.error
        || err.response?.data?.errors?.[0]?.msg
        || 'Erreur lors de l\'opération');
      await fetchQueue({ silent: true });
      return false;
    } finally {
      setBusyId(null);
    }
  };

  const canTriage = ['NURSE', 'DOCTOR', 'ADMIN'].includes(user?.role);
  const canTreat = ['DOCTOR', 'ADMIN'].includes(user?.role);

  const submitTriage = async () => {
    const { id, triageLevel, triageNotes, ...vitals } = triageDialog;
    const payload = Object.entries(vitals).reduce((acc, [key, value]) => {
      if (value !== '' && value !== undefined) acc[key] = value;
      return acc;
    }, { triageLevel, triageNotes });

    if (await act(id, 'triage', payload)) setTriageDialog(null);
  };

  const submitDischarge = async () => {
    const { id, outcome, outcomeNotes } = dischargeDialog;
    if (await act(id, 'discharge', { outcome, outcomeNotes })) setDischargeDialog(null);
  };

  const submitIdentify = async (patient) => {
    if (await act(identifyDialog.id, 'identify', { patientId: patient.id })) {
      setIdentifyDialog(null);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">
            Patients dans le service
            <Typography component="span" color="text.secondary" sx={{ ml: 1 }}>
              ({cases.length})
            </Typography>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Classés par gravité. Les dossiers non triés passent en tête.
          </Typography>
        </Box>
        <Tooltip title="Rafraîchir" arrow>
          <IconButton onClick={() => fetchQueue()} sx={{ color: 'text.secondary' }}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : cases.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, border: '1px solid', borderColor: 'divider' }}>
          <EmptyIcon sx={{ fontSize: 48, color: 'success.main', mb: 2 }} />
          <Typography color="textSecondary">Aucun patient dans le service.</Typography>
        </Paper>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Gravité</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Dossier</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Motif</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Constantes</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Attente</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cases.map((c) => {
                const triage = getTriage(c.triageLevel);
                const waited = waitedMinutes(c);
                const overdue = isOverdue(c);
                const untriaged = c.status === 'AWAITING_TRIAGE';

                return (
                  <TableRow
                    key={c.id}
                    hover
                    sx={{ bgcolor: untriaged ? '#fff8e1' : (triage ? triage.bgColor : 'inherit') }}
                  >
                    <TableCell>
                      {triage ? (
                        <Chip
                          label={`${triage.level} — ${triage.label}`}
                          size="small"
                          sx={{ bgcolor: triage.color, color: 'white', fontWeight: 'bold' }}
                        />
                      ) : (
                        <Chip label="À TRIER" size="small" color="warning" sx={{ fontWeight: 'bold' }} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">{c.caseNumber}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {STATUS_LABELS[c.status] || c.status}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">{displayName(c)}</Typography>
                      {c.patient ? (
                        <Typography variant="caption" color="text.secondary">
                          {c.patient.patientNumber}
                        </Typography>
                      ) : (
                        <Chip label="Non identifié" size="small" color="warning" variant="outlined" sx={{ mt: 0.5 }} />
                      )}
                    </TableCell>
                    <TableCell sx={{ maxWidth: 200 }}>
                      <Typography variant="body2" color="text.secondary" noWrap title={c.chiefComplaint || ''}>
                        {c.chiefComplaint || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {c.temperatureC ? `${c.temperatureC} °C` : null}
                        {c.bloodPressureSys && c.bloodPressureDia ? ` · ${c.bloodPressureSys}/${c.bloodPressureDia}` : null}
                        {c.pulseBpm ? ` · ${c.pulseBpm} bpm` : null}
                        {c.oxygenSaturation ? ` · SpO2 ${c.oxygenSaturation} %` : null}
                        {!c.temperatureC && !c.bloodPressureSys && !c.pulseBpm && !c.oxygenSaturation && '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {/* Le delai cible du niveau est depasse : l'information ne
                          sert a rien si elle n'est pas visible sans la chercher. */}
                      <Typography
                        variant="body2"
                        fontWeight={overdue ? 'bold' : 'normal'}
                        color={overdue ? 'error.main' : 'text.secondary'}
                      >
                        {waited} min
                      </Typography>
                      {overdue && (
                        <Typography variant="caption" color="error.main">
                          délai dépassé
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                        {canTriage && c.status !== 'IN_CARE' && (
                          <Button
                            size="small"
                            variant={untriaged ? 'contained' : 'outlined'}
                            color="warning"
                            startIcon={<TriageIcon />}
                            disabled={busyId === c.id}
                            onClick={() => setTriageDialog({
                              id: c.id,
                              name: displayName(c),
                              triageLevel: c.triageLevel || 3,
                              triageNotes: c.triageNotes || '',
                              temperatureC: c.temperatureC || '',
                              bloodPressureSys: c.bloodPressureSys || '',
                              bloodPressureDia: c.bloodPressureDia || '',
                              pulseBpm: c.pulseBpm || '',
                              oxygenSaturation: c.oxygenSaturation || ''
                            })}
                            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
                          >
                            {untriaged ? 'Trier' : 'Recoter'}
                          </Button>
                        )}

                        {!c.patient && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<IdentifyIcon />}
                            onClick={() => setIdentifyDialog({ id: c.id, name: displayName(c) })}
                            sx={{ borderRadius: 2, textTransform: 'none' }}
                          >
                            Identifier
                          </Button>
                        )}

                        {canTreat && c.status !== 'IN_CARE' && (
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<TakeIcon />}
                            disabled={busyId === c.id}
                            onClick={() => act(c.id, 'take')}
                            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
                          >
                            Prendre en charge
                          </Button>
                        )}

                        {canTreat && c.status === 'IN_CARE' && (
                          <Button
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<DischargeIcon />}
                            disabled={busyId === c.id}
                            onClick={() => setDischargeDialog({ id: c.id, name: displayName(c), outcome: 'HOME', outcomeNotes: '' })}
                            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
                          >
                            Sortie
                          </Button>
                        )}

                        {c.status !== 'IN_CARE' && (
                          <Tooltip title="Patient parti sans être vu" arrow>
                            <span>
                              <IconButton
                                size="small"
                                disabled={busyId === c.id}
                                onClick={() => act(c.id, 'leave')}
                              >
                                <LeftIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* --- Triage --- */}
      <Dialog open={Boolean(triageDialog)} onClose={() => setTriageDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Triage — {triageDialog?.name}</DialogTitle>
        <DialogContent>
          {triageDialog && (
            <Box sx={{ pt: 1 }}>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Niveau de gravité</InputLabel>
                <Select
                  value={triageDialog.triageLevel}
                  label="Niveau de gravité"
                  onChange={(e) => setTriageDialog({ ...triageDialog, triageLevel: e.target.value })}
                >
                  {TRIAGE_LEVELS.map(t => (
                    <MenuItem key={t.level} value={t.level}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: t.color }} />
                        {t.level} — {t.label} : {t.description}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 2, mb: 3 }}>
                {VITALS.map(({ name, label, unit, min, max, step }) => (
                  <TextField
                    key={name}
                    size="small"
                    type="number"
                    label={label}
                    value={triageDialog[name]}
                    onChange={(e) => setTriageDialog({ ...triageDialog, [name]: e.target.value })}
                    inputProps={{ min, max, step }}
                    InputProps={{ endAdornment: <InputAdornment position="end">{unit}</InputAdornment> }}
                  />
                ))}
              </Box>

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Observations"
                value={triageDialog.triageNotes}
                onChange={(e) => setTriageDialog({ ...triageDialog, triageNotes: e.target.value })}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTriageDialog(null)} sx={{ textTransform: 'none' }}>Annuler</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={submitTriage}
            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
          >
            Enregistrer le triage
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Sortie --- */}
      <Dialog open={Boolean(dischargeDialog)} onClose={() => setDischargeDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Sortie — {dischargeDialog?.name}</DialogTitle>
        <DialogContent>
          {dischargeDialog && (
            <Box sx={{ pt: 1 }}>
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Orientation</InputLabel>
                <Select
                  value={dischargeDialog.outcome}
                  label="Orientation"
                  onChange={(e) => setDischargeDialog({ ...dischargeDialog, outcome: e.target.value })}
                >
                  {OUTCOMES.map(o => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Observations de sortie"
                value={dischargeDialog.outcomeNotes}
                onChange={(e) => setDischargeDialog({ ...dischargeDialog, outcomeNotes: e.target.value })}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDischargeDialog(null)} sx={{ textTransform: 'none' }}>Annuler</Button>
          <Button
            variant="contained"
            color="success"
            onClick={submitDischarge}
            sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
          >
            Enregistrer la sortie
          </Button>
        </DialogActions>
      </Dialog>

      {/* --- Identification --- */}
      <Dialog open={Boolean(identifyDialog)} onClose={() => setIdentifyDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>Rattacher un patient — {identifyDialog?.name}</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            Le rattachement ouvre la créance : jusque-là, il n'y avait personne à qui la présenter.
          </Alert>
          <PatientSearch
            onSelectPatient={submitIdentify}
            onOpenVisit={submitIdentify}
            emptyHint="Le patient doit exister au fichier. S'il est inconnu, faites-le créer à l'accueil."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIdentifyDialog(null)} sx={{ textTransform: 'none' }}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmergencyQueue;
