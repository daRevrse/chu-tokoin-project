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

const ROLES = [
  'RECEPTIONIST',
  'DOCTOR',
  'CASHIER',
  ...SERVICE_ROLES,
  'ADMIN'
];

module.exports = { ROLES, SERVICE_ROLES };
