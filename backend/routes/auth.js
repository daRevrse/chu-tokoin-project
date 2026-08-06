const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { avatarUpload } = require('../middleware/upload');

// Validation pour l'inscription
const registerValidation = [
  body('email')
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caracteres'),
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Le prenom est requis'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis'),
  body('role')
    .isIn(['DOCTOR', 'CASHIER', 'RADIOLOGIST', 'LAB_TECHNICIAN', 'ADMIN'])
    .withMessage('Role invalide')
];

// Validation pour le changement de mot de passe
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Le mot de passe actuel est requis'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('Le nouveau mot de passe doit contenir au moins 6 caracteres')
];

// Validation pour la connexion
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Mot de passe requis')
];

// Routes publiques
router.post('/login', loginValidation, authController.login);
router.post('/refresh-token', authController.refreshToken);

// Creation de compte : reservee aux administrateurs.
// Cette route etait publique, ce qui permettait a n'importe qui de creer un
// compte ADMIN. La gestion des comptes passe desormais par /api/users.
router.post('/register',
  authenticateToken,
  roleCheck('ADMIN'),
  registerValidation,
  authController.register
);

// Routes protegees
router.get('/profile', authenticateToken, authController.getProfile);
router.put('/change-password', authenticateToken, changePasswordValidation, authController.changePassword);

// Photo de profil : chaque utilisateur ne gere que la sienne (req.user)
router.post('/avatar',
  authenticateToken,
  avatarUpload.single('avatar'),
  authController.uploadAvatar
);
router.delete('/avatar', authenticateToken, authController.deleteAvatar);

module.exports = router;
