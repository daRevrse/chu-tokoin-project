const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const invoiceController = require('../controllers/invoiceController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const cancelValidation = [
  body('cancelReason')
    .trim()
    .notEmpty()
    .withMessage('Le motif d\'annulation est requis')
];

router.use(authenticateToken);

// File de travail de la caisse. Declaree avant `/:id` pour ne pas etre
// capturee par la route parametrique.
router.get('/consultations/today',
  roleCheck('CASHIER', 'ADMIN'),
  invoiceController.getTodayConsultations
);

router.get('/',
  roleCheck('CASHIER', 'ADMIN'),
  invoiceController.getAll
);

// L'accueil et le medecin y accedent aussi : le premier annonce le montant du
// au patient, le second doit pouvoir verifier pourquoi une prise en charge est
// refusee.
router.get('/:id',
  roleCheck('CASHIER', 'ADMIN', 'RECEPTIONIST', 'DOCTOR'),
  invoiceController.getById
);

// L'annulation vaut renoncement a une creance : elle reste a l'administrateur.
router.patch('/:id/cancel',
  roleCheck('ADMIN'),
  cancelValidation,
  invoiceController.cancel
);

module.exports = router;
