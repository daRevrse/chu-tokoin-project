import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

const POLL_INTERVAL_MS = 15000;

/**
 * File d'attente du jour, rafraichie par polling.
 *
 * La pile ne comporte pas de WebSocket : on interroge l'API toutes les 15 s.
 * Le polling se met en pause quand l'onglet passe en arriere-plan, pour ne pas
 * marteler l'API depuis les postes laisses allumes toute la journee.
 *
 * @param {object} [options]
 * @param {string} [options.status] - statuts a inclure, ex. 'WAITING'
 * @param {string} [options.specialtyId] - specialite a isoler, ou 'none' pour
 *   les passages que l'accueil n'a orientes vers aucune specialite. Absent, la
 *   file est complete.
 * @param {boolean} [options.enabled=true] - suspend le polling si false
 */
const useVisitQueue = ({ status, specialtyId, enabled = true } = {}) => {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Evite d'afficher le voile de chargement a chaque tick de polling
  const initialLoadDone = useRef(false);

  const fetchQueue = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);

    try {
      const search = new URLSearchParams();
      if (status) search.set('status', status);
      if (specialtyId) search.set('specialtyId', specialtyId);

      const params = search.toString() ? `?${search}` : '';
      const response = await api.get(`/visits/queue${params}`);
      setVisits(response.data.visits || []);
      setError('');
      initialLoadDone.current = true;
    } catch (err) {
      console.error('Erreur file d\'attente:', err);
      setError(err.response?.data?.error || 'Impossible de charger la file d\'attente');
    } finally {
      setLoading(false);
    }
  }, [status, specialtyId]);

  useEffect(() => {
    if (!enabled) return undefined;

    fetchQueue({ silent: initialLoadDone.current });

    const tick = () => {
      if (document.visibilityState === 'visible') {
        fetchQueue({ silent: true });
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);

    // Rattrapage immediat au retour sur l'onglet, sans attendre le tick suivant
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchQueue({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchQueue, enabled]);

  return { visits, loading, error, refresh: fetchQueue };
};

export default useVisitQueue;
