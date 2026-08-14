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
  Button,
  Badge
} from '@mui/material';
import {
  PersonSearchRounded as PersonSearchIcon,
  PersonAddRounded as PersonAddIcon,
  QueueRounded as QueueIcon,
  QrCode2Rounded as CodeIcon,
  HourglassEmptyRounded as WaitingIcon,
  MedicalServicesRounded as InConsultIcon,
  TodayRounded as TodayIcon,
  TimerRounded as TimerIcon
} from '@mui/icons-material';
import api from '../../services/api';
import PatientSearch from '../../components/patient/PatientSearch';
import PatientForm from '../../components/patient/PatientForm';
import VisitForm from './VisitForm';
import TicketPrint from './TicketPrint';
import QueueBoard from './QueueBoard';
import ResultTracking from './ResultTracking';

// Etapes du parcours d'enregistrement, dans l'ordre :
// recherche -> (creation patient) -> ouverture du passage -> ticket
const STEP_LOOKUP = 'LOOKUP';
const STEP_NEW_PATIENT = 'NEW_PATIENT';
const STEP_EDIT_PATIENT = 'EDIT_PATIENT';
const STEP_VISIT = 'VISIT';
const STEP_TICKET = 'TICKET';

const EMPTY_STATS = {
  total: 0,
  waiting: 0,
  inConsult: 0,
  completed: 0,
  cancelled: 0,
  urgentWaiting: 0,
  avgWaitMinutes: null
};

const ReceptionDashboard = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [step, setStep] = useState(STEP_LOOKUP);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [lastVisit, setLastVisit] = useState(null);
  // Facture des frais de consultation, jointe au ticket : le patient doit
  // repartir de l'accueil en sachant ce qu'il doit et ou le regler.
  const [lastInvoice, setLastInvoice] = useState(null);
  const [stats, setStats] = useState(EMPTY_STATS);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/stats/reception');
      setStats(response.data);
    } catch (error) {
      console.error('Erreur stats accueil:', error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Les compteurs bougent au rythme de la file : meme cadence que le polling
    // de useVisitQueue.
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchStats();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const backToLookup = () => {
    setStep(STEP_LOOKUP);
    setSelectedPatient(null);
    setLastVisit(null);
    setLastInvoice(null);
  };

  const handleOpenVisit = (patient) => {
    setSelectedPatient(patient);
    setStep(STEP_VISIT);
  };

  const handlePatientCreated = (patient) => {
    // Enchainement direct : un patient tout juste enregistre attend a l'accueil,
    // il n'y a aucune raison de repasser par la recherche.
    setSelectedPatient(patient);
    setStep(STEP_VISIT);
  };

  const handleVisitCreated = (visit, consultationInvoice = null) => {
    setLastVisit(visit);
    setLastInvoice(consultationInvoice);
    setStep(STEP_TICKET);
    fetchStats();
  };

  const cardStyle = {
    elevation: 0,
    sx: {
      borderRadius: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      height: '100%'
    }
  };

  const statCards = [
    { value: stats.waiting, label: 'En attente', icon: WaitingIcon, bg: '#fff3e0', color: '#ed6c02' },
    { value: stats.inConsult, label: 'En consultation', icon: InConsultIcon, bg: '#e3f2fd', color: '#1976d2' },
    { value: stats.total, label: 'Passages du jour', icon: TodayIcon, bg: '#e8f5e9', color: '#2e7d32' },
    {
      value: stats.avgWaitMinutes === null ? '—' : `${stats.avgWaitMinutes} min`,
      label: 'Attente moyenne',
      icon: TimerIcon,
      bg: '#f3e5f5',
      color: '#9c27b0'
    }
  ];

  // --- Ecrans plein cadre du parcours d'enregistrement ---

  if (step === STEP_NEW_PATIENT) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PatientForm onBack={backToLookup} onSuccess={handlePatientCreated} />
      </Container>
    );
  }

  if (step === STEP_EDIT_PATIENT && selectedPatient) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PatientForm
          patient={selectedPatient}
          onBack={backToLookup}
          onSuccess={backToLookup}
        />
      </Container>
    );
  }

  if (step === STEP_VISIT && selectedPatient) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <VisitForm
          patient={selectedPatient}
          onBack={backToLookup}
          onSuccess={handleVisitCreated}
        />
      </Container>
    );
  }

  if (step === STEP_TICKET && lastVisit) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <TicketPrint visit={lastVisit} consultationInvoice={lastInvoice} onNext={backToLookup} />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Accueil
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
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">
                    {value}
                  </Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    {label}
                  </Typography>
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
          sx={{
            px: 2,
            pt: 1,
            '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minHeight: 60, fontSize: '1rem' }
          }}
        >
          <Tab icon={<PersonSearchIcon />} label="Enregistrer un patient" iconPosition="start" />
          <Tab icon={<CodeIcon />} label="Retour résultats" iconPosition="start" />
          <Tab
            icon={
              <Badge badgeContent={stats.waiting} color="warning">
                <QueueIcon />
              </Badge>
            }
            label="File d'attente"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {activeTab === 0 && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary">
              Rechercher le patient avant d'en créer un : un patient déjà venu conserve son dossier.
            </Typography>
            <Button
              variant="outlined"
              startIcon={<PersonAddIcon />}
              onClick={() => { setSelectedPatient(null); setStep(STEP_NEW_PATIENT); }}
              sx={{ borderRadius: 2, textTransform: 'none' }}
            >
              Nouveau patient
            </Button>
          </Box>
          <PatientSearch
            onOpenVisit={handleOpenVisit}
            onSelectPatient={handleOpenVisit}
            onEditPatient={(patient) => { setSelectedPatient(patient); setStep(STEP_EDIT_PATIENT); }}
            emptyHint="Si le patient vient pour la première fois, utilisez « Nouveau patient »."
          />
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <ResultTracking onVisitCreated={handleVisitCreated} />
        </Paper>
      )}

      {activeTab === 2 && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <QueueBoard />
        </Paper>
      )}
    </Container>
  );
};

export default ReceptionDashboard;
