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
const visitRoutes = require('./routes/visits');
const examRoutes = require('./routes/exams');
const prescriptionRoutes = require('./routes/prescriptions');
const paymentRoutes = require('./routes/payments');
const serviceRoutes = require('./routes/services');
const statsRoutes = require('./routes/stats');
const resultRoutes = require('./routes/results');
const patientRecordRoutes = require('./routes/patientRecords');
const portalRoutes = require('./routes/portal');
const reportRoutes = require('./routes/reports');
const userRoutes = require('./routes/users');
const serviceAdminRoutes = require('./routes/serviceAdmin');
const mobileMoneyRoutes = require('./routes/mobileMoney');
const healthRoutes = require('./routes/health');
const settingsRoutes = require('./routes/hospitalSettings');

// Import du rate limiter
const { generalLimiter, authLimiter, paymentLimiter, portalLimiter } = require('./middleware/rateLimiter');

const app = express();

// Middleware de securite
app.use(helmet());

// Configuration CORS
// FRONTEND_URL accepte plusieurs origines separees par des virgules, afin de
// pouvoir servir a la fois le poste local et un appareil du reseau local.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Pas d'origine = appel hors navigateur (curl, mobile natif) : autorise
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origine non autorisee par CORS : ${origin}`));
  },
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
// Helmet applique par defaut Cross-Origin-Resource-Policy: same-origin, ce qui
// empecherait le navigateur d'afficher une photo de profil servie par l'API
// (port 5000) dans une page du frontend (port 3000). On assouplit uniquement
// pour ce dossier de fichiers statiques.
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    next();
  },
  express.static(path.join(__dirname, 'uploads'))
);

// Routes de sante (sans authentification)
app.use('/api/health', healthRoutes);

// Routes API avec rate limiting specifique
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
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
app.use('/api/users', userRoutes);
app.use('/api/admin/services', serviceAdminRoutes);
app.use('/api/settings', settingsRoutes);

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
