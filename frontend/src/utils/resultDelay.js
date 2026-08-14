/**
 * Mise en forme de la date de disponibilite annoncee au patient.
 *
 * Le message est lu a voix haute au guichet, puis imprime sur le recu : il doit
 * etre dit tel quel, sans que la caissiere ait a convertir des heures en date.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Nombre de jours calendaires entre deux instants, minuit a minuit.
 * On compare des jours et non des durees : un examen paye a 23 h et pret a
 * 1 h du matin est bien « demain », pas « dans 2 heures ».
 */
const calendarDaysBetween = (from, to) => {
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
};

/**
 * Phrase complete a annoncer, ex. « demain à partir de 14:30 ».
 * @param {string|Date|null} expectedResultAt
 * @param {Date} [now]
 * @returns {string|null} null si aucune estimation n'est disponible
 */
export const formatExpectedResult = (expectedResultAt, now = new Date()) => {
  if (!expectedResultAt) return null;

  const date = new Date(expectedResultAt);
  if (Number.isNaN(date.getTime())) return null;

  const heure = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const jours = calendarDaysBetween(now, date);

  if (jours <= 0) return `aujourd'hui à partir de ${heure}`;
  if (jours === 1) return `demain à partir de ${heure}`;

  const jour = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return `${jour} à partir de ${heure}`;
};

/**
 * Vrai lorsque la date annoncee est depassee : le patient qui repasse n'est
 * alors plus « en avance », c'est le delai qui a ete tenu trop court.
 */
export const isExpectedResultPassed = (expectedResultAt, now = new Date()) => {
  if (!expectedResultAt) return false;
  const date = new Date(expectedResultAt);
  return !Number.isNaN(date.getTime()) && date <= now;
};
