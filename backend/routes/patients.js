const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const patientController = require('../controllers/patientController');
const authenticateToken = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const { SERVICE_ROLES } = require('../utils/roles');

// Validation pour la creation de patient
const createValidation = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('Le prenom est requis'),
  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('Le nom est requis'),
  body('dateOfBirth')
    .isDate()
    .withMessage('Date de naissance invalide'),
  body('gender')
    .isIn(['M', 'F'])
    .withMessage('Genre invalide (M ou F)'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Le telephone est requis'),
  // `checkFalsy` est indispensable : le formulaire envoie toujours la cle,
  // avec une chaine vide quand le champ n'est pas rempli. `.optional()` seul
  // n'ignore que `undefined` et rejetterait tout patient sans email.
  body('email')
    .optional({ checkFalsy: true })
    .isEmail()
    .withMessage('Email invalide')
];

// Toutes les routes necessitent une authentification
router.use(authenticateToken);

// Routes
// L'identite du patient est du ressort de l'accueil : le medecin la consulte
// mais ne la cree ni ne la modifie. Le dossier medical reste cote medecin
// (voir routes/patientRecords.js).
router.post('/',
  roleCheck('RECEPTIONIST', 'ADMIN'),
  createValidation,
  patientController.create
);

router.get('/',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'CASHIER', 'ADMIN'),
  patientController.search
);

router.get('/number/:number',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'CASHIER', 'ADMIN'),
  patientController.getByNumber
);

router.get('/:id',
  roleCheck('RECEPTIONIST', 'DOCTOR', 'CASHIER', ...SERVICE_ROLES, 'ADMIN'),
  patientController.getById
);

router.put('/:id',
  roleCheck('RECEPTIONIST', 'ADMIN'),
  patientController.update
);

module.exports = router;
