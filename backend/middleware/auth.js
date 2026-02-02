const jwt = require('jsonwebtoken');
const { User } = require('../models');
const jwtConfig = require('../config/jwt');
const logger = require('../utils/logger');

/**
 * Middleware d'authentification JWT
 * Verifie le token et ajoute l'utilisateur a req.user
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Recuperer le header Authorization
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

    if (!token) {
      return res.status(401).json({
        error: 'Token d\'authentification requis'
      });
    }

    // Verifier le token
    const decoded = jwt.verify(token, jwtConfig.secret);

    // Recuperer l'utilisateur
    const user = await User.findByPk(decoded.userId);

    if (!user) {
      return res.status(401).json({
        error: 'Utilisateur non trouve'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        error: 'Compte desactive'
      });
    }

    // Ajouter l'utilisateur a la requete
    req.user = user;
    next();
  } catch (error) {
    logger.warn('Authentication error:', { error: error.message });

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Token expire',
        code: 'TOKEN_EXPIRED'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        error: 'Token invalide'
      });
    }

    return res.status(500).json({
      error: 'Erreur d\'authentification'
    });
  }
};

module.exports = authenticateToken;
