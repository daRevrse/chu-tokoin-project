import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper } from '@mui/material';
import { BlockRounded as BlockIcon, ArrowBackRounded as ArrowBackIcon } from '@mui/icons-material';

const Unauthorized = () => {
  const navigate = useNavigate();
  const rootBackgroundImage = '/images/bg.png';

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f7fb',
        backgroundImage: `url(${rootBackgroundImage})`,
        backgroundSize: 'contain',
        backgroundPosition: 'center',
        backgroundRepeat: 'repeat',
        p: 2
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 5,
          textAlign: 'center',
          maxWidth: 460,
          borderRadius: 4,
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
        }}
      >
        <Box
          sx={{
            bgcolor: '#ffebee',
            width: 88,
            height: 88,
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            mb: 3
          }}
        >
          <BlockIcon sx={{ fontSize: 48, color: '#d32f2f' }} />
        </Box>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Accès refusé
        </Typography>
        <Typography color="textSecondary" sx={{ mb: 4 }}>
          Vous n'avez pas les permissions nécessaires pour accéder à cette page.
        </Typography>
        <Button
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 'bold', boxShadow: 'none', px: 3, py: 1.2 }}
        >
          Retour
        </Button>
      </Paper>
    </Box>
  );
};

export default Unauthorized;
