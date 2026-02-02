const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const examController = require('../controllers/examController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Validation pour la creation d'examen
const createValidation = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Le code est requis'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis'),
  body('category')
    .isIn(['RADIOLOGY', 'LABORATORY'])
    .withMessage('Categorie invalide (RADIOLOGY ou LABORATORY)'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Le prix doit etre un nombre positif')
];

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Routes
router.get('/', examController.getAll);

router.get('/category/:category', examController.getByCategory);

router.get('/:id', examController.getById);

router.post('/',
  roleCheck('ADMIN'),
  createValidation,
  examController.create
);

router.put('/:id',
  roleCheck('ADMIN'),
  examController.update
);

module.exports = router;
