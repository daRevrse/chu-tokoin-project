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
  // Le rattachement se fait desormais par service ; `category` reste accepte
  // pour les appels qui n'ont pas encore migre.
  body('serviceId')
    .optional()
    .isUUID()
    .withMessage('Service invalide'),
  body('categoryId')
    .optional({ nullable: true })
    .isUUID()
    .withMessage('Sous-categorie invalide'),
  body('category')
    .optional()
    .isIn(['RADIOLOGY', 'LABORATORY'])
    .withMessage('Categorie invalide (RADIOLOGY ou LABORATORY)'),
  body('price')
    .isFloat({ min: 0 })
    .withMessage('Le prix doit etre un nombre positif'),
  // Delai annonce au patient a la caisse. Optionnel : le modele retient 24 h
  // par defaut, a affiner service par service.
  body('resultDelayHours')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 2160 })
    .withMessage('Delai invalide (0 a 2160 heures)')
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

// La mise a jour n'avait aucune validation : une valeur hors bornes remontait
// en 500 depuis le validateur Sequelize au lieu d'un 400 explicite. Seuls les
// champs modifiables sont controles, tous optionnels.
const updateValidation = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Le nom ne peut pas etre vide'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Le prix doit etre un nombre positif'),
  body('resultDelayHours')
    .optional({ values: 'null' })
    .isInt({ min: 0, max: 2160 })
    .withMessage('Delai invalide (0 a 2160 heures)'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Statut invalide')
];

router.put('/:id',
  roleCheck('ADMIN'),
  updateValidation,
  examController.update
);

module.exports = router;
