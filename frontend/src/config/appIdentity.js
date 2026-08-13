/**
 * Identité du logiciel, distincte de celle de l'hôpital qui l'utilise.
 *
 * H360 est le produit : ces valeurs sont les mêmes chez tous les clients et
 * ne sont donc pas administrables. Le nom, le logo et les coordonnées de
 * l'établissement se règlent dans Administration > Établissement et se lisent
 * via `useHospital()`.
 */
export const APP_IDENTITY = Object.freeze({
  name: 'H360',
  tagline: 'Solution Hospitalière Intelligente',
  description: 'Système de Gestion des Examens Médicaux',
  // Logos du produit, servis depuis /public
  logo: '/logo-black.png',
  logoOnDark: '/logo-nobg.png'
});

export default APP_IDENTITY;
