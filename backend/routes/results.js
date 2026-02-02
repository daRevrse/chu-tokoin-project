const express = require('express');
const router = express.Router();
const resultController = require('../controllers/resultController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { upload } = require('../middleware/upload');

// Toutes les routes necessitent l'authentification
router.use(authenticateToken);

// Upload de resultat (radiologues, techniciens labo, admin)
router.post(
  '/',
  roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  upload.single('file'),
  resultController.upload
);

// Obtenir les resultats d'un examen
router.get('/exam/:prescriptionExamId', resultController.getByExam);

// Telecharger un fichier resultat
router.get('/:id/download', resultController.download);

// Valider un resultat (medecins, admin)
router.patch(
  '/:id/validate',
  roleCheck('DOCTOR', 'ADMIN'),
  resultController.validate
);

// Mettre a jour les commentaires/conclusion
router.put(
  '/:id',
  roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  resultController.update
);

// Supprimer un resultat
router.delete(
  '/:id',
  roleCheck('RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'),
  resultController.delete
);

module.exports = router;
