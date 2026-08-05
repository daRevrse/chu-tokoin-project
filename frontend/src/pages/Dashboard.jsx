import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CardActionArea
} from '@mui/material';
import {
  LocalHospitalRounded,
  MedicalServicesRounded,
  PointOfSaleRounded,
  ScienceRounded,
  AdminPanelSettingsRounded,
  BiotechRounded
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Configuration des cartes enrichie avec les couleurs de fond
  const roleCards = {
    DOCTOR: {
      title: 'Espace Médecin',
      description: 'Créer des prescriptions et consulter les résultats',
      icon: <MedicalServicesRounded sx={{ fontSize: 40, color: '#1976d2' }} />,
      path: '/doctor',
      bgColor: '#e3f2fd'
    },
    CASHIER: {
      title: 'Espace Caisse',
      description: 'Gérer les paiements et générer les QR codes',
      icon: <PointOfSaleRounded sx={{ fontSize: 40, color: '#2e7d32' }} />,
      path: '/cashier',
      bgColor: '#e8f5e9'
    },
    RADIOLOGIST: {
      title: 'Service Radiologie',
      description: 'Scanner les QR codes et valider les examens',
      icon: <BiotechRounded sx={{ fontSize: 40, color: '#ed6c02' }} />,
      path: '/service',
      bgColor: '#fff3e0'
    },
    LAB_TECHNICIAN: {
      title: 'Service Laboratoire',
      description: 'Scanner les QR codes et valider les examens',
      icon: <ScienceRounded sx={{ fontSize: 40, color: '#9c27b0' }} />,
      path: '/service',
      bgColor: '#f3e5f5'
    },
    ADMIN: {
      title: 'Administration',
      description: 'Gérer le système et consulter les rapports',
      icon: <AdminPanelSettingsRounded sx={{ fontSize: 40, color: '#d32f2f' }} />,
      path: '/admin',
      bgColor: '#ffebee'
    }
  };

  const userCard = roleCards[user?.role];

  return (
    <Box>
      {/* En-tête de page */}
      <Box sx={{ mb: 5, textAlign: { xs: 'center', md: 'left' } }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Bienvenue, {user?.firstName} !
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Sélectionnez votre espace de travail pour commencer.
        </Typography>
      </Box>

      {/* Grille des cartes */}
      <Grid container spacing={3}>
        {userCard && (
          <Grid item xs={12} sm={6} md={4}>
            <Card
              elevation={0}
              sx={{
                height: '100%',
                borderRadius: 4,
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 30px rgba(0,0,0,0.08)'
                }
              }}
            >
              <CardActionArea onClick={() => navigate(userCard.path)} sx={{ height: '100%', p: 2 }}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                  <Box
                    sx={{
                      bgcolor: userCard.bgColor,
                      width: 80,
                      height: 80,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3
                    }}
                  >
                    {userCard.icon}
                  </Box>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
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

        {/* Pour l'admin, afficher toutes les autres options */}
        {user?.role === 'ADMIN' && Object.entries(roleCards)
          .filter(([key]) => key !== 'ADMIN')
          .map(([key, card]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  borderRadius: 4,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 30px rgba(0,0,0,0.08)'
                  }
                }}
              >
                <CardActionArea onClick={() => navigate(card.path)} sx={{ height: '100%', p: 2 }}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <Box
                      sx={{
                        bgcolor: card.bgColor,
                        width: 80,
                        height: 80,
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3
                      }}
                    >
                      {card.icon}
                    </Box>
                    <Typography variant="h6" fontWeight="bold" gutterBottom>
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
    </Box>
  );
};

export default Dashboard;