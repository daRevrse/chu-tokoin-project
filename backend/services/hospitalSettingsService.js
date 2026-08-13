const { HospitalSettings } = require('../models');

// Valeurs du premier demarrage. Elles decrivent l'etablissement pilote ; tout
// nouveau client les remplace depuis Administration > Etablissement.
const DEFAULT_SETTINGS = {
  settingsKey: 'default',
  name: 'CHU Tokoin',
  fullName: 'Centre Hospitalier Universitaire de Tokoin',
  city: 'Lome',
  country: 'Togo'
};

// L'identite de l'etablissement est lue a chaque impression de document et a
// chaque ouverture de l'application : elle change une fois par an, la garder
// en memoire evite une requete inutile a chaque fois.
let cached = null;

/**
 * Ligne de configuration de l'etablissement, creee au besoin.
 */
const getHospitalSettings = async () => {
  if (cached) return cached;

  const [settings] = await HospitalSettings.findOrCreate({
    where: { settingsKey: 'default' },
    defaults: DEFAULT_SETTINGS
  });

  cached = settings;
  return settings;
};

/**
 * A appeler apres toute modification, pour que la prochaine lecture reparte
 * de la base.
 */
const invalidateHospitalSettingsCache = () => {
  cached = null;
};

/**
 * Lignes d'en-tete a imprimer sur un document (ordonnance, rapport, ticket).
 * Les champs vides sont omis : un etablissement qui n'a pas renseigne son
 * site web ne doit pas se retrouver avec une ligne vide sur ses documents.
 */
const getDocumentHeaderLines = (settings) => {
  const location = [settings.address, settings.city, settings.country]
    .filter(Boolean)
    .join(', ');

  const contact = [
    settings.phone ? `Tel: ${settings.phone}` : null,
    settings.email,
    settings.website
  ].filter(Boolean).join(' - ');

  return [settings.fullName, location, contact].filter(Boolean);
};

module.exports = {
  getHospitalSettings,
  invalidateHospitalSettingsCache,
  getDocumentHeaderLines,
  DEFAULT_SETTINGS
};
