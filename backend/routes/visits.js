const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const visitController = require('../controllers/visitController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Bornes physiologiques larges : elles ne servent pas a poser un diagnostic
// mais a attraper les fautes de frappe (temperature a 370, poids a 700).
const vitalsValidation = [
  body('weightKg').optional({ checkFalsy: true }).isFloat({ min: 0.5, max: 400 })
    .withMessage('Poids invalide (0.5 a 400 kg)'),
  body('heightCm').optional({ checkFalsy: true }).isInt({ min: 20, max: 250 })
    .withMessage('Taille invalide (20 a 250 cm)'),
  body('temperatureC').optional({ checkFalsy: true }).isFloat({ min: 30, max: 45 })
    .withMessage('Temperature invalide (30 a 45 °C)'),
  body('bloodPressureSys').optional({ checkFalsy: true }).isInt({ min: 40, max: 300 })
    .withMessage('Tension systolique invalide (40 a 300 mmHg)'),
  body('bloodPressureDia').optional({ checkFalsy: true }).isInt({ min: 20, max: 200 })
    .withMessage('Tension diastolique invalide (20 a 200 mmHg)'),
  body('pulseBpm').optional({ checkFalsy: true }).isInt({ min: 20, max: 250 })
    .withMessage('Pouls invalide (20 a 250 bpm)')
];

const createValidation = [
  body('patientId')
    .isUUID()
    .withMessage('Patient invalide'),
  body('priority')
    .optional()
    .isIn(['NORMAL', 'URGENT'])
    .withMessage('Priorite invalide (NORMAL ou URGENT)'),
  body('reason')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Motif trop long'),
  ...vitalsValidation
];

const cancelValidation = [
  body('cancelReason')
    .trim()
    .notEmpty()
    .withMessage('Le motif d\'annulation est requis')
];

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// --- Accueil ---
router.post('/',
  roleCheck('RECEPTIONIST', 'ADMIN'),
  createValidation,
  visitController.create
);

router.patch('/:id/vitals',
  roleCheck('RECEPTIONIST', 'ADMIN'),
  vitalsValidation,
  visitController.updateVitals
);

// --- File d'attente, partagee accueil / medecin ---
router.get('/queue',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'ADMIN'),
  visitController.getQueue
);

router.get('/today/:ticketNumber',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'ADMIN'),
  visitController.getByTicket
);

router.get('/patient/:patientId',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'ADMIN'),
  visitController.getPatientHistory
);

// --- Medecin ---
router.patch('/:id/take',
  roleCheck('DOCTOR', 'ADMIN'),
  visitController.take
);

router.patch('/:id/complete',
  roleCheck('DOCTOR', 'ADMIN'),
  visitController.complete
);

router.patch('/:id/cancel',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'ADMIN'),
  cancelValidation,
  visitController.cancel
);

// Route parametrique en dernier, pour ne pas capturer /queue, /today/... ni
// /patient/...
router.get('/:id',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'ADMIN'),
  visitController.getById
);

module.exports = router;
