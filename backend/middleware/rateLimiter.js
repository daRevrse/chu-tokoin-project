const rateLimit = require('express-rate-limit');

/**
 * Rate limiter general
 * Limite a 100 requetes par 15 minutes
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requetes par fenetre
  message: { error: 'Trop de requetes, veuillez reessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Ne pas limiter les healthchecks
    return req.path === '/health' || req.path === '/api/health';
  }
});

/**
 * Rate limiter pour l'authentification
 * Limite a 5 tentatives par heure
 */
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 tentatives
  message: { error: 'Trop de tentatives de connexion, veuillez reessayer dans 1 heure' },
  skipSuccessfulRequests: true, // Ne compte pas les connexions reussies
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour les paiements
 * Limite a 10 requetes par minute
 */
const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requetes par minute
  message: { error: 'Trop de requetes de paiement, veuillez patienter' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour les exports de rapports
 * Limite a 5 exports par 10 minutes
 */
const exportLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // 5 exports
  message: { error: 'Trop d\'exports demandes, veuillez patienter' },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter pour le portail patient
 * Limite a 30 requetes par 15 minutes
 */
const portalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requetes
  message: { error: 'Trop de requetes, veuillez reessayer plus tard' },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = {
  generalLimiter,
  authLimiter,
  paymentLimiter,
  exportLimiter,
  portalLimiter
};
