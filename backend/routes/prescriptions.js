const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const prescriptionController = require('../controllers/prescriptionController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

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
  body('notes')
    .optional()
    .isString()
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
  roleCheck('DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  prescriptionController.getByNumber
);

router.get('/:id',
  roleCheck('DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  prescriptionController.getById
);

router.patch('/:id/cancel',
  roleCheck('DOCTOR', 'ADMIN'),
  prescriptionController.cancel
);

module.exports = router;
