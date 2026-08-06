import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  Box,
  Button,
  Grid,
  Avatar
} from '@mui/material';
import {
  PersonRounded as PersonIcon,
  PlayArrowRounded as PlayIcon,
  CheckCircleRounded as CompleteIcon,
  ReceiptRounded as ReceiptIcon,
  CalendarTodayRounded as CalendarIcon
} from '@mui/icons-material';

const PatientExamCard = ({
  patient,
  prescriptionNumber,
  paymentNumber,
  paidAt,
  exams,
  onStartExam,
  onCompleteExam,
  loading
}) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusConfig = (status) => {
    const config = {
      PAID: { label: 'En attente', color: 'warning' },
      IN_PROGRESS: { label: 'En cours', color: 'info' },
      COMPLETED: { label: 'Terminé', color: 'success' }
    };
    return config[status] || { label: status, color: 'default' };
  };

  const pendingExams = exams.filter(e => e.status === 'PAID');
  const inProgressExams = exams.filter(e => e.status === 'IN_PROGRESS');
  const completedExams = exams.filter(e => e.status === 'COMPLETED');

  return (
    <Card elevation={0} sx={{ borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', height: '100%' }}>
      <CardContent sx={{ p: { xs: 3, md: 4 } }}>
        {/* En-tete Patient */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 64, height: 64, borderRadius: 3 }} variant="rounded">
            <PersonIcon sx={{ fontSize: 32 }} />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              {patient.lastName} {patient.firstName}
            </Typography>
            <Chip
              label={patient.patientNumber}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ mt: 0.5, fontWeight: 'bold' }}
            />
          </Box>
        </Box>

        {/* Informations Prescription/Paiement */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: '#f8fafc', borderRadius: 3 }}>
              <ReceiptIcon color="action" fontSize="small" />
              <Box>
                <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">
                  Prescription
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {prescriptionNumber}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, bgcolor: '#f8fafc', borderRadius: 3 }}>
              <CalendarIcon color="action" fontSize="small" />
              <Box>
                <Typography variant="caption" color="textSecondary" fontWeight="bold" display="block">
                  Payé le
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatDate(paidAt)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Resume des examens */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          {pendingExams.length > 0 && (
            <Chip
              label={`${pendingExams.length} en attente`}
              color="warning"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          )}
          {inProgressExams.length > 0 && (
            <Chip
              label={`${inProgressExams.length} en cours`}
              color="info"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          )}
          {completedExams.length > 0 && (
            <Chip
              label={`${completedExams.length} terminé(s)`}
              color="success"
              size="small"
              sx={{ fontWeight: 'bold' }}
            />
          )}
        </Box>

        {/* Liste des examens */}
        <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
          Examens à effectuer ({exams.length})
        </Typography>

        <List disablePadding>
          {exams.map((exam) => {
            const statusConfig = getStatusConfig(exam.status);
            return (
              <ListItem
                key={exam.id}
                sx={{
                  bgcolor: exam.status === 'IN_PROGRESS' ? '#e3f2fd' : '#f8fafc',
                  borderRadius: 3,
                  mb: 1.5,
                  py: 2,
                  pr: 16,
                  border: '1px solid',
                  borderColor: exam.status === 'IN_PROGRESS' ? '#90caf9' : 'divider'
                }}
                secondaryAction={
                  <Box>
                    {exam.status === 'PAID' && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<PlayIcon />}
                        onClick={() => onStartExam(exam.id)}
                        disabled={loading}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
                      >
                        Démarrer
                      </Button>
                    )}
                    {exam.status === 'IN_PROGRESS' && (
                      <Button
                        variant="contained"
                        color="success"
                        size="small"
                        startIcon={<CompleteIcon />}
                        onClick={() => onCompleteExam(exam.id)}
                        disabled={loading}
                        sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none' }}
                      >
                        Terminer
                      </Button>
                    )}
                    {exam.status === 'COMPLETED' && (
                      <Chip
                        icon={<CompleteIcon />}
                        label="Terminé"
                        color="success"
                        size="small"
                        sx={{ fontWeight: 'bold' }}
                      />
                    )}
                  </Box>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography fontWeight="bold">{exam.name}</Typography>
                      <Chip
                        label={statusConfig.label}
                        color={statusConfig.color}
                        size="small"
                        variant="outlined"
                        sx={{ fontWeight: 'bold', bgcolor: 'white' }}
                      />
                    </Box>
                  }
                  secondary={`Code : ${exam.code}`}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItem>
            );
          })}
        </List>
      </CardContent>
    </Card>
  );
};

export default PatientExamCard;
