const logger = require('../utils/logger');

// Middleware de gestion des erreurs 404
const notFound = (req, res, next) => {
  const error = new Error(`Route non trouvee - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

// Middleware de gestion globale des erreurs
const errorHandler = (err, req, res, next) => {
  // Log l'erreur
  logger.error({
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.user?.id
  });

  // Determiner le code de statut
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Une erreur est survenue'
      : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = { notFound, errorHandler };
