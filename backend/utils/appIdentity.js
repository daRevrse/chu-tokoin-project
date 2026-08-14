/**
 * Identite du logiciel, distincte de celle de l'etablissement qui l'utilise.
 *
 * H360 est le produit : son nom, sa signature et son editeur sont les memes
 * chez tous les clients et ne sont donc pas administrables. Tout ce qui varie
 * d'un hopital a l'autre (nom, logo, coordonnees) vit dans le modele
 * HospitalSettings et se regle depuis l'espace Administration.
 */
const APP_IDENTITY = Object.freeze({
  name: 'H360',
  tagline: 'Solution Hospitaliere Intelligente',
  description: 'Systeme de Gestion des Examens Medicaux'
});

module.exports = { APP_IDENTITY };
