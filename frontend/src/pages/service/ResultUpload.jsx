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
  CloudUploadRounded as UploadIcon,
  CloseRounded as CloseIcon,
  InsertDriveFileRounded as FileIcon,
  ImageRounded as ImageIcon,
  PictureAsPdfRounded as PdfIcon
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
      setError('Type de fichier non autorisé. Formats acceptés : PDF, JPEG, PNG, GIF, DICOM');
      return;
    }

    if (selectedFile.size > maxFileSize) {
      setError('Le fichier est trop volumineux. Taille maximum : 10 Mo');
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
      setError('Veuillez sélectionner un fichier');
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
      setError(err.response?.data?.error || 'Erreur lors du téléversement');
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
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, boxShadow: '0 12px 40px rgba(0,0,0,0.12)' } }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight="bold">Téléverser un résultat</Typography>
          {examName && (
            <Typography variant="body2" color="textSecondary">
              {examName}
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={handleClose}
          disabled={uploading}
          sx={{ color: 'text.secondary', '&:hover': { bgcolor: '#f5f7fb' } }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {/* Zone de drop */}
        <Box
          sx={{
            border: '2px dashed',
            borderColor: file ? 'success.main' : 'divider',
            borderRadius: 3,
            p: 5,
            textAlign: 'center',
            cursor: 'pointer',
            bgcolor: file ? '#e8f5e9' : '#f8fafc',
            transition: 'all 0.2s ease',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: '#e3f2fd'
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
                sx={{ mt: 1, fontWeight: 'bold' }}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold">
                Cliquez ou glissez-déposez un fichier ici
              </Typography>
              <Typography variant="body2" color="textSecondary">
                PDF, JPEG, PNG, GIF ou DICOM (max 10 Mo)
              </Typography>
            </Box>
          )}
        </Box>

        {uploading && (
          <Box sx={{ mt: 3 }}>
            <LinearProgress variant="determinate" value={progress} sx={{ borderRadius: 2, height: 8 }} />
            <Typography variant="body2" color="textSecondary" align="center" fontWeight="bold" sx={{ mt: 1 }}>
              Téléversement en cours... {progress}%
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
          sx={{ mt: 3, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
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
          sx={{ mt: 2, '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
          placeholder="Conclusion du résultat..."
        />
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={handleClose}
          disabled={uploading}
          sx={{ borderRadius: 2, textTransform: 'none', color: 'text.secondary' }}
        >
          Annuler
        </Button>
        <Button
          variant="contained"
          startIcon={<UploadIcon />}
          onClick={handleUpload}
          disabled={!file || uploading}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3 }}
        >
          {uploading ? 'Téléversement...' : 'Téléverser'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ResultUpload;
