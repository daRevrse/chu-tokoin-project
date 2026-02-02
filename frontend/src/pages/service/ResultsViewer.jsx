import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Divider,
  Alert,
  Tooltip,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Download as DownloadIcon,
  PictureAsPdf as PdfIcon,
  Image as ImageIcon,
  Description as FileIcon,
  CheckCircle as ValidatedIcon,
  HourglassEmpty as PendingIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import api from '../../services/api';

const ResultsViewer = ({ open, onClose, prescriptionExamId, examName }) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && prescriptionExamId) {
      fetchResults();
    }
  }, [open, prescriptionExamId]);

  const fetchResults = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get(`/results/exam/${prescriptionExamId}`);
      setResults(response.data.results || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors du chargement des resultats');
    } finally {
      setLoading(false);
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
      console.error('Download error:', err);
    }
  };

  const handleView = async (resultId) => {
    try {
      const response = await api.get(`/results/${resultId}/download`, {
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

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">Resultats de l'examen</Typography>
          {examName && (
            <Typography variant="body2" color="textSecondary">
              {examName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : results.length === 0 ? (
          <Alert severity="info">Aucun resultat uploade pour cet examen</Alert>
        ) : (
          <List>
            {results.map((result, index) => (
              <React.Fragment key={result.id}>
                {index > 0 && <Divider />}
                <ListItem
                  sx={{
                    py: 2,
                    bgcolor: result.isValidated ? 'success.50' : 'transparent'
                  }}
                >
                  <ListItemIcon>
                    {getFileIcon(result.fileType)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1">
                          {result.fileName}
                        </Typography>
                        {result.isValidated ? (
                          <Chip
                            icon={<ValidatedIcon />}
                            label="Valide"
                            size="small"
                            color="success"
                          />
                        ) : (
                          <Chip
                            icon={<PendingIcon />}
                            label="En attente de validation"
                            size="small"
                            color="warning"
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          Upload par {result.uploader?.firstName} {result.uploader?.lastName} le {formatDate(result.uploadDate)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Taille: {formatFileSize(result.fileSize)} | Type: {result.fileType}
                        </Typography>
                        {result.isValidated && result.validator && (
                          <Typography variant="body2" color="success.main">
                            Valide par {result.validator.firstName} {result.validator.lastName} le {formatDate(result.validatedAt)}
                          </Typography>
                        )}
                        {result.conclusion && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              Conclusion:
                            </Typography>
                            <Typography variant="body2">
                              {result.conclusion}
                            </Typography>
                          </Box>
                        )}
                        {result.comments && (
                          <Box sx={{ mt: 1, p: 1, bgcolor: 'grey.50', borderRadius: 1 }}>
                            <Typography variant="body2" fontWeight="bold">
                              Commentaires:
                            </Typography>
                            <Typography variant="body2">
                              {result.comments}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Visualiser">
                      <IconButton
                        edge="end"
                        onClick={() => handleView(result.id)}
                        sx={{ mr: 1 }}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Telecharger">
                      <IconButton
                        edge="end"
                        onClick={() => handleDownload(result.id, result.fileName)}
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>
          Fermer
        </Button>
        <Button variant="outlined" onClick={fetchResults}>
          Actualiser
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResultsViewer;
