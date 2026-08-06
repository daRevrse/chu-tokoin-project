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
  PlayArrowRounded as PlayIcon,
  CheckCircleRounded as CompleteIcon,
  RefreshRounded as RefreshIcon,
  CloudUploadRounded as UploadIcon,
  VisibilityRounded as ViewIcon,
  InboxRounded as EmptyIcon,
  RouteRounded as StepsIcon
} from '@mui/icons-material';

const statusConfig = {
  PAID: { label: 'En attente', color: 'warning' },
  IN_PROGRESS: { label: 'En cours', color: 'info' },
  COMPLETED: { label: 'Terminé', color: 'success' }
};

const ExamQueue = ({ exams, onStartExam, onCompleteExam, onUploadResult, onViewResults, onShowSteps, onRefresh, loading, title }) => {
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
    <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h6" fontWeight="bold">
          {title || 'File d\'attente'}
          {exams.length > 0 && (
            <Chip
              label={exams.length}
              size="small"
              color="primary"
              sx={{ ml: 1.5, fontWeight: 'bold' }}
            />
          )}
        </Typography>
        {onRefresh && (
          <Button
            startIcon={<RefreshIcon />}
            onClick={onRefresh}
            disabled={loading}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', color: 'text.secondary' }}
          >
            Actualiser
          </Button>
        )}
      </Box>

      {exams.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <EmptyIcon sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
          <Typography color="textSecondary">
            Aucun examen dans la file d'attente
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
          <Table>
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Patient</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>N° Prescription</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Examen</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Statut</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exams.map((exam) => (
                <TableRow key={exam.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">
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
                      sx={{ fontWeight: 'bold', bgcolor: '#f5f7fb' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="bold">{exam.examName}</Typography>
                    <Typography variant="caption" color="textSecondary">
                      {exam.examCode}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={statusConfig[exam.status]?.label || exam.status}
                      color={statusConfig[exam.status]?.color || 'default'}
                      size="small"
                      sx={{ fontWeight: 'bold' }}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>
                    <Typography variant="caption">
                      {formatDate(exam.performedAt || exam.prescriptionDate)}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    {exam.status === 'PAID' && onStartExam && (
                      <Tooltip title="Démarrer l'examen" arrow>
                        <IconButton
                          onClick={() => onStartExam(exam.id)}
                          disabled={loading}
                          size="small"
                          sx={{ ml: 0.5, bgcolor: '#e3f2fd', color: 'primary.main', '&:hover': { bgcolor: 'primary.main', color: 'white' } }}
                        >
                          <PlayIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {exam.status !== 'PAID' && onShowSteps && (
                      <Tooltip title="Circuit de réalisation" arrow>
                        <IconButton
                          onClick={() => onShowSteps(exam)}
                          disabled={loading}
                          size="small"
                          sx={{ ml: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: '#e3f2fd' } }}
                        >
                          <StepsIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {exam.status === 'IN_PROGRESS' && onCompleteExam && (
                      <Tooltip title="Terminer l'examen" arrow>
                        <IconButton
                          onClick={() => onCompleteExam(exam.id)}
                          disabled={loading}
                          size="small"
                          sx={{ ml: 0.5, bgcolor: '#e8f5e9', color: 'success.main', '&:hover': { bgcolor: 'success.main', color: 'white' } }}
                        >
                          <CompleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(exam.status === 'IN_PROGRESS' || exam.status === 'COMPLETED') && onUploadResult && (
                      <Tooltip title="Téléverser un résultat" arrow>
                        <IconButton
                          onClick={() => onUploadResult(exam.id, exam.examName)}
                          disabled={loading}
                          size="small"
                          sx={{ ml: 0.5, color: 'text.secondary', '&:hover': { color: 'primary.main', bgcolor: '#e3f2fd' } }}
                        >
                          <UploadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {onViewResults && (
                      <Tooltip title="Voir les résultats" arrow>
                        <IconButton
                          onClick={() => onViewResults(exam.id, exam.examName)}
                          disabled={loading}
                          size="small"
                          sx={{ ml: 0.5, color: 'text.secondary', '&:hover': { color: 'info.main', bgcolor: '#e1f5fe' } }}
                        >
                          <ViewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
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
