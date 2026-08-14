const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const prescriptionController = require('../controllers/prescriptionController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { SERVICE_ROLES } = require('../utils/roles');

// Validation pour la creation de prescription
const createValidation = [
  body('patientId')
    .isUUID()
    .withMessage('ID patient invalide'),
  body('examIds')
    .isArray({ min: 1 })
    .withMessage('Au moins un examen est requis'),
  body('examIds.*')
    .isUUID()
    .withMessage('ID examen invalide'),
  // Le formulaire envoie explicitement `null` quand le champ est vide, et
  // `.optional()` seul ne saute que `undefined`.
  body('notes')
    .optional({ values: 'null' })
    .isString(),
  // Passage a l'origine de la consultation. Optionnel : une prescription peut
  // encore etre creee hors circuit d'accueil.
  body('visitId')
    .optional({ checkFalsy: true })
    .isUUID()
    .withMessage('Passage invalide')
];

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Routes
router.post('/',
  roleCheck('DOCTOR', 'ADMIN'),
  createValidation,
  prescriptionController.create
);

router.get('/',
  roleCheck('DOCTOR', 'CASHIER', 'ADMIN'),
  prescriptionController.getAll
);

router.get('/my-prescriptions',
  roleCheck('DOCTOR', 'ADMIN'),
  prescriptionController.getMyPrescriptions
);

router.get('/pending',
  roleCheck('CASHIER', 'ADMIN'),
  prescriptionController.getPending
);

router.get('/number/:number',
  roleCheck('DOCTOR', 'CASHIER', ...SERVICE_ROLES, 'ADMIN'),
  prescriptionController.getByNumber
);

router.get('/:id/pdf',
  roleCheck('DOCTOR', 'ADMIN'),
  prescriptionController.exportPDF
);

router.get('/:id',
  roleCheck('DOCTOR', 'CASHIER', ...SERVICE_ROLES, 'ADMIN'),
  prescriptionController.getById
);

router.patch('/:id/cancel',
  roleCheck('DOCTOR', 'ADMIN'),
  prescriptionController.cancel
);

module.exports = router;
