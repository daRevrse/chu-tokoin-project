import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  TextField,
  LinearProgress,
  Alert,
  IconButton,
  Chip
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  PictureAsPdf as PdfIcon
} from '@mui/icons-material';
import api from '../../services/api';

const ResultUpload = ({ open, onClose, prescriptionExamId, examName, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [comments, setComments] = useState('');
  const [conclusion, setConclusion] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/dicom'
  ];

  const maxFileSize = 10 * 1024 * 1024; // 10MB

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    setError('');

    if (!selectedFile) return;

    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Type de fichier non autorise. Formats acceptes: PDF, JPEG, PNG, GIF, DICOM');
      return;
    }

    if (selectedFile.size > maxFileSize) {
      setError('Le fichier est trop volumineux. Taille maximum: 10MB');
      return;
    }

    setFile(selectedFile);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const droppedFile = event.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect({ target: { files: [droppedFile] } });
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const getFileIcon = () => {
    if (!file) return <UploadIcon sx={{ fontSize: 48, color: 'primary.main' }} />;

    if (file.type === 'application/pdf') {
      return <PdfIcon sx={{ fontSize: 48, color: 'error.main' }} />;
    }
    if (file.type.startsWith('image/')) {
      return <ImageIcon sx={{ fontSize: 48, color: 'info.main' }} />;
    }
    return <FileIcon sx={{ fontSize: 48, color: 'primary.main' }} />;
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Veuillez selectionner un fichier');
      return;
    }

    setUploading(true);
    setError('');
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('prescriptionExamId', prescriptionExamId);
    if (comments) formData.append('comments', comments);
    if (conclusion) formData.append('conclusion', conclusion);

    try {
      await api.post('/results', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percentCompleted);
        }
      });

      onUploadSuccess && onUploadSuccess();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Erreur lors de l\'upload');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setComments('');
    setConclusion('');
    setError('');
    setProgress(0);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h6">Upload de resultat</Typography>
          {examName && (
            <Typography variant="body2" color="textSecondary">
              {examName}
            </Typography>
          )}
        </Box>
        <IconButton onClick={handleClose} disabled={uploading}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Zone de drop */}
        <Box
          sx={{
            border: '2px dashed',
            borderColor: file ? 'success.main' : 'grey.400',
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: file ? 'success.50' : 'grey.50',
            transition: 'all 0.3s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'primary.50'
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input
            type="file"
            ref={fileInputRef}
            hidden
            accept=".pdf,.jpg,.jpeg,.png,.gif,.dcm"
            onChange={handleFileSelect}
          />

          {getFileIcon()}

          {file ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                {file.name}
              </Typography>
              <Chip
                label={formatFileSize(file.size)}
                size="small"
                color="success"
                sx={{ mt: 1 }}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1">
                Cliquez ou glissez-deposez un fichier ici
              </Typography>
              <Typography variant="body2" color="textSecondary">
                PDF, JPEG, PNG, GIF ou DICOM (max 10MB)
              </Typography>
            </Box>
          )}
        </Box>

        {uploading && (
          <Box sx={{ mt: 2 }}>
            <LinearProgress variant="determinate" value={progress} />
            <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 1 }}>
              Upload en cours... {progress}%
            </Typography>
          </Box>
        )}

        {/* Champs optionnels */}
        <TextField
          fullWidth
          label="Commentaires"
          multiline
          rows={3}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          disabled={uploading}
          sx={{ mt: 3 }}
          placeholder="Observations, remarques..."
        />

        <TextField
          fullWidth
          label="Conclusion"
          multiline
          rows={3}
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
          disabled={uploading}
          sx={{ mt: 2 }}
          placeholder="Conclusion du resultat..."
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={uploading}>
          Annuler
        </Button>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={handleUpload}
          disabled={!file || uploading}
        >
          {uploading ? 'Upload en cours...' : 'Uploader'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResultUpload;
