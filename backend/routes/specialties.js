const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const specialtyController = require('../controllers/specialtyController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const specialtyValidation = [
  body('code')
    .trim()
    .isLength({ min: 2, max: 30 })
    .withMessage('Le code doit contenir entre 2 et 30 caracteres'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caracteres'),
  body('displayOrder')
    .optional({ values: 'null' })
    .isInt({ min: 0 })
    .withMessage('Ordre d\'affichage invalide')
];

const tariffValidation = [
  body('specialtyId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('Specialite invalide'),
  // Doit rester aligne sur l'ENUM de models/ConsultationTariff.js : EMERGENCY
  // couvre le forfait d'admission aux urgences.
  body('visitType')
    .optional()
    .isIn(['CONSULTATION', 'RESULT_REVIEW', 'EMERGENCY'])
    .withMessage('Type de passage invalide'),
  // Un tarif a 0 est valide : c'est une gratuite decidee, qui produit une
  // facture soldee et donc une trace.
  body('amount')
    .isFloat({ min: 0 })
    .withMessage('Le montant ne peut pas etre negatif'),
  body('label')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Libelle trop long'),
  // 0 = chaque passage est facture.
  body('validityDays')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 365 })
    .withMessage('Validite invalide (0 a 365 jours)')
];

const tariffUpdateValidation = [
  body('amount')
    .optional({ values: 'null' })
    .isFloat({ min: 0 })
    .withMessage('Le montant ne peut pas etre negatif'),
  body('label')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 120 })
    .withMessage('Libelle trop long'),
  // 0 = chaque passage est facture.
  body('validityDays')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 365 })
    .withMessage('Validite invalide (0 a 365 jours)'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Valeur invalide')
];

router.use(authenticateToken);

// --- Grille tarifaire ---
// Declarees avant `/:id` pour ne pas etre capturees par la route parametrique.
router.get('/tariffs',
  roleCheck('ADMIN', 'CASHIER', 'RECEPTIONIST'),
  specialtyController.getTariffs
);

router.post('/tariffs',
  roleCheck('ADMIN'),
  tariffValidation,
  specialtyController.createTariff
);

router.put('/tariffs/:id',
  roleCheck('ADMIN'),
  tariffUpdateValidation,
  specialtyController.updateTariff
);

// --- Specialites ---
// La lecture est ouverte a tout le personnel : l'accueil oriente, le medecin
// filtre sa file, la caisse affiche le libelle sur le recu.
router.get('/',
  specialtyController.getAll
);

router.post('/',
  roleCheck('ADMIN'),
  specialtyValidation,
  specialtyController.create
);

router.put('/:id',
  roleCheck('ADMIN'),
  specialtyController.update
);

module.exports = router;
