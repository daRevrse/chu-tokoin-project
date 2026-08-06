import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Divider,
  Tooltip
} from '@mui/material';
import {
  PersonRounded as PersonIcon,
  ScienceRounded as ExamIcon,
  DownloadRounded as DownloadIcon,
  VisibilityRounded as ViewIcon,
  PictureAsPdfRounded as PdfIcon,
  ImageRounded as ImageIcon,
  DescriptionRounded as FileIcon,
  CheckCircleRounded as ValidatedIcon,
  LocalHospitalRounded as HospitalIcon
} from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const PatientPortal = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [patient, setPatient] = useState(null);
  const [results, setResults] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const rootBackgroundImage = '../../images/bg.png';

  const api = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  useEffect(() => {
    if (!token) {
      setError('Lien d\'accès invalide. Veuillez demander un nouveau lien à votre médecin.');
      setLoading(false);
      return;
    }
    fetchData();
  }, [token]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [patientRes, resultsRes, prescriptionsRes] = await Promise.all([
        api.get('/portal/me'),
        api.get('/portal/results'),
        api.get('/portal/prescriptions')
      ]);

      setPatient(patientRes.data.patient);
      setResults(resultsRes.data.results || []);
      setPrescriptions(prescriptionsRes.data.prescriptions || []);
      setError('');
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Votre lien d\'accès a expiré. Veuillez demander un nouveau lien à votre médecin.');
      } else {
        setError(err.response?.data?.error || 'Erreur lors du chargement des données');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (resultId, fileName) => {
    try {
      const response = await api.get(`/portal/results/${resultId}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleView = async (resultId) => {
    try {
      const response = await api.get(`/portal/results/${resultId}/download`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      window.open(url, '_blank');
    } catch (err) {
      console.error('View error:', err);
    }
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'PDF':
        return <PdfIcon sx={{ color: 'error.main' }} />;
      case 'IMAGE':
        return <ImageIcon sx={{ color: 'info.main' }} />;
      default:
        return <FileIcon sx={{ color: 'primary.main' }} />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Le service realisant l'examen ; repli sur l'ancienne categorie pour les
  // examens qui ne sont pas encore rattaches a un service.
  const getServiceLabel = (item) => {
    if (item?.service?.name) return item.service.name;
    const category = item?.examCategory || item?.category;
    return category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire';
  };

  const getServiceColor = (item) => {
    if (item?.service?.color) return item.service.color;
    const category = item?.examCategory || item?.category;
    return category === 'RADIOLOGY' ? '#0288d1' : '#2e7d32';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#f4f6f8' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: '#f4f6f8',backgroundImage: `linear-gradient(135deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.15) 100%), url(${rootBackgroundImage})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat', 
        backgroundAttachment: 'fixed', p: 3 }}>
        <Paper elevation={0} sx={{ p: 5, maxWidth: 500, textAlign: 'center', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <HospitalIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" fontWeight="bold" gutterBottom color="error">
            Accès refusé
          </Typography>
          <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{error}</Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f4f6f8',backgroundColor: '#f5f7fb',
        backgroundImage: `linear-gradient(135deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.15) 100%), url(${rootBackgroundImage})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat', 
        backgroundAttachment: 'fixed',
        py: 5 }}>
      <Container maxWidth="lg">
        {/* En-tête */}
        <Paper 
          elevation={0} 
          sx={{ 
            p: 4, 
            mb: 3, 
            background: 'linear-gradient(135deg, #1976d2 0%, #115293 100%)', 
            color: 'white',
            borderRadius: 4,
            boxShadow: '0 8px 24px rgba(25, 118, 210, 0.2)'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.15)', p: 2, borderRadius: 3, mr: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HospitalIcon sx={{ fontSize: 40 }} />
            </Box>
            <Box>
              <Typography variant="h4" fontWeight="bold">CHU Tokoin</Typography>
              <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>Portail Patient — Résultats d'examens</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Informations patient */}
        {patient && (
          <Paper elevation={0} sx={{ p: 4, mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
              <PersonIcon sx={{ fontSize: 28, color: 'primary.main', mr: 1.5 }} />
              <Typography variant="h6" fontWeight="bold">Informations personnelles</Typography>
            </Box>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" color="textSecondary" fontWeight="bold">Nom</Typography>
                <Typography variant="body1" fontWeight="bold">{patient.lastName}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" color="textSecondary" fontWeight="bold">Prénom</Typography>
                <Typography variant="body1" fontWeight="bold">{patient.firstName}</Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" color="textSecondary" fontWeight="bold">Matricule</Typography>
                <Typography variant="body1" fontWeight="bold">
                  <Chip label={patient.patientNumber} size="small" color="primary" variant="outlined" sx={{ fontWeight: 'bold' }} />
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Typography variant="caption" color="textSecondary" fontWeight="bold">Date de naissance</Typography>
                <Typography variant="body1" fontWeight="bold">{formatDate(patient.dateOfBirth)}</Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Onglets */}
        <Paper elevation={0} sx={{ mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
          <Tabs 
            value={activeTab} 
            onChange={(e, v) => setActiveTab(v)} 
            variant="fullWidth"
            sx={{ '& .MuiTab-root': { fontWeight: 'bold', textTransform: 'none', minHeight: 60 } }}
          >
            <Tab
              icon={<ExamIcon />}
              label={`Mes résultats (${results.length})`}
              iconPosition="start"
            />
            <Tab
              icon={<FileIcon />}
              label={`Mes prescriptions (${prescriptions.length})`}
              iconPosition="start"
            />
          </Tabs>
        </Paper>

        {/* Contenu */}
        {activeTab === 0 && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              <ValidatedIcon sx={{ color: 'success.main', mr: 1.5 }} />
              Résultats validés
            </Typography>

            {results.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Aucun résultat validé disponible pour le moment.
              </Alert>
            ) : (
              <List sx={{ p: 0 }}>
                {results.map((result, index) => (
                  <React.Fragment key={result.id}>
                    {index > 0 && <Divider sx={{ my: 2 }} />}
                    <ListItem sx={{ py: 2, px: 0, alignItems: 'flex-start', flexWrap: { xs: 'wrap', sm: 'nowrap' } }}>
                      <ListItemIcon sx={{ mt: 0.5 }}>
                        {getFileIcon(result.fileType)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1 }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {result.examName}
                            </Typography>
                            <Chip
                              label={getServiceLabel(result)}
                              size="small"
                              sx={{
                                fontWeight: 'bold',
                                bgcolor: `${getServiceColor(result)}22`,
                                color: getServiceColor(result)
                              }}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="textSecondary">
                              Prescription du {formatDate(result.prescriptionDate)} par {result.doctor.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              Validé le {formatDate(result.validatedAt)}
                            </Typography>
                            {result.conclusion && (
                              <Box sx={{ mt: 2, p: 2, bgcolor: '#e8f5e9', borderRadius: 2, border: '1px solid #c8e6c9' }}>
                                <Typography variant="body2" fontWeight="bold" color="success.dark" gutterBottom>
                                  Conclusion :
                                </Typography>
                                <Typography variant="body2" color="textPrimary">
                                  {result.conclusion}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction sx={{ position: 'relative', top: 'auto', right: 'auto', mt: { xs: 2, sm: 0 }, display: 'flex', gap: 1 }}>
                        <Tooltip title="Visualiser" arrow>
                          <IconButton onClick={() => handleView(result.id)} sx={{ bgcolor: '#f4f6f8', '&:hover': { bgcolor: '#e3f2fd' } }}>
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Télécharger" arrow>
                          <IconButton onClick={() => handleDownload(result.id, result.fileName)} sx={{ bgcolor: '#f4f6f8', '&:hover': { bgcolor: '#e3f2fd' } }}>
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </React.Fragment>
                ))}
              </List>
            )}
          </Paper>
        )}

        {activeTab === 1 && (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Historique des prescriptions
            </Typography>

            {prescriptions.length === 0 ? (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                Aucune prescription trouvée.
              </Alert>
            ) : (
              <Box>
                {prescriptions.map((prescription) => (
                  <Card key={prescription.id} elevation={0} sx={{ mb: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Box>
                          <Typography variant="subtitle1" fontWeight="bold">
                            Prescription du {formatDate(prescription.date)}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {prescription.doctor.name}
                          </Typography>
                        </Box>
                        <Chip
                          label={prescription.status === 'COMPLETED' ? 'Terminé' : 'En cours'}
                          color={prescription.status === 'COMPLETED' ? 'success' : 'warning'}
                          size="small"
                          sx={{ fontWeight: 'bold' }}
                        />
                      </Box>

                      <Typography variant="body2" fontWeight="bold" sx={{ mb: 1.5 }}>
                        Examens prescrits :
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {prescription.exams.map((exam) => (
                          <Box key={exam.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', p: 1.5, bgcolor: 'white', borderRadius: 2 }}>
                            <Typography variant="body2" fontWeight="medium" sx={{ flexGrow: 1 }}>
                              • {exam.name}
                            </Typography>
                            <Chip
                              label={getServiceLabel(exam)}
                              size="small"
                              variant="outlined"
                              sx={{ bgcolor: '#f4f6f8' }}
                            />
                            {exam.hasValidatedResults && (
                              <Chip
                                icon={<ValidatedIcon />}
                                label="Résultat disponible"
                                size="small"
                                color="success"
                                sx={{ fontWeight: 'bold' }}
                              />
                            )}
                          </Box>
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Paper>
        )}

        {/* Footer */}
        <Box sx={{ mt: 5, textAlign: 'center' }}>
          <Typography variant="body2" fontWeight="bold" color="textSecondary">
            CHU Tokoin — Portail Patient
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Ce lien d'accès est temporaire et expire après 24 heures.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default PatientPortal;