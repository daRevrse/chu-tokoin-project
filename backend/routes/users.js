const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const { ROLES } = require('../utils/roles');

const createValidation = [
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
    .isIn(ROLES)
    .withMessage('Role invalide'),
  // Coherence role/service verifiee dans le controleur (resolveServiceId) :
  // elle depend du role, ce que la validation par champ ne sait pas exprimer.
  body('serviceId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('Service invalide')
];

const updateValidation = [
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email invalide')
    .normalizeEmail(),
  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le prenom ne peut pas etre vide'),
  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le nom ne peut pas etre vide'),
  body('role')
    .optional()
    .isIn(ROLES)
    .withMessage('Role invalide'),
  body('serviceId')
    .optional({ values: 'null' })
    .isUUID()
    .withMessage('Service invalide')
];

const resetPasswordValidation = [
  body('password')
    .isLength({ min: 6 })
    .withMessage('Le mot de passe doit contenir au moins 6 caracteres')
];

// L'administration des comptes est strictement reservee aux administrateurs
router.use(authenticateToken);
router.use(roleCheck('ADMIN'));

router.get('/', userController.getAll);
router.get('/stats', userController.getStats);
router.get('/:id', userController.getById);

router.post('/', createValidation, userController.create);
router.put('/:id', updateValidation, userController.update);
router.patch('/:id/status', userController.setStatus);
router.patch('/:id/reset-password', resetPasswordValidation, userController.resetPassword);

module.exports = router;
