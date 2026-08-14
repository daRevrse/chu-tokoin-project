const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const emergencyController = require('../controllers/emergencyController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { EMERGENCY_ROLES } = require('../utils/roles');

// Bornes larges : elles attrapent les fautes de frappe, pas les cas cliniques.
const vitalsValidation = [
  body('weightKg').optional({ checkFalsy: true }).isFloat({ min: 0.5, max: 400 })
    .withMessage('Poids invalide (0.5 a 400 kg)'),
  body('heightCm').optional({ checkFalsy: true }).isInt({ min: 20, max: 250 })
    .withMessage('Taille invalide (20 a 250 cm)'),
  body('temperatureC').optional({ checkFalsy: true }).isFloat({ min: 25, max: 45 })
    .withMessage('Temperature invalide (25 a 45 °C)'),
  body('bloodPressureSys').optional({ checkFalsy: true }).isInt({ min: 30, max: 300 })
    .withMessage('Tension systolique invalide (30 a 300 mmHg)'),
  body('bloodPressureDia').optional({ checkFalsy: true }).isInt({ min: 10, max: 200 })
    .withMessage('Tension diastolique invalide (10 a 200 mmHg)'),
  body('pulseBpm').optional({ checkFalsy: true }).isInt({ min: 10, max: 300 })
    .withMessage('Pouls invalide (10 a 300 bpm)'),
  body('oxygenSaturation').optional({ checkFalsy: true }).isInt({ min: 10, max: 100 })
    .withMessage('Saturation invalide (10 a 100 %)')
];

const createValidation = [
  // La presence d'au moins une identite (reelle ou provisoire) est verifiee dans
  // le controleur : express-validator ne sait pas exprimer "l'un ou l'autre".
  body('patientId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('Patient invalide'),
  body('provisionalLabel')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 150 })
    .withMessage('Designation provisoire trop longue'),
  body('arrivalMode')
    .optional()
    .isIn(['WALK_IN', 'AMBULANCE', 'REFERRAL', 'LAW_ENFORCEMENT', 'OTHER'])
    .withMessage('Mode d\'arrivee invalide'),
  body('triageLevel')
    .optional({ values: 'null' })
    .isInt({ min: 1, max: 5 })
    .withMessage('Niveau de triage invalide (1 a 5)'),
  ...vitalsValidation
];

const triageValidation = [
  body('triageLevel')
    .isInt({ min: 1, max: 5 })
    .withMessage('Niveau de triage invalide (1 a 5)'),
  ...vitalsValidation
];

const dischargeValidation = [
  body('outcome')
    .isIn(['HOME', 'ADMISSION', 'TRANSFER', 'AGAINST_ADVICE', 'DECEASED'])
    .withMessage('Mode de sortie invalide')
];

const identifyValidation = [
  body('patientId')
    .isUUID()
    .withMessage('Patient invalide')
];

router.use(authenticateToken);

// Routes fixes avant la route parametrique, sinon `/:id` les capture.
router.get('/queue',
  roleCheck(...EMERGENCY_ROLES, 'RECEPTIONIST', 'CASHIER'),
  emergencyController.getQueue
);

// La caisse y accede : ce sont les creances qu'elle n'a aucun moyen de reclamer
// tant que le dossier n'est pas rattache a un patient.
router.get('/unidentified',
  roleCheck(...EMERGENCY_ROLES, 'RECEPTIONIST', 'CASHIER'),
  emergencyController.getUnidentified
);

// L'accueil peut ouvrir un dossier : la nuit ou l'infirmier est au chevet d'un
// patient, refuser l'admission a l'agent present retarderait la prise en charge.
// Il ne peut en revanche pas coter le triage (voir utils/roles.js).
router.post('/',
  roleCheck(...EMERGENCY_ROLES, 'RECEPTIONIST'),
  createValidation,
  emergencyController.create
);

router.patch('/:id/triage',
  roleCheck(...EMERGENCY_ROLES),
  triageValidation,
  emergencyController.triage
);

router.patch('/:id/take',
  roleCheck('DOCTOR', 'ADMIN'),
  emergencyController.take
);

router.patch('/:id/discharge',
  roleCheck('DOCTOR', 'ADMIN'),
  dischargeValidation,
  emergencyController.discharge
);

router.patch('/:id/identify',
  roleCheck(...EMERGENCY_ROLES, 'RECEPTIONIST', 'CASHIER'),
  identifyValidation,
  emergencyController.identify
);

router.patch('/:id/leave',
  roleCheck(...EMERGENCY_ROLES, 'RECEPTIONIST'),
  emergencyController.leave
);

router.get('/:id',
  roleCheck(...EMERGENCY_ROLES, 'RECEPTIONIST', 'CASHIER'),
  emergencyController.getById
);

module.exports = router;
