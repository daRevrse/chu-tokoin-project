const jwt = require('jsonwebtoken');
const { Patient } = require('../models');
const logger = require('../utils/logger');

/**
 * Middleware d'authentification pour le portail patient
 * Utilise des tokens temporaires avec duree de vie limitee
 */
const patientAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token d\'acces requis' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Verifier que c'est un token patient
      if (decoded.type !== 'patient_portal') {
        return res.status(401).json({ error: 'Token invalide' });
      }

      // Verifier que le patient existe
      const patient = await Patient.findByPk(decoded.patientId);
      if (!patient) {
        return res.status(401).json({ error: 'Patient non trouve' });
      }

      req.patient = patient;
      req.tokenData = decoded;
      next();
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expire' });
      }
      return res.status(401).json({ error: 'Token invalide' });
    }
  } catch (error) {
    logger.error('Patient auth error:', error);
    res.status(500).json({ error: 'Erreur d\'authentification' });
  }
};

/**
 * Generer un token d'acces temporaire pour le portail patient
 * @param {string} patientId - ID du patient
 * @param {number} expiresInHours - Duree de validite en heures (defaut: 24h)
 * @returns {string} Token JWT
 */
const generatePatientToken = (patientId, expiresInHours = 24) => {
  return jwt.sign(
    {
      patientId,
      type: 'patient_portal',
      createdAt: new Date().toISOString()
    },
    process.env.JWT_SECRET,
    { expiresIn: `${expiresInHours}h` }
  );
};

module.exports = {
  patientAuth,
  generatePatientToken
};
