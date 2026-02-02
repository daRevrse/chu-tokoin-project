const express = require('express');
const router = express.Router();
const mobileMoneyController = require('../controllers/mobileMoneyController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Callback des providers - pas d'authentification requise (appele par les providers)
router.post('/callback/:provider', mobileMoneyController.callback);

// Routes authentifiees
router.use(authenticateToken);

// Initier un paiement Mobile Money - accessible par CASHIER et ADMIN
router.post('/initiate', roleCheck('CASHIER', 'ADMIN'), mobileMoneyController.initiate);

// Verifier le statut d'un paiement
router.get('/:paymentId/status', mobileMoneyController.checkStatus);

// Simuler un callback (uniquement en mode developpement)
router.post('/:paymentId/simulate-callback', roleCheck('CASHIER', 'ADMIN'), mobileMoneyController.simulateCallback);

module.exports = router;
