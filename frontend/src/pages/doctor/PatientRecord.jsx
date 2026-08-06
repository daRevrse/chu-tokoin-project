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
  SearchRounded as SearchIcon,
  PersonRounded as PersonIcon,
  AssignmentRounded as PrescriptionIcon,
  DownloadRounded as DownloadIcon,
  LinkRounded as LinkIcon,
  ContentCopyRounded as CopyIcon,
  ExpandMoreRounded as ExpandMoreIcon,
  CheckCircleRounded as ValidatedIcon,
  PictureAsPdfRounded as PdfIcon,
  ImageRounded as ImageIcon,
  DescriptionRounded as FileIcon,
  PreviewRounded as PreviewIcon,
  ClearRounded as ClearIcon
} from '@mui/icons-material';
import api from '../../services/api';

// Libelle du service realisant l'examen. Repli sur l'ancienne categorie pour
// les examens qui ne sont pas encore rattaches a un service.
const getServiceLabel = (exam) => {
  if (exam?.service?.name) return exam.service.name;
  return exam?.category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire';
};

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

  // Fonction pour effacer le focus et la sélection active du patient
  const handleClearSelection = () => {
    setSelectedPatient(null);
    setPatientRecord(null);
    setSearchQuery('');
    setSearchResults([]);
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
    <Container maxWidth={false} sx={{ py: 3, px: { xs: 2, md: 4 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Dossiers Patients
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Recherchez et consultez l'historique complet des dossiers médicaux.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Colonne de recherche (Ajustée pour occuper plus d'espace de manière harmonieuse) */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper 
            elevation={0} 
            sx={{ 
              p: 3, 
              position: 'sticky', 
              top: 20, 
              borderRadius: 4, 
              boxShadow: '0 4px 20px rgba(0,0,0,0.03)' 
            }}
          >
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
              <SearchIcon sx={{ mr: 1, color: 'primary.main' }} />
              Rechercher un patient
            </Typography>

            <TextField
              fullWidth
              placeholder="Nom, prenom, numero patient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  searchLoading ? (
                    <InputAdornment position="end">
                      <CircularProgress size={20} />
                    </InputAdornment>
                  ) : searchQuery ? (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setSearchQuery('')}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null
                )
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            {searchResults.length > 0 && (
              <List sx={{ mt: 2, maxHeight: 350, overflow: 'auto', bgcolor: '#f8fafc', borderRadius: 2, p: 1 }}>
                {searchResults.map((patient) => (
                  <ListItemButton
                    key={patient.id}
                    onClick={() => handleSelectPatient(patient)}
                    sx={{ borderRadius: 2, mb: 1, '&:hover': { bgcolor: '#e3f2fd' } }}
                  >
                    <ListItemText
                      primary={<Typography fontWeight="bold">{patient.lastName} {patient.firstName}</Typography>}
                      secondary={
                        <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                          <Chip label={patient.patientNumber} size="small" variant="outlined" />
                          {patient.phone && <Typography variant="caption" color="textSecondary">{patient.phone}</Typography>}
                        </Box>
                      }
                    />
                  </ListItemButton>
                ))}
              </List>
            )}

            {selectedPatient && (
              <Card elevation={0} sx={{ mt: 3, bgcolor: '#e3f2fd', borderRadius: 3, border: '1px solid #bbdefb' }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                      <Typography variant="subtitle1" fontWeight="bold">
                        Patient sélectionné
                      </Typography>
                    </Box>
                    <Tooltip title="Effacer la sélection">
                      <IconButton size="small" onClick={handleClearSelection} sx={{ color: 'text.secondary', bgcolor: 'white' }}>
                        <ClearIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="h6" fontWeight="bold" color="primary.dark">
                    {selectedPatient.lastName} {selectedPatient.firstName}
                  </Typography>
                  <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    Matricule : {selectedPatient.patientNumber}
                  </Typography>

                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<LinkIcon />}
                    onClick={generatePortalLink}
                    sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
                  >
                    Générer lien portail
                  </Button>
                </CardContent>
              </Card>
            )}
          </Paper>
        </Grid>

        {/* Colonne du dossier (Optimisée pour occuper toute la largeur restante) */}
        <Grid size={{ xs: 12, lg: 8 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !patientRecord ? (
            <Paper elevation={0} sx={{ p: 6, textAlign: 'center', borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
              <PersonIcon sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
              <Typography color="textSecondary" variant="h6">
                Recherchez et sélectionnez un patient pour afficher son dossier complet
              </Typography>
            </Paper>
          ) : (
            <>
              {/* Informations patient */}
              <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">Nom</Typography>
                    <Typography variant="body1" fontWeight="bold">{patientRecord.lastName}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">Prénom</Typography>
                    <Typography variant="body1" fontWeight="bold">{patientRecord.firstName}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">Matricule</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      <Chip label={patientRecord.patientNumber} size="small" color="primary" variant="outlined" />
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 3 }}>
                    <Typography variant="caption" color="textSecondary" fontWeight="bold">Date de naissance</Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {formatDate(patientRecord.dateOfBirth).split(' ')[0]}
                    </Typography>
                  </Grid>
                </Grid>
              </Paper>

              {/* Onglets */}
              <Paper elevation={0} sx={{ mb: 3, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ px: 2, pt: 1 }}>
                  <Tab
                    icon={<PrescriptionIcon />}
                    label={`Prescriptions (${patientRecord.prescriptions?.length || 0})`}
                    iconPosition="start"
                    sx={{ fontWeight: 'bold', textTransform: 'none' }}
                  />
                </Tabs>
              </Paper>

              {/* Liste des prescriptions */}
              {activeTab === 0 && (
                <Box>
                  {patientRecord.prescriptions?.length === 0 ? (
                    <Alert severity="info" sx={{ borderRadius: 2 }}>Aucune prescription pour ce patient</Alert>
                  ) : (
                    patientRecord.prescriptions?.map((prescription) => (
                      <Accordion 
                        key={prescription.id} 
                        elevation={0}
                        sx={{ 
                          mb: 2, 
                          borderRadius: '16px !important', 
                          boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                          overflow: 'hidden',
                          '&:before': { display: 'none' }
                        }}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc', px: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <PrescriptionIcon color="primary" />
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle1" fontWeight="bold">
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
                              sx={{ fontWeight: 'bold' }}
                            />
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails sx={{ p: 3 }}>
                          <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 2 }}>
                            Examens prescrits :
                          </Typography>
                          {prescription.prescriptionExams?.map((pe) => (
                            <Card key={pe.id} elevation={0} sx={{ mb: 2, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                              <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                  <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                      {pe.exam?.name}
                                    </Typography>
                                    <Typography variant="body2" color="textSecondary">
                                      {pe.exam?.code} — {getServiceLabel(pe.exam)}
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={getStatusLabel(pe.status)}
                                    color={getStatusColor(pe.status)}
                                    size="small"
                                    sx={{ fontWeight: 'bold' }}
                                  />
                                </Box>

                                {pe.results && pe.results.length > 0 && (
                                  <Box sx={{ mt: 3 }}>
                                    <Typography variant="body2" fontWeight="bold" sx={{ mb: 1.5 }}>
                                      Résultats :
                                    </Typography>
                                    {pe.results.map((result) => (
                                      <Box
                                        key={result.id}
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          p: 2,
                                          bgcolor: result.isValidated ? '#e8f5e9' : '#fff3e0',
                                          borderRadius: 2,
                                          mb: 1.5
                                        }}
                                      >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                          {getFileIcon(result.fileType)}
                                          <Box>
                                            <Typography variant="body2" fontWeight="bold">
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
                                              label="Validé"
                                              size="small"
                                              color="success"
                                              sx={{ fontWeight: 'bold' }}
                                            />
                                          ) : (
                                            <Button
                                              size="small"
                                              variant="contained"
                                              color="success"
                                              onClick={() => handleValidateResult(result.id)}
                                              sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}
                                            >
                                              Valider
                                            </Button>
                                          )}
                                          {(result.fileType === 'PDF' || result.fileType === 'IMAGE') && (
                                            <Tooltip title="Aperçu" arrow>
                                              <IconButton
                                                size="small"
                                                onClick={() => handlePreviewResult(result.id, result.fileName, result.fileType)}
                                                sx={{ bgcolor: 'white', '&:hover': { bgcolor: '#e3f2fd' } }}
                                              >
                                                <PreviewIcon fontSize="small" />
                                              </IconButton>
                                            </Tooltip>
                                          )}
                                          <Tooltip title="Télécharger" arrow>
                                            <IconButton
                                              size="small"
                                              onClick={() => handleDownloadResult(result.id, result.fileName)}
                                              sx={{ bgcolor: 'white', '&:hover': { bgcolor: '#e3f2fd' } }}
                                            >
                                              <DownloadIcon fontSize="small" />
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
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle fontWeight="bold">
          Aperçu - {previewDialog.name}
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
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => {
              if (previewDialog.url) window.URL.revokeObjectURL(previewDialog.url);
              setPreviewDialog({ open: false, url: '', type: '', name: '' });
            }}
            sx={{ borderRadius: 2, textTransform: 'none' }}
          >
            Fermer
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog lien portail */}
      <Dialog 
        open={linkDialog.open} 
        onClose={() => setLinkDialog({ open: false, link: '', token: '' })} 
        maxWidth="sm" 
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle fontWeight="bold">Lien d'accès au portail patient</DialogTitle>
        <DialogContent>
          <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
            Lien généré avec succès ! Valide pendant 24 heures.
          </Alert>
          <TextField
            fullWidth
            label="Lien d'accès"
            value={linkDialog.link}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title="Copier" arrow>
                    <IconButton onClick={() => copyToClipboard(linkDialog.link)}>
                      <CopyIcon />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              )
            }}
            sx={{ mb: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          />
          <Typography variant="body2" color="textSecondary">
            Partagez ce lien avec le patient pour qu'il puisse accéder à ses résultats validés.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setLinkDialog({ open: false, link: '', token: '' })} sx={{ borderRadius: 2, textTransform: 'none' }}>
            Fermer
          </Button>
          <Button variant="contained" onClick={() => copyToClipboard(linkDialog.link)} sx={{ borderRadius: 2, textTransform: 'none', boxShadow: 'none' }}>
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
          sx={{ borderRadius: 2 }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default PatientRecord;