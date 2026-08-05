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
  Badge,
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
  LogoutRounded,
  NotificationsNoneRounded,
  BiotechRounded
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const drawerWidth = 280;

const MainLayout = ({ children }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [doctorBadge, setDoctorBadge] = useState(0);

  // Fetch notification count for doctors
  useEffect(() => {
    if (user?.role === 'DOCTOR' || user?.role === 'ADMIN') {
      const fetchBadge = async () => {
        try {
          const response = await api.get('/stats/doctor');
          setDoctorBadge(response.data.newResultsCount || 0);
        } catch {
          // Silently fail
        }
      };
      fetchBadge();
      const interval = setInterval(fetchBadge, 60000);
      return () => clearInterval(interval);
    }
  }, [user?.role]);

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
      LAB_TECHNICIAN: 'Laborantin'
    };
    return labels[role] || role;
  };

  const getRoleColor = (role) => {
    const colors = {
      ADMIN: 'error',
      DOCTOR: 'primary',
      CASHIER: 'success',
      RADIOLOGIST: 'info',
      LAB_TECHNICIAN: 'warning'
    };
    return colors[role] || 'default';
  };

  const getMenuItems = () => {
    const baseItems = [
      { text: 'Tableau de bord', icon: <DashboardRounded />, path: '/dashboard' }
    ];

    if (user?.role === 'DOCTOR' || user?.role === 'ADMIN') {
      baseItems.push({ text: 'Espace Médecin', icon: <MedicalServicesRounded />, path: '/doctor' });
    }
    if (user?.role === 'CASHIER' || user?.role === 'ADMIN') {
      baseItems.push({ text: 'Espace Caisse', icon: <PointOfSaleRounded />, path: '/cashier' });
    }
    if (user?.role === 'RADIOLOGIST' || user?.role === 'LAB_TECHNICIAN' || user?.role === 'ADMIN') {
      baseItems.push({ text: 'Espace Service', icon: <ScienceRounded />, path: '/service' });
    }
    if (user?.role === 'ADMIN') {
      baseItems.push({ text: 'Administration', icon: <AdminPanelSettingsRounded />, path: '/admin' });
    }
    return baseItems;
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* En-tête Sidebar (Logo H360) */}
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

      {/* Profil Utilisateur */}
      <Box sx={{ px: 3, pb: 3, textAlign: 'center' }}>
        <Avatar 
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
                  {item.path === '/doctor' && doctorBadge > 0 ? (
                    <Badge badgeContent={doctorBadge} color="error" max={99}>
                      {item.icon}
                    </Badge>
                  ) : item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{ fontWeight: isActive ? 'bold' : 'medium' }} 
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box sx={{ p: 2 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2, color: 'text.secondary', '&:hover': { color: 'error.main', bgcolor: '#ffebee' } }}>
            <ListItemIcon sx={{ color: 'inherit', minWidth: 40 }}>
              <LogoutRounded />
            </ListItemIcon>
            <ListItemText primary="Déconnexion" primaryTypographyProps={{ fontWeight: 'medium' }} />
          </ListItemButton>
        </ListItem>
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
            sx={{ bgcolor: 'primary.main', cursor: 'pointer', width: 40, height: 40, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
          >
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </Avatar>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
            <MenuItem disabled><Typography variant="body2">{user?.email}</Typography></MenuItem>
            <Divider />
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