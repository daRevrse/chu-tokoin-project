const express = require('express');
const router = express.Router();
const patientRecordController = require('../controllers/patientRecordController');
const authenticateToken = require('../middleware/auth');

// Toutes les routes necessitent l'authentification
router.use(authenticateToken);

// Recherche de patients (accessible a tous les utilisateurs authentifies)
router.get('/search', patientRecordController.searchPatients);

// Obtenir le dossier complet d'un patient
router.get('/:patientId', patientRecordController.getPatientRecord);

// Obtenir l'historique des examens d'un patient
router.get('/:patientId/exams', patientRecordController.getPatientExamHistory);

// Obtenir les resultats d'un patient
router.get('/:patientId/results', patientRecordController.getPatientResults);

module.exports = router;
