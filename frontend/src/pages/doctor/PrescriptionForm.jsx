import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Grid,
  Checkbox,
  FormControlLabel,
  TextField,
  Divider,
  Chip,
  Alert,
  List,
  ListItemButton,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent,
  InputAdornment,
  ListItem
} from '@mui/material';
import {
  ExpandMoreRounded as ExpandMoreIcon,
  DeleteOutlineRounded as DeleteIcon,
  SaveRounded as SaveIcon,
  ArrowBackRounded as BackIcon,
  SearchRounded as SearchIcon,
  ScienceRounded as ServiceIcon,
  ReceiptLongRounded as SummaryIcon,
  SearchOffRounded as NoResultIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PrescriptionForm = ({ patient, onBack, onSuccess }) => {
  const [exams, setExams] = useState([]);
  const [selectedExams, setSelectedExams] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [examSearch, setExamSearch] = useState('');

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await api.get('/exams');
      setExams(res.data.exams || []);
    } catch (err) {
      console.error('Erreur chargement examens:', err);
      setError('Erreur lors du chargement des examens');
    }
  };

  // Regroupement par service, applique apres la recherche.
  // Les services proviennent des donnees : ajouter un service en
  // administration le fait apparaitre ici sans modifier ce composant.
  const groupedExams = useMemo(() => {
    const term = examSearch.trim().toLowerCase();
    const visible = term
      ? exams.filter(e =>
        e.name.toLowerCase().includes(term) || e.code.toLowerCase().includes(term))
      : exams;

    const groups = new Map();
    for (const exam of visible) {
      const service = exam.service;
      const key = service?.id || 'sans-service';
      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          name: service?.name || 'Sans service',
          color: service?.color || '#607d8b',
          order: service?.displayOrder ?? 999,
          exams: []
        });
      }
      groups.get(key).exams.push(exam);
    }

    return [...groups.values()].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }, [exams, examSearch]);

  const handleExamToggle = (exam) => {
    const isSelected = selectedExams.find(e => e.id === exam.id);
    if (isSelected) {
      setSelectedExams(selectedExams.filter(e => e.id !== exam.id));
    } else {
      setSelectedExams([...selectedExams, exam]);
    }
  };

  const handleRemoveExam = (examId) => {
    setSelectedExams(selectedExams.filter(e => e.id !== examId));
  };

  const calculateTotal = () => {
    return selectedExams.reduce((sum, exam) => sum + parseFloat(exam.price), 0);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
  };

  const handleSubmit = async () => {
    if (selectedExams.length === 0) {
      setError('Veuillez sélectionner au moins un examen');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/prescriptions', {
        patientId: patient.id,
        examIds: selectedExams.map(e => e.id),
        notes: notes.trim() || null
      });

      setSuccess('Prescription créée avec succès !');
      setTimeout(() => {
        if (onSuccess) onSuccess(response.data.prescription);
      }, 1500);
    } catch (err) {
      console.error('Erreur creation prescription:', err);
      setError(err.response?.data?.message || 'Erreur lors de la création de la prescription');
    } finally {
      setLoading(false);
    }
  };

  const calculateAge = (dateOfBirth) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const renderExamList = (examList) => (
    <List dense sx={{ p: 0 }}>
      {examList.map((exam) => {
        const isSelected = !!selectedExams.find(e => e.id === exam.id);
        return (
          <ListItemButton
            key={exam.id}
            onClick={() => handleExamToggle(exam)}
            sx={{
              bgcolor: isSelected ? '#e3f2fd' : '#f8fafc',
              borderRadius: 2,
              mb: 1,
              py: 1.5,
              transition: 'background-color 0.2s ease',
              '&:hover': { bgcolor: isSelected ? '#d6eafd' : '#eef2f7' }
            }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={isSelected}
                  onChange={() => handleExamToggle(exam)}
                />
              }
              label=""
              sx={{ mr: 0 }}
              onClick={(e) => e.stopPropagation()}
            />
            <ListItemText
              primary={exam.name}
              secondary={`${exam.code}${exam.description ? ` — ${exam.description}` : ''}`}
              primaryTypographyProps={{ fontWeight: 'bold', variant: 'body2' }}
              secondaryTypographyProps={{ variant: 'caption' }}
            />
            <Typography color="primary" fontWeight="bold" variant="body2" sx={{ whiteSpace: 'nowrap', ml: 2 }}>
              {formatPrice(exam.price)}
            </Typography>
          </ListItemButton>
        );
      })}
      {examList.length === 0 && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <NoResultIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography color="textSecondary" variant="body2">
            Aucun examen trouvé
          </Typography>
        </Box>
      )}
    </List>
  );

  // Styles partagés
  const paperStyle = {
    elevation: 0,
    sx: { p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }
  };

  const accordionStyle = {
    elevation: 0,
    disableGutters: true,
    sx: {
      mb: 2,
      borderRadius: 3,
      overflow: 'hidden',
      bgcolor: 'transparent',
      '&:before': { display: 'none' },
      border: '1px solid',
      borderColor: 'divider'
    }
  };

  return (
    <Box>
      <Button
        startIcon={<BackIcon />}
        onClick={onBack}
        sx={{ mb: 3, borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
      >
        Retour
      </Button>

      <Typography variant="h5" fontWeight="bold" sx={{ mb: 3 }}>
        Nouvelle Prescription
      </Typography>

      {/* Info Patient */}
      <Card
        elevation={0}
        sx={{ mb: 4, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}
      >
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold">Patient</Typography>
              <Typography variant="h6" fontWeight="bold">
                {patient.lastName} {patient.firstName}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block" sx={{ mb: 0.5 }}>N° Patient</Typography>
              <Chip label={patient.patientNumber} color="primary" variant="outlined" size="small" sx={{ fontWeight: 'bold' }} />
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Âge</Typography>
              <Typography fontWeight="bold">{calculateAge(patient.dateOfBirth)} ans</Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 2 }}>
              <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">Sexe</Typography>
              <Typography fontWeight="bold">{patient.gender === 'M' ? 'Homme' : 'Femme'}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Liste des examens */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Paper {...paperStyle}>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 3 }}>
              Catalogue des Examens
            </Typography>

            {/* Recherche d'examens */}
            <TextField
              fullWidth
              placeholder="Rechercher un examen par nom ou code..."
              value={examSearch}
              onChange={(e) => setExamSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                )
              }}
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            {/* Un panneau par service, dans l'ordre defini en administration */}
            {groupedExams.length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <NoResultIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="textSecondary" variant="body2">
                  Aucun examen ne correspond à la recherche
                </Typography>
              </Box>
            ) : (
              groupedExams.map((group) => (
                <Accordion key={group.id} defaultExpanded {...accordionStyle}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc', px: 2.5, minHeight: 64 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{
                        bgcolor: `${group.color}22`,
                        width: 36, height: 36, borderRadius: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <ServiceIcon sx={{ fontSize: 20, color: group.color }} />
                      </Box>
                      <Typography fontWeight="bold">
                        {group.name} ({group.exams.length} examen{group.exams.length > 1 ? 's' : ''})
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 2 }}>
                    {renderExamList(group.exams)}
                  </AccordionDetails>
                </Accordion>
              ))
            )}
          </Paper>
        </Grid>

        {/* Résumé de la prescription */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', position: 'sticky', top: 20 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
              <SummaryIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">
                Résumé de la Prescription
              </Typography>
            </Box>

            {selectedExams.length === 0 ? (
              <Box sx={{ py: 5, textAlign: 'center', bgcolor: '#f8fafc', borderRadius: 3, mb: 1 }}>
                <SummaryIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                <Typography color="textSecondary" variant="body2">
                  Aucun examen sélectionné
                </Typography>
              </Box>
            ) : (
              <List dense sx={{ p: 0 }}>
                {selectedExams.map((exam) => (
                  <ListItem
                    key={exam.id}
                    sx={{ bgcolor: '#f8fafc', borderRadius: 2, mb: 1, py: 1.5, pr: 7 }}
                  >
                    <ListItemText
                      primary={exam.name}
                      secondary={formatPrice(exam.price)}
                      primaryTypographyProps={{ fontWeight: 'bold', variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption', fontWeight: 'bold', color: 'primary' }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleRemoveExam(exam.id)}
                        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: '#ffebee' } }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}

            <Divider sx={{ my: 3 }} />

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 3,
                p: 2,
                bgcolor: '#e3f2fd',
                borderRadius: 3
              }}
            >
              <Typography variant="subtitle1" fontWeight="bold">Total</Typography>
              <Typography variant="h6" fontWeight="bold" color="primary">
                {formatPrice(calculateTotal())}
              </Typography>
            </Box>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Notes / Observations"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              sx={{ mb: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={loading || selectedExams.length === 0}
              sx={{ borderRadius: 2, textTransform: 'none', py: 1.5, fontWeight: 'bold', boxShadow: 'none' }}
            >
              {loading ? 'Création...' : 'Créer la Prescription'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PrescriptionForm;
