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
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Payment as PaymentIcon,
  LocalHospital as HospitalIcon,
  Science as ScienceIcon,
  AdminPanelSettings as AdminIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon
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
      DOCTOR: 'Medecin',
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
      { text: 'Tableau de bord', icon: <DashboardIcon />, path: '/dashboard' }
    ];

    if (user?.role === 'DOCTOR' || user?.role === 'ADMIN') {
      baseItems.push({
        text: 'Espace Medecin',
        icon: <HospitalIcon />,
        path: '/doctor'
      });
    }

    if (user?.role === 'CASHIER' || user?.role === 'ADMIN') {
      baseItems.push({
        text: 'Espace Caisse',
        icon: <PaymentIcon />,
        path: '/cashier'
      });
    }

    if (user?.role === 'RADIOLOGIST' || user?.role === 'LAB_TECHNICIAN' || user?.role === 'ADMIN') {
      baseItems.push({
        text: 'Espace Service',
        icon: <ScienceIcon />,
        path: '/service'
      });
    }

    if (user?.role === 'ADMIN') {
      baseItems.push({
        text: 'Administration',
        icon: <AdminIcon />,
        path: '/admin'
      });
    }

    return baseItems;
  };

  const drawer = (
    <Box>
      <Box sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.main', color: 'white' }}>
        <Typography variant="h6" fontWeight="bold">
          CHU TOKOIN
        </Typography>
        <Typography variant="caption">
          Systeme de Gestion des Examens
        </Typography>
      </Box>

      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Avatar sx={{ bgcolor: 'primary.main' }}>
            {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
          </Avatar>
          <Box>
            <Typography fontWeight="medium">
              {user?.firstName} {user?.lastName}
            </Typography>
            <Chip
              label={getRoleLabel(user?.role)}
              color={getRoleColor(user?.role)}
              size="small"
            />
          </Box>
        </Box>
      </Box>

      <Divider />

      <List>
        {getMenuItems().map((item) => (
          <ListItem key={item.path} disablePadding>
            <ListItemButton
              selected={location.pathname.startsWith(item.path)}
              onClick={() => {
                navigate(item.path);
                if (isMobile) setMobileOpen(false);
              }}
              sx={{
                '&.Mui-selected': {
                  bgcolor: 'primary.light',
                  borderRight: 3,
                  borderColor: 'primary.main'
                }
              }}
            >
              <ListItemIcon sx={{ color: location.pathname.startsWith(item.path) ? 'primary.main' : 'inherit' }}>
                {item.path === '/doctor' && doctorBadge > 0 ? (
                  <Badge badgeContent={doctorBadge} color="error" max={99}>
                    {item.icon}
                  </Badge>
                ) : item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Divider />

      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Deconnexion" />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` }
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            CHU Tokoin - Gestion des Examens
          </Typography>

          <IconButton color="inherit" onClick={handleMenuOpen}>
            <AccountIcon />
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem disabled>
              <Typography variant="body2">
                {user?.email}
              </Typography>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon fontSize="small" />
              </ListItemIcon>
              Deconnexion
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
          }}
        >
          {drawer}
        </Drawer>

        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth }
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'grey.100'
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;
