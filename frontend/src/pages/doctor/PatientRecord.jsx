import React, { useState, useEffect } from 'react';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  TextField,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Button,
  Chip,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Card,
  CardContent,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar
} from '@mui/material';
import {
  Search as SearchIcon,
  Person as PersonIcon,
  Assignment as PrescriptionIcon,
  Science as ExamIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Link as LinkIcon,
  ContentCopy as CopyIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as ValidatedIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as FileIcon,
  Preview as PreviewIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PatientRecord = ({ initialPatient }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientRecord, setPatientRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [linkDialog, setLinkDialog] = useState({ open: false, link: '', token: '' });
  const [previewDialog, setPreviewDialog] = useState({ open: false, url: '', type: '', name: '' });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Auto-load patient from parent component (e.g., "Voir details" in PatientSearch)
  useEffect(() => {
    if (initialPatient && initialPatient.id !== selectedPatient?.id) {
      setSelectedPatient(initialPatient);
      loadPatientRecord(initialPatient.id);
    }
  }, [initialPatient]);

  useEffect(() => {
    if (searchQuery.length >= 2) {
      const timer = setTimeout(() => {
        searchPatients();
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const searchPatients = async () => {
    setSearchLoading(true);
    try {
      const response = await api.get(`/patient-records/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(response.data.patients || []);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const loadPatientRecord = async (patientId) => {
    setLoading(true);
    try {
      const response = await api.get(`/patient-records/${patientId}`);
      setPatientRecord(response.data.patient);
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur lors du chargement', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient);
    setSearchResults([]);
    setSearchQuery('');
    loadPatientRecord(patient.id);
  };

  const generatePortalLink = async () => {
    if (!selectedPatient) return;

    try {
      const response = await api.post('/portal/generate-access', {
        patientId: selectedPatient.id,
        expiresInHours: 24
      });

      setLinkDialog({
        open: true,
        link: response.data.portalUrl,
        token: response.data.token
      });
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur lors de la generation du lien', 'error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    showSnackbar('Lien copie dans le presse-papier', 'success');
  };

  const handleDownloadResult = async (resultId, fileName) => {
    try {
      const response = await api.get(`/results/${resultId}/download`, {
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
      showSnackbar('Erreur lors du telechargement', 'error');
    }
  };

  const handlePreviewResult = async (resultId, fileName, fileType) => {
    try {
      const response = await api.get(`/results/${resultId}/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      setPreviewDialog({ open: true, url, type: fileType, name: fileName });
    } catch {
      showSnackbar('Erreur lors du chargement de l\'apercu', 'error');
    }
  };

  const handleValidateResult = async (resultId) => {
    try {
      const response = await api.patch(`/results/${resultId}/validate`);
      showSnackbar('Resultat valide avec succes', 'success');

      // Mettre a jour l'etat local sans recharger
      setPatientRecord(prev => ({
        ...prev,
        prescriptions: prev.prescriptions.map(prescription => ({
          ...prescription,
          prescriptionExams: prescription.prescriptionExams.map(pe => ({
            ...pe,
            results: pe.results.map(result =>
              result.id === resultId
                ? { ...result, isValidated: true, validatedAt: new Date().toISOString(), validator: response.data.result?.validator }
                : result
            )
          }))
        }))
      }));
    } catch (error) {
      showSnackbar(error.response?.data?.error || 'Erreur lors de la validation', 'error');
    }
  };

  const showSnackbar = (message, severity) => {
    setSnackbar({ open: true, message, severity });
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'PAID': return 'info';
      case 'IN_PROGRESS': return 'primary';
      case 'COMPLETED': return 'success';
      default: return 'default';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING': return 'En attente';
      case 'PAID': return 'Paye';
      case 'IN_PROGRESS': return 'En cours';
      case 'COMPLETED': return 'Termine';
      default: return status;
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 3 }}>
      <Typography variant="h4" gutterBottom>
        Dossiers Patients
      </Typography>

      <Grid container spacing={3}>
        {/* Colonne de recherche */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, position: 'sticky', top: 20 }}>
            <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
              <SearchIcon sx={{ mr: 1 }} />
              Rechercher un patient
            </Typography>

            <TextField
              fullWidth
              placeholder="Nom, prenom, numero patient ou telephone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
                endAdornment: searchLoading && (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                )
              }}
            />

            {searchResults.length > 0 && (
              <List sx={{ mt: 1, maxHeight: 300, overflow: 'auto' }}>
                {searchResults.map((patient) => (
                  <ListItemButton
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    sx={{ borderRadius: 1, mb: 0.5, '&:hover': { bgcolor: 'primary.50' } }}
                  >
                    <ListItemText
                      primary={`${patient.lastName} ${patient.firstName}`}
                      secondary={
                        <>
                          <Typography variant="caption" component="span">
                            {patient.patientNumber}
                          </Typography>
                          {patient.phone && (
                            <Typography variant="caption" component="span">
                              {' - '}{patient.phone}
                            </Typography>
                          )}
                        </>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}

            {selectedPatient && (
              <Card sx={{ mt: 2, bgcolor: 'primary.50' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                    <Typography variant="subtitle1" fontWeight="bold">
                      Patient selectionne
                    </Typography>
                  </Box>
                  <Typography variant="body1">
                    {selectedPatient.lastName} {selectedPatient.firstName}
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    {selectedPatient.patientNumber}
                  </Typography>

                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<LinkIcon />}
                    onClick={generatePortalLink}
                    sx={{ mt: 2 }}
                  >
                    Generer lien portail
                  </Button>
                </CardContent>
              </Card>
            )}
          </Paper>
        </Grid>

        {/* Colonne du dossier */}
        <Grid item xs={12} md={8}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !patientRecord ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <PersonIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography color="textSecondary" variant="h6">
                Recherchez et selectionnez un patient pour afficher son dossier
              </Typography>
            </Paper>
          ) : (
            <>
              {/* Informations patient */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary">Nom</Typography>
                    <Typography variant="body1" fontWeight="bold">{patientRecord.lastName}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary">Prenom</Typography>
                    <Typography variant="body1" fontWeight="bold">{patientRecord.firstName}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary">Matricule</Typography>
                    <Typography variant="body1" fontWeight="bold">{patientRecord.patientNumber}</Typography>
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <Typography variant="caption" color="textSecondary">Date de naissance</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {formatDate(patientRecord.dateOfBirth).split(' ')[0]}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Onglets */}
              <Paper sx={{ mb: 2 }}>
                <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                  <Tab
                    icon={<PrescriptionIcon />}
                    label={`Prescriptions (${patientRecord.prescriptions?.length || 0})`}
                    iconPosition="start"
                  />
                </Tabs>
              </Paper>

              {/* Liste des prescriptions */}
              {activeTab === 0 && (
                <Box>
                  {patientRecord.prescriptions?.length === 0 ? (
                    <Alert severity="info">Aucune prescription pour ce patient</Alert>
                  ) : (
                    patientRecord.prescriptions?.map((prescription) => (
                      <Accordion key={prescription.id} sx={{ mb: 1 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <PrescriptionIcon color="primary" />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1">
                                Prescription du {formatDate(prescription.createdAt).split(' ')[0]}
                              </Typography>
                              <Typography variant="body2" color="textSecondary">
                                Dr. {prescription.doctor?.firstName} {prescription.doctor?.lastName}
                              </Typography>
                            </Box>
                            <Chip
                              label={getStatusLabel(prescription.status)}
                              color={getStatusColor(prescription.status)}
                              size="small"
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Examens prescrits:
                          </Typography>
                          {prescription.prescriptionExams?.map((pe) => (
                            <Card key={pe.id} sx={{ mb: 2, bgcolor: 'grey.50' }}>
                              <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <Box>
                                    <Typography variant="subtitle1">
                                      {pe.exam?.name}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                      {pe.exam?.code} - {pe.exam?.category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire'}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={getStatusLabel(pe.status)}
                                    color={getStatusColor(pe.status)}
                                    size="small"
                                  />
                                </Box>

                                {pe.results && pe.results.length > 0 && (
                                  <Box sx={{ mt: 2 }}>
                                    <Typography variant="body2" fontWeight="bold" sx={{ mb: 1 }}>
                                      Resultats:
                                    </Typography>
                                    {pe.results.map((result) => (
                                      <Box
                                        key={result.id}
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          p: 1,
                                          bgcolor: result.isValidated ? 'success.50' : 'warning.50',
                                          borderRadius: 1,
                                          mb: 1
                                        }}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          {getFileIcon(result.fileType)}
                                          <Box>
                                            <Typography variant="body2">
                                              {result.fileName}
                                            </Typography>
                                            <Typography variant="caption" color="textSecondary">
                                              Par {result.uploader?.firstName} {result.uploader?.lastName} le {formatDate(result.uploadDate)}
                                            </Typography>
                                          </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          {result.isValidated ? (
                                            <Chip
                                              icon={<ValidatedIcon />}
                                              label="Valide"
                                              size="small"
                                              color="success"
                                            />
                                          ) : (
                                            <Button
                                              size="small"
                                              variant="contained"
                                              color="success"
                                              onClick={() => handleValidateResult(result.id)}
                                            >
                                              Valider
                                            </Button>
                                          )}
                                          {(result.fileType === 'PDF' || result.fileType === 'IMAGE') && (
                                            <Tooltip title="Apercu">
                                              <IconButton
                                                size="small"
                                                onClick={() => handlePreviewResult(result.id, result.fileName, result.fileType)}
                                              >
                                                <PreviewIcon />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                          <Tooltip title="Telecharger">
                                            <IconButton
                                              size="small"
                                              onClick={() => handleDownloadResult(result.id, result.fileName)}
                                            >
                                              <DownloadIcon />
                                            </IconButton>
                                          </Tooltip>
                                        </Box>
                                      </Box>
                                    ))}
                                  </Box>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </AccordionDetails>
                      </Accordion>
                    ))
                  )}
                </Box>
              )}
            </>
          )}
        </Grid>
      </Grid>

      {/* Dialog apercu resultat */}
      <Dialog
        open={previewDialog.open}
        onClose={() => {
          if (previewDialog.url) window.URL.revokeObjectURL(previewDialog.url);
          setPreviewDialog({ open: false, url: '', type: '', name: '' });
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          Apercu - {previewDialog.name}
        </DialogTitle>
        <DialogContent sx={{ minHeight: 500 }}>
          {previewDialog.type === 'IMAGE' ? (
            <Box sx={{ textAlign: 'center' }}>
              <img
                src={previewDialog.url}
                alt={previewDialog.name}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
            </Box>
          ) : previewDialog.type === 'PDF' ? (
            <iframe
              src={previewDialog.url}
              title={previewDialog.name}
              width="100%"
              height="600px"
              style={{ border: 'none' }}
            />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            if (previewDialog.url) window.URL.revokeObjectURL(previewDialog.url);
            setPreviewDialog({ open: false, url: '', type: '', name: '' });
          }}>
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog lien portail */}
      <Dialog open={linkDialog.open} onClose={() => setLinkDialog({ open: false, link: '', token: '' })} maxWidth="sm" fullWidth>
        <DialogTitle>Lien d'acces au portail patient</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 2 }}>
            Lien genere avec succes! Valide pendant 24 heures.
          </Alert>
          <TextField
            fullWidth
            label="Lien d'acces"
            value={linkDialog.link}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copier">
                    <IconButton onClick={() => copyToClipboard(linkDialog.link)}>
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              )
            }}
            sx={{ mb: 2 }}
          />
          <Typography variant="body2" color="textSecondary">
            Partagez ce lien avec le patient pour qu'il puisse acceder a ses resultats valides.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialog({ open: false, link: '', token: '' })}>
            Fermer
          </Button>
          <Button variant="contained" onClick={() => copyToClipboard(linkDialog.link)}>
            Copier le lien
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PatientRecord;
