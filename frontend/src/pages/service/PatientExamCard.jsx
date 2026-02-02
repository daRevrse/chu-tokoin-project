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
  Person as PersonIcon,
  PlayArrow as PlayIcon,
  CheckCircle as CompleteIcon,
  Receipt as ReceiptIcon,
  CalendarToday as CalendarIcon
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
      COMPLETED: { label: 'Termine', color: 'success' }
    };
    return config[status] || { label: status, color: 'default' };
  };

  const pendingExams = exams.filter(e => e.status === 'PAID');
  const inProgressExams = exams.filter(e => e.status === 'IN_PROGRESS');
  const completedExams = exams.filter(e => e.status === 'COMPLETED');

  return (
    <Card elevation={3}>
      <CardContent>
        {/* En-tete Patient */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main', mr: 2, width: 56, height: 56 }}>
            <PersonIcon fontSize="large" />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" fontWeight="bold">
              {patient.lastName} {patient.firstName}
            </Typography>
            <Chip
              label={patient.patientNumber}
              color="primary"
              size="small"
              sx={{ mt: 0.5 }}
            />
          </Box>
        </Box>

        {/* Informations Prescription/Paiement */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ReceiptIcon color="action" fontSize="small" />
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Prescription
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {prescriptionNumber}
                </Typography>
              </Box>
            </Box>
          </Grid>
          <Grid item xs={6}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CalendarIcon color="action" fontSize="small" />
              <Box>
                <Typography variant="caption" color="textSecondary">
                  Paye le
                </Typography>
                <Typography variant="body2" fontWeight="medium">
                  {formatDate(paidAt)}
                </Typography>
              </Box>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Resume des examens */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {pendingExams.length > 0 && (
            <Chip
              label={`${pendingExams.length} en attente`}
              color="warning"
              size="small"
            />
          )}
          {inProgressExams.length > 0 && (
            <Chip
              label={`${inProgressExams.length} en cours`}
              color="info"
              size="small"
            />
          )}
          {completedExams.length > 0 && (
            <Chip
              label={`${completedExams.length} termine(s)`}
              color="success"
              size="small"
            />
          )}
        </Box>

        {/* Liste des examens */}
        <Typography variant="subtitle1" fontWeight="medium" gutterBottom>
          Examens a effectuer ({exams.length})
        </Typography>

        <List disablePadding>
          {exams.map((exam) => {
            const statusConfig = getStatusConfig(exam.status);
            return (
              <ListItem
                key={exam.id}
                sx={{
                  bgcolor: exam.status === 'IN_PROGRESS' ? 'info.light' : 'grey.50',
                  borderRadius: 1,
                  mb: 1,
                  border: exam.status === 'IN_PROGRESS' ? '2px solid' : '1px solid',
                  borderColor: exam.status === 'IN_PROGRESS' ? 'info.main' : 'grey.200'
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
                      >
                        Demarrer
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
                      >
                        Terminer
                      </Button>
                    )}
                    {exam.status === 'COMPLETED' && (
                      <Chip
                        icon={<CompleteIcon />}
                        label="Termine"
                        color="success"
                        size="small"
                      />
                    )}
                  </Box>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight="medium">{exam.name}</Typography>
                      <Chip
                        label={statusConfig.label}
                        color={statusConfig.color}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={`Code: ${exam.code}`}
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
