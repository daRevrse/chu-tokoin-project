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
  PendingActions as PendingIcon,
  CheckCircle as CompletedIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import PendingPrescriptions from './PendingPrescriptions';
import PaymentForm from './PaymentForm';

const CashierDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [recentPayments, setRecentPayments] = useState([]);
  const [stats, setStats] = useState({
    todayPayments: 0,
    todayAmount: 0,
    pendingCount: 0
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
      const [paymentsRes, pendingRes] = await Promise.all([
        api.get('/payments'),
        api.get('/prescriptions/pending')
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
        pendingCount: pending.length
      });
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const handleSelectPrescription = (prescription) => {
    setSelectedPrescription(prescription);
  };

  const handlePaymentSuccess = () => {
    setSelectedPrescription(null);
    fetchRecentPayments();
    fetchStats();
    setActiveTab(1);
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
      CASH: 'Especes',
      MOBILE_MONEY: 'Mobile Money',
      CARD: 'Carte'
    };
    return labels[method] || method;
  };

  if (selectedPrescription) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <PaymentForm
          prescription={selectedPrescription}
          onBack={() => setSelectedPrescription(null)}
          onSuccess={handlePaymentSuccess}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Tableau de Bord Caisse
        </Typography>
        <Typography color="textSecondary">
          Bienvenue, {user?.firstName} {user?.lastName}
        </Typography>
      </Box>

      {/* Statistiques */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Prescriptions en Attente
              </Typography>
              <Typography variant="h3" color="warning.main">
                {stats.pendingCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Paiements Aujourd'hui
              </Typography>
              <Typography variant="h3" color="success.main">
                {stats.todayPayments}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Montant Encaisse Aujourd'hui
              </Typography>
              <Typography variant="h4" color="primary">
                {formatPrice(stats.todayAmount)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Onglets */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab
            icon={<PendingIcon />}
            label={`En Attente (${stats.pendingCount})`}
            iconPosition="start"
          />
          <Tab
            icon={<CompletedIcon />}
            label="Paiements Effectues"
            iconPosition="start"
          />
        </Tabs>
      </Paper>

      {/* Contenu des onglets */}
      {activeTab === 0 && (
        <Paper sx={{ p: 3 }}>
          <PendingPrescriptions onSelectPrescription={handleSelectPrescription} />
        </Paper>
      )}

      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Historique des Paiements
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>N° Paiement</TableCell>
                  <TableCell>Patient</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Mode</TableCell>
                  <TableCell align="right">Montant</TableCell>
                  <TableCell>Statut</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="textSecondary" sx={{ py: 3 }}>
                        Aucun paiement trouve
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPayments.map((payment) => (
                    <TableRow key={payment.id} hover>
                      <TableCell>
                        <Chip
                          label={payment.paymentNumber}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight="medium">
                          {payment.prescription?.patient?.lastName} {payment.prescription?.patient?.firstName}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {payment.prescription?.prescriptionNumber}
                        </Typography>
                      </TableCell>
                      <TableCell>{formatDate(payment.createdAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={getPaymentMethodLabel(payment.paymentMethod)}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography fontWeight="bold" color="success.main">
                          {formatPrice(payment.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={payment.paymentStatus === 'SUCCESS' ? 'Paye' : payment.paymentStatus}
                          color={payment.paymentStatus === 'SUCCESS' ? 'success' : 'warning'}
                          size="small"
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
