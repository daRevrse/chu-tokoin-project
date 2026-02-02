const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { sequelize, syncDatabase } = require('./models');
const logger = require('./utils/logger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Import des routes
const authRoutes = require('./routes/auth');
const patientRoutes = require('./routes/patients');
const examRoutes = require('./routes/exams');
const prescriptionRoutes = require('./routes/prescriptions');
const paymentRoutes = require('./routes/payments');
const serviceRoutes = require('./routes/services');
const statsRoutes = require('./routes/stats');
const resultRoutes = require('./routes/results');
const patientRecordRoutes = require('./routes/patientRecords');
const portalRoutes = require('./routes/portal');
const reportRoutes = require('./routes/reports');
const mobileMoneyRoutes = require('./routes/mobileMoney');
const healthRoutes = require('./routes/health');

// Import du rate limiter
const { generalLimiter, authLimiter, paymentLimiter, portalLimiter } = require('./middleware/rateLimiter');

const app = express();

// Middleware de securite
app.use(helmet());

// Configuration CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parser JSON et URL-encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging des requetes HTTP
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Rate limiting general (en production)
if (process.env.NODE_ENV === 'production') {
  app.use(generalLimiter);
}

// Servir les fichiers statiques (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes de sante (sans authentification)
app.use('/api/health', healthRoutes);

// Routes API avec rate limiting specifique
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/prescriptions', prescriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payments/mobile-money', paymentLimiter, mobileMoneyRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/patient-records', patientRecordRoutes);
app.use('/api/portal', portalLimiter, portalRoutes);
app.use('/api/reports', reportRoutes);

// Middleware de gestion des erreurs
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Fonction de demarrage du serveur
const startServer = async () => {
  try {
    // Test de connexion a la base de donnees
    await sequelize.authenticate();
    logger.info('Connexion a la base de donnees etablie avec succes.');

    // Synchronisation des modeles (en dev uniquement, utiliser migrations en prod)
    if (process.env.NODE_ENV === 'development') {
      await syncDatabase(false);
      logger.info('Modeles synchronises avec la base de donnees.');
    }

    // Demarrage du serveur
    app.listen(PORT, () => {
      logger.info(`Serveur demarre sur le port ${PORT}`);
      logger.info(`Environnement: ${process.env.NODE_ENV}`);
      logger.info(`URL: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Impossible de demarrer le serveur:', error);
    process.exit(1);
  }
};

// Gestion des erreurs non capturees
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Demarrer le serveur
startServer();

module.exports = app;
