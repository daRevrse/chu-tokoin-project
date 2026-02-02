import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// Creer le contexte
const AuthContext = createContext(null);

// Hook personnalise pour utiliser le contexte
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit etre utilise dans un AuthProvider');
  }
  return context;
};

// Provider du contexte
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Charger l'utilisateur depuis le localStorage au demarrage
  useEffect(() => {
    const initAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const savedUser = localStorage.getItem('user');

        if (token && savedUser) {
          setUser(JSON.parse(savedUser));
        }
      } catch (err) {
        console.error('Erreur lors de l\'initialisation de l\'auth:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Fonction de connexion
  const login = useCallback(async (email, password) => {
    setError(null);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, refreshToken, user: userData } = response.data;

      // Sauvegarder dans localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(userData));

      setUser(userData);
      return userData;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Erreur de connexion';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  }, []);

  // Fonction de deconnexion
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
    setError(null);
  }, []);

  // Fonction pour mettre a jour le profil utilisateur
  const updateProfile = useCallback(async (userData) => {
    try {
      const response = await api.put('/auth/profile', userData);
      const updatedUser = response.data.user;

      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);

      return updatedUser;
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Erreur de mise a jour';
      throw new Error(errorMessage);
    }
  }, []);

  // Verifier si l'utilisateur a un role specifique
  const hasRole = useCallback((roles) => {
    if (!user) return false;
    if (typeof roles === 'string') {
      return user.role === roles;
    }
    return roles.includes(user.role);
  }, [user]);

  // Valeur du contexte
  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    login,
    logout,
    updateProfile,
    hasRole,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
