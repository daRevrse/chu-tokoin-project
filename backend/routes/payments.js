const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { SERVICE_ROLES } = require('../utils/roles');

// La presence d'au moins un des deux identifiants est verifiee dans le
// controleur : express-validator ne sait pas exprimer "l'un ou l'autre".
const createValidation = [
  body('invoiceId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('ID facture invalide'),
  body('prescriptionId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('ID prescription invalide'),
  // Absent = le caissier solde la facture. Present = reglement partiel.
  body('amount')
    .optional({ values: 'null' })
    .isFloat({ gt: 0 })
    .withMessage('Le montant verse doit etre positif'),
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

// Reserve a l'administrateur : annuler un versement fait rentrer de l'argent
// dans la caisse sans contrepartie enregistree, ce n'est pas un geste de guichet.
router.patch('/:id/cancel',
  roleCheck('ADMIN'),
  [
    body('cancelReason')
      .trim()
      .notEmpty()
      .withMessage('Le motif d\'annulation est requis')
  ],
  paymentController.cancel
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
