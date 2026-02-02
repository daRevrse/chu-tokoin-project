import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Box,
  Tabs,
  Tab,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  TrendingUp,
  People,
  Receipt,
  LocalHospital,
  Download,
  Refresh,
  Assessment
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const AdminDashboard = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [stats, setStats] = useState(null);
  const [financialReport, setFinancialReport] = useState(null);
  const [activityReport, setActivityReport] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedCategory, setSelectedCategory] = useState('RADIOLOGY');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const api = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  });

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, financialRes] = await Promise.all([
        api.get('/reports/stats/global'),
        api.get(`/reports/financial/daily?date=${selectedDate}`)
      ]);

      setStats(statsRes.data);
      setFinancialReport(financialRes.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement des donnees');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityReport = async () => {
    try {
      const response = await api.get(`/reports/activity/service?category=${selectedCategory}&startDate=${startDate}&endDate=${endDate}`);
      setActivityReport(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement du rapport');
    }
  };

  const handleExport = async (format) => {
    try {
      const url = format === 'excel'
        ? `/reports/export/excel?reportType=financial&date=${selectedDate}`
        : `/reports/export/pdf?reportType=financial&date=${selectedDate}`;

      const response = await api.get(url, { responseType: 'blob' });

      const blob = new Blob([response.data]);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `rapport_financier_${selectedDate}.${format === 'excel' ? 'csv' : 'html'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError('Erreur lors de l\'export');
    }
  };

  const formatAmount = (amount) => {
    return (amount || 0).toLocaleString('fr-FR');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ display: 'flex', alignItems: 'center' }}>
          <Assessment sx={{ mr: 1 }} />
          Tableau de Bord Administration
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            size="small"
            label="Date"
            InputLabelProps={{ shrink: true }}
          />
          <Button
            startIcon={<Refresh />}
            onClick={fetchDashboardData}
            variant="outlined"
          >
            Actualiser
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Cartes de statistiques */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'primary.main', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Receipt sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.today?.prescriptions || 0}</Typography>
                    <Typography>Prescriptions du jour</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'success.main', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingUp sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h4">
                      {formatAmount(stats.today?.amount)}
                    </Typography>
                    <Typography>Recettes (FCFA)</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'warning.main', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <LocalHospital sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.today?.examsCompleted || 0}</Typography>
                    <Typography>Examens termines</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'info.main', color: 'white' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <People sx={{ fontSize: 40, mr: 2 }} />
                  <Box>
                    <Typography variant="h4">{stats.totals?.patients || 0}</Typography>
                    <Typography>Patients total</Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* File d'attente */}
      {stats && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="h6" gutterBottom>File d'attente</Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                <Typography variant="h4">{stats.totals?.pendingExams || 0}</Typography>
                <Typography>Examens en attente</Typography>
              </Box>
            </Grid>
            <Grid item xs={6} md={3}>
              <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                <Typography variant="h4">{formatAmount(stats.month?.amount)}</Typography>
                <Typography>Recettes du mois (FCFA)</Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Onglets */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
          <Tab label="Rapport Financier" />
          <Tab label="Activite Services" />
        </Tabs>
      </Paper>

      {/* Rapport Financier */}
      {activeTab === 0 && financialReport && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">Detail des paiements du {financialReport.date}</Typography>
                <Box>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={() => handleExport('excel')}
                    sx={{ mr: 1 }}
                  >
                    CSV
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={() => handleExport('pdf')}
                  >
                    HTML
                  </Button>
                </Box>
              </Box>

              {financialReport.payments?.length === 0 ? (
                <Alert severity="info">Aucun paiement enregistre pour cette date</Alert>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>N° Paiement</TableCell>
                        <TableCell>Patient</TableCell>
                        <TableCell align="right">Montant</TableCell>
                        <TableCell>Methode</TableCell>
                        <TableCell>Caissier</TableCell>
                        <TableCell>Heure</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {financialReport.payments?.map((payment) => (
                        <TableRow key={payment.paymentNumber}>
                          <TableCell>{payment.paymentNumber}</TableCell>
                          <TableCell>{payment.patientName}</TableCell>
                          <TableCell align="right">{formatAmount(payment.amount)} FCFA</TableCell>
                          <TableCell>{payment.paymentMethod}</TableCell>
                          <TableCell>{payment.cashier}</TableCell>
                          <TableCell>{new Date(payment.time).toLocaleTimeString('fr-FR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Resume</Typography>
              <Box sx={{ mb: 2 }}>
                <Typography color="textSecondary">Total paiements</Typography>
                <Typography variant="h5">{financialReport.totalPayments}</Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography color="textSecondary">Montant total</Typography>
                <Typography variant="h5" color="success.main">
                  {formatAmount(financialReport.totalAmount)} FCFA
                </Typography>
              </Box>

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                Par methode de paiement:
              </Typography>
              {financialReport.byPaymentMethod && Object.entries(financialReport.byPaymentMethod).map(([method, amount]) => (
                <Box key={method} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">{method}</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatAmount(amount)} FCFA</Typography>
                </Box>
              ))}

              <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                Par caissier:
              </Typography>
              {financialReport.byCashier && Object.entries(financialReport.byCashier).map(([name, amount]) => (
                <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">{name}</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatAmount(amount)} FCFA</Typography>
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Rapport d'Activite */}
      {activeTab === 1 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Service</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Service"
              >
                <MenuItem value="RADIOLOGY">Radiologie</MenuItem>
                <MenuItem value="LABORATORY">Laboratoire</MenuItem>
              </Select>
            </FormControl>
            <TextField
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              size="small"
              label="Date debut"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              size="small"
              label="Date fin"
              InputLabelProps={{ shrink: true }}
            />
            <Button variant="contained" onClick={fetchActivityReport}>
              Generer le rapport
            </Button>
          </Box>

          {activityReport ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Rapport d'activite - {activityReport.categoryLabel}
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography>Periode: {activityReport.period?.startDate} au {activityReport.period?.endDate}</Typography>
                  <Typography variant="h5" color="primary">{activityReport.totalExams} examens realises</Typography>
                  <Typography variant="h6" color="success.main">{formatAmount(activityReport.totalRevenue)} FCFA</Typography>
                </Box>

                <Typography variant="subtitle2" gutterBottom>Par type d'examen:</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Examen</TableCell>
                        <TableCell align="right">Nombre</TableCell>
                        <TableCell align="right">Recettes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activityReport.byExamType?.map((exam) => (
                        <TableRow key={exam.name}>
                          <TableCell>{exam.name}</TableCell>
                          <TableCell align="right">{exam.count}</TableCell>
                          <TableCell align="right">{formatAmount(exam.revenue)} FCFA</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" gutterBottom>Par technicien:</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Technicien</TableCell>
                        <TableCell align="right">Examens realises</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activityReport.byTechnician?.map((tech) => (
                        <TableRow key={tech.name}>
                          <TableCell>{tech.name}</TableCell>
                          <TableCell align="right">{tech.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">
              Selectionnez un service et une periode, puis cliquez sur "Generer le rapport"
            </Alert>
          )}
        </Paper>
      )}
    </Container>
  );
};

export default AdminDashboard;
