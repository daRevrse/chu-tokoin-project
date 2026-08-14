import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Tabs,
  Tab,
  Badge,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  EmergencyRounded as EmergencyIcon,
  MonitorHeartRounded as TriageIcon,
  PersonAddAlt1Rounded as AdmitIcon,
  QueueRounded as QueueIcon,
  HelpOutlineRounded as UnknownIcon
} from '@mui/icons-material';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import EmergencyAdmission from './EmergencyAdmission';
import EmergencyQueue from './EmergencyQueue';
import { STATUS_LABELS, displayName } from './triage';

const POLL_INTERVAL_MS = 15000;

const TAB_QUEUE = 0;
const TAB_ADMIT = 1;
const TAB_UNIDENTIFIED = 2;

/**
 * Espace du service d'accueil des urgences.
 *
 * La file est le premier onglet, et non l'admission : le personnel passe sa
 * journee a surveiller qui attend, pas a saisir des arrivees.
 */
const EmergencyDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(TAB_QUEUE);
  const [stats, setStats] = useState({ count: 0, awaitingTriage: 0, inCare: 0 });
  const [unidentified, setUnidentified] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchStats = useCallback(async () => {
    try {
      const [queueRes, unidentifiedRes] = await Promise.all([
        api.get('/emergencies/queue'),
        api.get('/emergencies/unidentified')
      ]);

      const cases = queueRes.data.emergencyCases || [];
      setStats({
        count: cases.length,
        awaitingTriage: queueRes.data.awaitingTriage || 0,
        inCare: cases.filter(c => c.status === 'IN_CARE').length
      });
      setUnidentified(unidentifiedRes.data.emergencyCases || []);
    } catch (error) {
      console.error('Erreur stats urgences:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStats, refreshKey]);

  const handleAdmitted = () => {
    setRefreshKey(k => k + 1);
    setActiveTab(TAB_QUEUE);
  };

  const cardStyle = {
    elevation: 0,
    sx: { borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', height: '100%' }
  };

  const statCards = [
    { value: stats.count, label: 'Patients dans le service', icon: EmergencyIcon, bg: '#ffebee', color: '#d32f2f' },
    { value: stats.awaitingTriage, label: 'En attente de triage', icon: TriageIcon, bg: '#fff3e0', color: '#ed6c02' },
    { value: stats.inCare, label: 'Pris en charge', icon: QueueIcon, bg: '#e3f2fd', color: '#1976d2' },
    { value: unidentified.length, label: 'Dossiers non identifiés', icon: UnknownIcon, bg: '#f3e5f5', color: '#7b1fa2' }
  ];

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Urgences
        </Typography>
        <Typography variant="body1" color="textSecondary">
          {user?.firstName} {user?.lastName} — les soins ne sont jamais conditionnés au règlement.
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map(({ value, label, icon: Icon, bg, color }) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={label}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: bg, width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <Icon sx={{ fontSize: 32, color }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">{value}</Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">{label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Paper elevation={0} sx={{ mb: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
          sx={{ px: 2, pt: 1, '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minHeight: 60, fontSize: '1rem' } }}
        >
          <Tab
            icon={<Badge badgeContent={stats.awaitingTriage} color="warning"><QueueIcon /></Badge>}
            label="File d'attente"
            iconPosition="start"
          />
          <Tab icon={<AdmitIcon />} label="Admettre un patient" iconPosition="start" />
          <Tab
            icon={<Badge badgeContent={unidentified.length} color="secondary"><UnknownIcon /></Badge>}
            label="Non identifiés"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {activeTab === TAB_QUEUE && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <EmergencyQueue key={refreshKey} />
        </Paper>
      )}

      {activeTab === TAB_ADMIT && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <EmergencyAdmission onAdmitted={handleAdmitted} />
        </Paper>
      )}

      {activeTab === TAB_UNIDENTIFIED && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
            Dossiers jamais identifiés
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Aucune créance n'a pu être ouverte sur ces dossiers : il n'y a personne à qui
            la présenter. Ils restent ici jusqu'à ce qu'un patient leur soit rattaché.
          </Typography>

          {unidentified.length === 0 ? (
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Tous les dossiers d'urgence sont rattachés à un patient.
            </Alert>
          ) : (
            <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
              <Table>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Dossier</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Désignation provisoire</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Arrivée</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {unidentified.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">{c.caseNumber}</Typography>
                      </TableCell>
                      <TableCell>{displayName(c)}</TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>
                        {new Date(c.arrivalAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                      </TableCell>
                      <TableCell>
                        <Chip label={STATUS_LABELS[c.status] || c.status} size="small" variant="outlined" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      )}
    </Container>
  );
};

export default EmergencyDashboard;
