import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { APP_IDENTITY } from '../config/appIdentity';

const API_ORIGIN = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');

// Repli utilise tant que l'API n'a pas repondu, pour que la page de connexion
// ne s'affiche jamais avec un en-tete vide.
const FALLBACK_HOSPITAL = { name: '', fullName: null, logoUrl: null };

const HospitalContext = createContext(null);

export const useHospital = () => {
  const context = useContext(HospitalContext);
  if (!context) {
    throw new Error('useHospital doit etre utilise dans un HospitalProvider');
  }
  return context;
};

/**
 * Identité de l'établissement (nom, logo, coordonnées), chargée une fois au
 * démarrage. La route est publique : la page de connexion, le portail patient
 * et les tickets en ont besoin avant toute authentification.
 */
export const HospitalProvider = ({ children }) => {
  const [hospital, setHospital] = useState(FALLBACK_HOSPITAL);
  const [loading, setLoading] = useState(true);

  const refreshHospital = useCallback(async () => {
    try {
      const response = await api.get('/settings/hospital');
      setHospital(response.data.hospital || FALLBACK_HOSPITAL);
      return response.data.hospital;
    } catch (err) {
      // L'application doit rester utilisable meme si l'identite n'a pas pu
      // etre chargee : on garde le repli plutot que de bloquer l'ecran.
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshHospital();
  }, [refreshHospital]);

  // Le titre de l'onglet porte les deux identites : l'etablissement d'abord,
  // le produit ensuite.
  useEffect(() => {
    document.title = hospital.name
      ? `${hospital.name} — ${APP_IDENTITY.name}`
      : APP_IDENTITY.name;
  }, [hospital.name]);

  // Remplacer l'identite a partir d'une reponse serveur (formulaire d'admin)
  const applyHospital = useCallback((updated) => {
    if (updated) setHospital(updated);
  }, []);

  const value = {
    hospital,
    loading,
    refreshHospital,
    applyHospital,
    // URL absolue du logo, ou `null` si l'etablissement n'en a pas televerse
    logoSrc: hospital.logoUrl ? `${API_ORIGIN}${hospital.logoUrl}` : null,
    app: APP_IDENTITY
  };

  return (
    <HospitalContext.Provider value={value}>
      {children}
    </HospitalContext.Provider>
  );
};

export default HospitalContext;
