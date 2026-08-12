const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { SERVICE_ROLES } = require('../utils/roles');

// Validation pour la creation de paiement
const createValidation = [
  body('prescriptionId')
    .isUUID()
    .withMessage('ID prescription invalide'),
  body('paymentMethod')
    .optional()
    .isIn(['CASH', 'MOBILE_MONEY', 'CARD'])
    .withMessage('Methode de paiement invalide'),
  body('transactionReference')
    .optional()
    .isString()
];

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Routes
router.post('/',
  roleCheck('CASHIER', 'ADMIN'),
  createValidation,
  paymentController.create
);

router.get('/',
  roleCheck('CASHIER', 'ADMIN'),
  paymentController.getAll
);

router.get('/stats/today',
  roleCheck('CASHIER', 'ADMIN'),
  paymentController.getTodayStats
);

router.get('/:id',
  roleCheck('CASHIER', ...SERVICE_ROLES, 'ADMIN'),
  paymentController.getById
);

router.get('/:id/qrcode',
  roleCheck('CASHIER', ...SERVICE_ROLES, 'ADMIN'),
  paymentController.getQRCode
);

module.exports = router;
