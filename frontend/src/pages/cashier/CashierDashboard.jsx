import React, { useState, useEffect } from 'react';
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip
} from '@mui/material';
import {
  PendingActionsRounded as PendingIcon,
  CheckCircleRounded as CompletedIcon,
  AccountBalanceWalletRounded as MoneyIcon,
  ReceiptRounded as ReceiptIcon,
  EventSeatRounded as ConsultationIcon,
  RunningWithErrorsRounded as OutstandingIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PendingPrescriptions from './PendingPrescriptions';
import PaymentForm from './PaymentForm';
import ConsultationPayments from './ConsultationPayments';
import OutstandingInvoices from './OutstandingInvoices';

// Les onglets suivent l'ordre du parcours du patient : il paie sa consultation
// avant de voir le medecin, ses examens apres. Les creances viennent ensuite :
// ce sont les patients qui ont echappe aux deux premieres files.
const TAB_CONSULTATIONS = 0;
const TAB_EXAMS = 1;
const TAB_OUTSTANDING = 2;
const TAB_HISTORY = 3;

const CashierDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(TAB_CONSULTATIONS);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [stats, setStats] = useState({
    todayPayments: 0,
    todayAmount: 0,
    pendingCount: 0,
    consultationCount: 0,
    consultationDue: 0
  });

  useEffect(() => {
    fetchRecentPayments();
    fetchStats();
  }, []);

  const fetchRecentPayments = async () => {
    try {
      const response = await api.get('/payments');
      setRecentPayments(response.data.payments || []);
    } catch (error) {
      console.error('Erreur chargement paiements:', error);
    }
  };

  const fetchStats = async () => {
    try {
      const [paymentsRes, pendingRes, consultationsRes] = await Promise.all([
        api.get('/payments'),
        api.get('/prescriptions/pending'),
        api.get('/invoices/consultations/today')
      ]);

      const payments = paymentsRes.data.payments || [];
      const pending = pendingRes.data.prescriptions || [];

      const today = new Date().toDateString();
      const todayPayments = payments.filter(
        p => new Date(p.createdAt).toDateString() === today
      );

      const todayAmount = todayPayments.reduce(
        (sum, p) => sum + parseFloat(p.amount || 0), 0
      );

      setStats({
        todayPayments: todayPayments.length,
        todayAmount,
        pendingCount: pending.length,
        consultationCount: consultationsRes.data.count || 0,
        consultationDue: consultationsRes.data.totalDue || 0
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const handleSelectPrescription = (prescription) => {
    setSelectedPrescription(prescription);
  };

  // Le paiement est enregistre : on rafraichit les listes en arriere-plan mais
  // on laisse l'ecran de recu affiche. Il porte le QR code et la date de
  // disponibilite a annoncer au patient ; le fermer aussitot les rendait
  // invisibles.
  const handlePaymentRecorded = () => {
    fetchRecentPayments();
    fetchStats();
  };

  // La caissiere a fini d'annoncer et de remettre le recu.
  const handlePaymentDone = () => {
    setSelectedPrescription(null);
    setActiveTab(TAB_HISTORY);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodLabel = (method) => {
    const labels = {
      CASH: 'Espèces',
      MOBILE_MONEY: 'Mobile Money',
      CARD: 'Carte'
    };
    return labels[method] || method;
  };

  // Styles partagés pour les cartes statistiques
  const cardStyle = {
    elevation: 0,
    sx: {
      borderRadius: 4,
      boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      height: '100%',
      '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 12px 30px rgba(0,0,0,0.08)'
      }
    }
  };

  if (selectedPrescription) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PaymentForm
          prescription={selectedPrescription}
          onBack={() => setSelectedPrescription(null)}
          onSuccess={handlePaymentRecorded}
          onDone={handlePaymentDone}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Espace Caisse
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Bienvenue, {user?.firstName} {user?.lastName} 👋
        </Typography>
      </Box>

      {/* Statistiques Modernisées */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card {...cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ bgcolor: '#ede7f6', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <ConsultationIcon sx={{ fontSize: 32, color: '#673ab7' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="textPrimary">
                  {stats.consultationCount}
                </Typography>
                <Typography color="textSecondary" variant="body2" fontWeight="medium">
                  Consultations à Encaisser
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card {...cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ bgcolor: '#fff3e0', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <PendingIcon sx={{ fontSize: 32, color: '#ed6c02' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="textPrimary">
                  {stats.pendingCount}
                </Typography>
                <Typography color="textSecondary" variant="body2" fontWeight="medium">
                  Prescriptions en Attente
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card {...cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ bgcolor: '#e8f5e9', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <ReceiptIcon sx={{ fontSize: 32, color: '#2e7d32' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="textPrimary">
                  {stats.todayPayments}
                </Typography>
                <Typography color="textSecondary" variant="body2" fontWeight="medium">
                  Paiements (Aujourd'hui)
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card {...cardStyle}>
            <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
              <Box sx={{ bgcolor: '#e3f2fd', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                <MoneyIcon sx={{ fontSize: 32, color: '#1976d2' }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight="bold" color="textPrimary">
                  {formatPrice(stats.todayAmount)}
                </Typography>
                <Typography color="textSecondary" variant="body2" fontWeight="medium">
                  Encaissé (Aujourd'hui)
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Onglets */}
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
          <Tab
            icon={<ConsultationIcon />}
            label={`Consultations (${stats.consultationCount})`}
            iconPosition="start"
          />
          <Tab
            icon={<PendingIcon />}
            label={`Examens (${stats.pendingCount})`}
            iconPosition="start"
          />
          <Tab
            icon={<OutstandingIcon />}
            label="Créances"
            iconPosition="start"
          />
          <Tab
            icon={<CompletedIcon />}
            label="Paiements Effectués"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Contenu des onglets */}
      {activeTab === TAB_CONSULTATIONS && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <ConsultationPayments
            onPaymentRecorded={() => { fetchRecentPayments(); fetchStats(); }}
          />
        </Paper>
      )}

      {activeTab === TAB_EXAMS && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <PendingPrescriptions onSelectPrescription={handleSelectPrescription} />
        </Paper>
      )}

      {activeTab === TAB_OUTSTANDING && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <OutstandingInvoices />
        </Paper>
      )}

      {activeTab === TAB_HISTORY && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" fontWeight="bold">
              Historique des Paiements
            </Typography>
          </Box>

          <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
            <Table>
              <TableHead sx={{ bgcolor: '#f8fafc' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 'bold' }}>N° Paiement</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Mode</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Montant</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Box sx={{ py: 6 }}>
                        <ReceiptIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                        <Typography color="textSecondary">
                          Aucun paiement trouvé
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPayments.map((payment) => (
                    <TableRow 
                      key={payment.id} 
                      hover
                      sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                    >
                      <TableCell>
                        <Chip
                          label={payment.paymentNumber}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ fontWeight: 'bold' }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="bold" variant="body2">
                          {payment.prescription?.patient?.lastName} {payment.prescription?.patient?.firstName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {payment.prescription?.prescriptionNumber}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary' }}>{formatDate(payment.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getPaymentMethodLabel(payment.paymentMethod)}
                          size="small"
                          variant="outlined"
                          sx={{ bgcolor: '#f5f7fb' }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="success.main">
                          {formatPrice(payment.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={payment.paymentStatus === 'SUCCESS' ? 'Payé' : payment.paymentStatus}
                          color={payment.paymentStatus === 'SUCCESS' ? 'success' : 'warning'}
                          size="small"
                          sx={{ fontWeight: 'bold' }}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Container>
  );
};

export default CashierDashboard;