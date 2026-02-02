import React, { useState, useEffect } from 'react';
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
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Card,
  CardContent
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  ArrowBack as BackIcon
} from '@mui/icons-material';
import api from '../../services/api';

const PrescriptionForm = ({ patient, onBack, onSuccess }) => {
  const [exams, setExams] = useState({ RADIOLOGY: [], LABORATORY: [] });
  const [selectedExams, setSelectedExams] = useState([]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const [radioRes, labRes] = await Promise.all([
        api.get('/exams?category=RADIOLOGY'),
        api.get('/exams?category=LABORATORY')
      ]);
      setExams({
        RADIOLOGY: radioRes.data.exams || [],
        LABORATORY: labRes.data.exams || []
      });
    } catch (error) {
      console.error('Erreur chargement examens:', error);
      setError('Erreur lors du chargement des examens');
    }
  };

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
      setError('Veuillez selectionner au moins un examen');
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

      setSuccess('Prescription creee avec succes!');
      setTimeout(() => {
        if (onSuccess) onSuccess(response.data.prescription);
      }, 1500);
    } catch (error) {
      console.error('Erreur creation prescription:', error);
      setError(error.response?.data?.message || 'Erreur lors de la creation de la prescription');
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

  return (
    <Box>
      <Button
        startIcon={<BackIcon />}
        onClick={onBack}
        sx={{ mb: 2 }}
      >
        Retour
      </Button>

      <Typography variant="h5" gutterBottom>
        Nouvelle Prescription
      </Typography>

      {/* Info Patient */}
      <Card sx={{ mb: 3, bgcolor: 'primary.50' }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="textSecondary">Patient</Typography>
              <Typography variant="h6">
                {patient.lastName} {patient.firstName}
              </Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" color="textSecondary">N° Patient</Typography>
              <Chip label={patient.patientNumber} color="primary" size="small" />
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" color="textSecondary">Age</Typography>
              <Typography>{calculateAge(patient.dateOfBirth)} ans</Typography>
            </Grid>
            <Grid item xs={6} md={2}>
              <Typography variant="subtitle2" color="textSecondary">Sexe</Typography>
              <Typography>{patient.gender === 'M' ? 'Homme' : 'Femme'}</Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Grid container spacing={3}>
        {/* Liste des examens */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Catalogue des Examens
            </Typography>

            {/* Radiologie */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="medium">
                  Radiologie ({exams.RADIOLOGY.length} examens)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {exams.RADIOLOGY.map((exam) => (
                    <ListItem
                      key={exam.id}
                      button
                      onClick={() => handleExamToggle(exam)}
                      sx={{
                        bgcolor: selectedExams.find(e => e.id === exam.id)
                          ? 'primary.light'
                          : 'transparent',
                        borderRadius: 1,
                        mb: 0.5
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={!!selectedExams.find(e => e.id === exam.id)}
                            onChange={() => handleExamToggle(exam)}
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <ListItemText
                        primary={exam.name}
                        secondary={`${exam.code} - ${exam.description || ''}`}
                      />
                      <Typography color="primary" fontWeight="medium">
                        {formatPrice(exam.price)}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>

            {/* Laboratoire */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography fontWeight="medium">
                  Laboratoire ({exams.LABORATORY.length} examens)
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  {exams.LABORATORY.map((exam) => (
                    <ListItem
                      key={exam.id}
                      button
                      onClick={() => handleExamToggle(exam)}
                      sx={{
                        bgcolor: selectedExams.find(e => e.id === exam.id)
                          ? 'primary.light'
                          : 'transparent',
                        borderRadius: 1,
                        mb: 0.5
                      }}
                    >
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={!!selectedExams.find(e => e.id === exam.id)}
                            onChange={() => handleExamToggle(exam)}
                          />
                        }
                        label=""
                        sx={{ mr: 0 }}
                      />
                      <ListItemText
                        primary={exam.name}
                        secondary={`${exam.code} - ${exam.description || ''}`}
                      />
                      <Typography color="primary" fontWeight="medium">
                        {formatPrice(exam.price)}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              </AccordionDetails>
            </Accordion>
          </Paper>
        </Grid>

        {/* Resume de la prescription */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, position: 'sticky', top: 20 }}>
            <Typography variant="h6" gutterBottom>
              Resume de la Prescription
            </Typography>

            {selectedExams.length === 0 ? (
              <Typography color="textSecondary" sx={{ py: 2 }}>
                Aucun examen selectionne
              </Typography>
            ) : (
              <List dense>
                {selectedExams.map((exam) => (
                  <ListItem key={exam.id}>
                    <ListItemText
                      primary={exam.name}
                      secondary={formatPrice(exam.price)}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleRemoveExam(exam.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h6">Total:</Typography>
              <Typography variant="h6" color="primary">
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
              sx={{ mb: 2 }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              startIcon={<SaveIcon />}
              onClick={handleSubmit}
              disabled={loading || selectedExams.length === 0}
            >
              {loading ? 'Creation...' : 'Creer la Prescription'}
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PrescriptionForm;
