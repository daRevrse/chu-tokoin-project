const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { SERVICE_ROLES } = require('../utils/roles');

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Stats medecin
router.get('/doctor',
  roleCheck('DOCTOR', 'ADMIN'),
  statsController.getDoctorStats
);

// Compteurs du menu lateral : chaque role y accede, la reponse est filtree
// selon ce qu'il peut voir.
router.get('/badges', statsController.getBadges);

// Stats accueil
router.get('/reception',
  roleCheck('RECEPTIONIST', 'ADMIN'),
  statsController.getReceptionStats
);

// Stats service (radiologie/labo)
router.get('/service',
  roleCheck(...SERVICE_ROLES, 'ADMIN'),
  statsController.getServiceStats
);

// Stats globales (admin uniquement)
router.get('/global',
  roleCheck('ADMIN'),
  statsController.getGlobalStats
);

module.exports = router;
