import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  Button,
  AppBar,
  Toolbar
} from '@mui/material';
import {
  LocalHospital,
  MedicalServices,
  Payment,
  Science,
  AdminPanelSettings,
  Logout
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Configuration des cartes selon les roles
  const roleCards = {
    DOCTOR: {
      title: 'Espace Medecin',
      description: 'Creer des prescriptions et consulter les resultats',
      icon: <MedicalServices sx={{ fontSize: 60 }} />,
      path: '/doctor',
      color: '#1976d2'
    },
    CASHIER: {
      title: 'Espace Caisse',
      description: 'Gerer les paiements et generer les QR codes',
      icon: <Payment sx={{ fontSize: 60 }} />,
      path: '/cashier',
      color: '#4caf50'
    },
    RADIOLOGIST: {
      title: 'Service Radiologie',
      description: 'Scanner les QR codes et valider les examens',
      icon: <LocalHospital sx={{ fontSize: 60 }} />,
      path: '/service',
      color: '#ff9800'
    },
    LAB_TECHNICIAN: {
      title: 'Service Laboratoire',
      description: 'Scanner les QR codes et valider les examens',
      icon: <Science sx={{ fontSize: 60 }} />,
      path: '/service',
      color: '#9c27b0'
    },
    ADMIN: {
      title: 'Administration',
      description: 'Gerer le systeme et consulter les rapports',
      icon: <AdminPanelSettings sx={{ fontSize: 60 }} />,
      path: '/admin',
      color: '#f44336'
    }
  };

  const userCard = roleCards[user?.role];

  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* AppBar */}
      <AppBar position="static">
        <Toolbar>
          <LocalHospital sx={{ mr: 2 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CHU Tokoin
          </Typography>
          <Typography variant="body2" sx={{ mr: 2 }}>
            {user?.firstName} {user?.lastName}
          </Typography>
          <Button color="inherit" startIcon={<Logout />} onClick={handleLogout}>
            Deconnexion
          </Button>
        </Toolbar>
      </AppBar>

      {/* Contenu */}
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom align="center">
          Bienvenue, {user?.firstName}!
        </Typography>
        <Typography variant="body1" color="textSecondary" align="center" sx={{ mb: 4 }}>
          Selectionnez votre espace de travail
        </Typography>

        <Grid container spacing={3} justifyContent="center">
          {userCard && (
            <Grid item xs={12} sm={6} md={4}>
              <Card
                sx={{
                  height: '100%',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 6
                  }
                }}
              >
                <CardActionArea
                  onClick={() => navigate(userCard.path)}
                  sx={{ height: '100%' }}
                >
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Box sx={{ color: userCard.color, mb: 2 }}>
                      {userCard.icon}
                    </Box>
                    <Typography variant="h6" gutterBottom>
                      {userCard.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {userCard.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )}

          {/* Pour admin, afficher toutes les options */}
          {user?.role === 'ADMIN' && Object.entries(roleCards)
            .filter(([key]) => key !== 'ADMIN')
            .map(([key, card]) => (
              <Grid item xs={12} sm={6} md={4} key={key}>
                <Card
                  sx={{
                    height: '100%',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    }
                  }}
                >
                  <CardActionArea
                    onClick={() => navigate(card.path)}
                    sx={{ height: '100%' }}
                  >
                    <CardContent sx={{ textAlign: 'center', py: 4 }}>
                      <Box sx={{ color: card.color, mb: 2 }}>
                        {card.icon}
                      </Box>
                      <Typography variant="h6" gutterBottom>
                        {card.title}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {card.description}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default Dashboard;
