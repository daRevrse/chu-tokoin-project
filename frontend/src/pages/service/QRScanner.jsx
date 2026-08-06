import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Button,
  TextField,
  Divider
} from '@mui/material';
import {
  CameraAltRounded as CameraIcon,
  StopRounded as StopIcon,
  QrCode2Rounded as QrCodeIcon
} from '@mui/icons-material';

const QRScanner = ({ onScanSuccess, onScanError }) => {
  const [scanning, setScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const scannerRef = useRef(null);

  useEffect(() => {
    if (scanning) {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        showTorchButtonIfSupported: true
      };

      scannerRef.current = new Html5QrcodeScanner('qr-reader', config, false);

      scannerRef.current.render(
        (decodedText) => {
          // Succes du scan
          stopScan();
          onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignorer les erreurs de scan continu (pas de QR detecte)
          if (!errorMessage.includes('NotFoundException')) {
            console.warn('QR Scan warning:', errorMessage);
          }
        }
      );
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, [scanning, onScanSuccess]);

  const startScan = () => {
    setScanning(true);
  };

  const stopScan = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
    }
    setScanning(false);
  };

  const handleManualSubmit = () => {
    if (manualInput.trim()) {
      onScanSuccess(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 4, boxShadow: '0 4px 20px rgba(0,0,0,0.03)', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <Box sx={{ bgcolor: '#e3f2fd', width: 40, height: 40, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <QrCodeIcon sx={{ fontSize: 22, color: '#1976d2' }} />
        </Box>
        <Typography variant="h6" fontWeight="bold">
          Scanner le QR Code du Patient
        </Typography>
      </Box>

      <Box sx={{ textAlign: 'center', my: 3 }}>
        {!scanning ? (
          <Button
            variant="contained"
            size="large"
            startIcon={<CameraIcon />}
            onClick={startScan}
            sx={{ minWidth: 220, borderRadius: 2, textTransform: 'none', fontWeight: 'bold', py: 1.5, boxShadow: 'none' }}
          >
            Démarrer le Scan
          </Button>
        ) : (
          <Box>
            <Box
              id="qr-reader"
              sx={{
                width: '100%',
                maxWidth: 400,
                margin: '0 auto',
                borderRadius: 3,
                overflow: 'hidden',
                '& video, & img': { borderRadius: 2 }
              }}
            />
            <Button
              variant="outlined"
              color="error"
              startIcon={<StopIcon />}
              onClick={stopScan}
              sx={{ mt: 2, borderRadius: 2, textTransform: 'none', fontWeight: 'bold' }}
            >
              Arrêter le Scan
            </Button>
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 3 }}>
        <Typography variant="caption" color="textSecondary" fontWeight="bold">
          ou saisir manuellement
        </Typography>
      </Divider>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <TextField
          fullWidth
          placeholder="Coller les données du QR code ici..."
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <Button
          variant="outlined"
          onClick={handleManualSubmit}
          disabled={!manualInput.trim()}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', minWidth: 110 }}
        >
          Valider
        </Button>
      </Box>

      <Alert severity="info" sx={{ mt: 3, borderRadius: 2 }}>
        Placez le QR code du patient devant la caméra pour charger ses examens
      </Alert>
    </Paper>
  );
};

export default QRScanner;
