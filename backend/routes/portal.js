const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { patientAuth } = require('../middleware/patientAuth');

// Route pour generer un acces (personnel medical uniquement)
router.post(
  '/generate-access',
  authenticateToken,
  roleCheck('DOCTOR', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  portalController.generateAccess
);

// Routes du portail patient (authentification patient)
router.get('/me', patientAuth, portalController.getMyInfo);
router.get('/results', patientAuth, portalController.getMyResults);
router.get('/results/:id/download', patientAuth, portalController.downloadResult);
router.get('/prescriptions', patientAuth, portalController.getMyPrescriptions);

module.exports = router;
