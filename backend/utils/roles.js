/**
 * Source unique des roles applicatifs.
 *
 * Cette liste etait auparavant recopiee dans models/User.js, routes/auth.js,
 * routes/users.js et controllers/userController.js. Les copies ont diverge :
 * TECHNICIAN et RECEPTIONIST existaient dans l'ENUM du modele mais etaient
 * rejetes par les validateurs, rendant ces roles impossibles a attribuer.
 * Toute nouvelle valeur doit etre ajoutee ici et nulle part ailleurs.
 */

// Personnel affecte a un service technique. TECHNICIAN est le role generique :
// il couvre les services crees apres coup (Cardiologie, Pneumologie, Centre de
// Prelevement...), pour lesquels RADIOLOGIST et LAB_TECHNICIAN n'ont pas de
// sens. Ces deux derniers sont conserves pour les comptes historiques.
const SERVICE_ROLES = ['RADIOLOGIST', 'LAB_TECHNICIAN', 'TECHNICIAN'];

// Infirmier. Introduit pour le service d'accueil des urgences : le triage est un
// acte clinique, pas un geste de guichet. Laisser l'accueil coter la gravite
// reviendrait a faire evaluer un patient par quelqu'un qui n'a pas qualite pour
// le faire — c'est precisement le defaut du drapeau URGENT pose a l'accueil.
const ROLES = [
  'RECEPTIONIST',
  'NURSE',
  'DOCTOR',
  'CASHIER',
  ...SERVICE_ROLES,
  'ADMIN'
];

// Roles autorises a ouvrir un dossier d'urgence et a coter le triage.
const EMERGENCY_ROLES = ['NURSE', 'DOCTOR', 'ADMIN'];

module.exports = { ROLES, SERVICE_ROLES, EMERGENCY_ROLES };
