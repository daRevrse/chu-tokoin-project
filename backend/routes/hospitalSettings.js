const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const controller = require('../controllers/hospitalSettingsController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { logoUpload } = require('../middleware/upload');

const settingsValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le nom de l\'etablissement est requis')
    .isLength({ max: 150 })
    .withMessage('Le nom ne peut pas depasser 150 caracteres'),
  body('email')
    .optional({ values: 'falsy' })
    .isEmail()
    .withMessage('Email invalide')
];

// Lecture publique : la page de connexion et le portail patient affichent le
// nom et le logo de l'etablissement avant toute authentification.
router.get('/hospital', controller.get);

// Modification reservee aux administrateurs de l'etablissement
router.put('/hospital', authenticateToken, roleCheck('ADMIN'), settingsValidation, controller.update);

router.post('/hospital/logo',
  authenticateToken,
  roleCheck('ADMIN'),
  logoUpload.single('logo'),
  controller.uploadLogo
);
router.delete('/hospital/logo', authenticateToken, roleCheck('ADMIN'), controller.deleteLogo);

module.exports = router;
