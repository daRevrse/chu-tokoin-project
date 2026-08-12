/**
 * Date "metier" de l'etablissement, au format YYYY-MM-DD.
 *
 * Le pool MySQL est configure en `timezone: '+00:00'` (voir config/database.js).
 * Lome etant a UTC+0 sans heure d'ete, la date UTC correspond aujourd'hui a la
 * date locale. Le decalage reste neanmoins centralise ici : toute la
 * numerotation des passages en depend, et un passage enregistre en soiree ne
 * doit jamais basculer au lendemain.
 *
 * CLINIC_UTC_OFFSET_HOURS permet d'ajuster si l'application est deployee dans
 * un autre fuseau, sans avoir a retoucher le code appelant.
 */
const OFFSET_HOURS = Number(process.env.CLINIC_UTC_OFFSET_HOURS || 0);

/**
 * Retourne la date metier correspondant a un instant donne.
 * @param {Date} [at] - instant de reference, maintenant par defaut
 * @returns {string} date au format YYYY-MM-DD
 */
const getBusinessDate = (at = new Date()) => {
  const shifted = new Date(at.getTime() + OFFSET_HOURS * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
};

/**
 * Verifie qu'une chaine est bien une date au format YYYY-MM-DD.
 */
const isBusinessDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);

module.exports = { getBusinessDate, isBusinessDate };
