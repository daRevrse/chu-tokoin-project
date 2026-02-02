const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Stats service (radiologie/labo)
router.get('/service',
  roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  statsController.getServiceStats
);

// Stats globales (admin uniquement)
router.get('/global',
  roleCheck('ADMIN'),
  statsController.getGlobalStats
);

module.exports = router;
