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
  CloseRounded as CloseIcon,
  DownloadRounded as DownloadIcon,
  PictureAsPdfRounded as PdfIcon,
  ImageRounded as ImageIcon,
  DescriptionRounded as FileIcon,
  CheckCircleRounded as ValidatedIcon,
  HourglassEmptyRounded as PendingIcon,
  VisibilityRounded as ViewIcon
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
      setError(err.response?.data?.error || 'Erreur lors du chargement des résultats');
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
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">Résultats de l'examen</Typography>
          {examName && (
            <Typography variant="body2" color="textSecondary">
              {examName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'text.secondary', '&:hover': { bgcolor: '#f5f7fb' } }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>
        ) : results.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 2 }}>Aucun résultat téléversé pour cet examen</Alert>
        ) : (
          <List sx={{ p: 0 }}>
            {results.map((result, index) => (
              <React.Fragment key={result.id}>
                {index > 0 && <Divider sx={{ my: 2 }} />}
                <ListItem
                  sx={{
                    py: 2,
                    px: 2,
                    pr: 14,
                    borderRadius: 3,
                    alignItems: 'flex-start',
                    bgcolor: result.isValidated ? '#e8f5e9' : '#f8fafc',
                    border: '1px solid',
                    borderColor: result.isValidated ? '#c8e6c9' : 'divider'
                  }}
                >
                  <ListItemIcon sx={{ mt: 0.5 }}>
                    {getFileIcon(result.fileType)}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {result.fileName}
                        </Typography>
                        {result.isValidated ? (
                          <Chip
                            icon={<ValidatedIcon />}
                            label="Validé"
                            size="small"
                            color="success"
                            sx={{ fontWeight: 'bold' }}
                          />
                        ) : (
                          <Chip
                            icon={<PendingIcon />}
                            label="En attente de validation"
                            size="small"
                            color="warning"
                            sx={{ fontWeight: 'bold' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="textSecondary">
                          Téléversé par {result.uploader?.firstName} {result.uploader?.lastName} le {formatDate(result.uploadDate)}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                          Taille : {formatFileSize(result.fileSize)} — Type : {result.fileType}
                        </Typography>
                        {result.isValidated && result.validator && (
                          <Typography variant="body2" color="success.main" fontWeight="bold">
                            Validé par {result.validator.firstName} {result.validator.lastName} le {formatDate(result.validatedAt)}
                          </Typography>
                        )}
                        {result.conclusion && (
                          <Box sx={{ mt: 2, p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="body2" fontWeight="bold" gutterBottom>
                              Conclusion
                            </Typography>
                            <Typography variant="body2" color="textPrimary">
                              {result.conclusion}
                            </Typography>
                          </Box>
                        )}
                        {result.comments && (
                          <Box sx={{ mt: 1.5, p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                            <Typography variant="body2" fontWeight="bold" gutterBottom>
                              Commentaires
                            </Typography>
                            <Typography variant="body2" color="textPrimary">
                              {result.comments}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                  <ListItemSecondaryAction sx={{ top: 32 }}>
                    <Tooltip title="Visualiser" arrow>
                      <IconButton
                        edge="end"
                        onClick={() => handleView(result.id)}
                        sx={{ mr: 1, bgcolor: 'white', '&:hover': { bgcolor: '#e3f2fd' } }}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Télécharger" arrow>
                      <IconButton
                        edge="end"
                        onClick={() => handleDownload(result.id, result.fileName)}
                        sx={{ bgcolor: 'white', '&:hover': { bgcolor: '#e3f2fd' } }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </ListItemSecondaryAction>
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={onClose}
          sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
        >
          Fermer
        </Button>
        <Button
          variant="outlined"
          onClick={fetchResults}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
        >
          Actualiser
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResultsViewer;
