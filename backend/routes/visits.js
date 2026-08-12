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
  body('visitType')
    .optional()
    .isIn(['CONSULTATION', 'RESULT_REVIEW'])
    .withMessage('Type de passage invalide'),
  // La coherence avec `visitType` et l'etat des resultats est verifiee dans le
  // controleur : elle depend d'autres champs et de la base.
  body('reviewedPrescriptionId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('Prescription invalide'),
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

// Suivi d'une prescription par son numero : c'est le geste de l'accueil quand
// le patient revient. Le medecin y a acces pour repondre a une question au
// telephone sans avoir a ouvrir le dossier complet.
router.get('/tracking/:prescriptionNumber',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'ADMIN'),
  visitController.getTracking
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
