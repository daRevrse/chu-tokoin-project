const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const controller = require('../controllers/serviceAdminController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

const serviceValidation = [
  body('code').trim().notEmpty().withMessage('Le code est requis'),
  body('name').trim().notEmpty().withMessage('Le nom est requis')
];

const namedValidation = [
  body('code').trim().notEmpty().withMessage('Le code est requis'),
  body('name').trim().notEmpty().withMessage('Le nom est requis')
];

// Toute la configuration des services est reservee aux administrateurs
router.use(authenticateToken);
router.use(roleCheck('ADMIN'));

// Services
router.get('/', controller.getAll);
router.post('/', serviceValidation, controller.create);
router.put('/:id', controller.update);

// Sous-categories
router.post('/:serviceId/categories', namedValidation, controller.createCategory);
router.put('/categories/:id', controller.updateCategory);

// Etapes de realisation
router.post('/:serviceId/steps', namedValidation, controller.createStep);
router.put('/steps/:id', controller.updateStep);
router.patch('/:serviceId/steps/reorder', controller.reorderSteps);

module.exports = router;
