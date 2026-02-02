const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Statistiques globales - accessible par ADMIN et CASHIER
router.get('/stats/global', roleCheck('ADMIN', 'CASHIER'), reportController.getGlobalStats);

// Rapports financiers - accessible par ADMIN et CASHIER
router.get('/financial/daily', roleCheck('ADMIN', 'CASHIER'), reportController.getDailyFinancial);
router.get('/financial/period', roleCheck('ADMIN', 'CASHIER'), reportController.getPeriodFinancial);

// Rapport d'activite par service - accessible uniquement par ADMIN
router.get('/activity/service', roleCheck('ADMIN'), reportController.getServiceActivity);

// Exports - accessible par ADMIN et CASHIER
router.get('/export/excel', roleCheck('ADMIN', 'CASHIER'), reportController.exportExcel);
router.get('/export/pdf', roleCheck('ADMIN', 'CASHIER'), reportController.exportPDF);

module.exports = router;
