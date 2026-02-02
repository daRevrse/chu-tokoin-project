import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import Loading from '../common/Loading';

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Afficher le loading pendant la verification
  if (loading) {
    return <Loading fullScreen message="Verification de l'authentification..." />;
  }

  // Rediriger vers login si non authentifie
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verifier les roles si specifies
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // Rediriger vers une page d'acces refuse ou le dashboard par defaut
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

export default ProtectedRoute;
