import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress
} from '@mui/material';
import {
  Download as DownloadIcon,
  CheckCircle as ValidateIcon
} from '@mui/icons-material';
import api from '../../services/api';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const PendingResults = ({ onRefresh }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ open: false, resultId: null });

  useEffect(() => {
    fetchPendingResults();
  }, []);

  const fetchPendingResults = async () => {
    try {
      setLoading(true);
      const response = await api.get('/results/pending-validation');
      setResults(response.data.results || []);
    } catch (error) {
      console.error('Erreur chargement resultats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = (resultId) => {
    setConfirmDialog({ open: true, resultId });
  };

  const handleConfirmValidate = async () => {
    const { resultId } = confirmDialog;
    setConfirmDialog({ open: false, resultId: null });

    try {
      await api.patch(`/results/${resultId}/validate`);
      setSnackbar({ open: true, message: 'Resultat valide avec succes', severity: 'success' });
      fetchPendingResults();
      if (onRefresh) onRefresh();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Erreur lors de la validation',
        severity: 'error'
      });
    }
  };

  const handleDownload = async (resultId, fileName) => {
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
      setSnackbar({ open: true, message: 'Erreur lors du telechargement', severity: 'error' });
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Resultats en Attente de Validation ({results.length})
      </Typography>

      {results.length === 0 ? (
        <Alert severity="info">
          Aucun resultat en attente de validation
        </Alert>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Patient</TableCell>
                <TableCell>Examen</TableCell>
                <TableCell>Categorie</TableCell>
                <TableCell>Fichier</TableCell>
                <TableCell>Uploade par</TableCell>
                <TableCell>Date upload</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.map((result) => (
                <TableRow key={result.id} hover>
                  <TableCell>
                    <Typography fontWeight="medium">
                      {result.prescriptionExam?.prescription?.patient?.lastName}{' '}
                      {result.prescriptionExam?.prescription?.patient?.firstName}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {result.prescriptionExam?.prescription?.patient?.patientNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography fontWeight="medium">
                      {result.prescriptionExam?.exam?.name}
                    </Typography>
                    <Typography variant="caption" color="textSecondary">
                      {result.prescriptionExam?.exam?.code}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={result.prescriptionExam?.exam?.category === 'RADIOLOGY' ? 'Radiologie' : 'Laboratoire'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{result.fileName}</Typography>
                    <Chip label={result.fileType} size="small" />
                  </TableCell>
                  <TableCell>
                    {result.uploader?.lastName} {result.uploader?.firstName}
                  </TableCell>
                  <TableCell>
                    {result.uploadDate ? formatDate(result.uploadDate) : '-'}
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Telecharger">
                      <IconButton
                        size="small"
                        onClick={() => handleDownload(result.id, result.fileName)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Valider">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleValidate(result.id)}
                      >
                        <ValidateIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title="Valider le resultat"
        message="Etes-vous sur de vouloir valider ce resultat ? Il sera visible par le patient via le portail."
        confirmText="Valider"
        onConfirm={handleConfirmValidate}
        onCancel={() => setConfirmDialog({ open: false, resultId: null })}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default PendingResults;
