import React, { useState, useEffect } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Divider,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  MenuRounded,
  DashboardRounded,
  PointOfSaleRounded,
  MedicalServicesRounded,
  ScienceRounded,
  AdminPanelSettingsRounded,
  SupportAgentRounded,
  LogoutRounded,
  NotificationsNoneRounded,
  AccountCircleRounded
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const drawerWidth = 280;

// Personnel affecte a un service technique. TECHNICIAN est le role generique
// des services crees apres coup (Cardiologie, Pneumologie, Prelevement...).
const SERVICE_ROLES = ['RADIOLOGIST', 'LAB_TECHNICIAN', 'TECHNICIAN'];

const API_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

const MainLayout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [badges, setBadges] = useState({});
  const avatarSrc = user?.avatarUrl ? `${API_ORIGIN}${user.avatarUrl}` : undefined;

  // Compteurs d'activite en attente par espace. Un seul appel, filtre par role
  // cote serveur. Le rythme suit celui des files (useVisitQueue) : au-dela, une
  // pastille perimee vaut moins que pas de pastille du tout.
  useEffect(() => {
    if (!user) return undefined;

    const fetchBadges = async () => {
      try {
        const response = await api.get('/stats/badges');
        setBadges(response.data.badges || {});
      } catch {
        // Une pastille est un confort : son echec ne doit rien interrompre.
      }
    };

    fetchBadges();

    // Suspendu quand l'onglet passe en arriere-plan : les postes restent
    // allumes toute la journee dans les services.
    const tick = () => {
      if (document.visibilityState === 'visible') fetchBadges();
    };
    const interval = setInterval(tick, 30000);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [user]);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
    navigate('/login');
  };

  const getRoleLabel = (role) => {
    const labels = {
      ADMIN: 'Administrateur',
      DOCTOR: 'Médecin',
      CASHIER: 'Caissier',
      RADIOLOGIST: 'Radiologue',
      LAB_TECHNICIAN: 'Laborantin',
      TECHNICIAN: 'Technicien',
      RECEPTIONIST: 'Accueil'
    };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: 'error',
      DOCTOR: 'primary',
      CASHIER: 'success',
      RADIOLOGIST: 'info',
      LAB_TECHNICIAN: 'warning',
      TECHNICIAN: 'info',
      RECEPTIONIST: 'secondary'
    };
    return colors[role] || 'default';
  };

  const getMenuItems = () => {
    const baseItems = [
      { text: 'Tableau de bord', icon: <DashboardRounded />, path: '/dashboard' }
    ];

    // L'accueil ouvre le circuit : son entree precede celle du medecin.
    if (user?.role === 'RECEPTIONIST' || user?.role === 'ADMIN') {
      baseItems.push({ text: 'Espace Accueil', icon: <SupportAgentRounded />, path: '/reception', badge: badges.reception });
    }
    if (user?.role === 'DOCTOR' || user?.role === 'ADMIN') {
      baseItems.push({ text: 'Espace Médecin', icon: <MedicalServicesRounded />, path: '/doctor', badge: badges.doctor });
    }
    if (user?.role === 'CASHIER' || user?.role === 'ADMIN') {
      baseItems.push({ text: 'Espace Caisse', icon: <PointOfSaleRounded />, path: '/cashier', badge: badges.cashier });
    }
    if (SERVICE_ROLES.includes(user?.role) || user?.role === 'ADMIN') {
      baseItems.push({ text: 'Espace Service', icon: <ScienceRounded />, path: '/service', badge: badges.service });
    }
    if (user?.role === 'ADMIN') {
      baseItems.push({ text: 'Administration', icon: <AdminPanelSettingsRounded />, path: '/admin' });
    }
    return baseItems;
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Profil Utilisateur */}
      <Box sx={{ px: 3, pt: 4, pb: 3, textAlign: 'center' }}>
        <Avatar
          src={avatarSrc}
          sx={{ width: 64, height: 64, margin: '0 auto', mb: 1, bgcolor: 'primary.main', fontSize: '1.5rem', fontWeight: 'bold' }}
        >
          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
        </Avatar>
        <Typography variant="subtitle1" fontWeight="bold">
          {user?.firstName} {user?.lastName}
        </Typography>
        <Chip 
          label={getRoleLabel(user?.role)} 
          size="small" 
          color={getRoleColor(user?.role)} 
          sx={{ mt: 0.5, borderRadius: 1, fontWeight: 'bold' }} 
        />
      </Box>

      <Divider sx={{ mb: 2, mx: 2 }} />

      {/* Navigation */}
      <List sx={{ px: 2, flexGrow: 1 }}>
        {getMenuItems().map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.path} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  bgcolor: isActive ? '#e3f2fd' : 'transparent',
                  color: isActive ? '#1976d2' : 'text.primary',
                  '&:hover': { bgcolor: isActive ? '#e3f2fd' : '#f5f5f5' }
                }}
              >
                <ListItemIcon sx={{ color: isActive ? '#1976d2' : 'inherit', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{ fontWeight: isActive ? 'bold' : 'medium' }}
                />
                {/* Pastille de fin de ligne : le menu est large et libelle, un
                    compteur lisible y passe mieux qu'une puce sur l'icone.
                    Absente a zero, pour qu'elle garde sa valeur de signal. */}
                {item.badge > 0 && (
                  <Chip
                    label={item.badge > 99 ? '99+' : item.badge}
                    size="small"
                    color="warning"
                    aria-label={`${item.badge} en attente`}
                    sx={{
                      height: 22,
                      minWidth: 22,
                      fontWeight: 'bold',
                      fontSize: '0.75rem',
                      '& .MuiChip-label': { px: 0.75 }
                    }}
                  />
                )}
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Pied de Sidebar (Logo H360) */}
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <img src="logo-black.png" alt="Logo" style={{ width: 50, height: 50 }} />
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ lineHeight: 1.2 }}>
            H360
          </Typography>
          <Typography variant="caption" color="textSecondary">
            CHU Tokoin
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f5f7fb' }}>
      
      {/* AppBar Transparente pour mobile et actions */}
      <AppBar position="fixed" elevation={0} sx={{ width: { md: `calc(100% - ${drawerWidth}px)` }, ml: { md: `${drawerWidth}px` }, bgcolor: 'transparent', backdropFilter: 'blur(8px)' }}>
        <Toolbar>
          <IconButton color="action" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { md: 'none' } }}>
            <MenuRounded />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton sx={{ bgcolor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.05)', mr: 2 }}>
            <NotificationsNoneRounded color="action" />
          </IconButton>
          <Avatar
            onClick={handleMenuOpen}
            src={avatarSrc}
            sx={{ bgcolor: 'primary.main', cursor: 'pointer', width: 40, height: 40, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
          >
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </Avatar>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
            <MenuItem disabled><Typography variant="body2">{user?.email}</Typography></MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
              <ListItemIcon><AccountCircleRounded fontSize="small" /></ListItemIcon>Mon profil
            </MenuItem>
            <MenuItem onClick={handleLogout}><ListItemIcon><LogoutRounded fontSize="small" /></ListItemIcon>Déconnexion</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: 'none' } }}
        >
          {drawerContent}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth, borderRight: 'none', boxShadow: '4px 0 24px rgba(0,0,0,0.05)' } }}
        >
          {drawerContent}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, mt: { xs: 7, md: 8 } }}>
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;