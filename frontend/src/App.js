import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import theme from './theme';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Unauthorized from './pages/Unauthorized';

// Dashboards par role
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import CashierDashboard from './pages/cashier/CashierDashboard';
import ServiceDashboard from './pages/service/ServiceDashboard';

// Portail Patient
import PatientPortal from './pages/portal/PatientPortal';

// Admin Dashboard
import AdminDashboard from './pages/admin/AdminDashboard';

// Composant pour les routes protegees avec layout
const ProtectedWithLayout = ({ children, allowedRoles }) => (
  <ProtectedRoute allowedRoles={allowedRoles}>
    <MainLayout>
      {children}
    </MainLayout>
  </ProtectedRoute>
);

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Routes publiques */}
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />
            <Route path="/portal" element={<PatientPortal />} />

            {/* Dashboard principal */}
            <Route
              path="/dashboard"
              element={
                <ProtectedWithLayout>
                  <Dashboard />
                </ProtectedWithLayout>
              }
            />

            {/* Espace Medecin */}
            <Route
              path="/doctor/*"
              element={
                <ProtectedWithLayout allowedRoles={['DOCTOR', 'ADMIN']}>
                  <DoctorDashboard />
                </ProtectedWithLayout>
              }
            />

            {/* Espace Caisse */}
            <Route
              path="/cashier/*"
              element={
                <ProtectedWithLayout allowedRoles={['CASHIER', 'ADMIN']}>
                  <CashierDashboard />
                </ProtectedWithLayout>
              }
            />

            {/* Espace Services (Radiologie / Laboratoire) */}
            <Route
              path="/service/*"
              element={
                <ProtectedWithLayout allowedRoles={['RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN']}>
                  <ServiceDashboard />
                </ProtectedWithLayout>
              }
            />

            {/* Espace Admin */}
            <Route
              path="/admin/*"
              element={
                <ProtectedWithLayout allowedRoles={['ADMIN']}>
                  <AdminDashboard />
                </ProtectedWithLayout>
              }
            />

            {/* Redirection par defaut */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Route 404 */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
