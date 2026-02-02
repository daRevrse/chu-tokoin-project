const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const patientController = require('../controllers/patientController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Validation pour la creation de patient
const createValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Le prenom est requis'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis'),
  body('dateOfBirth')
    .isDate()
    .withMessage('Date de naissance invalide'),
  body('gender')
    .isIn(['M', 'F'])
    .withMessage('Genre invalide (M ou F)'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Le telephone est requis'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email invalide')
];

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Routes
router.post('/',
  roleCheck('DOCTOR', 'ADMIN'),
  createValidation,
  patientController.create
);

router.get('/',
  roleCheck('DOCTOR', 'CASHIER', 'ADMIN'),
  patientController.search
);

router.get('/number/:number',
  roleCheck('DOCTOR', 'CASHIER', 'ADMIN'),
  patientController.getByNumber
);

router.get('/:id',
  roleCheck('DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  patientController.getById
);

router.put('/:id',
  roleCheck('DOCTOR', 'ADMIN'),
  patientController.update
);

module.exports = router;
