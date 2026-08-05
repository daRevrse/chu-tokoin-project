const express = require('express');
const router = express.Router();
const patientRecordController = require('../controllers/patientRecordController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Toutes les routes necessitent l'authentification
router.use(authenticateToken);

// Recherche de patients (accessible a tous les utilisateurs authentifies)
router.get('/search', patientRecordController.searchPatients);

// Resume medical d'un patient
router.get('/:patientId/summary',
  roleCheck('DOCTOR', 'ADMIN'),
  patientRecordController.getMedicalSummary
);

// Obtenir le dossier complet d'un patient
router.get('/:patientId',
  roleCheck('DOCTOR', 'ADMIN'),
  patientRecordController.getPatientRecord
);

// Obtenir l'historique des examens d'un patient
router.get('/:patientId/exams',
  roleCheck('DOCTOR', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  patientRecordController.getPatientExamHistory
);

// Obtenir les resultats d'un patient
router.get('/:patientId/results',
  roleCheck('DOCTOR', 'ADMIN'),
  patientRecordController.getPatientResults
);

module.exports = router;
