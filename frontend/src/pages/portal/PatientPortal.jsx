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
  Person as PersonIcon,
  Science as ExamIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as FileIcon,
  CheckCircle as ValidatedIcon,
  LocalHospital as HospitalIcon
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

  const api = axios.create({
    baseURL: API_URL,
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  useEffect(() => {
    if (!token) {
      setError('Lien d\'acces invalide. Veuillez demander un nouveau lien a votre medecin.');
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
        setError('Votre lien d\'acces a expire. Veuillez demander un nouveau lien a votre medecin.');
      } else {
        setError(err.response?.data?.error || 'Erreur lors du chargement des donnees');
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

  const getCategoryLabel = (category) => {
    return category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'grey.100' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', bgcolor: 'grey.100' }}>
        <Paper sx={{ p: 4, maxWidth: 500, textAlign: 'center' }}>
          <HospitalIcon sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom color="error">
            Acces refuse
          </Typography>
          <Alert severity="error">{error}</Alert>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.100', py: 4 }}>
      <Container maxWidth="lg">
        {/* En-tete */}
        <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <HospitalIcon sx={{ fontSize: 48, mr: 2 }} />
            <Box>
              <Typography variant="h4">CHU Tokoin</Typography>
              <Typography variant="subtitle1">Portail Patient - Resultats d'examens</Typography>
            </Box>
          </Box>
        </Paper>

        {/* Informations patient */}
        {patient && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PersonIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
              <Typography variant="h6">Informations personnelles</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">Nom</Typography>
                <Typography variant="body1" fontWeight="bold">{patient.lastName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">Prenom</Typography>
                <Typography variant="body1" fontWeight="bold">{patient.firstName}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">Matricule</Typography>
                <Typography variant="body1" fontWeight="bold">{patient.patientNumber}</Typography>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Typography variant="body2" color="textSecondary">Date de naissance</Typography>
                <Typography variant="body1" fontWeight="bold">{formatDate(patient.dateOfBirth)}</Typography>
              </Grid>
            </Grid>
          </Paper>
        )}

        {/* Onglets */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant="fullWidth">
            <Tab
              icon={<ExamIcon />}
              label={`Mes resultats (${results.length})`}
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
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <ValidatedIcon sx={{ color: 'success.main', mr: 1 }} />
              Resultats valides
            </Typography>

            {results.length === 0 ? (
              <Alert severity="info">
                Aucun resultat valide disponible pour le moment.
              </Alert>
            ) : (
              <List>
                {results.map((result, index) => (
                  <React.Fragment key={result.id}>
                    {index > 0 && <Divider />}
                    <ListItem sx={{ py: 2 }}>
                      <ListItemIcon>
                        {getFileIcon(result.fileType)}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle1" fontWeight="bold">
                              {result.examName}
                            </Typography>
                            <Chip
                              label={getCategoryLabel(result.examCategory)}
                              size="small"
                              color={result.examCategory === 'RADIOLOGY' ? 'info' : 'success'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2" color="textSecondary">
                              Prescription du {formatDate(result.prescriptionDate)} par {result.doctor.name}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                              Valide le {formatDate(result.validatedAt)}
                            </Typography>
                            {result.conclusion && (
                              <Box sx={{ mt: 1, p: 1.5, bgcolor: 'success.50', borderRadius: 1 }}>
                                <Typography variant="body2" fontWeight="bold" color="success.dark">
                                  Conclusion:
                                </Typography>
                                <Typography variant="body2">
                                  {result.conclusion}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Visualiser">
                          <IconButton onClick={() => handleView(result.id)} sx={{ mr: 1 }}>
                            <ViewIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Telecharger">
                          <IconButton onClick={() => handleDownload(result.id, result.fileName)}>
                            <DownloadIcon />
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
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Historique des prescriptions
            </Typography>

            {prescriptions.length === 0 ? (
              <Alert severity="info">
                Aucune prescription trouvee.
              </Alert>
            ) : (
              <Box>
                {prescriptions.map((prescription) => (
                  <Card key={prescription.id} sx={{ mb: 2 }}>
                    <CardContent>
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
                          label={prescription.status === 'COMPLETED' ? 'Termine' : 'En cours'}
                          color={prescription.status === 'COMPLETED' ? 'success' : 'warning'}
                          size="small"
                        />
                      </Box>

                      <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                        Examens prescrits:
                      </Typography>
                      <Box sx={{ pl: 2 }}>
                        {prescription.exams.map((exam) => (
                          <Box key={exam.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="body2">
                              - {exam.name}
                            </Typography>
                            <Chip
                              label={getCategoryLabel(exam.category)}
                              size="small"
                              variant="outlined"
                            />
                            {exam.hasValidatedResults && (
                              <Chip
                                icon={<ValidatedIcon />}
                                label="Resultat disponible"
                                size="small"
                                color="success"
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
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="textSecondary">
            CHU Tokoin - Portail Patient
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Ce lien d'acces est temporaire et expire apres 24 heures.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default PatientPortal;
