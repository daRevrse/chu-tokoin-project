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
  CameraAlt as CameraIcon,
  Stop as StopIcon,
  QrCode as QrCodeIcon
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
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <QrCodeIcon color="primary" />
        Scanner le QR Code du Patient
      </Typography>

      <Box sx={{ textAlign: 'center', my: 2 }}>
        {!scanning ? (
          <Button
            variant="contained"
            size="large"
            startIcon={<CameraIcon />}
            onClick={startScan}
            sx={{ minWidth: 200 }}
          >
            Demarrer le Scan
          </Button>
        ) : (
          <Box>
            <div
              id="qr-reader"
              style={{
                width: '100%',
                maxWidth: 400,
                margin: '0 auto'
              }}
            />
            <Button
              variant="outlined"
              color="error"
              startIcon={<StopIcon />}
              onClick={stopScan}
              sx={{ mt: 2 }}
            >
              Arreter le Scan
            </Button>
          </Box>
        )}
      </Box>

      <Divider sx={{ my: 3 }}>
        <Typography variant="body2" color="textSecondary">
          ou saisir manuellement
        </Typography>
      </Divider>

      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Coller les donnees du QR code ici..."
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleManualSubmit()}
        />
        <Button
          variant="outlined"
          onClick={handleManualSubmit}
          disabled={!manualInput.trim()}
        >
          Valider
        </Button>
      </Box>

      <Alert severity="info" sx={{ mt: 2 }}>
        Placez le QR code du patient devant la camera pour charger ses examens
      </Alert>
    </Paper>
  );
};

export default QRScanner;
