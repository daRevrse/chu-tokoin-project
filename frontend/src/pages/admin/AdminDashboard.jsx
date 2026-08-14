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
  TrendingUpRounded as TrendingUp,
  PeopleRounded as People,
  ReceiptRounded as Receipt,
  LocalHospitalRounded as LocalHospital,
  DownloadRounded as Download,
  RefreshRounded as Refresh,
  AssessmentRounded as Assessment,
  HourglassEmptyRounded as PendingIcon,
  AccountBalanceWalletRounded as WalletIcon,
  MenuBookRounded as CatalogIcon,
  AccountTreeRounded as ServiceConfigIcon,
  ApartmentRounded as HospitalIdentityIcon,
  MedicalInformationRounded as SpecialtyIcon,
  RunningWithErrorsRounded as OutstandingIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import UserManagement from './UserManagement';
import ExamManagement from './ExamManagement';
import ServiceManagement from './ServiceManagement';
import SpecialtyManagement from './SpecialtyManagement';
import OutstandingInvoices from '../cashier/OutstandingInvoices';
import HospitalSettings from './HospitalSettings';

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
      setError(err.response?.data?.error || 'Erreur lors du chargement des données');
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
      setError("Erreur lors de l'export");
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

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ bgcolor: '#ffebee', width: 48, height: 48, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Assessment sx={{ fontSize: 26, color: '#d32f2f' }} />
          </Box>
          <Typography variant="h4" fontWeight="bold">
            Tableau de Bord Administration
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            size="small"
            label="Date"
            InputLabelProps={{ shrink: true }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: 'white' } }}
          />
          <Button
            startIcon={<Refresh />}
            onClick={fetchDashboardData}
            variant="outlined"
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
          >
            Actualiser
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Cartes de statistiques Modernisées */}
      {stats && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#e3f2fd', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <Receipt sx={{ fontSize: 32, color: '#1976d2' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">
                    {stats.today?.prescriptions || 0}
                  </Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    Prescriptions du jour
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#e8f5e9', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <TrendingUp sx={{ fontSize: 32, color: '#2e7d32' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">
                    {formatAmount(stats.today?.amount)}
                  </Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    Recettes (FCFA)
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#fff3e0', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <LocalHospital sx={{ fontSize: 32, color: '#ed6c02' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">
                    {stats.today?.examsCompleted || 0}
                  </Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    Examens terminés
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card {...cardStyle}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', p: 3 }}>
                <Box sx={{ bgcolor: '#f3e5f5', width: 64, height: 64, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <People sx={{ fontSize: 32, color: '#9c27b0' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold" color="textPrimary">
                    {stats.totals?.patients || 0}
                  </Typography>
                  <Typography color="textSecondary" variant="body2" fontWeight="medium">
                    Patients au total
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* File d'attente */}
      {stats && (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, mb: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>File d'attente</Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', p: 3, bgcolor: '#fff3e0', borderRadius: 3 }}>
                <Box sx={{ bgcolor: 'white', width: 56, height: 56, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <PendingIcon sx={{ fontSize: 28, color: '#ed6c02' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{stats.totals?.pendingExams || 0}</Typography>
                  <Typography variant="body2" fontWeight="medium" color="textSecondary">Examens en attente</Typography>
                </Box>
              </Box>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', p: 3, bgcolor: '#e8f5e9', borderRadius: 3 }}>
                <Box sx={{ bgcolor: 'white', width: 56, height: 56, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 2 }}>
                  <WalletIcon sx={{ fontSize: 28, color: '#2e7d32' }} />
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight="bold">{formatAmount(stats.month?.amount)}</Typography>
                  <Typography variant="body2" fontWeight="medium" color="textSecondary">Recettes du mois (FCFA)</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Paper>
      )}

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
          <Tab icon={<Assessment />} iconPosition="start" label="Rapport Financier" />
          <Tab icon={<OutstandingIcon />} iconPosition="start" label="Créances et dérogations" />
          <Tab icon={<LocalHospital />} iconPosition="start" label="Activité Services" />
          <Tab icon={<People />} iconPosition="start" label="Utilisateurs" />
          <Tab icon={<CatalogIcon />} iconPosition="start" label="Catalogue d'examens" />
          <Tab icon={<ServiceConfigIcon />} iconPosition="start" label="Services" />
          <Tab icon={<SpecialtyIcon />} iconPosition="start" label="Spécialités et tarifs" />
          <Tab icon={<HospitalIdentityIcon />} iconPosition="start" label="Établissement" />
        </Tabs>
      </Paper>

      {/* Rapport Financier */}
      {activeTab === 0 && financialReport && (
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, height: '100%', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h6" fontWeight="bold">Détail des paiements du {financialReport.date}</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={() => handleExport('excel')}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', color: 'text.secondary' }}
                  >
                    CSV
                  </Button>
                  <Button
                    size="small"
                    startIcon={<Download />}
                    onClick={() => handleExport('pdf')}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', color: 'text.secondary' }}
                  >
                    HTML
                  </Button>
                </Box>
              </Box>

              {financialReport.payments?.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>Aucun paiement enregistré pour cette date</Alert>
              ) : (
                <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>N° Paiement</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Montant</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Méthode</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Caissier</TableCell>
                        <TableCell sx={{ fontWeight: 'bold' }}>Heure</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {financialReport.payments?.map((payment) => (
                        <TableRow key={payment.paymentNumber} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">{payment.paymentNumber}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">{payment.patientName}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {formatAmount(payment.amount)} FCFA
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{payment.paymentMethod}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{payment.cashier}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{new Date(payment.time).toLocaleTimeString('fr-FR')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, height: '100%', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>Résumé</Typography>

              <Box sx={{ p: 2.5, bgcolor: '#f8fafc', borderRadius: 3, mb: 2 }}>
                <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Total paiements</Typography>
                <Typography variant="h5" fontWeight="bold">{financialReport.totalPayments}</Typography>
              </Box>
              <Box sx={{ p: 2.5, bgcolor: '#e8f5e9', borderRadius: 3, mb: 3 }}>
                <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Montant total</Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">
                  {formatAmount(financialReport.totalAmount)} FCFA
                </Typography>
              </Box>

              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mb: 1 }}>
                Par méthode de paiement
              </Typography>
              {financialReport.byPaymentMethod && Object.entries(financialReport.byPaymentMethod).map(([method, amount]) => (
                <Box key={method} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="textSecondary">{method}</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatAmount(amount)} FCFA</Typography>
                </Box>
              ))}

              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mt: 3, mb: 1 }}>
                Par caissier
              </Typography>
              {financialReport.byCashier && Object.entries(financialReport.byCashier).map(([name, amount]) => (
                <Box key={name} sx={{ display: 'flex', justifyContent: 'space-between', py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="textSecondary">{name}</Typography>
                  <Typography variant="body2" fontWeight="bold">{formatAmount(amount)} FCFA</Typography>
                </Box>
              ))}
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* Rapport d'Activite */}
      {/* Prises en charge accordees sans reglement : un contournement que
          personne ne regarde devient la norme en trois semaines. En lecture
          seule ici, l'encaissement se fait a la caisse. */}
      {activeTab === 1 && (
        <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <OutstandingInvoices
            canCollect={false}
            defaultFilter="DEFERRED"
            title="Soins délivrés sans règlement"
            subtitle="Prises en charge accordées avant paiement (urgences et dérogations), et créances encore ouvertes."
          />
        </Paper>
      )}

      {activeTab === 2 && (
        <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Service</InputLabel>
              <Select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                label="Service"
                sx={{ borderRadius: 2 }}
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
              label="Date début"
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <TextField
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              size="small"
              label="Date fin"
              InputLabelProps={{ shrink: true }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />
            <Button
              variant="contained"
              onClick={fetchActivityReport}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3 }}
            >
              Générer le rapport
            </Button>
          </Box>

          {activityReport ? (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Rapport d'activité — {activityReport.categoryLabel}
                </Typography>
                <Box sx={{ mb: 3, p: 3, bgcolor: '#f8fafc', borderRadius: 3 }}>
                  <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">
                    Période : {activityReport.period?.startDate} au {activityReport.period?.endDate}
                  </Typography>
                  <Typography variant="h5" fontWeight="bold" color="primary" sx={{ mt: 1 }}>
                    {activityReport.totalExams} examens réalisés
                  </Typography>
                  <Typography variant="h6" fontWeight="bold" color="success.main">
                    {formatAmount(activityReport.totalRevenue)} FCFA
                  </Typography>
                </Box>

                <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mb: 1 }}>
                  Par type d'examen
                </Typography>
                <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Examen</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Nombre</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Recettes</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activityReport.byExamType?.map((exam) => (
                        <TableRow key={exam.name} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">{exam.name}</Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>{exam.count}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" fontWeight="bold" color="success.main">
                              {formatAmount(exam.revenue)} FCFA
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mb: 1 }}>
                  Par technicien
                </Typography>
                <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                  <Table>
                    <TableHead sx={{ bgcolor: '#f8fafc' }}>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 'bold' }}>Technicien</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 'bold' }}>Examens réalisés</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {activityReport.byTechnician?.map((tech) => (
                        <TableRow key={tech.name} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          <TableCell>
                            <Typography variant="body2" fontWeight="bold">{tech.name}</Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ color: 'text.secondary' }}>{tech.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Sélectionnez un service et une période, puis cliquez sur « Générer le rapport »
            </Alert>
          )}
        </Paper>
      )}

      {/* Gestion des utilisateurs */}
      {activeTab === 3 && <UserManagement />}

      {/* Gestion du catalogue d'examens */}
      {activeTab === 4 && <ExamManagement />}

      {/* Configuration des services et de leurs circuits */}
      {activeTab === 5 && <ServiceManagement />}

      {/* Specialites cliniques et frais de consultation */}
      {activeTab === 6 && <SpecialtyManagement />}

      {/* Identite de l'etablissement (nom, logo, coordonnees) */}
      {activeTab === 7 && <HospitalSettings />}
    </Container>
  );
};

export default AdminDashboard;
