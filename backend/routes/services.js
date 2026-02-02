const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const serviceController = require('../controllers/serviceController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Toutes les routes sont reservees aux services (radiologie/labo) et admin
router.use(roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'));

// Scanner et verifier QR code
router.post('/verify-qr',
  body('qrData').notEmpty().withMessage('Donnees QR requises'),
  serviceController.verifyQRCode
);

// Examens en attente pour le service
router.get('/pending', serviceController.getPendingExams);

// Examens en cours par l'utilisateur
router.get('/in-progress', serviceController.getInProgressExams);

// Mes examens (en cours et termines)
router.get('/my-exams', serviceController.getMyExams);

// Demarrer un examen
router.patch('/exams/:id/start', serviceController.startExam);

// Terminer un examen
router.patch('/exams/:id/complete',
  body('notes').optional().isString(),
  serviceController.completeExam
);

module.exports = router;
