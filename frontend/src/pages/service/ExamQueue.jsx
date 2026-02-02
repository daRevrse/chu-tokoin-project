import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  Box,
  Button
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  CheckCircle as CompleteIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';

const statusConfig = {
  PAID: { label: 'En attente', color: 'warning' },
  IN_PROGRESS: { label: 'En cours', color: 'info' },
  COMPLETED: { label: 'Termine', color: 'success' }
};

const ExamQueue = ({ exams, onStartExam, onCompleteExam, onRefresh, loading, title }) => {
  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          {title || 'File d\'attente'}
          {exams.length > 0 && (
            <Chip
              label={exams.length}
              size="small"
              color="primary"
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        {onRefresh && (
          <Button
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={loading}
            size="small"
          >
            Actualiser
          </Button>
        )}
      </Box>

      {exams.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="textSecondary">
            Aucun examen dans la file d'attente
          </Typography>
        </Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>N° Prescription</TableCell>
                <TableCell>Examen</TableCell>
                <TableCell>Statut</TableCell>
                <TableCell>Date</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {exam.patientName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {exam.patientNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={exam.prescriptionNumber}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{exam.examName}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {exam.examCode}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusConfig[exam.status]?.label || exam.status}
                      color={statusConfig[exam.status]?.color || 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatDate(exam.performedAt || exam.prescriptionDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {exam.status === 'PAID' && onStartExam && (
                      <Tooltip title="Demarrer l'examen">
                        <IconButton
                          color="primary"
                          onClick={() => onStartExam(exam.id)}
                          disabled={loading}
                          size="small"
                        >
                          <PlayIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {exam.status === 'IN_PROGRESS' && onCompleteExam && (
                      <Tooltip title="Terminer l'examen">
                        <IconButton
                          color="success"
                          onClick={() => onCompleteExam(exam.id)}
                          disabled={loading}
                          size="small"
                        >
                          <CompleteIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                    {exam.status === 'COMPLETED' && (
                      <Typography variant="caption" color="success.main">
                        Termine
                      </Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};

export default ExamQueue;
